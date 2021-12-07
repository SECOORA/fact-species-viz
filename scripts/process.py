import json
import math
import os
import sys
from functools import cache, singledispatch
from io import BytesIO
from pathlib import PosixPath as Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple, Union

import click
import numpy as np
import pandas as pd
import geojson
import geopandas
import orjson
import pyvisgraph as vg
import requests
from shapely.geometry import asPolygon, box, LineString, MultiPoint, Point, Polygon, MultiPolygon, geo
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union
from shapely_geojson import Feature, FeatureCollection
from skimage.measure import find_contours
from scipy.interpolate import interp1d
from scipy.stats import gaussian_kde
from tqdm import tqdm

# what is this?!?
try:
    from hull import ConcaveHull
except ImportError:
    from .hull import ConcaveHull
    
from .fetch import get_all_tables, get_from_graphql
from .config import CONFIG
from .utils import lock
from .cache import r

# transform functions
def raw(df: pd.DataFrame) -> geopandas.GeoDataFrame:
    """
    No averaging of anything, just the raw data in with geometry.
    """
    # just set month as the index
    month_df = df.set_index('monthcollected')
    return to_gdf(month_df)


def monthly_avg(df: pd.DataFrame) -> geopandas.GeoDataFrame:
    """
    Takes raw data, does any processing on the raw values, returns a GeoDataFrame
    """
    # get average position of each animal fieldnumber over the month
    time_field = 'monthcollected'
    avgs = df.groupby(['fieldnumber', time_field]).agg('mean')

    # remove animal fieldnumber from index
    avgs.reset_index(0, inplace=True)

    return to_gdf(avgs)


def weekly_avg(df: pd.DataFrame) -> geopandas.GeoDataFrame:
    # get average position of each animal fieldnumber over each week
    time_field = 'weekcollected'
    avgs = df.groupby(['fieldnumber', time_field]).agg('mean')

    avgs['monthcollected'] = avgs['monthcollected'].round().astype(int)
    avgs.set_index('monthcollected', inplace=True)

    return to_gdf(avgs)


def bounding_boxes(df: pd.DataFrame) -> geopandas.GeoDataFrame:
    """
    Creates bounding boxes for each animal over a monthly timeframe.
    """
    df_bb = df.groupby(['fieldnumber', 'monthcollected']).agg(['min', 'max']).reset_index(0)
    # df_bb = df_bb[['monthcollected', 'fieldnumber', 'geometry']]
    boxes=df_bb.apply(lambda rec: box(rec.longitude['min'], rec.latitude['min'], rec.longitude['max'], rec.latitude['max']), axis=1)

    return geopandas.GeoDataFrame(df_bb, geometry=boxes)


def buffered_points(df: pd.DataFrame) -> geopandas.GeoDataFrame:
    month_df = df.set_index('monthcollected')
    return geopandas.GeoDataFrame(
        month_df,
        geometry=[
            p.buffer(0.3) for p in geopandas.points_from_xy(df.longitude, df.latitude)
        ]
    )


def animal_boxes(df: pd.DataFrame) -> geopandas.GeoDataFrame:
    """
    For each animal, per month, make a bounding box, then union them up + buffer the whole thing.
    """
    def custom(pdf: pd.DataFrame):
        if not isinstance(pdf.name, tuple):
            return None

        nodupes = pdf.drop_duplicates(subset=['latitude', 'longitude'])
        poly = geopandas.points_from_xy(nodupes.longitude, nodupes.latitude).unary_union().convex_hull #.minimum_rotated_rectangle
        return poly

    grouped_df = df.drop(columns=['datecollected', 'weekcollected']).groupby(['fieldnumber', 'monthcollected'])
    xformed = grouped_df.apply(custom)

    new_df = pd.DataFrame(xformed, columns=['geom']).reset_index(0)
    gdf = geopandas.GeoDataFrame(new_df, geometry=new_df['geom']).drop(columns=['geom'])

    return gdf


def get_interp_line(lon_start: float, lat_start: float, lon_end: float, lat_end: float, method: str='visgraph') -> LineString:
    """
    Creates a line from start to end.
    """
    if method == 'simple':
        return LineString([
            (lon_start, lat_start),
            (lon_end, lat_end)
        ])
    elif method == 'visgraph':
        g = build_vis_graph()
        vg_line = g.shortest_path(
            vg.Point(lon_start, lat_start),
            vg.Point(lon_end, lat_end)
        )

        # translate into shapely linestring
        return LineString([
            (p.x, p.y) for p in vg_line
        ])

    raise ValueError(f"Unknown method ({method}) for get_interp_line")


def animal_interpolated_paths(df: pd.DataFrame, interp_method: str="simple", max_day_gap: int=15) -> geopandas.GeoDataFrame:
    """
    For each animal, interpolate the path between detections (daily).
    """
    grouped_df = df.drop(columns=['weekcollected', 'monthcollected']).groupby(['fieldnumber'])
    animal_tracks: List[pd.DataFrame] = []

    for name, df_group in tqdm(grouped_df, desc="Animal Daily Position"):
        gdf = df_group.set_index('datecollected')

        assign_vals = {
            'fieldnumber': name,
            'commonname': gdf.iloc[0].at['commonname'],
            'scientificname': gdf.iloc[0].at['scientificname'],
            'aphiaid': gdf.iloc[0].at['aphiaid']
        }

        # resample on days, average the location of that day, drop empty days
        gdf = gdf.resample('D').mean().dropna().assign(**assign_vals)

        # determine gaps in days
        diffs = gdf.index.to_series().diff().astype('timedelta64[D]')    # first row is always NaT

        # get all location indicies that match the days we have to fill in
        end_idxs = [i for i, v in enumerate(diffs.between(1.0, float(max_day_gap), inclusive=False).to_list()) if v]

        # end idxs refers to the integer-location based index of the END of the date range
        # the beginning of the date range is the index directly before it
        add_dfs = []

        for i, end_idx in enumerate(tqdm(end_idxs, desc="Filling gaps")):
            begin = gdf.iloc[end_idx - 1]
            end = gdf.iloc[end_idx]

            # create a date range, daily
            date_range = pd.date_range(begin.name, end.name, freq='D')

            # if the begin and end is the same, there's no line, and no need to interpolate
            if np.isclose(begin.longitude, end.longitude) and np.isclose(begin.latitude, end.latitude):
                interp_df = pd.DataFrame({
                    'longitude': [begin.longitude] * (len(date_range) - 2),
                    'latitude': [begin.latitude] * (len(date_range) - 2),
                }, index=date_range[1:-1]).assign(**assign_vals)

                add_dfs.append(interp_df)
                continue

            # make a path between the begin and end
            line = get_interp_line(begin.longitude, begin.latitude, end.longitude, end.latitude, method=interp_method)

            # normalize that date range so we can feed data to the linestring interpolate
            # https://stackoverflow.com/a/41532180
            normalized_dates = (date_range - date_range.min()) / (date_range.max() - date_range.min())

            # skipping the beginning and end, interpolate over the line, transforming into a dataframe
            interp_points = [list(line.interpolate(nd, normalized=True).coords)[0] for nd in normalized_dates[1:-1]]
            interp_lons, interp_lats = zip(*interp_points)

            interp_df = pd.DataFrame({
                'longitude': interp_lons,
                'latitude': interp_lats,
            }, index=date_range[1:-1]).assign(**assign_vals)

            add_dfs.append(interp_df)

        # concat them all into one dataframe
        full_gdf = pd.concat([
            gdf,
            *add_dfs
        ]).sort_index().rename_axis('datecollected')

        animal_tracks.append(full_gdf)

    full_animal_tracks = pd.concat(animal_tracks)

    # restore monthlycollected for all points - the synethsized points didn't have them
    full_animal_tracks['monthcollected'] = full_animal_tracks.index.month

    # turn into a gdf
    full_animal_daily_pos = geopandas.GeoDataFrame(full_animal_tracks, geometry=geopandas.points_from_xy(full_animal_tracks.longitude, full_animal_tracks.latitude))
    full_animal_daily_pos.reset_index(inplace=True)
    full_animal_daily_pos.set_index('monthcollected', inplace=True)

    return full_animal_daily_pos


@cache
def build_vis_graph(filename: str=None) -> vg.VisGraph:
    saved = Path(CONFIG.data_dir) / Path('landvisgraph.pk1')
    if saved.exists():
        g = vg.VisGraph()
        g.load(str(saved))
        return g

    if not filename:
        filename = "data/secoora-land.geojson"

    with open(filename) as f:
        gj = geojson.load(f)

    polys = []
    for polygon_outer in gj.geometry.coordinates:
        assert len(polygon_outer) == 1      # no inner rings

        polys.append(
            [vg.Point(*c) for c in polygon_outer[0]]
        )

    g = vg.VisGraph()
    g.build(polys, workers=4)

    g.save(str(saved))
    return g


# https://github.com/adaj/geohunter/blob/65c65a451f1edaa110de5629e4a3fa9c1cbaa50b/geohunter/util.py#L137-L169
@cache
def make_gridsquares(bounds, resolution=1) -> Tuple[geopandas.GeoDataFrame, geopandas.GeoDataFrame]:
    """It constructs a grid of square cells.
    Parameters
    ----------
    bounds : 
        Corresponds to the boundary geometry in which the grid will be formed.
    resolution : float, default is 1.
        Space between the square cells.
    """
    x0 = bounds[0] - 1
    xf = bounds[2] + 1
    y0 = bounds[1] - 1
    yf = bounds[3] + 1
    n_y = int((yf-y0)/(resolution/110.57))
    n_x = int((xf-x0)/(resolution/111.32))
    grid = {}
    c = 0
    for i in range(n_x):
        for j in range(n_y):
            grid[c] = {'geometry': Polygon([[x0, y0],
                                            [x0+(resolution/111.32), y0],
                                            [x0+(resolution/111.32),
                                             y0+(resolution/110.57)],
                                            [x0, y0+(resolution/110.57)]])}
            c += 1
            y0 += resolution/110.57
        y0 = bounds[1] - 1
        x0 += resolution/111.32
    pd_grid = pd.DataFrame(grid).transpose()
    gp_grid = geopandas.GeoDataFrame(pd_grid, geometry='geometry',
                            crs='EPSG:4326')

    centroids = gp_grid.geometry.apply(lambda x: x.centroid)
    p_grid = geopandas.GeoDataFrame(geometry=centroids)
    p_grid['lat'] = centroids.y
    p_grid['lon'] = centroids.x

    return gp_grid, p_grid
    #grid = geopandas.sjoin(grid, city_shape, op='intersects')
    #return grid[~grid.index.duplicated()]


# https://github.com/adaj/geohunter/blob/65c65a451f1edaa110de5629e4a3fa9c1cbaa50b/geohunter/util.py#L21
def kde_interpolation(poi, grid, bw='scott') -> geopandas.GeoDataFrame:
    """Applies kernel density estimation to a set points-of-interest
    measuring the density estimation on a grid of places (arbitrary points
    regularly spaced).
    Parameters
    ----------
    poi : GeoDataFrame.
        Corresponds to input data.
    bw : 'scott', 'silverman' or float.
        The bandwidth for kernel density estimation. Check `scipy docs`_ about their bw parameter of gaussian_kde.
    grid : GeoDataFrame
        Grid of points, should correspond to centroids of make_gridsquares, with lat/lon columns added.
    Returns
    -------
    GeoDataFrame with a grid of points regularly spaced with the respective
    density values for the input points-of-interest given.
    """
    assert isinstance(poi, geopandas.GeoDataFrame)
    kernel = gaussian_kde(
        np.vstack([poi.centroid.x, poi.centroid.y]),
        bw_method=bw
    )
    grid_ = grid.copy()
    grid_['density'] = kernel(grid[['lon', 'lat']].values.T)
    return grid_


def _match_with_grid(animal_gdf: geopandas.GeoDataFrame, bounds, resolution: int=10) -> geopandas.GeoDataFrame:
    """
    @param 
    # gdf is geopandas dataframe wrapped around shapely geometry for each animal,
    """
    print("    Building grid", file=sys.stderr)
    s_grid, _ = make_gridsquares(bounds, resolution=resolution)

    def project_counts(s: pd.Series) -> pd.Series:
        """
        Calculates counts of project_codes for each grouped series (each grid square).
        Turns them into a column per project.
        """
        return s['project_code'].value_counts().to_frame('count').T

    # join the grid squares with the animal geometry
    print("    Joining animal tracks with grid", file=sys.stderr)
    grouped = geopandas.sjoin(animal_gdf, s_grid).groupby('index_right')

    print("    Calculating counts", file=sys.stderr)
    match_counts = grouped.apply(project_counts)
    match_counts.reset_index(1, drop=True, inplace=True)    # remove the 'count' index
    match_counts['counts'] = match_counts.sum(axis=1)
    joined = geopandas.GeoDataFrame(match_counts.join(s_grid, how='outer').fillna(0))

    return joined


def _match_with_grid_kde(animal_gdf: geopandas.GeoDataFrame, bounds, resolution: int=10) -> geopandas.GeoDataFrame:
    """
    @param 
    """
    s_grid, p_grid = make_gridsquares(bounds, resolution=resolution)

    kde = kde_interpolation(animal_gdf, p_grid, bw='silverman')
    density_frame = kde['density'].to_frame(f'counts')
    density_points = p_grid.join(density_frame)

    match_means = geopandas.sjoin(density_points, s_grid).groupby('index_right').mean()
    joined = geopandas.GeoDataFrame(match_means.join(s_grid, how='outer').fillna(0))

    return joined


def make_contour_polygons(gdf: geopandas.GeoDataFrame, levels: Sequence[Union[int, float]], level_adjust: float=0.0, range_low: float=-math.inf, range_high: float=math.inf) -> List[Feature]:
    """
    Creates a contour filled polygon Feature per level.

    @param gdf  GeoDataFrame of a grid of points, ordered by longitude major, latitude minor.
    """
    # set normalized range for percent calcs
    min_level = min(levels)
    max_level = max(levels)
    def calc_pct(val, minl=min_level, maxl=max_level):
        try:
            return (val - minl) / (maxl - minl)
        except ZeroDivisionError:
            return 0.

    # figure out how many latitudes exist in the first column of longitudes
    lon_diffs = gdf.geometry.map(lambda p: p.x).diff()
    sig_diffs = lon_diffs[lon_diffs > 0.01]     # @TODO: prolly not good
    assert len(sig_diffs)

    num_lats = sig_diffs.index[0]
    num_lons = len(gdf) // num_lats
    assert len(gdf) % num_lats == 0       # make sure it was an even divisor

    # extract lats and lons from dataframe
    lats = gdf.geometry[0:num_lats].apply(lambda p: p.y).tolist()
    lons = gdf.geometry[::num_lats].apply(lambda p: p.x).tolist()

    # set up interpolators to convert from image space back into lat/lon space
    interp_x = interp1d(np.arange(0, num_lons), lons)
    interp_y = interp1d(np.arange(0, num_lats), lats)

    # now extract count data and massage it into a 2d array
    split_counts = np.split(gdf['counts'].to_numpy(), num_lons)
    bits = np.stack(split_counts).transpose()       # go from lon major to lat major. makes far more sense in my head

    # calculate all contours
    contour_levels = []
    for level in levels:
        # calculate contours for the given level
        contours = find_contours(bits, level + level_adjust)

        # each contour in the list is an array of [lat, lon] indices (well, between indicies) that a contour line goes
        # they form polygons, except near the edges, they might not be closed, but this should hopefully not be a problem
        # with our giant area. famous last words.

        # the contour list doesn't give us a list of what's an interior so we have to find this ourselves by keeping track
        # and continuously refining polygons.
        polys: List[Polygon] = []

        for contour in contours:
            contour_poly = Polygon([
                (interp_x(ix), interp_y(iy)) for iy, ix in contour
            ])

            # now find if it's already contained
            for i, ep in enumerate(polys):
                if ep.contains(contour_poly):
                    new_poly = Polygon(
                        ep.exterior.coords,
                        holes=[
                            *[epi.coords for epi in ep.interiors],
                            contour_poly.exterior.coords
                        ]
                    )

                    # replace existing poly at the same index
                    polys[i] = new_poly
                    break
            else:
                # not contained, add it to top level polygon list
                polys.append(contour_poly)

        fpoly = polys[0] if len(polys) == 1 else MultiPolygon(polys)

        props = {
            'level': level,
            'local_pct': calc_pct(level),
            'pct': calc_pct(level)      # will only stay if "all"
        }

        # calc normalized pct vs global dataset range
        if range_low != -math.inf:
            props['pct'] = calc_pct(level, range_low, range_high)

        contour_levels.append(
            Feature(
                fpoly,
                properties=props
            )
        )

    return contour_levels


@singledispatch
def smooth_polygon(poly: Polygon, refinements: int=5) -> Polygon:
    return Polygon(
        chaikins_corner_cutting(poly.exterior.coords, refinements=refinements),
        holes=[chaikins_corner_cutting(i.coords) for i in poly.interiors]
    )


@smooth_polygon.register
def _(poly: Feature, refinements: int=5) -> Feature:
    return Feature(
        smooth_polygon(poly.geometry, refinements=refinements),
        properties=poly.properties
    )


@smooth_polygon.register
def __(poly: MultiPolygon, refinements: int=5) -> MultiPolygon:
    return MultiPolygon(
        [smooth_polygon(p, refinements=refinements) for p in poly.geoms]
    )


@singledispatch
def buffer_union(poly: Polygon, buffer_size: float=0.1) -> Polygon:
    return poly.buffer(buffer_size)


@buffer_union.register
def buffer_union_(poly: Feature, buffer_size: float=0.1) -> Feature:
    return Feature(
        buffer_union(poly.geometry, buffer_size=buffer_size),
        properties=poly.properties
    )


@buffer_union.register
def buffer_union__(poly: MultiPolygon, buffer_size: float=0.1) -> MultiPolygon:
    return unary_union(
        [buffer_union(p) for p in poly.geoms]
    )


def chaikins_corner_cutting(coords: Union[list, np.ndarray], refinements: int=5) -> np.ndarray:
    """
    Implements chaikin's algorithm to smooth polygons.
    http://graphics.cs.ucdavis.edu/education/CAGDNotes/Chaikins-Algorithm/Chaikins-Algorithm.html

    Implementation from:
    https://stackoverflow.com/a/47255374/84732
    """

    coords = np.array(coords)

    for _ in range(refinements):
        L = coords.repeat(2, axis=0)
        R = np.empty_like(L)
        R[0] = L[0]
        R[2::2] = L[1:-1:2]
        R[1:-1:2] = L[2::2]
        R[-1] = L[-1]
        coords = L * 0.75 + R * 0.25

    return coords


agg_methods: Dict[str, Dict[str, Union[Callable, str]]] = {
    'raw': {
        'callable': raw,
        'discrim': 'FULL'
    },
    'monthly': {
        'callable': monthly_avg,
        'discrim': 'MONTH',
    },
    'weekly': {
        'callable': weekly_avg,
        'discrim': 'WEEK',
    },
    'bounding_boxes': {
        'callable': bounding_boxes,
        'discrim': 'BOXES'
    },
    'buffered_points': {
        'callable': buffered_points,
        'discrim': 'BUFFERED',
    },
    'animal_boxes': {
        'callable': animal_boxes,
        'discrim': 'ANIM_BOXES'
    },
    'animal_interpolated_paths': {
        'callable': animal_interpolated_paths,
        'discrim': 'ANIM_PATHS'
    }
}

def summary_raw(gdf: geopandas.GeoDataFrame, **kwargs) -> BaseGeometry:
    #return FeatureCollection([gi for gi in gdf.geometry])
    return geopandas.GeoSeries([gdf.unary_union])

def summary_convex(gdf: geopandas.GeoDataFrame, **kwargs) -> geopandas.GeoDataFrame:
    convex_hull = gdf.unary_union.convex_hull
    if isinstance(convex_hull, Polygon):
        convex_hull = smooth_polygon(convex_hull)
    feat = buffer_union(Feature(
        convex_hull,
        {'level': 1}
    ))
    hull = geopandas.GeoDataFrame.from_features([feat])
    return hull

def summary_concave(gdf: geopandas.GeoDataFrame, **kwargs) -> geopandas.GeoDataFrame:
    print("Calculating concave hull", file=sys.stderr)
    month_df_points = np.unique(np.stack(
        (
            gdf['longitude'].to_numpy(),
            gdf['latitude'].to_numpy()
        ),
        axis=1
    ), axis=0)
    hullobj = ConcaveHull(month_df_points)
    if hullobj is not None:
        geom = asPolygon(hullobj.calculate())
        try:
            # if the hull is busted, intentionally trigger an error to let it do convex below
            _ = geom.area
            buffered_geom = hullobj.buffer_in_meters(geom, 1000)
            feat = buffer_union(Feature(
                smooth_polygon(buffered_geom),
                {'level': 1}
            ))
            return geopandas.GeoDataFrame.from_features([feat])
        except TypeError:
            pass

    # couldn't do concave? convex is close.
    print("WARN: could not do concave hull, returning convex", file=sys.stderr)
    return summary_convex(gdf)

def summary_bbox(gdf: geopandas.GeoDataFrame, **kwargs) -> BaseGeometry:
    return geopandas.GeoSeries([box(*gdf.total_bounds)])

def summary_rotated_bbox(gdf: geopandas.GeoDataFrame, **kwargs) -> BaseGeometry:
    rbbox = gdf.unary_union.minimum_rotated_rectangle
    return geopandas.GeoSeries([rbbox])


def summary_distribution(gdf: geopandas.GeoDataFrame, bounds=None, range_low: float=-math.inf, range_high: float=math.inf, **kwargs) -> geopandas.GeoDataFrame:
    """
    Converts a GeoDataFrame with per-animal daily positions into paths, then 
    intersects them with a regular grid of boxes and generates a heatmap of polygons.
    """
    animal_tracks: List[geopandas.GeoDataFrame] = []

    # incoming gdf is all daily points in a month for every animal - break it into animals instead, and reindex by datecollected
    gdfs = gdf.set_index('datecollected').sort_index().groupby(['project_code', 'fieldnumber'])

    for name_pair, full_gdf in gdfs:
        project_code, name = name_pair

        # now, use the same gaps technique to build geojson primitives out of contiguous days
        anim_gjos: List[Feature] = []

        # determine gaps in days
        full_diffs = full_gdf.index.to_series().diff().astype('timedelta64[D]')
        full_ilocs = [i for i, v in enumerate((full_diffs > 1.0).to_list()) if v]

        # full_diffs contains indicies where new lines (or points, if length 1) should start.  it's a boundary of a slice.
        cur_iloc = 0
        for upper_iloc in [*full_ilocs, None]:  # last slice upper bound is a None
            s = slice(cur_iloc, upper_iloc)
            cur_iloc = upper_iloc

            cut_df = full_gdf.iloc[s]

            geoms = geopandas.points_from_xy(cut_df.longitude, cut_df.latitude)

            # turn this into a geojson object
            assert len(cut_df) > 0, "Animal track has no length?"

            if len(cut_df) == 1 or len(geoms.unique()) == 1:       # if all same point, it's just one point
                geom = geoms[0]
            else:
                geom = LineString(geoms)

            gjo = Feature(
                geom,
                {
                    'begin': cut_df.index[0].strftime('%Y-%m-%d'),
                    'end': cut_df.index[-1].strftime('%Y-%m-%d'),
                    'fieldnumber': name,
                    'project_code': project_code
                }
            )

            anim_gjos.append(gjo)

        feature_gdf = geopandas.GeoDataFrame.from_features(anim_gjos)
        animal_tracks.append(feature_gdf)

    all_interp_animals = pd.concat(animal_tracks, ignore_index=True)
    all_gdf = geopandas.GeoDataFrame(all_interp_animals, geometry='geometry', crs='EPSG:4326')

    # make a grid, join them
    print("Gridding and matching animal tracks", file=sys.stderr)
    matched_gdf = _match_with_grid(all_gdf, bounds, resolution=10)

    # transform to points
    matched_gdf.geometry = matched_gdf.geometry.apply(lambda x: x.centroid)

    # build contour polygons
    print("Building contour polygons", file=sys.stderr)
    level_count = int(matched_gdf['counts'].max())

    if level_count > 30:
        _, bins = np.histogram(matched_gdf['counts'], 30)
        levels = [b+1 for b in bins]
    else:
        levels = [l for l in range(1, level_count + 1)]

    contour_polys = make_contour_polygons(
        matched_gdf,
        levels=levels,
        level_adjust=-0.1,
        range_low=range_low,
        range_high=range_high
    )

    # smooth polygons out
    print("Smoothing contour polygons", file=sys.stderr)
    smoothed = [smooth_polygon(cpoly) for cpoly in contour_polys]

    ret = geopandas.GeoDataFrame.from_features(smoothed, crs=all_gdf.crs)
    return ret


def summary_distribution_buffered(gdf: geopandas.GeoDataFrame, bounds=None, buffer_size: float=0.05, **kwargs) -> geopandas.GeoDataFrame:
    """
    Calls summary_distribution then does a buffer_union on the resulting polygons.
    """
    distrib_gdf = summary_distribution(gdf, bounds=bounds, **kwargs)
    distrib_gdf.geometry = distrib_gdf.geometry.apply(lambda x: buffer_union(x, buffer_size))

    return distrib_gdf


def summary_distribution_kde(gdf: geopandas.GeoDataFrame, bounds=None, range_low: float=-math.inf, range_high: float=math.inf, **kwargs) -> geopandas.GeoDataFrame:
    """
    Does a kernel density estimate on all daily animal locations, intersects them with a regular grid of boxes and generates a heatmap of polygons.
    """
    # make a grid, join them
    print("Gridding and matching animal tracks", file=sys.stderr)
    matched_gdf = _match_with_grid_kde(gdf, bounds, resolution=10)

    # transform to points
    matched_gdf.geometry = matched_gdf.geometry.apply(lambda x: x.centroid)

    # build contour polygons
    print("Building contour polygons", file=sys.stderr)
    counts, levels = np.histogram(matched_gdf['counts'].values, len(gdf['fieldnumber'].unique()))
    levels = [l for l in levels if l > 0.01]
    adjust = round((levels[1] - levels[0]) / 10, 5)
    contour_polys = make_contour_polygons(matched_gdf, levels=levels, level_adjust=adjust, range_low=range_low, range_high=range_high)

    # smooth polygons out
    print("Smoothing contour polygons", file=sys.stderr)
    smoothed = [smooth_polygon(cpoly) for cpoly in contour_polys]

    ret = geopandas.GeoDataFrame.from_features(smoothed, crs=gdf.crs)
    return ret


summary_methods = {
    'raw': {
        'callable': summary_raw,
        'discrim': '',
        'type': 'range'
    },
    'convex_hull': {
        'callable': summary_convex,
        'discrim': 'convex',
        'type': 'range'
    },
    'concave_hull': {
        'callable': summary_concave,
        'discrim': 'concave',
        'type': 'range'
    },
    'bbox': {
        'callable': summary_bbox,
        'discrim': 'bbox',
        'type': 'range'
    },
    'rotated_bbox': {
        'callable': summary_rotated_bbox,
        'discrim': 'rbbox',
        'type': 'range'
    },
    'distribution': {
        'callable': summary_distribution,
        'discrim': 'dist',
        'type': 'distribution'
    },
    'distribution_buffered': {
        'callable': summary_distribution_buffered,
        'discrim': 'dist_buffered',
        'type': 'distribution'
    },
    'distribution_kde': {
        'callable': summary_distribution_kde,
        'discrim': 'dist_kde',
        'type': 'distribution'
    }
}

@click.command()
@click.argument('trackercode')
@click.argument('year')
@click.argument('agg_method',
                type=click.Choice(list(agg_methods.keys())))
@click.argument('summary_method',
                type=click.Choice(list(summary_methods.keys())))
@click.option("--month", type=int)
@click.option("--buffer", type=float, default=None)
@click.option("--simplify", type=float, default=None)
@click.option("--jitter", type=float, default=None)
@click.option("--round-decimals", type=int, default=None)
@click.option("--to-disk/--no-to-disk", default=False)
@click.option("--force/--no-force", default=False)
def do_process(trackercode: str, year: str, agg_method: str, summary_method: str, month: int, buffer: float, simplify: float, jitter: float, round_decimals: int, to_disk: bool, force: bool):
    for d in process(
        trackercode,
        year,
        agg_method,
        summary_method,
        month=month,
        buffer=buffer,
        simplify=simplify,
        jitter=jitter,
        round_decimals=round_decimals,
        force=force
    ):
        if to_disk:
            fname = Path('out2') / Path("-".join((v for k, v in d['_metadata'].items())) + ".geojson")
            print(fname)
            with open(fname, 'w') as f:
                json.dump(d, f)
        else:
            print(d)

def process(trackercode: str, year: Optional[str], agg_method: str, summary_method: str, month: Optional[int]=None, buffer: Optional[float]=None, simplify: Optional[float]=None, jitter: Optional[float]=None, round_decimals: Optional[int]=None, force: bool=False) -> Sequence[Dict[str, Any]]:
    agg_callable: Callable[[pd.DataFrame], geopandas.GeoDataFrame] = agg_methods[agg_method]['callable']
    agg_discrim: str = agg_methods[agg_method]['discrim']

    summary_callable: Callable[[geopandas.GeoDataFrame], BaseGeometry] = summary_methods[summary_method]['callable']
    summary_discrim: str = summary_methods[summary_method]['discrim']
    summary_type: str = summary_methods[summary_method]['type']

    df = load_df(trackercode, year, jitter=jitter, round_decimals=round_decimals, ignore_cache=force)

    ret_vals: List[Dict[str, Any]] = []

    # group by species
    species_groups = df.groupby(['aphiaid', 'commonname', 'scientificname'])

    for species_name_triple, sdf in species_groups:
        print(species_name_triple, len(sdf), file=sys.stderr)
        species_aphia_id, species_common_name, species_scientific_name = species_name_triple

        gdf: geopandas.GeoDataFrame
        cache_path = Path(CONFIG.data_dir) / Path(f"{trackercode}-{year}-{species_aphia_id}-{agg_discrim}.geojson")
        with lock(r, str(cache_path)):
            if cache_path.exists() and not force:
                with cache_path.open() as f:
                    print(f"> reading from cache {str(cache_path)}", file=sys.stderr)
                    gdf = geopandas.read_file(f, driver="GeoJSON")
                    gdf['datecollected'] = gdf['datecollected'].apply(pd.to_datetime)
                    gdf.set_index('monthcollected', inplace=True)
            else:

                gdf = agg_callable(sdf)
                gdf = gdf.assign(project_code=trackercode)     # provenance for this intermediate data

                # cache the aggregate output for future use (combining with same species from different projects)
                # TODO: can this go in redis somehow
                to_disk(gdf.reset_index(), str(cache_path))
                print(f"> caching {str(cache_path)}", file=sys.stderr)

        assert gdf is not None
        range_low = -math.inf
        range_high = math.inf

        frames_and_metadata = [
            (gdf, year, [trackercode])
        ]

        # load other agg cached datasets of the same species
        agg_data = load_agg_cache(year, species_aphia_id, agg_discrim, skip=[(trackercode, year)])
        if agg_data:
            all_agg = pd.concat(agg_data.values()).set_index(['monthcollected'])
            agg_gdf = pd.concat([gdf, all_agg])
            agg_trackercodes, agg_years = zip(*agg_data.keys())

            print(f"Found {len(agg_data)} other cached data for {species_aphia_id}/{year}, projects: {','.join(agg_trackercodes)}", file=sys.stderr)

            frames_and_metadata.append(
                (agg_gdf, year, [trackercode, *agg_trackercodes])
            )
        else:
            print(f"No other cached data for {species_aphia_id}/{year}", file=sys.stderr)

        # load every available year for this species (all projects)
        agg_all_data = load_agg_cache(None, species_aphia_id, agg_discrim, skip=[(trackercode, year), *agg_data.keys()])
        if agg_all_data:
            all_years_agg = pd.concat(agg_all_data.values()).set_index(['monthcollected'])

            if agg_data:
                # did we load other project/same year? if so, append that one year's full projects aggregate with this new one
                all_years_gdf = pd.concat([all_years_agg, agg_gdf])
            else:
                # append new one with this project/year only
                all_years_gdf = pd.concat([all_years_agg, gdf])

            agg_trackercodes, agg_years = zip(*agg_all_data.keys())
            all_agg_years = [*set([year, *agg_years])]
            all_agg_trackercodes = [*set([trackercode, *agg_trackercodes])]

            frames_and_metadata.append(
                (all_years_gdf, all_agg_years, all_agg_trackercodes)
            )

            print(f"Found {len(agg_all_data)} other cached data for {species_aphia_id}/ALL YEARS ({len(set(agg_years))}), projects: {','.join(set(agg_trackercodes))}", file=sys.stderr)

            # now, if there are more than one trackercodes, add all years for just the requested trackercode
            if False and len(all_agg_trackercodes) > 1:
                tc_gdfs = [v for (tc, y), v in agg_all_data.items() if tc == trackercode]
                # there may not be any more data for the requested project!
                if len(tc_gdfs) > 0:
                    all_years_agg_project = pd.concat(tc_gdfs)
                    if agg_data:
                        all_years_project_gdf = pd.concat([all_years_agg_project, agg_gdf])
                    else:
                        all_years_project_gdf = pd.concat([all_years_agg_project, gdf])

                    frames_and_metadata.append(
                        (all_years_project_gdf, [y for (tc, y) in agg_all_data.keys()], [trackercode])
                    )

                    print(f"Added {len(tc_gdfs)} {trackercode} specific all years")
                else:
                    print(f"No additional years available for {trackercode} ({year})")

        else:
            print(f"No other cached data for {species_aphia_id}/ALL YEARS", file=sys.stderr)

        for cur_df, cur_year, cur_metadata in frames_and_metadata:
            is_all_year = isinstance(cur_year, list)
            has_multiple = len(cur_metadata) > 1        # frame was created from multiple tracker projects

            # for each month:
            for imonth in [slice(None), *cur_df.index.unique()]:
                is_all = isinstance(imonth, slice)

                if not is_all and (month and imonth != month):
                    continue

                ffname = {
                    'project_code': '_ALL' if len(cur_metadata) > 1 else cur_metadata[0],
                    'species_common_name': species_common_name,
                    'species_scientific_name': species_scientific_name,
                    'species_aphia_id': species_aphia_id,
                    'year': "all" if is_all_year else str(year),
                    'month': "all" if is_all else str(imonth),
                    'type': summary_type,
                    **get_multiple_metadata(cur_metadata)       # will join all metadata by newlines for every project
                    # file_discriminant,
                    # summary_discrim
                }

                month_df = cur_df.loc[imonth]
                if isinstance(month_df, (pd.Series, geopandas.GeoSeries)):
                    month_df = cur_df.loc[[imonth]]    # https://stackoverflow.com/a/20384317

                try:
                    summary = summary_callable(month_df,
                        bounds=cur_df.unary_union.bounds,
                        range_low=range_low,
                        range_high=range_high,
                    )

                    # add metadata about project, species
                    summary['project_codes'] = ", ".join(cur_metadata)
                    summary['species_common_name'] = species_common_name
                    summary['species_scientific_name'] = species_scientific_name
                    summary['species_aphia_id'] = species_aphia_id
                    # @TODO: add metadata per polygon?

                    # if this is the "all", find the range (distribution only)
                    if is_all:
                        try:
                            range_low = max(range_low, summary['level'].min())
                            range_high = min(range_high, summary['level'].max())
                        except:
                            pass

                    if buffer:
                        summary = summary.buffer(buffer)

                    if simplify:
                        summary = summary.simplify(simplify)

                    ret_vals.append(to_geojson(summary, **ffname))

                    # if we DON't have multiple projects feeding the species, that means this one project is also the all layer.
                    # rather than compute it again, just return a copy with the project_code metadata changed to _ALL.
                    if not has_multiple:
                        ret_vals.append(
                            to_geojson(
                                summary,
                                **{
                                    **ffname,
                                    'project_code': '_ALL'
                                }
                            )
                        )

                    # if we only have a single year for a project, it's the all
                    if not has_multiple and not agg_all_data:
                        for pc in [trackercode, '_ALL']:
                            ret_vals.append(
                                to_geojson(
                                    summary,
                                    **{
                                        **ffname,
                                        'project_code': pc,
                                        'year': 'all',
                                    }
                                )
                            )

                except Exception as e:
                    print("EXCEPT", imonth, e, file=sys.stderr)

                    ret_vals.append(to_geojson(FeatureCollection([]), **ffname))

    return ret_vals


def load_df(trackercode: str, year: str, trim: bool=True, jitter: Optional[float]=None, round_decimals: Optional[int]=None, extra_cols: Optional[List[str]]=None, ignore_cache: bool=False) -> geopandas.GeoSeries:
    kwargs = {
        'parse_dates': ['datelastmodified', 'datecollected']
    } 
    if trim:
        kwargs['usecols'] = ['fieldnumber', 'latitude', 'longitude', 'datecollected', 'monthcollected', 'scientificname', 'commonname', 'aphiaid']
        if extra_cols is not None:
            kwargs['usecols'].extend(extra_cols)

        kwargs['parse_dates'] = ['datecollected']

    need = True
    p = Path(CONFIG.data_dir) / Path(f"{trackercode}_{year}.csv")
    with lock(r, str(p)):
        if ignore_cache:
            print("load_df: ignore_cache flag set, pulling from source")
        else:
            if p.exists():
                # verify they have the species
                try:
                    sdf = pd.read_csv(p, nrows=2, **kwargs)
                    if 'aphiaid' in sdf.columns:
                        need = False
                except ValueError as e:
                    if not "columns expected but not found" in str(e):
                        raise

                if need:
                    print(f"load_df({trackercode},{year}): no species info, re-loading from source", file=sys.stderr)

        if need:
            get_from_graphql(trackercode=trackercode, year=year, path=str(p))
            # get_all_tables(trackercode=trackercode, year=year, path=str(p))

    assert p.exists()

    df = pd.read_csv(p,
        **kwargs
    )
    df['weekcollected'] = df['datecollected'].dt.isocalendar().week

    if round_decimals:
        df['latitude'] = df['latitude'].round(round_decimals)
        df['longitude'] = df['longitude'].round(round_decimals)

    return df


def to_gdf(df: pd.DataFrame) -> geopandas.GeoDataFrame:
    return geopandas.GeoDataFrame(
        df,
        geometry=geopandas.points_from_xy(df.longitude, df.latitude)
    )

def get_convex_hull(gdf) -> geopandas.GeoSeries:
    hull = geopandas.GeoSeries([gdf.unary_union]).convex_hull

    return hull

def to_geojson(geoobj, **kwargs) -> Dict[str, Any]:
    data = geoobj.__geo_interface__ if hasattr(geoobj, '__geo_interface__') else geoobj.to_json()
    data['_metadata'] = kwargs

    #return json.dumps(data, separators=(',', ':'))
    return data


def to_disk(geoobj, fname: str, **kwargs):
    def def_dt(obj):
        if isinstance(obj, pd.Timestamp):
            return obj.to_pydatetime()
        raise TypeError

    geojson = to_geojson(geoobj, **kwargs)
    serialized = orjson.dumps(
        geojson,
        default=def_dt,
        option=orjson.OPT_SERIALIZE_NUMPY
    )
    with open(fname, "wb") as f:
        f.write(serialized)
        
        #json.dump(geojson, f)


#agg_data = load_agg_cache(year, species_aphia_id, skip=trackercode)

def load_agg_cache(year: Optional[str], species_aphia_id: str, agg_discrim: str, skip: Optional[List[Tuple[str, str]]]=None) -> Dict[Tuple[str, str], geopandas.GeoDataFrame]:
    """
    Loads all matching year/aphia_id aggregate caches from disk.
    If year is None, load them all with a glob.
    Returns a dict of project code, year tuples -> geodataframe.
    """
    ret: Dict[Tuple[str, str], geopandas.GeoDataFrame] = {}

    if year is None:
        year = '*'      # glob the year too if we request all years

    p = Path(CONFIG.data_dir)
    for pp in p.glob(f'*-{year}-{species_aphia_id}-{agg_discrim}.geojson'):
        pproject, pyear, paphia, _ = pp.stem.split('-')
        if (pproject, pyear) in skip:
            continue

        bio = None
        with pp.open('rb') as f:
            bio = BytesIO(f.read())
            bio.seek(0)

        jsondata = orjson.loads(bio.getvalue())
        ret[(pproject, pyear)] = geopandas.GeoDataFrame.from_features(jsondata['features'])
        ret[(pproject, pyear)].datecollected = ret[(pproject, pyear)].datecollected.apply(pd.Timestamp)

    return ret


def cmocean_to_mapbox(cmap, inc=0.1):
    out = []
    for v in np.arange(0, 1., inc):
        rgb = cmap(float(v))
        rgb = [str(round(rv * 255)) for rv in rgb]
        out.append(round(v, 1))
        out.append(f"rgba({','.join(rgb)})")

    return out


def get_project_metadata(project_code: str, force: bool=False) -> Dict:
    """
    Gets certain pieces of project metadata from OTN's geoserver.
    """
    saved = Path(CONFIG.data_dir) / Path('project-metadata.geojson')
    if saved.exists() and not force:
        with saved.open() as f:
            data = json.load(f)
    else:
        r = requests.get("https://members.devel.oceantrack.org/geoserver/otnunit/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=otnunit:otn_resources_metadata&outputFormat=application/json&CQL_FILTER=seriescode%20=%20%27FACT%27")
        r.raise_for_status()

        raw_data = r.json()

        data = {
            f['properties']['collectioncode'][5:]: {
                'shortname': f['properties']['shortname'],
                'citation': f['properties']['citation'],
                'website': f['properties']['website']
            } for f in raw_data['features']
        }

        with saved.open('w') as f:
            json.dump(data, f)

    return data.get(project_code, {})


def get_multiple_metadata(project_codes: Sequence[str]) -> Dict:
    """
    Gets metadata for more than one project, merges them together.
    """
    mds = [md for md in (get_project_metadata(pc) for pc in project_codes) if md]

    shortnames = "\n".join([m['shortname'] for m in mds])
    citations = "\n".join([m['citation'] for m in mds])
    websites = "\n".join([m['website'] or '' for m in mds])

    return {
        'shortname': shortnames,
        'citation': citations,
        'website': websites
    }


if __name__ == "__main__":
    do_process()

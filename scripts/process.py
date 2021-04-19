import json
from functools import cache, singledispatch
from pathlib import PosixPath as Path
from typing import Callable, Dict, List, Optional, Union

import click
import numpy as np
import pandas as pd
import geojson
import geopandas
import pyvisgraph as vg
from shapely.geometry import asPolygon, box, LineString, MultiPoint, Point, Polygon, MultiPolygon
from shapely.geometry.base import BaseGeometry
from shapely_geojson import Feature, FeatureCollection
from skimage.measure import find_contours
from scipy.interpolate import interp1d

# what is this?!?
try:
    from hull import ConcaveHull
except ImportError:
    from .hull import ConcaveHull


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

def get_interp_line(lon_start: float, lat_start: float, lon_end: float, lat_end: float, method: str='simple') -> LineString:
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


def animal_interpolated_paths(df: pd.DataFrame, interp_method: str="simple") -> geopandas.GeoDataFrame:
    """
    For each animal, interpolate the path between detections (daily).
    """
    grouped_df = df.drop(columns=['weekcollected', 'monthcollected']).groupby(['fieldnumber'])
    animal_tracks: List[pd.DataFrame] = []

    for name, df_group in grouped_df:
        print(name)
        gdf = df_group.set_index('datecollected')

        # resample on days, average the location of that day, drop empty days
        gdf = gdf.resample('D').mean().dropna()

        # determine gaps in days
        diffs = gdf.index.to_series().diff().astype('timedelta64[D]')    # first row is always NaT

        # get all location indicies that match the days we have to fill in
        end_idxs = [i for i, v in enumerate(diffs.between(1.0, 30.0, inclusive=False).to_list()) if v]

        print("Gaps:", len(end_idxs))

        # end idxs refers to the integer-location based index of the END of the date range
        # the beginning of the date range is the index directly before it
        add_dfs = []

        for i, end_idx in enumerate(end_idxs):
            print("\t", i)
            begin = gdf.iloc[end_idx - 1]
            end = gdf.iloc[end_idx]

            # create a date range, daily
            date_range = pd.date_range(begin.name, end.name, freq='D')

            # if the begin and end is the same, there's no line, and no need to interpolate
            if np.isclose(begin.longitude, end.longitude) and np.isclose(begin.latitude, end.latitude):
                interp_df = pd.DataFrame({
                    'longitude': [begin.longitude] * (len(date_range) - 2),
                    'latitude': [begin.latitude] * (len(date_range) - 2),
                }, index=date_range[1:-1])

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
            }, index=date_range[1:-1]
            )

            add_dfs.append(interp_df)

        # concat them all into one dataframe
        full_gdf = pd.concat([
            gdf,
            *add_dfs
        ]).sort_index()

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
            if len(cut_df) == 0:    # i don't think this can happen, but we'll just have it here
                print("LEN 0??")
                continue
            elif len(cut_df) == 1:
                geom = geoms[0]

            else:
                geom = LineString(geoms)

            gjo = Feature(
                geom,
                {
                    'begin': cut_df.index[0].strftime('%Y-%m-%d'),
                    'end': cut_df.index[-1].strftime('%Y-%m-%d'),
                    'fieldnumber': name
                }
            )

            anim_gjos.append(gjo)

        # CACHE ON DISK

        anim_fc = FeatureCollection(anim_gjos)
        fname = f"tmp/at/lines_vis_{name}.geojson"
        print("writing", fname)
        to_geojson(anim_fc, fname)

        # full_gdf.set_index(pd.Index([name] * len(full_gdf)), append=True, inplace=True)
        feature_gdf = geopandas.GeoDataFrame.from_features(anim_gjos)
        animal_tracks.append(feature_gdf)

        # animal_line = MultiPoint(geopandas.points_from_xy(full_gdf.longitude, full_gdf.latitude))
        # fname = f"tmp/at/{name}.geojson"
        # print("writing", fname)
        # to_geojson(animal_line, fname)

    all_interp_animals = pd.concat(animal_tracks, ignore_index=True)
    all_gdf = geopandas.GeoDataFrame(all_interp_animals, geometry='geometry', crs='EPSG:4326')

    # make a grid, join them
    matched_gdf = _match_with_grid(all_gdf)

    # transform to points
    matched_gdf.geometry = matched_gdf.geometry.apply(lambda x: x.centroid)

    # build contour polygons
    contour_polys = make_contour_polygons(matched_gdf, levels=list(range(1, int(matched_gdf['counts'].max()) + 1)))

    # smooth polygons out
    smoothed = [smooth_polygon(cpoly) for cpoly in contour_polys]

    # save to disk
    fc = FeatureCollection(smoothed)
    fname = f"tmp/at/final-contours-smoothed.geojson"
    print("writing", fname)
    to_geojson(fc, fname)

    return all_gdf


@cache
def build_vis_graph(filename: str=None) -> vg.VisGraph:
    saved = Path('data/landvisgraph.pk1')
    if saved.exists():
        g = vg.VisGraph()
        g.load('data/landvisgraph.pk1')
        return g

    if not filename:
        filename = "/home/daf/dev/mapvamber-daf/secoora-land.geojson" # @TODO

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

    g.save('data/landvisgraph.pk1')
    return g


# https://github.com/adaj/geohunter/blob/65c65a451f1edaa110de5629e4a3fa9c1cbaa50b/geohunter/util.py#L137-L169
def make_gridsquares(city_shape, resolution=1):
    """It constructs a grid of square cells.
    Parameters
    ----------
    city_shape : GeoDataFrame.
        Corresponds to the boundary geometry in which the grid will be formed.
    resolution : float, default is 1.
        Space between the square cells.
    """
    x0 = city_shape.bounds.min().values[0]
    xf = city_shape.bounds.max().values[2]
    y0 = city_shape.bounds.min().values[1]
    yf = city_shape.bounds.max().values[3]
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
        y0 = city_shape.bounds.min().values[1]
        x0 += resolution/111.32
    grid = pd.DataFrame(grid).transpose()
    grid = geopandas.GeoDataFrame(grid, geometry='geometry',
                            crs='EPSG:4326')
    return grid
    #grid = geopandas.sjoin(grid, city_shape, op='intersects')
    #return grid[~grid.index.duplicated()]


def _match_with_grid(animal_gdf: geopandas.GeoDataFrame, resolution: int=10) -> geopandas.GeoDataFrame:
    """
    @param 
    # gdf is geopandas dataframe wrapped around shapely geometry for each animal,
    """
    # s_grid is secoora water bounds made into a grid by make_gridsquares
    # really only need bounds though, we need the full square even over land, so likely don't need the water polygon
    gdf = geopandas.read_file("data/secoora-water.geojson")
    s_grid = make_gridsquares(gdf, resolution=resolution)

    # join the grid squares with the animal geometry
    match_counts = geopandas.sjoin(animal_gdf, s_grid).groupby('index_right').size().to_frame('counts')
    joined = geopandas.GeoDataFrame(match_counts.join(s_grid, how='outer').fillna(0))

    return joined

    # alls = [] 
    # for gdf in gdfs:
        # alls.append(geopandas.sjoin(gdf, gsgdf).groupby('index_right').size().to_frame(gdf.fieldnumber[0]))

    # join all the matched animal grids together and merge animal counts into them
    # alldf = pd.concat(alls, axis=1).join(gsgdf, how='outer')

    # add a count of all unique animals
    # @TODO: may capture the same animal twice?
    # alldf['count'] = alldf.sum(axis=1, numeric_only=True)

    # to geodataframe
    # return geopandas.GeoDataFrame(alldf, crs=gdfs[0].crs)


def make_contour_polygons(gdf: geopandas.GeoDataFrame, levels: List[Union[int, float]]) -> List[Feature]:
    """
    Creates a contour filled polygon Feature per level.

    @param gdf  GeoDataFrame of a grid of points, ordered by longitude major, latitude minor.
    """
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
        # adjust level slightly because this method can only go > not >=
        contours = find_contours(bits, level - 0.1)

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
                    print("CONTAINED")
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

        contour_levels.append(
            Feature(
                fpoly,
                properties={
                    'level': level
                }
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
        [smooth_polygon(p) for p in poly.geoms]
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

def summary_raw(gdf: geopandas.GeoDataFrame) -> BaseGeometry:
    #return FeatureCollection([gi for gi in gdf.geometry])
    return geopandas.GeoSeries([gdf.unary_union])

def summary_convex(gdf: geopandas.GeoDataFrame) -> geopandas.GeoSeries:
    hull = geopandas.GeoSeries([gdf.unary_union]).convex_hull
    return hull

def summary_concave(gdf: geopandas.GeoDataFrame) -> BaseGeometry:
    month_df_points = np.stack(
        (
            gdf['longitude'].to_numpy(),
            gdf['latitude'].to_numpy()
        ),
        axis=1
    )
    hullobj = ConcaveHull(month_df_points)
    if hullobj is not None:
        geom = asPolygon(hullobj.calculate())
        buffered_geom = hullobj.buffer_in_meters(geom, 1000)
        return geopandas.GeoSeries([buffered_geom])

    # couldn't do concave? convex is close.
    print("WARN: could not do concave hull, returning convex")
    return summary_convex(gdf)

def summary_bbox(gdf: geopandas.GeoDataFrame) -> BaseGeometry:
    return geopandas.GeoSeries([box(*gdf.total_bounds)])

def summary_rotated_bbox(gdf: geopandas.GeoDataFrame) -> BaseGeometry:
    rbbox = gdf.unary_union.minimum_rotated_rectangle
    return geopandas.GeoSeries([rbbox])


summary_methods = {
    'raw': {
        'callable': summary_raw,
        'discrim': '',
    },
    'convex_hull': {
        'callable': summary_convex,
        'discrim': 'convex',
    },
    'concave_hull': {
        'callable': summary_concave,
        'discrim': 'concave'
    },
    'bbox': {
        'callable': summary_bbox,
        'discrim': 'bbox',
    },
    'rotated_bbox': {
        'callable': summary_rotated_bbox,
        'discrim': 'rbbox',
    }

}


def build_filename(trackercode: str, year: Union[int, str], month: Union[int, str], *args, lookup_agg: Optional[str]=None, lookup_summary: Optional[str]=None, suffix: str="geojson"):
    """
    Makes an output filename.

    Can optionally look up the agg/summary parts.
    """
    file_parts = [
        trackercode,
        str(year),
        str(month),
        *args
    ]

    if lookup_agg and lookup_agg in agg_methods:
        file_parts.append(agg_methods[lookup_agg]['discrim'])

    if lookup_summary and lookup_summary in summary_methods:
        file_parts.append(summary_methods[lookup_summary]['discrim'])

    return f'{"_".join((f for f in file_parts if f))}.{suffix}'


@click.command()
@click.argument('trackercode')
@click.argument('year')
@click.argument('agg_method',
                type=click.Choice(list(agg_methods.keys())))
@click.argument('summary_method',
                type=click.Choice(list(summary_methods.keys())))
@click.option("--month", type=int)
@click.option("--buffer", type=float)
@click.option("--simplify", type=float)
@click.option("--jitter", type=float)
@click.option("--round-decimals", type=int)
def process(trackercode: str, year: str, agg_method: str, summary_method: str, month: int, buffer: float, simplify: float, jitter: float, round_decimals: int) -> geopandas.GeoDataFrame:
    agg_callable: Callable[[pd.DataFrame], geopandas.GeoDataFrame] = agg_methods[agg_method]['callable']
    file_discriminant: str = agg_methods[agg_method]['discrim']

    summary_callable: Callable[[geopandas.GeoDataFrame], BaseGeometry] = summary_methods[summary_method]['callable']
    summary_discrim: str = summary_methods[summary_method]['discrim']

    df = load_df(trackercode, year, jitter=jitter, round_decimals=round_decimals)
    gdf = agg_callable(df)

    # for each month:
    for imonth in gdf.index.unique():
        if month and imonth != month:
            continue

        ffname = build_filename(
            trackercode,
            year,
            imonth,
            file_discriminant,
            summary_discrim
        )

        fname = f'out/{ffname}'
        month_df = gdf.loc[imonth]
        print(fname)

        try:
            summary = summary_callable(month_df)

            if buffer:
                summary = summary.buffer(buffer)

            if simplify:
                summary = summary.simplify(simplify)

            to_geojson(summary, fname)
        except Exception as e:
            print("EXCEPT", imonth, e)

            to_geojson(FeatureCollection([]), fname)
    return gdf


def load_df(trackercode: str, year: str, trim: bool=True, jitter: Optional[float]=None, round_decimals: Optional[int]=None, extra_cols: Optional[List[str]]=None) -> geopandas.GeoSeries:
    kwargs = {
        'parse_dates': ['datelastmodified', 'datecollected']
    } 
    if trim:
        kwargs['usecols'] = ['fieldnumber', 'latitude', 'longitude', 'datecollected', 'monthcollected']
        if extra_cols is not None:
            kwargs['usecols'].extend(extra_cols)

        kwargs['parse_dates'] = ['datecollected']

    df = pd.read_csv(f"data/{trackercode}_{year}.csv",
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

def to_geojson(geoobj, filename: str):
    with open(filename, "w") as f:
        data = geoobj.__geo_interface__ if hasattr(geoobj, '__geo_interface__') else geoobj.to_json()
        json.dump(data, f)


if __name__ == "__main__":
    process()

import json
from typing import Callable, Dict, Optional, Union

import click
import numpy as np
import pandas as pd
import geopandas
from shapely.geometry import asPolygon, box
from shapely.geometry.base import BaseGeometry
from shapely_geojson import FeatureCollection

from hull import ConcaveHull


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
def process(trackercode: str, year: str, agg_method: str, summary_method: str, month: int, buffer: float, simplify: float, jitter: float, round_decimals: float) -> geopandas.GeoDataFrame:
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

            to_geojson(geopandas.GeoSeries(), fname)
    return gdf


def load_df(trackercode: str, year: str, trim: bool=True, jitter: Optional[float]=None, round_decimals: Optional[int]=None) -> geopandas.GeoSeries:
    kwargs = {
        'parse_dates': ['datelastmodified', 'datecollected']
    } 
    if trim:
        kwargs['usecols'] = ['fieldnumber', 'latitude', 'longitude', 'datecollected', 'monthcollected']
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

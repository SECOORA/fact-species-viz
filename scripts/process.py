import json
from typing import Callable, Dict, Union

import click
import pandas as pd
import geopandas
from shapely.geometry import box
from shapely_geojson import FeatureCollection


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
    }
}


@click.command()
@click.argument('trackercode')
@click.argument('year')
@click.argument('agg_method',
                type=click.Choice(list(agg_methods.keys())))
@click.option('--hull/--no-hull', default=True)
def process(trackercode: str, year: str, agg_method: str, hull: bool) -> geopandas.GeoDataFrame:
    agg_callable: Callable[[pd.DataFrame], geopandas.GeoDataFrame] = agg_methods[agg_method]['callable']
    file_discriminant: str = agg_methods[agg_method]['discrim']

    df = load_df(trackercode, year)
    gdf = agg_callable(df)

    # for each month:
    for month in gdf.index.unique():
        fname = f'out/{trackercode}_{year}_{month}_{file_discriminant}.geojson'
        month_df = gdf.loc[month]

        if not hull:
            fc = FeatureCollection([g for g in month_df['geometry']])
            to_geojson(fc, fname + "nohull.geojson")
        else:
            try:
                # get convex hull
                convex_hull = get_convex_hull(month_df)

                # write to disk
                print(trackercode, year, month)
                to_geojson(convex_hull, fname)
            except Exception as e:
                print("EXCEPT", month, e)

                to_geojson(geopandas.GeoSeries(), fname)

    return gdf


def load_df(trackercode: str, year: str, trim: bool=True) -> geopandas.GeoSeries:
    df = pd.read_csv(f"data/{trackercode}_{year}.csv",
        parse_dates=['datelastmodified', 'datecollected']
    )
    df['weekcollected'] = df['datecollected'].dt.isocalendar().week

    if trim:
        fields = ['fieldnumber', 'latitude', 'longitude', 'datecollected', 'monthcollected', 'weekcollected']
        small = df[fields]
        return small

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

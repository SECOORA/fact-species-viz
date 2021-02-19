import json

import click
import pandas as pd
import geopandas


@click.command()
@click.argument('trackercode')
@click.argument('year')
@click.option('--avg', is_flag=True)
def process(trackercode: str, year: str, avg: bool=True):
    df = load_df(trackercode, year)
    small = df[['fieldnumber', 'latitude', 'longitude',
                'datecollected', 'monthcollected']]

    if avg:
        # get average position of each animal fieldnumber over the month
        avgs = small.groupby(['fieldnumber', 'monthcollected']).agg('mean')

        # remove animal fieldnumber from index
        avgs.reset_index(0, inplace=True)
    else:
        # just set month as the index
        avgs = small.set_index('monthcollected')

    # turn into geodataframe
    gdf = to_gdf(avgs)

    # for each month:
    for month in gdf.index.unique():
        if avg:
            fname = f'out/{trackercode}_{year}_{month}.geojson'
        else:
            fname = f'out/{trackercode}_{year}_{month}_FULL.geojson'

        try:
            # get convex hull
            hull = get_convex_hull(gdf.loc[month])

            # write to disk
            print(trackercode, year, month)
            to_geojson(hull, fname)
        except Exception as e:
            print("EXCEPT", month, e)

            to_geojson(geopandas.GeoSeries(), fname)

    return gdf


def load_df(trackercode: str, year: str) -> geopandas.GeoSeries:
    df = pd.read_csv(f"data/{trackercode}_{year}.csv",
        parse_dates=['datelastmodified', 'datecollected']
    )
    df['weekcollected'] = df['datecollected'].dt.week
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
        json.dump(geoobj.__geo_interface__, f)


if __name__ == "__main__":
    process()

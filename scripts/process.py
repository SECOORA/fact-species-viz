import json

import click
import pandas as pd
import geopandas


@click.command()
@click.argument('trackercode')
@click.argument('year')
@click.option('--avg', is_flag=True)
@click.option('--by-week', is_flag=True)
def process(trackercode: str, year: str, avg: bool=True, by_week: bool=False):
    df = load_df(trackercode, year)

    fields = ['fieldnumber', 'latitude', 'longitude', 'datecollected', 'monthcollected']
    if by_week:
        fields.append('weekcollected')
    small = df[fields]

    if avg:
        # get average position of each animal fieldnumber over the month
        time_field = 'weekcollected' if by_week else 'monthcollected'
        avgs = small.groupby(['fieldnumber', time_field]).agg('mean')

        if not by_week:
            # remove animal fieldnumber from index
            avgs.reset_index(0, inplace=True)
        else:
            avgs['monthcollected'] = avgs['monthcollected'].round().astype(int)
            avgs.set_index('monthcollected', inplace=True)
    else:
        # just set month as the index
        avgs = small.set_index('monthcollected')

    # turn into geodataframe
    gdf = to_gdf(avgs)

    # for each month:
    for month in gdf.index.unique():
        discrim = 'FULL'
        if avg:
            discrim = 'WEEK' if by_week else 'MONTH'

        fname = f'out/{trackercode}_{year}_{month}_{discrim}.geojson'

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
    df['weekcollected'] = df['datecollected'].dt.isocalendar().week
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

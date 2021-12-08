import re
import sys
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional
from zipfile import ZipFile

import click
import geopandas as gpd
import pandas as pd
import requests
from environs import Env
from geopandas.tools import clip
from jinjasql import JinjaSql
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from tqdm import tqdm

from .log import logger
from .config import CONFIG


class NoDataException(Exception):
    """
    Means no data was found for the specific project/year.
    """
    pass


def get_conn() -> Engine:
    """
    Pulls database connection info from environment and creates an active connection.
    """
    env = Env()

    user = env("DB_USER")
    password = env("DB_PASSWORD")
    host = env("DB_HOST")
    port = env("DB_PORT")
    database = env("DB_DATABASE")

    engine_string = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"
    engine = create_engine(engine_string)

    return engine


def get_df(conn: Engine, table_name: str, trackercode: str) -> pd.DataFrame:
    """
    Don't use this.  big query.
    """
    df = pd.read_sql_query(
        f"SELECT fieldnumber, latitude, longitude, datecollected, monthcollected FROM obis.{table_name} WHERE trackercode='{trackercode}'",
        conn,
        parse_dates=['datecollected']
    )

    return df


def get_df_with_species(conn: Engine, table_name: str, trackercode: str, bin_size: int=10000) -> pd.DataFrame:
    """
    Gets dataframe from OTN database with species information attached inline.
    """
    df = get_chunked_df(conn, table_name, trackercode, bin_size=bin_size)
    df = get_species_for_df(conn, df)


def get_chunked_df(conn: Engine, table_name: str, trackercode: str, bin_size: int=10000) -> pd.DataFrame:
    """
    Gets dataframe from database with chunked queries, no species information.
    """
    template = """
        SELECT COUNT(t1.*)
        FROM obis.{{ table_name|sqlsafe }} t1
        WHERE trackercode={{ trackercode }}
    """
    j = JinjaSql(param_style='pyformat')
    query, bind_params = j.prepare_query(
        template,
        {
            'table_name': table_name,
            'trackercode': trackercode
        }
    )

    cdf = pd.read_sql_query(
        query,
        conn,
        params=bind_params,
    )
    row_count = cdf.iat[0, 0]

    # get number of chunks we will request
    chunk_count = (row_count // bin_size) + 1

    template = """
        SELECT t1.fieldnumber, t1.latitude, t1.longitude, t1.datecollected, t1.monthcollected, t1.relatedcatalogitem
        FROM obis.{{ table_name|sqlsafe }} t1
        WHERE trackercode={{ trackercode }}
    """
    query, bind_params = j.prepare_query(
        template,
        {
            'table_name': table_name,
            'trackercode': trackercode
        }
    )

    frames: List[pd.DataFrame] = []
    with tqdm(total=chunk_count, desc="Running SQL Query") as progress_bar:
        for chunk_df in pd.read_sql_query(
                query,
                conn,
                params=bind_params,
                parse_dates=['datecollected'],
                chunksize=bin_size
            ):
            progress_bar.update(1)
            frames.append(chunk_df)

    if len(frames) == 0:
        raise NoDataException(f"No data found for {table_name}/{trackercode}")

    df = pd.concat(frames)
    return df


def get_species_for_df(df: pd.DataFrame, catalog_col: str='relatedcatalogitem', conn: Optional[Engine]=None, merge_kwargs: Optional[Dict[Any, Any]]=None) -> pd.DataFrame:
    if not conn:
        conn = get_conn()

    # join with species info
    relcatalogitems = list(df[catalog_col].unique())
    logger.info("get_species_for_df: %d unique animals", len(relcatalogitems))

    j = JinjaSql(param_style='pyformat')
    template = """
        SELECT t2.catalognumber, t2.scientificname, t2.commonname, t3.aphiaidaccepted AS aphiaid
        FROM obis.otn_animals t2
        LEFT JOIN obis.scientificnames t3 ON t2.scientificname = t3.scientificname
        WHERE catalognumber IN {{ related_catalog_items|inclause }}
    """
    query, bind_params = j.prepare_query(
        template,
        {
            'related_catalog_items': relcatalogitems
        }
    )
    
    species_df = pd.read_sql_query(
        query,
        conn,
        params=bind_params,
    ).drop_duplicates()     # otn_animals has multiple entries for each catalog item with notes (i guess?), we only select columns that should be the same

    # merge species info with detections
    merged_df = pd.merge(df, species_df, left_on=catalog_col, right_on='catalognumber',
                         **merge_kwargs).drop(columns=[catalog_col, 'catalognumber'])
    return merged_df


def get_from_graphql(trackercode: str, year: str, path: str):
    assert CONFIG.rw_auth_token != "you_must_set"

    logger.info("get_from_graphql: retrieving list of detection zips")
    query = """
    {
        organization(id: 2563073) {
            name,
            files(folderName: "Your tag detections"){
                nodes {
                    id,
                    name,
                    project {
                        name
                    }
                }
            }
        }
    }
    """

    r = requests.post(
        CONFIG.rw_gql_url,
        json={
            'operationName': None,
            'query': query,
            'variables': {}
        },
        headers={
            'Authorization': f'Bearer {CONFIG.rw_auth_token}'
        }
    )

    r.raise_for_status()

    rproject = re.compile(f'^{trackercode}\\W')
    all_nodes = r.json()['data']['organization']['files']['nodes']
    nodes = [d for d in all_nodes if \
             d['name'].endswith(f"{year}.zip") and rproject.match(d['project']['name'])]

    urls = [f"https://researchworkspace.com/files/{n['id']}/{n['name']}" for n in nodes]
    url = urls[0]

    logger.info("get_from_graphql: retrieving %s", nodes[0]['name'])

    r = requests.get(url, headers={
        'api-key': CONFIG.rw_auth_token
    })
    r.raise_for_status()

    zf = ZipFile(BytesIO(r.content))
    csv_names = [f for f in zf.namelist() if f.endswith('.csv')]
    assert len(csv_names) == 1, f"Didn't find only one CSV in zip file {len(csv_names)}"

    df = pd.read_csv(BytesIO(zf.read(csv_names[0])), parse_dates=['datecollected', 'datelastmodified'])

    df = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df.longitude, df.latitude))

    # filter for allowed area (custom poly)
    len_before = len(df)
    logger.info("get_from_graphql: clipping, length before %d", len_before)

    allowed_area = gpd.read_file("data/allowed_area.geojson", driver="GeoJSON")
    df = clip(df, allowed_area)

    len_after = len(df)
    logger.info("get_from_graphql: clipping finished, length after %d (-%d)", len_after, len_before - len_after)

    # cleanup dataframe
    df = df.rename(
        columns={
            'tagname': 'fieldnumber'
        }
    )

    # get species info, attach to df
    df = get_species_for_df(df, catalog_col="catalognumber", merge_kwargs={'suffixes': [None, '_y']})

    # filter for the year requested, due to some noise noticed in BLKTP
    df = df[df['yearcollected'] == int(year)]

    # subset to needed columns
    df = df[
        ['fieldnumber',
        'latitude',
        'longitude',
        'datecollected',
        'monthcollected',
        'scientificname',
        'commonname',
        'aphiaid']
    ]
    df.to_csv(path)

    return df


@click.group()
def cli():
    pass


@click.command()
@click.argument('trackercode')
@click.argument('year')
def do_get_all_tables(trackercode: str, year: str, path: str, conn: Optional[Engine] = None):
    get_all_tables(trackercode, year, path, conn=conn)

def get_all_tables(trackercode: str, year: str, path: str, conn: Optional[Engine] = None):
    if not conn:
        conn = get_conn()

    table_name = f"otn_detections_{year}"

    print("get_all_tables: table:", table_name, file=sys.stderr)
    df = get_df_with_species(conn, table_name, trackercode)
    print("get_all_tables: length", len(df), file=sys.stderr)

    print("get_all_tables ->", path, file=sys.stderr)
    df.to_csv(path)


@click.command()
@click.argument('trackercode')
def combine_projects(trackercode: str):
    p = Path("data/")
    csvs = p.glob(f"{trackercode}*.csv")

    all_df = pd.concat(
        [pd.read_csv(csv, index_col='catalognumber', parse_dates=[
                     'datelastmodified', 'datecollected'], infer_datetime_format=True) for csv in csvs]
    )

    all_df.to_csv(f"data/{trackercode}.csv")


cli.add_command(do_get_all_tables)
cli.add_command(combine_projects)


if __name__ == "__main__":
    cli()

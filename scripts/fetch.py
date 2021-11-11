import sys
from pathlib import Path
from typing import List, Optional

import click
import pandas as pd
from environs import Env
from jinjasql import JinjaSql
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from tqdm import tqdm

from .log import logger


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


    df = pd.read_sql_query(
        f"SELECT fieldnumber, latitude, longitude, datecollected, monthcollected FROM obis.{table_name} WHERE trackercode='{trackercode}'",
        conn,
        parse_dates=['datecollected']
    )

    return df


def get_df_with_species(conn: Engine, table_name: str, trackercode: str, bin_size: int=10000) -> pd.DataFrame:
    # template = """
    #     SELECT t1.fieldnumber, t1.latitude, t1.longitude, t1.datecollected, t1.monthcollected, t1.relatedcatalogitem, t2.scientificname, t2.commonname, t3.aphiaidaccepted AS aphiaid
    #     FROM obis.{{ table_name|sqlsafe }} t1
    #     LEFT JOIN obis.otn_animals t2 ON t1.relatedcatalogitem = t2.catalognumber
    #     LEFT JOIN obis.scientificnames t3 ON t2.scientificname = t3.scientificname
    #     WHERE trackercode={{ trackercode }}
    # """
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

    # join with species info
    relcatalogitems = list(df['relatedcatalogitem'].unique())
    logger.info("get_df_with_species: %d unique animals", len(relcatalogitems))

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
    merged_df = pd.merge(df, species_df, left_on='relatedcatalogitem', right_on='catalognumber').drop(columns=['relatedcatalogitem', 'catalognumber'])
    return merged_df


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

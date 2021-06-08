import sys
from pathlib import Path
from typing import Optional

import click
import pandas as pd
from environs import Env
from jinjasql import JinjaSql
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


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


def get_df_with_species(conn: Engine, table_name: str, trackercode: str) -> pd.DataFrame:
    template = """
        SELECT t1.fieldnumber, t1.latitude, t1.longitude, t1.datecollected, t1.monthcollected, t1.relatedcatalogitem, t2.scientificname, t2.commonname, t3.aphiaidaccepted AS aphiaid
        FROM obis.{{ table_name|sqlsafe }} t1
        LEFT JOIN obis.otn_animals t2 ON t1.relatedcatalogitem = t2.catalognumber
        LEFT JOIN obis.scientificnames t3 ON t2.scientificname = t3.scientificname
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

    df = pd.read_sql_query(
        query,
        conn,
        params=bind_params,
        parse_dates=['datecollected']
    )

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

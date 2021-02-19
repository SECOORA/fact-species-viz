from pathlib import Path
from typing import Optional

import click
import pandas as pd
from environs import Env
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
        f"SELECT * FROM obis.{table_name} WHERE trackercode='{trackercode}'",
        conn,
        parse_dates=['datelastmodified', 'datecollected']
    )

    return df


@click.group()
def cli():
    pass


@click.command()
@click.argument('trackercode')
@click.argument('year')
def get_all_tables(trackercode: str, year: str, conn: Optional[Engine] = None):
    if not conn:
        conn = get_conn()

    table_name = f"otn_detections_{year}"

    print("table:", table_name)
    df = get_df(conn, table_name, trackercode)
    print(len(df))

    # @TODO: path
    filename = f"data/{trackercode}_{year}.csv"
    print("->", filename)
    df.to_csv(filename)


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


cli.add_command(get_all_tables)
cli.add_command(combine_projects)


if __name__ == "__main__":
    cli()

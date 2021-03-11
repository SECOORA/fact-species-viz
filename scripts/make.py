from pathlib import Path
from typing import List

import click

from process import build_filename, process

aggsums = [
    ('raw', 'raw'),
    ('raw', 'concave_hull'),
    ('raw', 'convex_hull'),
    ('raw', 'rotated_bbox'),
    ('animal_boxes', 'raw')
]

@click.command()
@click.pass_context
def make(ctx):
    calls = []

    p = Path("./data")
    for f in p.glob("*.csv"):
        if '_' not in f.stem:
            print("skipping", f.stem)
            continue

        project_mtime = f.stat().st_mtime

        project, year = f.stem.split("_")

        print(project, year)

        for aggsumpair in aggsums:
            agg, summ = aggsumpair
            # print("  ", agg, summ)

            need_months: List[int] = []

            for month in range(1, 13):
                fname = build_filename(
                    project,
                    year,
                    month,
                    lookup_agg=agg,
                    lookup_summary=summ
                )

                # print(fname)
                of = Path(f"out/{fname}")

                if not of.exists() or of.stat().st_mtime < project_mtime:
                    need_months.append(month)

            if len(need_months) == 12:
                calls.append(
                    {
                        'trackercode': project,
                        'year': year,
                        'agg_method': agg,
                        'summary_method': summ,
                        'round_decimals': 2,
                        'buffer': 0.25 if not (agg == "raw" and summ == "raw") else None,
                    }
                )
            else:
                for month in need_months:
                    calls.append(
                        {
                            'trackercode': project,
                            'year': year,
                            'agg_method': agg,
                            'summary_method': summ,
                            'buffer': 0.25,
                            'round_decimals': 2,
                            'month': month
                        }
                    )

    for call in calls:
        print(call)
        try:
            ctx.invoke(
                process,
                **call
            )
        except (AttributeError,) as e:
            print("EXCEPTION", e, "SKIPPING")

if __name__ == "__main__":
    make()

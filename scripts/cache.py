import json
from collections import defaultdict
from json.decoder import JSONDecodeError
from typing import Any, Dict, Optional, Mapping, Sequence

from redis import Redis

from .config import CONFIG


r = Redis.from_url(str(CONFIG.redis_cache_dsn))


def write_cache(key: str, value: Any) -> int:
    assert r

    serialized_val = json.dumps(value, separators=(',', ':'))

    r.set(
        key,
        serialized_val 
    )

    return len(serialized_val)


def read_cache(key: str) -> Optional[Dict[str, Any]]:
    assert r

    v = r.get(key)
    if not v:
        return None

    try:
        d = json.loads(v.decode('utf-8'))
        return d
    except (JSONDecodeError, ValueError):
        return None


def get_species_ids() -> Mapping[int, str]:
    """
    Returns a mapping of aphiaID -> common names.
    """
    assert r

    v = r.keys("data:*:*:*:*:*")
    ret = set()
    for vv in v:
        _, aphia_id, _, _, _, _ = vv.decode('utf-8').split(":")
        ret.add(int(aphia_id))

    # get all common names
    common_data = {int(k.decode('utf-8')):v.decode('utf-8') for k, v in r.hgetall("species:common").items()}

    return {aphia_id: common_data.get(aphia_id, str(aphia_id)) for aphia_id in sorted(ret)}


def get_species_years(aphia_id: int):
    assert r

    v = r.keys(f"data:{aphia_id}:*:*:*:*")
    ret = set()
    for vv in v:
        _, _, _, year, _, _ = vv.decode('utf-8').split(":")
        ret.add(int(year))

    return sorted(ret)


def get_species_months(aphia_id: int, year: int):
    assert r

    v = r.keys(f"data:{aphia_id}:*:{year}:*:*")
    ret = set()
    for vv in v:
        _, _, _, _, month, _ = vv.decode('utf-8').split(":")
        if month == 'all':
            continue    # always expect all
        ret.add(int(month))

    return sorted(ret)


def update_species_common_name(aphia_id: int, common_name: str):
    assert r

    r.hset(f"species:common", str(aphia_id), common_name)


def update_species_scientific_name(aphia_id: int, scientific_name: str):
    assert r

    r.hset(f"species:scientific", str(aphia_id), scientific_name)


def get_projects_for_species(aphia_id: int) -> Sequence[str]:
    assert r

    v = r.keys(f"data:{aphia_id}:*:*:*:*")
    ret = set()
    for vv in v:
        _, _, _, _, _, project_code = vv.decode('utf-8').split(":")
        if project_code == "_ALL":
            continue    # we always expect all
        ret.add(project_code)

    return sorted(ret)


def get_data_inventory() -> Sequence[Any]:
    """
    Gets a data inventory for the entire frontend to be seeded with.

    Top level is an array of species information.
    """
    assert r

    # get all common names
    common_data = {int(k.decode('utf-8')):v.decode('utf-8') for k, v in r.hgetall("species:common").items()}

    # get all scientific names
    scientific_data = {int(k.decode('utf-8')):v.decode('utf-8') for k, v in r.hgetall("species:scientific").items()}

    # start structure building
    species = {}        # aphia id key, data underneath

    # get all data keys
    v = r.keys("data:*:*:*:*:*")
    for vv in v:
        _, aphia_id_s, dtype, year_s, month_s, project = vv.decode('utf-8').split(":")

        # can always assume an all, and there will always be one defined month for the same year
        if month_s == 'all':
            continue

        aphia_id = int(aphia_id_s)
        month = int(month_s)
        year = int(year_s)

        if not aphia_id in species:
            species[aphia_id] = {
                'speciesCommonName': common_data.get(aphia_id, 'Unknown'),
                'speciesScientificName': scientific_data.get(aphia_id, 'Unknown'),
                'byProject': defaultdict(lambda: defaultdict(lambda: set()))     # key project name -> year [] -> month, use a set because we're getting both distribution/range keys back
            }

        species[aphia_id]['byProject'][project][year].add(month)

    # transform from dicts (used for collection) to lists
    transformed = [
        {
            'aphiaId': aphia_id,
            'speciesCommonName': data['speciesCommonName'],
            'speciesScientificName': data['speciesScientificName'],
            'byProject': {
                projectCode: {
                    'years': [
                        {
                            'year': year,
                            'months': sorted(months)
                        }
                        for year, months in sorted(projectData.items(), key=lambda t: t[0])
                    ]
                }
                for projectCode, projectData in data['byProject'].items()
            }
        }
        for aphia_id, data in species.items()
    ]

    return transformed
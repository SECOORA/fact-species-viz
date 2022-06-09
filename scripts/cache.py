import json
from collections import defaultdict
from functools import cmp_to_key
from json.decoder import JSONDecodeError
from typing import Any, Callable, Dict, Optional, Mapping, Sequence, Set, Union

from redis import Redis

from .config import CONFIG
from .log import logger
from .utils import ATPType, get_atp_cache_key


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

        # assume an all available
        if year == 'all':
            continue

        ret.add(int(year))

    return sorted(ret)


def get_species_months(aphia_id: int, year: Union[int, str]):
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


def get_species_for_project(project_code: str) -> Sequence[int]:
    """
    Gets a list of species AphiaIDs associated with a project.
    """
    assert r
    
    v = r.keys(f"data:*:*:*:*:{project_code}")
    ret = set()
    for vv in v:
        _, aphia_id_str, _, _, _, _ = vv.decode('utf-8').split(':')
        ret.add(int(aphia_id_str))

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
        year = int(year_s) if year_s != 'all' else year_s

        if not aphia_id in species:
            species[aphia_id] = {
                'speciesCommonName': common_data.get(aphia_id, 'Unknown'),
                'speciesScientificName': scientific_data.get(aphia_id, 'Unknown'),
                'byProject': defaultdict(lambda: defaultdict(lambda: set()))     # key project name -> year [] -> month, use a set because we're getting both distribution/range keys back
            }

        species[aphia_id]['byProject'][project][year].add(month)

    def custom_sort(a, b):
        a = a[0]
        b = b[0]
        if a == 'all':
            return 1
        if b == 'all':
            return -1

        if a < b:
            return -1
        elif a > b:
            return 1

        return 0

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
                        for year, months in sorted(projectData.items(), key=cmp_to_key(custom_sort))
                    ]
                }
                for projectCode, projectData in data['byProject'].items()
            }
        }
        for aphia_id, data in species.items()
    ]

    return transformed


def update_citations(project_code: str, shortname: str, citation: str, website: str):
    """
    Updates citation information for the given project.
    """
    r.hset(f"citations:{project_code}", 'shortname', shortname)
    r.hset(f"citations:{project_code}", 'citation', citation)
    r.hset(f"citations:{project_code}", 'website', website or '')


def get_citations():
    """
    Retrieves all citations in a dict.
    """
    ret = {}
    v = r.keys("citations:*")
    for vv in v:
        _, project = vv.decode('utf-8').split(":")
        md = {k.decode('utf-8'): v.decode('utf-8') for k, v in r.hgetall(f"citations:{project}").items()}

        ret[project] = {
            'shortname': md['shortname'],
            'citation': md['citation'],
            'website': md['website'] 
        }

    return ret


def cache_results(results: Sequence[Dict[str, Any]], dtype: ATPType) -> Set:
    """
    Stores the results of a process* operation in cache.

    Returns set of (type, species, year) tuples.
    """
    ret_val = set()       # type, species, year

    # store in cache
    for d in results:
        if 'type' in d['_metadata']:
            assert dtype == d['_metadata']['type']
            del d['_metadata']['type']

        ck = get_atp_cache_key('data', **d['_metadata'], type=dtype)

        ret_val.add((dtype, str(d['_metadata'].get('species_aphia_id')), str(
            d['_metadata'].get('year'))))

        # update species info
        species_aphia_id = d['_metadata'].get('species_aphia_id')
        species_common_name = d['_metadata'].get('species_common_name')
        species_scientific_name = d['_metadata'].get('species_scientific_name')

        update_species_common_name(species_aphia_id, species_common_name)
        update_species_scientific_name(
            species_aphia_id, species_scientific_name)

        if d['_metadata']['project_code'] != '_ALL':
            update_citations(
                d['_metadata']['project_code'],
                d['_metadata']['shortname'],
                d['_metadata']['citation'],
                d['_metadata']['website']
            )

        del d['_metadata']

        written = write_cache(ck, d)
        logger.info("Cached %s (%d)", ck, written)

    return ret_val

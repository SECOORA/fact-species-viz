import json
from json.decoder import JSONDecodeError
from typing import Any, Dict, Optional, Mapping

from redis import Redis

from .config import CONFIG


r = Redis.from_url(str(CONFIG.redis_dsn))


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

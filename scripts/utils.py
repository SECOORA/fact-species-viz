import sys
from contextlib import contextmanager
from enum import Enum
from typing import Tuple


def get_atp_cache_key(prefix, year, species_aphia_id, type, project_code='_ALL', month='all', **kwargs) -> str:
    """
    Creates a reproducable cache key out of the dict parts given.
    """
    a = [
        prefix,
        str(species_aphia_id),
        type,
        str(year),
        str(month),
        project_code,
    ]
    return ":".join(a)


class ATPType(str, Enum):
    all = "all"
    range = "range"
    distribution = "distribution"


@contextmanager
def lock(rc, locking_name, blocking_timeout=None):
    """Executes the function body after acquiring a redis lock."""
    print("LOCK REQ", locking_name, file=sys.stderr)
    with rc.lock(locking_name, blocking_timeout=blocking_timeout) as lock:
        print("LOCK ACQ", locking_name, file=sys.stderr)
        yield lock
        print("LOCK REL", locking_name, file=sys.stderr)


def get_methods_for_type(dtype: ATPType) -> Tuple[str, str]:
    """
    Returns the agg and summary method names for the given type.

    @TODO: maybe this should be in Config instead of hard coded to be the best?
    """
    if dtype == ATPType.range:
        agg_method = "daily"
        summary_method = "concave_hull"
    elif dtype == ATPType.distribution:
        agg_method = "daily"
        summary_method = "distribution_buffered"
    else:
        raise ValueError(f"Unknown type ({dtype})")

    return agg_method, summary_method
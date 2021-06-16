from enum import Enum

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

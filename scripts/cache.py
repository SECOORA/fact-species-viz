import json
from json.decoder import JSONDecodeError
from typing import Any, Dict, Optional

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

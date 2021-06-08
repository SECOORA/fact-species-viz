from typing import Optional

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from . import tasks
from .cache import read_cache
from .log import logger
from .utils import ATPType, get_atp_cache_key

app = FastAPI()

@app.post('/atp/{project_code}/{type}/{year}')
async def process_atp_project(project_code: str, year: int, type: ATPType):
    kwargs = {
        'project_code': project_code,
        'year': year,
        'type': type.value
    }

    # if month:
    #     kwargs['month'] = month

    res = tasks.run_atp_process.apply(kwargs=kwargs)
    ret_val = res.get()

    return ret_val

@app.get('/atp/{aphia_id}/{type}/{year}')
async def get_atp_data(aphia_id: int, year: int, type: ATPType, month: Optional[int] = None):
    kwargs = {
        'species_aphia_id': aphia_id,
        'year': year,
        'type': type.value
    }

    # if month not asked for, check all
    ck = get_atp_cache_key('data', **kwargs, month=month or 'all')
    cv = read_cache(ck)
    if cv != None:
        return cv

    return JSONResponse(status_code=404)
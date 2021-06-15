from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import tasks
from .cache import get_projects_for_species, read_cache, get_species_ids, get_species_months, get_species_years, get_data_inventory
from .log import logger
from .utils import ATPType, get_atp_cache_key

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:1234"],    # @TODO: uh more urls here
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*']
)


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


# @app.get('/atp/species')
# async def get_species():
#     """
#     Gets list of species aphia ids.
#     """
#     return get_species_ids()


# @app.get('/atp/species/{aphia_id}/years')
# async def species_years(aphia_id: int):
#     return get_species_years(aphia_id)


# @app.get('/atp/species/{aphia_id}/{year}')
# async def species_months(aphia_id: int, year: int):
#     return get_species_months(aphia_id, year)


# @app.get('/atp/projects/{aphia_id}')
# async def species_projects(aphia_id: int):
#     return get_projects_for_species(aphia_id)


@app.get('/atp/inventory')
async def data_inventory():
    return get_data_inventory()


@app.get('/atp/citations')
async def citations():
    return get_citations()


@app.get('/atp/{aphia_id}/{type}/{year}')
async def get_atp_data(aphia_id: int, year: int, type: ATPType, month: Optional[int] = None, project: Optional[str]=None):
    kwargs = {
        'species_aphia_id': aphia_id,
        'year': year,
        'type': type.value
    }

    # add it here so that the default happens in get_atp_cache_key and we don't have to repeat the default all over the place
    if project is not None:
        kwargs['project_code'] = project

    # if month not asked for, check all
    ck = get_atp_cache_key('data', **kwargs, month=month or 'all')
    cv = read_cache(ck)
    if cv != None:
        return cv

    return JSONResponse(status_code=404)

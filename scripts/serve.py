from typing import List, Optional, Union

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from scripts.fetch import get_project_active_years_from_graphql

from . import tasks
from .cache import get_projects_for_species, read_cache, get_species_ids, get_species_months, get_species_years, get_data_inventory, get_citations, get_species_for_project
from .log import logger
from .utils import ATPType, get_atp_cache_key

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:1234", "https://stage-atp-site.srv.axds.co", "http://stage-atp-site.srv.axiomptk",
                   "https://atp-site.srv.axds.co", "http://atp-site.srv.axiomptk", "https://secoora.org", "https://www.secoora.org"],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*']
)

@app.post('/atp/process_all/{species_aphia_id}/{type}')
async def process_atp_all(species_aphia_id: int, type: ATPType, year: Optional[int]=None, project_code: Optional[str]=None):
    """
    Do an "ALL" processing.

    Must be ordered first or it thinks `process_all` is a tracker code in the below route.
    """
    kwargs = {
        'species_aphia_id': species_aphia_id,
        'year': str(year) if year else None,
        'type': type.value if type else None
    }

    if year is not None and project_code is not None:
        raise HTTPException(status_code=400, detail="Don't use process_all endpoint for specifying both year and project_code, you'll get that by normal process route")

    if project_code is not None:
        kwargs = {
            **kwargs,
            'trackercode': project_code
        }

    if type == ATPType.all:
        kwargs = {
            **kwargs,
            'type': ATPType.range.value
        }

        res = tasks.run_atp_process_all.apply_async(kwargs=kwargs)

        kwargs = {
            **kwargs,
            'type': ATPType.distribution.value
        }

        res = tasks.run_atp_process_all.apply_async(kwargs=kwargs)
    else:
        res = tasks.run_atp_process_all.apply_async(kwargs=kwargs)

    if type == ATPType.all:
        kwargs['type'] = [ATPType.range.value, ATPType.distribution.value]

    return {'status': 'processing', 'args': kwargs}


@app.post('/atp/{project_code}/{type}/{year}')
async def process_atp_project(project_code: str, year: int, type: ATPType, force: Optional[bool]=None):
    kwargs = {
        'project_code': project_code,
        'year': year,
        'type': type.value,
        'force': force or False
    }

    if type == ATPType.all:
        kwargs = {
            **kwargs,
            'type': ATPType.range.value
        }

        res = tasks.run_atp_process.apply_async(kwargs=kwargs)

        kwargs = {
            **kwargs,
            'type': ATPType.distribution.value
        }

        res = tasks.run_atp_process.apply_async(kwargs=kwargs)
    else:
        res = tasks.run_atp_process.apply_async(kwargs=kwargs)

    # res = tasks.run_atp_process.apply(kwargs=kwargs)
    # ret_val = res.get()

    if type == ATPType.all:
        kwargs['type'] = [ATPType.range.value, ATPType.distribution.value]

    return {'status': 'processing', 'args': kwargs}


@app.post('/atp/PROCESS_DEFAULT')
async def process_defaults(type: Optional[ATPType]=None, limit: Optional[str] = None, force: Optional[bool] = None):
    projects = [
        'AMEELT',
        'BLKTP',
        'CGJACK',
        'FBLTP',
        'GADNRTT',
        'TQCS',
        'WPAJ',
        'WPCUB',
        'WPKINGM',
        'WPTTT',
        'COBCRP',
        'FLKEYST',
        'CZSBUL',
        'DTNSST',
        'ECBMIT',
        'ECBNEAR',
        'FSUGG',
        'GADNRMISC',
        'GADNRRD',
        'MULUCF',
        'NOAACONCH',
        'SCSOFL',
        'SRFCE',
        'TQCSPP',
        'TQLMB',
        'UGAACI',
        'V2LUMI',
        'V2LURB',
        'SSUEEL',
        'TBHOG',
        'KSCETM',
        'MMFT',
        # new approvals added nov 2022 data push
        'ABCOWN',
        'APFISH',
        'COBGOM',
        'COBREPRO',
        'FIUARBT',
        'FNEMO',
        'FSCAPE',
        'GGINEC',
        'GGINWC',
        'HBSERC',
        'JBIM',
        'JUKSC',
        'MBSHHN',
        'MMFSTS',
        'NCCOBIA',
        'RSTSNCT',
        'SLFWI',
        'UMASSHK',
        'USNKSC',
        'VIMCOB'
    ]

    if limit is not None:
        lprojects = limit.split(",")
        projects = [p for p in projects if p in lprojects]

    years = list(range(2009, 2023))

    if type is not None:
        types = [
            type
        ]
    else:
        types = [
            ATPType.range,
            ATPType.distribution
        ]

    ret = []

    for p in projects:
        for y in years:
            for t in types:
                kwargs = {
                    'project_code': p,
                    'year': y,
                    'type': t.value,
                    'force': force or False
                }

                tasks.run_atp_process.apply_async(kwargs=kwargs)
                ret.append(kwargs)

    return {'status': 'processing', 'count': len(ret), 'args': ret}


@app.post('/atp/PROCESS_DEFAULT_ALLS')
async def process_defaults_all(type: Optional[ATPType] = None, limit_species: Optional[List[int]]=Query(None)):
    """
    Queues jobs that process:
    - for all species:
        - all years for a species (all projects)
        - all years for a species, by project
        - each year for a species (all projects)

    Should run PROCESS_DEFAULT first in order to get each project's aggregations completed, as this
    only uses completed aggregations.  Make sure it finishes all jobs first!
    """
    years = list(range(2009, 2022))

    if type is not None:
        types = [
            type
        ]
    else:
        types = [
            ATPType.range,
            ATPType.distribution
        ]

    ret = []

    # pull list of species from cache
    aphia_ids = list(get_species_ids().keys())

    if limit_species is not None:
        aphia_ids = list(set(aphia_ids) & set(limit_species))

    for aphia_id in aphia_ids:

        # queue all years for the species (all projects)
        for t in types:
            kwargs = {
                'species_aphia_id': aphia_id,
                'type': t.value if t else None
            }
            tasks.run_atp_process_all.apply_async(kwargs=kwargs)
            ret.append(kwargs)

        # get list of projects that have this aphiaid
        projects = get_projects_for_species(aphia_id)

        # queue all years for a species, by project
        for t in types:
            for p in projects:
                kwargs = {
                    'species_aphia_id': aphia_id,
                    'type': t.value if t else None,
                    'trackercode': p
                }
                tasks.run_atp_process_all.apply_async(kwargs=kwargs)
                ret.append(kwargs)

        # get all years this species has data for
        years = get_species_years(aphia_id)

        # queue each year for a species (all projects)
        for t in types:
            for y in years:
                kwargs = {
                    'species_aphia_id': aphia_id,
                    'type': t.value if t else None,
                    'year': y
                }
                tasks.run_atp_process_all.apply_async(kwargs=kwargs)
                ret.append(kwargs)

    return {'status': 'processing', 'count': len(ret), 'args': ret}


@app.post('/atp/{project_code}')
async def process_atp_project_all_years(project_code: str, type: Optional[ATPType]=None, force: Optional[bool]=None):
    """
    Queues multiple processing jobs for a project, for each active year.

    Active years are determined by a RW graphql query.
    """
    years = get_project_active_years_from_graphql(project_code)
    if type is not None:
        types = [
            type
        ]
    else:
        types = [
            ATPType.range,
            ATPType.distribution
        ]

    ret = []

    for y in years:
        for t in types:
            kwargs = {
                'project_code': project_code,
                'year': y,
                'type': t.value,
                'force': force or False
            }

            tasks.run_atp_process.apply_async(kwargs=kwargs)
            ret.append(kwargs)

    return {'status': 'processing', 'count': len(ret), 'args': ret}



@app.post('/atp/process_all_for_project/{project_code}')
async def process_all_for_project(project_code: str, type: Optional[ATPType]=None, limit_species: Optional[List[int]]=Query(None)):
    """
    Queues jobs that process:
    - for each species in specified project:
        - all years for species (all projects)
        - all years for species (this project)
        - each year for species (all projects)

    Each year for species for a project is done first, elsewhere:
    - /atp/PROCESS_DEFAULT_ALLS
    - /atp/{project_code}?type
    - /atp/{project_code}/{type}/{year}

    One of the above should be done first before this endpoint. Make sure all jobs are finished first!
    """
    if type is not None:
        types = [
            type
        ]
    else:
        types = [
            ATPType.range,
            ATPType.distribution
        ]

    ret = []

    # pull list of species for project
    aphia_ids = get_species_for_project(project_code)

    if limit_species is not None:
        aphia_ids = list(set(aphia_ids) & set(limit_species))

    for aphia_id in aphia_ids:

        # queue all years for the species (all projects)
        for t in types:
            kwargs = {
                'species_aphia_id': aphia_id,
                'type': t.value if t else None
            }
            tasks.run_atp_process_all.apply_async(kwargs=kwargs)
            ret.append(kwargs)

        # queue all years for a species, by this project
        for t in types:
            kwargs = {
                'species_aphia_id': aphia_id,
                'type': t.value if t else None,
                'trackercode': project_code
            }
            tasks.run_atp_process_all.apply_async(kwargs=kwargs)
            ret.append(kwargs)

        # get all years this species has data for
        years = get_species_years(aphia_id)

        # queue each year for a species (all projects)
        for t in types:
            for y in years:
                kwargs = {
                    'species_aphia_id': aphia_id,
                    'type': t.value if t else None,
                    'year': y
                }
                tasks.run_atp_process_all.apply_async(kwargs=kwargs)
                ret.append(kwargs)

    return {'status': 'processing', 'count': len(ret), 'args': ret}


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
async def get_atp_data(aphia_id: int, year: Union[int, str], type: ATPType, month: Optional[int] = None, project: Optional[str]=None):
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

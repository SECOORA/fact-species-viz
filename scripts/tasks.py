#!/usr/bin/env python
#-*- coding: utf-8 -*-
"""Celery task definitions."""
from typing import Any, Dict, List, Optional
from uuid import uuid4

from celery import Celery

from .log import logger
from .config import CONFIG
from .utils import ATPType, get_atp_cache_key
from .cache import write_cache, update_species_common_name, update_species_scientific_name

from .process import process


app = Celery('atp', broker=CONFIG.redis_dsn)


@app.task
def run_atp_process(project_code: str, year: int, type: ATPType, month: Optional[int] = None):
    agg_method: str
    summary_method: str
    # extra_kwargs: Dict[str, Any] = {}

    if type == ATPType.range:
        agg_method = "animal_interpolated_paths"
        summary_method = "concave_hull"
        # extra_kwargs['buffer'] = 0.1
    elif type == ATPType.distribution:
        agg_method = "animal_interpolated_paths"
        summary_method = "distribution_buffered"

    # kwargs = {
    #     'trackercode': project_code,
    #     'year': str(year),
    #     'agg_method': agg_method,
    #     'summary_method': summary_method,
    #     'round_decimals': 1
    # }

    # if month:
    #     kwargs['month'] = month

    month_arg: Dict[str, int] = {}
    if month:
        month_arg = {"month": month}

    vals = process(
        project_code,
        year,
        agg_method,
        summary_method,
        round_decimals=1,
        **month_arg,
    )

    ret_val = set()       # type, species, year

    # store in cache
    for d in vals:
        if 'type' in d['_metadata']:
            assert type == d['_metadata']['type']
            del d['_metadata']['type']

        ck = get_atp_cache_key('data', **d['_metadata'], type=type)

        ret_val.add((type, str(d['_metadata'].get('species_aphia_id')), str(d['_metadata'].get('year'))))

        # metadata_month = d['_metadata'].get('month', None)

        # if metadata_month:
        #     if month and str(month) == str(metadata_month):
        #         ret_val = d
        #     elif not month and metadata_month == 'all':
        #         ret_val = d

        # update species info
        species_aphia_id = d['_metadata'].get('species_aphia_id')
        species_common_name = d['_metadata'].get('species_common_name')
        species_scientific_name = d['_metadata'].get('species_scientific_name')

        update_species_common_name(species_aphia_id, species_common_name)
        update_species_scientific_name(species_aphia_id, species_scientific_name)

        del d['_metadata']


        written = write_cache(ck, d)
        logger.info("Cached %s (%d)", ck, written)

    return ret_val

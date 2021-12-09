#!/usr/bin/env python
#-*- coding: utf-8 -*-
"""Celery task definitions."""
from typing import Any, Dict, List, Optional
from uuid import uuid4

from celery import Celery

from .log import logger
from .config import CONFIG
from .utils import ATPType, get_atp_cache_key, get_methods_for_type
from .cache import cache_results, write_cache, update_species_common_name, update_species_scientific_name, update_citations

from .process import process, process_all


app = Celery('atp', broker=CONFIG.redis_celery_dsn)


@app.task
def run_atp_process(project_code: str, year: int, type: ATPType, month: Optional[int] = None, force: bool=False):
    agg_method, summary_method = get_methods_for_type(type)
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
        force=force,
    )

    ret_val = cache_results(vals, type)
    return ret_val


@app.task
def run_atp_process_all(species_aphia_id: int, type: ATPType, year: Optional[int]=None, trackercode: Optional[str]=None):
    agg_method, summary_method = get_methods_for_type(type)

    vals = process_all(
        species_aphia_id,
        year,
        agg_method,
        summary_method,
        trackercode=trackercode
    )

    ret_val = cache_results(vals, type)
    return ret_val
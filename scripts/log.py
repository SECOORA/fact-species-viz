#!/usr/bin/env python
#-*- coding: utf-8 -*-
"""Logging configuration."""
import os
import logging
from logging import config

logconf = os.path.join(os.path.dirname(__file__), 'logging.conf')
config.fileConfig(logconf, disable_existing_loggers=False)
logger = logging.getLogger('atp')

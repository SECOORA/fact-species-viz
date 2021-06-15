#!/usr/bin/env python
#-*- coding: utf-8 -*-
"""Configuration."""
from pydantic import BaseSettings, Field, RedisDsn


class Configuration(BaseSettings):
    """Represents the project configuration."""
    redis_cache_dsn: RedisDsn = 'redis://:atp@redis:6379/1'
    redis_celery_dsn: RedisDsn = 'redis://:atp@redis:6379/0'

    class Config:
        """Configuration meta class."""
        env_file = '.env'
        env_prefix = 'ATP_'
        case_sensitive = False


CONFIG = None


if CONFIG is None:
    CONFIG = Configuration()

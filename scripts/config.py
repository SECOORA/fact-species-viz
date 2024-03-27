#!/usr/bin/env python
#-*- coding: utf-8 -*-
"""Configuration."""
from pydantic import HttpUrl, RedisDsn
from pydantic_settings import BaseSettings


class Configuration(BaseSettings):
    """Represents the project configuration."""
    redis_cache_dsn: RedisDsn = 'redis://:atp@redis:6379/1'
    redis_celery_dsn: RedisDsn = 'redis://:atp@redis:6379/0'

    data_dir: str = "cache"

    rw_gql_url: HttpUrl = 'https://gql.researchworkspace.com/graphql'
    rw_auth_token: str = 'you_must_set'

    class Config:
        """Configuration meta class."""
        env_file = '.env'
        env_prefix = 'ATP_'
        case_sensitive = False


CONFIG = None


if CONFIG is None:
    CONFIG = Configuration()

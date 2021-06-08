#!/usr/bin/env python
#-*- coding: utf-8 -*-
"""Configuration."""
from pydantic import BaseSettings, Field, RedisDsn


class Configuration(BaseSettings):
    """Represents the project configuration."""
    redis_dsn: RedisDsn = 'redis://:atp@redis:6379/1'

    class Config:
        """Configuration meta class."""
        env_file = '.env'
        env_prefix = 'ATP_'
        case_sensitive = False


CONFIG = None


if CONFIG is None:
    CONFIG = Configuration()

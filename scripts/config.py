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


# @TODO: move this into config and/or redis
ALLOWED_PROJECTS = [
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
    'VIMCOB',
    # new approvals added june 2023 data push
    'SABSTS',
    'SGGAJ',
    'FSMOV',
    'FFC',
    'EEMPTAG',
    # new approvals added mar 2024 data push
    'LWLPBCERM',
    'FLKSHK',
    'MANGA',
    'FIUBULLT',
    'GULFTT',
    'GRNMSTAG',
    'NOAASARI',
    'NOAANERR',
    'SCDNRBTP',
    'SCDNRTIG',
    'SCDNRBON',
    'PECLGG',
    'PECLRF',
    'CZSDPF'
]
"""List of tracker codes for projects that have agreed to participate in DaViT."""

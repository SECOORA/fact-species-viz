#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Pytest configuration."""

import pytest


def pytest_addoption(parser):
    """Adds --integration option to pytest."""
    parser.addoption(
        "--integration",
        action="store_true",
        default=False,
        help="Run integration tests.",
    )


def pytest_configure(config):
    """Adds marker for slow."""
    config.addinivalue_line("markers", "integration: mark test as an integration test")


def pytest_collection_modifyitems(config, items):
    """Skips tests marked slow if --integration isn't used."""
    if config.getoption("--integration"):
        return
    skip_integration = pytest.mark.skip(reason="need --integration option to run")
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_integration)

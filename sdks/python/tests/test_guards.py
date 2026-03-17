"""Tests for environment activation guards."""
from __future__ import annotations

import os
from unittest import mock

from brakit.constants.network import (
    CI_SIGNALS, CLOUD_SIGNALS, ENV_DISABLE_KEY, PRODUCTION_SIGNALS,
)
from brakit.core.guards import should_activate

# All env vars that guards.py checks — used to build a clean environment.
_ALL_GUARD_KEYS = frozenset({ENV_DISABLE_KEY, *PRODUCTION_SIGNALS, *CI_SIGNALS, *CLOUD_SIGNALS})


def test_activates_in_development() -> None:
    env = {k: v for k, v in os.environ.items() if k not in _ALL_GUARD_KEYS}
    with mock.patch.dict(os.environ, env, clear=True):
        assert should_activate() is True


def test_disabled_by_env_var() -> None:
    with mock.patch.dict(os.environ, {"BRAKIT_DISABLE": "true"}, clear=True):
        assert should_activate() is False


def test_disabled_by_env_var_1() -> None:
    with mock.patch.dict(os.environ, {"BRAKIT_DISABLE": "1"}, clear=True):
        assert should_activate() is False


def test_disabled_in_production() -> None:
    with mock.patch.dict(os.environ, {"NODE_ENV": "production"}, clear=True):
        assert should_activate() is False


def test_disabled_in_ci() -> None:
    with mock.patch.dict(os.environ, {"CI": "true"}, clear=True):
        assert should_activate() is False


def test_disabled_in_github_actions() -> None:
    with mock.patch.dict(os.environ, {"GITHUB_ACTIONS": "true"}, clear=True):
        assert should_activate() is False

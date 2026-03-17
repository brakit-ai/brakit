"""Request-ID and Fetch-ID propagation for async-safe tracing.

Uses ContextVar (works in direct async code) with a fallback to a
task-keyed dict for SQLAlchemy async, which runs queries inside greenlets
where ContextVar values from the parent coroutine are not visible.
"""
from __future__ import annotations

import asyncio
from collections import OrderedDict
from contextvars import ContextVar

from brakit.constants.limits import MAX_TASK_CONTEXT_ENTRIES

_request_id: ContextVar[str | None] = ContextVar("brakit_request_id", default=None)
_fetch_id: ContextVar[str | None] = ContextVar("brakit_fetch_id", default=None)


class _BoundedDict(OrderedDict[int, str]):
    """OrderedDict that evicts oldest entries beyond a fixed capacity."""

    def __init__(self, maxlen: int = MAX_TASK_CONTEXT_ENTRIES) -> None:
        super().__init__()
        self._maxlen = maxlen

    def __setitem__(self, key: int, value: str) -> None:
        super().__setitem__(key, value)
        if len(self) > self._maxlen:
            self.popitem(last=False)


_task_request_ids: _BoundedDict = _BoundedDict()
_task_fetch_ids: _BoundedDict = _BoundedDict()


def set_request_id(rid: str, fetch_id: str | None = None) -> None:
    _request_id.set(rid)
    if fetch_id is not None:
        _fetch_id.set(fetch_id)
    try:
        task = asyncio.current_task()
        if task is not None:
            _task_request_ids[id(task)] = rid
            if fetch_id is not None:
                _task_fetch_ids[id(task)] = fetch_id
    except RuntimeError:
        pass


def _get(cvar: ContextVar[str | None], task_dict: _BoundedDict) -> str | None:
    val = cvar.get()
    if val is not None:
        return val
    try:
        task = asyncio.current_task()
        if task is not None:
            return task_dict.get(id(task))
    except RuntimeError:
        pass
    return None


def get_request_id() -> str | None:
    return _get(_request_id, _task_request_ids)


def get_fetch_id() -> str | None:
    return _get(_fetch_id, _task_fetch_ids)


def clear_request_id() -> None:
    _request_id.set(None)
    _fetch_id.set(None)
    try:
        task = asyncio.current_task()
        if task is not None:
            _task_request_ids.pop(id(task), None)
            _task_fetch_ids.pop(id(task), None)
    except RuntimeError:
        pass

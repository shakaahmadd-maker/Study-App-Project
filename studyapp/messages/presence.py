from __future__ import annotations

from django.core.cache import cache


_PREFIX = "messages:online:"
_TTL_SECONDS = 90  # keep short; refreshed by pings while connected


def _key(user_id) -> str:
    return f"{_PREFIX}{user_id}"


def set_online(user_id) -> None:
    cache.set(_key(user_id), True, timeout=_TTL_SECONDS)


def refresh_online(user_id) -> None:
    # Touch TTL without changing semantics
    cache.set(_key(user_id), True, timeout=_TTL_SECONDS)


def set_offline(user_id) -> None:
    cache.delete(_key(user_id))


def is_online(user_id) -> bool:
    return bool(cache.get(_key(user_id), False))



import threading
from contextlib import contextmanager

_active = threading.Event()


def enable() -> None:
    _active.set()


def disable() -> None:
    _active.clear()


def is_active() -> bool:
    return _active.is_set()


@contextmanager
def restoring():
    enable()
    try:
        yield
    finally:
        disable()

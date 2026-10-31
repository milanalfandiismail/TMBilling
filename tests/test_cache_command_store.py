"""Unit tests untuk app.services.cache.command_store."""

import pytest
from app.services.cache.command_store import (
    CommandQueueStore,
    CommandQueueDict,
    PENDING_COMMANDS,
    PENDING_FAST_COMMANDS
)


def test_command_queue_fifo():
    CommandQueueStore.clear()
    assert CommandQueueStore.pop_command(1) is None

    # Push 3 different commands
    CommandQueueStore.push_command(1, "lock")
    CommandQueueStore.push_command(1, "message:halo")
    CommandQueueStore.push_command(1, "unlock")

    # Verify FIFO order
    assert CommandQueueStore.pop_command(1) == "lock"
    assert CommandQueueStore.pop_command(1) == "message:halo"
    assert CommandQueueStore.pop_command(1) == "unlock"
    assert CommandQueueStore.pop_command(1) is None


def test_command_queue_deduplication():
    CommandQueueStore.clear()

    # Repeated lock commands should be deduplicated
    CommandQueueStore.push_command(2, "lock")
    CommandQueueStore.push_command(2, "lock")
    CommandQueueStore.push_command(2, "lock")

    assert CommandQueueStore.pop_command(2) == "lock"
    assert CommandQueueStore.pop_command(2) is None


def test_fast_command_queue():
    CommandQueueStore.clear()
    assert CommandQueueStore.pop_fast_command(3) is None

    CommandQueueStore.push_fast_command(3, "vnc_start")
    CommandQueueStore.push_fast_command(3, "refresh_processes")

    assert CommandQueueStore.pop_fast_command(3) == "vnc_start"
    assert CommandQueueStore.pop_fast_command(3) == "refresh_processes"
    assert CommandQueueStore.pop_fast_command(3) is None


def test_max_queue_length_limit():
    CommandQueueStore.clear()

    # Push 15 distinct commands
    for i in range(15):
        CommandQueueStore.push_command(4, f"msg_{i}")

    # Maximum 10 items kept (oldest dropped)
    items = []
    while True:
        cmd = CommandQueueStore.pop_command(4)
        if not cmd:
            break
        items.append(cmd)

    assert len(items) == 10
    assert items[0] == "msg_5"
    assert items[-1] == "msg_14"


def test_legacy_dict_compatibility():
    CommandQueueStore.clear()

    # Legacy push_cmd & pop_cmd
    PENDING_COMMANDS.push_cmd(10, "lock")
    assert PENDING_COMMANDS.get(10) == "lock"
    assert PENDING_COMMANDS.pop(10) == "lock"
    assert PENDING_COMMANDS.get(10) is None

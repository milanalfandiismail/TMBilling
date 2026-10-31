"""In-memory store untuk antrean perintah (Command Queue) PC client.

Menyediakan:
1. CommandQueueDict: Dict thread-safe yang mendukung antrean perintah FIFO per PC dengan batas antrean (anti memory leak).
2. CommandQueueStore: Store in-memory terpusat untuk antrean perintah reguler (GUI) dan cepat (Background/VNC).
3. PENDING_COMMANDS & PENDING_FAST_COMMANDS: Instansi global kompatibilitas.
"""

import threading

MAX_COMMAND_QUEUE_PER_PC = 10
DEDUPLICATED_COMMANDS = ("screenshot", "lock", "unlock")


class CommandQueueDict(dict):
    """Dict thread-safe yang mendukung antrean perintah FIFO per PC dengan batas antrean (anti memory leak)."""
    def __init__(self, is_fast: bool = False):
        super().__init__()
        self._lock = threading.Lock()
        self.is_fast = is_fast

    def push_cmd(self, pc_id: int, cmd: str):
        if not cmd or not pc_id:
            return
        with self._lock:
            q = super().get(pc_id)
            if q is None:
                super().__setitem__(pc_id, [cmd])
                return

            if not isinstance(q, list):
                q = [q]
                super().__setitem__(pc_id, q)

            # Deduplikasi perintah identik berkala (misal screenshot/lock saat PC offline)
            if cmd in q and cmd in DEDUPLICATED_COMMANDS:
                return

            q.append(cmd)
            # Batasi panjang antrean maksimal agar tidak memicu memory leak jika PC offline lama
            if len(q) > MAX_COMMAND_QUEUE_PER_PC:
                q.pop(0)

    def pop_cmd(self, pc_id: int, default=None):
        with self._lock:
            q = super().get(pc_id)
            if q is None:
                return default
            if isinstance(q, list):
                cmd = q.pop(0) if len(q) > 0 else default
                if not q:
                    super().pop(pc_id, None)
                return cmd
            else:
                return super().pop(pc_id, default)

    def pop(self, pc_id: int, default=None):
        return self.pop_cmd(pc_id, default)

    def get(self, pc_id: int, default=None):
        with self._lock:
            q = super().get(pc_id, default)
            if isinstance(q, list):
                return q[-1] if len(q) > 0 else default
            return q

    def remove(self, pc_id: int):
        with self._lock:
            super().pop(pc_id, None)

    def clear(self):
        with self._lock:
            super().clear()

    def __getitem__(self, pc_id: int):
        with self._lock:
            q = super().get(pc_id)
            if q is None:
                raise KeyError(pc_id)
            if isinstance(q, list):
                return q[-1] if len(q) > 0 else None
            return q

    def __setitem__(self, pc_id: int, val):
        if isinstance(val, list):
            for c in val:
                self.push_cmd(pc_id, c)
        else:
            self.push_cmd(pc_id, str(val))


class CommandQueueStore:
    """Store in-memory terpusat untuk antrean perintah PC."""
    _regular_queue = CommandQueueDict(is_fast=False)
    _fast_queue = CommandQueueDict(is_fast=True)

    @classmethod
    def push_command(cls, pc_id: int, cmd: str):
        cls._regular_queue.push_cmd(pc_id, cmd)

    @classmethod
    def pop_command(cls, pc_id: int, default=None):
        return cls._regular_queue.pop_cmd(pc_id, default)

    @classmethod
    def push_fast_command(cls, pc_id: int, cmd: str):
        cls._fast_queue.push_cmd(pc_id, cmd)

    @classmethod
    def pop_fast_command(cls, pc_id: int, default=None):
        return cls._fast_queue.pop_cmd(pc_id, default)

    @classmethod
    def remove(cls, pc_id: int):
        cls._regular_queue.remove(pc_id)
        cls._fast_queue.remove(pc_id)

    @classmethod
    def clear(cls):
        cls._regular_queue.clear()
        cls._fast_queue.clear()


# Instansi global untuk kompatibilitas import legacy
PENDING_COMMANDS = CommandQueueStore._regular_queue
PENDING_FAST_COMMANDS = CommandQueueStore._fast_queue
PENDING_VNC_COMMANDS = PENDING_FAST_COMMANDS

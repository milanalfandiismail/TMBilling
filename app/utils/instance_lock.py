import msvcrt
import os

_handle = None


def claim(instance_path: str) -> bool:
    """Ambil byte-lock server.lock; False bila proses lain sudah memegangnya."""
    global _handle
    os.makedirs(instance_path, exist_ok=True)
    handle = open(os.path.join(instance_path, "server.lock"), "a+b")
    handle.seek(0)
    try:
        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        handle.close()
        return False
    handle.seek(0)
    handle.truncate()
    handle.write(str(os.getpid()).encode())
    handle.flush()
    _handle = handle
    return True


def release() -> None:
    global _handle
    if _handle is not None:
        _handle.close()  # menutup handle melepas byte-lock
        _handle = None

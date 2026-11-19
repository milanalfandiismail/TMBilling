import os
import json
import threading
from app.utils.logger import write_log, read_logs, clear_logs, LOG_FILE


def test_logger_concurrent_writes():
    """Memastikan bahwa concurrent writes dari multi-thread aman (thread-safe)
    dan tidak menghasilkan korupsi file log atau race conditions."""
    clear_logs(archive=False)

    total_threads = 10
    writes_per_thread = 20

    def worker(worker_id):
        for i in range(writes_per_thread):
            write_log("TEST_ACTION", f"Thread {worker_id} msg {i}", user=f"user_{worker_id}")

    threads = [threading.Thread(target=worker, args=(t,)) for t in range(total_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Pastikan seluruh log tercatat lengkap tanpa JSON corruption
    assert os.path.exists(LOG_FILE)
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]

    assert len(lines) == total_threads * writes_per_thread

    for line in lines:
        data = json.loads(line)  # Harusnya valid JSON
        assert data["action"] == "TEST_ACTION"
        assert "Thread" in data["detail"]

    # Bersihkan kembali
    clear_logs(archive=False)


def test_logger_atomic_rewrite_preserves_new_entries():
    """Memastikan bahwa pembaruan atau cleanup log menggunakan fungsi atomik
    di bawah lock sehingga tidak menghilangkan baris log yang baru masuk."""
    from app.utils.logger import atomic_filter_logs

    clear_logs(archive=False)
    write_log("OLD", "Baris lama 1", user="system")
    write_log("OLD", "Baris lama 2", user="system")
    write_log("NEW", "Baris baru 1", user="system")

    # Filter hanya aksi NEW
    def filter_func(line_data):
        return line_data.get("action") == "NEW"

    removed_count = atomic_filter_logs(filter_func)
    assert removed_count == 2

    remaining = read_logs(limit=10)
    assert len(remaining) == 1
    assert "Baris baru 1" in remaining[0]

    clear_logs(archive=False)

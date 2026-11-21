"""Sampler frame transisi: mendeteksi area putih yang bukan bagian konten.

Dipakai manual (`py tools/e2e/flash_probe.py`) dan oleh FlashTest di test_client.
"""
import threading
import time
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

TMP = Path("X:/Temp/opencode")


@dataclass
class Frame:
    size: tuple
    visible: bool
    white_ratio: float
    tag: str


def white_ratio(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()
    total = 0
    white = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            total += 1
            r, g, b = px[x, y]
            if r > 235 and g > 235 and b > 235:
                white += 1
    return white / max(total, 1)


def settled_white(client, tag="settled", tries=5):
    """Rasio putih setelah window tenang; nilai ini dianggap konten, bukan flash."""
    shots = []
    for _ in range(tries):
        f = TMP / f"flash-{tag}.png"
        client.shot(str(f))
        shots.append(white_ratio(f))
        time.sleep(0.06)
    return min(shots)


def burst(client, action, tag="", ms=1200, interval=0.006, before=0.15):
    frames = []
    stop = False

    def sample():
        while not stop:
            f = TMP / "flash-live.png"
            client.shot(str(f))
            frames.append(Frame(tuple(client.size()), bool(client.visible()), white_ratio(f), tag))
            time.sleep(interval)

    t = threading.Thread(target=sample)
    t.start()
    time.sleep(before)
    action()
    time.sleep(ms / 1000)
    stop = True
    t.join()
    return frames


def flashes(frames, settled, margin=0.02):
    return [f for f in frames if f.visible and f.white_ratio > settled + margin]


def report(name, frames, settled_by_size, final_settled, margin=0.02):
    final_size = frames[-1].size if frames else None
    def baseline(f):
        if f.size == final_size:
            return final_settled
        return settled_by_size.get(f.size, 0.0)

    bad = [f for f in frames if f.visible and f.white_ratio > baseline(f) + margin]
    sizes = sorted({f.size for f in frames})
    print(f"{name}: frames={len(frames)} flash={len(bad)} sizes={sizes}")
    for f in bad[:5]:
        print(f"   {f.size} white={f.white_ratio:.3f} settled={baseline(f):.3f}")
    return len(bad)


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from tools.e2e.fixture import Client, Server, wait_until
    from tools.e2e.test_client import white_pixels  # noqa: F401  (kompatibilitas impor lama)

    srv = Server().start()
    ids = srv.seed_warnet()
    c = Client().start(srv)
    wait_until(lambda: "[poll] ok" in c.log_text(), 25)
    srv.open_member_session(ids["paket_15m"])
    wait_until(lambda: c.size()[0] < 800, 30)
    wait_until(c.visible, 5)
    time.sleep(0.6)

    settled_by_size = {}

    def settle(tag):
        time.sleep(0.6)
        settled_by_size[tuple(c.size())] = settled_white(c, tag)

    settle("card")
    c.click(190, 200)
    settle("alat")
    c.click(285, 200)
    settle("qris")
    c.click(95, 200)
    settle("sesi")

    results = []

    def run(name, action, ms=1200):
        frames = burst(c, action, name, ms)
        time.sleep(0.7)
        final = settled_white(c, name)
        settled_by_size[tuple(c.size())] = final
        results.append(report(name, frames, settled_by_size, final))
        time.sleep(0.7)

    run("tab-alat", lambda: c.click(190, 200))
    run("tab-qris", lambda: c.click(285, 200))
    run("tab-sesi", lambda: c.click(95, 200))
    run("tab-alat-2", lambda: c.click(190, 200))
    run("tab-sesi-2", lambda: c.click(95, 200))
    run("modal-logout", lambda: c.click(282, 150))
    run("modal-close", lambda: c.click(1019, 607))
    c.click(285, 200)
    time.sleep(0.6)
    run("qris-full", lambda: c.click(198, 395), 1600)

    c.stop()
    srv.cleanup()
    print("total_flash", sum(results))

"""Sampler transisi kiosk<->overlay: cari frame terlihat dengan ukuran salah."""
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import sys
from pathlib import Path as _P

sys.path.insert(0, str(_P(__file__).resolve().parents[2]))

from PIL import Image

from tools.e2e.fixture import Client, wait_until

OUT = Path("X:/Temp/opencode/transition")
WHITE = 235
FLASH_FLOOR = 0.35


@dataclass
class Frame:
    visible: bool
    size: tuple[int, int]
    white_ratio: float | None
    dark: bool | None
    tag: str


def white_ratio(path: Path) -> float:
    img = Image.open(path).convert("L").resize((160, 90))
    px = list(img.get_flattened_data())
    return sum(1 for p in px if p > WHITE) / len(px)


def sample(
    client: Client,
    action: Callable[[], None],
    tag: str,
    start_size: tuple[int, int] | None = None,
    ms: int = 1500,
    interval: float = 0.006,
) -> list[Frame]:
    """Kalau start_size diberikan, frame selama ukuran masih start_size diabaikan.

    Transisi overlay->kiosk baru terjadi setelah poll berikutnya, jadi sebelum
    ukuran berubah belum ada yang bisa dinilai."""
    OUT.mkdir(parents=True, exist_ok=True)
    frame_path = OUT / f"{tag}.png"
    frames: list[Frame] = []
    started = time.time()
    last_shot = 0.0
    action()
    while (time.time() - started) * 1000 < ms:
        size = tuple(client.size())
        if start_size is not None and size == start_size:
            time.sleep(0.02)
            continue
        visible = bool(client.visible())
        ratio = None
        dark = None
        now = time.time()
        # Screenshot mahal (~50 ms); visible/size tetap disampel tiap 5 ms.
        if visible and now - last_shot > 0.04:
            client.shot(frame_path)
            last_shot = now
            th = thumb(frame_path)
            ratio = sum(1 for p in th.get_flattened_data() if p > WHITE) / 576
            dark = sum(th.get_flattened_data()) / 576 < 3
        frames.append(Frame(visible, size, ratio, dark, tag))
        time.sleep(interval)
    return frames


def thumb(path: Path):
    return Image.open(path).convert("L").resize((32, 18))


def distance(a, b) -> float:
    pa, pb = list(a.get_flattened_data()), list(b.get_flattened_data())
    return sum(abs(x - y) for x, y in zip(pa, pb)) / len(pa)


def reference(client: Client, size: tuple[int, int], tag: str) -> dict[tuple[int, int], object]:
    """Thumbnail tampilan yang benar untuk ukuran itu (diambil saat sudah settle)."""
    path = OUT / f"ref-{tag}.png"
    OUT.mkdir(parents=True, exist_ok=True)
    client.shot(path)
    thumb_img = thumb(path)
    return {size: thumb_img, (size[0], size[1] + 1): thumb_img}


def report(frames, refs: dict[tuple[int, int], object], limit: float = 18.0) -> list[str]:
    """refs: ukuran jendela -> thumbnail tampilan yang benar untuk ukuran itu."""
    bad = []
    for i, f in enumerate(frames):
        if not f.visible:
            continue
        if f.size not in refs:
            bad.append(f"{f.tag} frame {i}: ukuran {f.size} tidak dikenal")
            continue
        if f.dark:
            bad.append(f"{f.tag} frame {i}: layar hitam ({f.size})")
        if f.white_ratio is not None and f.white_ratio > FLASH_FLOOR:
            bad.append(f"{f.tag} frame {i}: putih {f.white_ratio:.2f}")
    return bad


def main() -> None:
    from tools.e2e.fixture import Server

    server = Server().start()
    ids = server.seed_warnet()
    server.set_setting("client_polling_interval", "1")
    client = Client().start(server, args=("--size", "1920x1080"))
    wait_until(lambda: "[poll] ok" in client.log_text(), 30)
    try:
        kiosk_path = OUT / "ref-kiosk.png"
        client.shot(kiosk_path)
        refs = {(1920, 1080): thumb(kiosk_path)}
        up = sample(
            client,
            lambda: client.click(280, 442)
            or client.type_text("budi")
            or client.click(280, 532)
            or client.type_text("rahasia123")
            or client.click(280, 610),
            "kiosk-overlay",
        )
        wait_until(lambda: client.size()[0] < 800, 30)
        card_path = OUT / "ref-card.png"
        client.shot(card_path)
        refs[(380, 367)] = thumb(card_path)
        refs[(380, 368)] = refs[(380, 367)]
        sesi = server.active_session()
        down = sample(
            client,
            lambda: server.post(f"/api/v1/kasir/sesi/tutup/{sesi}"),
            "overlay-kiosk",
            start_size=(380, 367),
            ms=8000,
        )
        wait_until(lambda: client.size()[0] > 1000, 30)
        refs[(1920, 1081)] = refs[(1920, 1080)]
        for name, frames in (
            ("kiosk -> overlay", up),
            ("overlay -> kiosk", down),
        ):
            bad = report(frames, refs)
            hidden = sum(1 for f in frames if not f.visible)
            print(f"{name}: {len(frames)} frame ({hidden} tersembunyi), {len(bad)} pelanggaran")
            for line in bad[:5]:
                print("  " + line)
    finally:
        client.stop()
        server.stop()


if __name__ == "__main__":
    main()

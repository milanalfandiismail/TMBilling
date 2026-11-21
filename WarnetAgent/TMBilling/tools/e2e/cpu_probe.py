"""Ukur CPU klien: kiosk idle, overlay idle, overlay dengan hitung mundur.

Jalankan di mesin target (VM tanpa GPU memakai WARP, jadi angkanya relevan):
    py tools/e2e/cpu_probe.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.e2e.fixture import Client, Server, wait_until  # noqa: E402


def main():
    server = Server().start()
    ids = server.seed_warnet()
    try:
        kiosk = Client().start(server, args=("--size", "1920x1080"))
        wait_until(lambda: "[poll] ok" in kiosk.log_text(), 20)
        print(f"kiosk idle   : {kiosk.cpu_percent()}%")
        server.open_member_session(ids["paket_15m"])
        wait_until(lambda: kiosk.size()[0] < 800, 20)
        print(f"overlay idle : {kiosk.cpu_percent()}%")
        print(f"overlay tick : {kiosk.cpu_percent(10.0)}% (hitung mundur berjalan)")
        kiosk.stop()
    finally:
        server.stop()


if __name__ == "__main__":
    main()

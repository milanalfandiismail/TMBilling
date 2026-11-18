"""Probe baca-saja terhadap klien nyata: identify, status, warnet."""
import argparse
import json
import sys

import requests


def jalan(server: str, key: str, ip: str, mac: str) -> int:
    base = server.rstrip("/")
    h = {"X-Client-Key": key}
    body = {"ip_address": ip, "mac_address": mac}
    langkah = [
        ("identify", "POST", "/api/v1/public/client/identify", {**body, "hostname": "live-probe"}),
        ("status", "POST", "/api/v1/public/client/status", body),
        ("warnet", "GET", "/api/v1/public/client/warnet", None),
    ]
    gagal = 0
    for nama, metode, path, payload in langkah:
        r = requests.request(metode, base + path, json=payload, headers=h, timeout=20)
        ok = r.status_code == 200
        gagal += 0 if ok else 1
        ringkas = r.text[:160].replace("\n", " ")
        print(f"{'PASS' if ok else 'FAIL'} {nama:9} {r.status_code} {ringkas}")
    return 1 if gagal else 0


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--server", default="http://127.0.0.1:7015")
    p.add_argument("--key", required=True)
    p.add_argument("--ip", required=True)
    p.add_argument("--mac", default="")
    a = p.parse_args()
    sys.exit(jalan(a.server, a.key, a.ip, a.mac))

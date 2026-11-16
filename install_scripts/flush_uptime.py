"""Minta server TMBilling yang sedang berjalan menulis delta uptime RAM ke SQLite.

Dipakai stop.bat dan install_scripts/updater.bat sebelum penghentian paksa.
Exit code: 0 = aman untuk lanjut, 1 = tidak dapat memastikan delta tersimpan.
"""
import os
import sys
import urllib.error
import urllib.request


def resolve_api_key(env_path=".env"):
    """Baca CLIENT_API_KEY dari environment, lalu dari .env."""
    key = os.environ.get("CLIENT_API_KEY", "").strip()
    if key:
        return key
    try:
        with open(env_path, "r", encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("CLIENT_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        return ""
    return ""


def flush(port=None, timeout=5, env_path=".env"):
    key = resolve_api_key(env_path)
    if not key:
        print("[FLUSH] CLIENT_API_KEY tidak ditemukan; delta uptime tidak dapat disimpan.")
        return 1
    port = port or os.environ.get("PORT", "7015")
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/api/v1/kasir/settings/uptime/flush",
        method="POST",
        headers={
            "X-Client-Key": key,
            # Bearer membebaskan request dari verifikasi CSRF (lihat TMBillingCSRFProtect).
            "Authorization": f"Bearer {key}",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            ok = response.status == 200
    except urllib.error.HTTPError as exc:
        print(f"[FLUSH] Server menolak flush (HTTP {exc.code}).")
        return 1
    except urllib.error.URLError as exc:
        if isinstance(exc.reason, ConnectionRefusedError):
            print("[FLUSH] Server tidak berjalan; tidak ada delta RAM yang tersisa.")
            return 0
        print(f"[FLUSH] Gagal menghubungi server: {exc.reason}")
        return 1
    if not ok:
        print("[FLUSH] Respons server tidak dikenali.")
        return 1
    print("[FLUSH] Delta uptime tersimpan.")
    return 0


if __name__ == "__main__":
    sys.exit(flush(sys.argv[1] if len(sys.argv) > 1 else None))


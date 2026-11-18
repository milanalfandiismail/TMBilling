"""Harness uji kontrak klien WarnetAgent: sandbox Rust + PC 127.0.0.1."""
import shutil
import socket
import sqlite3
from pathlib import Path

import requests

import rust_sandbox as rs

REPO = Path(__file__).resolve().parents[3]
ROOT = REPO / "instance" / "e2e" / "client-agent"
KEY = "e2e-client-key-123456"
EMERGENCY = "e2e-emergency-token"
IP = "127.0.0.1"
MAC = "02:00:00:00:00:99"
PC_ID = 90
KODE = "PC-C1"


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class ClientHarness:
    def __init__(self, handle) -> None:
        self.h = handle
        self.base = handle.url
        self.root = Path(handle.root)
        self.key = KEY
        self.pc_id = PC_ID

    @classmethod
    def start(cls) -> "ClientHarness":
        if ROOT.exists():
            shutil.rmtree(ROOT)
        port = _free_port()
        rs.stop(rs.start(port=port, root=ROOT, seed=True), keep=True)
        db = sqlite3.connect(ROOT / "instance" / "warnet.db")
        db.execute(
            "INSERT OR REPLACE INTO pc (id,kode,nama,ip_address,mac_address,grup_id,zona,"
            "last_activity,aktif,is_admin_mode,pos_x,pos_y) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (PC_ID, KODE, "PC C1", IP, MAC, 1, "lobby", None, 1, 0, 0, 0),
        )
        for k, v in (("client_api_key", KEY), ("emergency_token", EMERGENCY)):
            db.execute('INSERT OR REPLACE INTO settings ("key",value) VALUES (?,?)', (k, v))
        db.commit()
        db.close()
        return cls(rs.start(port=port, root=ROOT, seed=False))

    def close(self) -> None:
        rs.stop(self.h, keep=True)

    def _headers(self, key, headers):
        h = {"X-Client-Key": self.key if key is None else key}
        h.update(headers or {})
        return h

    def post(self, path, payload, key=None, headers=None, raw=None):
        return requests.post(
            self.base + path,
            json=None if raw is not None else payload,
            data=raw,
            headers=self._headers(key, headers),
            timeout=30,
        )

    def get(self, path, key=None, headers=None):
        return requests.get(self.base + path, headers=self._headers(key, headers), timeout=30)


    def _login_kasir(self):
        if not hasattr(self, '_sess'):
            s = requests.Session()
            s.get(self.base + '/kasir/login', timeout=30)
            token = s.cookies.get('csrf_token', '')
            r = s.post(self.base + '/api/v1/kasir/auth/login',
                       json={'username': 'admin', 'password': 'admin123'},
                       headers={'X-CSRFToken': token}, timeout=30)
            r.raise_for_status()
            r = s.post(self.base + '/api/v1/kasir/shift/start', json={'modal_awal': 0},
                       headers={'X-CSRFToken': s.cookies.get('csrf_token', '')}, timeout=30)
            if r.status_code not in (200, 201, 400):
                r.raise_for_status()
            self._sess = s

    def kasir_post(self, path, payload=None):
        self._login_kasir()
        return self._sess.post(self.base + path, json=payload or {},
                               headers={'X-CSRFToken': self._sess.cookies.get('csrf_token', '')}, timeout=30)

    def kasir_get(self, path):
        self._login_kasir()
        return self._sess.get(self.base + path, timeout=30)
    def db(self, sql, params=()):
        c = sqlite3.connect(f"file:{self.root / 'instance' / 'warnet.db'}?mode=ro", uri=True)
        try:
            row = c.execute(sql, params).fetchone()
            return row[0] if row and len(row) == 1 else row
        finally:
            c.close()

    def db_exec(self, sql, params=()):
        c = sqlite3.connect(self.root / "instance" / "warnet.db")
        try:
            c.execute(sql, params)
            c.commit()
        finally:
            c.close()

    def log(self) -> str:
        p = self.root / "logs" / "warnet.log"
        return p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""

    def seed_pc(self, aktif: int = 1) -> int:
        self.db_exec("UPDATE pc SET aktif=? WHERE id=?", (aktif, PC_ID))
        return PC_ID

    def seed_sesi(self, menit: int = 60) -> int:
        self.db_exec("DELETE FROM sesi WHERE pc_id=?", (PC_ID,))
        self.db_exec(
            "INSERT INTO sesi (id,tipe,pc_id,nama_guest,mulai_pada,durasi_beli_menit,"
            "total_bayar,status,last_sync,is_afk) "
            "VALUES (900,'guest',?,'Tamu C1',datetime('now','-5 minutes'),?,8000,'aktif',"
            "datetime('now'),0)",
            (PC_ID, menit),
        )
        return 900

    def status(self, **extra):
        body = {"ip_address": IP, "mac_address": MAC}
        body.update(extra)
        return self.post("/api/v1/public/client/status", body)

    def identify(self):
        return self.post(
            "/api/v1/public/client/identify",
            {"ip_address": IP, "mac_address": MAC, "hostname": KODE},
        )


def png_bytes(size: int = 8) -> bytes:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (size, size), (10, 20, 30)).save(buf, "PNG")
    return buf.getvalue()

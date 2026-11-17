"""Helper assertion DB sandbox E2E (read-only)."""
from __future__ import annotations

import hashlib
import sqlite3


def db(path):
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return con


def one(path, sql, params=()):
    with db(path) as c:
        row = c.execute(sql, params).fetchone()
        return dict(row) if row else None


def rows(path, sql, params=()):
    with db(path) as c:
        return [dict(r) for r in c.execute(sql, params)]


def count(path, table):
    with db(path) as c:
        return c.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


def menit(path, member_id):
    """Saldo member disimpan sebagai menit (member.waktu_tersimpan)."""
    r = one(path, "SELECT waktu_tersimpan FROM member WHERE id=?", (member_id,))
    return r["waktu_tersimpan"] if r else None


def stok(path, menu_id):
    r = one(path, "SELECT stok FROM menu_item WHERE id=?", (menu_id,))
    return r["stok"] if r else None


def sesi_aktif(path, pc_kode):
    return one(path, """SELECT s.* FROM sesi s JOIN pc p ON p.id=s.pc_id
                        WHERE p.kode=? AND s.status='aktif'""", (pc_kode,))


def transaksi(path, no_nota):
    return one(path, "SELECT * FROM transaksi WHERE no_nota=?", (no_nota,))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

# app/models/base.py

"""Modul dasar untuk semua model SQLAlchemy.

Module ini menyediakan instance database bersama (shared db)
dan fungsi utilitas timestamp yang digunakan oleh semua model.

Exports:
    db (SQLAlchemy): Instance database SQLAlchemy yang di-share.
    now_local (callable): Fungsi untuk mendapatkan timestamp lokal.
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy import event
import sqlite3

db = SQLAlchemy()


@event.listens_for(db.Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA busy_timeout=5000;")
        cursor.close()


def now_local():
    """Mendapatkan waktu lokal saat ini.
    
    Returns:
        datetime: Objek datetime yang merepresentasikan waktu sekarang.
        
    Note:
        Fungsi ini digunakan sebagai default value untuk timestamp
        di seluruh model aplikasi.
    """
    return datetime.now()
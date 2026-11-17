"""Seed deterministik sandbox Rust untuk seluruh tab kasir (idempoten).

Hash password memakai werkzeug scrypt, format yang diterima models/user.rs:63-76.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from werkzeug.security import generate_password_hash


def _hash(pw: str) -> str:
    return generate_password_hash(pw, method="scrypt")


def apply(db_path: str) -> dict[str, int]:
    db = sqlite3.connect(db_path)
    try:
        now = datetime.now()
        y = (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
        expired = (now - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")

        db.executemany("INSERT OR REPLACE INTO grup (id,nama,warna,keterangan,aktif,dibuat_pada) VALUES (?,?,?,?,?,?)", [
            (1, "Reguler", "#22c55e", "Zona reguler", 1, y),
            (2, "VIP", "#f59e0b", "Zona VIP", 1, y),
            (3, "VVIP", "#ef4444", "Zona premium", 1, y),
        ])
        db.executemany("INSERT OR REPLACE INTO pc (id,kode,nama,ip_address,mac_address,grup_id,zona,last_activity,aktif,is_admin_mode,pos_x,pos_y) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", [
            (i, f"PC-0{i}", f"PC {i}", f"10.10.0.1{i}", f"02:00:00:00:00:0{i}", g, "lobby", y, 1, 0, (i - 1) * 120, 0)
            for i, g in zip(range(1, 6), (1, 1, 2, 2, 3))
        ])
        db.executemany("INSERT OR REPLACE INTO paket (id,nama,durasi_menit,harga,kadaluarsa_hari,grup_id,aktif,dibuat_pada) VALUES (?,?,?,?,?,?,?,?)", [
            (1, "1 Jam", 60, 8000, 1, 1, 1, y),
            (2, "2 Jam", 120, 15000, 1, 1, 1, y),
            (3, "3 Jam", 180, 21000, 1, 2, 1, y),
            (4, "Paket Malam", 360, 20000, 1, 3, 1, y),
        ])
        db.executemany("INSERT OR REPLACE INTO menu_item (id,nama,harga,stok,gambar_path,is_active) VALUES (?,?,?,?,?,?)", [
            (1, "Nasi Goreng", 15000, 20, None, 1),
            (2, "Mie Instan", 8000, 3, None, 1),
            (3, "Air Mineral", 5000, 0, None, 1),
            (4, "Es Teh", 4000, 50, None, 1),
        ])
        db.executemany("INSERT OR REPLACE INTO menu_stock_log (id,menu_id,menu_nama,tipe,jumlah_masuk,stok_sebelum,stok_sesudah,operator,catatan,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", [
            (1, 1, "Nasi Goreng", "masuk", 20, 0, 20, "seed", "stok awal", y),
            (2, 2, "Mie Instan", "masuk", 3, 0, 3, "seed", "stok awal", y),
        ])
        mh = _hash("pass123")
        db.executemany("INSERT OR REPLACE INTO member (id,username,password_hash,nama_lengkap,email,no_hp,grup_id,aktif,dibuat_pada,waktu_tersimpan,kadaluarsa_pada) VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
            (1, "member1", mh, "Member Satu", "m1@example.com", "081100000001", 1, 1, y, 120, None),
            (2, "member2", mh, "Member Dua", "m2@example.com", "081100000002", 2, 1, y, 0, None),
            (3, "member3", mh, "Member Tiga", "m3@example.com", "081100000003", 3, 1, y, 60, None),
            (4, "member_expired", mh, "Member Expired", "m4@example.com", "081100000004", 1, 1, y, 0, expired),
        ])
        db.execute("UPDATE user SET password_hash=?, aktif=1, role='admin' WHERE username='admin'", (_hash("admin123"),))
        db.execute("""INSERT OR REPLACE INTO user (id,username,password_hash,nama_lengkap,role,aktif,dibuat_pada,kuota_main_bulanan,sisa_kuota_menit)
                      VALUES (2,'kasir1',?,'Kasir Satu','kasir',1,?,0,0)""", (_hash("kasir123"), y))
        db.execute("""INSERT OR REPLACE INTO shift_record (id,kasir_id,waktu_mulai,waktu_selesai,modal_awal,total_billing,total_kantin,total_qris,total_refund,uang_fisik,selisih,catatan,detail_metode_json,status)
                      VALUES (1,2,?,?,200000,0,0,0,0,200000,0,'shift seed','{}','selesai')""", (y, y))
        db.executemany("""INSERT OR REPLACE INTO transaksi (id,sesi_id,member_id,paket_id,user_id,jenis,jumlah,menit,keterangan,dibuat_pada,no_nota,is_refunded,metode_pembayaran,operator)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", [
            (1, None, None, 1, 2, "beli_paket_guest", 8000, 60, "seed", y, "E2E-0001", 0, "Tunai", "kasir1"),
            (2, None, None, 1, 2, "tutup_sesi", 0, 0, "seed", y, "E2E-0002", 0, "Tunai", "kasir1"),
            (3, None, None, None, 2, "pembelian_menu", 15000, 0, "seed", y, "E2E-0003", 0, "Tunai", "kasir1"),
        ])
        db.execute("""INSERT OR REPLACE INTO transaksi_menu (id,no_nota,menu_id,jumlah,total_harga,pc_kode,tanggal,kasir_id,tunai,kembalian,metode_pembayaran,operator)
                      VALUES (1,'E2E-0003',1,1,15000,'PC-01',?,2,15000,0,'Tunai','kasir1')""", (y,))
        db.execute("INSERT OR REPLACE INTO game_kategori (id,nama,created_at,updated_at) VALUES (1,'FPS',?,?)", (y, y))
        db.executemany("INSERT OR REPLACE INTO game (id,nama,tipe,kategori,exe_path,argumen,icon,aktif,created_at,updated_at,operator_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
            (1, "Valorant", "exe", "FPS", None, None, None, 1, y, y, "admin"),
            (2, "CS2", "exe", "FPS", None, None, None, 1, y, y, "admin"),
        ])
        db.execute("""INSERT OR REPLACE INTO maintenance_ticket (id,pc_id,reporter,kategori,prioritas,judul,deskripsi,status,resolusi,biaya,created_at,updated_at,resolved_at,resolved_by)
                      VALUES (1,2,'member1','Hardware','RINGAN','Mouse rusak','Klik kiri macet','BARU',NULL,NULL,?,?,NULL,NULL)""", (y, y))
        db.execute("""INSERT OR REPLACE INTO hardware_monitor (id,pc_id,cpu_usage,cpu_temp,gpu_temp,total_ram,nic_speed,motherboard,cpu_name,gpu_name,active_window,hardware_baseline,hardware_current_specs,hardware_mismatch,hardware_mismatch_desc,hardware_mismatch_time,hardware_cctv_window,hardware_last_sync,last_update)
                      VALUES (1,1,5.0,45.0,50.0,'16384','1000','B550','Ryzen 5 5600','RTX 3060','TMBilling.exe',NULL,'{"MotherboardSerial":"E2E-MB-01","CpuId":"E2E-CPU-01","GpuPnpId":"E2E-GPU-01","GpuName":"RTX 3060","RamSerials":["E2E-RAM-01"],"DiskSerials":["E2E-DISK-01"]}',0,NULL,NULL,NULL,NULL,?)""", (y,))
        db.execute("INSERT OR REPLACE INTO pc_uptime_log (id,pc_id,tanggal,total_online_seconds,total_billing_seconds,first_seen,last_seen) VALUES (1,1,date('now'),3600,1800,?,?)", (y, y))
        db.execute("INSERT OR REPLACE INTO mikrotik_config (id,enabled,host,port,username,password,hotspot_profile,updated_at) VALUES (1,0,'192.168.88.1',8728,'admin','','default',?)", (y,))
        db.execute("INSERT OR REPLACE INTO turnamen (id,nama,deskripsi,status,dibuat_pada) VALUES (1,'E2E Cup','Turnamen uji','aktif',?)", (y,))
        db.executemany("INSERT OR REPLACE INTO turnamen_tim (id,turnamen_id,nama_tim,status_aktif,dibuat_pada) VALUES (?,?,?,?,?)", [
            (1, 1, "Alpha", 1, y), (2, 1, "Bravo", 1, y)])
        db.execute("INSERT OR REPLACE INTO turnamen_tahap (id,turnamen_id,nama,tipe_format,urutan,status,dibuat_pada) VALUES (1,1,'Babak 1','playoff',1,'aktif',?)", (y,))
        db.execute("INSERT OR REPLACE INTO turnamen_match (id,turnamen_id,tahap_id,round_number,match_number,tim1_id,tim2_id,skor1,skor2,pemenang_id,bo_format,next_match_id,dibuat_pada) VALUES (1,1,1,1,1,1,2,0,0,NULL,1,NULL,?)", (y,))
        # Sesi aktif PC-02 (guest, 45 menit tersisa) untuk kasus refund/pindah/tutup.
        db.execute("""INSERT OR REPLACE INTO sesi (id,tipe,pc_id,paket_id,nama_guest,mulai_pada,durasi_beli_menit,total_bayar,status,last_sync,is_blackout_suspect,is_blackout_resolved,is_afk,menit_pause_total)
                      VALUES (1,'guest',2,1,'E2E Guest Lama',?,60,8000,'aktif',?,0,0,0,0)""",
                   ((now - timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S"), now.strftime("%Y-%m-%d %H:%M:%S")))
        db.execute("UPDATE pc SET last_activity=? WHERE id=2", (now.strftime("%Y-%m-%d %H:%M:%S"),))

        # Transaksi pembelian paket untuk sesi seed, supaya alur Refund punya riwayat.
        db.execute("""INSERT OR REPLACE INTO transaksi (id,sesi_id,member_id,paket_id,user_id,jenis,jumlah,menit,keterangan,dibuat_pada,no_nota,is_refunded,metode_pembayaran,operator)
                      VALUES (100,1,NULL,1,2,'beli_paket_guest',8000,60,'seed sesi aktif',?,'E2E-SEED-S2',0,'Tunai','kasir1')""", (y,))

        # Batas hari lokal (WITA): transaksi 23:59 kemarin dan 00:01 hari ini, disimpan UTC naive.
        wita = ZoneInfo("Asia/Makassar")
        today_local = datetime.now(wita).replace(hour=0, minute=1, second=0, microsecond=0)
        yday_local = today_local - timedelta(days=1, minutes=2)
        db.executemany("""INSERT OR REPLACE INTO transaksi (id,sesi_id,member_id,paket_id,user_id,jenis,jumlah,menit,keterangan,dibuat_pada,no_nota,is_refunded,metode_pembayaran,operator)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", [
            (4, None, None, 1, 2, "pembelian_paket", 8000, 60, "batas hari kemarin",
             yday_local.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"), "E2E-0004", 0, "Tunai", "kasir1"),
            (5, None, None, 1, 2, "pembelian_paket", 8000, 60, "batas hari ini",
             today_local.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"), "E2E-0005", 0, "Tunai", "kasir1"),
        ])
        db.execute("INSERT OR REPLACE INTO turnamen (id,nama,deskripsi,status,dibuat_pada) VALUES (2,'E2E Selesai','Turnamen lampau','selesai',?)", (y,))

        db.execute("""INSERT OR REPLACE INTO system_tutorials (id,title,icon,category,content,urutan,created_at,updated_at)
                      VALUES (1,'Cara Buka Shift','fa-clock','Operasional','<p>Contoh</p>',1,?,?)""", (y, y))
        db.commit()

        tables = ["grup", "pc", "paket", "menu_item", "menu_stock_log", "member", "user",
                  "shift_record", "transaksi", "transaksi_menu", "game", "game_kategori",
                  "maintenance_ticket", "hardware_monitor", "pc_uptime_log", "mikrotik_config",
                  "turnamen", "turnamen_tim", "turnamen_tahap", "turnamen_match", "system_tutorials", "sesi"]
        return {t: db.execute("SELECT COUNT(*) FROM " + t).fetchone()[0] for t in tables}
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    print(apply(sys.argv[1]))

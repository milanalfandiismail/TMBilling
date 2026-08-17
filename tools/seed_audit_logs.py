"""Tool untuk menyuntikkan sampel log audit lengkap mencakup seluruh 12 domain sistem."""
import os
import json
from datetime import datetime, timedelta
from app import create_app
from app.utils.logger import write_log, LOG_FILE

def seed_logs(include_legacy=True):
    app = create_app()
    with app.app_context():
        operator = "admin"
        print("🌱 Menyuntikkan sampel log lengkap (12 domain) ke warnet.log...")

        # 1. Format Legacy & Corrupted / Raw
        if include_legacy:
            now_str = (datetime.now() - timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{now_str}] [kasir_pagi] BUKA_GUEST - Guest PC-03 (60 menit)\n")
                f.write(f"[{now_str}] [system] SYSTEM_BOOT - Server TMBilling started\n")
                f.write("BARIS_LOG_RAW_TANPA_FORMAT_UNTUK_UJI_FALLBACK\n")

        # 2. Sesi & Billing (🎮)
        write_log("BUKA_GUEST", "PC:PC-02 | Guest:Budi | 60m", user=operator, detail_json={
            "nama_guest": "Budi", "pc": "PC-02", "durasi_menit": 60, "harga": 6000
        })
        write_log("BUKA_MEMBER", "Member Buka PC-01", user=operator, detail_json={
            "username": "member_vip", "pc": "PC-01", "waktu_main": 120, "harga": 10000
        })
        write_log("TAMBAH_WAKTU", "Member:member_vip | +60m", user=operator, detail_json={
            "username": "member_vip", "paket": "Paket 1 Jam", "durasi_tambah": 60, "harga": 5000
        })
        write_log("PINDAH_PC", "PC-01 -> PC-04 | Sisa:90m", user=operator, detail_json={
            "pc_asal": "PC-01", "pc_tujuan": "PC-04", "sisa_menit": 90
        })
        write_log("TUTUP_SESI", "PC-04 Ditutup", user=operator, detail_json={
            "username": "member_vip", "pc": "PC-04", "durasi_terpakai": 90, "sisa_waktu": 0
        })

        # 3. Insiden Blackout / Mati Lampu (⚡)
        write_log("BLACKOUT_DETECT", "#12 | Dash: 45m | Audit: 45m", user="system", detail_json={
            "sesi_id": 12, "pc_kode": "PC-02", "sisa_menit": 45, "status": "SUSPECT"
        })
        write_log("BLACKOUT_RESOLVE_MEMBER", "Member:member_vip | Saldo: 45m", user=operator, detail_json={
            "username": "member_vip", "saldo_dikembalikan": 45, "resolusi": "REFUND_SALDO"
        })
        write_log("BLACKOUT_RESOLVE_GUEST_LANJUT", "Guest_Budi ke PC:PC-03", user=operator, detail_json={
            "nama_guest": "Guest_Budi", "pc_baru": "PC-03", "sisa_waktu": 45
        })

        # 4. Kantin & POS F&B (🍔)
        write_log("TRANSAKSI_MENU", "Penjualan Indomie Telur x2 (Total: Rp14,000) sukses via TMM-20260815-001", user=operator, detail_json={
            "no_nota": "TMM-20260815-001", "nama_menu": "Indomie Telur", "jumlah_qty": 2, "total_harga": 14000, "metode_pembayaran": "Tunai", "tunai": 15000, "kembalian": 1000
        })
        write_log("TAMBAH_MENU", "Menu 'Kopi Susu' berhasil ditambahkan ke katalog", user=operator, detail_json={
            "nama": "Kopi Susu", "harga": 5000, "stok": 50
        })
        write_log("EDIT_MENU", "Menu 'Kopi Susu' berhasil diupdate", user=operator, detail_json={
            "nama": "Kopi Susu Gula Aren", "harga": 6000, "stok": 45
        })

        # 5. Member (👤)
        write_log("TAMBAH_MEMBER", "Member udin_gamer (reguler) dibuat", user=operator, detail_json={
            "username": "udin_gamer", "nama_lengkap": "Udin Sudin", "grup": "reguler", "saldo_menit": 0, "no_hp": "08123456789", "email": "udin@gmail.com"
        })
        write_log("TOPUP_MEMBER", "Topup saldo udin_gamer +120m", user=operator, detail_json={
            "username": "udin_gamer", "durasi_tambah": 120, "saldo_baru": 120, "nominal": 10000
        })

        # 6. Shift Kasir (💵)
        write_log("SHIFT_BUKA", "Kasir:kasir_1 | Modal:Rp50,000", user=operator, detail_json={
            "kasir_username": "kasir_1", "modal_awal": 50000
        })
        write_log("SHIFT_TUTUP", "Kasir:kasir_1 | Modal:50,000 | Billing:100,000 | Kantin:50,000 | Fisik:200,000 | Selisih:+0", user=operator, detail_json={
            "kasir_username": "kasir_1", "modal_awal": 50000, "total_billing": 100000, "total_kantin": 50000, "uang_fisik": 200000, "selisih": 0, "status": "SELESAI"
        })

        # 7. Paket Billing (💳)
        write_log("TAMBAH_PAKET", "Paket Begadang (reguler) berhasil dibuat", user=operator, detail_json={
            "nama": "Paket Begadang", "durasi_menit": 600, "harga": 25000, "kadaluarsa_hari": 1, "grup": "reguler"
        })
        write_log("EDIT_PAKET", "Data paket Paket Malam diperbarui", user=operator, detail_json={
            "harga": {"old": 15000, "new": 20000}, "durasi_menit": {"old": 300, "new": 360}
        })

        # 8. Unit PC / Zona (🖥️)
        write_log("TAMBAH_PC", "PC PC-99 (vip) didaftarkan", user=operator, detail_json={
            "kode": "PC-99", "nama": "VIP-99", "ip_address": "192.168.1.99", "mac_address": "AA:BB:CC:DD:EE:FF", "grup": "vip"
        })
        write_log("BATCH_PC", "Tambah 5 PC via IP Range", user=operator, detail_json={
            "jumlah_ditambahkan": 5, "daftar_kode": ["PC-10", "PC-11", "PC-12", "PC-13", "PC-14"], "grup": "reguler"
        })
        write_log("WOL_PACKET", "Magic Packet terkirim ke PC-01 (AA:BB:CC:DD:EE:FF)", user=operator, detail_json={
            "kode": "PC-01", "mac": "AA:BB:CC:DD:EE:FF"
        })

        # 9. Akun & Keamanan (🔑)
        write_log("LOGIN_GAGAL", "Username:hacker - IP 10.0.0.1 tidak di whitelist", user="system", detail_json={
            "username": "hacker", "client_ip": "10.0.0.1", "reason": "IP tidak di whitelist"
        })
        write_log("IP_WHITELIST_ADD", "IP 192.168.1.50 ditambahkan ke whitelist", user=operator, detail_json={
            "ip_address": "192.168.1.50", "keterangan": "Kasir Backup"
        })
        write_log("UPDATE_USER", "ID:2 | User:kasir_malam", user=operator, detail_json={
            "username": "kasir_malam", "nama_lengkap": "Budi Kasir", "role": "kasir", "aktif": True
        })

        # 10. Perawatan & Tiket PC (🛠️)
        write_log("BUAT_TIKET", "Tiket HARDWARE PC PC-05 dibuat (Prioritas TINGGI)", user=operator, detail_json={
            "pc_kode": "PC-05", "reporter": "admin", "kategori": "HARDWARE", "prioritas": "TINGGI", "judul": "Keyboard Rusak"
        })
        write_log("UPDATE_TIKET", "Tiket PC PC-05 diupdate ke SELESAI", user=operator, detail_json={
            "pc_kode": "PC-05", "status": "SELESAI", "resolved_by": "teknisi", "biaya": 150000
        })

        # 11. Refund & Hapus Riwayat (🔄 & 🗑️)
        write_log("REFUND_PAKET", "Refund paket Rp20,000 dari nota N-123", user=operator, detail_json={
            "no_nota_refund": "REF-001", "no_nota_original": "N-123", "jumlah_refund": 20000, "durasi_beli_sebelum": 120, "durasi_dikurangi": 120, "username": "budi_vip"
        })
        write_log("DELETE_STRUK", "Hapus transaksi nota TMM-001", user=operator, detail_json={
            "no_nota": "TMM-001", "jenis": "Kantin", "jumlah": 14000, "tanggal": "2026-08-15 10:00", "keterangan": "Batal pesan, user pulang"
        })

        # 12. Sistem, Backup & Settings (⚙️)
        write_log("MANUAL_BACKUP", "User memicu backup database ke server", user=operator, detail_json={
            "tipe": "MANUAL", "lokasi": "instance/backups/manual_20260815.db"
        })
        write_log("SETTINGS_TIMEZONE", "Timezone diubah ke Asia/Makassar", user=operator, detail_json={
            "timezone_sebelum": "Asia/Jakarta", "timezone_baru": "Asia/Makassar"
        })
        write_log("DB_MAINTENANCE", "Admin membersihkan data > 6 bulan & VACUUM DB", user=operator, detail_json={
            "retention_months": 6, "space_saved": "12.4 MB"
        })
        write_log("PAYMENT_METHOD_CONFIG", "Konfigurasi metode pembayaran diperbarui", user=operator, detail_json={
            "key": "payment_methods", "old_value": "Tunai,QRIS", "new_value": "Tunai,QRIS,Transfer Bank,Debit"
        })
        write_log("SETTINGS_AUTO_SHUTDOWN", "Timer auto-shutdown PC Client diperbarui", user=operator, detail_json={
            "timer_sebelum": "180", "timer_baru": "240"
        })
        write_log("CLIENT_ADMIN_LOGIN", "Admin login langsung di PC CLIENT-01", user=operator, detail_json={
            "pc_kode": "CLIENT-01", "ip_address": "192.168.1.5", "mac_address": "00:11:22:33:44:55", "admin_user": "admin"
        })
        write_log("REMOTE_SCREENSHOT_TRIGGER", "Permintaan remote screenshot dikirim ke PC CLIENT-01", user=operator, detail_json={
            "pc_kode": "CLIENT-01"
        })
        write_log("VNC_START", "Proxy Websockify VNC dijalankan pada port 5900", user=operator, detail_json={
            "listen_port": 5900, "status": True
        })
        write_log("TOURNAMENT_CREATE", "Turnamen 'Audit Cup 2026' berhasil dibuat", user=operator, detail_json={
            "nama": "Audit Cup 2026", "format": "playoff", "total_tim": 8
        })
        write_log("GAME_CREATE", "Game 'GTA V' ditambahkan ke katalog launcher", user=operator, detail_json={
            "nama": "GTA V", "kategori": "Action", "exe_path": "C:\\Games\\GTA5.exe"
        })
        write_log("CLEAR_LOG", "Log audit sistem berhasil dibersihkan", user=operator, detail_json={
            "total_dibersihkan": 250, "arsip_path": "logs/archives/warnet_log_20260815.jsonl.gz"
        })

        print("Base seeding done.")

        print("✅ Berhasil menyuntikkan seluruh sample logs (12 domain) ke sistem.")

if __name__ == "__main__":
    seed_logs()

# Desain Arsitektur & Spesifikasi: Full Audit Log Overhaul (Service-Layer Instrumentation)

## 1. Ringkasan Eksekutif
Dokumen ini mendefinisikan spesifikasi teknis untuk melakukan instrumentasi log audit secara komprehensif pada seluruh layer service dan route di TMBilling. Seluruh aktivitas kritis (keamanan, konfigurasi pembayaran, remote control PC, otentikasi, master data turnamen/game, backup, pembersihan log, dan maintenance) wajib dicatat menggunakan format JSON canonical terstruktur dengan metadata lengkap (`timestamp`, `user`, `action`, `detail`, `category`, `ip_address`, `browser_agent`, `detail_json`, `status`).

---

## 2. Arsitektur & Canonical Format

### 2.1 Canonical Log Entry Format (JSON Lines)
Setiap baris log pada `logs/warnet.log` memiliki skema JSON kanonikal:
```json
{
  "timestamp": "2026-08-15 15:30:00",
  "user": "admin",
  "action": "ACTION_NAME",
  "detail": "Keterangan singkat aksi human-readable",
  "category": "sistem|transaksi|sesi|blackout|keamanan|konfigurasi",
  "ip_address": "192.168.1.10",
  "browser_agent": "Mozilla/5.0...",
  "detail_json": {
    "key": "value"
  }
}
```

### 2.2 Canonical Helper Interface
Semua pencatatan menggunakan helper utama di `app/utils/logger.py`:
```python
def write_log(aksi: str, detail: str, user: str = "kasir", detail_json: dict = None)
```
Helper ini secara otomatis mengekstrak `ip_address` dan `User-Agent` dari context Flask request jika tersedia, atau memberi fallback `"-"` jika dipanggil dari daemon/thread background.

---

## 3. Komponen yang Terpengaruh & Titik Instrumentasi

### 3.1 Domain Konfigurasi & Metode Pembayaran (`app/routes/settings/settings_routes.py` & `SettingsService`)
1. **Pembaruan Konfigurasi Metode Pembayaran:**
   - Ketika `payment_methods` diperbarui melalui endpoint settings atau service, catat log:
     - `action`: `PAYMENT_METHOD_CONFIG`
     - `detail_json`: `{"methods_sebelum": "...", "methods_baru": "...", "updated_by": operator}`
2. **Pembaruan Auto-Shutdown Timer:**
   - `action`: `SETTINGS_AUTO_SHUTDOWN`
   - `detail_json`: `{"timer_sebelum": old_val, "timer_baru": new_val}`
3. **Pembaruan Pengaturan Generik (`PUT /settings/<key>`):**
   - `action`: `SETTINGS_UPDATE`
   - `detail_json`: `{"key": key, "old_value": old_val, "new_value": new_val}`
4. **Pembaruan Gambar QRIS (`POST /settings/qris`):**
   - `action`: `SETTINGS_QRIS_CHANGE`
   - `detail_json`: `{"filename": unique_filename, "url": qris_url}`

### 3.2 Domain Autentikasi & Akses Klien (`app/services/auth/`, `app/services/client/`)
1. **Web Kasir / Admin Login & Logout:**
   - Lengkapi `user=username` dan sertakan `detail_json` dengan role dan client IP.
   - `LOGIN_GAGAL`: sertakan `detail_json={"attempted_username": username, "reason": "Password salah / user tidak ditemukan"}`.
2. **Client PC Admin Login (Bypass Kiosk):**
   - Pada `ClientService.admin_login`, tambahkan pencatatan log audit:
     - `action`: `CLIENT_ADMIN_LOGIN`
     - `detail_json`: `{"pc_kode": pc.kode, "ip_address": ip_address, "mac_address": mac_address, "admin_user": username}`
3. **Admin Special Verification:**
   - Pada `AuthKasirService.validate_admin`, lengkapi `ADMIN_CHECK_SUCCESS`, `ADMIN_CHECK_FAILED`, `ADMIN_CHECK_DENIED` dengan `user=username` dan `detail_json`.

### 3.3 Domain Remote Control & Hardware Monitoring (`app/routes/monitor/`, `app/routes/vnc/`)
1. **Remote Kill Process:**
   - Lengkapi `REMOTE_KILL` dengan `user=operator` dan `detail_json={"pc_kode": pc.kode, "process_name": process_name}`.
2. **Remote Shutdown & Restart:**
   - Lengkapi `REMOTE_ACTION` dengan `user=operator` dan `detail_json={"pc_kode": pc.kode, "action": action}`.
3. **Remote Screenshot Client Trigger:**
   - Tambahkan log `action`: `REMOTE_SCREENSHOT_TRIGGER` dengan `user=operator` dan `detail_json={"pc_kode": pc.kode}`.
4. **VNC Websockify Proxy Start:**
   - Pada `vnc_routes.py::start_vnc_proxy`, tambahkan log `action`: `VNC_START` dengan `user=operator` dan `detail_json={"port": VNCService.LISTEN_PORT}`.

### 3.4 Domain Keamanan & IP Whitelist (`app/services/ip_whitelist/`, `app/routes/settings/`)
1. **Tambah / Hapus IP Whitelist:**
   - `action`: `IP_WHITELIST_ADD` / `IP_WHITELIST_REMOVE`
   - `detail_json`: `{"ip": ip, "label": label}`
2. **Regenerasi Bypass Token:**
   - `action`: `IP_WHITELIST_TOKEN_REGEN`
   - `detail_json`: `{"new_version": version}`

### 3.5 Domain Turnamen Bracket Maker (`app/services/tournament/tournament_service.py`)
1. **Buat Turnamen:**
   - `action`: `TOURNAMENT_CREATE`
   - `detail_json`: `{"nama": t.nama, "format": tipe_jalur, "total_tim": len(db_teams)}`
2. **Update Skor Pertandingan:**
   - `action`: `TOURNAMENT_SCORE_UPDATE`
   - `detail_json`: `{"match_id": match_id, "tim1": m.tim1.nama_tim, "tim2": m.tim2.nama_tim, "skor1": skor1, "skor2": skor2, "pemenang": winner_name}`
3. **Next Swiss Round & Finish Stage:**
   - `action`: `TOURNAMENT_STAGE_UPDATE`
   - `detail_json`: `{"stage": stage.nama, "status": stage.status}`
4. **Hapus Turnamen:**
   - `action`: `TOURNAMENT_DELETE`
   - `detail_json`: `{"nama_turnamen": t.nama}`

### 3.6 Domain Game Launcher (`app/services/game/game_service.py`)
1. **Tambah / Edit / Hapus Game:**
   - `action`: `GAME_CREATE` / `GAME_UPDATE` / `GAME_DELETE`
   - `detail_json`: `{"nama": game.nama, "kategori": game.kategori, "exe_path": game.exe_path}`

### 3.7 Domain Cloud Backup & Scheduler (`app/services/backup/`, `app/routes/backup/`)
1. **Pengujian Koneksi Provider Backup:**
   - Pada `test_connection`, tambahkan log `action`: `BACKUP_TEST_CONNECTION` dengan `user=operator` dan `detail_json={"provider": provider_type, "success": bool}`.
2. **Auto Backup & Cleanup:**
   - Lengkapi seluruh event backup (`DATABASE_BACKUP`, `BACKUP_CLOUD_SUCCESS`, `BACKUP_CLOUD_FAILED`, `BACKUP_CLEANUP`) dengan `detail_json` berisi metadata file dan ukuran.

### 3.8 Domain Pembersihan & Audit Trail (`app/services/report/log_audit_service.py`)
1. **Delete Struk Transaksi:**
   - Perbaiki referensi `tipe_pembayaran` -> `metode_pembayaran` pada `detail_json`.
2. **Clear All History & Clear by Date:**
   - Lengkapi dengan `detail_json` terstruktur mencakup jumlah transaksi dan sesi yang dihapus.

---

## 4. Rencana Pengujian & Verifikasi

1. **Unit & Service Tests:**
   - Menambahkan test suite komprehensif di `tests/test_audit_logging_coverage.py` yang memicu seluruh domain dan memvalidasi keberadaan log serta integritas payload `detail_json`.
2. **Regression Tests:**
   - Memastikan `tests/test_e2e_log_clearing.py`, `tests/test_log_audit_service.py`, dan `tests/test_logger_archiving.py` tetap berjalan lulus 100%.
3. **Seed Tool Verification:**
   - Memperbarui `tools/seed_audit_logs.py` untuk menyuntikkan sampel dari semua aktivitas baru yang telah diinstrumentasi.

---

## 5. Strategi Rollback
Seluruh perubahan bersifat aditif pada layer service (menambahkan panggilan `write_log`). Tidak ada perubahan skema database DDL atau dependensi pihak ketiga, sehingga aman dan backward-compatible dengan seluruh client dan data existing.

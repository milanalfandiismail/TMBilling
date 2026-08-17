# Design Spec: Audit Log Human-Readable Engine & Role Kasir RBAC Hardening

**Tanggal**: 2026-08-15  
**Status**: Draft / Awaiting Approval  
**Sistem**: TMBilling Kasir SPA, Logging Pipeline & API Authorization  

---

## 1. Ikhtisar & Tujuan

Dokumen ini mendefinisikan desain teknis untuk dua area pembaruan:
1. **Audit Log Human-Readable Engine**: Menghilangkan tampilan raw JSON (`{ ... }`) pada antarmuka log audit dan PDF export, menggantikannya dengan formatter visual yang terstruktur, rapi, dan mampu menangani seluruh variasi payload (event refund, delete struk, diff edit paket, nested object, array, JSON string, null/undefined, empty data, dan unmapped events).
2. **Role Kasir RBAC Hardening**: Membatasi tampilan sidebar untuk role **Kasir** secara ketat menjadi **hanya 5 menu**:
   - `Dashboard`
   - `Operasional & POS`
   - `Data Master` (dengan hak akses eksisting: Member = CRU, lainnya = Read-Only)
   - `Laporan Keuangan`
   - `Dokumentasi & Tutorial`
   Serta melindungi seluruh fitur/tab/API non-kasir dengan route guard dan authorization checks di level frontend dan backend.

---

## 2. Arsitektur Audit Log Human-Readable Engine

### A. Data Flow & Payload Model
- Log disimpan dalam bentuk JSON line di `logs/warnet.log` melalui `write_log(aksi, detail, user, detail_json)`.
- Backend `LogAuditService.get_system_logs()` mengembalikan objek log yang memuat field `detail_json`.
- Frontend `app/static/js/kasir/modules/log/index.js` merender visual log ke DOM `#log-content`.

### B. Spesifikasi Formatter Frontend (`LogFormatter`)

Formatter akan memproses `log.detail_json` menjadi HTML terstruktur dengan hierarki:

```
+-----------------------------------------------------------+
| [Normalizer] -> Validasi & Parse (JSON String -> Object)  |
+-----------------------------------------------------------+
                              |
       +----------------------+----------------------+
       |                                             |
[Event-Specific Handler]                    [Universal Formatter]
- REFUND_PAKET / TRANSAKSI REFUND           - Object (Key-Value Badges)
- DELETE_STRUK                              - Nested Object (Sub-Cards)
- EDIT_PAKET                                - Array (List Tags)
                                            - Primitives / Fallback
                                            - Optional "Raw JSON" Drawer
```

#### 1. Handler Spesifik: `REFUND_PAKET` & `TRANSAKSI (REFUND)`
Menampilkan data terstruktur dalam card ringkas:
- **No. Nota Refund**: `log.detail_json.no_nota_refund`
- **No. Nota Asli**: `log.detail_json.no_nota_original`
- **Jumlah Pengembalian**: `Rp {jumlah_refund:,}` (berwarna hijau/merah kontras)
- **Perubahan Waktu/Saldo**: `{sebelum}m -> {sesudah}m` (Pengurangan: `{durasi_dikurangi}m`)
- **Identitas**: `Member: {username}` atau `Guest: {nama_guest}`

#### 2. Handler Spesifik: `DELETE_STRUK`
- **No. Nota**: `{no_nota}`
- **Jenis**: `{jenis}`
- **Jumlah**: `Rp {jumlah:,}`
- **Keterangan**: `{keterangan}`
- **Tanggal Transaksi**: `{tanggal}`

#### 3. Handler Spesifik: `EDIT_PAKET`
- Menampilkan diff properti per baris: `{Nama Field}: {Nilai Lama} -> {Nilai Baru}`

#### 4. Universal Recursive Formatter (Generalisasi untuk Event Lain)
- **Auto-Formatting Key**: Mengubah `snake_case` / `camelCase` menjadi `Title Case` (contoh: `ip_address` $\rightarrow$ `IP Address`).
- **Auto-Formatting Value**:
  - Currency: Otomatis memformat angka menjadi `Rp XX.XXX` jika key memuat kata `jumlah`, `harga`, `amount`, `modal`, `total`, `saldo`.
  - Durasi: Otomatis menambahkan satuan `Menit` jika key memuat kata `durasi`, `menit`.
- **Nested Object Handling**: Dirender secara rekursif dalam sub-container berbatas garis lembut (`border-l-2 border-[#2a2a2a] pl-3 py-1`).
- **Array Handling**: Dirender sebagai daftar badge/tag inline atau list terindentasi.
- **Empty / Null / Undefined**: Tidak merender container kosong atau error.
- **Accordion Raw JSON**: Menyediakan opsi klik kecil `[+ Raw JSON]` di pojok detail untuk keperluan audit developer darurat, namun default-nya selalu tertutup.

### C. Ekspor PDF Human-Readable (`pdf_export_service.py`)
- Memperbarui `app/services/report/pdf_export_service.py` agar mengurai `detail_json` menjadi string key-value yang diformat rapi (bukan raw `json.dumps()`).

---

## 3. Desain RBAC & Isolasi Menu Role Kasir

### A. Tampilan Sidebar (`app/templates/kasir/components/sidebar.html`)
Role **Kasir** hanya boleh melihat 5 section menu:
1. `Dashboard` (Direct tab)
2. `Operasional & POS` (Dropdown: Kantin/POS F&B, Turnamen)
3. `Data Master` (Dropdown: Member, Paket Billing, Unit PC, Grup PC, Kelola Game)
4. `Laporan Keuangan` (Dropdown: Laporan Billing, Laporan Kantin, Riwayat & Struk, Laporan Perawatan)
5. `Dokumentasi & Tutorial` (Direct link)

**Section yang DIKUNCI KHUSUS ADMIN (`{% if session.get('kasir_role') == 'admin' %}`):**
- `Manajemen Staff` (`staff`)
- `Sistem Log` (`sistemlog`)
- `Sistem & Utilitas` (`system`) — *Statistik Server, Monitor Hardware, Hardware Checker, Pelacak Statistik PC, Perawatan PC, Monitor Screenshot, Pemulihan Mati Lampu, Kendali Jarak Jauh Server*
- `Pengaturan` (`settings`) — *Semua subtab settings*
- `MikroTik Hotspot` (`mikrotik`)
- `Analitik Owner` (`analytics`)
- `Ekstensi & Plugin` (`plugins`)

### B. Proteksi Frontend Navigation (`app/static/js/kasir/app.js`)
- Memperluas daftar `kasirOnlyRestricted` di `App.switchTab()` untuk mencakup seluruh tab non-kasir:
  `['user', 'log', 'server_statistic', 'monitor', 'hardware_checker', 'uptime', 'maintenance', 'screenshot', 'blackout', 'remote_server', 'settings', 'whitelist_ip', 'mikrotik', 'analytics', 'plugins', 'plugin-spa']` beserta seluruh subtab `settings_*`.
- Jika Kasir mencoba switch tab terlarang via hash/console, sistem akan menampilkan `Toast.error('Akses Ditolak: Hanya untuk Admin!')` dan otomatis mengarahkan ke tab `dash`.

### C. Proteksi Backend Endpoint (`@admin_required`)
Memastikan seluruh API endpoint di bawah ini dilindungi `@admin_required`:
1. `app/routes/report/report_routes.py`:
   - `GET /api/v1/kasir/report/log`
   - `POST /api/v1/kasir/report/log/clear`
   - `GET /api/v1/kasir/report/log/export`
   - `GET /api/v1/kasir/report/export/audit-pdf`
   - `GET /api/v1/kasir/report/blackout-log`
2. `app/routes/dashboard/dashboard_routes.py`:
   - `GET /api/v1/kasir/dashboard/server-metrics`
3. `app/routes/monitor/monitor_routes.py`:
   - `POST /processes/<int:pc_id>/kill`
   - `POST /register/<int:pc_id>`
   - `POST /remote/<int:pc_id>/<string:action>`
   - `POST /screenshot/trigger/<int:pc_id>`
   - `DELETE /<int:hardware_id>`

---

## 4. Rencana Pengujian & Verifikasi (Test Strategy)

1. **Uji Kasus Formatter Log Audit**:
   - Log Refund Member & Guest (verifikasi nilai sebelum/sesudah, durasi, rupiah).
   - Log Delete Struk (verifikasi nota & nominal).
   - Log Edit Paket (verifikasi diff lama vs baru).
   - Log Event Standar tanpa `detail_json`.
   - Log dengan payload object acak & nested object 2-3 level.
   - Log dengan payload array of strings / array of objects.
   - Log dengan `detail_json` berupa string JSON `"{\"foo\":\"bar\"}"`.
   - Log dengan `detail_json: null`, `detail_json: undefined`, dan `{}`.
2. **Uji Keamanan & RBAC Kasir (Negative Testing)**:
   - Login sebagai role Kasir, pastikan hanya 5 menu yang muncul di sidebar.
   - Panggil `App.switchTab('log')`, `App.switchTab('settings_general')`, `App.switchTab('server_statistic')` dari console browser $\rightarrow$ Akses ditolak dan redirect ke dashboard.
   - Lakukan HTTP request langsung (fetch / curl) ke `/api/v1/kasir/report/log` dengan session Kasir $\rightarrow$ HTTP 403 Forbidden.
   - Lakukan HTTP request ke endpoint Data Master Create/Update/Delete (misal `POST /api/v1/kasir/paket/`) dengan session Kasir $\rightarrow$ HTTP 403 Forbidden.
   - Verifikasi hak akses Member untuk Kasir tetap bekerja (Buka member baru `POST`, edit profil `PUT`, tambah waktu `POST`, namun hapus `DELETE` ditolak 403).
3. **Uji Role Admin & Owner (Regression Testing)**:
   - Login sebagai Admin/Owner, pastikan seluruh 11 menu sidebar tetap muncul lengkap dan dapat diakses normal tanpa error.
   - Verifikasi seluruh fitur Dashboard dan kasir operasional tetap 100% fungsional.

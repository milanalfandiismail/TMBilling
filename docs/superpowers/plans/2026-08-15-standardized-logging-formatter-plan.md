# Standardized Audit Logging Formatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menstandarisasi seluruh pemanggilan `write_log()` di backend dengan menyertakan `detail_json` terstruktur (mengikuti standar implementasi Refund) serta memperkaya frontend `LogFormatter` dengan header tematik ber-ikon agar semua log di sistem konsisten, rapi, dan mudah dibaca.

**Architecture:** Standardized data dictionaries (`detail_json`) di Python services yang memuat metadata transaksi & entitas lengkap, dan diproses secara dinamis oleh frontend `LogFormatter` di JavaScript dengan tema visual yang seragam.

**Tech Stack:** Python (Flask), Vanilla JavaScript, ReportLab, Tailwind CSS.

**Spec:** [`docs/superpowers/specs/2026-08-15-standardized-logging-formatter-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-15-standardized-logging-formatter-design.md)

---

## Global Constraints
- **Source of Truth:** Mengikuti struktur `detail_json` berbasis `snake_case` dan field terformat seperti pada flow Refund.
- **Tidak Mengubah Business Logic:** Hanya menambahkan parameter `detail_json` pada pemanggilan `write_log()` tanpa mengubah alur logika bisnis transaksi atau sesi.
- **Robustness:** Formatter frontend harus tetap menangani payload null, undefined, string, array, dan dictionary secara elegan.

---

### Task 1: Standardisasi Logging pada Flow Sesi Billing (`sesi_service.py`)

**Files:**
- Modify: `app/services/sesi/sesi_service.py`

- [ ] **Step 1: Tambahkan `detail_json` pada `buka_sesi_guest`**
Tambahkan dictionary data terstruktur pada `BUKA_GUEST` dan `TRANSAKSI`:
```python
guest_details = {
    "pc_kode": pc_kode,
    "nama_guest": nama_guest,
    "paket": paket.nama,
    "durasi_menit": paket.durasi_menit,
    "harga": paket.harga,
    "no_nota": transaksi.no_nota,
    "metode_pembayaran": metode_pembayaran
}
write_log("BUKA_GUEST", f"PC:{pc_kode} | Guest:{nama_guest} | {paket.durasi_menit}m", user=operator, detail_json=guest_details)
write_log("TRANSAKSI", f"Nota:{transaksi.no_nota} | Beli:{paket.nama} | Rp {paket.harga}", user=operator, detail_json=guest_details)
```

- [ ] **Step 2: Tambahkan `detail_json` pada `buka_sesi_member`**
```python
member_details = {
    "pc_kode": pc.kode,
    "username": member.username,
    "sisa_menit": member.sisa_menit,
    "grup": pc.grup.nama if pc.grup else "Reguler"
}
write_log("BUKA_MEMBER", f"PC:{pc.kode} | Member:{member.username}", user=operator, detail_json=member_details)
```

- [ ] **Step 3: Tambahkan `detail_json` pada `tambah_waktu_sesi`**
Sertakan detail penambahan durasi, paket, nota, dan metode pembayaran untuk member & guest.

- [ ] **Step 4: Tambahkan `detail_json` pada `tutup_sesi` dan `pindah_pc`**
Sertakan detail durasi terpakai, sisa menit, pc asal, pc tujuan, dan identitas pelanggan.

- [ ] **Step 5: Verifikasi kompilasi Python**
```bash
python -m py_compile app/services/sesi/sesi_service.py
```

- [ ] **Step 6: Commit perubahan Task 1**
```bash
git add app/services/sesi/sesi_service.py
git commit -m "feat(log): standardize detail_json logging in sesi_service"
```

---

### Task 2: Standardisasi Logging pada Flow Member (`member_service.py`)

**Files:**
- Modify: `app/services/member/member_service.py`

- [ ] **Step 1: Tambahkan `detail_json` pada `create`, `update`, dan `delete` member**
Sertakan snapshot data profil member (username, nama_lengkap, grup, saldo_menit, no_hp, email).

- [ ] **Step 2: Tambahkan `detail_json` pada `tambah_waktu` (Topup Member)**
```python
topup_details = {
    "username": member.username,
    "paket": paket.nama,
    "durasi_menit": paket.durasi_menit * qty,
    "total_harga": paket.harga * qty,
    "saldo_sebelum": sebelum,
    "saldo_sesudah": waktu_baru,
    "no_nota": transaksi.no_nota,
    "metode_pembayaran": metode_pembayaran
}
write_log("TAMBAH_WAKTU", f"Member:{member.username} | +{paket.durasi_menit * qty}m", user=operator, detail_json=topup_details)
write_log("TRANSAKSI", f"Nota:{transaksi.no_nota} | Member:{member.username} | +{paket.durasi_menit * qty}m | Rp {paket.harga * qty}", user=operator, detail_json=topup_details)
```

- [ ] **Step 3: Verifikasi kompilasi Python**
```bash
python -m py_compile app/services/member/member_service.py
```

- [ ] **Step 4: Commit perubahan Task 2**
```bash
git add app/services/member/member_service.py
git commit -m "feat(log): standardize detail_json logging in member_service"
```

---

### Task 3: Standardisasi Logging pada Flow Kantin & POS F&B (`menu_service.py`)

**Files:**
- Modify: `app/services/menu/menu_service.py`

- [ ] **Step 1: Tambahkan `detail_json` pada `checkout_menu_order`**
```python
order_details = {
    "no_nota": no_nota,
    "nama_menu": t.menu.nama,
    "jumlah_qty": t.jumlah,
    "total_harga": t.total_harga,
    "pc_kode": t.pc_kode,
    "metode_pembayaran": t.metode_pembayaran,
    "tunai": tunai if tunai else None,
    "kembalian": kembalian if kembalian else None
}
write_log("TRANSAKSI_MENU", f"Penjualan {t.menu.nama} x{t.jumlah} (Total: Rp{t.total_harga:,}) sukses via {no_nota}", user=operator, detail_json=order_details)
```

- [ ] **Step 2: Tambahkan `detail_json` pada `update_menu`, `delete_menu`, dan `hard_delete_menu`**
Sertakan snapshot data menu (nama, harga, stok, transaksi historis).

- [ ] **Step 3: Verifikasi kompilasi Python**
```bash
python -m py_compile app/services/menu/menu_service.py
```

- [ ] **Step 4: Commit perubahan Task 3**
```bash
git add app/services/menu/menu_service.py
git commit -m "feat(log): standardize detail_json logging in menu_service"
```

---

### Task 4: Standardisasi Logging pada Shift, Master Data, Auth & Maintenance

**Files:**
- Modify: `app/services/shift/shift_service.py`
- Modify: `app/services/paket/paket_service.py`
- Modify: `app/services/pc/pc_service.py`
- Modify: `app/services/grup/grup_service.py`
- Modify: `app/services/user/user_service.py`
- Modify: `app/routes/auth/auth_kasir_routes.py`
- Modify: `app/services/maintenance/maintenance_service.py`

- [ ] **Step 1: Tambahkan `detail_json` pada `shift_service.py` (`SHIFT_BUKA` & `SHIFT_TUTUP`)**
- [ ] **Step 2: Tambahkan `detail_json` pada `paket_service.py`, `pc_service.py`, `grup_service.py`**
- [ ] **Step 3: Tambahkan `detail_json` pada `user_service.py` & `auth_kasir_routes.py` (Login/Logout/CRUD User)**
- [ ] **Step 4: Tambahkan `detail_json` pada `maintenance_service.py` (Tiket Perawatan)**
- [ ] **Step 5: Verifikasi kompilasi Python seluruh file**
```bash
python -m py_compile app/services/shift/shift_service.py app/services/paket/paket_service.py app/services/pc/pc_service.py app/services/grup/grup_service.py app/services/user/user_service.py app/routes/auth/auth_kasir_routes.py app/services/maintenance/maintenance_service.py
```
- [ ] **Step 6: Commit perubahan Task 4**
```bash
git add app/services/shift/shift_service.py app/services/paket/paket_service.py app/services/pc/pc_service.py app/services/grup/grup_service.py app/services/user/user_service.py app/routes/auth/auth_kasir_routes.py app/services/maintenance/maintenance_service.py
git commit -m "feat(log): standardize detail_json across shift, master data, auth, and maintenance"
```

---

### Task 5: Penambahan Header Tematik & Card Accents pada Frontend `LogFormatter` (`log/index.js`)

**Files:**
- Modify: `app/static/js/kasir/modules/log/index.js`

- [ ] **Step 1: Tambahkan category resolver & header theme builder di `LogFormatter`**
Petakan aksi menjadi badge tematik:
- `REFUND*` -> 🔄 Detail Refund (`border-red-500/20 text-red-400`)
- `BUKA_*`, `TUTUP_SESI`, `PINDAH_PC`, `TAMBAH_WAKTU` -> 🎮 Detail Sesi & Billing (`border-emerald-500/20 text-emerald-400`)
- `TRANSAKSI_MENU`, `*MENU` -> 🍔 Detail Kantin & POS (`border-amber-500/20 text-amber-400`)
- `*MEMBER` -> 👤 Detail Member (`border-purple-500/20 text-purple-400`)
- `SHIFT_*` -> 💵 Detail Shift Kasir (`border-cyan-500/20 text-cyan-400`)
- `*PAKET` -> 💳 Detail Paket Billing (`border-blue-500/20 text-blue-400`)
- `*PC`, `*GRUP` -> 🖥️ Detail Unit PC / Zona (`border-indigo-500/20 text-indigo-400`)
- `*USER`, `LOGIN`, `LOGOUT` -> 🔑 Detail Akun & Keamanan (`border-neutral-500/20 text-neutral-300`)
- `TIKET*`, `MAINTENANCE*` -> 🛠️ Detail Perawatan PC (`border-orange-500/20 text-orange-400`)

- [ ] **Step 2: Commit perubahan Task 5**
```bash
git add app/static/js/kasir/modules/log/index.js
git commit -m "feat(log): add themed headers and accents to LogFormatter visual cards"
```

---

### Task 6: Testing Menyeluruh & Verifikasi

- [ ] **Step 1: Uji script unit testing Python terhadap seluruh payload event baru**
- [ ] **Step 2: Verifikasi konsistensi tampilan log di frontend**
- [ ] **Step 3: Update dokumentasi plan & checklist selesai**
```bash
git add docs/superpowers/plans/2026-08-15-standardized-logging-formatter-plan.md
git commit -m "docs(superpowers): complete standardized logging formatter plan"
```

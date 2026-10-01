# Rencana Implementasi Validasi Sistem Menyeluruh (Comprehensive System Validation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menerapkan paket validasi komprehensif di seluruh modul (User, Member, PC, Grup, Paket, Menu/Kantin, Sesi, Branch, dan Settings) pada layer Backend (Service/Route) dan Frontend (Form/Modal) untuk mencegah data corrupt, kesalahan ketik kasir, angka negatif, dan integer overflow.

**Architecture:** 
1. Membuat modul utilitas validasi terpusat `app/utils/validators.py` yang menyediakan fungsi sanitasi dan validasi murni (*pure validation functions*).
2. Mengintegrasikan fungsi validasi ke dalam masing-masing Service Layer (`UserService`, `MemberService`, `PCService`, `GrupService`, `PaketService`, `MenuService`, `SesiService`, `BranchService`).
3. Menambahkan atribut batas HTML (`min`, `max`, `maxlength`, `pattern`) dan validasi JavaScript pada modal-modal di frontend kasir.
4. Menerapkan pengujian unit TDD di setiap task.

**Tech Stack:** Python 3.14, Flask, SQLAlchemy, pytest, Vanilla JS, Tailwind CSS.

---

## Global Constraints

- Semua pesan error validasi harus menggunakan Bahasa Indonesia yang ramah dan jelas bagi kasir.
- Batasan karakter dan angka tidak boleh merusak data yang sudah ada di database.
- Semua pengujian unit lama (156 tests) dan pengujian unit baru harus lulus 100%.
- Wajib menggunakan MCP `codebase-memory` selama eksekusi.

---

### Task 1: Modul Utilitas Validasi Terpusat (`app/utils/validators.py`)

**Files:**
- Create: `app/utils/validators.py`
- Test: `tests/test_validation_helpers.py`

**Interfaces:**
- Produces:
  - `validate_username(username: str, min_len=3, max_len=30, lowercase_only=False) -> str`
  - `validate_password(password: str, min_len=4, max_len=32) -> str`
  - `validate_integer_range(val, min_val, max_val, field_name: str) -> int`
  - `validate_hex_color(color: str) -> str`
  - `validate_phone_number(phone: str) -> str`
  - `validate_email_format(email: str) -> str`
  - `validate_string_length(text: str, min_len=1, max_len=100, field_name="Teks") -> str`

- [x] **Step 1: Tulis test unit untuk helper validasi**
- [x] **Step 2: Jalankan pytest dan pastikan gagal (*fail as expected*)**
- [x] **Step 3: Buat implementasi `app/utils/validators.py`**
- [x] **Step 4: Jalankan pytest dan pastikan lulus**
- [x] **Step 5: Commit perubahan**

---

### Task 2: Validasi Backend untuk User & Auth (`UserService`, `AuthRoutes`)

**Files:**
- Modify: `app/services/user/user_service.py`
- Modify: `app/routes/auth/auth_routes.py`
- Test: `tests/test_user_validation.py`

**Interfaces:**
- Consumes: `app.utils.validators` (`validate_username`, `validate_password`, `validate_string_length`)
- Enforces:
  - Username: 3 - 30 karakter, alfanumerik `^[a-zA-Z0-9_.-]+$`.
  - Password: 6 - 32 karakter.
  - Role: `['admin', 'kasir']`.
  - Nama: Max 100 karakter.
  - Proteksi: Menolak penghapusan admin terakhir.

- [x] **Step 1: Tulis test unit validasi User**
- [x] **Step 2: Jalankan pytest dan pastikan gagal**
- [x] **Step 3: Implementasikan validasi di `UserService.create_user` dan `update_user`**
- [x] **Step 4: Jalankan pytest dan pastikan lulus**
- [x] **Step 5: Commit perubahan**

---

### Task 3: Validasi Backend untuk Member (`MemberService`)

**Files:**
- Modify: `app/services/member/member_service.py`
- Test: `tests/test_member_validation.py`

**Interfaces:**
- Consumes: `app.utils.validators` (`validate_username`, `validate_password`, `validate_phone_number`, `validate_email_format`, `validate_integer_range`)
- Enforces:
  - Username: 3 - 30 karakter, lowercase `^[a-z0-9_.-]+$`.
  - Password: 4 - 16 karakter.
  - No HP: 8 - 16 digit `^[0-9+\- ]{8,16}$` jika diisi.
  - Email: format email valid jika diisi, max 120 karakter.
  - Waktu tersimpan: `0 <= saldo <= 525600`.

- [x] **Step 1: Tulis test unit validasi Member**
- [x] **Step 2: Jalankan pytest dan pastikan gagal**
- [x] **Step 3: Implementasikan validasi di `MemberService.create` dan `MemberService.update`**
- [x] **Step 4: Jalankan pytest dan pastikan lulus**
- [x] **Step 5: Commit perubahan**

---

### Task 4: Validasi Backend untuk Grup & PC (`GrupService`, `PCService`)

**Files:**
- Modify: `app/services/grup/grup_service.py`
- Modify: `app/services/pc/pc_service.py`
- Test: `tests/test_pc_grup_validation.py`

**Interfaces:**
- Consumes: `app.utils.validators` (`validate_string_length`, `validate_hex_color`, `validate_integer_range`)
- Enforces:
  - Grup: Nama 2 - 30 karakter `^[a-z0-9 _-]+$`, warna Hex `^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`.
  - PC: Koordinat `pos_x`, `pos_y` dalam rentang `-1 <= pos <= 2000`.

- [x] **Step 1: Tulis test unit validasi Grup & PC**
- [x] **Step 2: Jalankan pytest dan pastikan gagal**
- [x] **Step 3: Implementasikan validasi di `GrupService` dan `PCService`**
- [x] **Step 4: Jalankan pytest dan pastikan lulus**
- [x] **Step 5: Commit perubahan**

---

### Task 5: Validasi Backend untuk Paket & Kantin POS (`PaketService`, `MenuService`)

**Files:**
- Modify: `app/services/paket/paket_service.py`
- Modify: `app/services/menu/menu_service.py`
- Test: `tests/test_paket_menu_validation.py`

**Interfaces:**
- Consumes: `app.utils.validators` (`validate_string_length`, `validate_integer_range`)
- Enforces:
  - Paket: Nama 2 - 50 karakter, Durasi `1 <= menit <= 14400`, Harga `0 <= harga <= 100000000`, Kadaluarsa `1 <= hari <= 3650`.
  - MenuItem: Nama 2 - 100 karakter, Harga `0 <= harga <= 10000000`, Stok `-1 <= stok <= 1000000`.
  - Checkout Menu: Kuantitas `1 <= jumlah <= 1000` per item; Jika Tunai, `tunai >= total_bayar`; `kembalian >= 0`.

- [x] **Step 1: Tulis test unit validasi Paket & Menu**
- [x] **Step 2: Jalankan pytest dan pastikan gagal**
- [x] **Step 3: Implementasikan validasi di `PaketService` dan `MenuService`**
- [x] **Step 4: Jalankan pytest dan pastikan lulus**
- [x] **Step 5: Commit perubahan**

---

### Task 6: Validasi Backend untuk Sesi & Multi-Cabang (`SesiService`, `BranchService`)

**Files:**
- Modify: `app/services/sesi/sesi_service.py`
- Modify: `app/services/branch/branch_service.py`
- Test: `tests/test_sesi_branch_validation.py`

**Interfaces:**
- Enforces:
  - Sesi: Nama guest 1 - 50 karakter; Pindah PC menolak jika `pc_baru.id == sesi.pc_id`.
  - Branch: Nama 2 - 50 karakter, API Key 16 - 128 karakter, Urutan `>= 0`.

- [x] **Step 1: Tulis test unit validasi Sesi & Branch**
- [x] **Step 2: Jalankan pytest dan pastikan gagal**
- [x] **Step 3: Implementasikan validasi di `SesiService` dan `BranchService`**
- [x] **Step 4: Jalankan pytest dan pastikan lulus**
- [x] **Step 5: Commit perubahan**

---

### Task 7: Validasi Input, Constraint, & Helper Text pada Form Frontend (HTML & JavaScript)

**Files:**
- Modify: `app/static/js/kasir/modules/member/member_modal.js`
- Modify: `app/static/js/kasir/modules/user/index.js`
- Modify: `app/static/js/kasir/modules/grup/index.js`
- Modify: `app/static/js/kasir/modules/paket/index.js`
- Modify: `app/static/js/kasir/modules/menu/index.js`
- Modify: `app/static/js/kasir/modules/branch/index.js`

- [x] **Step 1: Tambahkan batasan atribut `maxlength`, `min`, `max`, `pattern`, `required` pada input modal HTML**
- [x] **Step 2: Tambahkan teks helper/informasi kecil di bawah label atau di samping input (contoh: `<span class="text-[10px] text-neutral-500">Maks. 30 karakter</span>`, `(4 - 16 karakter)`, `(Maks. 1000)`) agar kasir mendapat informasi batasan yang jelas**
- [x] **Step 3: Tambahkan validasi JavaScript pre-flight sebelum request API dikirim**
- [x] **Step 4: Pastikan notifikasi Toast informatif muncul jika form tidak valid**
- [x] **Step 5: Commit perubahan**

---

### Task 8: Regresi Menyeluruh, Build CSS, & Re-index MCP Codebase-Memory

**Files:**
- Run tests: Full test suite
- Build: `npm run build:css`
- Re-index: MCP `codebase-memory` (`index_repository`)

- [x] **Step 1: Jalankan full test suite pytest (156+ tests)**
- [x] **Step 2: Jalankan `npm run build:css`**
- [x] **Step 3: Re-index MCP `codebase-memory` dan periksa relasi graph**
- [x] **Step 4: Commit & Push ke remote repository `origin/v1.6.2`**

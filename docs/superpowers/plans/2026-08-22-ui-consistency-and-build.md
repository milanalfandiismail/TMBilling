# Rencana Implementasi: Konsistensi Styling UI, Build CSS, Versioning & Git Push

> **Untuk agen/pekerja otomatis:** SUB-SKILL WAJIB: Gunakan superpowers:subagent-driven-development (direkomendasikan) atau superpowers:executing-plans untuk mengeksekusi rencana ini tugas demi tugas. Setiap langkah menggunakan sintaks checkbox (`- [ ]`) untuk pelacakan.

**Tujuan:** Menyelaraskan antarmuka pengguna (UI) fitur baru Remote Control Server (VNC) dan Web File Explorer agar 100% konsisten dengan desain tab Pengaturan (Umum & Keamanan), melakukan build CSS, menaikkan versi aplikasi, melakukan testing penuh, code review, dan git push.

**Arsitektur:** Menggunakan pola UI existing dari tab Pengaturan → Umum & Keamanan:
1. Header Card berbingkai dengan Icon Box: `w-10 h-10 rounded bg-[#171717] border border-[#262626] flex items-center justify-center text-xl`
2. Tipografi Header: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider`
3. Subtitle / Deskripsi: `text-[9px] lg:text-base text-neutral-500 mt-1`
4. Container Card: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6`
5. Form Input: `bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500`
6. Tombol Aksi:
   - Primary: `px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded transition-colors`
   - Secondary / Utility: `px-3 py-2 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 text-xs lg:text-base font-bold rounded transition-colors`

**Tech Stack:** HTML5, Jinja2 Templates, Tailwind CSS (Chamber Noir Dark), Vanilla JS, Python Flask, Pytest.

**Spec:** [`docs/superpowers/specs/2026-08-22-vnc-auth-and-file-explorer-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-22-vnc-auth-and-file-explorer-design.md)

## Global Constraints
- Wajib menggunakan design token dan pola layout tab Pengaturan (Umum & Keamanan).
- Dilarang mengubah tema global atau stylesheet dasar yang mempengaruhi tab lain.
- Wajib menjalankan `index_repository` MCP setelah modifikasi berkas selesai.
- Wajib menaikkan versi aplikasi (version bump) sesuai standar project.
- Seluruh tes unit di Pytest harus lulus 100% sebelum commit dan push.

---

### Task 1: Refactor UI Remote Control VNC
**Files:**
- Modify: `app/templates/kasir/tabs/remote_server.html`
- Modify: `app/static/js/kasir/modules/remote/vnc_client.js`

- [ ] **Step 1: Selaraskan Header Card & Toolbar Remote Server**
  Terapkan icon box, typography `text-xs lg:text-[22px] font-bold uppercase`, subtitle `text-neutral-500`, dan tata letak tombol aksi sesuai standar tab Pengaturan.
- [ ] **Step 2: Verifikasi integrasi JS client**
  Pastikan event handler dan ID tombol/input VNC tetap terhubung dengan baik.

---

### Task 2: Refactor UI Web File Explorer & Modal Sandbox
**Files:**
- Modify: `app/templates/kasir/tabs/fileexplorer.html`
- Modify: `app/static/js/kasir/modules/fileexplorer/index.js`

- [ ] **Step 1: Selaraskan Header & Breadcrumb Web File Explorer**
  Gunakan container icon box `w-10 h-10`, typography standar, serta tombol aksi primary/secondary.
- [ ] **Step 2: Selaraskan Panel Tree & Text Editor**
  Terapkan form input pencarian `bg-[#050505] border border-[#1c1c1c]` dan tombol Simpan editor.
- [ ] **Step 3: Selaraskan Modal Allowed Roots**
  Ganti modal agar menggunakan `bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-6` dengan typography dan tombol konfirmasi standar.

---

### Task 3: Build CSS & Index Repository via MCP
**Files:**
- Command: Tailwind CSS Verification / Build
- MCP Tool: `index_repository`

- [ ] **Step 1: Verifikasi / Build Tailwind CSS**
  Pastikan class-class yang digunakan valid dan terkompilasi.
- [ ] **Step 2: Jalankan index_repository MCP**
  Index ulang codebase untuk menjaga keselarasan memori grafik.

---

### Task 4: Version Bump & Testing Suite
**Files:**
- Modify: `package.json`
- Modify: `app/__init__.py` / konfigurasi versi

- [ ] **Step 1: Identifikasi dan naikkan nomor versi**
  Naikkan nomor versi dari `1.5.4` menjadi `1.5.5`.
- [ ] **Step 2: Jalankan seluruh unit test Pytest**
  Jalankan `pytest` untuk memverifikasi 28 unit tests lulus 100%.

---

### Task 5: Code Review, Commit & Git Push
**Files:**
- Git: `git status`, `git diff`, `git commit`, `git push`

- [ ] **Step 1: Lakukan Code Review menyeluruh**
  Periksa kepatuhan UI, kebersihan kode, dan ketiadaan regresi.
- [ ] **Step 2: Commit perubahan dengan pesan Bahasa Indonesia yang informatif**
- [ ] **Step 3: Push branch feature ke remote origin**
- [ ] **Step 4: Verifikasi akhir**

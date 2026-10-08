# Rencana Implementasi: Eliminasi Total Tombol Mutasi Frontend & Validasi Backend Cabang Remote

> **Untuk Pekerja Agen:** REQUIRED SUB-SKILL: Gunakan superpowers:subagent-driven-development (direkomendasikan) atau superpowers:executing-plans untuk mengimplementasikan rencana ini tugas demi tugas. Setiap langkah menggunakan sintaks checkbox (`- [ ]`) untuk pelacakan.

**Tujuan:** Menghilangkan secara mutlak 100% tombol aksi penambahan, pengubahan, dan penghapusan (Create, Update, Delete, Mutasi) di frontend saat mengontrol cabang remote (`activeBranchId !== '0'`), memperbaiki kompilasi CSS yang ter-purge, serta mengonfirmasi proteksi backend 403 Forbidden.

**Arsitektur:** 
1. Pelepasan aturan CSS `.remote-hide-action` dari `@layer components` ke root level `input.css` agar terkompilasi verbatim ke `tailwind.css` tanpa di-purge.
2. Injeksi dini atribut `data-branch-mode="remote"` pada `<html>` dan `<body>` via inline script di `index.html` untuk eliminasi glitch visual saat refresh.
3. Penambahan kelas `.remote-hide-action` pada seluruh tombol aksi mutasi yang tersisa di modul JS (`menu`, `tournament`, `game`, `maintenance`, `dashboard_detail_modal`, `member_modal`) dan template Jinja2 terkait.
4. Verifikasi dan pengetatan backend relay reverse proxy 403 Forbidden pada mutasi `POST`, `PUT`, `DELETE`, `PATCH`.

**Tech Stack:** Tailwind CSS v3, Vanilla JavaScript (ES6+), Jinja2 HTML, Flask Python 3, Pytest.

**Spec:** [`docs/superpowers/specs/2026-10-08-frontend-mutation-buttons-elimination-and-backend-validation-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-10-08-frontend-mutation-buttons-elimination-and-backend-validation-design.md)

## Batasan Global
- Dilarang menghilangkan tombol atau fitur pada mode cabang lokal (`activeBranchId === '0'`).
- Dilarang melakukan git commit atau push sebelum ada instruksi eksplisit dari user.
- Seluruh 270 test suites harus tetap lulus 100%.

---

### Tugas 1: Perbaikan Aturan CSS Read-Only & Kompilasi Tailwind Anti-Purge

**File Terkait:**
- Modify: `app/static/css/input.css`
- Modify: `app/static/css/tailwind.css`
- Modify: `app/templates/kasir/index.html`

- [ ] **Langkah 1: Pindahkan aturan `.remote-hide-action` ke level root di luar `@layer` pada `input.css`**
  - Buka `app/static/css/input.css`.
  - Letakkan aturan berikut di akhir berkas (di luar blok `@layer components`):
    ```css
    /* =========================================================================
       Global Remote Branch Read-Only Protection Rules (Non-Purged)
       ========================================================================= */
    [data-branch-mode="remote"] .remote-hide-action,
    body[data-branch-mode="remote"] .remote-hide-action {
        display: none !important;
    }

    [data-branch-mode="remote"] .remote-readonly-disabled,
    body[data-branch-mode="remote"] .remote-readonly-disabled {
        pointer-events: none !important;
        opacity: 0.5 !important;
        cursor: not-allowed !important;
    }
    ```

- [ ] **Langkah 2: Tambahkan early inline initialization di `index.html`**
  - Buka `app/templates/kasir/index.html`.
  - Pada tag `<head>`, tambahkan script kecil:
    ```html
    <script>
        (function() {
            var bId = sessionStorage.getItem('active_branch_id');
            if (bId && bId !== '0') {
                document.documentElement.setAttribute('data-branch-mode', 'remote');
            }
        })();
    </script>
    ```

- [ ] **Langkah 3: Jalankan kompilasi CSS Tailwind**
  - Jalankan perintah: `npm run build:css`
  - Verifikasi bahwa string `remote-hide-action` kini benar-benar ada di dalam `app/static/css/tailwind.css`.

---

### Tugas 2: Tagging Tombol Aksi Mutasi di Modul Menu Kantin (`menu/index.js`, `menu.html`)

**File Terkait:**
- Modify: `app/static/js/kasir/modules/menu/index.js`
- Modify: `app/templates/kasir/tabs/menu.html`

- [ ] **Langkah 1: Tagging aksi pada katalog aktif di `menu/index.js`**
  - Di `renderCatalog(data)`:
    - Quick actions baris 222 (Restock, Edit, Arsipkan, Hapus Permanen):
      Tambahkan kelas `remote-hide-action` pada kontainer tombol admin dan tiap-tiap tombolnya.
    - Bottom action baris 250 (Tombol Tambah/Order ke Keranjang dan Tombol Tambah Stok):
      Bungkus atau tambahkan kelas `remote-hide-action` pada tombol aksi mutasi pesanan/stok tersebut.
- [ ] **Langkah 2: Tagging aksi pada katalog arsip di `menu/index.js`**
  - Di `renderArchivedCatalog(data)`:
    - Baris 430: Tambahkan kelas `remote-hide-action` pada tombol `Menu.restoreItem` (Pulihkan) dan `Menu.hardDeleteItem` (Hapus Permanen).
- [ ] **Langkah 3: Tagging tombol checkout di `app/templates/kasir/tabs/menu.html`**
  - Pastikan tombol `Menu.checkout()` dan tab `Arsip Menu` memiliki kelas `remote-hide-action`.

---

### Tugas 3: Tagging Tombol Aksi Mutasi di Modul Turnamen (`tournament/index.js`, `tournament.html`)

**File Terkait:**
- Modify: `app/static/js/kasir/modules/tournament/index.js`
- Modify: `app/templates/kasir/tabs/tournament.html`

- [ ] **Langkah 1: Tagging tombol hapus dan aksi turnamen di `tournament/index.js`**
  - Di `renderTournaments()`:
    - Baris 125: Tambahkan kelas `remote-hide-action` pada tombol `Tournament.deleteTournament`.
  - Di `renderSwiss()`:
    - Baris 421-434: Tambahkan kelas `remote-hide-action` pada tombol `Tournament.finishStage`, `Tournament.triggerNextSwiss`, dan `Tournament.openQualifyModal`.
- [ ] **Langkah 2: Tambahkan guard pada modal skor `openSkorModal`**
  - Di fungsi `openSkorModal()`:
    - Jika `BranchManager.activeBranchId !== '0'`, jangan izinkan input skor/modal (beri notifikasi Read-Only).
- [ ] **Langkah 3: Tagging tombol buat turnamen di `tournament.html`**
  - Pastikan tombol dan modal submit buat turnamen berkelas `remote-hide-action`.

---

### Tugas 4: Tagging Tombol Aksi Mutasi di Modul Game & Maintenance

**File Terkait:**
- Modify: `app/static/js/kasir/modules/game/index.js`
- Modify: `app/templates/kasir/tabs/game.html`
- Modify: `app/static/js/kasir/modules/maintenance/index.js`
- Modify: `app/templates/kasir/tabs/maintenance.html`

- [ ] **Langkah 1: Modul Game & Aplikasi**
  - Di `app/static/js/kasir/modules/game/index.js`:
    - Baris 179-184: Tambahkan kelas `remote-hide-action` pada tombol `GameManagement.openEditModal` dan `GameManagement.deleteGame`.
  - Di `app/templates/kasir/tabs/game.html`:
    - Baris 63: Tambahkan kelas `remote-hide-action` pada `<th class="pb-3 text-right w-[15%]">Aksi</th>`.
- [ ] **Langkah 2: Modul Perawatan PC (Maintenance)**
  - Di `app/static/js/kasir/modules/maintenance/index.js`:
    - Baris 298-311: Tambahkan kelas `remote-hide-action` pada tombol `Maintenance.changeStatus` (Proses), `Maintenance.openUpdateModal` (Tolak/Selesaikan), dan `Maintenance.deleteTicket` (Hapus).
  - Di `app/templates/kasir/tabs/maintenance.html`:
    - Tambahkan kelas `remote-hide-action` pada kolom header `<th ...>Aksi</th>`.

---

### Tugas 5: Tagging Tombol Aksi Mutasi di Modal Detail PC & Member

**File Terkait:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`
- Modify: `app/static/js/kasir/modules/member/member_modal.js`
- Modify: `app/templates/kasir/tabs/grup.html`
- Modify: `app/templates/kasir/tabs/paket.html`

- [ ] **Langkah 1: Tagging tombol di `dashboard_detail_modal.js`**
  - Baris 43: Tambahkan kelas `remote-hide-action` pada tombol `Wake-on-LAN`.
  - Baris 58: Tambahkan kelas `remote-hide-action` pada tombol `Pindah PC`.
- [ ] **Langkah 2: Tagging tombol di `member_modal.js`**
  - Baris 37-40: Tambahkan kelas `remote-hide-action` pada tombol `Member.refund` di dalam modal detail riwayat paket member.
- [ ] **Langkah 3: Tagging header tabel di `grup.html` dan `paket.html`**
  - Tambahkan kelas `remote-hide-action` pada elemen `<th ...>Aksi</th>` agar kolom aksi bersih dan rapi saat remote.

---

### Tugas 6: Verifikasi Backend Relay & Automated Tests

**File Terkait:**
- Modify: `tests/test_branch_remote_readonly_sidebar.py`

- [ ] **Langkah 1: Tambahkan skenario pengujian unit test**
  - Uji bahwa file terkompilasi `app/static/css/tailwind.css` memuat selektor `.remote-hide-action`.
  - Uji penolakan 403 Forbidden pada berbagai endpoint mutasi relay (`/api/v1/kasir/menu/`, `/api/v1/kasir/game/`, `/api/v1/kasir/tournament/`, `/api/v1/kasir/maintenance/`).
  - Uji rendering template HTML memastikan penanda kelas `remote-hide-action` terpasang secara komprehensif.
- [ ] **Langkah 2: Jalankan pytest keseluruhan (270 specs)**
  - `python -m pytest tests/`
  - Pastikan 100% test passing (0 error, 0 fail).
- [ ] **Langkah 3: Sinkronisasi SSOT `ANTIGRAVITY.md`**
  - Perbarui catatan audit dan playbook SSOT.

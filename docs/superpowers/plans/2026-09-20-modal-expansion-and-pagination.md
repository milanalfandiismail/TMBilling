# Modal Expansion and Pagination (Buka Sesi, Tambah Sesi, Tambah Member) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperluas dan menyelaraskan 3 modal utama kasir (**Buka Sesi**, **Tambah Waktu Sesi**, dan **Tambah Waktu Member**) pada breakpoint `lg`, `xl`, dan `2xl` agar memiliki tampilan mendekati fullscreen yang proporsional dengan margin/gap di sekelilingnya, struktur 2-kolom yang harmonis, serta fitur **Pagination Paket ~7 item per halaman** dengan persistensi state pilihan paket.

**Architecture:**
- **Container Sizing (Near-Fullscreen)**: Dimensi responsif selaras di semua modal: `w-[calc(100%-2rem)] max-w-md lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[1500px] lg:w-[92vw] xl:w-[88vw] 2xl:w-[84vw] max-h-[92vh] xl:max-h-[88vh] flex flex-col shadow-2xl rounded-xl`.
- **Harmonized 2-Column Split**:
  - Kolom Kiri (`lg:col-span-1` / ~28-33% lebar): Panel Informasi Target (PC/Member, Zona, Saldo), Input/Pengaturan, Preview Total Waktu/Biaya, dan Metode Pembayaran.
  - Kolom Kanan (`lg:col-span-2 xl:col-span-3` / ~67-72% lebar): Header daftar paket, Grid/List card paket dinamis, dan Pagination bar di footer.
- **Client-Side Pagination System**:
  - Ukuran halaman standar `pageSize = 7`.
  - Navigasi halaman: Tombol *Sebelumnya*, nomor halaman aktif, dan *Berikutnya*.
  - **State Retention**: State centang (*checked*) dan kuantitas (*quantity*) pada modal multi-paket (Tambah Sesi & Member Refill) disimpan dalam memori objek `_selections` sehingga tidak hilang saat kasir berpindah halaman pagination.
  - Single-select pada Buka Sesi: `_selectedPaketId` tetap tersimpan dan disorot saat navigasi halaman.

**Tech Stack:** Vanilla JavaScript (ES6+), Tailwind CSS v3.4.19, HTML5 Jinja2 Templates.

## Global Constraints
1. **PRESERVE EXISTING BEHAVIOR & APIS**: Endpoint API, payload transaksi, dan logika `ModalConfirmTambah` tidak boleh berubah atau rusak.
2. **RESPONSIVE INTEGRITY**: Modal harus tetap nyaman di layar kecil/mobile (`<1024px`) dengan fallback layout 1-kolom dan scrollbar yang bersih.
3. **GAP & MARGIN SAFETY**: Jangan gunakan `w-screen h-screen` murni tanpa batas; selalu gunakan margin/gap (`w-[84vw]..w-[92vw]`, `max-h-[88vh]..[92vh]`, `p-4..p-6`) agar terlihat modern, elegan, dan tidak menempel ke tepi layar.
4. **BUILD VERIFICATION**: Selalu jalankan `npm run build:css` setelah memodifikasi kelas Tailwind untuk memastikan styling ter-compile dengan benar.

---

### Task 1: Redesign & Pagination Modal Buka Sesi (`modal-buka.js`)
**Files:**
- Modify: `app/static/js/kasir/components/modal-buka.js:1-210`

**Interfaces:**
- Consumes: `API.paket.list()`, `API.settings.getAll()`, `API.sesi.bukaGuest()`, `ModalConfirmTambah.open()`, `Modal.show()`, `Modal.closeModal()`, `Utils.formatDurasiFriendly()`, `Utils.formatRupiah()`.
- Produces: `BukaModal.open(pcKode, pcGrup)`, `BukaModal.changePage(page)`, `BukaModal.selectPaket(id)`.

- [ ] **Step 1: Update Modal HTML Container & 2-Column Responsive Layout**
  - Ubah template modal container di `BukaModal.open()` menjadi:
    ```html
    <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-md lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[1500px] w-[calc(100%-2rem)] lg:w-[92vw] xl:w-[88vw] 2xl:w-[84vw] max-h-[92vh] xl:max-h-[88vh] mx-auto flex flex-col relative shadow-2xl my-auto">
    ```
  - Buat struktur grid 2-kolom pada `lg:`:
    - **Kiri**: Info PC & Zona, Input Nama Tamu, Metode Pembayaran, Preview Paket Terpilih.
    - **Kanan**: Header Daftar Paket (dengan total count), Kontainer Paket ter-paginate, dan Pagination Nav Bar.

- [ ] **Step 2: Implement Pagination State & Rendering (7 Items/Page)**
  - Tambahkan property:
    - `_currentPage: 1`
    - `_pageSize: 7`
    - `_selectedPaketId: null`
  - Implementasikan `renderPaketPage()`:
    - Menghitung `totalPages = Math.ceil(this._currentPaketList.length / this._pageSize) || 1`.
    - Mengambil slice `7 item`: `const pagedItems = this._currentPaketList.slice(start, start + this._pageSize)`.
    - Render card paket dengan highlight jika `p.id === this._selectedPaketId`.
    - Render pagination control di bawah list paket: Tombol *Sebelumnya*, info *Halaman X dari Y*, dan tombol *Berikutnya*.

- [ ] **Step 3: Update Event Handlers & Selection Preview**
  - Implementasikan `BukaModal.selectPaket(paketId)` yang mengupdate `this._selectedPaketId`, memperbarui UI card aktif, dan mengupdate kartu preview paket terpilih di kolom kiri.
  - Hubungkan `BukaModal.changePage(newPage)` untuk berpindah halaman pagination tanpa menghilangkan pilihan paket.
  - Pastikan `BukaModal.submit()` mengambil `this._selectedPaketId` dan memanggil `ModalConfirmTambah` secara normal.

- [ ] **Step 4: Manual Test & Validation**
  - Buka modal Buka Sesi pada PC.
  - Verifikasi tampilan pada desktop/layar besar menjadi luas 2-kolom, paket terbagi 7 per halaman, navigasi halaman responsif, dan pemilihan paket berjalan mulus.

---

### Task 2: Redesign & Pagination Modal Tambah Waktu Sesi (`modal-tambah.js`)
**Files:**
- Modify: `app/static/js/kasir/components/modal-tambah.js:1-280`

**Interfaces:**
- Consumes: `API.paket.list()`, `API.sesi.detail()`, `API.sesi.tambahWaktu()`, `ModalConfirmTambah.open()`, `Modal.show()`, `Modal.closeModal()`.
- Produces: `TambahModal.open(sesiId, pcGrup)`, `TambahModal.changePage(page)`, `TambahModal.togglePaket(id)`, `TambahModal.adjustQty(id, delta)`.

- [ ] **Step 1: Update Modal Container Dimensions on `lg/xl/2xl`**
  - Ubah wrapper container di `TambahModal.open()` menjadi:
    ```html
    <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-md md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[1500px] w-[calc(100%-2rem)] lg:w-[92vw] xl:w-[88vw] 2xl:w-[84vw] max-h-[92vh] xl:max-h-[88vh] mx-auto flex flex-col my-auto shadow-2xl">
    ```
  - Susun grid 2-kolom (`grid-cols-1 lg:grid-cols-3 xl:grid-cols-4`) dengan area list paket (`lg:col-span-2 xl:col-span-3`).

- [ ] **Step 2: Implement Multi-Package Pagination & Selection Map**
  - Tambahkan property:
    - `_selections: {}` (Format: `{ [paketId]: { checked: true/false, qty: number } }`)
    - `_currentPage: 1`
    - `_pageSize: 7`
  - Implementasikan `renderPaketList()`:
    - Potong daftar paket sebanyak 7 item per halaman.
    - Render kartu paket dengan status checkbox dan nilai kuantitas yang disinkronkan dari `this._selections[p.id]`.
    - Render pagination bar di bawah daftar paket.

- [ ] **Step 3: Update State Management & Live Calculation**
  - Pada `togglePaketSelection(paketId)`: catat `this._selections[paketId] = { checked, qty }`.
  - Pada `adjustPaketQty(paketId, delta)`: perbarui nilai `qty` di `this._selections[paketId]`.
  - Pada `updateTotalPreview()`: lakukan iterasi pada seluruh item di `this._selections` yang memiliki `checked === true` (sehingga paket di halaman lain tetap terhitung akurat).
  - Pada `submit()`: kumpulkan semua paket terpilih dari `this._selections`.

- [ ] **Step 4: Manual Test & Validation**
  - Buka modal Tambah Waktu pada sesi aktif.
  - Centang paket di Halaman 1, pindah ke Halaman 2 dan centang paket lain.
  - Verifikasi total durasi dan harga menghitung kedua halaman.
  - Lakukan submit dan verifikasi data konfirmasi tampil tepat.

---

### Task 3: Redesign & Pagination Modal Tambah Waktu Member (`member_refill.js`)
**Files:**
- Modify: `app/static/js/kasir/modules/member/member_refill.js:1-191`

**Interfaces:**
- Consumes: `API.member.get()`, `API.paket.list()`, `Member.doAddWaktu()`, `Modal.show()`, `Modal.closeModal()`.
- Produces: `MemberRefill.tambahWaktu(memberId)`, `MemberRefill.changePage(page)`, `MemberRefill.togglePaketSelection(id)`, `MemberRefill.adjustPaketQty(id, delta)`.

- [ ] **Step 1: Update Modal Container Dimensions on `lg/xl/2xl`**
  - Ubah wrapper container di `MemberRefill.tambahWaktu()` menjadi:
    ```html
    <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-md md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[1500px] w-[calc(100%-2rem)] lg:w-[92vw] xl:w-[88vw] 2xl:w-[84vw] max-h-[92vh] xl:max-h-[88vh] mx-auto flex flex-col my-auto shadow-2xl">
    ```
  - Selaraskan styling 2-kolom persis dengan `modal-tambah.js`.

- [ ] **Step 2: Implement Pagination (7 Items/Page) & Selection State**
  - Tambahkan property:
    - `_selections: {}`
    - `_currentPage: 1`
    - `_pageSize: 7`
  - Implementasikan `renderPaketList()` dan bar navigasi pagination 7 item per page.

- [ ] **Step 3: Harmonize Calculation & Event Listeners**
  - Hubungkan `togglePaketSelection` dan `adjustPaketQty` ke `this._selections`.
  - Update `updateTotalPreview()` agar menghitung seluruh paket terpilih di semua halaman.
  - Sinkronkan array paket terpilih ke `Member.doAddWaktu(memberId)`.

- [ ] **Step 4: Manual Test & Validation**
  - Buka modal Isi Waktu Member dari tab Member.
  - Verifikasi tampilan 2-kolom luas pada `lg/xl/2xl`, pagination 7 item/page, dan perhitungan total waktu/harga.

---

### Task 4: CSS Compilation, Validation & Commit
**Files:**
- Modify: `app/static/css/tailwind.css` (via build script)

- [ ] **Step 1: Compile Tailwind CSS**
  - Run: `npm run build:css`
  - Expected: Tailwind CSS ter-compile tanpa error.

- [ ] **Step 2: Cross-Modal Verification**
  - Verifikasi keselarasan visual antara Modal Buka Sesi, Tambah Sesi, dan Tambah Waktu Member.
  - Pastikan margin/gap di breakpoint `lg`, `xl`, dan `2xl` terlihat rapi dan proporsional.

- [ ] **Step 3: Commit Changes**
  - Run: `git add app/static/js/kasir/components/modal-buka.js app/static/js/kasir/components/modal-tambah.js app/static/js/kasir/modules/member/member_refill.js app/static/css/tailwind.css docs/superpowers/plans/2026-09-20-modal-expansion-and-pagination.md`
  - Run: `git commit -m "feat(ui): expand and harmonize buka sesi, tambah sesi, and member refill modals with pagination"`

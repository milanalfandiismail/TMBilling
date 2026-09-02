# Maintenance Ticket Detail & Title Wrapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menampilkan detail lengkap kerusakan unit PC pada Tab Perawatan PC, memastikan teks judul yang panjang dibungkus ke baris bawah secara rapi tanpa truncate, menampilkan cuplikan deskripsi di tabel, serta menyediakan tombol Detail untuk seluruh status tiket.

**Architecture:** Memperbarui antarmuka template modal di `maintenance.html` dan logika perenderan di `modules/maintenance/index.js` agar selalu menyajikan tombol Detail, memformat kolom masalah dengan multi-line wrapping font standar, dan menginjeksi ringkasan masalah ke modal update status.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5 / Tailwind CSS, Flask Backend.

**Spec:** `docs/superpowers/specs/2026-08-30-maintenance-ticket-detail-and-title-wrap-design.md`

## Global Constraints
- Ukuran font tetap sama (`text-xs lg:text-base` / standar TMBilling).
- Teks judul panjang tidak boleh terpotong (`break-words whitespace-normal leading-snug`).
- Tombol `Detail` wajib tersedia di setiap baris tiket (`BARU`, `DIPROSES`, `SELESAI`, `DITOLAK`).
- 100% kompatibel dengan pengujian backend yang sudah ada.

---

### Task 1: Update Modal Detail & Update UI in `maintenance.html`

**Files:**
- Modify: `app/templates/kasir/tabs/maintenance.html`

**Interfaces:**
- Consumes: Modal container `#modal-detail-ticket`, `#modal-update-ticket`
- Produces:
  - Element `#maint-update-info-box` di dalam `#modal-update-ticket` dengan child `#maint-update-info-pc`, `#maint-update-info-kategori`, `#maint-update-info-judul`, `#maint-update-info-deskripsi`.
  - Element `#maint-detail-judul` dan `#maint-detail-deskripsi` yang terpisah rapi di dalam `#modal-detail-ticket`.

- [ ] **Step 1: Inspect `app/templates/kasir/tabs/maintenance.html`**

Periksa posisi `#modal-update-ticket` dan `#modal-detail-ticket`.

- [ ] **Step 2: Add Problem Summary Box in `#modal-update-ticket`**

Tambahkan kotak informasi kerusakan di atas form update status:
```html
<div id="maint-update-info-box" class="bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 space-y-1 mb-4">
    <div class="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
        <span id="maint-update-info-pc" class="font-bold text-neutral-200">PC-01</span>
        <span id="maint-update-info-kategori" class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-bold uppercase">HARDWARE</span>
    </div>
    <div id="maint-update-info-judul" class="text-xs lg:text-sm font-bold text-neutral-100 leading-snug break-words">Judul Masalah</div>
    <div id="maint-update-info-deskripsi" class="text-[10px] lg:text-xs text-neutral-400 whitespace-pre-line break-words leading-relaxed">Deskripsi...</div>
</div>
```

- [ ] **Step 3: Update `#modal-detail-ticket` structure**

Pisahkan Judul Masalah dan Deskripsi Lengkap agar keduanya terlihat jelas:
```html
<div class="border-b border-[#1f1f1f] pb-2.5">
    <span class="text-neutral-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Judul Masalah</span>
    <div id="maint-detail-judul" class="font-bold text-neutral-100 break-words leading-snug font-sans text-xs lg:text-base">N/A</div>
</div>
<div class="border-b border-[#1f1f1f] pb-2.5">
    <span class="text-neutral-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Deskripsi Lengkap</span>
    <div id="maint-detail-deskripsi" class="bg-[#050505] p-3 rounded-lg border border-[#1f1f1f] text-neutral-300 whitespace-pre-line leading-relaxed font-sans text-xs lg:text-sm break-words">N/A</div>
</div>
```

---

### Task 2: Update Table Rendering & Modal Logic in `modules/maintenance/index.js`

**Files:**
- Modify: `app/static/js/kasir/modules/maintenance/index.js`

**Interfaces:**
- Consumes: `Maintenance.tickets`, `Maintenance.renderTickets()`, `Maintenance.openDetailModal()`, `Maintenance.openUpdateModal()`
- Produces:
  - Table rows with wrapped titles (`break-words leading-snug`) and description preview.
  - Action buttons containing the `Detail` button on all statuses (`BARU`, `DIPROSES`, `SELESAI`, `DITOLAK`).
  - `openUpdateModal(ticketId)` populates `#maint-update-info-box`.
  - `openDetailModal(ticketId)` populates `#maint-detail-judul` and `#maint-detail-deskripsi`.

- [ ] **Step 1: Update `renderTickets()` table rendering**

Ubah kolom Judul/Masalah dan kolom Aksi:
```javascript
let actionButtons = `
    <button onclick="Maintenance.openDetailModal(${t.id})" class="px-2.5 py-1.5 bg-[#171717] border border-[#262626] text-neutral-300 rounded-lg hover:bg-neutral-100 hover:text-black text-xs lg:text-sm font-bold transition-colors" title="Lihat Detail Lengkap">Detail</button>
`;

if (t.status === 'BARU') {
    actionButtons += `
        <button onclick="Maintenance.changeStatus(${t.id}, 'DIPROSES')" class="px-2.5 py-1.5 bg-blue-600/20 border border-blue-600/30 text-blue-400 rounded-lg hover:bg-blue-600/30 text-xs lg:text-sm font-bold transition-colors">Proses</button>
        <button onclick="Maintenance.openUpdateModal(${t.id}, '${t.status}')" class="px-2.5 py-1.5 bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg hover:bg-red-600/30 text-xs lg:text-sm font-bold transition-colors">Tolak</button>
    `;
} else if (t.status === 'DIPROSES') {
    actionButtons += `
        <button onclick="Maintenance.openUpdateModal(${t.id}, '${t.status}')" class="px-2.5 py-1.5 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 rounded-lg hover:bg-emerald-600/30 text-xs lg:text-sm font-bold transition-colors">Selesaikan</button>
    `;
}

if (isAdmin) {
    actionButtons += `
        <button onclick="Maintenance.deleteTicket(${t.id})" class="px-2.5 py-1.5 bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg hover:bg-red-600 hover:text-white text-xs lg:text-sm font-bold transition-colors" title="Hapus">Hapus</button>
    `;
}
```

Dan kolom Masalah:
```javascript
<td class="py-3 px-4 text-neutral-200 align-top cursor-pointer group" onclick="Maintenance.openDetailModal(${t.id})" title="Klik untuk melihat detail masalah">
    <div class="font-bold text-neutral-100 group-hover:text-white group-hover:underline transition-colors break-words leading-snug max-w-xs sm:max-w-sm lg:max-w-md">${t.judul}</div>
    ${t.deskripsi ? `<div class="text-[10px] lg:text-xs text-neutral-400 break-words mt-1 leading-relaxed">${t.deskripsi}</div>` : ''}
</td>
```

- [ ] **Step 2: Update `openUpdateModal(ticketId, currentStatus)`**

Isi info ringkasan masalah di modal update:
```javascript
const ticket = this.tickets.find(t => t.id === ticketId);
if (ticket) {
    const infoPC = document.getElementById('maint-update-info-pc');
    const infoKategori = document.getElementById('maint-update-info-kategori');
    const infoJudul = document.getElementById('maint-update-info-judul');
    const infoDeskripsi = document.getElementById('maint-update-info-deskripsi');
    if (infoPC) infoPC.innerText = ticket.pc_kode || 'PC';
    if (infoKategori) infoKategori.innerText = ticket.kategori || 'GENERAL';
    if (infoJudul) infoJudul.innerText = ticket.judul || '-';
    if (infoDeskripsi) infoDeskripsi.innerText = ticket.deskripsi || 'Tidak ada deskripsi tambahan.';
}
```

- [ ] **Step 3: Update `openDetailModal(ticketId)`**

Isi `#maint-detail-judul` dan format status badge:
```javascript
const elJudul = document.getElementById('maint-detail-judul');
if (elJudul) elJudul.innerText = ticket.judul || '-';
```

---

### Task 3: Consistency Update in `modules/laporan_maintenance/index.js`

**Files:**
- Modify: `app/static/js/kasir/modules/laporan_maintenance/index.js`

- [ ] **Step 1: Ensure wrapping on report table**

Pastikan kolom masalah di tabel riwayat perbaikan menggunakan `break-words leading-snug`.

---

### Task 4: Verification & Build

**Files:**
- Run test suite: `tests/`
- Build CSS: `npm run build:css`

- [ ] **Step 1: Run pytest**

Run: `.venv\Scripts\python -m pytest -q`
Expected: 42/42 tests pass.

- [ ] **Step 2: Run CSS build**

Run: `npm run build:css`
Expected: Success.

# Responsive Grid No-Scale (8 / 10 / 12 Kolom) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan responsive grid dashboard PC kasir tanpa CSS scaling (`transform: scale` dihapus) dengan penataan 8 kolom (LG), 10 kolom (XL), dan 12 kolom (2XL), dukungan pemecahan teks baris ke bawah (*multi-line auto-wrap*), serta penanganan horizontal scroll denah manual bertema *Chamber Noir*.

**Architecture:** 
- Auto-Sort Grid menggunakan pure native CSS Grid responsif (`repeat(8, minmax(0, 1fr))` di LG, `repeat(10, minmax(0, 1fr))` di XL, `repeat(12, minmax(0, 1fr))` di 2XL) yang mengalirkan kartu PC secara natural tanpa scroll samping.
- Manual Denah mempertahankan koordinat fisik meja warnet (`pos_x, pos_y`); bila jumlah kolom denah melebihi kapasitas layar saat ini (misal 12 kolom dibuka di layar LG 8 kolom), kontainer denah membungkus grid dalam scroll horizontal halus dengan custom scrollbar `.scrollbar-dashboard-grid` yang serasi dengan tema gelap TMBilling.
- Kartu PC menggunakan `break-words [overflow-wrap:anywhere] leading-tight` sehingga teks kode PC panjang seperti `ABCSDW-SDSA` otomatis turun ke baris ke-2 tanpa menabrak indikator status `●` atau terpotong.

**Tech Stack:** JavaScript (ES6), Tailwind CSS / Vanilla CSS, HTML5 Jinja2 Templates, Pytest.

**Spec:** [`docs/superpowers/specs/2026-09-27-responsive-grid-no-scale-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-09-27-responsive-grid-no-scale-design.md)

## Global Constraints
- Tidak menggunakan CSS `transform: scale()` pada layar desktop kasir.
- Jumlah kolom: LG = 8, XL = 10, 2XL = 12.
- Scrollbar horizontal denah bertema gelap *Chamber Noir* (track `#0a0a0a`, border `#1c1c1c`, thumb `#2f2f2f`, hover `#525252`, height 6px).
- **ATURAN WAJIB USER**: Jangan pernah melakukan `git commit` sampai pengguna secara eksplisit memberikan persetujuan ("*udah oke*").

---

### Task 1: Styling Scrollbar Horizontal Kustom (.scrollbar-dashboard-grid)

**Files:**
- Modify: `app/templates/kasir/base.html:20-45`
- Test: Manual visual check & browser inspector

**Interfaces:**
- Produces: CSS class `.scrollbar-dashboard-grid` yang dapat dipakai oleh kontainer overflow-x manual grid.

- [x] **Step 1: Daftarkan CSS .scrollbar-dashboard-grid di `base.html`**
Tambahkan deklarasi scrollbar kustom di blok `<style>` [base.html](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/base.html):
```css
/* Custom Sleek Horizontal Scrollbar untuk Denah Grid */
.scrollbar-dashboard-grid::-webkit-scrollbar {
    height: 6px;
}
.scrollbar-dashboard-grid::-webkit-scrollbar-track {
    background: #0a0a0a;
    border-radius: 4px;
    border: 1px solid #1a1a1a;
}
.scrollbar-dashboard-grid::-webkit-scrollbar-thumb {
    background: #2a2a2a;
    border-radius: 4px;
    border: 1px solid #171717;
}
.scrollbar-dashboard-grid::-webkit-scrollbar-thumb:hover {
    background: #444444;
}
```

- [x] **Step 2: Verifikasi styling terpanggil tanpa sintaks error**

---

### Task 2: Implementasi Kolom Responsif Auto-Sort (8 / 10 / 12) & Hapus CSS Scale

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js`

**Interfaces:**
- Produces: Responsive grid Auto-Sort (LG = 8, XL = 10, 2XL = 12) dan overflow-x wrapper untuk Manual Grid.

- [x] **Step 1: Update container Auto-Sort Grid pada `dashboard_compact.js`**
Ganti class pembungkus Auto-Sort Grid desktop:
```javascript
<!-- Auto-Sort Grid: 8 kolom di LG, 10 kolom di XL, 12 kolom di 2XL -->
<div class="auto-grid-wrapper w-full pt-1 pb-2 px-1 lg:px-1.5" style="transition: height 0.15s ease-out;">
    <div class="auto-grid-container grid gap-1.5 xl:gap-2 2xl:gap-2.5 auto-rows-fr p-0.5 grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12" data-cols="12">
        ${pcs.map(pc => `<div>${this.renderCompactCard(pc)}</div>`).join('')}
    </div>
</div>
```

- [x] **Step 2: Update container Manual Grid dengan Horizontal Scroll Chamber Noir**
Jika kolom denah lebih besar dari kapasitas layar yang sedang aktif, bungkus grid dalam container overflow-x:
```javascript
<!-- Manual Layout Grid: uses absolute pos_x / pos_y with custom Chamber Noir horizontal scroll if exceeding screen width -->
<div class="manual-grid-wrapper w-full pt-1 pb-2 px-1 lg:px-1.5 overflow-x-auto scrollbar-dashboard-grid" style="transition: height 0.15s ease-out;">
    <div class="manual-grid-container grid gap-1.5 xl:gap-2 2xl:gap-2.5 auto-rows-fr p-0.5" data-cols="${cols}" data-rows="${rows}" 
         style="grid-template-columns: repeat(${cols}, minmax(95px, 1fr)); grid-template-rows: repeat(${rows}, minmax(0, 1fr)); min-width: ${cols > 8 ? (cols * 102) + 'px' : '100%'};">
        ${mapped.map(pc => `
            <div style="grid-column: ${pc.pos_x + 1}; grid-row: ${pc.pos_y + 1};">
                ${this.renderCompactCard(pc)}
            </div>
        `).join('')}
    </div>
</div>
```

- [x] **Step 3: Hapus `adjustGridScale()` CSS transform downscale pada desktop**
Pada `adjustGridScale()`, pastikan pada desktop ($\ge 900$px atau mode no-scale), `transform: scale()` tidak diaplikasikan pada grid, membiarkan grid merender native fluid columns.

---

### Task 3: Pembebasan Row 1 untuk Kode PC, Penempatan AFK di Row 2 (Pola TERPUTUS), & Multi-Line Auto-Wrap

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js:150-205`

**Interfaces:**
- Produces: `renderCompactCard()` dengan Row 1 100% penuh untuk Kode PC (tanpa badge yang mendesak), AFK ditampilkan jelas di Row 2 seperti `⚠️ TERPUTUS`, dan mendukung pemecahan kata ke bawah.

- [x] **Step 1: Pindahkan AFK indicator dari Row 1 ke Row 2 (seperti TERPUTUS)**
Di `renderCompactCard()`:
- Hapus badge AFK dari Row 1 sehingga Kode PC tidak berdesakan dan tidak ter-truncate.
- Di Row 2: tampilkan `🔒 AFK / Istirahat` (atau `🔒 ${pc.active_window}`) dengan teks `text-amber-400 font-bold tracking-wide break-words line-clamp-1 leading-tight` persis seperti penanganan status `⚠️ TERPUTUS`.
```javascript
<!-- Row 1: Kode PC Penuh (Multi-line wrap support) - Inline Selection Checkmark - Status DOT -->
<div class="flex items-start justify-between gap-0.5 min-w-0 w-full leading-none">
    <div class="flex items-start gap-0.5 min-w-0 flex-1 overflow-hidden">
        <span class="selection-check-badge text-indigo-400 font-black text-[8.5px] lg:text-[9.5px] xl:text-[10px] shrink-0 mt-0.5 ${isSelected ? '' : 'hidden'}">✓</span>
        <span class="${kodeFontSizeClass} font-black text-neutral-100 tracking-tight break-words [overflow-wrap:anywhere] leading-tight min-w-0 flex-1">${pc.kode}</span>
    </div>
    <span class="w-1.5 h-1.5 lg:w-2 lg:h-2 xl:w-2.5 xl:h-2.5 rounded-full ${indicatorColorClass} shrink-0 bg-current mt-0.5"></span>
</div>
<!-- Row 2: Status AFK / Terputus / Active Window -->
<div class="text-[7.5px] lg:text-[8px] xl:text-[8.5px] 2xl:text-[10px] ${isAfk ? 'text-amber-400 font-bold tracking-wide' : 'text-neutral-400'} break-words [overflow-wrap:anywhere] line-clamp-1 w-full min-w-0 leading-tight" title="${activeAppName}">
    ${activeAppName}
</div>
```

- [x] **Step 2: Sesuaikan min-height kartu untuk proporsi seimbang**
Gunakan `min-h-[72px] lg:min-h-[76px] xl:min-h-[84px] 2xl:min-h-[96px]`.

---

### Task 4: Panduan Kompatibilitas Kolom di Modal Edit Denah

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/map_view.js:80-92`

**Interfaces:**
- Produces: Visual helper badge/hint saat admin menentukan jumlah kolom denah.

- [x] **Step 1: Tambahkan label bantuan kolom pada input `edit-cols` di `MapView.openEditor`**
Tambahkan badge kecil atau teks keterangan dinamis:
- Kolom 1–8: `8 Kolom (Universal LG/XL/2XL)`
- Kolom 9–10: `10 Kolom (Optimal XL/2XL)`
- Kolom 11–12: `12 Kolom (Optimal 2XL/Full HD, scroll pada LG)`

---

### Task 5: Pengujian Integrasi & Verifikasi Menyeluruh

**Files:**
- Test: `tests/test_afk_dashboard_integration.py`
- Run: Full test suite `pytest -q`

- [x] **Step 1: Jalankan pytest integration test**
Command: `.\.venv\Scripts\python -m pytest tests/test_afk_dashboard_integration.py -q`
Expected: PASS (1 passed).

- [x] **Step 2: Jalankan full pytest suite**
Command: `.\.venv\Scripts\python -m pytest -q`
Expected: PASS (246 passed).

- [x] **Step 3: Verifikasi responsivitas di browser**
Buka dashboard kasir di mode Auto-Sort dan Manual Denah, uji resize window:
- 1024px (LG): 8 kolom pas
- 1280px (XL): 10 kolom pas
- 1536px (2XL): 12 kolom pas
- Manual Denah 12 kolom pada layar 1024px: Scrollbar Chamber Noir aktif, semua PC dapat dijangkau, border kartu tidak terpotong.

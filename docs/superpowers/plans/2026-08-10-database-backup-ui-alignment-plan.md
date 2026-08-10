# Database & Backup UI/UX Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelaraskan seluruh tampilan visual, kartu, form input, tabel, tombol, dan modal pada subtab Database & Backup (`#subtab-backup`) agar 100% konsisten dengan desain modern TMBilling (seperti tab Paket, Shift, PC, Member).

**Architecture:** Meng-update template HTML `app/templates/kasir/tabs/settings.html` dan JavaScript handler `app/static/js/kasir/modules/settings/index.js` dengan token desain modern (`bg-[#111]`, `border-[#1f1f1f]`, `rounded-xl`, `bg-[#0a0a0a]`, `border-[#2a2a2a]`, `rounded-lg`), lalu mengompilasi ulang Tailwind CSS bundle.

**Tech Stack:** HTML5, Jinja2, Vanilla JS, Tailwind CSS, Python 3.13 / Flask.

## Global Constraints

- Card Container Utama: `bg-[#111] border border-[#1f1f1f] rounded-xl p-5 lg:p-6 space-y-6`
- Provider Box: `bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 space-y-4`
- Form Input & Select: `bg-[#050505] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-xs lg:text-sm text-neutral-200 focus:outline-none focus:border-neutral-500 font-medium`
- Primary Button: `px-4 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-sm font-bold rounded-lg transition-colors`
- Secondary Button: `px-3.5 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs lg:text-sm font-semibold rounded-lg transition-colors`
- Modal Dialog: `bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl animate-in`

---

### Task 1: Update `settings.html` `#subtab-backup` Card & Component Layout

**Files:**
- Modify: `app/templates/kasir/tabs/settings.html:440-695`

**Interfaces:**
- Consumes: Token Tailwind CSS modern TMBilling
- Produces: Komponen HTML `#subtab-backup` yang selaras 100% dengan tab Paket/Shift

- [ ] **Step 1: Edit `#subtab-backup` dalam `settings.html`**

Ubah styling `#subtab-backup` agar menggunakan:
- Main Cards: `bg-[#111] border border-[#1f1f1f] rounded-xl p-5 lg:p-6 space-y-6`
- Header Titles: `text-sm lg:text-[22px] font-bold text-neutral-100 tracking-wide`
- Subtitles: `text-[10px] lg:text-base text-neutral-500 mt-0.5`
- Provider Boxes (Discord, Nextcloud, GDrive, NAS): `bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 space-y-4`
- Provider Headings: `text-xs lg:text-sm font-bold text-neutral-200 uppercase tracking-wider`
- Provider Inputs: `bg-[#050505] border border-[#2a2a2a] rounded-lg px-3.5 py-2 text-xs lg:text-sm text-neutral-200`
- Provider Buttons: `rounded-lg`
- Table Headers: `border-b border-[#2a2a2a] text-neutral-400 text-xs uppercase font-bold tracking-wider`
- Table Rows: `border-b border-[#2a2a2a] hover:bg-[#171717] transition-colors`
- Maintenance Card: `bg-[#111] border border-[#1f1f1f] rounded-xl p-5 lg:p-6 space-y-6` dengan Judul `PEMBERSIHAN HISTORI DATABASE` dan subjudul ramah pengguna end-user.

- [ ] **Step 2: Commit perombakan HTML `#subtab-backup`**

```bash
git add app/templates/kasir/tabs/settings.html
git commit -m "style: update subtab-backup cards, inputs, buttons, and table to modern TMBilling design"
```

---

### Task 2: Update `settings/index.js` Modal Result Dialog Styling & Wording

**Files:**
- Modify: `app/static/js/kasir/modules/settings/index.js:410-495`

**Interfaces:**
- Consumes: Modal utility (`Modal.confirm`, `Modal.show`)
- Produces: Modal dialog pembersihan database dengan gaya modern `bg-[#111]` dan `rounded-lg`

- [ ] **Step 1: Edit `executeDbMaintenance` modal HTML dalam `settings/index.js`**

Pastikan modal hasil pembersihan menggunakan:
- Container: `bg-[#111] border border-[#2a2a2a] rounded-xl p-6 max-w-lg w-full shadow-2xl animate-in space-y-5`
- Header: `border-b border-[#2a2a2a] pb-4` dengan ikon centang hijau di dalam `w-11 h-11 bg-emerald-950/40 border border-emerald-900/50 rounded-lg flex items-center justify-center`
- Item rincian: `bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-xs lg:text-sm`
- Highlight box: `bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3.5 text-center font-bold text-xs lg:text-sm text-emerald-400`
- Button Selesai: `px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-sm font-bold rounded-lg transition-colors`

- [ ] **Step 2: Commit perombakan modal JS**

```bash
git add app/static/js/kasir/modules/settings/index.js
git commit -m "style: align database maintenance result modal to bg-[#111] rounded-xl modern style"
```

---

### Task 3: Build Tailwind CSS & Final Verification

**Files:**
- Modify: `app/static/css/tailwind.css`

- [ ] **Step 1: Kompilasi ulang Tailwind CSS bundle**

Run: `cmd.exe /c "npm run build:css"`
Expected: Rebuilding complete in ~600ms without errors.

- [ ] **Step 2: Uji coba Flask app**

Run: `C:\Users\lannnn\AppData\Local\Programs\Python\Python313\python.exe -c "from app import create_app; app = create_app(); print('App clean!')"`
Expected: App clean!

- [ ] **Step 3: Commit CSS bundle**

```bash
git add app/static/css/tailwind.css
git commit -m "build: recompile Tailwind CSS bundle for updated subtab backup UI"
```

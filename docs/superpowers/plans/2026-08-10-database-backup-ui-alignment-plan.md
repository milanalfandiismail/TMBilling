# Database & Backup UI/UX Alignment Implementation Plan (Berdasarkan "Umum & Kiosk")

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelaraskan 100% tampilan visual, font size responsif (`text-xs lg:text-[22px]`, `text-[9px] lg:text-base`), background `#0c0c0c`, border `#1c1c1c`, dan tombol `rounded` pada subtab Database & Backup (`#subtab-backup`) mengikuti standar resmi subtab **Umum & Kiosk** (`#subtab-general`).

**Architecture:** Meng-update template HTML `app/templates/kasir/tabs/settings.html` dengan token resmi `Umum & Kiosk`, lalu mengompilasi ulang Tailwind CSS.

**Tech Stack:** HTML5, Jinja2, Tailwind CSS, Python 3.13 / Flask.

## Global Constraints

- Card Container: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 space-y-6`
- Card Header Title: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider`
- Card Header Subtitle: `text-[9px] lg:text-base text-neutral-500 mt-1`
- Item Label / Title: `text-xs lg:text-[22px] text-neutral-400 uppercase font-bold tracking-wider`
- Item Description: `text-[9px] lg:text-base text-neutral-500 mt-1`
- Input & Select: `px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500`
- Primary Action Button: `px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded transition-colors`
- Secondary Button: `px-3 py-1.5 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 text-[10px] lg:text-xs font-semibold rounded transition-colors`

---

### Task 1: Update `settings.html` `#subtab-backup` Layout to Match "Umum & Kiosk" Token Standards

**Files:**
- Modify: `app/templates/kasir/tabs/settings.html:440-686`

**Interfaces:**
- Consumes: Token Tailwind CSS subtab-general
- Produces: Komponen HTML `#subtab-backup` yang 100% identik dengan `Umum & Kiosk`

- [ ] **Step 1: Edit `#subtab-backup` dalam `settings.html`**

Ubah elemen `#subtab-backup` agar menggunakan:
- Main Cards: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 space-y-6`
- Headers: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider` & `text-[9px] lg:text-base text-neutral-500 mt-1`
- Provider Boxes: `bg-[#050505] border border-[#1c1c1c] rounded p-4 space-y-4`
- Provider Headers: `text-xs lg:text-base font-bold text-neutral-200 uppercase tracking-wider`
- Provider Inputs: `px-3 py-2 bg-[#0c0c0c] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500`
- Provider Primary Buttons: `px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-black text-[10px] lg:text-xs font-bold rounded transition-colors`
- Provider Test Connection Buttons: `px-3 py-1.5 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 text-[10px] lg:text-xs font-semibold rounded transition-colors`
- Table Headers: `border-b border-[#1c1c1c] text-neutral-500 text-[10px] lg:text-xs uppercase font-bold`
- Table Rows: `border-b border-[#1c1c1c] hover:bg-[#070707] transition-colors`
- Table Cell Text: `text-neutral-300 text-xs lg:text-base font-mono`
- Maintenance Card: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 space-y-6`
- Maintenance Option Label: `text-xs lg:text-[22px] text-neutral-400 uppercase font-bold tracking-wider`
- Maintenance Description: `text-[9px] lg:text-base text-neutral-500 mt-1`
- Retention Select: `px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500`
- Backup & Bersihkan Button: `px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded transition-colors`

- [ ] **Step 2: Commit perombakan HTML `#subtab-backup`**

```bash
git add app/templates/kasir/tabs/settings.html
git commit -m "style: align subtab-backup cards, typography, inputs, and buttons to match Umum & Kiosk standard"
```

---

### Task 2: Recompile Tailwind CSS & Final Verification

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
git commit -m "build: recompile Tailwind CSS bundle for Umum & Kiosk aligned subtab backup UI"
```

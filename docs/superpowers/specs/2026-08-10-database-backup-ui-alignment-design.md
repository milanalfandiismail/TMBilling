# Spesifikasi Desain: Penyelarasan UI/UX Subtab Database & Backup Berdasarkan "Umum & Kiosk" (v1.5.2)

**Tanggal**: 2026-08-10  
**Tujuan**: Menyelaraskan seluruh komponen UI/UX, typography responsif, dan layout kartu pada subtab `Database & Backup` (`#subtab-backup`) agar **100% identik** dengan subtab `Umum & Kiosk` (`#subtab-general`).

---

## 1. Masalah & Target Penyelarasan
Subtab `Umum & Kiosk` (`#subtab-general`) adalah acuan standar UI/UX Settings di TMBilling yang memiliki font besar responsif (`text-xs lg:text-[22px]`, `text-[9px] lg:text-base`), background `#0c0c0c`, border `#1c1c1c`, dan tombol `rounded` halus.

Seluruh komponen di `#subtab-backup` akan diselaraskan persis mengikuti `Umum & Kiosk`.

---

## 2. Token Desain Resmi Subtab "Umum & Kiosk"

* **Card Container**: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 space-y-6`
* **Card Header Title**: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider`
* **Card Header Subtitle**: `text-[9px] lg:text-base text-neutral-500 mt-1`
* **Item Label / Title**: `text-xs lg:text-[22px] text-neutral-400 uppercase font-bold tracking-wider`
* **Item Description**: `text-[9px] lg:text-base text-neutral-500 mt-1`
* **Form Input & Select Box**: `px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500`
* **Primary Action Button**: `px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded transition-colors`
* **Secondary / Action Button**: `px-3 py-1.5 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 text-[10px] lg:text-xs font-semibold rounded transition-colors`
* **Child Provider Box**: `bg-[#050505] border border-[#1c1c1c] rounded p-4 space-y-4`
* **Table Header**: `border-b border-[#1c1c1c] text-neutral-500 text-[10px] lg:text-xs uppercase font-bold`
* **Table Cell**: `text-neutral-300 text-xs lg:text-base font-mono`

---

## 3. Rincian Penyesuaian Komponen

### A. Database & Cloud Backup Card Header
- Judul: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider`
- Subjudul: `text-[9px] lg:text-base text-neutral-500 mt-1` (Bahasa end-user)
- Tombol: `px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded transition-colors`

### B. Provider Cards (Discord, Nextcloud, GDrive, NAS)
- Container: `bg-[#050505] border border-[#1c1c1c] rounded p-4 space-y-4`
- Judul Provider: `text-xs lg:text-base font-bold text-neutral-200 uppercase tracking-wider`
- Label Input: `text-[10px] lg:text-xs text-neutral-500 uppercase font-semibold`
- Input: `px-3 py-2 bg-[#0c0c0c] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500`
- Tombol Simpan: `px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-black text-[10px] lg:text-xs font-bold rounded transition-colors`
- Tombol Test Connection: `px-3 py-1.5 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 text-[10px] lg:text-xs font-semibold rounded transition-colors`

### C. Tabel Berkas Cadangan Lokal
- Container Card: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 space-y-4`
- Judul: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider`
- Header Tabel: `border-b border-[#1c1c1c] text-neutral-500 text-[10px] lg:text-xs uppercase font-bold`
- Body Tabel: `text-neutral-300 text-xs lg:text-base font-mono`

### D. Pembersihan Histori Database Card (Admin Only)
- Container Card: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 space-y-6`
- Judul Card: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider`
- Label Opsi: `text-xs lg:text-[22px] text-neutral-400 uppercase font-bold tracking-wider`
- Deskripsi Opsi: `text-[9px] lg:text-base text-neutral-500 mt-1`
- Select Box: `px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500`
- Tombol Bersihkan: `px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded transition-colors`

---

## 4. Rencana Pengujian
1. Rebuild Tailwind CSS (`npm run build:css`).
2. Uji visual di tampilan desktop (layar besar `lg:`) & mobile untuk memastikan ukuran font responsif 100% identik dengan `Umum & Kiosk`.

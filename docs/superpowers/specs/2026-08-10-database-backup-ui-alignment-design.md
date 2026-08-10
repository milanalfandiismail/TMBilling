# Spesifikasi Desain: Penyelarasan UI/UX Subtab Database & Backup (v1.5.2)

**Tanggal**: 2026-08-10  
**Tujuan**: Menyelaraskan seluruh komponen UI/UX pada subtab `Database & Backup` (`#subtab-backup`), termasuk Provider Cards, Tabel Berkas Lokal, Card Pembersihan Database, dan Modal Dialog dengan sistem desain modern TMBilling (seperti tab Paket, Shift, PC, Member).

---

## 1. Masalah & Tantangan
Komponen subtab `#subtab-backup` saat ini masih menggunakan styling legacy (`bg-[#0c0c0c]`, `border-[#1c1c1c]`, tombol `rounded` siku, input yang terlalu kecil, dan struktur modal yang berbeda dengan tab modern). Hal ini menyebabkan ketidakselarasan visual saat pengguna berpindah tab.

---

## 2. Standar Sistem Desain Modern TMBilling
Seluruh komponen UI akan disesuaikan dengan token berikut:

* **Card Container Utama**: `bg-[#111] border border-[#1f1f1f] rounded-xl p-5 lg:p-6 space-y-6`
* **Child Card / Provider Box**: `bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 space-y-4`
* **Input Text / Number / Select**: `bg-[#050505] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-xs lg:text-sm text-neutral-200 focus:outline-none focus:border-neutral-500 font-medium`
* **Tombol Utama (Primary)**: `px-4 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-sm font-bold rounded-lg transition-colors`
* **Tombol Sekunder (Secondary)**: `px-3.5 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs lg:text-sm font-semibold rounded-lg transition-colors`
* **Tabel Headings**: `border-b border-[#2a2a2a] text-neutral-400 text-xs uppercase font-bold tracking-wider`
* **Modal Dialog**: `bg-[#111] border border-[#2a2a2a] rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-in`
* **Modal Header & Footer**: `px-6 py-5 border-b border-[#2a2a2a]` & `px-6 py-4 border-t border-[#2a2a2a]`

---

## 3. Rincian Perubahan Komponen

### A. Subtab `#subtab-backup` (`settings.html`)
1. **Card Header Database & Cloud Backup**:
   - Icon Box: `w-12 h-12 bg-[#171717] border border-[#262626] rounded-lg`
   - Judul: `text-sm lg:text-[22px] font-bold text-neutral-100 tracking-wide`
   - Subjudul: `text-[10px] lg:text-base text-neutral-500 mt-0.5` (Bahasa end-user)
   - Tombol Backup Sekarang: `rounded-lg`

2. **Provider Configuration Grid (Discord, Nextcloud, GDrive, NAS)**:
   - Container per provider: `bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 space-y-4`
   - Label & Input: Font size `text-xs lg:text-sm` dengan `rounded-lg`

3. **Card Tabel Berkas Cadangan Lokal**:
   - Header tabel & border row: `border-[#2a2a2a]`
   - Font size baris tabel: `text-xs lg:text-sm font-mono`

4. **Card Pembersihan Histori Database (Admin Only)**:
   - Container: `bg-[#111] border border-[#1f1f1f] rounded-xl p-5 lg:p-6 space-y-6`
   - Judul: `PEMBERSIHAN HISTORI DATABASE`
   - Subjudul: `Bersihkan riwayat transaksi & log bermain lama untuk menghemat penyimpanan server. Saldo member & data utama tetap aman 100%.`
   - Select Retention: `bg-[#050505] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-xs lg:text-sm`
   - Tombol Aksi: `Backup & Bersihkan Sekarang` (`rounded-lg`)

---

### B. Modal Dialog (`index.js` & `modal.js`)
1. **Modal Konfirmasi (`Modal.confirm`)**:
   - Menggunakan Bahasa End-User yang ramah tanpa istilah teknis (*SQLite, VACUUM, Purge*).
2. **Modal Hasil Pembersihan (`Modal.show`)**:
   - Container `bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl`
   - Rincian item menggunakan `bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-xs lg:text-sm`
   - Tombol Selesai `rounded-lg`

---

## 4. Rencana Pengujian (Verification Plan)
1. Rebuild Tailwind CSS (`npm run build:css`).
2. Uji visual dari browser/FE untuk memastikan seluruh card, input, tabel, tombol, dan modal tampil selaras dengan tab Paket/Shift.

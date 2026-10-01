# Spesifikasi Desain: Responsive Grid (8 / 10 / 12 Kolom) dengan Paged Slide Denah Manual, Helper Caption, Penyelarasan AFK & Perbaikan Security Remote Lock PIN

**Tanggal:** 27 September 2026  
**Status:** Siap Direview & Dieksekusi  
**Branch:** `v1.6.2`  

---

## 1. Latar Belakang & Kebutuhan Pengguna
Pengguna menetapkan spesifikasi yang jelas untuk tata letak grid dashboard kasir dan perbaikan alur keamanan kunci PC:
1. **Jumlah Kolom Terstandarisasi per Breakpoint (Auto-Sort & Denah Manual)**:
   - **`2xl` ($\ge 1536$px)**: Tepat **12 Kolom**
   - **`xl` ($\ge 1280$px)**: Tepat **10 Kolom**
   - **`lg` ($\ge 1024$px)**: Tepat **8 Kolom**
2. **Ukuran Kartu & Tipografi Asli Dipertahankan**:
   - Ukuran kartu asli (`min-h-[120px] lg:min-h-[125px]`, padding `p-2 sm:p-2.5`, dan ukuran font asli) **tidak boleh diubah atau diciutkan**.
3. **Penyelarasan Informasi AFK (Pola Status `⚠️ TERPUTUS`)**:
   - Di Baris 1, badge AFK di sebelah Kode PC dihilangkan sepenuhnya agar Kode PC mendapatkan 100% lebar kartu dan tidak terpotong (*no truncation*).
   - Status AFK ditampilkan di **Baris 2** (`🔒 AFK / Istirahat` atau `🔒 ${pc.active_window}`) dengan teks amber tebal, persis seperti penanganan status `⚠️ TERPUTUS`.
4. **Navigasi Paged Slide Denah Manual (Tanpa Scrollbar)**:
   - Skenario: Denah dibuat 12 kolom di monitor 2XL.
   - Ketika dibuka di monitor **`xl` (kapasitas 10 kolom)**:
     - Tampilan awal: menampilkan Kolom 1–10.
     - Klik panah kanan `▶`: bergeser mulus menampilkan Kolom 3–12.
     - Klik panah kiri `◀`: kembali menampilkan Kolom 1–10.
   - Ketika dibuka di monitor **`lg` (kapasitas 8 kolom)**:
     - Tampilan awal: menampilkan Kolom 1–8.
     - Klik panah kanan `▶`: bergeser mulus menampilkan Kolom 5–12.
   - Di monitor **`2xl` (kapasitas 12 kolom)**: Tombol navigasi slide tidak muncul karena semua kolom (1–12) pas 100%.
   - **Tanpa scrollbar**: Menggunakan `overflow: hidden` pada container pembungkus dan transisi horizontal geser (*sliding window*) yang bersih dan rapi.
5. **Helper Caption untuk End-User (Kasir/Operator)**:
   - Jika denah melebihi kapasitas layar saat ini (`cols > capacity`):
     - Ditampilkan helper caption/banner informatif di bawah header grup.
     - Contoh: `💡 Denah memiliki 12 kolom (layar saat ini menampilkan 10 kolom). Gunakan tombol panah [ ◀ ] [ ▶ ] untuk menggeser dan melihat kolom lainnya.`
     - Dilengkapi badge indikator status: `Menampilkan Kolom 1–10 dari 12`.
     - Memberikan kejelasan solutif bagi kasir agar tidak kebingungan mencari PC di kolom ujung.
6. **Perbaikan Security Remote AFK Lock Kasir & Validasi PIN Client**:
   - **Masalah Saat Ini**: Saat kasir melakukan remote lock AFK dari modal detail PC, tidak ada inputan PIN yang dikirimkan (`sesi.afk_pin = None`). Akibatnya di sisi client, saat user mengetikkan huruf apa saja secara acak, fallback `elif sesi.tipe == "guest" and not sesi.afk_pin: valid = True` membuat PC langsung terbuka (*boom langsung masuk*).
   - **Solusi**:
     - Modal Remote Lock di dashboard kasir mewajibkan kasir memasukkan 4-6 digit PIN unlock untuk PC tersebut.
     - Endpoint `/api/v1/kasir/monitor/remote/<pc_id>/afk-lock` menerima dan memvalidasi `pin`, lalu menyimpan hash PIN ke `sesi.afk_pin`.
     - Logika `ClientService.afk_unlock` memperbaiki fallback: Jika `sesi.afk_pin` ada, wajib memverifikasi hash PIN. Hapus `valid = True` fallback acak. Jika sesi tidak memiliki PIN, tolak pembukaan kunci selain lewat Master Unlock Kasir.

---

## 2. Arsitektur Teknis

### A. Penentuan Kapasitas Kolom Layar
Fungsi helper `_getScreenCapacity()`:
```javascript
_getScreenCapacity() {
    const w = window.innerWidth;
    if (w >= 1536) return 12; // 2xl
    if (w >= 1280) return 10; // xl
    if (w >= 1024) return 8;  // lg
    return 8; // fallback md / tablet
}
```

### B. Mode Auto-Sort Grid
- Menggunakan Tailwind Grid murni: `grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-2 auto-rows-fr p-1`.
- Kartu mengalir secara natural sesuai kapasitas layar:
  - Layar LG: 8 kolom per baris
  - Layar XL: 10 kolom per baris
  - Layar 2XL: 12 kolom per baris
- Baris baru terbentuk secara otomatis tanpa scaling down dan tanpa scrollbar.

### C. Mode Manual Denah dengan Paged Slide & Helper Caption
- State offset disimpan per grup: `CompactGrid._groupOffsets[grupKey] = offset || 0`.
- Jika jumlah kolom denah `cols > capacity`:
  - `maxOffset = cols - capacity` (misal di XL: $12 - 10 = 2$; di LG: $12 - 8 = 4$).
  - Lebar per kolom: `colWidth = (viewportWidth - (capacity - 1) * gap) / capacity`.
  - Total lebar grid: `(cols * colWidth) + ((cols - 1) * gap)`.
  - Posisi geser: `transform: translateX(-${offset * (colWidth + gap)}px)`.
  - **Kontrol Paginasi di Header Grup**:
    - Tombol `◀` (disabled jika offset == 0)
    - Teks indikator: `Kolom (1+offset) – (capacity+offset)`
    - Tombol `▶` (disabled jika offset >= maxOffset)
  - **Helper Caption Banner**:
    - Ditampilkan tepat di atas viewport denah:
      `💡 Denah memiliki ${cols} kolom (layar saat ini menampilkan ${capacity} kolom). Gunakan tombol panah [ ◀ ] [ ▶ ] untuk menggeser dan melihat kolom lainnya.`
- Jika `cols <= capacity`:
  - Kontrol slide dan helper caption disembunyikan.
  - Grid mengisi 100% lebar tanpa transform.

### D. Kartu PC: Dimensi & Penempatan AFK
- **Dimensi**: `min-h-[120px] lg:min-h-[125px] rounded-xl p-2 sm:p-2.5`
- **Baris 1**:
  - Selection checkmark `✓` (jika dipilih)
  - Kode PC: `font-black text-neutral-100 tracking-tight truncate flex-1` (leluasa tanpa badge pendesak)
  - Status Dot `●`: `w-2.5 h-2.5 rounded-full`
- **Baris 2**:
  - Jika Terputus: `⚠️ TERPUTUS` (`text-red-400 font-bold`)
  - Jika AFK: `🔒 AFK / Istirahat` atau `🔒 ${pc.active_window}` (`text-amber-400 font-bold`)
  - Jika Normal: `${pc.active_window || '-'}` (`text-neutral-400`)
- **Baris 3**:
  - Timer: font mono tebal
- **Baris 4**:
  - Nama Member / Guest

### E. Remote AFK Lock Modal & Verifikasi Kredensial
- **Kasir Modal (`remoteAfkLock`)**:
  - Menampilkan input dialog PIN (4-6 digit angka).
  - Mengirim payload `{ pin: pin }` ke `/api/v1/kasir/monitor/remote/<pc_id>/afk-lock`.
- **Backend Route (`trigger_remote_afk_lock`)**:
  - Memvalidasi format PIN (wajib 4-6 digit angka).
  - Menyimpan `sesi.afk_pin = generate_password_hash(pin)`.
  - Mengantrekan perintah `"afk_lock"` ke client PC.
- **Client Unlock (`ClientService.afk_unlock`)**:
  - Jika `sesi.afk_pin` tersimpan, verifikasi menggunakan `check_password_hash`.
  - Jika sesi guest tanpa PIN (legacy/anomali), `valid = False`, tolak unlock dengan acak karakter.

---

## 3. Rencana Pengujian
1. **Auto-Sort Test**:
   - Layar 1024px: Menampilkan 8 kolom per baris.
   - Layar 1280px: Menampilkan 10 kolom per baris.
   - Layar 1536px+: Menampilkan 12 kolom per baris.
2. **Denah Manual 12 Kolom Test**:
   - Di 2XL: Menampilkan 12 kolom penuh, navigasi panah & helper caption tersembunyi.
   - Di XL: Menampilkan kolom 1–10, helper caption muncul (`💡 Denah memiliki 12 kolom...`), tombol `▶` muncul. Klik `▶` $\rightarrow$ geser ke kolom 3–12. Klik `◀` $\rightarrow$ kembali ke 1–10.
   - Di LG: Menampilkan kolom 1–8, helper caption muncul, klik `▶` $\rightarrow$ geser ke kolom 5–12.
3. **AFK Display Test**:
   - Komputer dalam status AFK menampilkan `🔒 AFK / Istirahat` di Baris 2.
   - Kode PC di Baris 1 tidak terpotong.
4. **Security Remote Lock & Unlock Test**:
   - Kasir mengunci PC remote dengan PIN `5678`.
   - Client memasukkan sembarang huruf/PIN salah $\rightarrow$ Ditolak (HTTP 401).
   - Client memasukkan PIN tepat `5678` $\rightarrow$ Berhasil terbuka (HTTP 200).
   - Kasir dapat melakukan Master Unlock kapan saja.

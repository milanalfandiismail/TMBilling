# Spesifikasi Desain: Serah Terima Shift Dinamis & Proteksi Eksklusif Kasir (Anti-Fitnah)

## 1. Ringkasan Eksekutif
Dokumen ini mendefinisikan spesifikasi arsitektur dan teknis untuk menyempurnakan sistem Serah Terima Shift pada TMBilling dengan fokus utama:
1. **Laporan Serah Terima Metode Pembayaran Dinamis**: Menyesuaikan perhitungan omset dan laporan serah terima kasir dengan seluruh metode pembayaran yang dapat di-CRUD oleh pengguna (Tunai, QRIS, Transfer Bank, Debit, E-Wallet, dll.). Pemisahan ketat antara **Penerimaan Uang Tunai (Laci Fisik)** vs **Penerimaan Non-Tunai (Rekening / Settlement Digital)**.
2. **Proteksi Anti-Fitnah & Eksklusivitas Shift (Opsi A)**: Menjamin satu laci kasir fisik hanya dipertanggungjawabkan oleh satu kasir dalam satu waktu (*Single Active Shift System-wide*). Kasir lain **ditolak login** saat shift sedang berjalan. Kasir pemegang shift dapat melakukan re-login kapan saja **tanpa batasan waktu timeout**.
3. **Wajib Buka Shift Pra-Operasional**: Staf ber-role `kasir` wajib membuka shift sebelum dapat memproses transaksi billing maupun kantin. Role `admin` bebas dari pembatasan ini.
4. **Emergency Force Close oleh Admin**: Admin memiliki kontrol darurat di footer sidebar untuk menutup paksa shift kasir yang mangkir/berhalangan agar operasional warnet tidak terhenti.

---

## 2. Arsitektur & Logika Bisnis

### A. Rekapitulasi Metode Pembayaran Dinamis Tanpa Batas (100% Fleksibel CRUD)
TMBilling mendukung konfigurasi metode pembayaran dinamis yang dapat di-CRUD bebas oleh pemilik warnet melalui menu pengaturan (`payment_methods`, misalnya kasir/owner menambahkan `"Tunai, QRIS, Transfer Bank, Debit BCA, Alipay, Alibaba, GoPay, OVO"`). Transaksi di tabel `transaksi` dan `transaksi_menu` mencatat string metode pembayaran yang digunakan saat transaksi terjadi.

Sistem serah terima shift **TIDAK PERNAH melakukan hardcoding** terhadap nama metode non-tunai. Seluruh metode yang muncul dari hasil query database `GROUP BY metode_pembayaran` diperlakukan secara dinamis:

#### 1. Pengelompokan Pembayaran:
* **Kelompok Tunai (Fisik Masuk Laci)**:
  - Nilai metode: `"Tunai"`, `"Cash"`, atau `None`/kosong (default cash).
  - Merupakan satu-satunya uang yang secara fisik masuk ke dalam laci meja kasir.
  - $\text{Total Tunai Bersih} = \text{Billing Tunai} + \text{Kantin Tunai} - \text{Total Refund Tunai}$.
* **Kelompok Non-Tunai (Rekening / E-Wallet / Merchant Settlement)**:
  - Semua metode selain kelompok tunai—baik metode umum (QRIS, Transfer Bank) maupun metode kustom hasil CRUD pengguna (misal `"Alipay"`, `"Alibaba"`, `"ShopeePay"`, `"Dana"`, dsb.).
  - Uang langsung masuk ke saldo digital/rekening/portal masing-masing penyedia, tidak masuk ke laci kasir.
  - Sistem secara dinamis membuat daftar per metode pembayaran apa pun yang tercatat:
    $$\text{Total Metode } X = \text{Billing } X + \text{Kantin } X$$
  - Contoh: Jika ada transaksi via `Alipay` Rp 150.000 dan `Alibaba` Rp 200.000, laporan serah terima akan otomatis menampilkan baris:
    - `Alipay`: Billing Rp X, Kantin Rp Y $\rightarrow$ Total Rp 150.000
    - `Alibaba`: Billing Rp X, Kantin Rp Y $\rightarrow$ Total Rp 200.000
  - **Penanganan Nilai Nol**: Jika suatu metode pembayaran yang terdaftar di konfigurasi tidak memiliki transaksi sama sekali selama shift, sistem tetap menampilkannya dengan nilai **Rp 0** (bukan `null`, bukan `undefined`, dan bukan hilang), sehingga kasir/owner memiliki kepastian penuh bahwa memang tidak ada penerimaan pada metode tersebut.

#### 2. Rekonsiliasi & Hitung Buta (Blind Count):
* **Uang Fisik Seharusnya di Laci**:
  $$\text{Fisik Seharusnya} = \text{Modal Awal} + \text{Total Tunai Bersih}$$
* **Hitung Buta (Blind Count)**:
  - Kasir hanya memasukkan nominal uang fisik yang ada di laci saat shift berakhir tanpa diperlihatkan nominal kalkulasi sistem terlebih dahulu.
  - $\text{Selisih} = \text{Uang Fisik Aktual (Input)} - \text{Fisik Seharusnya}$.
  - Status selisih: `SURPLUS` ($> 0$), `SESUAI` ($= 0$), atau `DEFISIT` ($< 0$).

#### 3. Persistensi Data (`ShiftRecord`):
* Kolom baru `detail_metode_json` (Text / JSON): Menyimpan snapshot objek JSON dari rincian seluruh metode pembayaran saat shift ditutup, memastikan data audit permanen dan tidak terpengaruh jika transaksi historis dibersihkan.

---

### B. Proteksi Eksklusivitas Shift & Anti-Fitnah (Opsi A)

#### 1. Single Active Shift System-wide:
* Di tingkat sistem/cabang, hanya boleh ada **1 shift dengan status `AKTIF`**.
* `ShiftService.start_shift()` memeriksa: jika sudah ada shift berstatus `AKTIF` (oleh kasir mana pun), pembuatan shift baru ditolak dengan pesan:
  *"Tidak dapat membuka shift baru: Masih ada shift aktif oleh '{kasir.nama}' sejak {waktu}. Selesaikan shift terlebih dahulu."*

#### 2. Restriksi Login Kasir Web (`AuthKasirService.login`):
* Ketika user dengan `role == "kasir"` melakukan login di dashboard web:
  - Cek apakah terdapat shift dengan status `AKTIF` di sistem (`ShiftRecord.query.filter_by(status="AKTIF").first()`).
  - **Jika Ada Shift Aktif**:
    - **Kasir Pemegang Shift**: Login **DIIZINKAN** (re-login jika browser tertutup, logout sementara, atau berganti perangkat) **tanpa batasan waktu timeout**.
    - **Kasir Lain**: Login **DITOLAK (HTTP 403 Forbidden)** dengan pesan:
      *"Akses Ditolak: Shift kasir saat ini sedang aktif oleh '{kasir_aktif.nama_lengkap or kasir_aktif.username}' sejak {jam_mulai}. Kasir lain tidak dapat masuk sampai shift tersebut ditutup."*
  - **Jika Tidak Ada Shift Aktif**:
    - Kasir mana pun yang akunnya aktif dapat login. Setelah login, kasir diarahkan untuk **Buka Shift**.
* **Role Admin & Owner**:
  - **SELALU DIIZINKAN** login kapan saja tanpa terpengaruh ada atau tidaknya shift aktif.

#### 3. Wajib Buka Shift Sebelum Transaksi (Kasir Role Only):
* Helper / Decorator `shift_required` diterapkan pada endpoint transaksi operasional:
  - Billing PC: `/buka-guest`, `/buka-guest-batch`, `/buka-member`, `/tambah-waktu`, `/tambah-waktu-batch`, `/refund-paket`.
  - Kantin: `/api/v1/kasir/menu/checkout`.
* Aturan:
  - Jika request dilakukan oleh user dengan role `kasir` dan belum membuka shift (`ShiftService.get_active_shift(username)` bernilai `None`), request ditolak dengan HTTP `400 Bad Request`:
    `{"error": "Harap buka shift terlebih dahulu sebelum melayani transaksi."}`.
  - Jika request dilakukan oleh role `admin` atau via API key cabang, transaksi diperbolehkan tanpa shift.
* Frontend UI:
  - Jika kasir belum buka shift, tombol-tombol transaksi menampilkan peringatan / memicu modal Buka Shift otomatis.

#### 4. Emergency Force Close oleh Admin:
* Jika kasir pemegang shift berhalangan hadir mendadak, sakit, atau lupa menutup shift:
  - Admin/Owner dapat melakukan tutup paksa melalui tombol **`KELOLA / FORCE CLOSE SHIFT`** di footer sidebar.
  - Muncul modal informasi shift kasir aktif, nominal modal awal, ringkasan transaksi berjalan, input alasan penutupan paksa, dan konfirmasi.
  - Endpoint `POST /api/v1/kasir/shift/force-close` (khusus role `admin`):
    - Mengubah status shift menjadi `SELESAI`.
    - Menyimpan catatan: `[FORCE CLOSE oleh {admin}] {alasan}`.
    - Mencatat log audit `SHIFT_FORCE_CLOSE`.
    - Laci fisik langsung bebas dan kasir berikutnya dapat login & membuka shift baru.

---

## 3. Rincian Antarmuka Pengguna (UI/UX)

### A. Sidebar Footer (User Section)
Posisi: Tepat di atas tombol **Keluar (Logout)** pada `app/templates/kasir/components/sidebar.html`:
1. **Untuk Kasir**:
   - Belum buka shift: Card oranye/amber dengan tombol **`BUKA SHIFT KASIR`**.
   - Shift aktif: Card gelap dengan indikator hijau berdenyut, nama kasir, jam mulai, modal awal, dan tombol **`PERTUKARAN / SERAH TERIMA SHIFT`**.
2. **Untuk Admin**:
   - Jika tidak ada shift aktif: Badge abu-abu *"Tidak Ada Shift Kasir Aktif"*.
   - Jika ada shift kasir aktif: Card peringatan dengan teks *"Shift Aktif: {Nama Kasir} ({Jam Mulai})"* dan tombol oranye **`KELOLA / FORCE CLOSE SHIFT`**.

### B. Modal Rekap Digital Dinamis & Struk Thermal 58mm
1. **Modal Rekap Digital Lengkap**:
   - Bagian Penerimaan Tunai (Billing Tunai, Kantin Tunai, Refund Tunai).
   - Bagian Penerimaan Non-Tunai Dinamis (menampilkan seluruh metode non-tunai yang aktif digunakan dengan total masing-masing).
   - Bagian Rekonsiliasi Laci: Modal Awal + Total Tunai = Uang Seharusnya di Laci vs Uang Fisik Aktual (Blind Count) $\rightarrow$ Badge Selisih (SURPLUS / SESUAI / DEFISIT).
   - Tombol "Tutup" (paperless), "Cetak Struk HTML", dan "Cetak Thermal 58mm".
2. **Struk Thermal 58mm**:
   - Mencantumkan rincian metode pembayaran dinamis secara proporsional (32 kolom), uang seharusnya di laci, fisik laci, selisih, catatan kasir, dan kolom tanda tangan.

### C. Menu Manajemen Staff di Sidebar Admin
Sub-menu terstruktur di `sidebar_admin.html`:
1. **Akun Kasir & Admin** (`data-tab="user"`)
2. **Riwayat Serah Terima** (`data-tab="shift_history"`)
3. **Log & Audit Staf** (`data-tab="user_logs"`)

---

## 4. Validasi & Pengujian

### A. Validasi Dual-Layer:
- `modal_awal`: 0 s/d Rp 100.000.000.
- `uang_fisik`: 0 s/d Rp 100.000.000.
- `catatan`: maks. 255 karakter.
- `alasan_force_close`: 3 s/d 255 karakter.

### B. Cakupan Test Suite Otomatis:
- `test_shift_concurrency_login`: Kasir A aktif $\rightarrow$ Kasir A re-login sukses $\rightarrow$ Kasir B login ditolak 403 $\rightarrow$ Admin login sukses.
- `test_shift_mandatory_transaction`: Kasir belum buka shift $\rightarrow$ transaksi billing & kantin ditolak 400 $\rightarrow$ buka shift $\rightarrow$ transaksi sukses $\rightarrow$ admin transaksi tanpa shift sukses.
- `test_shift_dynamic_payment_breakdown`: Transaksi multi-metode (Tunai, QRIS, Transfer Bank, Custom) dikelompokkan dengan benar; saldo laci hanya menghitung tunai bersih.
- `test_shift_emergency_force_close`: Admin force close shift $\rightarrow$ shift selesai $\rightarrow$ log audit tercatat $\rightarrow$ Kasir B dapat login dan buka shift baru.

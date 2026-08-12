# Design Spec: Penyelamatan Gambar Tutorial Hanya Saat Selesai Simpan

**Tanggal**: 2026-08-12  
**Status**: Draft / Awaiting Approval  
**Sistem**: TMBilling Tutorial Module (Backend & Filesystem)

---

## 1. Ikhtisar Masalah & Solusi Desain

### A. Masalah: Gambar Yatim Piatu (Orphan Images)
- **Problem**: Saat Admin menulis tutorial di CKEditor dan mengunggah/menempelkan gambar, CKEditor langsung mengunggah berkas tersebut ke `app/static/assets/tutorials/` di server. Jika Admin membatalkan penulisan (klik Batal / menutup browser), gambar tersebut tetap tersimpan di server dan mengotori folder git.
- **Tujuan**: Hanya simpan gambar di folder proyek utama saat Admin benar-benar mengklik **Simpan** (menyelesaikan aksi tambah atau ubah).

### B. Solusi: Folder Sementara (`temp/`) & Pemindahan Otomatis
1. **Unggah Gambar via CKEditor**:
   - Gambar yang diunggah CKEditor akan disimpan sementara di folder:  
     `app/static/assets/tutorials/temp/`
   - URL yang dikembalikan ke editor adalah:  
     `/static/assets/tutorials/temp/{filename}`
   - Folder `temp/` akan ditambahkan ke `.gitignore` agar file sampah draf tidak masuk ke repositori.
2. **Saat Menyimpan Tutorial (Create/Update)**:
   - Backend memproses isi `content` tutorial dengan menganalisis tag HTML (menggunakan regex).
   - Menemukan pola URL `/static/assets/tutorials/temp/{filename}`.
   - Memindahkan berkas gambar terkait dari `temp/` ke folder permanen `app/static/assets/tutorials/`.
   - Mengubah referensi URL di dalam konten menjadi `/static/assets/tutorials/{filename}` sebelum disimpan ke database.

---

## 2. Rincian Implementasi Backend

### A. Upload Endpoint (`app/routes/tutorial/tutorial_routes.py`)
- Ubah direktori unggah gambar di `upload_tutorial_image` menjadi `app/static/assets/tutorials/temp/`.

### B. Service Handler (`app/services/tutorial/tutorial_service.py`)
- Buat fungsi penolong `move_temp_images(content)` untuk memindai regex, memindahkan berkas secara aman menggunakan `shutil.move`, dan mengganti URL konten.
- Hubungkan fungsi tersebut pada pemanggilan `TutorialService.create()` dan `TutorialService.update()`.

### C. Git Ignore (`.gitignore`)
- Tambahkan baris `app/static/assets/tutorials/temp/` untuk mengabaikan folder sementara tersebut.

---

## 3. Rencana Verifikasi

1. **Uji Upload CKEditor**:
   - Unggah gambar saat membuat panduan, verifikasi berkas masuk ke folder `temp/` dan belum ada di folder proyek utama.
2. **Uji Simpan Tutorial**:
   - Klik Simpan, verifikasi berkas gambar berpindah dari `temp/` ke `app/static/assets/tutorials/` dan konten database merujuk ke URL permanen.
3. **Uji Batal**:
   - Unggah gambar lalu klik Batal, verifikasi berkas tetap di `temp/` dan tidak dipindahkan ke folder permanen.

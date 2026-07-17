# Rencana Desain: Sistem Backup Multi-Provider TMBilling

Dokumen ini mendokumentasikan spesifikasi teknis dan rencana desain untuk memperluas sistem cadangan (*backup*) data SQLite pada TMBilling agar mendukung multilayanan cloud (Discord, WebDAV/Nextcloud, Google Drive, NAS).

---

## 📋 1. Rangkuman Pemahaman (Understanding Summary)
* **Tujuan**: Mencegah kehilangan data transaksi kasir dan billing warnet dengan mencadangkan database SQLite (`warnet.db`) secara otomatis ke berbagai platform cloud/penyimpanan eksternal.
* **Fitur Utama**:
  * **Kompresi ZIP Otomatis**: Semua backup dikompresi ke format `.zip` sebelum dikirim guna menghemat ruang dan memenuhi limit pengiriman berkas.
  * **Multi-Provider**: Mendukung pengunggahan simultan ke Discord Webhook, WebDAV (Nextcloud), Google Drive, dan folder jaringan lokal/NAS.
  * **Auto-Cleanup (FIFO)**: Mempertahankan maksimal 5 file cadangan terbaru di setiap platform penyimpanan (kecuali Discord).
  * **Dashboard GUI Kasir**: Pengaturan terpadu untuk Admin kasir guna mengaktifkan provider, menginput kredensial, melakukan "Test Connection", memicu backup manual secara instan, serta melihat dan mengunduh berkas cadangan lokal.
* **Target Pengguna**: Pemilik warnet dan Administrator sistem.
* **Non-Goals**: Tidak menyertakan enkripsi AES di tingkat berkas `.db`/`.zip` untuk saat ini.

---

## 🔑 2. Asumsi Teknis (Technical Assumptions)
1. Kredensial sensitif disimpan langsung dalam tabel database `settings` Flask.
2. Menu manajemen backup dilindungi oleh decorator `@admin_required` sehingga hanya akun dengan peran admin yang dapat mengaksesnya.
3. Ukuran database SQLite dalam bentuk terkompresi `.zip` diasumsikan tidak melebihi 24 MB untuk pengunggahan via Discord Webhook. Jika melebihi batas, Discord hanya akan dikirimkan notifikasi kegagalan pengunggahan berkas beserta pesan teks peringatan.

---

## 📝 3. Log Keputusan (Decision Log)

| Keputusan | Alternatif Dipertimbangkan | Mengapa Opsi Ini Dipilih |
| :--- | :--- | :--- |
| **Arsitektur Modular Adapter** | Skrip Subproses Mandiri | Lebih mudah ditambahkan provider baru di masa depan dan terintegrasi penuh secara asinkron dengan thread latar belakang Flask. |
| **Format Kompresi ZIP** | Pengunggahan file mentah `.db` | Mengurangi penggunaan kuota penyimpanan cloud hingga 80-90% dan mengamankan berkas di bawah batas limit unggah Discord (25MB). |
| **Batas Simpan FIFO (5 file)** | Tanpa batas / Backup tak terbatas | Menghindari konsumsi ruang penyimpanan cloud berlebih, terutama untuk akun cloud gratis (Google Drive / Nextcloud). |
| **Penyimpanan di Tabel `settings`** | Menyimpan di file `.env` | Memungkinkan Admin mengubah Webhook URL / password WebDAV langsung dari dashboard kasir tanpa perlu melakukan restart server Flask. |

---

## 🏛️ 4. Desain Detail Sistem (Final Design)

### A. Struktur Kelas Provider (`app/services/backup/providers.py`)
Menggunakan Strategy Pattern dengan *Base class* as abstrak:

```python
import os
import zipfile
from abc import ABC, abstractmethod

class BaseBackupProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def upload(self, file_path: str) -> bool:
        """Mengunggah berkas zip database ke cloud."""
        pass

    @abstractmethod
    def test_connection(self) -> bool:
        """Mengirim file dummy untuk menguji koneksi."""
        pass

    @abstractmethod
    def cleanup(self, max_keep: int = 5):
        """Menghapus berkas tertua ke-6 di cloud."""
        pass
```

### B. Daftar Provider yang Diimplementasikan
1. **DiscordWebhookProvider**: Menggunakan pustaka standard `urllib` atau `requests` untuk mengirimkan payload berkas via POST multipart ke URL Webhook Discord.
2. **WebDAVProvider (Nextcloud)**: Mengirimkan berkas menggunakan HTTP PUT ke URL WebDAV Nextcloud.
3. **GoogleDriveProvider**: Menggunakan API Google Drive untuk otentikasi OAuth2 dan mengunggah berkas ke Folder ID yang ditentukan.
4. **NASProvider (Local Network)**: Menyalin berkas secara lokal menggunakan `shutil.copy2` ke path jaringan bersama (UNC Path seperti `\\192.168.1.100\Backup`).

### C. Alur API Endpoints (`app/routes/backup_routes.py`)
* `GET /api/backup/list` : Mengembalikan daftar berkas cadangan lokal beserta ukuran dan waktu modifikasinya.
* `POST /api/backup/trigger` : Memicu proses backup instan secara asinkron.
* `POST /api/backup/test-connection` : Menerima kredensial sementara untuk salah satu provider dan menguji unggahan berkas dummy.
* `GET /api/backup/download/<filename>` : Mengunduh berkas backup tertentu dari server lokal.
* `PUT /api/backup/config` : Menyimpan konfigurasi backup ke tabel `settings`.

---
*TMBilling v1.4.4*

# Design Specification: Dynamic Documentation & Tutorial Manager (CMS) with Local CKEditor 5

> **Date:** 2026-08-11  
> **Status:** Draft - Pending User Approval  
> **Author:** Antigravity AI & User  

---

## 1. Overview & Goals

Modul **Dynamic Documentation & Tutorial Manager** memberikan kemampuan kepada Admin TMBilling untuk menambah, mengedit, mengurutkan, dan menghapus panduan sistem secara dinamis langsung dari dashboard web.

### Fitur Utama:
- **Zero External Dependencies / Offline Ready**: CKEditor 5 (Classic Build) disimpan secara lokal di `app/static/vendor/ckeditor/ckeditor.js` sehingga 100% berfungsi tanpa koneksi internet di jaringan LAN warnet.
- **Dynamic Content Storage**: Panduan disimpan di tabel SQLite `system_tutorials`.
- **Integrated Combined Guide (Seed Initial Data)**: Menyediakan panduan gabungan lengkap setup **Cloudflare Tunnel + TightVNC Remote Desktop + WebSocket Routing (`ws/vnc` -> 8081)** yang diambil dari `PANDUAN_TIGHTVNC.md` dan `docs/FEATURE_CLOUDFLARE_TUNNEL.md`.

---

## 2. Architecture & Components

```
[Admin Web UI]
   │
   ├──> View Tutorials (HTML rendered from SQLite)
   ├──> Add/Edit Modal (CKEditor 5 Classic - Local Asset)
   │
   ▼
[Tutorial Routes: /api/v1/kasir/tutorials]
   │
   ▼
[Tutorial Service: TutorialService]
   │
   ▼
[Tutorial Repository: TutorialRepository]
   │
   ▼
[SQLite Table: system_tutorials]
```

### 2.1 Storage & Local Assets
- **Local CKEditor Asset**: `app/static/vendor/ckeditor/ckeditor.js`
- **Database Model**: `SystemTutorial` (`app/models/tutorial/tutorial_model.py`)
  - `id`: Integer Primary Key
  - `title`: String(255), Not Null (Judul Header Panduan)
  - `icon`: String(50), Default `"🌐"` (Ikon Emoji)
  - `category`: String(50), Default `"Umum"` (`Cloudflare`, `VNC`, `Jaringan`, `Umum`)
  - `content`: Text (Formatted HTML output dari CKEditor 5)
  - `urutan`: Integer, Default `0`
  - `created_at`: DateTime
  - `updated_at`: DateTime

---

## 3. Seed Initial Data (Combined Setup Guide)

Saat aplikasi pertama kali dinyalakan, database di-seed secara otomatis dengan 2 panduan utama:

### Panduan 1: 🌐 Setup Lengkap Cloudflare Tunnel & Remote VNC (Websockify Route)
Isi HTML menggabungkan:
1. **Instalasi TightVNC Server** & Opsi *Allow Loopback Connections*.
2. **Instalasi websockify proxy**: `pip install websockify`.
3. **Pembuatan Named Tunnel** di Cloudflare Zero Trust.
4. **Published Application Routes (Wajib Sesuai Urutan)**:
   - **Route #1 (Bagian Atas)**: Path `ws/vnc` -> `HTTP` -> `http://localhost:8081` (Port Proxy VNC WebSocket)
   - **Route #2 (Bagian Bawah)**: Path `*` -> `HTTP` -> `http://localhost:5000` (Port Dashboard TMBilling)
5. **Aktivasi Token `eyJh...`** di Pengaturan TMBilling.

### Panduan 2: 📡 Remote Desktop LAN via Tailscale / ZeroTier (Alternative)
Panduan setup VPN Mesh tanpa perlu domain HTTPS/reverse proxy.

---

## 4. API Endpoints (`app/routes/tutorial/tutorial_routes.py`)

- `GET /api/v1/kasir/tutorials` — Publik/Kasir (Mendapatkan list panduan aktif diurutkan berdasar `urutan`).
- `POST /api/v1/kasir/tutorials` — `@admin_required` (Membuat panduan baru).
- `PUT /api/v1/kasir/tutorials/<id>` — `@admin_required` (Memperbarui panduan).
- `DELETE /api/v1/kasir/tutorials/<id>` — `@admin_required` (Menghapus panduan).

---

## 5. UI/UX Workflow

1. Sub-tab baru **📚 Dokumentasi & Tutorial** di menu Pengaturan / Sidebar.
2. Di layar utama: Tampilan card panduan per kategori dengan filter tabs (Semua, Cloudflare & VNC, Jaringan, Umum).
3. Untuk Admin:
   - Tombol **`➕ Tambah Panduan`** di kanan atas.
   - Tombol **`✏️ Edit`** & **`🗑️ Hapus`** di masing-masing Card Panduan.
   - Modal Editor `#modal-tutorial-editor` memuat instance CKEditor 5 lokal.
   - Tombol **Simpan** mengirim data HTML via API dan memperbarui tampilan secara live.

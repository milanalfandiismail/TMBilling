# Smart Tutorial Seeding via JSON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memindahkan data tutorial bawaan dari hardcoded Python list ke file JSON eksternal, lalu mengubah logika seeding agar melakukan pengecekan berbasis judul — tutorial baru dari JSON ditambahkan otomatis tanpa menimpa tutorial yang sudah dimodifikasi atau ditambah klien.

**Architecture:** File JSON (`app/data/seed_tutorials.json`) menjadi satu-satunya sumber kebenaran (source of truth) untuk tutorial default bawaan. Saat aplikasi bootstrap, `TutorialService.seed_initial_tutorials()` membaca JSON tersebut dan membandingkan setiap judul tutorial dengan database — hanya tutorial yang judulnya belum ada di database yang akan dimasukkan. Gambar tutorial bawaan disimpan di `app/static/assets/tutorials/` dan di-commit ke git agar ikut terdistribusikan.

**Tech Stack:** Python, Flask, SQLAlchemy, JSON

## Global Constraints

- Tidak menambah dependency baru.
- File JSON harus valid dan menggunakan encoding UTF-8.
- Tidak mengubah skema database (model `SystemTutorial` tetap sama).
- Behavior existing CRUD (tambah, ubah, hapus tutorial oleh Admin) tidak boleh terganggu.
- Commit message dalam Bahasa Indonesia.

---

### Task 1: Buat File JSON Seed Tutorial Default

**Files:**
- Create: `app/data/seed_tutorials.json`

**Interfaces:**
- Consumes: Tidak ada (task pertama).
- Produces: File JSON berisi array objek tutorial dengan field `title`, `icon`, `category`, `urutan`, `content`. File ini akan dikonsumsi oleh Task 2.

- [ ] **Step 1: Buat file `app/data/seed_tutorials.json`**

Pindahkan isi array `INITIAL_SEED_TUTORIALS` dari `tutorial_service.py` ke dalam file JSON baru. Struktur file:

```json
[
  {
    "title": "Panduan Setup Cloudflare Tunnel & Remote VNC (Websockify)",
    "icon": "🌐",
    "category": "Cloudflare & VNC",
    "urutan": 1,
    "content": "<h3>1. Instalasi TightVNC Server</h3>..."
  },
  {
    "title": "Panduan Remote Desktop LAN via Tailscale / ZeroTier (Tanpa Tunnel Domain)",
    "icon": "📡",
    "category": "Jaringan",
    "urutan": 2,
    "content": "<h3>Cara Kerja Remote LAN via Mesh VPN</h3>..."
  }
]
```

> **Catatan:** Salin isi `content` HTML persis dari Python list yang ada sekarang, termasuk tag HTML lengkap. Pastikan file valid JSON (escape karakter `"` dan `\n` dengan benar).

- [ ] **Step 2: Verifikasi file JSON valid**

Run: `python -c "import json; json.load(open('app/data/seed_tutorials.json', encoding='utf-8')); print('JSON valid!')"`

Expected: Output `JSON valid!`

- [ ] **Step 3: Commit**

```bash
git add app/data/seed_tutorials.json
git commit -m "fitur: tambah file JSON seed tutorial default"
```

---

### Task 2: Refactor TutorialService untuk Membaca JSON dan Seeding Berbasis Judul

**Files:**
- Modify: `app/services/tutorial/tutorial_service.py`

**Interfaces:**
- Consumes: File `app/data/seed_tutorials.json` (dari Task 1).
- Produces: Method `TutorialService.seed_initial_tutorials()` yang diperbarui dengan logika smart seeding berbasis judul.

- [ ] **Step 1: Hapus array `INITIAL_SEED_TUTORIALS` dan tambah fungsi pembaca JSON**

Hapus seluruh blok `INITIAL_SEED_TUTORIALS = [...]` (baris 11-91) dari file dan ganti dengan fungsi `_load_seed_data()`:

```python
import json

def _load_seed_data():
    """Membaca data seed tutorial dari file JSON."""
    json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data', 'seed_tutorials.json')
    json_path = os.path.normpath(json_path)
    if not os.path.exists(json_path):
        logger.warning(f"[TutorialService] File seed JSON tidak ditemukan: {json_path}")
        return []
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)
```

- [ ] **Step 2: Ubah `seed_initial_tutorials()` menjadi smart seeding berbasis judul**

Ganti implementasi `seed_initial_tutorials()` dengan logika berikut:

```python
@staticmethod
def seed_initial_tutorials():
    """Seed tutorial default dari JSON — hanya menambahkan tutorial yang judulnya belum ada di database."""
    try:
        seed_data = _load_seed_data()
        if not seed_data:
            return

        existing_titles = {t.title for t in TutorialRepository.get_all()}
        added = 0
        for item in seed_data:
            if item.get("title") and item["title"] not in existing_titles:
                TutorialRepository.create(item)
                added += 1

        if added:
            logger.info(f"[TutorialService] Berhasil menambahkan {added} tutorial baru dari seed JSON.")
        else:
            logger.info("[TutorialService] Tidak ada tutorial baru untuk di-seed.")
    except Exception as e:
        logger.warning(f"[TutorialService] Gagal melakukan seeding tutorial: {e}")
```

- [ ] **Step 3: Verifikasi Flask app factory boots cleanly**

Run: `python -c "from app import create_app; create_app(); print('OK')"`

Expected: Output `OK`

- [ ] **Step 4: Commit**

```bash
git add app/services/tutorial/tutorial_service.py
git commit -m "fitur: refaktor seeding tutorial dari JSON dengan logika smart berbasis judul"
```

---

## Skenario Penggunaan

### Instalasi Baru (DB Kosong)
1. App bootstrap → `seed_initial_tutorials()` membaca JSON.
2. Semua tutorial dari JSON dimasukkan ke database karena belum ada satupun.

### Update Versi (Misal v1.5.2 → v1.6.0, Ada 200 Tutorial Baru di JSON)
1. Developer menambahkan 200 entri baru ke `seed_tutorials.json`.
2. App bootstrap → `seed_initial_tutorials()` membaca JSON.
3. Hanya tutorial dengan judul yang **belum ada** di database yang akan ditambahkan.
4. Tutorial yang sudah dimodifikasi klien tetap utuh (tidak ditimpa).

### Klien Tambah Tutorial Sendiri
1. Klien menambah tutorial kustom via CKEditor.
2. Tutorial kustom klien tidak terdampak oleh seeding karena seeding hanya menambahkan tutorial yang judulnya belum ada.

## Verification Plan

### Automated Tests
- `python -c "import json; json.load(open('app/data/seed_tutorials.json', encoding='utf-8')); print('JSON valid!')"`
- `python -c "from app import create_app; create_app(); print('OK')"`

### Manual Verification
- Pastikan setelah bootstrap, tutorial dari JSON muncul di halaman dokumentasi.
- Pastikan menambah entri baru ke JSON dan restart app menghasilkan tutorial baru di database tanpa mengganggu yang sudah ada.

# Superpowers Implementation Plan: Pembuatan Utility Script Ekspor Tutorial ke JSON

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat script utilitas `scripts/export_tutorials.py` untuk mengekspor data database tutorial ke file `app/data/seed_tutorials.json` secara rapi dan menghapus script sementara di root.

**Architecture:** Script Python diletakkan di bawah folder `scripts/` dan dijalankan dari root project agar path database/app import tetap berfungsi.

**Tech Stack:** Python, Flask App Context, JSON

## Global Constraints

- Script diletakkan di `scripts/export_tutorials.py`.
- Tidak boleh ada file sisa/sementara di root project.
- Commit message dalam Bahasa Indonesia.

---

### Task 1: Buat Script Utility di Folder scripts dan Bersihkan Root

**Files:**
- Create: `scripts/export_tutorials.py`
- Delete: `export_tutorials.py`

**Interfaces:**
- Consumes: Database table `SystemTutorial`.
- Produces: File `app/data/seed_tutorials.json`.

- [ ] **Step 1: Hapus file `export_tutorials.py` di root**

Hapus file sementara `export_tutorials.py` yang sebelumnya dibuat di root.

- [ ] **Step 2: Buat file `scripts/export_tutorials.py`**

Tulis script Python dengan logika ekspor database di `scripts/export_tutorials.py`:

```python
"""Script utility untuk mengekspor data tutorial dari database ke file seed_tutorials.json.

Usage:
    python scripts/export_tutorials.py
"""

import os
import sys
import json

# Tambahkan root path ke sys.path agar app import terdeteksi
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models import SystemTutorial

# Inisialisasi app context Flask
app = create_app()

def export_tutorials():
    with app.app_context():
        print("[INFO] Memulai ekspor data tutorial dari database...")
        
        # Ambil semua data tutorial terurut
        tutorials = SystemTutorial.query.order_by(SystemTutorial.urutan.asc(), SystemTutorial.id.asc()).all()
        
        if not tutorials:
            print("[WARN] Tidak ada tutorial ditemukan di database untuk diekspor.")
            return

        export_data = []
        for t in tutorials:
            export_data.append({
                "title": t.title,
                "icon": t.icon,
                "category": t.category,
                "urutan": t.urutan,
                "content": t.content
            })
            
        # Tentukan path file tujuan
        target_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app', 'data')
        os.makedirs(target_dir, exist_ok=True)
        target_path = os.path.join(target_dir, 'seed_tutorials.json')
        
        # Simpan ke file JSON
        with open(target_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
            
        print(f"[OK] Berhasil mengekspor {len(export_data)} tutorial ke: {target_path}")

if __name__ == '__main__':
    export_tutorials()
```

- [ ] **Step 3: Uji eksekusi script**

Run: `python scripts/export_tutorials.py`

Expected: Output `[OK] Berhasil mengekspor 3 tutorial ke: ...app/data/seed_tutorials.json`

- [ ] **Step 4: Commit**

```bash
git add scripts/export_tutorials.py app/data/seed_tutorials.json
git rm export_tutorials.py
git commit -m "fitur: buat script export_tutorials.py di dalam folder scripts dan bersihkan root"
```

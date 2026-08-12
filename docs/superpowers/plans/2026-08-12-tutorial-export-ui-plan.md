# Superpowers Implementation Plan: Integrasi Fitur Ekspor Tutorial ke JSON di UI Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat endpoint `/export-json` di backend, mengintegrasikannya dengan tombol baru di UI Admin halaman dokumentasi, dan menghapus script sementara di root.

**Architecture:** Memanfaatkan framework Flask untuk menyediakan endpoint POST yang memicu penulisan file JSON di backend, dan mengintegrasikannya dengan JavaScript frontend untuk memicu request dan menampilkan visual feedback (toast).

**Tech Stack:** HTML, Tailwind CSS, JavaScript (Vanilla), Flask, Python

## Global Constraints

- Aksi ekspor hanya boleh diakses oleh pengguna dengan role `admin`.
- File sementara `export_tutorials.py` di root harus dihapus.
- Menampilkan toast notifikasi setelah proses ekspor selesai.
- Commit message dalam Bahasa Indonesia.

---

### Task 1: Hapus File Sementara di Root
- **Delete**: `export_tutorials.py`

- [ ] **Step 1: Hapus file `export_tutorials.py` di root**

Hapus file sementara `export_tutorials.py` dari root project directory.

- [ ] **Step 2: Commit**

```bash
git rm export_tutorials.py
git commit -m "refaktor: hapus script ekspor sementara di root"
```

---

### Task 2: Implementasi Backend (Service & Route)
- **Modify**: `app/services/tutorial/tutorial_service.py`
- **Modify**: `app/routes/tutorial/tutorial_routes.py`

- [ ] **Step 1: Tambahkan method `export_to_json()` di `TutorialService`**

Tulis method di `app/services/tutorial/tutorial_service.py`:

```python
    @staticmethod
    def export_to_json():
        """Mengekspor seluruh tutorial dari database ke app/data/seed_tutorials.json."""
        tutorials = TutorialRepository.get_all()
        export_data = []
        for t in tutorials:
            export_data.append({
                "title": t.title,
                "icon": t.icon,
                "category": t.category,
                "urutan": t.urutan,
                "content": t.content
            })
            
        target_dir = os.path.join(current_app.root_path, 'data')
        os.makedirs(target_dir, exist_ok=True)
        target_path = os.path.join(target_dir, 'seed_tutorials.json')
        
        with open(target_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
            
        return len(export_data)
```

- [ ] **Step 2: Tambahkan API Route `/export-json` di `app/routes/tutorial/tutorial_routes.py`**

Tulis route di `app/routes/tutorial/tutorial_routes.py`:

```python
@tutorial_api_bp.route("/export-json", methods=["POST"], strict_slashes=False)
@login_required
@admin_required
def export_tutorials_json():
    """POST — Ekspor seluruh tutorial dari database ke file seed JSON (Khusus Admin)."""
    try:
        count = TutorialService.export_to_json()
        return jsonify({
            "success": True,
            "message": f"Berhasil mengekspor {count} tutorial ke JSON",
            "count": count
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 3: Verifikasi Flask app factory**

Run: `python -c "from app import create_app; create_app(); print('App Factory OK!')"`

Expected: Output `App Factory OK!`

- [ ] **Step 4: Commit**

```bash
git add app/services/tutorial/tutorial_service.py app/routes/tutorial/tutorial_routes.py
git commit -m "fitur: tambah API endpoint export-json untuk admin"
```

---

### Task 3: Implementasi Frontend (UI & JS)
- **Modify**: `app/templates/kasir/documentation.html`
- **Modify**: `app/static/js/kasir/modules/tutorials/index.js`

- [ ] **Step 1: Tambahkan tombol "Ekspor ke JSON" di `app/templates/kasir/documentation.html`**

Cari tombol `Tambah Panduan Baru` di `app/templates/kasir/documentation.html`, lalu sisipkan tombol baru sebelum/sesudah tombol tersebut:

```html
            {% if session.get('kasir_role') == 'admin' %}
            <button onclick="Tutorials.exportTutorialsToJson()"
                class="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs lg:text-base font-bold rounded-lg transition-all shrink-0 flex items-center gap-2 border border-[#262626] shadow">
                <span>📥</span> Ekspor ke JSON
            </button>
            <button onclick="Tutorials.openTutorialModal()"
                class="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded-lg transition-all shrink-0 flex items-center gap-2 shadow">
                <span>➕</span> Tambah Panduan Baru
            </button>
            {% endif %}
```

- [ ] **Step 2: Tambahkan fungsi handler JS `exportTutorialsToJson` di `app/static/js/kasir/modules/tutorials/index.js`**

Tulis fungsi berikut di dalam objek `Tutorials` di JS:

```javascript
    async exportTutorialsToJson() {
        if (!confirm('Apakah Anda yakin ingin mengekspor seluruh tutorial saat ini ke seed_tutorials.json?')) {
            return;
        }
        try {
            const res = await API.request('/api/v1/kasir/tutorials/export-json', {
                method: 'POST'
            });
            if (res.success) {
                showToast(`Sukses: ${res.message || 'Tutorial berhasil diekspor!'}`, 'success');
            } else {
                showToast(`Gagal: ${res.error || 'Gagal mengekspor tutorial'}`, 'error');
            }
        } catch (e) {
            console.error('Error export tutorials:', e);
            showToast('Terjadi kesalahan sistem saat mengekspor tutorial.', 'error');
        }
    },
```

- [ ] **Step 3: Jalankan CSS compilation**

Run: `npm run build:css`

Expected: CSS compile completed successfully.

- [ ] **Step 4: Commit**

```bash
git add app/templates/kasir/documentation.html app/static/js/kasir/modules/tutorials/index.js app/static/css/tailwind.css
git commit -m "fitur: integrasikan tombol ekspor JSON di UI Dokumentasi Admin"
```

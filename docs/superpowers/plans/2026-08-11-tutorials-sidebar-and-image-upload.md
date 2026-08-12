# Main Sidebar Tutorial Tab & CKEditor 5 Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Tutorial & Documentation Manager to a standalone main tab at the bottom of the main sidebar (`#tab-tutorials`), refine UI/UX consistency, and add CKEditor 5 image upload support.

**Architecture:** Create a separate main template `app/templates/kasir/tabs/tutorials.html`, add image upload endpoint `POST /api/v1/kasir/tutorials/upload-image` in `tutorial_routes.py`, update sidebar navigation, and integrate a custom upload adapter in CKEditor 5.

**Tech Stack:** Python 3.13, Flask, CKEditor 5 Classic, Vanilla JS, Tailwind CSS.

## Global Constraints

- **Main Sidebar Placement:** Must be a direct main tab item at the bottom of `sidebar.html` (`data-tab="tutorials"`).
- **Offline Image Uploads:** Uploaded images MUST be stored locally in `app/static/uploads/tutorials/` without external CDN.
- **Centralized Exports:** Keep module exports clean and consistent.
- **No Automatic Git Push:** Commit locally in Bahasa Indonesia; do not push without user consent.

---

### Task 1: Backend Image Upload Endpoint (`tutorial_routes.py`)

**Files:**
- Modify: `app/routes/tutorial/tutorial_routes.py`

- [ ] **Step 1: Add `upload_tutorial_image` route to `tutorial_routes.py`**

Implement `POST /api/v1/kasir/tutorials/upload-image`:
```python
import os
import uuid
from werkzeug.utils import secure_filename
from flask import current_app

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@tutorial_api_bp.route("/upload-image", methods=["POST"], strict_slashes=False)
@login_required
@admin_required
def upload_tutorial_image():
    if 'upload' not in request.files and 'file' not in request.files:
        return jsonify({"error": "Tidak ada file gambar yang diunggah"}), 400
    
    file = request.files.get('upload') or request.files.get('file')
    if not file or file.filename == '':
        return jsonify({"error": "File gambar tidak valid"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Format file tidak didukung (.png, .jpg, .jpeg, .webp, .gif)"}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    upload_dir = os.path.join(current_app.root_path, 'static', 'assets', 'tutorials')
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)
    file.save(file_path)

    url = f"/static/assets/tutorials/{filename}"
    return jsonify({"url": url, "uploaded": True})
```

- [ ] **Step 2: Verify endpoint via Flask test client**

Run: `python -c "from app import create_app; app=create_app(); print('Route registered!')"`
Expected: Route exists without syntax errors.

- [ ] **Step 3: Commit**

```bash
git add app/routes/tutorial/tutorial_routes.py
git commit -m "fitur: tambah endpoint upload gambar tutorial"
```

---

### Task 2: Separate Main Tab Template (`tutorials.html`) & Remove from `settings.html`

**Files:**
- Create: `app/templates/kasir/tabs/tutorials.html`
- Modify: `app/templates/kasir/tabs/settings.html`
- Modify: `app/templates/kasir/dashboard.html`

- [ ] **Step 1: Move `#subtab-tutorials` & modal from `settings.html` to `#tab-tutorials` in `tutorials.html`**

Create `app/templates/kasir/tabs/tutorials.html`:
Container ID: `tab-tutorials` (with `tab-content hidden space-y-6`).
Include local CKEditor 5 script tag and Modal `#modal-tutorial-editor`.

- [ ] **Step 2: Clean up `settings.html`**

Remove `#subtab-tutorials` and `#modal-tutorial-editor` from `settings.html`.

- [ ] **Step 3: Include `tutorials.html` in `dashboard.html`**

In `app/templates/kasir/dashboard.html`, add:
`{% include 'kasir/tabs/tutorials.html' %}`

- [ ] **Step 4: Commit**

```bash
git add app/templates/kasir/tabs/ app/templates/kasir/dashboard.html
git commit -m "fitur: pisahkan tab dokumentasi dan tutorial menjadi tab utama tersendiri"
```

---

### Task 3: Main Sidebar Navigation & Route Handler

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html`
- Modify: `app/static/js/kasir/app.js`

- [ ] **Step 1: Move sidebar item to bottom of `sidebar.html`**

Remove `settings_tutorials` from Pengaturan submenu.
Add main tab button at the bottom of `sidebar.html`:
```html
<button onclick="App.switchTab('tutorials')" data-tab="tutorials"
    class="tab-btn w-full flex items-center gap-3 px-3 py-2 rounded text-[13px] font-semibold text-neutral-400 hover:text-neutral-100 hover:bg-[#121212] transition-all text-left">
    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
    </svg>
    <span>Dokumentasi & Tutorial</span>
</button>
```

- [ ] **Step 2: Update `app.js` tab routing**

In `app.js`:
- Add `tutorials: 'Dokumentasi & Tutorial'` to `titles`.
- Add `case 'tutorials': await TutorialsModule.load(); break;` in `loadTab(tab)`.

- [ ] **Step 3: Commit**

```bash
git add app/templates/kasir/components/sidebar.html app/static/js/kasir/app.js
git commit -m "fitur: navigasi sidebar utama untuk tab dokumentasi dan tutorial"
```

---

### Task 4: Frontend Tutorials Module & CKEditor 5 Image Upload Adapter

**Files:**
- Create: `app/static/js/kasir/modules/tutorials/index.js`
- Modify: `app/templates/kasir/dashboard.html`
- Modify: `app/static/js/kasir/modules/settings/index.js`

- [ ] **Step 1: Create `TutorialsModule` in `app/static/js/kasir/modules/tutorials/index.js`**

Extract tutorial JS logic from `Settings` into `TutorialsModule` / `Tutorials`.
Implement CKEditor 5 Custom Upload Adapter:
```javascript
class MyUploadAdapter {
    constructor(loader) {
        this.loader = loader;
    }
    upload() {
        return this.loader.file.then(file => new Promise((resolve, reject) => {
            const data = new FormData();
            data.append('upload', file);
            API.request('/api/v1/kasir/tutorials/upload-image', {
                method: 'POST',
                body: data,
                headers: {} // FormData automatically sets content-type
            }).then(res => {
                if (res.url) resolve({ default: res.url });
                else reject(res.error || 'Upload error');
            }).catch(err => reject(err));
        }));
    }
    abort() {}
}

function CustomUploadAdapterPlugin(editor) {
    editor.plugins.get('FileRepository').createUploadAdapter = (loader) => {
        return new MyUploadAdapter(loader);
    };
}
```

Enable `imageUpload` in CKEditor 5 options:
```javascript
extraPlugins: [CustomUploadAdapterPlugin],
toolbar: [
    'heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote', 'codeBlock', 'imageUpload', '|', 'undo', 'redo'
]
```

- [ ] **Step 2: Add subtab-general responsive typography & card styling**

Ensure UI classes match `subtab-general` (Umum & Keamanan):
- Header titles: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider`
- Subtitle/descriptions: `text-[9px] lg:text-base text-neutral-500 mt-1`
- Buttons & badges: `text-xs lg:text-base font-bold rounded transition-colors`
- Card containers: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 space-y-4`
- Article text: `prose prose-invert max-w-none text-xs lg:text-base text-neutral-300 leading-relaxed`

- [ ] **Step 3: Load `tutorials/index.js` script in `dashboard.html`**

Add `<script src="{{ url_for('static', filename='js/kasir/modules/tutorials/index.js') }}"></script>` to `dashboard.html`.

- [ ] **Step 3: Rebuild CSS & Test Full Integration**

Run: `npm run build:css` and test Flask factory boot & API endpoints.

- [ ] **Step 4: Commit**

```bash
git add app/static/js/kasir/ app/templates/kasir/
git commit -m "fitur: integrasi ckeditor 5 image upload adapter dan modul tutorials"
```

---

### Task 5: Port Corrections (5000 to 7015)

**Files:**
- Modify: `docs/FEATURE_CLOUDFLARE_TUNNEL.md`
- Modify: `app/services/tutorial/tutorial_service.py`

- [ ] **Step 1: Replace port 5000 with 7015 in docs/FEATURE_CLOUDFLARE_TUNNEL.md**

- [ ] **Step 2: Replace port 5000 with 7015 in app/services/tutorial/tutorial_service.py**

Ensure both `localhost:5000` -> `localhost:7015` and `http://100.x.y.z:5000` -> `http://100.x.y.z:7015`.

- [ ] **Step 3: Commit**

```bash
git add docs/FEATURE_CLOUDFLARE_TUNNEL.md app/services/tutorial/tutorial_service.py
git commit -m "fitur: perbarui port default tmbilling dari 5000 ke 7015 pada dokumentasi"
```

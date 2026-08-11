# Tutorials CMS v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair CKEditor 5 offline integration, add high-contrast table borders, enable image resizing & full-width fullscreen modal, and implement a dynamic category dropdown system for Tutorials CMS.

**Architecture:** A new API endpoint `GET /api/v1/kasir/tutorials/categories` extracts unique categories. Frontend uses a dynamic select/custom category input component in a full-screen modal with updated dark-theme table CSS and reliable CKEditor 5 initialization.

**Tech Stack:** Python (Flask, SQLAlchemy), HTML5/Tailwind CSS, JavaScript (Vanilla ES6, CKEditor 5).

## Global Constraints
- Served 100% offline from `app/static/vendor/ckeditor/ckeditor.js` without external CDNs.
- Full mobile HP responsiveness.
- High-contrast table borders on dark backgrounds.

---

### Task 1: Backend Categories Endpoint & Repository Methods

**Files:**
- Modify: `app/repositories/tutorial/tutorial_repository.py`
- Modify: `app/services/tutorial/tutorial_service.py`
- Modify: `app/routes/tutorial/tutorial_routes.py`

**Interfaces:**
- Produces: `GET /api/v1/kasir/tutorials/categories` returning `{"categories": ["Cloudflare & VNC", "Jaringan", "Umum"]}`

- [ ] **Step 1: Add get_all_categories to TutorialRepository**

```python
@staticmethod
def get_all_categories():
    categories = db.session.query(SystemTutorial.category).distinct().all()
    result = set([c[0] for c in categories if c[0]])
    result.add("Umum")
    return sorted(list(result))
```

- [ ] **Step 2: Add get_categories to TutorialService & API route in tutorial_routes.py**

```python
@tutorial_bp.route('/categories', methods=['GET'])
@kasir_login_required
def get_categories():
    categories = TutorialService.get_all_categories()
    return jsonify({"status": "success", "categories": categories}), 200
```

- [ ] **Step 3: Run integration test to verify endpoint returns categories**

```python
python -c "from app import create_app; app=create_app(); client=app.test_client(); res=client.get('/api/v1/kasir/tutorials/categories'); print(res.status_code, res.get_json())"
```

- [ ] **Step 4: Commit**

```bash
git add app/repositories/tutorial/tutorial_repository.py app/services/tutorial/tutorial_service.py app/routes/tutorial/tutorial_routes.py
git commit -m "fitur: tambah API endpoint get_categories untuk dropdown tutorial"
```

---

### Task 2: Dynamic Category Dropdown UI & Management

**Files:**
- Modify: `app/templates/kasir/tabs/tutorials.html`
- Modify: `app/static/js/kasir/modules/tutorials/index.js`

- [ ] **Step 1: Replace plain text category input with dynamic Select & Custom Input in tutorials.html**

```html
<div class="sm:col-span-1">
    <label class="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Kategori *</label>
    <select id="tutorial-category-select" onchange="Tutorials.handleCategorySelectChange(this.value)"
        class="w-full px-3 py-2 bg-[#050505] border border-[#262626] rounded text-neutral-200 focus:outline-none focus:border-neutral-400 text-xs lg:text-base cursor-pointer">
        <option value="Umum">Umum</option>
        <option value="__NEW__">➕ Tambah Kategori Baru...</option>
    </select>
    <input type="text" id="tutorial-new-category-input" placeholder="Ketik kategori baru..."
        class="hidden w-full mt-2 px-3 py-2 bg-[#050505] border border-[#262626] rounded text-neutral-200 focus:outline-none focus:border-neutral-400 text-xs lg:text-base">
</div>
```

- [ ] **Step 2: Add category fetching & dynamic selection in tutorials/index.js**

```javascript
async loadCategories(selectedCategory = 'Umum') {
    try {
        const res = await fetch('/api/v1/kasir/tutorials/categories');
        const data = await res.json();
        if (data.status === 'success') {
            const select = document.getElementById('tutorial-category-select');
            if (select) {
                select.innerHTML = data.categories.map(c => `<option value="${c}">${c}</option>`).join('') +
                    '<option value="__NEW__">➕ Tambah Kategori Baru...</option>';
                if (data.categories.includes(selectedCategory)) {
                    select.value = selectedCategory;
                    document.getElementById('tutorial-new-category-input').classList.add('hidden');
                } else {
                    select.value = '__NEW__';
                    const newInp = document.getElementById('tutorial-new-category-input');
                    newInp.classList.remove('hidden');
                    newInp.value = selectedCategory;
                }
            }
        }
    } catch (e) {
        console.error('Error fetching categories:', e);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/templates/kasir/tabs/tutorials.html app/static/js/kasir/modules/tutorials/index.js
git commit -m "fitur: buat komponen dropdown kategori dinamis pada editor tutorial"
```

---

### Task 3: CKEditor 5 Build Repair & Table Contrast Styling

**Files:**
- Modify: `app/static/vendor/ckeditor/ckeditor.js`
- Modify: `app/templates/kasir/tabs/tutorials.html`
- Modify: `app/static/js/kasir/modules/tutorials/index.js`

- [ ] **Step 1: Re-install verified stable local CKEditor 5 build & initialize cleanly in tutorials/index.js**

```javascript
this.ckeditorInstance = await ClassicEditor.create(editorEl, {
    extraPlugins: [CustomUploadAdapterPlugin],
    toolbar: [
        'heading', '|',
        'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote', 'codeBlock', 'insertTable', 'imageUpload', '|',
        'undo', 'redo'
    ]
});
```

- [ ] **Step 2: Add high-contrast white/gray table border styles in tutorials.html**

```css
.prose table, .ck-content table {
    width: 100% !important;
    border-collapse: collapse !important;
    margin: 1.5rem 0 !important;
    border: 1px solid #3d3d3d !important;
    border-radius: 8px !important;
    overflow: hidden !important;
}
.prose th, .prose td, .ck-content th, .ck-content td {
    border: 1px solid #3d3d3d !important;
    padding: 0.75rem 1rem !important;
    color: #e5e5e5 !important;
}
.prose th, .ck-content th {
    background-color: #1a1a1a !important;
    color: #ffffff !important;
    font-weight: 700 !important;
    border-bottom: 2px solid #4a4a4a !important;
}
```

- [ ] **Step 3: Rebuild Tailwind CSS**

```bash
npm run build:css
```

- [ ] **Step 4: Commit**

```bash
git add app/static/vendor/ckeditor/ckeditor.js app/templates/kasir/tabs/tutorials.html app/static/js/kasir/modules/tutorials/index.js app/static/css/tailwind.css
git commit -m "fitur: perbaiki build ckeditor 5 dan tambah style garis tabel kontras tinggi"
```

---

### Task 4: Fullscreen Modal & Mobile Responsiveness

**Files:**
- Modify: `app/templates/kasir/tabs/tutorials.html`

- [ ] **Step 1: Expand modal dimensions to full screen width & height**

```html
<div id="modal-tutorial-editor" class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md hidden flex items-center justify-center p-2 sm:p-4">
    <div class="bg-[#0c0c0c] border border-[#262626] w-full max-w-[98vw] h-[96vh] rounded-lg overflow-hidden shadow-2xl flex flex-col">
```

- [ ] **Step 2: Rebuild CSS and verify Flask app factory**

```bash
npm run build:css
python -c "from app import create_app; app=create_app(); print('App clean!')"
```

- [ ] **Step 3: Commit**

```bash
git add app/templates/kasir/tabs/tutorials.html app/static/css/tailwind.css
git commit -m "fitur: perbesar modal editor tutorial menjadi fullscreen responsif"
```

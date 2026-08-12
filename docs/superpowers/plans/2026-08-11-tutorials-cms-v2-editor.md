# Tutorials CMS v2 - CKEditor Dark Theme & Word Formatting Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 100% dark theme CSS overrides for all CKEditor floating balloon popups/menus and enable Word-like formatting features (Text Alignment, Image Resize/Alignment, Font & Table Color Pickers).

**Architecture:** Add comprehensive CSS rules in `tutorials.html` targeting `.ck-balloon-panel` and editor popups, and configure CKEditor 5 toolbar & plugins in `index.js`.

**Tech Stack:** Vanilla JavaScript, CKEditor 5 Classic Build, Tailwind CSS, Flask Jinja2.

## Global Constraints

- **Commit timing**: Do not perform automatic git commit/push without explicit user request.
- **Commit language**: Indonesian (e.g. `fitur: perbarui tema gelap ckeditor balloon...`).
- **Dark Theme Palette**: Latar belakang `#0c0c0c` / `#050505`, border `#262626`, warna teks `#e5e5e5` / `#ffffff`.

---

### Task 1: Complete Dark Theme CSS Overrides for All CKEditor Popups & Balloons

**Files:**
- Modify: `app/templates/kasir/tabs/tutorials.html`

**Interfaces:**
- Produces: CSS rules styling `.ck.ck-balloon-panel`, `.ck.ck-toolbar`, `.ck.ck-dropdown__panel`, `.ck.ck-list`, `.ck.ck-color-grid`, `.ck.ck-form`, `.ck.ck-input-text`, and balloon arrows in `#0c0c0c`.

- [ ] **Step 1: Add balloon panel & popup dark theme rules in tutorials.html**

Add the following CSS rules inside `<style>` in `tutorials.html`:

```css
/* CKEditor 5 Floating Balloon & Popup Dark Theme */
.ck.ck-balloon-panel {
    background-color: #0c0c0c !important;
    border: 1px solid #262626 !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8) !important;
}
.ck.ck-balloon-panel[class*="ck-balloon-panel_arrow"]::after {
    border-bottom-color: #0c0c0c !important;
    border-top-color: #0c0c0c !important;
}
.ck.ck-balloon-panel[class*="ck-balloon-panel_arrow"]::before {
    border-bottom-color: #262626 !important;
    border-top-color: #262626 !important;
}
.ck.ck-toolbar {
    background-color: #0c0c0c !important;
    border-color: #262626 !important;
}
.ck.ck-labeled-field-view, .ck.ck-input-text {
    background-color: #050505 !important;
    border-color: #262626 !important;
    color: #ffffff !important;
}
.ck.ck-color-grid, .ck.ck-color-picker_grid {
    background-color: #0c0c0c !important;
}
.ck.ck-form {
    background-color: #0c0c0c !important;
    color: #e5e5e5 !important;
}
```

- [ ] **Step 2: Rebuild Tailwind CSS**

Run: `npm run build:css`
Expected: CSS compiled successfully.

- [ ] **Step 3: Commit**

Run: `git add app/templates/kasir/tabs/tutorials.html app/static/css/tailwind.css`
Run: `git commit -m "fitur: tambahkan styling tema gelap 100% pada floating balloon ckeditor"`

---

### Task 2: Configure Word Formatting Features (Alignment, Image Resize, Colors)

**Files:**
- Modify: `app/static/js/kasir/modules/tutorials/index.js`
- Modify: `app/templates/kasir/tabs/tutorials.html`

**Interfaces:**
- Produces: Enhanced CKEditor 5 configuration supporting alignment, image resizing, and font/table color controls.

- [ ] **Step 1: Update CKEditor 5 initialization config in tutorials/index.js**

Add `alignment`, `image`, `table`, and `fontSize`/`fontColor` configuration blocks in `ClassicEditor.create()`:

```javascript
toolbar: [
    'heading', '|',
    'bold', 'italic', 'underline', 'strikethrough', 'highlight', '|',
    'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor', '|',
    'alignment', 'link', 'bulletedList', 'numberedList', 'todoList', 'outdent', 'indent', '|',
    'blockQuote', 'codeBlock', 'insertTable', 'imageUpload', '|',
    'undo', 'redo'
],
alignment: {
    options: [ 'left', 'center', 'right', 'justify' ]
},
image: {
    toolbar: [
        'imageStyle:inline',
        'imageStyle:block',
        'imageStyle:side',
        '|',
        'toggleImageCaption',
        'imageTextAlternative',
        '|',
        'resizeImage'
    ]
},
table: {
    contentToolbar: [
        'tableColumn', 'tableRow', 'mergeTableCells',
        'tableProperties', 'tableCellProperties'
    ]
}
```

- [ ] **Step 2: Verify Flask App Factory Boot**

Run: `python -c "from app import create_app; app=create_app(); print('App clean!')"`
Expected: `App clean!`

- [ ] **Step 3: Commit**

Run: `git add app/static/js/kasir/modules/tutorials/index.js`
Run: `git commit -m "fitur: konfigurasi fitur alignment, image resize, dan warna tabel ckeditor"`

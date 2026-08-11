# Tutorials CMS v2 - Custom Standalone CKEditor 5 Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom, clean, standalone CKEditor 5 JS bundle without any commercial/collaboration modules in a permanent tool directory `tools/ckeditor-builder/`, allowing developers to re-build or customize CKEditor easily via `npm run build:ckeditor`.

**Architecture:** Create a permanent builder tool in `tools/ckeditor-builder/` with package.json, source entry, and esbuild script that outputs `app/static/vendor/ckeditor/ckeditor.js`, and style floating balloons with dark mode CSS in `tutorials.html`.

**Tech Stack:** Node.js, esbuild, CKEditor 5 Packages, Vanilla JavaScript, Flask Jinja2, Tailwind CSS.

## Global Constraints

- **Commit timing**: Do not perform automatic git commit/push without explicit user request.
- **Commit language**: Indonesian (e.g. `fitur: buat alat kompilasi kustom ckeditor 5 di tools/ckeditor-builder`).
- **Dark Theme Palette**: Latar belakang `#0c0c0c` / `#050505`, border `#262626`, warna teks `#e5e5e5` / `#ffffff`.

---

### Task 1: Create Permanent Builder Tool & Compile Standalone CKEditor 5 Bundle

**Files:**
- Create: `tools/ckeditor-builder/package.json`
- Create: `tools/ckeditor-builder/src/build.js`
- Create: `tools/ckeditor-builder/README.md`
- Modify: `package.json` (root)
- Create: `app/static/vendor/ckeditor/ckeditor.js`

**Interfaces:**
- Produces: `tools/ckeditor-builder` directory with npm build script and single standalone `ckeditor.js` bundle in `app/static/vendor/ckeditor/ckeditor.js`.

- [ ] **Step 1: Create directory tools/ckeditor-builder and package.json**

Run: `node -e "const fs=require('fs'); if(!fs.existsSync('tools/ckeditor-builder')) fs.mkdirSync('tools/ckeditor-builder', {recursive: true}); if(!fs.existsSync('tools/ckeditor-builder/src')) fs.mkdirSync('tools/ckeditor-builder/src', {recursive: true});"`

Create `tools/ckeditor-builder/package.json`:
```json
{
  "name": "tmbilling-ckeditor-builder",
  "version": "1.0.0",
  "description": "Permanent local builder tool for TMBilling custom CKEditor 5 standalone bundle",
  "private": true,
  "scripts": {
    "build": "esbuild src/build.js --bundle --minify --outfile=../../app/static/vendor/ckeditor/ckeditor.js --loader:.svg=text --loader:.css=css"
  },
  "dependencies": {
    "@ckeditor/ckeditor5-alignment": "^38.0.0",
    "@ckeditor/ckeditor5-basic-styles": "^38.0.0",
    "@ckeditor/ckeditor5-block-quote": "^38.0.0",
    "@ckeditor/ckeditor5-code-block": "^38.0.0",
    "@ckeditor/ckeditor5-editor-classic": "^38.0.0",
    "@ckeditor/ckeditor5-essentials": "^38.0.0",
    "@ckeditor/ckeditor5-font": "^38.0.0",
    "@ckeditor/ckeditor5-heading": "^38.0.0",
    "@ckeditor/ckeditor5-highlight": "^38.0.0",
    "@ckeditor/ckeditor5-image": "^38.0.0",
    "@ckeditor/ckeditor5-indent": "^38.0.0",
    "@ckeditor/ckeditor5-link": "^38.0.0",
    "@ckeditor/ckeditor5-list": "^38.0.0",
    "@ckeditor/ckeditor5-paragraph": "^38.0.0",
    "@ckeditor/ckeditor5-table": "^38.0.0",
    "@ckeditor/ckeditor5-theme-lark": "^38.0.0",
    "@ckeditor/ckeditor5-undo": "^38.0.0"
  },
  "devDependencies": {
    "esbuild": "^0.20.0"
  }
}
```

- [ ] **Step 2: Create src/build.js and README.md**

Create `tools/ckeditor-builder/src/build.js`:
```javascript
import ClassicEditorBase from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';
import Essentials from '@ckeditor/ckeditor5-essentials/src/essentials';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import Heading from '@ckeditor/ckeditor5-heading/src/heading';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold';
import Italic from '@ckeditor/ckeditor5-basic-styles/src/italic';
import Underline from '@ckeditor/ckeditor5-basic-styles/src/underline';
import Strikethrough from '@ckeditor/ckeditor5-basic-styles/src/strikethrough';
import Alignment from '@ckeditor/ckeditor5-alignment/src/alignment';
import FontColor from '@ckeditor/ckeditor5-font/src/fontcolor';
import FontBackgroundColor from '@ckeditor/ckeditor5-font/src/fontbackgroundcolor';
import FontSize from '@ckeditor/ckeditor5-font/src/fontsize';
import FontFamily from '@ckeditor/ckeditor5-font/src/fontfamily';
import Highlight from '@ckeditor/ckeditor5-highlight/src/highlight';
import Link from '@ckeditor/ckeditor5-link/src/link';
import List from '@ckeditor/ckeditor5-list/src/list';
import TodoList from '@ckeditor/ckeditor5-list/src/todolist';
import Indent from '@ckeditor/ckeditor5-indent/src/indent';
import IndentBlock from '@ckeditor/ckeditor5-indent/src/indentblock';
import BlockQuote from '@ckeditor/ckeditor5-block-quote/src/blockquote';
import CodeBlock from '@ckeditor/ckeditor5-code-block/src/codeblock';
import Table from '@ckeditor/ckeditor5-table/src/table';
import TableToolbar from '@ckeditor/ckeditor5-table/src/tabletoolbar';
import TableProperties from '@ckeditor/ckeditor5-table/src/tableproperties';
import TableCellProperties from '@ckeditor/ckeditor5-table/src/tablecellproperties';
import Image from '@ckeditor/ckeditor5-image/src/image';
import ImageToolbar from '@ckeditor/ckeditor5-image/src/imagetoolbar';
import ImageCaption from '@ckeditor/ckeditor5-image/src/imagecaption';
import ImageStyle from '@ckeditor/ckeditor5-image/src/imagestyle';
import ImageUpload from '@ckeditor/ckeditor5-image/src/imageupload';
import ImageResize from '@ckeditor/ckeditor5-image/src/imageresize';
import Undo from '@ckeditor/ckeditor5-undo/src/undo';

class ClassicEditor extends ClassicEditorBase {}

ClassicEditor.builtinPlugins = [
    Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough,
    Alignment, FontColor, FontBackgroundColor, FontSize, FontFamily, Highlight,
    Link, List, TodoList, Indent, IndentBlock, BlockQuote, CodeBlock,
    Table, TableToolbar, TableProperties, TableCellProperties,
    Image, ImageToolbar, ImageCaption, ImageStyle, ImageUpload, ImageResize,
    Undo
];

ClassicEditor.defaultConfig = {
    toolbar: {
        items: [
            'heading', '|',
            'bold', 'italic', 'underline', 'strikethrough', 'highlight', '|',
            'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor', '|',
            'alignment', 'link', 'bulletedList', 'numberedList', 'todoList', 'outdent', 'indent', '|',
            'blockQuote', 'codeBlock', 'insertTable', 'imageUpload', '|',
            'undo', 'redo'
        ]
    },
    image: {
        toolbar: [
            'imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|',
            'toggleImageCaption', 'imageTextAlternative', '|', 'resizeImage'
        ]
    },
    table: {
        contentToolbar: [
            'tableColumn', 'tableRow', 'mergeTableCells',
            'tableProperties', 'tableCellProperties'
        ]
    },
    language: 'en'
};

window.ClassicEditor = ClassicEditor;
```

Create `tools/ckeditor-builder/README.md`:
```markdown
# TMBilling Custom CKEditor 5 Builder

Direktori ini berisi konfigurasi dan alat kompilasi bundel kustom CKEditor 5 standalone untuk TMBilling.

## Cara Menggunakan untuk Developer:

1. Untuk mengompilasi ulang bundel CKEditor 5 dari root project:
   ```bash
   npm run build:ckeditor
   ```

2. Hasil kompilasi akan otomatis diperbarui pada:
   `app/static/vendor/ckeditor/ckeditor.js`
```

- [ ] **Step 3: Update root package.json and compile build**

Add `"build:ckeditor": "cd tools/ckeditor-builder && npm install && npm run build"` to `scripts` in root `package.json`.

Run: `cmd.exe /c "npm run build:ckeditor"`
Expected: `ckeditor.js` generated in `app/static/vendor/ckeditor/ckeditor.js`.

- [ ] **Step 4: Commit**

Run: `git add tools/ckeditor-builder package.json app/static/vendor/ckeditor/ckeditor.js app/static/vendor/ckeditor/ckeditor.css`
Run: `git commit -m "fitur: buat alat kompilasi kustom ckeditor 5 di tools/ckeditor-builder"`

---

### Task 2: Configure CKEditor Initialization & Dark Balloon CSS

**Files:**
- Modify: `app/static/js/kasir/modules/tutorials/index.js`
- Modify: `app/templates/kasir/tabs/tutorials.html`

**Interfaces:**
- Produces: Clean initialization of custom `ClassicEditor` in `index.js` and total dark mode floating balloons in `tutorials.html`.

- [ ] **Step 1: Simplify initialization in tutorials/index.js**

Update `openTutorialModal()` in `tutorials/index.js` to use `window.ClassicEditor`:

```javascript
if (typeof ClassicEditor !== 'undefined') {
    if (this.ckeditorInstance) {
        this.ckeditorInstance.setData(contentHtml);
    } else {
        try {
            const editorEl = document.querySelector('#tutorial-content-editor');
            if (editorEl) {
                this.ckeditorInstance = await ClassicEditor.create(editorEl, {
                    extraPlugins: [CustomUploadAdapterPlugin]
                });
                this.ckeditorInstance.setData(contentHtml);
            }
        } catch (e) {
            console.error('Error init CKEditor 5:', e);
        }
    }
}
```

- [ ] **Step 2: Add balloon dark theme rules in tutorials.html and rebuild CSS**

Ensure all `.ck.ck-balloon-panel`, `.ck.ck-toolbar`, `.ck.ck-dropdown__panel` CSS rules are present in `tutorials.html`.

Run: `npm run build:css`
Expected: CSS compiled successfully.

- [ ] **Step 3: Verify Flask App Factory Boot**

Run: `python -c "from app import create_app; app=create_app(); print('App clean!')"`
Expected: `App clean!`

- [ ] **Step 4: Commit**

Run: `git add app/static/js/kasir/modules/tutorials/index.js app/templates/kasir/tabs/tutorials.html app/static/css/tailwind.css`
Run: `git commit -m "fitur: hubungkan ckeditor kustom standalone dan terapkan tema gelap balloon"`

# Tutorials CMS v2 - Custom Standalone CKEditor 5 Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom, clean, standalone CKEditor 5 JS bundle without any commercial/collaboration modules, resolving all cascading dependency errors while supporting Text Alignment, Image Resize handles, Table Cell Colors, and Font Colors in 100% dark theme balloon UI.

**Architecture:** Create an isolated build script using Node.js/esbuild to compile CKEditor 5 modules into a single `ckeditor.js` file, and style floating balloons with dark mode CSS in `tutorials.html`.

**Tech Stack:** Node.js, esbuild, CKEditor 5 Packages, Vanilla JavaScript, Flask Jinja2, Tailwind CSS.

## Global Constraints

- **Commit timing**: Do not perform automatic git commit/push without explicit user request.
- **Commit language**: Indonesian (e.g. `fitur: kompilasi bundel kustom standalone ckeditor 5 offline`).
- **Dark Theme Palette**: Latar belakang `#0c0c0c` / `#050505`, border `#262626`, warna teks `#e5e5e5` / `#ffffff`.

---

### Task 1: Compile Custom Standalone CKEditor 5 Bundle

**Files:**
- Create: `app/static/vendor/ckeditor/ckeditor.js`

**Interfaces:**
- Produces: Single standalone `ckeditor.js` bundle exporting global `ClassicEditor` with Alignment, ImageResize, TableProperties, FontColor, and basic editing plugins.

- [ ] **Step 1: Set up temporary build directory and install CKEditor 5 packages**

Run: `node -e "const fs=require('fs'); if(!fs.existsSync('.ckeditor-builder')) fs.mkdirSync('.ckeditor-builder');"`

Create `.ckeditor-builder/package.json`:
```json
{
  "name": "custom-ckeditor-build",
  "version": "1.0.0",
  "private": true,
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

Run: `cmd.exe /c "cd .ckeditor-builder && npm install"`

- [ ] **Step 2: Create entry script src/build.js**

Create `.ckeditor-builder/src/build.js`:
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

- [ ] **Step 3: Bundle to app/static/vendor/ckeditor/ckeditor.js and clean up**

Run: `cmd.exe /c "cd .ckeditor-builder && npx esbuild src/build.js --bundle --minify --outfile=../app/static/vendor/ckeditor/ckeditor.js"`
Run: `cmd.exe /c "rmdir /s /q .ckeditor-builder"`

- [ ] **Step 4: Commit**

Run: `git add app/static/vendor/ckeditor/ckeditor.js`
Run: `git commit -m "fitur: kompilasi bundel kustom standalone ckeditor 5 offline"`

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

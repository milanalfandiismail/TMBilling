# Design Specification: File Explorer Web Component

- **Status**: Proposed
- **Author**: Antigravity & User Pair
- **Date**: 2026-08-15
- **Category**: Architectural / Subsystem

---

## 1. Executive Summary

TMBilling requires a web-based **File Explorer** embedded directly in the admin dashboard. This enables administrators to inspect, browse, edit text/source files, and configure server directories within a restricted, sandboxed environment without opening remote desktop or arbitrary shell access.

---

## 2. Architecture & Tech Stack

### 2.1 Technology Decisions

1. **Backend Integration**: Direct Python Flask backend service utilizing `os`, `pathlib`, and `shutil`. A separate Rust background service is omitted because the Flask backend runs directly on the server host and already holds local filesystem access.
2. **Frontend UI**:
   - Modern Chamber Noir Dark UI matching existing TMBilling styling (`#0a0a0a`, `#171717`, `#1c1c1c`, Tailwind CSS).
   - Dynamic Code Editor powered by **CodeMirror 6** (CDN bundle) with syntax highlighting, line numbers, and theme alignment.
3. **Sidebar Placement**: Dedicated top-level navigation item: `📁 File Explorer` (Admin only).
4. **Access Control**: Strict `@login_required` + `@admin_required` decorators on all routes.

---

## 3. Filesystem Security Sandbox & Allowed Roots

To prevent unauthorized file system deletion, tampering, or traversal:

1. **Configurable Allowed Roots**:
   - Admin configures allowed base directories via the File Explorer UI itself (persisted in database `Settings` table key `file_explorer_allowed_roots` as JSON array).
   - Default root: Working directory of TMBilling (`c:\Project GIT\TMBilling`).
2. **Strict Path Validation**:
   - Every path requested is converted to an absolute canonical path (`os.path.realpath` / `pathlib.Path.resolve()`).
   - The canonical target path MUST start with at least one canonical allowed root path.
   - Symlinks and NTFS reparse points resolving outside allowed roots are rejected with `403 Forbidden`.
   - Relative traversal components (`..`, `../`, `..\`) resolving outside allowed bounds are rejected.

---

## 4. Editable File & Content Safety Policy

1. **Binary Detection**:
   - Extension blacklist/whitelist check + initial byte probe (check for null bytes `\x00` in the first 8000 bytes).
   - Binary files (e.g. `.exe`, `.dll`, `.db`, `.png`, `.zip`) are marked as read-only/unsupported for editing.
2. **File Size Limit**:
   - File listing / directory stats: No limit.
   - File text viewing / editing: Maximum **5 MB** to prevent browser memory exhaustion.
3. **Encoding Handling**:
   - Try UTF-8 first, then fallback to Latin-1 / CP1252 if UTF-8 decode fails.
4. **Save Concurrency & Atomicity**:
   - Optimistic concurrency check: Frontend passes last known `mtime` (modified timestamp). If disk `mtime` is newer, return conflict warning (`409 Conflict`) so changes aren't silently overwritten.
   - Atomic writes: Write to a temporary file in the same directory first, then atomic replace (`os.replace`).

---

## 5. API Contracts

All endpoints live under `/api/v1/kasir/fileexplorer/`:

### 5.1 `GET /api/v1/kasir/fileexplorer/roots`
- **Desc**: Returns the list of currently allowed root directories.
- **Response**: `{"success": true, "roots": ["C:\\Project GIT\\TMBilling", ...]}`

### 5.2 `POST /api/v1/kasir/fileexplorer/roots`
- **Desc**: Update/Add/Remove allowed root directories.
- **Payload**: `{"roots": ["C:\\Project GIT\\TMBilling", "D:\\Backups"]}`

### 5.3 `GET /api/v1/kasir/fileexplorer/list?path=<canonical_path>`
- **Desc**: Lists contents of a directory.
- **Response**:
  ```json
  {
    "success": true,
    "current_path": "C:\\Project GIT\\TMBilling",
    "is_root": false,
    "items": [
      {"name": "app", "path": "C:\\Project GIT\\TMBilling\\app", "is_dir": true, "size": null, "modified": 1755252000},
      {"name": "config.ini", "path": "C:\\Project GIT\\TMBilling\\config.ini", "is_dir": false, "size": 120, "modified": 1755252100, "editable": true}
    ]
  }
  ```

### 5.4 `GET /api/v1/kasir/fileexplorer/read?path=<canonical_path>`
- **Desc**: Reads file contents for editing.
- **Response**:
  ```json
  {
    "success": true,
    "path": "C:\\Project GIT\\TMBilling\\config.ini",
    "content": "...",
    "size": 120,
    "mtime": 1755252100,
    "extension": ".ini",
    "editable": true
  }
  ```

### 5.5 `POST /api/v1/kasir/fileexplorer/save`
- **Desc**: Saves changes to an existing file.
- **Payload**:
  ```json
  {
    "path": "C:\\Project GIT\\TMBilling\\config.ini",
    "content": "...",
    "expected_mtime": 1755252100,
    "force": false
  }
  ```

### 5.6 `POST /api/v1/kasir/fileexplorer/create`
- **Desc**: Creates a new file or folder.
- **Payload**: `{"parent_path": "...", "name": "new_file.txt", "is_dir": false}`

### 5.7 `POST /api/v1/kasir/fileexplorer/rename`
- **Desc**: Renames a file or folder.
- **Payload**: `{"path": "...", "new_name": "updated.txt"}`

### 5.8 `POST /api/v1/kasir/fileexplorer/delete`
- **Desc**: Deletes a file or directory (must be verified safe).
- **Payload**: `{"path": "..."}`

---

## 6. Audit Logging

Every filesystem modification will emit an audit event using `write_log()`:
- `FILE_EXPLORER_SAVE`: When a file is updated.
- `FILE_EXPLORER_CREATE`: When a file/folder is created.
- `FILE_EXPLORER_RENAME`: When a file/folder is renamed.
- `FILE_EXPLORER_DELETE`: When a file/folder is deleted.
- `FILE_EXPLORER_ROOTS_UPDATE`: When allowed roots configuration is modified.

Category: `SYSTEM` or `MAINTENANCE`.

---

## 7. Frontend Layout & UX

1. **Sidebar Link**:
   - Located in `app/templates/kasir/components/sidebar.html`
   - Icon: Folder SVG / 📁
   - Label: `File Explorer`
2. **Main Tab View (`app/templates/kasir/tabs/fileexplorer.html`)**:
   - Header with breadcrumbs bar + Action buttons (New File, New Folder, Refresh, Settings/Roots Config toggle).
   - Split view or Dual Pane:
     - Left Pane: Directory navigation tree & file list with search filter.
     - Right Pane: CodeMirror 6 text editor, status bar (character count, line count, language/syntax mode, save indicator).
   - Config Modal / Slide-out:
     - Allowed roots manager (Add directory input, remove button, current active roots).
3. **Scripting**:
   - `app/static/js/kasir/modules/fileexplorer/index.js` loaded in `base.html`.

---

## 8. Verification Plan

1. **Automated Unit & Integration Tests**:
   - `tests/test_fileexplorer_security.py`: Tests path traversal attacks, symlink escape, non-allowed root rejection, binary file guard, file size limit.
   - `tests/test_fileexplorer_api.py`: Tests list, read, save, create, rename, delete, conflict detection, and roots management endpoints.
2. **Frontend UI Validation**:
   - Verify tab navigation from sidebar.
   - Verify breadcrumb path jumping.
   - Verify file editing with CodeMirror 6 and hotkey `Ctrl+S` saving.
   - Verify audit log emission.

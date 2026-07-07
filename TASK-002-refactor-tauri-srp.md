# TASK-002: Refactor TMBillingTauri (SRP)

## Status: PLANNING

## Priority: HIGH

---

## Understanding Summary

### What is being built
Refactoring struktur kode TMBillingTauri untuk menerapkan Single Responsibility Principle (SRP) dengan memisahkan:
- File HTML untuk Kiosk mode
- File HTML untuk Overlay mode
- Logika JavaScript terpisah per modul

### Why it exists
Saat ini semua logic dan HTML mungkin tercampur dalam satu file, menyulitkan maintenance dan testing. Dengan SRP, setiap file memiliki satu tanggung jawab yang jelas.

### Who it is for
- Developer yang maintain codebase
- Future development yang lebih terstruktur

### Key constraints
- Tidak boleh break existing functionality
- Harus backward compatible dengan API yang ada
- Tauri framework limitations

### Explicit non-goals
- Tidak rewrite keseluruhan aplikasi
- Tidak mengubah business logic

---

## Current State Analysis

### Current Structure (from MCP)
```
WarnetClient/TMBillingTauri/
├── src/
│   ├── index.html          ← Single HTML file (MASALAH)
│   ├── main.js
│   ├── js/
│   │   ├── api.js
│   │   ├── ui.js
│   │   └── tailwindcss.js
│   └── css/
├── src-tauri/
│   └── src/
│       └── commands/
│           └── window_commands.rs
```

### Problems Identified
1. Single `index.html` untuk kiosk dan overlay
2. Logic bercampur dalam file yang sama
3. Sulit untuk testing individual components

---

## Proposed Solution

### Approach: Separate HTML Files by Mode

### New Structure
```
WarnetClient/TMBillingTauri/
├── src/
│   ├── kiosk/
│   │   ├── index.html         ← Kiosk mode HTML
│   │   ├── kiosk.js           ← Kiosk-specific logic
│   │   └── kiosk.css          ← Kiosk styles
│   ├── overlay/
│   │   ├── index.html         ← Overlay mode HTML
│   │   ├── overlay.js         ← Overlay-specific logic
│   │   └── overlay.css        ← Overlay styles
│   ├── shared/
│   │   ├── api.js             ← Shared API calls
│   │   ├── utils.js           ← Utility functions
│   │   └── constants.js       ← Shared constants
│   └── main.js                ← Entry point
```

### Implementation Steps

1. **Create separate directories**
   - Buat folder `kiosk/` dan `overlay/`
   - Buat folder `shared/`

2. **Extract Kiosk HTML**
   - Pindahkan kiosk-specific HTML ke `kiosk/index.html`
   - Include kiosk-specific scripts

3. **Extract Overlay HTML**
   - Pindahkan overlay-specific HTML ke `overlay/index.html`
   - Include overlay-specific scripts

4. **Separate JavaScript logic**
   - Extract kiosk logic ke `kiosk.js`
   - Extract overlay logic ke `overlay.js`
   - Shared functions ke `shared/`

5. **Update Tauri configuration**
   - Update `tauri.conf.json` untuk multiple windows
   - Configure window switching

6. **Update Rust commands**
   - Modify `window_commands.rs` untuk load correct HTML
   - Add window management functions

---

## Decision Log

| Decision | Alternatives Considered | Reason |
|----------|------------------------|--------|
| Separate HTML files per mode | Single HTML with conditionals | Cleaner separation, easier maintenance |
| Shared folder for common code | Duplicate in each folder | DRY principle, avoid code duplication |
| Keep Rust commands minimal | Move more logic to Rust | JavaScript is easier to modify for frontend |

---

## Open Questions

### 1. Apakah perlu maintain backward compatibility dengan `index.html` lama?

**KEPUTUSAN: TIDAK PERLU**

Alasan:
- Single window architecture, tidak ada consumer lama
- Controlled deployment via Tauri bundle
- Clean break lebih baik untuk SRP refactoring

### 2. Bagaimana cara handling state sharing antara kiosk dan overlay?

**KEPUTUSAN: Tauri State + Events**

Implementasi:
1. **Rust State (Singleton)** - `AppState` struct dengan `Arc<Mutex<>>`
2. **JavaScript State Manager** - `shared/state.js` untuk sync
3. **Event-based Communication** - `listen('state-changed')` di kedua mode

Data yang dishared:
- `current_mode`: "kiosk" | "overlay"
- `session_data`: Session info dari backend
- `network_info`: Network info dari backend
- `warnet_config`: Config dari file

---

## Verification Plan

### Automated Tests
- Unit tests untuk setiap JS module
- Integration tests untuk window switching

### Manual Testing
1. Start app → kiosk mode shows correctly
2. Switch to overlay → overlay shows correctly
3. Switch back to kiosk → kiosk shows correctly
4. All existing features work in both modes

---

## Dependencies
- Tauri multi-window configuration
- Build system updates

---

## Estimated Effort
**Large** - 6-8 hours implementation + testing

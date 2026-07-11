# TASK-004: Live Search dengan Debounce 500ms

## Status: PLANNING

## Priority: MEDIUM

---

## Understanding Summary

### What is being built
Implementasi live search dengan debounce 500ms di seluruh fitur search yang ada di aplikasi, mengikuti pola yang sudah ada di dashboard search.

### Why it exists
Saat ini beberapa fitur search masih menggunakan cara lama (enter atau klik tombol). Dengan live search + debounce, user experience lebih baik dan mengurangi unnecessary API calls.

### Who it is for
- Kasir/operator yang melakukan pencarian
- Member yang mencari data

### Key constraints
- Debounce time: 500ms (sudah ditentukan)
- Harus konsisten di semua tempat search
- Tidak boleh memberatkan server dengan terlalu banyak request

### Explicit non-goals
- Tidak mengubah logic backend search
- Tidak menambah fitur search baru

---

## Current State Analysis

### Relevant Files (from MCP)

| File | Current Implementation | Has Debounce? |
|------|----------------------|---------------|
| `app/static/js/kasir/modules/dashboard/index.js` | `_handleMemberSearchInput`, `_renderMemberSearch` (lines 1008-1051) | YES (reference) |
| `app/static/js/kasir/modules/member/index.js` | `doSearch` (lines 47-54) | NO |
| `app/static/js/kasir/modules/paket/index.js` | `doSearch` (lines 38-43) | NO |
| `app/static/js/kasir/modules/pc/index.js` | `doSearch` (lines 40-45) | NO |

### Existing Debounce Implementation (Dashboard)
```javascript
// From dashboard/index.js - USE AS REFERENCE
_handleMemberSearchInput: function(e) {
    const query = e.target.value;
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
        this._searchMembers(query);
    }, 500); // 500ms debounce
}
```

### Places Needing Live Search + Debounce

1. **Member Search** (`member/index.js`)
   - Search member by username/nama
   
2. **Paket Search** (`paket/index.js`)
   - Search paket by nama
   
3. **PC Search** (`pc/index.js`)
   - Search PC by nama/ip

4. **Other searches in dashboard**
   - Tambahan search untuk fitur lain yang mungkin ada

---

## Proposed Solution

### Approach: Create Reusable Debounce Utility + Apply to All Search

### Implementation Steps

1. **Create Debounce Utility**
   - New file: `app/static/js/kasir/utils/debounce.js`
   - Export reusable `debounce()` function

```javascript
// debounce.js
export function debounce(func, wait = 500) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
```

2. **Update Member Search**
   - Modify `member/index.js`
   - Add live search on input event
   - Apply 500ms debounce

3. **Update Paket Search**
   - Modify `paket/index.js`
   - Add live search on input event
   - Apply 500ms debounce

4. **Update PC Search**
   - Modify `pc/index.js`
   - Add live search on input event
   - Apply 500ms debounce

5. **Add Loading Indicator**
   - Show loading spinner during search
   - Consistent UX across all searches

### Pattern to Apply
```javascript
// Before (current)
doSearch: function() {
    const query = document.getElementById('searchInput').value;
    // immediate search
}

// After (with debounce)
initSearch: function() {
    const input = document.getElementById('searchInput');
    input.addEventListener('input', debounce((e) => {
        this.doSearch(e.target.value);
    }, 500));
}
```

---

## Decision Log

| Decision | Alternatives Considered | Reason |
|----------|------------------------|--------|
| Create reusable debounce utility | Implement inline | DRY, easier maintenance |
| 500ms debounce time | 300ms or 700ms | User specified 500ms, good balance |
| Keep existing search functions | Rewrite completely | Less risky, backward compatible |

---

## Open Questions

1. Apakah perlu menambah "minimum characters" sebelum search di-trigger? (misal: min 3 karakter)
2. Apakah perlu "search on enter" tetap tersedia sebagai fallback?

---

## Verification Plan

### Automated Tests
- Unit test untuk debounce utility
- Integration test untuk setiap search module

### Manual Testing
1. Buka halaman member
2. Ketik di search box
3. Verify search tidak langsung dijalankan
4. Tunggu 500ms
5. Verify search dijalankan setelah 500ms
6. Ketik lagi dengan cepat
7. Verify hanya 1 search dijalankan (debounce bekerja)
8. Repeat untuk paket dan PC search

---

## Dependencies
- None (pure frontend)

---

## Estimated Effort
**Small** - 2-3 hours implementation + testing

# TASK-003: Modal Konfirmasi Tambah Waktu Member

## Status: PLANNING - REQUIREMENTS FINALIZED

## Priority: MEDIUM

---

## Understanding Summary

### What is being built
- Menambahkan modal konfirmasi sebelum menambah waktu member/guest
- Memperbaiki tampilan total tamaban di kolom agar data lebih pasti
- Behavior: klik Batal → kembali ke modal sebelumnya

### Why it exists
Saat ini proses tambah waktu langsung dieksekusi tanpa konfirmasi, berisiko salah input. Total tambahan juga tidak ditampilkan dengan jelas di kolom.

### Who it is for
- Kasir/operator yang melakukan tambah waktu
- Member/Guest yang ingin melihat detail tambahan waktu

### Key constraints
- Harus konsisten dengan UI existing
- Back button harus kembali ke modal sebelumnya
- Format waktu: "X jam Y menit"

### Explicit non-goals
- Tidak menampilkan histori tambah waktu (bisa dilihat di halaman detail)
- Tidak mengubah logic backend tambah waktu

---

## Requirements

### 1. Member Refill Flow
```
Modal Tambah Waktu
       │
       ▼
Modal Konfirmasi ──► [Batal] ──► Kembali ke Modal Tambah Waktu
       │
       ▼ [Konfirmasi]
Submit ke API
```

### 2. Dashboard Flow
```
Dashboard → Klik Tambah Waktu
       │
       ▼
Modal Konfirmasi ──► [Batal] ──► Kembali ke Dashboard
       │
       ▼ [Konfirmasi]
Submit ke API
```

### 3. Display Format

**Untuk Member:**
```
┌─────────────────────────────────────┐
│     Konfirmasi Tambah Waktu         │
├─────────────────────────────────────┤
│ Member: John Doe                    │
│ PC: PC-01                           │
│ Waktu Saat Ini: 1 jam 30 menit      │
│                                     │
│ Tambahan: 2 jam                     │
│ Total Setelah: 3 jam 30 menit       │
├─────────────────────────────────────┤
│        [Batal]  [Konfirmasi]        │
└─────────────────────────────────────┘
```

**Untuk Guest:**
```
┌─────────────────────────────────────┐
│     Konfirmasi Tambah Waktu         │
├─────────────────────────────────────┤
│ PC: PC-05                           │
│ Guest: Guest-05                     │
│ Waktu Saat Ini: 30 menit            │
│                                     │
│ Tambahan: 1 jam                     │
│ Total Setelah: 1 jam 30 menit       │
├─────────────────────────────────────┤
│        [Batal]  [Konfirmasi]        │
└─────────────────────────────────────┘
```

---

## Current State Analysis

### Relevant Files (from MCP)

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `app/static/js/kasir/components/modal-tambah.js` | Modal tambah waktu (lines 5-114) | Add confirmation modal trigger |
| `app/static/js/kasir/modules/member/member_refill.js` | Member refill logic (lines 4-108) | Add confirmation flow |
| `app/static/js/kasir/modules/dashboard/index.js` | `tambahWaktuMember` function (lines 907-973) | Add confirmation modal |
| `app/routes/member/member_routes.py` | Backend route `tambah_waktu` | No changes |
| `app/services/member/member_service.py` | Service `tambah_waktu` | No changes |

---

## Proposed Solution

### Implementation Steps

1. **Create Confirmation Modal Component**
   - New file: `app/static/js/kasir/components/modal-confirm-tambah.js`
   - Function: `open(data, onConfirm, onCancel)`
   - Reusable untuk member dan guest

2. **Modify Member Refill Flow**
   - Update `member_refill.js`
   - Intercept submit → show confirmation
   - On Batal → kembali ke modal tambah
   - On Konfirmasi → submit ke API

3. **Add Dashboard Confirmation**
   - Update `tambahWaktuMember()` di dashboard/index.js
   - Detect member vs guest
   - Show appropriate confirmation modal
   - On Batal → kembali ke dashboard
   - On Konfirmasi → submit ke API

4. **Update Total Preview Display**
   - Show waktu sebelum dan sesudah
   - Format: "X jam Y menit"

---

## Decision Log

| Decision | Alternatives Considered | Reason |
|----------|------------------------|--------|
| No histori in modal | Show last 5 transactions | Keep modal focused, histori di detail page |
| Format "X jam Y menit" | "1:30" or "90 menit" | User confirmed this format is good |
| Back to previous modal | Close all modals | Better UX, user can review |
| Separate component | Inline modal | Reusable for member & guest |

---

## Verification Plan

### Manual Testing

**Member Refill:**
1. Buka modal tambah waktu member
2. Pilih paket
3. Klik submit
4. Verify konfirmasi modal muncul
5. Klik Batal → verify kembali ke modal tambah
6. Klik submit lagi
7. Klik Konfirmasi → verify waktu bertambah

**Dashboard - Member:**
1. Buka dashboard
2. Klik tambah waktu pada PC dengan member
3. Verify modal menampilkan "Member: Nama"
4. Klik Batal → verify kembali ke dashboard
5. Ulangi, klik Konfirmasi → verify waktu bertambah

**Dashboard - Guest:**
1. Buka dashboard
2. Klik tambah waktu pada PC dengan guest
3. Verify modal menampilkan "PC: PC-05, Guest: Guest-05"
4. Klik Batal → verify kembali ke dashboard
5. Ulangi, klik Konfirmasi → verify waktu bertambah

---

## Dependencies
- Existing modal system (`app/static/js/kasir/core/modal.js`)

---

## Estimated Effort
**Medium** - 4-5 hours implementation + testing

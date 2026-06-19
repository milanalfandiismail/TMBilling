# Floor Plan / Map View Dashboard — Design Document

**Fitur #90 dari brainstorming_fitur_tmbilling.md**  
**Tanggal:** 2026-06-18  
**Status:** Desain dikonfirmasi, siap implementasi

---

## Ringkasan Pemahaman

- **Apa**: Tampilan alternatif dashboard selain grid card — render PC sebagai titik di canvas denah per zona (grup)
- **Kenapa**: Kasir langsung tahu posisi fisik PC tanpa hafal kode
- **Siapa**: Admin setup posisi (drag-drop di edit mode), kasir/staff lihat real-time (view-only)
- **Key constraint**: Satu tombol toggle global Grid ↔ Map View
- **Simpan posisi**: 2 kolom baru `pos_x`, `pos_y` di tabel PC (simpel)
- **Background**: Dark grid kosong — tanpa upload gambar denah
- **Scale**: 50+ PC, canvas auto-adjust

## Asumsi

- Posisi PC disimpan per zona — satu canvas per grup ditampilin vertikal ke bawah
- Map View render warna status sama persis seperti grid card (hijau=aktif, merah=terputus, amber=admin, abu-abu=kosong, offline=transparan)
- Klik PC di map = modal sesi yang sama seperti grid card
- Map View tetap pakai polling real-time yang sama (`GET /api/pc`)
- PC yang belum di-set posisi (pos_x=0, pos_y=0) punya area "Belum Dipetakan" terpisah
- Mode edit (drag) hanya untuk admin, kasir/staff view-only

## Non-Goals

- Tidak upload gambar denah sebagai background
- Tidak rotasi/ukuran PC di canvas
- Tidak zoom/pan kompleks
- Tidak integrasi dengan PC Management tab (hanya di dashboard)

---

## Decision Log

| # | Keputusan | Alternatif | Alasan |
|---|---|---|---|
| D1 | Kolom pos_x, pos_y di tabel PC | Tabel terpisah pc_layout | Simpel, satu PC satu posisi. Tabel terpisah overkill |
| D2 | DOM-based (positioned div) | HTML5 Canvas | Klik natural, Tailwind langsung, gak perlu library, ~50 div ringan di DOM modern |
| D3 | Toggle global Grid ↔ Map | Toggle per zona | Satu tombol, konsisten, user gak bingung |
| D4 | Dark grid kosong sebagai background | Upload gambar denah | Simpel, gak perlu manajemen aset upload |
| D5 | Scale 50+ PC di-support | Batasi 20-30 PC | Open source, harus akomodasi warnet besar |
| D6 | Edit mode hanya di dashboard | Bisa di PC management tab juga | Fokus workflow — yang setup layout admin buka dashboard |
| D7 | View mode simpan di localStorage | Session-only | User preference persist antar session |

---

## Arsitektur

### Model DB — Tambahan ke PC

```python
pos_x = db.Column(db.Integer, default=0)  # posisi X di canvas
pos_y = db.Column(db.Integer, default=0)  # posisi Y di canvas
```

### API Endpoint Baru

```
PUT /api/pc/<id>/position
  Body: { pos_x: int, pos_y: int }
  Auth: admin only
  Response: { success: true }
```

`GET /api/pc` sudah cukup — posisi ditambahkan ke `to_dict()`.

### Folder Baru

```
app/static/js/kasir/modules/dashboard/
├── index.js           ← existing, tambah toggleView() + renderMap()
├── dashboard_cards.js ← existing, tidak diubah
└── map_view.js        ← NEW: render canvas + drag-drop
```

### Flow Data

```
GET /api/pc → Dashboard.load() → Dashboard.render() atau Dashboard.renderMap()
                                       ↓                        ↓
                              DashboardCards.render()    MapView.render()
                              (grid cards per zona)     (canvas per zona)
```

---

## Desain Detail

### 1. Flow UI

```
[🗺️ Map View] / [📋 Grid View]  ← toggle button di atas area grid
──────────────────────────────────────
┌ ZONA REGULER: 5/8 AKTIF ────────┐
│  ┌─────────────────────────────┐ │
│  │  ● PC01    ● PC03   ● PC05 │ │
│  │                             │ │
│  │     ● PC02  ● PC04  ● PC06 │ │
│  │                             │ │
│  │  ● PC07   ● PC08           │ │
│  └─────────────────────────────┘ │
│  Belum Dipetakan: PC09          │
└─────────────────────────────────┘
┌ ZONA VIP: 2/3 AKTIF ────────────┐
│  ┌─────────────────────────────┐ │
│  │  ● VIP01     ● VIP02       │ │
│  │          ● VIP03            │ │
│  └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 2. Status Warna (sama dengan grid card)

| Status | Warna Dot | Border |
|---|---|---|
| Aktif (session berjalan) | 🟢 `emerald-400` | `border-emerald-500/20` |
| Terputus (no heartbeat) | 🔴 `red-500` pulsing | `border-red-500 border-dashed` |
| Admin Mode | 🟠 `amber-500` | `border-amber-500/20` |
| Kosong (online) | ⚪ `neutral-400` | `border-neutral-700` |
| Offline | ⚫ 50% opacity | `border-dashed` |

### 3. Edit Mode (Admin Only)

- Admin klik kanan PC → masuk edit mode (semua PC jadi draggable)
- Background jadi sedikit terang (`bg-[#0a0a0a]`) sebagai indikator
- Drag PC → `PUT /api/pc/<id>/position` di-save saat mouseup
- Klik di luar canvas atau ESC → keluar edit mode

### 4. Canvas Grid

- Grid 10x10 default, auto-expand kalau ada PC di luar grid
- Garis grid tipis (`border-[#1c1c1c]`), background `bg-[#050505]`
- Ukuran cell: 80x60px, responsive via container query atau vw

---

## Testing Strategy

- **Unit test**: `PUT /api/pc/<id>/position` — validasi auth admin, input bounds
- **Integration test**: Polling `GET /api/pc` return pos_x/pos_y di response
- **Browser test**: Drag PC → refresh → posisi tetap. Toggle grid/map → switch mulus. Klik PC di map → modal sesi muncul

## Risiko

- **R1**: 50+ PC di satu zona bikin canvas penuh. Mitigasi: cell size auto-kecil berdasarkan jumlah PC
- **R2**: Drag-drop di mobile/tablet tidak natural. Mitigasi: switch otomatis ke grid view di layar kecil
- **R3**: pos_x=0, pos_y=0 ambigu (belum diset atau beneran di pojok). Mitigasi: PC dengan kedua 0 masuk area "Belum Dipetakan"

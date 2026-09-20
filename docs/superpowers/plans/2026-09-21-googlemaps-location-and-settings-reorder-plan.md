# Google Maps Location & Settings Reordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan konfigurasi dan tampilan Google Maps lokasi warnet pada halaman publik landing page (hanya tampil jika setting diisi / tanpa fallback otomatis), memindahkan upload Gambar QRIS ke posisi atas di tab Info Warnet & Kiosk, serta menyediakan parser cerdas yang mendukung berbagai format input Google Maps (Iframe embed, Embed URL, Link Share).

**Architecture:** 
- Backend: Modul `app/utils/helpers.py` menyediakan fungsi `parse_google_maps_info()` untuk mengekstrak URL embed dan link navigasi secara aman (XSS-safe). Jika input kosong, `is_valid` bernilai `False` (tanpa fallback otomatis).
- Settings Service & Routes: `SettingsService` mengelola key `warnet_gmaps` dengan default string kosong, diteruskan ke public landing page via `_register_public_routes` di `app/__init__.py`.
- Kasir/Owner Settings UI: Tab `Info Warnet & Kiosk` dirombak agar kartu Unggah QRIS berada di paling atas, diikuti Identitas Warnet, Input Google Maps (dengan live preview & panduan format), dan Pengumuman/Aturan di bawah.
- Public Landing Page UI: Menambahkan seksi "Lokasi & Rute Warnet" yang responsif dan berestetika tinggi (dark modern) dengan iframe map interaktif dan tombol aksi "Petunjuk Arah / Buka di Google Maps". Seksi ini **hanya tampil jika `warnet_gmaps` sudah diisi**.

**Tech Stack:** Python (Flask, Jinja2), Vanilla JavaScript, Tailwind CSS (Dark Mode), Pytest.

---

## Global Constraints
- Framework UI: Vanilla JS & Tailwind CSS, tidak menambah dependency eksternal baru.
- Keamanan: XSS sanitization ketat pada input Google Maps (hanya mengizinkan domain tepercaya Google Maps atau mengekstrak URL `src`).
- Kebijakan Fallback: **Tanpa fallback otomatis** — jika admin belum mengisi `warnet_gmaps`, seksi peta tidak akan dimunculkan di halaman publik.
- Responsivitas: Tampilan sempurna di semua breakpoint (Mobile, Tablet, LG, XL, 2XL).
- Testing: Semua unit test harus lulus 100%.

---

### Task 1: Backend Google Maps Parser & Unit Tests

**Files:**
- Modify: `app/utils/helpers.py`
- Create: `tests/test_google_maps_helper.py`

**Interfaces:**
- Produces: `parse_google_maps_info(gmaps_input: str) -> dict`
  - Output dict: `{"raw": str, "embed_url": str | None, "nav_url": str | None, "is_valid": bool}`

- [ ] **Step 1: Write failing unit tests for Google Maps parser**

```python
# tests/test_google_maps_helper.py
import pytest
from app.utils.helpers import parse_google_maps_info

def test_parse_iframe_embed():
    iframe_code = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1000!2d106.8!3d-6.2" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>'
    res = parse_google_maps_info(iframe_code)
    assert res["is_valid"] is True
    assert res["embed_url"].startswith("https://www.google.com/maps/embed")
    assert "106.8" in res["embed_url"]

def test_parse_direct_embed_url():
    url = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1000!2d106.8!3d-6.2"
    res = parse_google_maps_info(url)
    assert res["is_valid"] is True
    assert res["embed_url"] == url

def test_parse_share_link():
    share_url = "https://maps.app.goo.gl/abcdef123456"
    res = parse_google_maps_info(share_url)
    assert res["is_valid"] is True
    assert res["nav_url"] == share_url

def test_parse_empty_input_returns_invalid():
    res = parse_google_maps_info("")
    assert res["is_valid"] is False
    assert res["embed_url"] is None
    assert res["nav_url"] is None

def test_parse_whitespace_only_returns_invalid():
    res = parse_google_maps_info("   ")
    assert res["is_valid"] is False
    assert res["embed_url"] is None
    assert res["nav_url"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_google_maps_helper.py -v`
Expected: FAIL with `ImportError: cannot import name 'parse_google_maps_info'`

- [ ] **Step 3: Implement `parse_google_maps_info` in `app/utils/helpers.py`**

Implement helper:
- If `not gmaps_input or not gmaps_input.strip()` -> return `{"raw": "", "embed_url": None, "nav_url": None, "is_valid": False}`
- Extract `src` from `<iframe>` tags
- Check allowed schemes and google maps domain patterns
- Build `embed_url` and `nav_url` without automatic address fallback

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_google_maps_helper.py -v`
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```bash
git add app/utils/helpers.py tests/test_google_maps_helper.py
git commit -m "feat(utils): implementasi parser cerdas Google Maps untuk iframe dan link share tanpa fallback otomatis"
```

---

### Task 2: Service & Public Route Integration

**Files:**
- Modify: `app/services/settings/settings_service.py`
- Modify: `app/__init__.py`
- Modify: `app/routes/settings/settings_routes.py`

**Interfaces:**
- `SettingsService.get_all()` includes `"warnet_gmaps": ""`
- `_register_public_routes(app)` passes `gmaps_info`, `warnet_address`, `warnet_phone` to `public/landing/index.html`

- [ ] **Step 1: Write integration test for SettingsService & Public Route**

```python
# tests/test_gmaps_settings_integration.py
def test_gmaps_setting_crud_and_public_render(client, auth_header):
    # Check default is empty and section hidden
    res_init = client.get('/')
    assert res_init.status_code == 200
    assert b'Lokasi &amp; Rute Warnet' not in res_init.data

    # Set gmaps
    res = client.put('/api/v1/kasir/settings/warnet_gmaps', json={
        'value': 'https://www.google.com/maps/embed?pb=test12345'
    }, headers=auth_header)
    assert res.status_code == 200
    
    # Check public landing now renders the map section
    landing = client.get('/')
    assert landing.status_code == 200
    assert b'test12345' in landing.data
```

- [ ] **Step 2: Update `SettingsService.get_all()` & `_register_public_routes`**

Add `warnet_gmaps: ""` to default settings dict.
Update `index()` route in `app/__init__.py`:
```python
@app.route("/")
def index():
    from app.services import SettingsService
    from app.utils.helpers import parse_google_maps_info
    warnet_rules = SettingsService.get("warnet_announcement", "")
    warnet_address = SettingsService.get("warnet_address", "Jl. Merdeka No. 123, Kota")
    warnet_phone = SettingsService.get("warnet_phone", "0812-3456-7890")
    warnet_gmaps_raw = SettingsService.get("warnet_gmaps", "")
    gmaps_info = parse_google_maps_info(warnet_gmaps_raw)
    return render_template(
        "public/landing/index.html",
        warnet_rules=warnet_rules,
        warnet_address=warnet_address,
        warnet_phone=warnet_phone,
        gmaps_info=gmaps_info
    )
```

- [ ] **Step 3: Run integration tests to verify**

Run: `pytest tests/test_gmaps_settings_integration.py -v`
Expected: PASS

- [ ] **Step 4: Commit Task 2**

```bash
git add app/services/settings/settings_service.py app/__init__.py app/routes/settings/settings_routes.py tests/test_gmaps_settings_integration.py
git commit -m "feat(settings): integrasi setting warnet_gmaps ke SettingsService dan public landing route"
```

---

### Task 3: Settings UI Reordering & Google Maps Setting

**Files:**
- Modify: `app/templates/kasir/tabs/settings.html`
- Modify: `app/static/js/kasir/modules/settings/index.js`

- [ ] **Step 1: Reorder Sub-tab Info Warnet & Kiosk in `settings.html`**
  1. Move **Gambar QRIS Pembayaran** to top section of `subtab-kiosk`.
  2. Next: **Identitas Warnet** (`warnet-title-input`, `warnet-address-input`, `warnet-phone-input`, `warnet-footer-input`).
  3. Next: **Lokasi & Google Maps** (`warnet-gmaps-input`) with explanatory helper text, tips, and live map preview container.
  4. Next: **Pengumuman / Aturan** (`warnet-announcement-editor`).

- [ ] **Step 2: Update `settings/index.js`**
  - In `load()`: Populate `document.getElementById('warnet-gmaps-input').value = res.settings.warnet_gmaps || ''` and update live preview.
  - In `saveKioskSettings()`: Add API call `API.request('/api/v1/kasir/settings/warnet_gmaps', { method: 'PUT', body: JSON.stringify({ value: gmaps }) })`.
  - Add `updateGmapsPreview()` helper on input event.

- [ ] **Step 3: Verify Settings UI visually & functionally**
  - Verify QRIS is at the top.
  - Verify saving all fields works smoothly and displays toast notification.

- [ ] **Step 4: Commit Task 3**

```bash
git add app/templates/kasir/tabs/settings.html app/static/js/kasir/modules/settings/index.js
git commit -m "feat(settings-ui): reposisi QRIS ke posisi atas dan penambahan konfigurasi Google Maps di tab Info Warnet"
```

---

### Task 4: Public Landing Page Google Maps Section

**Files:**
- Modify: `app/templates/public/landing/index.html`

- [ ] **Step 1: Add "Lokasi & Rute Warnet" section in `index.html`**
  - Wrapped in `{% if gmaps_info and gmaps_info.is_valid %}` (only shows if configured, no fallback).
  - Insert section between Hero/Feature and Rules/Footer.
  - Section layout:
    - Left column: Alamat lengkap, No. Telepon, Petunjuk Arah button (`target="_blank" rel="noopener"`), Badge "Buka Setiap Hari".
    - Right column: Interactive responsive iframe map with rounded border, shadow, dark accent frame.
  - Responsive: single column on mobile (`sm`), 2 columns on desktop (`md`/`lg`/`xl`).

- [ ] **Step 2: Verify responsive rendering on public landing page**
  - Test at 375px (mobile), 768px (tablet), 1024px (LG), 1280px (XL), and 1920px (2XL).
  - Confirm map displays smoothly with zero overflow or layout glitches when configured, and disappears cleanly when empty.

- [ ] **Step 3: Commit Task 4**

```bash
git add app/templates/public/landing/index.html
git commit -m "feat(public): penambahan seksi interaktif Lokasi & Rute Google Maps kondisional pada beranda publik"
```

---

### Task 5: Full Regression Testing & Codebase Indexing

- [ ] **Step 1: Run full test suite**
  Run: `pytest tests/ -v`
  Expected: All tests pass.

- [ ] **Step 2: Re-index repository via MCP `codebase-memory`**
  Call: `index_repository` on `c:\Project GIT\TMBilling`.

---

## Execution Handoff

Plan complete. Two execution options:
1. **Subagent-Driven (recommended)** - Fresh subagent per task with review checkpoints.
2. **Inline Execution** - Execute tasks step-by-step in this session.

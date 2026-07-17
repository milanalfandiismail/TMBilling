# Fitur: IP Whitelist Dashboard

> **Status:** Design Final — siap implementasi
> **Tier:** C (Quick Win & Catch-Up)
> **Estimasi effort:** 🟢 ~2-3 sesi coding
> **Kategori:** Keamanan & Compliance
> **Backlog reference:** Brainstorming #77

---

## 1. Understanding Summary

- **Apa:** IP Whitelist — proteksi akses dashboard `/kasir` + endpoint API kasir berbasis IP address. Multi-IP exact format IPv4. Disimpan via SettingsService (key-value existing). UI: sub-menu baru "Whitelist IP" di dropdown Settings sidebar. PLUS bypass token untuk akses via Cloudflare Tunnel / dynamic IP dari HP.
- **Mengapa:** Mencegah akses tidak sah dari device/IP di luar kontrol warnet (PC client, device eksternal, attacker), sambil tetap memungkinkan admin remote via tunnel/dynamic IP. Security layer tambahan di samping RBAC role yang sudah ada.
- **Untuk siapa:** Admin warnet (mengelola whitelist + bypass token) & kasir (bekerja dari IP yang masuk whitelist).
- **Constraint utama:**
  - Multi-IP exact IPv4 (tidak ada CIDR, wildcard, IPv6).
  - ON by default + auto-whitelist IP server local (127.0.0.1 + LAN IP detected) saat install/first-run.
  - Bypass token: per-session (sekali valid → session cookie → request berikutnya tanpa token).
  - Token invalidate otomatis saat regenerate (semua sesi HP yang aktif logout).
  - Trust once: saat admin redirect dari IP baru yang belum di whitelist, tampilkan prompt "Tambahkan IP ini?" dengan 1-klik.
  - Self-referential lock: hanya IP whitelisted atau session-authenticated yang boleh edit whitelist (mencegah admin yang punya kredensial curian dari IP luar mengutak-atik).
  - X-Forwarded-For support (untuk deploy di belakang Nginx / Cloudflare Tunnel).
  - Log blocked attempt ke `write_log` existing dengan kategori `"IP_WHITELIST_BLOCK"`.
  - HTTP 403 + render `access_denied.html` (browser) atau JSON `{"error": "forbidden"}` (API request, detect via Accept header).
- **Non-goal:**
  - Tidak handle IPv6, CIDR, wildcard, geo-blocking, rate-limit, CAPTCHA.
  - Tidak ada per-user IP whitelist (selalu global).
  - Tidak ada audit log terpisah — pakai `write_log` existing.
  - Bypass token adalah escape hatch, bukan pengganti whitelist.

---

## 2. Data Model & Storage

### 2.1 Tabel Settings (existing — tidak ada migration)

| Key | Type | Default | Format value |
|---|---|---|---|
| `ip_whitelist_enabled` | boolean string | `"true"` | `"true"` atau `"false"` |
| `ip_whitelist` | JSON list | auto-seed | `[{"ip": "...", "added_at": "...", "label": "..."}, ...]` |
| `ip_whitelist_bypass_token` | string | auto-generate | Token URL-safe ~43 char dari `secrets.token_urlsafe(32)` |
| `ip_whitelist_token_version` | int string | `"1"` | Increment saat regenerate token |
| `app_public_url` | string | `""` | URL lengkap, mis. `https://tmbilling.example.com` |

### 2.2 Contoh nilai JSON `ip_whitelist`

```json
[
  {"ip": "127.0.0.1", "added_at": "2026-06-17T01:23:45", "label": "localhost"},
  {"ip": "192.168.1.10", "added_at": "2026-06-17T01:23:45", "label": "Server warnet"},
  {"ip": "203.0.113.45", "added_at": "2026-06-18T10:15:00", "label": "HP Admin (via tunnel)"}
]
```

### 2.3 First-run seeding

Di `install_scripts/init_db.py` (atau di `create_app()` setelah `db.create_all()`), panggil fungsi `seed_ip_whitelist(app)`:

```python
def seed_ip_whitelist(app):
    """Seed IP whitelist default jika belum ada. Idempotent."""
    from app.services import SettingsService
    import socket, json, secrets
    from app.models.base.base import db
    from app.utils.helpers import now_local

    with app.app_context():
        # 1. Enable whitelist by default
        if SettingsService.get('ip_whitelist_enabled') is None:
            SettingsService.set('ip_whitelist_enabled', 'true')

        # 2. Seed IP list dengan 127.0.0.1 + LAN IP
        if SettingsService.get('ip_whitelist') is None:
            try:
                lan_ip = socket.gethostbyname(socket.gethostname())
            except Exception:
                lan_ip = '127.0.0.1'

            default_list = [
                {"ip": "127.0.0.1", "added_at": now_local().isoformat(), "label": "localhost"},
                {"ip": lan_ip, "added_at": now_local().isoformat(), "label": "Server warnet"}
            ]
            SettingsService.set('ip_whitelist', json.dumps(default_list))

        # 3. Generate token jika belum ada
        if SettingsService.get('ip_whitelist_bypass_token') is None:
            SettingsService.set('ip_whitelist_bypass_token', secrets.token_urlsafe(32))
            SettingsService.set('ip_whitelist_token_version', '1')
```

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Client Request (Browser / Mobile / External)               │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  Flask App (create_app di app/__init__.py)                  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  @app.before_request → check_ip_whitelist()          │  │
│  │                                                       │  │
│  │  1. Path filter (skip kalau di luar scope)           │  │
│  │  2. Whitelist OFF? → allow                           │  │
│  │  3. Session ip_wh_authenticated? → allow              │  │
│  │  4. ?token= di URL valid? →                          │  │
│  │     - set session flag                               │  │
│  │     - redirect ke URL tanpa token                    │  │
│  │  5. IP in whitelist? → allow                         │  │
│  │  6. ELSE:                                            │  │
│  │     - log write_log('IP_WHITELIST_BLOCK')            │  │
│  │     - admin? → redirect ke trust-once page           │  │
│  │     - non-admin? → render access_denied.html         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Routes / Blueprints (existing)                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Middleware Logic

### 4.1 Lokasi & registrasi

`app/middleware/ip_whitelist_middleware.py` — function `check_ip_whitelist()` dipasang di `create_app()` setelah `db.init_app(app)`, sebelum blueprints registered:

```python
# app/__init__.py
from app.middleware.ip_whitelist_middleware import check_ip_whitelist

def create_app():
    app = Flask(...)
    db.init_app(app)
    csrf.init_app(app)
    app.before_request(check_ip_whitelist)  # ⬅️ BARU
    # ... blueprints ...
```

### 4.2 Flow Decision Tree

```
Request masuk
    │
    ▼
[1] Path filter — di luar scope? → ALLOW
    │ scope: /kasir/*, /api/kasir/*
    ▼
[2] Whitelist enabled? false → ALLOW
    │
    ▼
[3] Session.ip_wh_authenticated == True
    & Session.ip_wh_token_version == settings.token_version
    → ALLOW
    │
    ▼
[4] ?token= URL valid? ==
    settings.bypass_token
    → set session flags + redirect URL tanpa token
    │
    ▼
[5] Client IP (X-Forwarded-For || remote_addr)
    ∈ [entry.ip for entry in whitelist]
    → ALLOW
    │
    ▼
[6] BLOCK:
    - write_log(WARNING, 'IP_WHITELIST_BLOCK', ...)
    - admin login? → redirect /kasir/settings/whitelist-ip?add_ip=X
    - non-admin/anonymous → access_denied.html (403) atau JSON 403
```

### 4.3 Helper functions

```python
def get_client_ip():
    """X-Forwarded-For first IP, fallback remote_addr."""
    xff = request.headers.get('X-Forwarded-For')
    if xff:
        return xff.split(',')[0].strip()
    return request.remote_addr or '0.0.0.0'

def is_path_in_scope(path):
    SCOPED_PREFIXES = ('/kasir/', '/api/kasir/')
    return any(path.startswith(p) for p in SCOPED_PREFIXES)

def get_whitelisted_ips():
    raw = SettingsService.get('ip_whitelist', '[]')
    try:
        entries = json.loads(raw)
        return [e['ip'] for e in entries if 'ip' in e]
    except (json.JSONDecodeError, TypeError):
        return []
```

### 4.4 Block response logic

```python
def block_request(reason):
    ip = get_client_ip()
    write_log(level='WARNING', category='IP_WHITELIST_BLOCK',
              message=f"IP {ip} blocked: {reason} | path: {request.path}")
    
    # Admin? Trust once flow
    if session.get('user_id') and session.get('role') == 'admin':
        return redirect(f"/kasir/settings/whitelist-ip?add_ip={ip}")
    
    # Non-admin / anonymous
    if request.accept_mimetypes.best == 'application/json' or \
       request.path.startswith('/api/'):
        return jsonify({'error': 'forbidden', 'ip': ip}), 403
    return render_template('public/access_denied.html', ip=ip), 403
```

---

## 5. API Endpoints

**Route prefix:** `/api/v1/kasir/settings/ip-whitelist`

Semua endpoint pakai chain: `@admin_required` (existing) + `@ip_whitelist_admin_required` (decorator baru).

| # | Method | Endpoint | Fungsi |
|---|---|---|---|
| 1 | GET | `/api/v1/kasir/settings/ip-whitelist` | List semua IP entries |
| 2 | POST | `/api/v1/kasir/settings/ip-whitelist` | Tambah IP baru |
| 3 | DELETE | `/api/v1/kasir/settings/ip-whitelist/<ip>` | Hapus IP |
| 4 | POST | `/api/v1/kasir/settings/ip-whitelist/toggle` | Enable/disable whitelist |
| 5 | POST | `/api/v1/kasir/settings/ip-whitelist/regenerate-token` | Generate token baru |
| 6 | GET | `/api/v1/kasir/settings/ip-whitelist/status` | Status ringkas + URL token lengkap |
| 7 | POST | `/api/v1/kasir/settings/app-public-url` | Simpan domain publik tunnel |

**Plus 1 page route:**
| # | Method | Endpoint | Fungsi |
|---|---|---|---|
| 8 | GET | `/kasir/settings/whitelist-ip` | Render UI sub-menu |

### 5.1 Detail contracts

**GET list:**
```json
{ "entries": [{"ip": "...", "added_at": "...", "label": "..."}, ...] }
```

**POST add (body):**
```json
{ "ip": "192.168.1.30", "label": "PC Kasir" }
```
Response 200 / 400 (invalid IP) / 409 (duplicate).

**DELETE /<ip>:**
- Response 200 / 400 (invalid IP / last-IP-removal) / 404 (not found).
- Last-IP-removal protection: tidak boleh hapus IP terakhir (lockout prevention).

**POST toggle (body):**
```json
{ "enabled": true }
```

**POST regenerate-token:**
Response:
```json
{ "success": true, "token": "...", "version": 2 }
```
Token full di-return agar admin bisa langsung copy. Log `WARNING, IP_WHITELIST_TOKEN_REGEN` (semua sesi invalidate).

**GET status:**
```json
{
  "enabled": true,
  "current_ip": "192.168.1.50",
  "count": 3,
  "token_masked": "T8xK...9aB3",
  "full_url": "https://tmbilling.example.com/kasir?token=T8xK2p...9aB3c",
  "public_url": "https://tmbilling.example.com"
}
```

**POST app-public-url (body):**
```json
{ "url": "https://tmbilling.example.com" }
```

### 5.2 Decorator baru

```python
from functools import wraps
from flask import session, jsonify

def ip_whitelist_admin_required(f):
    """Decorator: butuh admin login + IP whitelist access."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # 1. Admin login?
        if not session.get('user_id') or session.get('role') != 'admin':
            return jsonify({'error': 'unauthorized'}), 401
        
        # 2. IP guard: dari IP whitelisted ATAU session-authenticated
        ip = get_client_ip()
        whitelisted_ips = get_whitelisted_ips()
        
        is_ip_ok = ip in whitelisted_ips
        is_session_ok = (session.get('ip_wh_authenticated') == True and
                        session.get('ip_wh_token_version') == 
                        int(SettingsService.get('ip_wh_token_version', '1')))
        
        if not (is_ip_ok or is_session_ok):
            write_log('WARNING', 'IP_WHITELIST_BLOCK', 
                      f"Admin blocked from editing whitelist. IP: {ip}")
            return jsonify({'error': 'forbidden', 'ip': ip}), 403
        
        return f(*args, **kwargs)
    return decorated
```

---

## 6. UI / Frontend

### 6.1 Halaman UI — `/kasir/settings/whitelist-ip`

Sections:
1. **Status & toggle** — show ON/OFF switch, info "Whitelist IP Enabled/Disabled".
2. **Akses remote (via tunnel)** — input `app_public_url` + tampilkan full URL token + tombol copy + QR code.
3. **Regenerate token** — button + warning modal.
4. **Daftar IP** — table dengan IP, label, added_at, tombol hapus.
5. **Tambah IP baru** — form (input IP + label).
6. **Trust once banner** — muncul jika URL punya `?add_ip=X` param.

### 6.2 Library QR code

Pakai `qrcodejs` via CDN (~10KB):
```html
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
```

### 6.3 Sidebar sub-menu

Tambah entry di `app/templates/kasir/components/sidebar.html` di dalam dropdown Settings:

```html
<a href="/kasir/settings/whitelist-ip" 
   data-tab="whitelist-ip"
   class="...">
  🛡️ Whitelist IP
</a>
```

### 6.4 Halaman Access Denied

`app/templates/public/access_denied.html` — dark theme Tailwind, tampilkan IP user + pesan. Standalone (tidak butuh base template kasir).

### 6.5 JS module

`app/static/js/kasir/modules/settings/whitelist_ip.js` — handler untuk refresh list, add, remove, toggle, regenerate, save public URL.

---

## 7. Security Considerations

1. **Last-IP-removal protection** — tidak boleh hapus IP terakhir di whitelist (mencegah admin lockout tanpa sadar).
2. **Self-referential lock** untuk edit whitelist — admin harus dari IP whitelisted ATAU session-authenticated via token.
3. **Token regenerate invalidation** — saat token baru di-generate, semua sesi existing (yang authenticated via token lama) otomatis logout.
4. **X-Forwarded-For trust** — header dipercaya (low risk untuk warnet deploy sendiri). Dokumentasi: kalau deploy di belakang multi-hop proxy chain, admin perlu set trusted proxy chain.
5. **Log audit trail** — semua blocked attempt di-log dengan IP, path, method, user_agent, timestamp.
6. **Token storage** — disimpan plain (bukan hashed) di Settings karena admin perlu lihat/copy value. Access ke token hanya via authenticated admin session.
7. **CSRF compatibility** — middleware tidak interfere dengan CSRF. CSRF exemptions existing (client_bp, auth_bp, monitor_bp, shift_bp) tetap berlaku karena path filter skip path di luar scope.

---

## 8. Decision Log

| # | Keputusan | Alternatif | Alasan |
|---|---|---|---|
| D1 | Path scope = `/kasir/*` + `/api/kasir/*` saja | Semua API endpoint dilindungi | Default aman per Q2; endpoint operasional (report, sesi, paket) dipanggil dari browser/IP yang sama dengan dashboard |
| D2 | Bypass token per-session dengan invalidation on regenerate | Per-request (tiap request harus attach token) | Per-session lebih nyaman (Q1: 1x attach, abis itu bookmark biasa); per-request terlalu ribet untuk mobile |
| D3 | Trust once untuk admin IP baru | Langsung block; atau auto-add tanpa prompt | Trust once (Q3) sweet spot — tidak lockout, tetap ada konfirmasi eksplisit |
| D4 | X-Forwarded-For parsing dengan fallback ke remote_addr | Hanya remote_addr | Support deploy di balik Nginx/Cloudflare Tunnel (common untuk warnet online) |
| D5 | SettingsService untuk storage (5 keys) | Tabel baru dedicated | Pakai existing key-value table, no migration needed |
| D6 | Tambah Settings key `app_public_url` untuk tunnel domain | Auto-detect dari Host header | Admin perlu set manual karena bisa ada multiple access mode (LAN + tunnel) |
| D7 | `app_public_url` fallback ke `request.host_url` | Selalu auto-detect | Fallback supaya fitur tetap jalan kalau admin belum set |
| D8 | Tidak ada DB migration, pakai existing Settings table | Tabel baru `ip_whitelist_entries` | Existing infrastructure cukup; format JSON list compact |
| D9 | Opsi A: middleware `before_request` global dengan path filter | Decorator per endpoint / Blueprint-level hook | Paling simpel, terpusat, scalable |
| D10 | Library QR: qrcodejs via CDN | Server-side generate QR | CDN = no Python dep, simple |
| D11 | Last-IP-removal protection | Allow remove tanpa check | Lockout prevention |
| D12 | Token disimpan plain di Settings (bukan hashed) | Hashed seperti password | Admin perlu lihat/copy token; hashed = admin tidak bisa recover value |
| D13 | IP log ke `write_log` existing dengan kategori `IP_WHITELIST_BLOCK` | Tabel log terpisah | Pakai existing logging infrastructure, searchable di tab Log |

---

## 9. Risks & Mitigation

| Risk | Mitigation |
|---|---|
| Admin lockout (lupa IP, lupa token) | (1) Auto-seed `127.0.0.1` + LAN IP saat first-run. (2) Last-IP-removal protection. (3) Trust once untuk admin IP baru. (4) Bypass token adalah escape hatch via dynamic URL/QR. (5) Emergency: edit `settings.ip_whitelist` row manual via DB shell. |
| Bypass token bocor | Admin bisa regenerate dari UI; sesi lama otomatis logout. Regenerate sering untuk safety. |
| X-Forwarded-For spoofing | Admin deploy sendiri, low risk. Untuk high-security, pakai ProxyFix middleware dengan trusted proxy chain. |
| Performa (cek DB tiap request) | 5 keys di-cache saat first-access dengan invalidation saat update. Untuk skala kecil-menengah warnet (< 100 req/s), overhead negligible. |
| Migrasi ke DB baru (existing install tanpa 5 keys) | `seed_ip_whitelist()` idempotent — detect `is None` lalu create. Aman di re-run. |

---

## 10. Testing Checklist

- [ ] First-run seed: 3 row baru di tabel settings (`ip_whitelist_enabled`, `ip_whitelist`, `ip_whitelist_bypass_token`, `ip_whitelist_token_version`).
- [ ] Default whitelist berisi `127.0.0.1` + LAN IP server.
- [ ] Token tergenerate otomatis, ~43 char URL-safe.
- [ ] Akses `/kasir` dari IP whitelisted → success.
- [ ] Akses `/kasir` dari IP non-whitelisted → redirect ke trust-once (admin) atau access_denied (non-admin).
- [ ] Akses `/kasir?token=xxx` dari IP mana saja → set session, redirect ke URL tanpa token.
- [ ] Subsequent request dari session-authenticated browser → IP check skip.
- [ ] Toggle whitelist OFF → semua IP bisa akses.
- [ ] Toggle whitelist ON → block kembali.
- [ ] Tambah IP baru via UI → muncul di list, log ditulis.
- [ ] Tambah IP duplikat → 409 error.
- [ ] Tambah IP invalid (bukan IPv4) → 400 error.
- [ ] Hapus IP terakhir → 400 error (lockout prevention).
- [ ] Hapus IP yang ada → hilang dari list, log ditulis.
- [ ] Regenerate token → token baru di-generate, token_version naik, full URL baru.
- [ ] Regenerate token → sesi lama dari token lama auto-logout (cek via `token_version` mismatch).
- [ ] Set `app_public_url` → full URL token menggunakan domain tsb.
- [ ] Kosongkan `app_public_url` → full URL fallback ke `request.host_url`.
- [ ] QR code di-render dengan URL yang benar.
- [ ] Log blocked attempt muncul di tab Log dengan kategori `IP_WHITELIST_BLOCK`.
- [ ] Akses endpoint publik (`/`, `/livepc`, `/paket`, `/spesifikasi`, `/api/auth`, dll) → tidak kena filter.
- [ ] X-Forwarded-For di-respect: IP dari header (bukan `remote_addr` proxy).
- [ ] Trust once: admin redirect ke `/kasir/settings/whitelist-ip?add_ip=X` → banner muncul, klik tambah → IP masuk list, dashboard accessible.

---

## 11. Implementation Order

Lihat `implementation_plan.md` untuk detail langkah eksekusi.

---
*TMBilling v1.4.4*

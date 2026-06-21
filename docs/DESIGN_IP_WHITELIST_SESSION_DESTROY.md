# IP Whitelist — Auto Destroy Session & Redirect

## 1. Problem

**Saat ini:**
- User sudah login dari IP yang ada di whitelist
- IP user dihapus dari whitelist oleh admin
- User mendapatkan halaman `access_denied.html` (403)
- Tapi **session user masih aktif** — user bisa refresh dan masih lihat dashboard kasir

**Yang diinginkan:**
- User harus di-redirect ke halaman `access_denied.html`
- Session user harus dihancurkan
- User tidak bisa akses dashboard kasir lagi setelah IP dihapus

---

## 2. Understanding Summary

- **Apa:** Auto-destroy session user saat IP tidak lagi di whitelist
- **Mengapa:** Mencegah user yang IP-nya dihapus dari whitelist tetap bisa akses system
- **Untuk siapa:** Semua user yang login (admin & kasir)
- **Batasan:**
  - Hanya destroy session user yang IP-nya tidak di whitelist
  - Tidak destroy semua session (user lain dengan IP berbeda tetap aman)
  - Tidak berdampak ke bypass token sessions
- **Tidak dibuat:**
  - Tidak create halaman baru (pakai `access_denied.html` yang sudah ada)
  - Tidak create fungsi logging baru (pakai `write_log()` yang sudah ada)
  - Tidak create tabel database baru (pakai tabel yang sudah ada)

---

## 3. Assumptions

- Database as single source of truth
- Session data tersimpan di Flask session (secure cookie)
- Cache query result dengan TTL 5 detik untuk performan
- Jika query database gagal, fallback ke empty list
- Logging menggunakan `write_log()` yang sudah ada
- Middleware otomatis mendeteksi perubahan IP whitelist (live query)

---

## 4. Design

### 4.1 Architecture Overview

```
IP whitelist diubah (add/remove/toggle) oleh admin
         ↓
Update cache version + IP list
         ↓
Middleware @app.before_request (STEP 5)
         ↓
Check IP whitelist dengan cache (TTL 5 detik)
         ↓
    ┌────┴────┐
    │         │
  Ada       Tidak
  session   session
    │         │
    ↓         ↓
Destroy    Return 403
session     (access_denied)
 + log         |
 + redirect    ↓
    │       Access Denied
    ↓         page
Access Denied
page (pesan
session
dihancurkan)
```

### 4.2 Cache Management (TTL 5 detik)

```python
# In-memory cache
ip_whitelist_cache = {
    "enabled": True,
    "version": 1,
    "ip_list": ["127.0.0.1", "192.168.1.100"],
    "last_updated": "2026-06-20 23:00:00"
}

# Query dengan caching (TTL 5 detik)
def get_ip_whitelist_with_cache():
    cache_key = "ip_whitelist_result"
    cached_result = cache.get(cache_key)
    if cached_result and is_valid_cache(cached_result, ttl=5):
        return cached_result
    result = query_ip_whitelist_from_db()  # SELECT ip FROM ip_whitelist
    cache.set(cache_key, result, ttl=5)
    return result
```

### 4.3 Middleware — STEP 5 Enhanced

```python
# =========================================================================
# STEP 5: BLOCK — dengan session destroy
# =========================================================================
username = flask_session.get('kasir_username',
                              flask_session.get('kasir_nama', 'anonymous'))
user_role = flask_session.get('kasir_role', '')
session_destroy = False

# Jika user memiliki session aktif, hancurkan
if 'kasir_id' in flask_session:
    write_log(
        aksi='IP_WHITELIST_SESSION_DESTROY',
        detail=f"Session user {username} ({user_role}) dari IP {client_ip} "
               f"dihancurkan karena IP dihapus dari whitelist",
        user=username
    )
    flask_session.clear()
    flask_session.modified = True
    session_destroy = True
    username = flask_session.get('kasir_username', 'anonymous')

# Log block (selalu)
write_log(
    aksi='IP_WHITELIST_BLOCK',
    detail=f"IP {client_ip} diblokir mengakses {request.path} (method: {request.method})",
    user=username
)

if request.accept_mimetypes.best == 'application/json' or request.path.startswith('/api/'):
    return jsonify({'error': 'forbidden', 'ip': client_ip}), 403

return render_template('public/access_denied.html', ip=client_ip,
                       session_destroy=session_destroy), 403
```

### 4.4 Halaman Error (access_denied.html — update)

```html
{% extends "public/base.html" %}
{% block content %}
<div class="error-page">
    {% if session_destroy %}
        <h1>Session Dihancurkan</h1>
        <p>Session Anda telah dihancurkan karena IP Anda tidak lagi
           termasuk dalam whitelist.</p>
        <p>IP: {{ ip }}</p>
    {% else %}
        <h1>Akses Ditolak</h1>
        <p>IP {{ ip }} tidak diizinkan mengakses dashboard kasir.</p>
    {% endif %}
    <a href="/kasir/">Kembali ke Login</a>
</div>
{% endblock %}
```

---

## 5. Error Handling & Edge Cases

| Skenario | Throw | Catch |
|----------|-------|-------|
| Session tidak ada | KeyError | Ignore, lanjut ke block |
| Query database gagal | Exception | Fallback ke empty list |
| Logging gagal | Exception | Console.log + lanjut |
| User di settings page | Skip | Biarkan admin update |
| User dengan bypass token | Skip | Tidak destroy session |
| Multiple concurrent requests | Race condition | Cache handling |

---

## 6. Testing Strategy

| Test | Steps | Expected |
|------|-------|----------|
| IP dihapus → session destroy | Login → hapus IP → refresh | Session hilang + redirect |
| User lain tetap aman | User A dihapus → User B refresh | User B tetap akses |
| Admin kena juga | Admin login → IP admin dihapus | Session admin dihancurkan |
| Bypass token aman | Akses via token → hapus IP | Tetap akses |
| Logging OK | Session destroy terjadi | Log `IP_WHITELIST_SESSION_DESTROY` di warnet.log |

---

## 7. Decision Log

| # | Keputusan | Alternatif | Alasan |
|---|-----------|------------|--------|
| 1 | Event-Based Cache (TTL 5 detik) | Polling, Database Trigger | No delay, no race condition |
| 2 | Database Query + Caching | Cache Permanent | Robust saat server restart |
| 3 | Hanya destroy session IP tidak di whitelist | Destroy semua session | Mencegah ganggu user lain |
| 4 | Pakai `write_log()` | Fungsi baru | Konsisten dengan pola logging |
| 5 | Pakai `access_denied.html` | Halaman baru | Tidak perlu create halaman baru |
| 6 | Middleware-enhanced (STEP 5) | Service baru | Minimal perubahan kode |

---

## 8. Files to Modify

| File | Action |
|------|--------|
| `app/middleware/ip_whitelist_middleware.py` | Modify STEP 5 (session destroy + log) |
| `app/templates/public/access_denied.html` | Update (session_destroy flag + pesan beda) |

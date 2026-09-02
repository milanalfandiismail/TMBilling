# Spec: VNC Token Multiplexing for Unified Direct & Tunnel Remote Control

## 1. Problem Statement
Ketika kasir mengakses TMBilling melalui domain HTTPS / Cloudflare Tunnel (`https://kasir.domainanda.com`), remote control PC client malah menampilkan layar PC Server utama.

### Root Cause
1. `dashboard_detail_modal.js` baris 457–461 meng-hardcode URL WebSocket ke `wss://${window.location.host}/ws/vnc` saat protokol browser adalah `https:`, mengabaikan port spesifik client (`res.port` 8090-8150).
2. Path `/ws/vnc` pada Cloudflare Tunnel dipetakan secara statis ke port 8081 (Websockify Server).
3. Backend Websockify sebelumnya hanya mendukung mapping 1-to-1 (port ke IP tunggal), sehingga koneksi melalui single path `/ws/vnc` tidak dapat membedakan antara PC Server dan PC Client.

## 2. Target Architecture (Token Multiplexing)

Menggunakan fitur standar Websockify: `--token-plugin=TokenFile --token-source=<path_to_tokens_file>`.

Semua koneksi WebSocket (baik Remote Server maupun Remote Client PC 1..N) diarahkan ke satu port terpusat: **Port 8081** (atau subpath `/ws/vnc` saat melewati Tunnel/HTTPS).

### File Token Target (`instance/vnc_tokens.cfg`)
Format baris:
```
server: 127.0.0.1:5900
client_1: 192.168.1.101:5900
client_2: 192.168.1.102:5900
```

### URL WebSocket Mapping

| Tipe Remote | Direct Connection (HTTP) | Tunnel Connection (HTTPS) |
| :--- | :--- | :--- |
| **Remote Server** | `ws://<ip_server>:8081/?token=server` | `wss://<domain>/ws/vnc?token=server` |
| **Remote Client PC #ID** | `ws://<ip_server>:8081/?token=client_<id>` | `wss://<domain>/ws/vnc?token=client_<id>` |

## 3. Scope & Changes

1. **`app/services/vnc/vnc_service.py`**:
   - Menambahkan pengelola thread-safe file token `vnc_tokens.cfg` di dalam folder `instance/`.
   - Mengubah parameter `ensure_websockify_running()` untuk menggunakan `--token-plugin=TokenFile --token-source=<token_file> 0.0.0.0:8081`.
   - `VNCClientProxyService`: Mendaftarkan token `client_<pc_id>: <client_ip>:5900` saat remote client dimulai, dan menghapus baris token saat remote dihentikan.
   - Tetap menjaga single daemon Websockify di port 8081 sehingga menghemat CPU dan RAM (tidak perlu spawn subprocess Python per client).

2. **`app/routes/vnc/vnc_routes.py` & `app/routes/monitor/monitor_routes.py`**:
   - Endpoint `/vnc_client/<int:pc_id>/start` mengembalikan `token: "client_<pc_id>"` dan `listen_port: 8081`.
   - Endpoint `/vnc/start` mengembalikan `token: "server"` dan `listen_port: 8081`.

3. **`app/static/js/kasir/modules/remote/vnc_client.js`**:
   - Menyusun URL WebSocket dengan query parameter `?token=${res.token || 'server'}` untuk mode HTTP maupun HTTPS.

4. **`app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`**:
   - Menyusun URL WebSocket dengan query parameter `?token=${res.token || 'client_' + pcId}` untuk mode HTTP maupun HTTPS.

5. **`tests/test_vnc_client_proxy.py` & `tests/test_monitor_vnc_routes.py`**:
   - Menyesuaikan dan menambahkan unit test untuk verifikasi token generation, token lifecycle, dan route responses.

## 4. Non-Goals
- Tidak mengubah protokol RFB / TightVNC di sisi Rust agent `TMBilling_Monitor`.
- Tidak mengubah antrean command polling `vnc_start` dan `vnc_stop`.

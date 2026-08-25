# Spesifikasi Desain — Remote Control Per Client

**Tanggal:** 25 Agustus 2026  
**Status:** In Review  
**Target Subsystem:** Remote Control per Client PC dari Dashboard Kasir

---

## 1. Ringkasan

Fitur ini memungkinkan kasir meremote layar **setiap PC client warnet** secara on-demand langsung dari Dashboard PC Detail Modal. Berbeda dengan Remote Control Server yang sudah ada (meremote PC Server sendiri), fitur ini menargetkan PC client yang menjalankan WarnetAgent.

### 1.1 Keputusan Arsitektur

| Keputusan | Pilihan | Alasan |
|---|---|---|
| VNC Server di Client | TightVNC Server **portable** (tanpa install/service/startup) | Ringan, tidak perlu install manual, dijalankan on-demand oleh agent |
| Lokasi Binary | `C:\TMBilling\TightVNC\tvnserver.exe` | Folder standar TMBilling di setiap client |
| Transport Proxy | **Websockify terpusat** di server Flask | Single entry point, mudah dikelola, browser hanya perlu connect ke server |
| UI Placement | **Dashboard PC Detail Modal** | Integrasi natural — kasir klik detail PC → tombol Remote |
| Password VNC | **Global** dari `SettingsService.get("vnc_password")` | Sudah ada infrastruktur, konsisten dengan Remote Server |

---

## 2. Alur Sistem End-to-End

```
┌─────────────────────────────────────────────────────────────┐
│                    KASIR (Browser)                           │
│                                                             │
│  Dashboard → Detail PC Modal → Klik "Remote"                │
│       ↓                                                     │
│  POST /api/v1/kasir/monitor/remote/<pc_id>/vnc_start        │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌──────────────────────────┴──────────────────────────────────┐
│                   SERVER FLASK                               │
│                                                             │
│  1. Validasi PC exists + online (last_activity < 30s)       │
│  2. Queue command "vnc_start" ke PENDING_COMMANDS[pc_id]    │
│  3. Polling tunggu agent confirm VNC ready (max 15s)        │
│  4. Jalankan websockify: 0.0.0.0:<port> → <client_ip>:5900 │
│  5. Return { ws_url, port } ke browser                      │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌──────────────────────────┴──────────────────────────────────┐
│              TMBILLING_MONITOR (Client Agent - Rust)         │
│                                                             │
│  1. Polling /api/v1/client/status → terima command          │
│  2. Terima "vnc_start":                                     │
│     a. Cek apakah tvnserver.exe sudah berjalan              │
│     b. Jika belum, launch tvnserver.exe portable mode       │
│        dengan password dari parameter command                │
│     c. Tunggu port 5900 open (max 5s)                       │
│     d. Report status "vnc_ready" ke server                   │
│  3. Terima "vnc_stop":                                      │
│     a. Kill tvnserver.exe process                           │
│     b. Report status "vnc_stopped"                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Sequence Diagram

```
Kasir          Server Flask       TMBilling_Monitor       TightVNC
  │                │                     │                    │
  │── POST vnc_start ──►                 │                    │
  │                │── queue "vnc_start" ─►                   │
  │                │                     │── launch tvnserver ─►
  │                │                     │◄── port 5900 open ──│
  │                │◄── POST vnc_ready ──│                    │
  │                │── start websockify ─►(proxy on port 809X)│
  │◄── { ws_url } ─│                     │                    │
  │── ws connect ──►(websockify) ────────────────────────────►│
  │◄── RFB frames ─────────────────────────────────────────── │
  │                │                     │                    │
  │── disconnect ──►                     │                    │
  │                │── kill websockify   │                    │
  │                │── queue "vnc_stop" ─►                    │
  │                │                     │── kill tvnserver ──►│
```

---

## 3. Komponen & File Changes

### 3.1 Server-Side (Python/Flask)

#### 3.1.1 VNC Service — `app/services/vnc/vnc_service.py`

**Penambahan:**

```python
class VNCClientProxyService:
    """Mengelola proxy websockify per-client PC."""
    
    # Port pool untuk client VNC proxies (8090-8150)
    PORT_RANGE_START = 8090
    PORT_RANGE_END = 8150
    
    # Active proxies: { pc_id: { process, port, client_ip, started_at } }
    _active_proxies = {}
    
    # VNC readiness flags: { pc_id: True/False }
    _vnc_ready_flags = {}
```

**Fungsi utama:**
- `start_client_proxy(pc_id, client_ip, vnc_password)` → Alokasi port dari pool, jalankan websockify, return port
- `stop_client_proxy(pc_id)` → Kill websockify process, free port
- `get_active_proxy(pc_id)` → Return info proxy aktif jika ada
- `set_vnc_ready(pc_id, ready)` → Flag bahwa client VNC sudah siap
- `wait_vnc_ready(pc_id, timeout=15)` → Blocking wait sampai client report ready
- `cleanup_stale_proxies()` → Bersihkan proxy yang idle > 10 menit

#### 3.1.2 Monitor Routes — `app/routes/monitor/monitor_routes.py`

**Endpoint baru:**

| Method | Path | Fungsi |
|---|---|---|
| POST | `/remote/<pc_id>/vnc_start` | Trigger VNC start di client + launch proxy |
| POST | `/remote/<pc_id>/vnc_stop` | Trigger VNC stop di client + kill proxy |
| GET | `/remote/<pc_id>/vnc_status` | Cek status proxy aktif untuk PC |

#### 3.1.3 Client Routes — `app/routes/client/client_routes.py`

**Modifikasi:**
- Endpoint `/status` response sudah menyertakan `command` dari `PENDING_COMMANDS` — tidak perlu perubahan di sini
- **Endpoint baru** `POST /api/v1/client/vnc_ready` — Agent report bahwa VNC Server sudah aktif di port 5900

#### 3.1.4 Client Service — `app/services/client/client_service.py`

**Modifikasi `PENDING_COMMANDS`:**
- Ubah value dari `string` menjadi `dict` untuk mendukung parameter tambahan:
  ```python
  # Sebelum: PENDING_COMMANDS[pc_id] = "vnc_start"
  # Sesudah: PENDING_COMMANDS[pc_id] = {"type": "vnc_start", "vnc_password": "xxx"}
  ```
- Backward compatible — command lama (string) tetap berfungsi

### 3.2 Client-Side Agent (Rust)

#### 3.2.1 TMBilling_Monitor — `WarnetAgent/TMBilling_Monitor/src/main.rs`

**Penambahan:**
- Handler untuk command `vnc_start`:
  1. Cek apakah `C:\TMBilling\TightVNC\tvnserver.exe` exists
  2. Jalankan TightVNC portable mode dengan parameter CLI:
     ```
     tvnserver.exe -controlservice -connect
     ```
     Atau mode application (non-service):
     ```
     tvnserver.exe -run -rfbport 5900 -localhost- 
     ```
  3. Set password via registry atau parameter (TightVNC portable mode)
  4. Tunggu port 5900 open (loop cek max 5 detik)
  5. POST ke server `/api/v1/client/vnc_ready` untuk konfirmasi

- Handler untuk command `vnc_stop`:
  1. Kill process `tvnserver.exe`
  2. Report status ke server

**Catatan TightVNC Portable Mode:**
- TightVNC Server mendukung mode `-run` (application mode, bukan service)
- Password bisa di-set via registry `HKCU\Software\TightVNC\Server` sebelum launch
- Tidak memerlukan instalasi, tidak masuk startup

### 3.3 Frontend (JavaScript/HTML)

#### 3.3.1 VNC Client Refactor — `app/static/js/kasir/modules/remote/vnc_client.js`

**Refactor:**
- Extract logic koneksi VNC menjadi fungsi yang menerima parameter:
  ```javascript
  // Sebelum: VNCClient.connect() — hardcoded ke server VNC
  // Sesudah: VNCClient.connectTo(wsUrl, password, targetElement)
  ```
- `connect()` existing tetap berfungsi (backward compatible) — memanggil `connectTo()` internally
- `connectTo(wsUrl, password, targetElement)` — generic connect ke target apapun

#### 3.3.2 Dashboard Detail Modal — `app/static/js/kasir/modules/dashboard/detail_modal.js`

**Penambahan:**
- Tombol "🖥️ Remote" di panel action (hanya muncul jika PC online)
- State machine: `idle` → `connecting` → `connected` → `disconnecting`
- Fungsi `startRemote(pcId)`:
  1. POST ke `/remote/<pc_id>/vnc_start`
  2. Terima `ws_url` dari response
  3. Render VNC canvas di area modal
  4. Connect via `VNCClient.connectTo()`
- Fungsi `stopRemote(pcId)`:
  1. Disconnect VNC
  2. POST ke `/remote/<pc_id>/vnc_stop`
  3. Kembalikan modal ke state normal

#### 3.3.3 Dashboard Detail Modal HTML — `app/templates/kasir/components/pc_detail_modal.html`

**Penambahan:**
- Container untuk VNC canvas (`#remote-client-screen`)
- Toolbar: Scale toggle, Fullscreen, Keyboard, Disconnect
- Status badge remote
- Transition smooth antara "detail view" dan "remote view"

---

## 4. Port Management

```
Server VNC (existing):     Port 8081 (websockify → 127.0.0.1:5900)
Client VNC Pool:           Port 8090-8150 (websockify → <client_ip>:5900)

Maximum concurrent remote: 60 client (8150 - 8090)
```

### 4.1 Port Allocation Strategy

```python
def _allocate_port(self):
    """Cari port bebas di range 8090-8150."""
    used_ports = {info['port'] for info in self._active_proxies.values()}
    for port in range(self.PORT_RANGE_START, self.PORT_RANGE_END + 1):
        if port not in used_ports and not self.is_port_open('127.0.0.1', port):
            return port
    return None  # Pool penuh
```

### 4.2 Automatic Cleanup

- **Stale proxy cleanup**: Scheduler task setiap 60 detik, kill proxy yang idle > 10 menit
- **On disconnect**: Immediate cleanup saat kasir disconnect
- **On PC offline**: Jika PC last_activity > 30 detik saat ada proxy aktif → cleanup

---

## 5. Security

| Layer | Mekanisme |
|---|---|
| Dashboard Auth | `@login_required` + `@admin_required` — hanya admin kasir |
| Agent Auth | API Key header (`X-Client-Key`) — sudah existing |
| VNC Password | Global password dari settings DB — konsisten |
| Network | Websockify hanya listen di `0.0.0.0` pada port pool tertentu |
| TightVNC Portable | Password di-set runtime via registry key sebelum launch, di-clean setelah stop |

---

## 6. Backward Compatibility

| Komponen | Impact |
|---|---|
| Remote Control Server (existing) | **Tidak terpengaruh** — tetap menggunakan port 8081, logic terpisah |
| `PENDING_COMMANDS` | Backward compatible — command string lama tetap berjalan |
| `vnc_client.js` | `connect()` tetap berfungsi seperti sebelumnya |
| TMBilling_Monitor | Command baru ditambahkan — command lama (screenshot, shutdown, restart) tidak berubah |
| Database | **Tidak ada perubahan schema** — menggunakan in-memory state saja |

---

## 7. Error Handling

| Skenario | Handling |
|---|---|
| `tvnserver.exe` tidak ditemukan di client | Toast error: "TightVNC belum tersedia di PC [kode]. Letakkan di C:\TMBilling\TightVNC\" |
| Client PC offline | Toast error: "PC [kode] tidak merespon. Pastikan PC menyala dan terhubung" |
| VNC tidak ready dalam 15 detik | Timeout → cleanup → Toast error |
| Port pool habis | Toast error: "Terlalu banyak sesi remote aktif. Tutup sesi remote lain terlebih dahulu" |
| Websockify gagal start | Cleanup → Toast error dengan detail |

---

## 8. Verification Plan

### 8.1 Automated Tests
- Test port allocation/deallocation logic
- Test command queueing backward compatibility (string vs dict)
- Test VNC ready flag set/wait mechanism
- Test stale proxy cleanup logic

### 8.2 Manual Verification
- Klik Remote di Dashboard Detail → VNC canvas muncul dan connect
- Toggle scale, fullscreen, keyboard di remote client view
- Disconnect → VNC server di client ter-kill, port freed
- Multiple concurrent remotes (2-3 PC sekaligus)
- PC offline saat remote → error handling graceful
- Remote Control Server (existing) tetap berfungsi normal

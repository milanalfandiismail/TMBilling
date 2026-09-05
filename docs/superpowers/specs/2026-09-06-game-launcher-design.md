# Game Launcher System Design

**Tanggal:** 2026-09-06
**Status:** Approved
**Author:** Antigravity

---

## Latar Belakang

TMBilling sudah memiliki sistem manajemen game di server (model `Game`, `GameService`, admin CRUD routes). Namun saat ini `exe_path` harus diisi manual (rawan typo), dan tidak ada cara bagi PC klien di warnet untuk langsung membuka daftar game dan meluncurkannya.

Fitur ini menambahkan dua bagian:
1. **Server**: endpoint API untuk klien + file picker `.exe` di form admin game
2. **Client (Tauri)**: aplikasi Game Launcher baru (`WarnetClient/GameLauncher/`) yang fetch game dari server dan launch via `std::process::Command`

---

## Arsitektur

```
[Server Flask]
  ├── GET /api/v1/public/client/games  ← baru (auth: X-Client-Key)
  │     return: list game aktif (id, nama, kategori, exe_path, argumen, icon_url)
  │
  └── Kasir Admin Panel (UI)
        └── Form Tambah/Edit Game
              └── Tombol "Browse .exe" ← baru
                    ↓
              Modal File Picker (reuse /api/v1/kasir/fileexplorer/list)
              Filter: tampilkan folder + .exe saja
              User klik .exe → isi field exe_path otomatis

[Client - GameLauncher Tauri App]  ← baru: WarnetClient/GameLauncher/
  ├── Config: Registry/config.ini (pola sama seperti TMBillingTauri)
  ├── Rust Backend
  │   ├── get_games()  → fetch GET /api/v1/public/client/games
  │   └── launch_game(exe_path, argumen) → std::process::Command::spawn()
  └── Webview UI
        ├── Grid kartu game (icon, nama, kategori)
        ├── Filter kategori
        ├── Tombol "Main" per kartu
        └── State: loading / error koneksi / game tidak ada di PC ini
```

---

## Detail Komponen

### 1. Server: Endpoint Games untuk Client

**File:** `app/routes/client/client_routes.py`

Tambahkan endpoint baru di Blueprint yang sudah ada menggunakan decorator `@api_key_required` yang sudah ada:

```python
@client_api_bp.route("/games", methods=["GET"])
@api_key_required
def get_client_games():
    games = GameService.get_all(aktif_only=True)
    return jsonify({"success": True, "data": [g.to_dict() for g in games]}), 200
```

URL: `GET /api/v1/public/client/games`
Auth: `X-Client-Key` header (decorator `api_key_required` sudah ada)
Response field kritis: `exe_path`, `argumen`, `icon_url` (semua sudah ada di `Game.to_dict()`)

---

### 2. Server: File Picker Modal di Admin Game

Tidak perlu endpoint baru — reuse `/api/v1/kasir/fileexplorer/list`.

Alur:
1. Admin klik tombol "Browse" di samping field `exe_path`
2. Modal terbuka, fetch `GET /api/v1/kasir/fileexplorer/list` (default path = root)
3. Tampilkan: folder (dapat diklik masuk) + file `.exe` saja (filter client-side)
4. User klik file `.exe` → modal tutup → field `exe_path` diisi otomatis

Security: fileexplorer sudah ada guard admin-only + allowed_roots.

Komponen yang dimodifikasi:
- JS module game admin (file picker modal sebagai component baru)
- Template game tab (tambah tombol Browse ke form)

---

### 3. Client: GameLauncher Tauri App

**Lokasi:** `WarnetClient/GameLauncher/`

**Tech Stack:**
- Tauri v1.5 (sama dengan TMBillingTauri untuk konsistensi)
- Rust: reqwest 0.11, serde, winreg 0.5 (Registry untuk baca URL + ApiKey)
- Frontend: HTML + Vanilla JS + CSS (no framework, ringan)

**Struktur file:**
```
WarnetClient/GameLauncher/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   └── src/
│       ├── main.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   └── game_commands.rs    ← get_games, launch_game
│       └── utils/
│           ├── mod.rs
│           └── api.rs              ← ApiService (minimal)
└── src/
    ├── index.html
    ├── main.js
    └── style.css
```

**Rust GameInfo struct:**
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameInfo {
    pub id: u32,
    pub nama: String,
    pub kategori: Option<String>,
    pub exe_path: Option<String>,
    pub argumen: Option<String>,
    pub icon_url: Option<String>,
}
```

**launch_game validasi:**
- Cek `exe_path` tidak kosong → `Err("Path executable tidak boleh kosong")`
- Cek `Path::new(&exe_path).exists()` → `Err("Game tidak ditemukan di PC ini: {path}")`
- Jika ada: `Command::new(&exe_path).args(argumen.split_whitespace()).current_dir(exe_dir).spawn()`

---

## Data Flow

```
Admin Server
  1. Tambah game via form → klik Browse → pilih C:\Games\PUBG\PUBG.exe di modal file picker
  2. Save: nama="PUBG", exe_path="C:\Games\PUBG\PUBG.exe", argumen=""
  3. Upload icon → /static/uploads/games/xxx.png

GameLauncher (PC Client)
  4. Buka app → load config dari Registry HKLM\Software\TMBilling (Url + ApiKey)
  5. GET /api/v1/public/client/games (header X-Client-Key)
  6. Tampilkan grid: icon dari server URL + nama + kategori
  7. User klik "Main" → JS invoke('launch_game', {exe_path, argumen})
  8. Rust: cek path exist → spawn process (game terbuka)
  9. Launcher tetap terbuka (game berjalan terpisah)
```

---

## Constraint & Asumsi

- **Exe path universal**: Semua PC warnet punya game terinstall di path yang sama (misal `C:\Games\`)
- **Icon URL**: Icon diload langsung dari URL server — tidak di-cache lokal (sesuai pendekatan ringan)
- **Scope ringan**: Launcher tidak tracking session/durasi main, tidak ada kiosk lock
- **Auth config**: GameLauncher baca Registry key `HKLM\Software\TMBilling` (Url + ApiKey) — pola identik MGCTM.exe dan TMBillingTauri
- **Tauri version**: v1.5 (sama dengan TMBillingTauri)
- **No single instance**: GameLauncher tidak perlu single-instance plugin (bisa buka multiple)


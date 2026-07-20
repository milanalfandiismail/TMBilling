# 🧩 Plugin System & Extensibility

TMBilling menggunakan arsitektur Plugin System untuk memungkinkan kustomisasi fitur kasir tanpa harus merusak atau memodifikasi *core codebase* (inti aplikasi backend). Sistem ini dirancang untuk mudah di-deploy, terisolasi dengan baik, dan *future-proof*.

## Arsitektur

### 1. Backend (Flask)
Plugin dikelola secara dinamis melalui `PluginManager` (`app/services/plugins/plugin_manager.py`).
- **Autodiscovery:** Setiap kali server Flask berjalan, `PluginManager` akan melakukan iterasi pada folder `plugins/`.
- **Manifest:** Jika folder memiliki `manifest.json` yang valid, modul Python di dalamnya (`plugin.py`) akan diimpor.
- **Blueprint Injection:** Apabila `plugin.py` mengekspos variabel Flask Blueprint (misal `plugin_bp`), blueprint tersebut akan diregistrasikan secara dinamis ke rute aplikasi (misal: `/api/plugin/<plugin_id>`).

### 2. Frontend (Kasir Dashboard)
- **Settings & Toggle:** Daftar plugin yang terdeteksi akan muncul di halaman Settings (tab Plugins). Di sini admin dapat mengaktifkan atau menonaktifkan plugin.
- **Iframe Isolation:** Jika sebuah plugin dikonfigurasi dengan `"has_frontend": true`, maka tombol "Buka Plugin" akan tersedia. Saat diklik, TMBilling akan menginjeksikan *URL entrypoint* plugin (mis. `/api/plugin/<plugin_id>/`) ke dalam elemen `<iframe id="plugin-spa-iframe">`.
- **Keamanan UI:** Dengan Iframe, gaya CSS (terutama kelas Tailwind) dan skrip JS dari plugin tidak akan "bocor" dan mengacaukan *layout* antarmuka kasir utama.

## Panduan Membuat Plugin Baru

### Langkah 1: Buat Direktori Plugin
Buat folder baru di bawah direktori `plugins/`, misal `plugins/my_custom_plugin/`.

### Langkah 2: Buat `manifest.json`
```json
{
    "id": "my_custom_plugin",
    "name": "My Custom Plugin",
    "version": "1.0.0",
    "description": "Deskripsi plugin saya.",
    "author": "Nama Developer",
    "has_frontend": true
}
```

### Langkah 3: Buat `plugin.py`
Buat file `plugin.py` dan definisikan Blueprint di dalamnya.
```python
from flask import Blueprint, render_template_string

plugin_bp = Blueprint('my_custom_plugin', __name__)

@plugin_bp.route('/')
def index():
    html = """
    <html>
        <head><title>My Plugin</title></head>
        <body style="padding: 20px;">
            <h1>Halo dari Plugin!</h1>
            <button onclick="alert('OK')">Test JS</button>
        </body>
    </html>
    """
    return render_template_string(html)
```

### Langkah 4: Muat Ulang Server
Restart server Waitress/Flask TMBilling, dan plugin baru Anda akan langsung terdeteksi di Dashboard Kasir.

## Keamanan & Akses Data

Karena plugin beroperasi di dalam modul Flask utama, plugin memiliki **akses penuh (root level) ke Python environment TMBilling**.
- Plugin dapat mengimpor model dari `app.models` (seperti `User`, `Transaksi`, `Sesi`).
- Plugin dapat melakukan kueri ke database menggunakan instance `db` bawaan.
- **PERINGATAN:** Jangan meng-install plugin dari sumber yang tidak dipercaya, karena plugin secara teori dapat mengakses dan mengubah data utama secara langsung, atau mem-bypass sistem otentikasi jika diprogram demikian.

---
*TMBilling v1.4.4*

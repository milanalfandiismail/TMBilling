# app/services/tutorial/tutorial_service.py
import logging
from app.repositories import TutorialRepository

logger = logging.getLogger(__name__)

INITIAL_SEED_TUTORIALS = [
    {
        "title": "Panduan Setup Cloudflare Tunnel & Remote VNC (Websockify)",
        "icon": "🌐",
        "category": "Cloudflare & VNC",
        "urutan": 1,
        "content": """
<h3>1. Instalasi TightVNC Server</h3>
<ol>
    <li>Unduh dan install <strong>TightVNC Server</strong> dari <a href="https://www.tightvnc.com/download.php" target="_blank">tightvnc.com</a>.</li>
    <li>Saat instalasi, centang opsi <strong>"Register TightVNC Server as a System Service"</strong>.</li>
    <li>Set Primary Password dan Administrative Password.</li>
    <li>Buka <em>TightVNC Service Configuration</em> -> Tab <em>Access Control</em>: Centang <strong>"Allow loopback connections"</strong> dan set Query Settings ke <strong>Accept connection</strong>.</li>
</ol>

<h3>2. Instalasi Dependensi Websockify (Python)</h3>
<p>Jalankan perintah berikut pada terminal server kasir:</p>
<pre><code>pip install websockify</code></pre>

<h3>3. Pembuatan Tunnel di Cloudflare Zero Trust</h3>
<ol>
    <li>Buka <a href="https://one.dash.cloudflare.com/" target="_blank">Cloudflare Zero Trust Dashboard</a> -> <strong>Networks</strong> -> <strong>Tunnels</strong> -> <strong>Create a Tunnel</strong>.</li>
    <li>Beri nama tunnel (misal: <code>TMBilling-Server</code>) lalu simpan.</li>
</ol>

<h3>4. Pengaturan Published Application Routes (Wajib Sesuai Urutan!)</h3>
<p>Di halaman konfigurasi Tunnel, buat 2 route pada tab <em>Published Application Routes</em>:</p>

<table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%;">
    <thead>
        <tr style="background-color: #171717; color: #fbbf24;">
            <th>Urutan Route</th>
            <th>Path</th>
            <th>Service Type</th>
            <th>URL Target Local</th>
            <th>Fungsi</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Route #1 (Atas)</strong></td>
            <td><code>ws/vnc</code></td>
            <td>HTTP</td>
            <td><code>http://localhost:8081</code></td>
            <td>WebSocket Stream VNC Remote</td>
        </tr>
        <tr>
            <td><strong>Route #2 (Bawah)</strong></td>
            <td><code>*</code> (atau kosong)</td>
            <td>HTTP</td>
            <td><code>http://localhost:7015</code></td>
            <td>Dashboard utama TMBilling</td>
        </tr>
    </tbody>
</table>
<p><em>*PENTING: Route <code>ws/vnc</code> ke port 8081 HARUS berada di urutan paling atas di atas route wildcard <code>*</code>.</em></p>

<h3>5. Simpan Token ke TMBilling</h3>
<p>Salin string token <code>eyJh...</code> pada instruksi Windows Cloudflare, tempelkan pada menu <strong>Pengaturan 🌐 Cloudflare Tunnel</strong> di TMBilling, klik <strong>Simpan Token</strong>, dan aktifkan saklar <strong>Status Daemon</strong>.</p>
"""
    },
    {
        "title": "Panduan Remote Desktop LAN via Tailscale / ZeroTier (Tanpa Tunnel Domain)",
        "icon": "📡",
        "category": "Jaringan",
        "urutan": 2,
        "content": """
<h3>Cara Kerja Remote LAN via Mesh VPN</h3>
<p>Jika Anda menginginkan akses remote cepat dari luar jaringan tanpa perlu membeli domain HTTPS atau menyetting Cloudflare Tunnel, gunakan <strong>Tailscale Mesh VPN</strong>.</p>

<h3>Langkah Setup Tailscale:</h3>
<ol>
    <li>Unduh dan install Tailscale untuk Windows di PC Server: <a href="https://tailscale.com/download" target="_blank">tailscale.com/download</a>.</li>
    <li>Login dengan akun Anda (Google / Microsoft / GitHub) dan catat IP Tailscale PC Server (Format: <code>100.x.y.z</code>).</li>
    <li>Install aplikasi Tailscale di HP / Laptop luar Anda dan login dengan akun yang sama.</li>
    <li>Buka browser di HP/Laptop luar, ketik URL: <code>http://100.x.y.z:7015</code>.</li>
    <li>Buka menu <strong>Remote Control VNC</strong> di TMBilling, masukkan password TightVNC lalu klik <strong>▶ Hubungkan</strong>.</li>
</ol>
"""
    }
]

class TutorialService:
    @staticmethod
    def get_all():
        return TutorialRepository.get_all()

    @staticmethod
    def get_by_id(tutorial_id):
        return TutorialRepository.get_by_id(tutorial_id)

    @staticmethod
    def create(data):
        return TutorialRepository.create(data)

    @staticmethod
    def update(tutorial_id, data):
        return TutorialRepository.update(tutorial_id, data)

    @staticmethod
    def delete(tutorial_id):
        return TutorialRepository.delete(tutorial_id)

    @staticmethod
    def get_all_categories():
        return TutorialRepository.get_all_categories()

    @staticmethod
    def delete_category(category_name):
        return TutorialRepository.delete_category(category_name)

    @staticmethod
    def seed_initial_tutorials():
        try:
            existing = TutorialRepository.get_all()
            if not existing:
                logger.info("[TutorialService] Seeding initial setup tutorials into database...")
                for item in INITIAL_SEED_TUTORIALS:
                    TutorialRepository.create(item)
                logger.info("[TutorialService] Initial setup tutorials seeded successfully!")
        except Exception as e:
            logger.warning(f"[TutorialService] Gagal melakukan seeding tutorial awal: {e}")

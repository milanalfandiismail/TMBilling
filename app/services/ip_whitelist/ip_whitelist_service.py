"""Service untuk IP Whitelist — proteksi akses dashboard berbasis IP.

Module ini menyediakan static methods untuk:
- Check whitelist enabled/disabled
- CRUD IP entries
- Bypass token management
- First-run seeding
- Client IP detection (X-Forwarded-For aware)
"""

import json
import ipaddress
import secrets
import socket
from flask import request, session as flask_session
from app.services.settings.settings_service import SettingsService
from app.utils.logger import write_log


class IpWhitelistService:
    """Service class untuk business logic IP Whitelist."""

    WHITELIST_KEY = "ip_whitelist"
    ENABLED_KEY = "ip_whitelist_enabled"
    TOKEN_KEY = "ip_whitelist_bypass_token"
    TOKEN_VERSION_KEY = "ip_whitelist_token_version"
    PUBLIC_URL_KEY = "app_public_url"

    SCOPED_PREFIXES = ('/kasir/', '/api/v1/kasir/')

    # ------------------------------------------------------------------
    # 1. STATUS & CONFIG
    # ------------------------------------------------------------------

    @staticmethod
    def is_enabled():
        """Cek apakah whitelist sedang aktif."""
        return SettingsService.get(IpWhitelistService.ENABLED_KEY, 'true') == 'true'

    @staticmethod
    def set_enabled(enabled):
        """Aktifkan/nonaktifkan whitelist."""
        val = 'true' if enabled else 'false'
        SettingsService.set(IpWhitelistService.ENABLED_KEY, val)

    @staticmethod
    def get_public_url():
        """Ambil domain publik tunnel yang diset admin."""
        return SettingsService.get(IpWhitelistService.PUBLIC_URL_KEY, '')

    @staticmethod
    def set_public_url(url):
        """Simpan domain publik tunnel."""
        SettingsService.set(IpWhitelistService.PUBLIC_URL_KEY, url.strip().rstrip('/'))

    # ------------------------------------------------------------------
    # 2. IP DETECTION & SCOPE
    # ------------------------------------------------------------------

    @staticmethod
    def get_client_ip():
        """Ambil IP client: X-Forwarded-For first, fallback remote_addr."""
        xff = request.headers.get('X-Forwarded-For')
        if xff:
            return xff.split(',')[0].strip()
        return request.remote_addr or '0.0.0.0'

    @staticmethod
    def is_path_in_scope(path):
        """Cek apakah path masuk scope whitelist."""
        return any(path.startswith(p) for p in IpWhitelistService.SCOPED_PREFIXES)

    # ------------------------------------------------------------------
    # 3. IP ENTRIES CRUD
    # ------------------------------------------------------------------

    @staticmethod
    def _load_entries():
        """Load IP whitelist entries dari Settings (JSON list)."""
        raw = SettingsService.get(IpWhitelistService.WHITELIST_KEY, '[]')
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return []

    @staticmethod
    def _save_entries(entries):
        """Simpan IP whitelist entries ke Settings (JSON dump)."""
        SettingsService.set(IpWhitelistService.WHITELIST_KEY, json.dumps(entries))

    @staticmethod
    def get_entries():
        """Return list of IP whitelist entries."""
        return IpWhitelistService._load_entries()

    @staticmethod
    def get_whitelisted_ips():
        """Return list of IP strings saja (tanpa metadata)."""
        entries = IpWhitelistService._load_entries()
        return [e['ip'] for e in entries if 'ip' in e]

    @staticmethod
    def is_ip_whitelisted(ip):
        """Cek apakah sebuah IP masuk whitelist."""
        return ip in IpWhitelistService.get_whitelisted_ips()

    @staticmethod
    def add(ip, label=''):
        """Tambah IP ke whitelist. Raise ValueError jika invalid/duplicate."""
        try:
            ipaddress.IPv4Address(ip)
        except ipaddress.AddressValueError:
            raise ValueError(f"IP address '{ip}' tidak valid (harus IPv4).")

        entries = IpWhitelistService._load_entries()
        if any(e['ip'] == ip for e in entries):
            raise ValueError(f"IP '{ip}' sudah ada di whitelist.")

        import datetime
        entries.append({
            'ip': ip,
            'added_at': datetime.datetime.now().isoformat(),
            'label': label or 'Manual entry'
        })
        IpWhitelistService._save_entries(entries)

        write_log(
            aksi='IP_WHITELIST_ADD',
            detail=f"IP {ip} ditambahkan ke whitelist (label: {label or '-'})",
            user='admin'
        )
        return entries

    @staticmethod
    def remove(ip):
        """Hapus IP dari whitelist. Raise ValueError jika tidak ditemukan atau last IP."""
        entries = IpWhitelistService._load_entries()
        new_entries = [e for e in entries if e['ip'] != ip]

        if len(new_entries) == len(entries):
            raise ValueError(f"IP '{ip}' tidak ditemukan di whitelist.")

        if len(new_entries) == 0:
            raise ValueError("Tidak dapat menghapus IP terakhir (lockout prevention).")

        IpWhitelistService._save_entries(new_entries)

        write_log(
            aksi='IP_WHITELIST_REMOVE',
            detail=f"IP {ip} dihapus dari whitelist",
            user='admin'
        )
        return new_entries

    # ------------------------------------------------------------------
    # 4. BYPASS TOKEN
    # ------------------------------------------------------------------

    @staticmethod
    def get_token():
        """Ambil bypass token saat ini."""
        return SettingsService.get(IpWhitelistService.TOKEN_KEY, '')

    @staticmethod
    def get_token_version():
        """Ambil versi token saat ini."""
        try:
            return int(SettingsService.get(IpWhitelistService.TOKEN_VERSION_KEY, '1'))
        except (ValueError, TypeError):
            return 1

    @staticmethod
    def regenerate_token():
        """Generate token baru. Invalidate semua sesi existing. Return (token, version)."""
        new_token = secrets.token_urlsafe(32)
        new_version = IpWhitelistService.get_token_version() + 1

        SettingsService.set(IpWhitelistService.TOKEN_KEY, new_token)
        SettingsService.set(IpWhitelistService.TOKEN_VERSION_KEY, str(new_version))

        write_log(
            aksi='IP_WHITELIST_TOKEN_REGEN',
            detail='Bypass token di-regenerate. Semua sesi remote di-invalidate.',
            user='admin'
        )
        return new_token, new_version

    @staticmethod
    def get_token_masked():
        """Return token masked: 4 char awal + ... + 4 char akhir."""
        token = IpWhitelistService.get_token()
        if len(token) > 8:
            return token[:4] + '...' + token[-4:]
        return token or ''

    @staticmethod
    def is_session_authenticated():
        """Cek apakah session saat ini authenticated via bypass token."""
        auth_flag = flask_session.get('ip_wh_authenticated')
        session_version = flask_session.get('ip_wh_token_version')
        current_version = IpWhitelistService.get_token_version()
        return auth_flag is True and session_version == current_version

    @staticmethod
    def authenticate_session():
        """Set session flags setelah token valid (digunakan di middleware)."""
        flask_session['ip_wh_authenticated'] = True
        flask_session['ip_wh_token_version'] = IpWhitelistService.get_token_version()

    # ------------------------------------------------------------------
    # 5. SEEDING (FIRST-RUN)
    # ------------------------------------------------------------------

    @staticmethod
    def seed_defaults(app):
        """Seed IP whitelist default saat first-run. Idempotent."""
        import datetime
        with app.app_context():
            if SettingsService.get(IpWhitelistService.ENABLED_KEY) is None:
                SettingsService.set(IpWhitelistService.ENABLED_KEY, 'true')

            if SettingsService.get(IpWhitelistService.WHITELIST_KEY) is None:
                # Deteksi LAN IP yang benar (bukan 127.0.0.1)
                lan_ip = '127.0.0.1'
                try:
                    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    s.settimeout(0.5)
                    s.connect(('10.255.255.255', 1))
                    lan_ip = s.getsockname()[0]
                    s.close()
                except Exception:
                    try:
                        lan_ip = socket.gethostbyname(socket.gethostname())
                    except Exception:
                        pass

                now_iso = datetime.datetime.now().isoformat()
                default_list = [
                    {'ip': '127.0.0.1', 'added_at': now_iso, 'label': 'localhost'}
                ]
                # Jangan tambah 127.0.0.1 dua kali
                if lan_ip != '127.0.0.1' and lan_ip:
                    default_list.append(
                        {'ip': lan_ip, 'added_at': now_iso, 'label': 'Server warnet'}
                    )
                IpWhitelistService._save_entries(default_list)

            if SettingsService.get(IpWhitelistService.TOKEN_KEY) is None:
                SettingsService.set(IpWhitelistService.TOKEN_KEY, secrets.token_urlsafe(32))
                SettingsService.set(IpWhitelistService.TOKEN_VERSION_KEY, '1')

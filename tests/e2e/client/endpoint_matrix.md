# Matriks Endpoint Klien WarnetAgent

Sumber: `app-rust/src/app.rs`. Semua rute butuh header `X-Client-Key` kecuali disebut lain.

| Method | Path | Handler | Bukti |
|---|---|---|---|
| POST | /api/v1/public/client/identify | client_routes::identify | test_client_auth.py |
| POST | /api/v1/public/client/status | client_routes::status | test_client_session.py |
| POST | /api/v1/public/client/selesai | client_routes::selesai | test_client_session.py |
| POST | /api/v1/public/client/admin-login | client_routes::admin_login | test_client_session.py |
| POST | /api/v1/public/client/emergency-login | client_routes::emergency_login | test_client_session.py |
| POST | /api/v1/public/client/afk-lock | client_routes::afk_lock | test_client_session.py |
| POST | /api/v1/public/client/afk-unlock | client_routes::afk_unlock | test_client_session.py |
| GET  | /api/v1/public/client/warnet | client_routes::warnet | test_client_config.py |
| POST | /api/v1/public/client/fast_poll | client_routes::fast_poll | test_client_config.py |
| POST | /api/v1/public/client/vnc_ready | client_routes::vnc_ready | test_client_config.py |
| POST | /api/v1/public/client/vnc_poll | client_routes::fast_poll (alias) | test_client_config.py |
| POST | /api/v1/public/client/vnc_stopped | client_routes::vnc_stopped | test_client_config.py |
| POST | /api/v1/public/monitor | monitor_routes::telemetry | test_client_telemetry.py |
| POST | /api/v1/public/monitor/screenshot/upload | monitor_routes::screenshot_upload | test_client_telemetry.py |
| POST | /api/v1/public/client/screenshot/upload | monitor_routes::screenshot_upload | sama |
| POST | /api/v1/public/auth/login | auth_routes::client_member_login | dicakup portal member (mcp) |

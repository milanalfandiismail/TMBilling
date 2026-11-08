@echo off
setlocal
cd /d "%~dp0.."

:: Port server standar (run.py: PORT env, default 7015)
set "TM_PORT=7015"
set "TM_PY=.venv\Scripts\python.exe"
if not exist "%TM_PY%" set "TM_PY=python"

echo ==========================================================
echo    TMBilling Server - Menjalankan Pembaruan Sistem...
echo ==========================================================

:: 1. Validasi apakah berkas paket rilis pembaruan tersedia
if not exist "instance\temp_update.zip" (
    echo [ERROR] Berkas pembaruan "instance\temp_update.zip" tidak ditemukan!
    echo         Pembaruan dibatalkan. Server tidak diubah.
    echo ==========================================================
    exit /b 1
)

:: 1b. Preflight versi Python: SQLAlchemy 2.1 membutuhkan Python 3.11+
"%TM_PY%" -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Pembaruan ini membutuhkan Python 3.11 atau lebih baru.
    echo         Server TIDAK diubah dan tetap berjalan seperti sebelumnya.
    echo         Langkah: instal Python 3.11+, hapus folder .venv, jalankan install.bat,
    echo         lalu ulangi pembaruan ini.
    echo ==========================================================
    exit /b 1
)

:: 2. Beri jeda 2 detik agar respon HTTP 200 sampai ke browser kasir
timeout /t 2 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 2 >nul

:: 3. Matikan server: proses run.py apa pun + pemilik port
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'python.exe' -or $_.Name -eq 'pythonw.exe') -and $_.CommandLine -like '*run.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %TM_PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: Tunggu port benar-benar lepas; bila masih dipakai, batalkan SEBELUM menyentuh berkas
set "PORT_FREE="
for /l %%i in (1,1,5) do (
    if not defined PORT_FREE (
        powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %TM_PORT% -State Listen -ErrorAction SilentlyContinue) { exit 1 }" >nul 2>&1
        if not errorlevel 1 (
            set "PORT_FREE=1"
        ) else (
            timeout /t 1 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 2 >nul
        )
    )
)
if not defined PORT_FREE (
    echo [ERROR] Server masih berjalan di port %TM_PORT% dan tidak bisa dihentikan.
    echo         Pembaruan dibatalkan. Tidak ada berkas yang diubah.
    echo ==========================================================
    exit /b 1
)

:: 4. Backup database (SQLite Online Backup API) + ekstraksi berkas rilis
"%TM_PY%" "install_scripts\extract_update.py"
if errorlevel 1 (
    echo [ERROR] Backup database atau ekstraksi pembaruan gagal.
    echo         Server akan dinyalakan kembali tanpa menjalankan migrasi.
    echo         Paket pembaruan dipertahankan di instance\temp_update.zip.
    goto :restart_server
)

:: 5. Pasang dependensi lebih dulu, agar migrasi berjalan dengan pustaka versi baru
if exist ".venv\Scripts\pip.exe" (
    ".venv\Scripts\pip.exe" install -r requirements.txt --quiet
    if errorlevel 1 echo [WARN] Pemasangan dependensi gagal. Jalankan manual: .venv\Scripts\pip install -r requirements.txt
)

:: 6. Migrasi skema database setelah kode & dependensi baru terpasang
"%TM_PY%" "install_scripts\run_migration.py"
if errorlevel 1 echo [WARN] Migrasi skema gagal. Periksa log di atas sebelum menggunakan aplikasi.

:restart_server
:: 7. Nyalakan kembali server seperti start.bat (juga dipakai saat pembaruan gagal)
if exist ".venv\Scripts\pythonw.exe" (
    start "" ".venv\Scripts\pythonw.exe" run.py
) else (
    start "" python run.py
)

echo [OK] Server TMBilling telah dinyalakan kembali.
exit /b 0

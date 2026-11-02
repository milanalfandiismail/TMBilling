@echo off
setlocal
cd /d "%~dp0.."

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

:: 2. Beri jeda 2 detik agar respon HTTP 200 sampai ke browser kasir
timeout /t 2 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 2 >nul

:: 3. Matikan paksa proses server python agar file lock dan port 7015 terlepas
taskkill /f /im pythonw.exe >nul 2>&1
timeout /t 1 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 1 >nul

:: 4. Jalankan ekstraksi aman, backup database, dan migrasi skema
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" "install_scripts\extract_update.py"
) else (
    python "install_scripts\extract_update.py"
)
if errorlevel 1 (
    echo [ERROR] Ekstraksi pembaruan gagal. Silakan periksa log.
    exit /b 1
)

:: 4. Pasang dependensi jika ada perubahan
if exist ".venv\Scripts\pip.exe" (
    ".venv\Scripts\pip.exe" install -r requirements.txt --quiet
)

:: 5. Nyalakan kembali server seperti start.bat
if exist ".venv\Scripts\pythonw.exe" (
    start "" ".venv\Scripts\pythonw.exe" run.py
) else (
    start "" python run.py
)

echo [OK] Pembaruan selesai. Server TMBilling telah dimulai ulang.
exit /b 0

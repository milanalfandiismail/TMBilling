@echo off
setlocal
cd /d "%~dp0.."

echo ==========================================================
echo    TMBilling Server - Menjalankan Pembaruan Sistem...
echo ==========================================================

:: 1. Beri jeda 2 detik agar respon HTTP 200 sampai ke browser kasir
timeout /t 2 /nobreak >nul

:: 2. Matikan paksa proses server python agar file lock dan port 7015 terlepas
taskkill /f /im pythonw.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: 3. Jalankan ekstraksi aman, backup database, dan migrasi skema
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" "install_scripts\extract_update.py"
) else (
    python "install_scripts\extract_update.py"
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

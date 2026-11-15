@echo off
title TMBilling Server - Stop
color 0C
cd /d "%~dp0"

echo ==========================================================
echo    TMBilling Server - Menghentikan Server...
echo ==========================================================

:: Simpan delta uptime RAM ke SQLite sebelum proses dimatikan paksa
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 7015 -State Listen -ErrorAction SilentlyContinue)) { exit 1 }" >nul 2>&1
if errorlevel 1 goto :lewati_flush
"%~dp0.venv\Scripts\python.exe" "%~dp0install_scripts\flush_uptime.py"
if errorlevel 1 (
    echo.
    echo [ERROR] Delta uptime tidak dapat disimpan.
    echo         Server TIDAK dihentikan agar data tidak hilang.
    echo ==========================================================
    exit /b 1
)

:lewati_flush

:: Hentikan proses background start.bat, proses run.py apa pun, dan pemilik port 7015
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { (($_.ExecutablePath -like '%CD%\*') -or ($_.CommandLine -like '*%CD%\run.py*')) -and $_.CommandLine -like '*run.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 7015 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: Pastikan port benar-benar lepas sebelum melaporkan berhasil
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 7015 -State Listen -ErrorAction SilentlyContinue) { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Server masih berjalan di port 7015.
    echo         Hentikan manual lewat Task Manager, lalu ulangi.
    echo ==========================================================
    exit /b 1
)

echo.
echo [OK] Server TMBilling berhasil dihentikan.
echo ==========================================================
timeout /t 3 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 3 >nul
exit /b 0

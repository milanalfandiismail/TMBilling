@echo off
title TMBilling Server
color 0A

if not exist .venv goto :no_venv
if not exist .env goto :no_env

echo ==========================================================
echo    TMBilling Server - Menyalakan Server...
echo ==========================================================

start "" ".venv\Scripts\pythonw.exe" run.py

echo.
echo [OK] Server TMBilling berhasil dijalankan di background!
echo.
echo   Akses dashboard melalui browser:
echo     http://localhost:7015
echo.
echo   Untuk menghentikan server, jalankan stop.bat
echo ==========================================================
timeout /t 4 >nul
goto :eof

:no_venv
echo ==========================================================
echo [ERROR] Virtual Environment (.venv) tidak ditemukan!
echo         Jalankan install.bat terlebih dahulu.
echo ==========================================================
pause
exit /b 1

:no_env
echo ==========================================================
echo [ERROR] File konfigurasi .env tidak ditemukan!
echo         Jalankan install.bat untuk generate .env otomatis.
echo ==========================================================
pause
exit /b 1

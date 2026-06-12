@echo off
title TMBilling Server
color 0A

:: ─── Cek .venv ───────────────────────────────────────────────
if not exist .venv (
    echo ==========================================================
    echo [ERROR] Virtual Environment (.venv) tidak ditemukan!
    echo         Jalankan "install.bat" terlebih dahulu.
    echo ==========================================================
    pause
    exit /b 1
)

:: ─── Cek .env ────────────────────────────────────────────────
if not exist .env (
    echo ==========================================================
    echo [ERROR] File konfigurasi .env tidak ditemukan!
    echo         Jalankan "install.bat" untuk generate .env otomatis,
    echo         atau salin .env.example menjadi .env secara manual.
    echo ==========================================================
    pause
    exit /b 1
)

:: ─── Jalankan server di background (tanpa console window) ────
echo ==========================================================
echo   TMBilling Server - Menyalakan Server...
echo ==========================================================
start "" ".venv\Scripts\pythonw.exe" run.py

echo.
echo [OK] Server kasir TMBilling berhasil dijalankan!
echo.
echo   Akses dashboard melalui browser:
echo     http://localhost:7015
echo.
echo   Untuk menghentikan server, jalankan "stop.bat"
echo ==========================================================
timeout /t 4 >nul

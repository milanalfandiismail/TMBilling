@echo off
title TMBilling Server Installer
color 0E

echo ==========================================================
echo [TMBilling] Memulai Proses Instalasi Server...
echo ==========================================================
echo.

:: 1. Periksa Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python tidak terdeteksi di sistem Windows Anda!
    echo.
    echo Silakan ikuti langkah berikut:
    echo 1. Unduh Python dari: https://www.python.org/downloads/
    echo 2. Saat menginstal, PASTIKAN memberi centang pada pilihan:
    echo    "Add python.exe to PATH"
    echo 3. Setelah selesai instal, silakan jalankan kembali file ini.
    echo ==========================================================
    pause
    exit /b
)

:: 2. Buat .venv dan pasang dependensi
echo [TMBilling] Membuat Virtual Environment (.venv)...
python -m venv .venv
if %errorlevel% neq 0 (
    echo [ERROR] Gagal membuat virtual environment.
    pause
    exit /b
)

echo [TMBilling] Mengunduh dan memasang dependensi (membutuhkan internet)...
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Gagal memasang dependensi.
    pause
    exit /b
)

:: 3. Salin .env.example ke .env jika belum ada dan generate SECRET_KEY acak
if not exist .env (
    if exist .env.example (
        echo [TMBilling] Membuat berkas konfigurasi .env dan menghasilkan SECRET_KEY acak...
        .venv\Scripts\python.exe -c "import secrets; c = open('.env.example').read().replace('SECRET_KEY=ganti-dengan-rahasia-abang-yang-panjang-dan-unik', 'SECRET_KEY=' + secrets.token_hex(32)); open('.env', 'w').write(c)"
    )
)

echo.
echo ==========================================================
echo ✅ INSTALASI SUKSES!
echo ==========================================================
echo Silakan jalankan "start.bat" untuk menyalakan server kasir.
echo ==========================================================
pause

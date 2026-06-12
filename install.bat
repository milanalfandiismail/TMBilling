@echo off
title TMBilling Server Installer
color 0E

echo ==========================================================
echo    TMBilling Server - Setup dan Instalasi
echo ==========================================================
echo.

:: ─── 1. Periksa Python ──────────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python tidak terdeteksi di sistem!
    echo.
    echo Silakan ikuti langkah berikut:
    echo 1. Unduh Python dari: https://www.python.org/downloads/
    echo 2. Saat menginstal, CENTANG pilihan "Add python.exe to PATH"
    echo 3. Jalankan kembali file ini setelah selesai instalasi.
    echo ==========================================================
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo [OK] %%i ditemukan.
echo.

:: ─── 2. Buat Virtual Environment ────────────────────────────
if exist .venv (
    echo [OK] Virtual Environment (.venv) sudah ada, lewati pembuatan.
) else (
    echo [INFO] Membuat Virtual Environment (.venv)...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Gagal membuat virtual environment.
        pause
        exit /b 1
    )
    echo [OK] Virtual Environment berhasil dibuat.
)
echo.

:: ─── 3. Upgrade pip & Install dependensi ────────────────────
echo [INFO] Memeriksa dan memperbarui pip...
.venv\Scripts\python.exe -m pip install --upgrade pip --quiet

echo [INFO] Memasang dependensi dari requirements.txt...
echo        (Membutuhkan koneksi internet, harap tunggu...)
.venv\Scripts\pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [ERROR] Gagal memasang dependensi. Periksa koneksi internet.
    pause
    exit /b 1
)
echo [OK] Semua dependensi berhasil dipasang.
echo.

:: ─── 4. Generate .env dari .env.example ─────────────────────
if not exist .env (
    if exist .env.example (
        echo [INFO] Membuat file .env dengan SECRET_KEY acak...
        .venv\Scripts\python.exe -c "import secrets; c = open('.env.example', encoding='utf-8').read().replace('SECRET_KEY=ganti-dengan-rahasia-abang-yang-panjang-dan-unik', 'SECRET_KEY=' + secrets.token_hex(32)); open('.env', 'w', encoding='utf-8').write(c)"
        echo [OK] File .env berhasil dibuat dengan SECRET_KEY acak.
    ) else (
        echo [WARN] .env.example tidak ditemukan, silakan buat .env secara manual.
    )
) else (
    echo [OK] File .env sudah ada, tidak ditimpa.
)
echo.

:: ─── 5. Inisialisasi / Migrasi Database ─────────────────────
echo [INFO] Menginisialisasi database...
if exist migrations (
    .venv\Scripts\python.exe -m flask --app run.py db upgrade >nul 2>&1
    if %errorlevel% neq 0 (
        echo [WARN] Flask-Migrate upgrade gagal, mencoba db.create_all()...
        .venv\Scripts\python.exe -c "from app import create_app; app = create_app(); app.app_context().push(); from app.models.base import db; db.create_all(); print('[OK] Tabel database berhasil dibuat.')"
    ) else (
        echo [OK] Migrasi database berhasil diterapkan.
    )
) else (
    .venv\Scripts\python.exe -c "from app import create_app; app = create_app(); app.app_context().push(); from app.models.base import db; db.create_all(); print('[OK] Tabel database berhasil dibuat.')"
)
echo.

:: ─── Selesai ─────────────────────────────────────────────────
echo ==========================================================
echo   INSTALASI SELESAI!
echo ==========================================================
echo.
echo   Informasi Login Default:
echo     Username : admin
echo     Password : admin123
echo.
echo   Langkah selanjutnya:
echo     1. Edit file .env jika perlu menyesuaikan konfigurasi
echo     2. Jalankan "start.bat" untuk menyalakan server kasir
echo     3. Buka browser ke http://localhost:7015
echo.
echo   PENTING: Ganti password admin setelah login pertama!
echo ==========================================================
pause

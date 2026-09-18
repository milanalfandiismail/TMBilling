@echo off
title TMBilling Server Installer
color 0E

echo ==========================================================
echo    TMBilling Server - Setup dan Instalasi
echo ==========================================================
echo.

:: [1] Periksa Python
python --version >nul 2>&1
if errorlevel 1 goto :no_python
python --version
echo [OK] Python ditemukan.
echo.
goto :check_venv

:no_python
echo [ERROR] Python tidak terdeteksi di sistem!
echo.
echo Silakan ikuti langkah berikut:
echo 1. Unduh Python dari: https://www.python.org/downloads/
echo 2. Saat menginstal, CENTANG pilihan "Add python.exe to PATH"
echo 3. Jalankan kembali file ini setelah selesai instalasi.
echo ==========================================================
pause
exit /b 1

:: [2] Buat Virtual Environment
:check_venv
if exist .venv goto :skip_venv
echo [INFO] Membuat Virtual Environment (.venv)...
python -m venv .venv
if errorlevel 1 goto :venv_error
echo [OK] Virtual Environment berhasil dibuat.
echo.
goto :install_deps

:venv_error
echo [ERROR] Gagal membuat virtual environment.
pause
exit /b 1

:skip_venv
echo [OK] Virtual Environment sudah ada, lewati pembuatan.
echo.

:: [3] Install dependensi
:install_deps
echo [INFO] Memperbarui pip...
.venv\Scripts\python.exe -m pip install --upgrade pip --quiet
echo [INFO] Memasang dependensi dari requirements.txt...
echo        (Membutuhkan koneksi internet, harap tunggu...)
.venv\Scripts\pip install -r requirements.txt
if errorlevel 1 goto :pip_error
echo [OK] Semua dependensi berhasil dipasang.
echo.
goto :gen_env

:pip_error
echo [ERROR] Gagal memasang dependensi. Periksa koneksi internet.
pause
exit /b 1

:: [4] Generate .env
:gen_env
if exist .env goto :skip_env
if not exist .env.example goto :skip_env
echo [INFO] Membuat file .env dengan SECRET_KEY acak...
.venv\Scripts\python.exe install_scripts\gen_env.py
echo [OK] File .env berhasil dibuat.
echo.
goto :init_db

:skip_env
if exist .env echo [OK] File .env sudah ada, tidak ditimpa.
if not exist .env echo [WARN] File .env tidak ada, buat secara manual dari .env.example
echo.

:: [5] Inisialisasi Database
:init_db
echo [INFO] Menginisialisasi database...
.venv\Scripts\python.exe install_scripts\init_db.py
echo.

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

@echo off
setlocal enabledelayedexpansion
title TMBilling Server Installer (Non-Admin Mode)
color 0B

echo ==========================================================
echo    TMBilling Server - Setup dan Instalasi (Non-Admin)
echo ==========================================================
echo.
echo [INFO] Menjalankan installer dalam mode Pengguna Standar (Non-Admin).
echo.

:: [1] Cari executable Python dari berbagai lokasi tanpa perlu Administrator
set "PYTHON_EXE="

:: Cek 1: python di PATH
where python >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python"
    goto :python_found
)

:: Cek 2: py launcher (Windows standard)
where py >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=py -3"
    goto :python_found
)

:: Cek 3: Local AppData user installation
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do (
    if exist "%%D\python.exe" (
        set "PYTHON_EXE=%%D\python.exe"
        goto :python_found
    )
)

:: Cek 4: Root standard installation
for /d %%D in ("C:\Python3*") do (
    if exist "%%D\python.exe" (
        set "PYTHON_EXE=%%D\python.exe"
        goto :python_found
    )
)

:no_python
echo [ERROR] Python tidak terdeteksi di komputer Anda!
echo.
echo Silakan ikuti langkah berikut untuk menginstal Python (tanpa perlu Admin):
echo 1. Buka browser dan unduh Python: https://www.python.org/downloads/
echo 2. Saat installer Python terbuka:
echo    - CENTANG "Add python.exe to PATH"
echo    - Pilih "Install Now" (Otomatis terinstal di user folder tanpa butuh Admin)
echo 3. Jalankan kembali file "install_non_admin.bat" ini.
echo ==========================================================
pause
exit /b 1

:python_found
echo [OK] Menggunakan Python: %PYTHON_EXE%
%PYTHON_EXE% --version
echo.

:: [2] Buat Virtual Environment (.venv) di folder lokal
:check_venv
if exist ".venv\Scripts\python.exe" goto :skip_venv
echo [INFO] Membuat Virtual Environment (.venv)...
%PYTHON_EXE% -m venv .venv
if %errorlevel% neq 0 goto :venv_error
echo [OK] Virtual Environment berhasil dibuat.
echo.
goto :install_deps

:venv_error
echo [ERROR] Gagal membuat virtual environment (.venv).
echo Pastikan folder ini memiliki izin tulis untuk user Anda.
pause
exit /b 1

:skip_venv
echo [OK] Virtual Environment (.venv) sudah tersedia.
echo.

:: [3] Install dependensi
:install_deps
echo [INFO] Memperbarui pip dalam environment lokal...
".venv\Scripts\python.exe" -m pip install --upgrade pip --quiet --no-warn-script-location
echo [INFO] Memasang dependensi dari requirements.txt...
echo        (Membutuhkan koneksi internet, harap tunggu...)
".venv\Scripts\python.exe" -m pip install --no-warn-script-location -r requirements.txt
if %errorlevel% neq 0 goto :pip_error
echo [OK] Semua dependensi berhasil dipasang.
echo.
goto :gen_env

:pip_error
echo [ERROR] Gagal memasang dependensi Python.
echo Periksa koneksi internet Anda lalu coba jalankan kembali.
pause
exit /b 1

:: [4] Generate konfigurasi .env
:gen_env
if exist ".env" (
    echo [OK] File .env sudah ada, tidak ditimpa.
    goto :init_db
)
if exist ".env.example" (
    echo [INFO] Membuat file .env dengan SECRET_KEY acak...
    if exist "install_scripts\gen_env.py" (
        ".venv\Scripts\python.exe" install_scripts\gen_env.py
    ) else (
        copy /y ".env.example" ".env" >nul
    )
    echo [OK] File .env berhasil dibuat.
    echo.
) else (
    echo [WARN] File .env.example tidak ditemukan.
)

:: [5] Inisialisasi Database
:init_db
echo [INFO] Menginisialisasi database SQLite...
if exist "install_scripts\init_db.py" (
    ".venv\Scripts\python.exe" install_scripts\init_db.py
) else (
    ".venv\Scripts\python.exe" -c "from app import create_app, db; app = create_app(); app.app_context().push(); db.create_all()"
)
echo.

echo ==========================================================
echo   INSTALASI (NON-ADMIN) SELESAI!
echo ==========================================================
echo.
echo   Informasi Login Default:
echo     Username : admin
echo     Password : admin123
echo.
echo   Langkah selanjutnya:
echo     1. Jalankan "start.bat" untuk menyalakan server kasir
echo     2. Buka browser ke: http://localhost:7015
echo.
echo   PENTING: Ganti password admin setelah login pertama!
echo ==========================================================
pause

@echo off
setlocal
title TMBilling Server - Update
color 0B
cd /d "%~dp0"

echo ==========================================================
echo    TMBilling Server - Pembaruan Manual
echo ==========================================================
echo.

if "%~1"=="" goto :check_instance_zip
if exist "%~1" (
    echo [INFO] Menyiapkan paket pembaruan dari: "%~1"
    if not exist "instance" mkdir "instance"
    set "TM_PY=.venv\Scripts\python.exe"
    if not exist "%TM_PY%" set "TM_PY=python"
    "%TM_PY%" "install_scripts\update_claim.py" claim
    if errorlevel 1 (
        echo [ERROR] Pembaruan lain sedang berjalan atau belum selesai.
        echo         Tunggu hingga selesai lalu ulangi. Tidak ada berkas yang diubah.
        exit /b 1
    )
    copy /y "%~1" "instance\temp_update.zip" >nul
    if errorlevel 1 (
        "%TM_PY%" "install_scripts\update_claim.py" release >nul 2>&1
        echo [ERROR] Gagal menyalin paket pembaruan ke instance\temp_update.zip
        echo         Pembaruan dibatalkan. Server tidak diubah.
        exit /b 1
    )
    goto :run_updater
) else (
    echo [ERROR] File paket rilis "%~1" tidak ditemukan!
    goto :usage
)

:check_instance_zip
if exist "instance\temp_update.zip" (
    echo [INFO] Ditemukan paket pembaruan di "instance\temp_update.zip".
    goto :run_updater
)

:usage
echo [PETUNJUK PENGGUNAAN]:
echo   Cara 1 (Otomatis): Buka Dashboard Kasir ^> Pengaturan ^> Migrasi ^& Update
echo   Cara 2 (Manual)  : Tarik file zip rilis ke file ini, atau jalankan:
echo                      update.bat TMBilling_Server_vX.X.zip
echo ==========================================================
pause
exit /b 1

:run_updater
echo [INFO] Menjalankan proses pembaruan aman...
call install_scripts\updater.bat
exit /b %errorlevel%

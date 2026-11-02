@echo off
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
    copy /y "%~1" "instance\temp_update.zip" >nul
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

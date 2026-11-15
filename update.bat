@echo off
setlocal
title TMBilling Server - Update
color 0B
cd /d "%~dp0"
if defined TM_UPDATE_SELF goto :siap_update
set "TM_UPDATE_SELF=1"
set "TM_SELF_COPY=%TEMP%\tmb_update_%RANDOM%%RANDOM%.bat"
copy /y "%~f0" "%TM_SELF_COPY%" >nul
if errorlevel 1 goto :siap_update
call "%TM_SELF_COPY%" %*
set "TM_RC=%errorlevel%"
del "%TM_SELF_COPY%" >nul 2>&1
exit /b %TM_RC%

:siap_update
if not defined TM_PY set "TM_PY=.venv\Scripts\python.exe"
if not exist "%TM_PY%" set "TM_PY=python"

echo ==========================================================
echo    TMBilling Server - Pembaruan Manual
echo ==========================================================
echo.

if "%~1"=="" goto :check_instance_zip
if exist "%~1" (
    echo [INFO] Menyiapkan paket pembaruan dari: "%~1"
    if not exist "instance" mkdir "instance"
    if not exist "%TM_PY%" set "TM_PY=python"
    set "TM_CLAIM_HELD=1"
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
:: Jalankan dari salinan %TEMP% agar swap install_scripts tidak membunuh batch ini.
set "TM_ROOT=%~dp0"
set "TM_UPDATER_COPY=%TEMP%\tmb_updater_%RANDOM%%RANDOM%.bat"
copy /y "install_scripts\updater.bat" "%TM_UPDATER_COPY%" >nul
if errorlevel 1 goto :fallback_updater
call "%TM_UPDATER_COPY%"
set "TM_RC=%errorlevel%"
if "%TM_CLAIM_HELD%"=="1" "%TM_PY%" "install_scripts\update_claim.py" release >nul 2>&1
del "%TM_UPDATER_COPY%" >nul 2>&1
exit /b %TM_RC%

:fallback_updater
call "install_scripts\updater.bat"
exit /b %errorlevel%

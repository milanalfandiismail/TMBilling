@echo off
title TMBilling Agent Uninstaller
color 0c

:: =========================================================================
:: 1. AUTO-ELEVATION TO ADMINISTRATOR
:: =========================================================================
:check_permissions
echo Memeriksa hak akses administrator...
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :uninstall
) else (
    echo.
    echo [PENTING] Uninstaller ini memerlukan hak akses Administrator.
    echo Mencoba menjalankan ulang sebagai Administrator...
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

:uninstall
cls
echo =========================================================================
echo               TMBILLING AGENT - SECURE UNINSTALLER
echo =========================================================================
echo.

set INSTALL_DIR=C:\TMBILLING

:: Jalankan uninstaller GUI Rust yang aman
if exist "%INSTALL_DIR%\TMBilling_Uninstaller.exe" (
    echo Meluncurkan panel uninstalasi aman dengan verifikasi Token Dinamis...
    start "" "%INSTALL_DIR%\TMBilling_Uninstaller.exe"
) else (
    echo [ERROR] Berkas TMBilling_Uninstaller.exe tidak ditemukan di folder instalasi!
    echo Silakan jalankan ulang installer atau hubungi administrator.
    pause
)
exit /b

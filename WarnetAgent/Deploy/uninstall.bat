@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title TMBilling Agent ^& Kiosk Uninstaller
color 0c

:: =========================================================================
:: 1. CHECK PERMISSIONS (SUPPORT BOTH ADMIN & RUN BIASA / NON-ADMIN)
:: =========================================================================
set "IS_ADMIN=0"
net session >nul 2>&1
if %errorlevel% equ 0 (
    set "IS_ADMIN=1"
)

cls
echo =========================================================================
echo         TMBILLING AGENT ^& KIOSK - SECURE UNINSTALLER
echo =========================================================================
echo.
if "%IS_ADMIN%"=="1" (
    echo [MODE] Dijalankan sebagai Administrator ^(Full System Access^).
) else (
    echo [MODE] Dijalankan sebagai Pengguna Standar ^(Run Biasa / Non-Admin^).
)
echo.

:: =========================================================================
:: 2. DETECT INSTALLATION DIRECTORY
:: =========================================================================
set "INSTALL_DIR="

if exist "%~dp0TMBilling_Uninstaller.exe" (
    set "INSTALL_DIR=%~dp0"
) else if exist "C:\TMBILLING\TMBilling_Uninstaller.exe" (
    set "INSTALL_DIR=C:\TMBILLING"
) else if exist "%LOCALAPPDATA%\TMBilling\TMBilling_Uninstaller.exe" (
    set "INSTALL_DIR=%LOCALAPPDATA%\TMBilling"
)

:: =========================================================================
:: 3. LAUNCH SECURE UNINSTALLER GUI
:: =========================================================================
if defined INSTALL_DIR (
    if exist "!INSTALL_DIR!\TMBilling_Uninstaller.exe" (
        echo Meluncurkan panel uninstalasi aman dari !INSTALL_DIR!...
        start "" "!INSTALL_DIR!\TMBilling_Uninstaller.exe"
        exit /b 0
    )
)

echo [ERROR] Berkas TMBilling_Uninstaller.exe tidak ditemukan di:
echo         - %~dp0
echo         - C:\TMBILLING
echo         - %LOCALAPPDATA%\TMBilling
echo.
echo Silakan pastikan TMBilling terpasang atau hubungi administrator.
pause
exit /b 1

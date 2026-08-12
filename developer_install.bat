@echo off
title TMBilling Developer Setup
color 0B

echo ==========================================================
echo    TMBilling Server - Developer Environment Setup
echo ==========================================================
echo.

:: [1] Jalankan Setup Standar (install.bat)
echo [1/3] Menjalankan instalasi dasar server...
call install.bat
if errorlevel 1 (
    echo [ERROR] Instalasi dasar server gagal!
    pause
    exit /b 1
)

:: [2] Pengecekan NPM Root & Build Tailwind CSS
echo.
echo [2/3] Memeriksa dependensi NPM Root untuk Tailwind CSS...
if not exist node_modules (
    echo [INFO] Folder node_modules belum ditemukan di Root, menjalankan npm install...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Gagal menjalankan npm install di Root!
        pause
        exit /b 1
    )
)
echo [INFO] Membangun bundel Tailwind CSS lokal...
call npm run build:css
if errorlevel 1 (
    echo [ERROR] Gagal membangun Tailwind CSS!
    pause
    exit /b 1
)

:: [3] Pengecekan NPM Tauri Client
echo.
echo [3/3] Memeriksa dependensi NPM Tauri Client...
if not exist "WarnetClient\TMBillingTauri\node_modules\" (
    echo [INFO] Folder node_modules belum ditemukan di TMBillingTauri, menjalankan npm install...
    cd /d "%~dp0WarnetClient\TMBillingTauri"
    call npm install
    cd /d "%~dp0"
    if errorlevel 1 (
        echo [ERROR] Gagal menjalankan npm install di TMBillingTauri!
        pause
        exit /b 1
    )
)

echo.
echo ==========================================================
echo   DEVELOPER SETUP SELESAI!
echo   Semua dependensi Python, Node.js, Tailwind, dan Tauri siap!
echo ==========================================================
echo.
pause

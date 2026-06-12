@echo off
title TMBilling Server - Stop
color 0C

echo ==========================================================
echo   TMBilling Server - Menghentikan Server...
echo ==========================================================

:: Hentikan proses pythonw.exe (server background)
taskkill /f /im pythonw.exe >nul 2>&1

if %errorlevel% equ 0 (
    echo.
    echo [OK] Server TMBilling berhasil dihentikan.
) else (
    echo.
    echo [INFO] Tidak ada proses server yang sedang berjalan.
)

echo ==========================================================
timeout /t 3 >nul

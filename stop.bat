@echo off
title TMBilling Server - Stop
color 0C
cd /d "%~dp0"

echo ==========================================================
echo    TMBilling Server - Menghentikan Server...
echo ==========================================================

taskkill /f /im pythonw.exe >nul 2>&1
if errorlevel 1 goto :not_running

echo.
echo [OK] Server TMBilling berhasil dihentikan.
echo ==========================================================
timeout /t 3 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 3 >nul
exit /b 0

:not_running
echo.
echo [INFO] Tidak ada proses server yang sedang berjalan.
echo ==========================================================
timeout /t 2 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 2 >nul
exit /b 0

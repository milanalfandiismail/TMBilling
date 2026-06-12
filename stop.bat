@echo off
title TMBilling Server - Stop
color 0C

echo ==========================================================
echo    TMBilling Server - Menghentikan Server...
echo ==========================================================

taskkill /f /im pythonw.exe >nul 2>&1
if errorlevel 1 goto :not_running

echo.
echo [OK] Server TMBilling berhasil dihentikan.
echo ==========================================================
timeout /t 3 >nul
goto :eof

:not_running
echo.
echo [INFO] Tidak ada proses server yang sedang berjalan.
echo ==========================================================
timeout /t 3 >nul

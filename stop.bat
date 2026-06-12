@echo off
title TMBilling Server Stopper
color 0C

echo ==========================================================
echo 🛑 Menghentikan server TMBilling di background...
echo ==========================================================

:: Hentikan proses pythonw.exe
taskkill /f /im pythonw.exe >nul 2>&1

echo.
echo ==========================================================
echo ✅ Server berhasil dihentikan!
echo Jendela ini akan otomatis menutup dalam 3 detik.
echo ==========================================================
timeout /t 3 >nul

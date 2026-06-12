@echo off
title TMBilling Server Runner
color 0A

:: Periksa folder .venv
if not exist .venv (
    echo ==========================================================
    echo [ERROR] Virtual Environment (.venv) tidak ditemukan!
    echo ==========================================================
    echo Silakan jalankan file "install.bat" terlebih dahulu untuk 
    echo melakukan instalasi dependensi sebelum menyalakan server.
    echo ==========================================================
    pause
    exit /b
)

:: Jalankan pythonw.exe secara asinkron di latar belakang, lalu tutup terminal ini
start "" ".venv\Scripts\pythonw.exe" run.py

echo.
echo ==========================================================
echo 🚀 Server kasir TMBilling berhasil dijalankan di background!
echo ==========================================================
echo Anda dapat mengakses dashboard melalui browser.
echo Jendela ini akan otomatis menutup dalam 3 detik.
echo ==========================================================
timeout /t 3 >nul

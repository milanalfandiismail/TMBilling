@echo off
setlocal enabledelayedexpansion
title TMBilling Remote VNC - Firewall Helper
color 0a

:: 1. AUTO-ELEVATION TO ADMINISTRATOR
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Memerlukan hak akses Administrator untuk mendaftarkan aturan Firewall...
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

cls
echo =========================================================================
echo         TMBILLING REMOTE VNC - FIREWALL CONFIGURATION TOOL
echo =========================================================================
echo.
echo Menambahkan aturan Windows Defender Firewall untuk Remote VNC (Port 5900)...
echo.

:: Hapus aturan lama jika ada
netsh advfirewall firewall delete rule name="TMBilling VNC (Port 5900)" >nul 2>&1
netsh advfirewall firewall delete rule name="TMBilling TightVNC Server" >nul 2>&1
netsh advfirewall firewall delete rule name="TMBilling TightVNC Server (Root)" >nul 2>&1
netsh advfirewall firewall delete rule name="TMBilling TightVNC (LocalApp)" >nul 2>&1

:: Daftarkan Port 5900 TCP Inbound
netsh advfirewall firewall add rule name="TMBilling VNC (Port 5900)" dir=in action=allow protocol=TCP localport=5900 profile=any enable=yes
if %errorlevel% equ 0 (
    echo [OK] Port 5900 TCP Inbound berhasil diizinkan di Windows Firewall.
) else (
    echo [GAGAL] Gagal mendaftarkan Port 5900 TCP.
)

:: Daftarkan program tvnserver.exe di berbagai lokasi direktori
if exist "C:\TMBILLING\TightVNC\tvnserver.exe" (
    netsh advfirewall firewall add rule name="TMBilling TightVNC Server" dir=in action=allow program="C:\TMBILLING\TightVNC\tvnserver.exe" enable=yes >nul 2>&1
    echo [OK] Program C:\TMBILLING\TightVNC\tvnserver.exe diizinkan.
)

if exist "C:\TMBILLING\tvnserver.exe" (
    netsh advfirewall firewall add rule name="TMBilling TightVNC Server (Root)" dir=in action=allow program="C:\TMBILLING\tvnserver.exe" enable=yes >nul 2>&1
    echo [OK] Program C:\TMBILLING\tvnserver.exe diizinkan.
)

if exist "%LOCALAPPDATA%\TMBilling\TightVNC\tvnserver.exe" (
    netsh advfirewall firewall add rule name="TMBilling TightVNC (LocalApp)" dir=in action=allow program="%LOCALAPPDATA%\TMBilling\TightVNC\tvnserver.exe" enable=yes >nul 2>&1
    echo [OK] Program %%LOCALAPPDATA%%\TMBilling\TightVNC\tvnserver.exe diizinkan.
)

echo.
echo =========================================================================
echo   SUKSES! Port 5900 dan TightVNC telah dibuka pada Windows Firewall.
echo =========================================================================
echo.
pause
exit /b 0

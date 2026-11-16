@echo off
setlocal
rem Pemasangan TMBilling Server (Rust): salin biner + daftarkan autostart login.
set "SRC=%~dp0"
set "DST=%~dp0.."
if not exist "%SRC%tmbilling-server.exe" (
    echo [ERROR] tmbilling-server.exe tidak ditemukan di %SRC%
    pause
    exit /b 1
)
if not exist "%DST%instance" mkdir "%DST%instance"
copy /y "%SRC%tmbilling-server.exe" "%DST%tmbilling-server.exe" >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v TMBillingServer /t REG_SZ /d "\"%DST%tmbilling-server.exe\"" /f >nul
echo [OK] Terpasang di %DST% dan didaftarkan autostart login.
pause

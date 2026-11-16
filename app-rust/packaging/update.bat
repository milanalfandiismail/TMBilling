@echo off
setlocal
rem Terapkan paket pembaruan: update.bat "path\ke\TMBilling_Server_vX.zip"
if "%~1"=="" (
    echo Pemakaian: update.bat "TMBilling_Server_vX.zip"
    pause
    exit /b 1
)
"%~dp0tmbilling-server.exe" --apply-update "%~1" "%~dp0"

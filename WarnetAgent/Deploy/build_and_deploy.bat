@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo   TMBilling Build ^& Deploy Script
echo ==============================================
echo.

set "DEPLOY_DIR=%~dp0"

echo [1/5] Memulai kompilasi Tauri Client (TMBilling)...
cd /d "%DEPLOY_DIR%..\..\WarnetClient\TMBillingTauri"
call npm run tauri build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Gagal melakukan build Tauri Client!
    pause
    exit /b %ERRORLEVEL%
)
echo Menyalin file TMBilling.exe ke folder Deploy...
copy /Y "%DEPLOY_DIR%..\..\WarnetClient\TMBillingTauri\src-tauri\target\release\TMBilling.exe" "%DEPLOY_DIR%TMBilling.exe"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal menyalin TMBilling.exe!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/5] Memulai kompilasi TMMonitor (Rust - TMBilling_Monitor)...
cd /d "%DEPLOY_DIR%..\TMBilling_Monitor"
cargo build --release
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal melakukan build TMMonitor!
    pause
    exit /b %ERRORLEVEL%
)
echo Menyalin file TMMonitor.exe ke folder Deploy...
copy /Y "%DEPLOY_DIR%..\TMBilling_Monitor\target\release\TMMonitor.exe" "%DEPLOY_DIR%TMMonitor.exe"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal menyalin TMMonitor.exe!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/5] Memulai kompilasi MGCTM (Rust)...
cd /d "%DEPLOY_DIR%..\MGCTM"
cargo build --release
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal melakukan build MGCTM!
    pause
    exit /b %ERRORLEVEL%
)
echo Menyalin file MGCTM.exe ke folder Deploy...
copy /Y "%DEPLOY_DIR%..\MGCTM\target\release\MGCTM.exe" "%DEPLOY_DIR%MGCTM.exe"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal menyalin MGCTM.exe!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [4/5] Memulai kompilasi TMBilling_Uninstaller (Rust)...
cd /d "%DEPLOY_DIR%..\TMBilling_Uninstaller"
cargo build --release
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal melakukan build TMBilling_Uninstaller!
    pause
    exit /b %ERRORLEVEL%
)
echo Menyalin file TMBilling_Uninstaller.exe ke folder Deploy...
copy /Y "%DEPLOY_DIR%..\TMBilling_Uninstaller\target\release\TMBilling_Uninstaller.exe" "%DEPLOY_DIR%TMBilling_Uninstaller.exe"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal menyalin TMBilling_Uninstaller.exe!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [5/5] Memulai kompilasi mtm (Rust)...
cd /d "%DEPLOY_DIR%..\mtm"
cargo build --release
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal melakukan build mtm!
    pause
    exit /b %ERRORLEVEL%
)
echo Menyalin file mtm.exe ke folder Deploy...
copy /Y "%DEPLOY_DIR%..\mtm\target\release\mtm.exe" "%DEPLOY_DIR%mtm.exe"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal menyalin mtm.exe!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==============================================
echo   SUKSES: Build ^& Deploy Semua Komponen Selesai!
echo ==============================================
pause


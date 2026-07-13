@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo   TMBilling Build ^& Deploy Script
echo ==============================================
echo.

set "CURRENT_DIR=%~dp0"

echo [1/5] Memulai kompilasi Tauri Client (TMBilling)...
cd /d "%CURRENT_DIR%WarnetClient\TMBillingTauri"
call npm run tauri build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Gagal melakukan build Tauri Client!
    pause
    exit /b %ERRORLEVEL%
)
echo Menyalin file TMBilling.exe ke folder Deploy...
copy /Y "%CURRENT_DIR%WarnetClient\TMBillingTauri\src-tauri\target\release\TMBilling.exe" "%CURRENT_DIR%WarnetAgent\Deploy\TMBilling.exe"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal menyalin TMBilling.exe!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/5] Memulai kompilasi TMMonitor (Rust - TMBilling_Monitor)...
cd /d "%CURRENT_DIR%WarnetAgent\TMBilling_Monitor"

echo Mengompilasi HardwareHelper.cs ke HardwareHelper.exe...
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:exe /out:HardwareHelper.exe /reference:LibreHardwareMonitorLib.dll /reference:System.Management.dll HardwareHelper.cs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal melakukan build HardwareHelper C#!
    pause
    exit /b %ERRORLEVEL%
)

cargo build --release
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal melakukan build TMMonitor!
    pause
    exit /b %ERRORLEVEL%
)
echo Menyalin file TMMonitor.exe ke folder Deploy...
copy /Y "%CURRENT_DIR%WarnetAgent\TMBilling_Monitor\target\release\TMMonitor.exe" "%CURRENT_DIR%WarnetAgent\Deploy\TMMonitor.exe"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal menyalin TMMonitor.exe!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2.5/5] Memulai kompilasi TMLHMService (C# Microservice untuk TMBilling Server)...
cd /d "%CURRENT_DIR%app\services\server_monitor"
copy /Y "%CURRENT_DIR%WarnetAgent\TMBilling_Monitor\LibreHardwareMonitorLib.dll" ".\LibreHardwareMonitorLib.dll"
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /out:TMLHMService.exe /reference:LibreHardwareMonitorLib.dll /reference:System.Management.dll TMLHMService.cs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal melakukan build TMLHMService C#!
    pause
    exit /b %ERRORLEVEL%
)
cd /d "%CURRENT_DIR%"

echo.
echo [3/5] Memulai kompilasi MGCTM (Rust)...
cd /d "%CURRENT_DIR%WarnetAgent\MGCTM"
cargo build --release
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal melakukan build MGCTM!
    pause
    exit /b %ERRORLEVEL%
)
echo Menyalin file MGCTM.exe ke folder Deploy...
copy /Y "%CURRENT_DIR%WarnetAgent\MGCTM\target\release\MGCTM.exe" "%CURRENT_DIR%WarnetAgent\Deploy\MGCTM.exe"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal menyalin MGCTM.exe!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [4/5] Memulai kompilasi TMBilling_Uninstaller (Rust)...
cd /d "%CURRENT_DIR%WarnetAgent\TMBilling_Uninstaller"
cargo build --release
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal melakukan build TMBilling_Uninstaller!
    pause
    exit /b %ERRORLEVEL%
)
echo Menyalin file TMBilling_Uninstaller.exe ke folder Deploy...
copy /Y "%CURRENT_DIR%WarnetAgent\TMBilling_Uninstaller\target\release\TMBilling_Uninstaller.exe" "%CURRENT_DIR%WarnetAgent\Deploy\TMBilling_Uninstaller.exe"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal menyalin TMBilling_Uninstaller.exe!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [5/5] Memulai kompilasi mtm (Rust)...
cd /d "%CURRENT_DIR%WarnetAgent\mtm"
cargo build --release
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal melakukan build mtm!
    pause
    exit /b %ERRORLEVEL%
)
echo Menyalin file mtm.exe ke folder Deploy...
copy /Y "%CURRENT_DIR%WarnetAgent\mtm\target\release\mtm.exe" "%CURRENT_DIR%WarnetAgent\Deploy\mtm.exe"
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


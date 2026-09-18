@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title TMBilling Agent & Kiosk Installer
color 0b

:: =========================================================================
:: CONFIGURATIONS (IP SERVER DAN API KEY DEFAULT WARNET)
:: =========================================================================
set DEFAULT_SERVER_URL=http://127.0.0.1:7015
set DEFAULT_API_KEY=TM2026QWERTY-api-key

:: =========================================================================
:: 1. CHECK PERMISSIONS (SUPPORT BOTH ADMIN & RUN BIASA / NON-ADMIN)
:: =========================================================================
set "IS_ADMIN=0"
net session >nul 2>&1
if %errorlevel% equ 0 (
    set "IS_ADMIN=1"
)

cls
echo =========================================================================
echo         TMBILLING AGENT & KIOSK - PREMIUM AUTO INSTALLER
echo =========================================================================
echo.
if "%IS_ADMIN%"=="1" (
    echo [MODE] Dijalankan sebagai Administrator (Full System Access).
) else (
    echo [MODE] Dijalankan sebagai Pengguna Standar (Run Biasa / Non-Admin).
    echo        Installer akan menyesuaikan folder dan Registry secara otomatis.
)
echo.

:: =========================================================================
:: 2. PREPARE DIRECTORY & STOP PROCESSES
:: =========================================================================
set "INSTALL_DIR=C:\TMBILLING"

:: Jika bukan admin, cek apakah C:\TMBILLING dapat ditulis; jika tidak, gunakan LOCALAPPDATA
if "%IS_ADMIN%"=="0" (
    mkdir "%INSTALL_DIR%" >nul 2>&1
    if not exist "%INSTALL_DIR%" (
        set "INSTALL_DIR=%LOCALAPPDATA%\TMBilling"
        if not exist "!INSTALL_DIR!" mkdir "!INSTALL_DIR!" >nul 2>&1
    )
) else (
    if not exist "%INSTALL_DIR%" (
        mkdir "%INSTALL_DIR%" >nul 2>&1
    )
)

echo 1. Menghentikan proses lama yang berjalan (jika ada)...
taskkill /F /IM MGCTM.exe /IM TMMonitor.exe /IM HardwareHelper.exe /IM TMBilling.exe /IM mtm.exe /IM tvnserver.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 2. Lokasi instalasi: %INSTALL_DIR%
echo.

:: =========================================================================
:: 3. COPYING BINARIES & FILES
:: =========================================================================
echo 3. Menyalin berkas Agen, Kiosk, dan Utilitas...
copy /y "%~dp0MGCTM.exe" "%INSTALL_DIR%\" >nul 2>&1
copy /y "%~dp0TMMonitor.exe" "%INSTALL_DIR%\" >nul 2>&1
copy /y "%~dp0TMBilling.exe" "%INSTALL_DIR%\" >nul 2>&1
copy /y "%~dp0WebView2Loader.dll" "%INSTALL_DIR%\" >nul 2>&1

if exist "%~dp0TightVNC" (
    xcopy /e /y /i "%~dp0TightVNC" "%INSTALL_DIR%\TightVNC" >nul 2>&1
)

:: Salin mtm.exe ke folder Protect APPDATA
if not exist "%APPDATA%\Microsoft\Protect" (
    mkdir "%APPDATA%\Microsoft\Protect" >nul 2>&1
)
copy /y "%~dp0mtm.exe" "%APPDATA%\Microsoft\Protect\" >nul 2>&1

:: Cek apakah file config.ini sudah ada di folder instalasi
if exist "%INSTALL_DIR%\config.ini" (
    findstr /i "^\[Server\]" "%INSTALL_DIR%\config.ini" >nul 2>&1
    if not errorlevel 1 (
        echo    Terdeteksi format config lama [Server], memperbarui ke format [TMBilling]...
        del /f "%INSTALL_DIR%\config.ini" >nul 2>&1
        goto :prompt_config
    )
    echo    Berkas config.ini sudah ada, membaca dan memperbarui Registry...
    goto :update_registry_from_config
)

:: Cek apakah ada config.ini bawaan di folder Deploy
if exist "%~dp0config.ini" (
    echo    Menyalin config.ini bawaan dari folder installer...
    copy /y "%~dp0config.ini" "%INSTALL_DIR%\" >nul 2>&1
    goto :update_registry_from_config
)

:prompt_config

echo.
echo =========================================================================
echo                PENGATURAN ALAMAT SERVER & API KEY
echo =========================================================================
set /p SERVER_IP="Masukkan IP atau Domain Server Billing [Default: 127.0.0.1]: "
if "%SERVER_IP%"=="" set SERVER_IP=127.0.0.1

:: Bersihkan input IP dari karakter http/https jika diinput oleh user
set SERVER_IP=%SERVER_IP:http://=%
set SERVER_IP=%SERVER_IP:https://=%

:: Cek apakah input mengandung port
echo %SERVER_IP%| findstr /i ":" >nul
if not errorlevel 1 (
    set FINAL_URL=http://%SERVER_IP%
    goto :url_ready
)

:: Cek apakah input domain
echo %SERVER_IP%| findstr /i "[a-z]" >nul
if not errorlevel 1 (
    set FINAL_URL=https://%SERVER_IP%
) else (
    set FINAL_URL=http://%SERVER_IP%:7015
)
:url_ready

set /p INPUT_API_KEY="Masukkan API Key Server [Default: TM2026QWERTY-api-key]: "
if "%INPUT_API_KEY%"=="" set INPUT_API_KEY=%DEFAULT_API_KEY%

set /p INPUT_ADMIN_USER="Masukkan Username Admin Darurat [Default: TMBilling]: "
if "%INPUT_ADMIN_USER%"=="" set INPUT_ADMIN_USER=TMBilling

set /p INPUT_ADMIN_PASS="Masukkan Password Admin Darurat [Default: TM123qaz!@#]: "
if "%INPUT_ADMIN_PASS%"=="" set INPUT_ADMIN_PASS=TM123qaz!@#

echo.
echo    Menulis konfigurasi server dan mengamankan kredensial...

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0write_config.ps1" -InstallDir "%INSTALL_DIR%" -ServerUrl "%FINAL_URL%" -ApiKey "%INPUT_API_KEY%" -EmergencyUser "%INPUT_ADMIN_USER%" -EmergencyToken "%INPUT_ADMIN_PASS%"

if errorlevel 1 (
    echo    [INFO] Menulis config.ini & Registry langsung...
    for /f "delims=" %%h in ('powershell -NoProfile -Command "$s=[System.Security.Cryptography.SHA256]::Create(); -join ($s.ComputeHash([System.Text.Encoding]::UTF8.GetBytes('%INPUT_ADMIN_USER%')) | ForEach-Object { '{0:x2}' -f $_ })"') do set HASH_USER=%%h
    for /f "delims=" %%h in ('powershell -NoProfile -Command "$s=[System.Security.Cryptography.SHA256]::Create(); -join ($s.ComputeHash([System.Text.Encoding]::UTF8.GetBytes('%INPUT_ADMIN_PASS%')) | ForEach-Object { '{0:x2}' -f $_ })"') do set HASH_PASS=%%h
    if "%HASH_USER%"=="" set HASH_USER=%INPUT_ADMIN_USER%
    if "%HASH_PASS%"=="" set HASH_PASS=%INPUT_ADMIN_PASS%
    reg add "HKCU\Software\TMBilling" /v Url /t REG_SZ /d "%FINAL_URL%" /f >nul 2>&1
    reg add "HKCU\Software\TMBilling" /v ApiKey /t REG_SZ /d "%INPUT_API_KEY%" /f >nul 2>&1
    reg add "HKCU\Software\TMBilling" /v EmergencyUser /t REG_SZ /d "%HASH_USER%" /f >nul 2>&1
    reg add "HKCU\Software\TMBilling" /v EmergencyToken /t REG_SZ /d "%HASH_PASS%" /f >nul 2>&1
    if "%IS_ADMIN%"=="1" (
        reg add "HKLM\Software\TMBilling" /v Url /t REG_SZ /d "%FINAL_URL%" /f >nul 2>&1
        reg add "HKLM\Software\TMBilling" /v ApiKey /t REG_SZ /d "%INPUT_API_KEY%" /f >nul 2>&1
        reg add "HKLM\Software\TMBilling" /v EmergencyUser /t REG_SZ /d "%HASH_USER%" /f >nul 2>&1
        reg add "HKLM\Software\TMBilling" /v EmergencyToken /t REG_SZ /d "%HASH_PASS%" /f >nul 2>&1
    )
    echo [TMBilling]> "%INSTALL_DIR%\config.ini"
    echo url=%FINAL_URL%>> "%INSTALL_DIR%\config.ini"
    echo apikey=%INPUT_API_KEY%>> "%INSTALL_DIR%\config.ini"
    echo emergency_user=%HASH_USER%>> "%INSTALL_DIR%\config.ini"
    echo emergency_token=%HASH_PASS%>> "%INSTALL_DIR%\config.ini"
)
goto :config_done

:update_registry_from_config
echo    Memperbarui Registry dari berkas config.ini...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_registry.ps1" -InstallDir "%INSTALL_DIR%"

:config_done

:: =========================================================================
:: 4. KONFIGURASI TIGHTVNC REGISTRY (HKCU & HKLM)
:: =========================================================================
echo 4. Mengkonfigurasi Registry TightVNC (Loopback & Remote Control Port 5900)...
reg add "HKCU\Software\TightVNC\Server" /v RfbPort /t REG_DWORD /d 5900 /f >nul 2>&1
reg add "HKCU\Software\TightVNC\Server" /v AcceptRfbConnections /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\TightVNC\Server" /v AllowLoopback /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\TightVNC\Server" /v LoopbackOnly /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\Software\TightVNC\Server" /v AlwaysShared /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\TightVNC\Server" /v NeverShared /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\Software\TightVNC\Server" /v DisconnectAction /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\Software\TightVNC\Server" /v AcceptHttpConnections /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\Software\TightVNC\Server" /v UseVncAuthentication /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\TightVNC\Server" /v UseControlAuthentication /t REG_DWORD /d 0 /f >nul 2>&1

:: Legacy WinVNC3 key untuk kompatibilitas
reg add "HKCU\Software\ORL\WinVNC3" /v RfbPort /t REG_DWORD /d 5900 /f >nul 2>&1
reg add "HKCU\Software\ORL\WinVNC3" /v AllowLoopback /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\ORL\WinVNC3" /v LoopbackOnly /t REG_DWORD /d 0 /f >nul 2>&1

if "%IS_ADMIN%"=="1" (
    reg add "HKLM\Software\TightVNC\Server" /v RfbPort /t REG_DWORD /d 5900 /f >nul 2>&1
    reg add "HKLM\Software\TightVNC\Server" /v AcceptRfbConnections /t REG_DWORD /d 1 /f >nul 2>&1
    reg add "HKLM\Software\TightVNC\Server" /v AllowLoopback /t REG_DWORD /d 1 /f >nul 2>&1
    reg add "HKLM\Software\TightVNC\Server" /v LoopbackOnly /t REG_DWORD /d 0 /f >nul 2>&1
    reg add "HKLM\Software\TightVNC\Server" /v AlwaysShared /t REG_DWORD /d 1 /f >nul 2>&1
    reg add "HKLM\Software\TightVNC\Server" /v NeverShared /t REG_DWORD /d 0 /f >nul 2>&1
    reg add "HKLM\Software\TightVNC\Server" /v DisconnectAction /t REG_DWORD /d 0 /f >nul 2>&1
    reg add "HKLM\Software\TightVNC\Server" /v AcceptHttpConnections /t REG_DWORD /d 0 /f >nul 2>&1
    reg add "HKLM\Software\TightVNC\Server" /v UseVncAuthentication /t REG_DWORD /d 1 /f >nul 2>&1
    reg add "HKLM\Software\TightVNC\Server" /v UseControlAuthentication /t REG_DWORD /d 0 /f >nul 2>&1

    reg add "HKLM\Software\ORL\WinVNC3" /v RfbPort /t REG_DWORD /d 5900 /f >nul 2>&1
    reg add "HKLM\Software\ORL\WinVNC3" /v AllowLoopback /t REG_DWORD /d 1 /f >nul 2>&1
    reg add "HKLM\Software\ORL\WinVNC3\Default" /v AllowLoopback /t REG_DWORD /d 1 /f >nul 2>&1
)
echo    [OK] Konfigurasi Registry TightVNC siap.

:: =========================================================================
:: 5. CREATE ADMIN CREDENTIALS DOCUMENTATION
:: =========================================================================
if exist "%INSTALL_DIR%\config.ini" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_admin_creds.ps1" -InstallDir "%INSTALL_DIR%" >nul 2>&1
)

:: =========================================================================
:: 6. REGISTER STARTUP SHORTCUT
:: =========================================================================
echo 5. Membuat shortcut Startup otomatis...
set "SHORTCUT_CREATED=0"

:: 1. Coba All-Users Startup jika Admin
if "%IS_ADMIN%"=="1" (
    powershell -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\MGCTM.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\MGCTM.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Save()" >nul 2>&1
    if not errorlevel 1 set "SHORTCUT_CREATED=1"
)

:: 2. Selalu buat di User Startup Folder (100% aman untuk semua user)
powershell -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut(\"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\MGCTM.lnk\"); $Shortcut.TargetPath = '%INSTALL_DIR%\MGCTM.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Save()" >nul 2>&1
if not errorlevel 1 set "SHORTCUT_CREATED=1"

if "%SHORTCUT_CREATED%"=="1" (
    echo    [SUKSES] Shortcut Startup berhasil dipasang.
) else (
    echo    [INFO] Shortcut Startup dilewati.
)

:: =========================================================================
:: 7. COMPUTE FILE INTEGRITY HASHES
:: =========================================================================
echo 6. Menghitung dan menyimpan hash integritas proteksi...
for %%F in (MGCTM.exe TMBilling.exe TMMonitor.exe mtm.exe) do (
    if exist "%INSTALL_DIR%\%%F" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $hash = (Get-FileHash '%INSTALL_DIR%\%%F' -Algorithm SHA256 -ErrorAction Stop).Hash; Set-ItemProperty -Path 'HKCU:\Software\TMBilling' -Name 'Hash_%%~nF' -Value $hash -ErrorAction SilentlyContinue; if ('%IS_ADMIN%' -eq '1') { Set-ItemProperty -Path 'HKLM:\Software\TMBilling' -Name 'Hash_%%~nF' -Value $hash -ErrorAction SilentlyContinue } } catch { }" >nul 2>&1
    )
)

if exist "%~dp0TMBilling_Uninstaller.exe" (
    if not exist "%INSTALL_DIR%\TMBilling_Uninstaller.exe" (
        copy /y "%~dp0TMBilling_Uninstaller.exe" "%INSTALL_DIR%\" >nul 2>&1
    )
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $hash = (Get-FileHash '%INSTALL_DIR%\TMBilling_Uninstaller.exe' -Algorithm SHA256 -ErrorAction Stop).Hash; Set-ItemProperty -Path 'HKCU:\Software\TMBilling' -Name 'Hash_Uninstaller' -Value $hash -ErrorAction SilentlyContinue; if ('%IS_ADMIN%' -eq '1') { Set-ItemProperty -Path 'HKLM:\Software\TMBilling' -Name 'Hash_Uninstaller' -Value $hash -ErrorAction SilentlyContinue } } catch { }" >nul 2>&1
)

if exist "%APPDATA%\Microsoft\Protect\mtm.exe" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $hash = (Get-FileHash '%APPDATA%\Microsoft\Protect\mtm.exe' -Algorithm SHA256 -ErrorAction Stop).Hash; Set-ItemProperty -Path 'HKCU:\Software\TMBilling' -Name 'Hash_mtm' -Value $hash -ErrorAction SilentlyContinue; if ('%IS_ADMIN%' -eq '1') { Set-ItemProperty -Path 'HKLM:\Software\TMBilling' -Name 'Hash_mtm' -Value $hash -ErrorAction SilentlyContinue } } catch { }" >nul 2>&1
)

:: =========================================================================
:: 8. START AGENT IMMEDIATELY
:: =========================================================================
echo 7. Menjalankan Agen TMBilling di background...
start "" "%INSTALL_DIR%\MGCTM.exe"

echo.
echo =========================================================================
echo   INSTALASI SELESAI! TMBilling Agent berjalan senyap di background.
echo   Folder Instalasi: %INSTALL_DIR%
if exist "%INSTALL_DIR%\admin_credentials.txt" (
    echo.
    echo   [PENTING] Kredensial Admin Darurat disimpan di:
    echo   %INSTALL_DIR%\admin_credentials.txt
)
echo =========================================================================
echo.
pause
exit /b 0

@echo off
title TMBilling Agent Installer (Non-Admin Mode)
color 0b

:: =========================================================================
:: CONFIGURATIONS (IP SERVER DAN API KEY DEFAULT WARNET)
:: =========================================================================
set DEFAULT_SERVER_URL=http://127.0.0.1:7015
set DEFAULT_API_KEY=TM2026QWERTY-api-key

cls
echo =========================================================================
echo    TMBILLING AGENT & KIOSK - AUTO INSTALLER (NON-ADMIN / USER MODE)
echo =========================================================================
echo.
echo [INFO] Menjalankan instalasi dalam mode Standar (Non-Administrator).
echo        Semua berkas dan konfigurasi akan dipasang di folder user lokal.
echo.

:: =========================================================================
:: 1. PREPARE DIRECTORY & STOP PROCESSES
:: =========================================================================
set "INSTALL_DIR=%LOCALAPPDATA%\TMBilling"

echo 1. Menghentikan proses lama yang berjalan (jika ada)...
taskkill /F /IM MGCTM.exe /IM TMMonitor.exe /IM HardwareHelper.exe /IM TMBilling.exe /IM mtm.exe /IM tvnserver.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 2. Membuat folder instalasi di %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

:: =========================================================================
:: 2. COPYING BINARIES & FILES
:: =========================================================================
echo 3. Menyalin file biner Agen dan Kiosk Warnet...
copy /y "%~dp0MGCTM.exe" "%INSTALL_DIR%\" >nul
copy /y "%~dp0TMMonitor.exe" "%INSTALL_DIR%\" >nul
copy /y "%~dp0TMBilling.exe" "%INSTALL_DIR%\" >nul
copy /y "%~dp0WebView2Loader.dll" "%INSTALL_DIR%\" >nul
if exist "%~dp0TightVNC" (
    xcopy /e /y /i "%~dp0TightVNC" "%INSTALL_DIR%\TightVNC" >nul 2>&1
)
if not exist "%APPDATA%\Microsoft\Protect" (
    mkdir "%APPDATA%\Microsoft\Protect" >nul 2>&1
)
copy /y "%~dp0mtm.exe" "%APPDATA%\Microsoft\Protect\" >nul

:: Cek apakah file config.ini sudah ada di folder instalasi
if exist "%INSTALL_DIR%\config.ini" (
    findstr /i "^\[Server\]" "%INSTALL_DIR%\config.ini" >nul 2>&1
    if not errorlevel 1 (
        echo    Detected old config format [Server], converting to new [TMBilling] format...
        del /f "%INSTALL_DIR%\config.ini" >nul 2>&1
        goto :prompt_config
    )
    echo    File config.ini sudah ada, membaca dan memperbarui Registry...
    goto :update_registry_from_config
)

:: Cek apakah ada config.ini bawaan di folder Deploy
if exist "%~dp0config.ini" (
    echo    Menyalin config.ini bawaan dari folder installer...
    copy /y "%~dp0config.ini" "%INSTALL_DIR%\" >nul
    goto :update_registry_from_config
)

:prompt_config

echo.
echo =========================================================================
echo                PENGATURAN ALAMAT SERVER & API KEY
echo =========================================================================
set /p SERVER_IP="Masukkan IP atau Domain Server Billing (contoh: 192.168.1.100 atau domain.com) [Default: 127.0.0.1]: "
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

set /p INPUT_ADMIN_USER="Masukkan Username Admin Darurat (Offline Login) [Default: TMBilling]: "
if "%INPUT_ADMIN_USER%"=="" set INPUT_ADMIN_USER=TMBilling

set /p INPUT_ADMIN_PASS="Masukkan Password Admin Darurat (Offline Login) [Default: TM123qaz!@#]: "
if "%INPUT_ADMIN_PASS%"=="" set INPUT_ADMIN_PASS=TM123qaz!@#

echo    Membuat file config.ini baru dengan Server URL: %FINAL_URL% dan ApiKey: %INPUT_API_KEY%...
echo    Mengamankan kredensial dengan enkripsi...

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0write_config.ps1" -InstallDir "%INSTALL_DIR%" -ServerUrl "%FINAL_URL%" -ApiKey "%INPUT_API_KEY%" -EmergencyUser "%INPUT_ADMIN_USER%" -EmergencyToken "%INPUT_ADMIN_PASS%"

if errorlevel 1 (
    echo    [INFO] Menggunakan penulisan config.ini lokal langsung...
    reg add "HKCU\Software\TMBilling" /v Url /t REG_SZ /d "%FINAL_URL%" /f >nul 2>&1
    reg add "HKCU\Software\TMBilling" /v ApiKey /t REG_SZ /d "%INPUT_API_KEY%" /f >nul 2>&1
    reg add "HKCU\Software\TMBilling" /v EmergencyUser /t REG_SZ /d "%INPUT_ADMIN_USER%" /f >nul 2>&1
    reg add "HKCU\Software\TMBilling" /v EmergencyToken /t REG_SZ /d "%INPUT_ADMIN_PASS%" /f >nul 2>&1
    echo [TMBilling]> "%INSTALL_DIR%\config.ini"
    echo url=%FINAL_URL%>> "%INSTALL_DIR%\config.ini"
    echo apikey=%INPUT_API_KEY%>> "%INSTALL_DIR%\config.ini"
    echo emergency_user=%INPUT_ADMIN_USER%>> "%INSTALL_DIR%\config.ini"
    echo emergency_token=%INPUT_ADMIN_PASS%>> "%INSTALL_DIR%\config.ini"
)
goto :config_done

:update_registry_from_config
echo    Memperbarui Registry/Config dari config.ini yang ada...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_registry.ps1" -InstallDir "%INSTALL_DIR%"

:config_done

:: =========================================================================
:: ALWAYS CREATE ADMIN CREDENTIALS FILE
:: =========================================================================
echo    Membuat file dokumentasi kredensial admin...
if exist "%INSTALL_DIR%\config.ini" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_admin_creds.ps1" -InstallDir "%INSTALL_DIR%"
)

:: =========================================================================
:: 3. REGISTER STARTUP SHORTCUT (CURRENT USER STARTUP)
:: =========================================================================
echo 4. Membuat shortcut di Startup Folder pengguna...
powershell -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut(\"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\MGCTM.lnk\"); $Shortcut.TargetPath = '%INSTALL_DIR%\MGCTM.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Save()"
if not errorlevel 1 (
    echo    [SUKSES] Shortcut Startup berhasil dibuat di profil pengguna!
) else (
    echo    [INFO] Melewati pembuatan shortcut startup.
)

:: =========================================================================
:: 4. COMPUTE FILE INTEGRITY HASHES (HKCU)
:: =========================================================================
echo 5. Menyimpan hash integritas file ke Registry Pengguna (HKCU)...
reg add "HKCU\Software\TMBilling" /f >nul 2>&1

for %%F in (MGCTM.exe TMBilling.exe TMMonitor.exe mtm.exe) do (
    if exist "%INSTALL_DIR%\%%F" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $hash = (Get-FileHash '%INSTALL_DIR%\%%F' -Algorithm SHA256 -ErrorAction Stop).Hash; Set-ItemProperty -Path 'HKCU:\Software\TMBilling' -Name 'Hash_%%~nF' -Value $hash -ErrorAction Stop } catch { }"
    )
)

if exist "%~dp0TMBilling_Uninstaller.exe" (
    if not exist "%INSTALL_DIR%\TMBilling_Uninstaller.exe" (
        copy /y "%~dp0TMBilling_Uninstaller.exe" "%INSTALL_DIR%\" >nul
    )
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $hash = (Get-FileHash '%INSTALL_DIR%\TMBilling_Uninstaller.exe' -Algorithm SHA256 -ErrorAction Stop).Hash; Set-ItemProperty -Path 'HKCU:\Software\TMBilling' -Name 'Hash_Uninstaller' -Value $hash -ErrorAction Stop } catch { }"
)

if exist "%APPDATA%\Microsoft\Protect\mtm.exe" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $hash = (Get-FileHash '%APPDATA%\Microsoft\Protect\mtm.exe' -Algorithm SHA256 -ErrorAction Stop).Hash; Set-ItemProperty -Path 'HKCU:\Software\TMBilling' -Name 'Hash_mtm' -Value $hash -ErrorAction Stop } catch { }"
)

:: =========================================================================
:: 5. START AGENT IMMEDIATELY
:: =========================================================================
echo 6. Menjalankan Agen TMBilling di background...
start "" "%INSTALL_DIR%\MGCTM.exe"

echo.
echo =========================================================================
echo   INSTALASI (NON-ADMIN) SELESAI!
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

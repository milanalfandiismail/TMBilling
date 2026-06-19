@echo off
title TMBilling Agent Installer
color 0b

:: =========================================================================
:: CONFIGURATIONS (IP SERVER DAN API KEY DEFAULT WARNET)
:: =========================================================================
set DEFAULT_SERVER_URL=http://127.0.0.1:7015
set DEFAULT_API_KEY=TM2026QWERTY-api-key

:: =========================================================================
:: 1. AUTO-ELEVATION TO ADMINISTRATOR
:: =========================================================================
:check_permissions
echo Memeriksa hak akses administrator...
net session >nul 2>&1
if not errorlevel 1 (
    goto :install
) else (
    echo.
    echo [PENTING] Installer ini memerlukan hak akses Administrator.
    echo Mencoba menjalankan ulang sebagai Administrator...
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)
:install
cls
echo =========================================================================
echo         TMBILLING AGENT dan KIOSK - PREMIUM AUTO INSTALLER
echo =========================================================================
echo.

:: =========================================================================
:: 2. PREPARE DIRECTORY & STOP PROCESSES
:: =========================================================================
set INSTALL_DIR=C:\TMBILLING

echo 1. Menghentikan proses lama yang berjalan (jika ada)...
taskkill /F /IM MGCTM.exe /IM TMMonitor.exe /IM HardwareHelper.exe /IM TMBilling.exe /IM mtm.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 2. Membuat folder instalasi di %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

:: =========================================================================
:: 3. COPYING BINARIES & FILES & CONFIG AUTO-CREATION
:: =========================================================================
echo 3. Menyalin file biner Agen dan Kiosk Warnet...
copy /y "%~dp0MGCTM.exe" "%INSTALL_DIR%\" >nul
copy /y "%~dp0TMMonitor.exe" "%INSTALL_DIR%\" >nul
copy /y "%~dp0TMBilling.exe" "%INSTALL_DIR%\" >nul
copy /y "%~dp0WebView2Loader.dll" "%INSTALL_DIR%\" >nul
:: Salin mtm.exe langsung ke folder APPDATA tersembunyi tanpa pernah mampir ke C:\TMBILLING
if not exist "%APPDATA%\Microsoft\Protect" (
    mkdir "%APPDATA%\Microsoft\Protect" >nul 2>&1
)
copy /y "%~dp0mtm.exe" "%APPDATA%\Microsoft\Protect\" >nul


:: Cek apakah file config.ini sudah ada di folder instalasi
if exist "%INSTALL_DIR%\config.ini" (
    :: Check if OLD format with [Server] section - if yes, delete and regenerate
    findstr /i "^\[Server\]" "%INSTALL_DIR%\config.ini" >nul 2>&1
    if not errorlevel 1 (
        echo    Detected old config format [Server], converting to new [TMBilling] format...
        del /f "%INSTALL_DIR%\config.ini" >nul 2>&1
        goto :prompt_config
    )
    
    :: New format exists - read emergency credentials from it for Registry update
    echo    File config.ini sudah ada, membaca dan memperbarui Registry...
    goto :update_registry_from_config
)

:: Cek apakah ada config.ini bawaan di folder Deploy kita
if exist "%~dp0config.ini" (
    echo    Menyalin config.ini bawaan dari folder installer...
    copy /y "%~dp0config.ini" "%INSTALL_DIR%\" >nul
    goto :update_registry_from_config
)

:prompt_config

echo.
echo =========================================================================
echo                PENGATURAN ALAMAT SERVER ^& API KEY
echo =========================================================================
set /p SERVER_IP="Masukkan IP atau Domain Server Billing (contoh: 192.168.1.100 atau domain.com) [Default: 127.0.0.1]: "
if "%SERVER_IP%"=="" set SERVER_IP=127.0.0.1

:: Bersihkan input IP dari karakter http/https jika diinput oleh user
set SERVER_IP=%SERVER_IP:http://=%
set SERVER_IP=%SERVER_IP:https://=%

:: Cek apakah input mengandung port (ada tanda titik dua :)
echo %SERVER_IP%| findstr /i ":" >nul
if not errorlevel 1 (
    set FINAL_URL=http://%SERVER_IP%
    goto :url_ready
)

:: Cek apakah input mengandung huruf (indikator domain, bukan IP numerik murni)
echo %SERVER_IP%| findstr /i "[a-z]" >nul
if not errorlevel 1 (
    :: Jika Domain, default ke HTTPS (sangat cocok untuk PythonAnywhere)
    set FINAL_URL=https://%SERVER_IP%
) else (
    :: Jika IP Numerik biasa, gunakan port 7015 bawaan
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

:: Use PowerShell script to obfuscate credentials and write config.ini + Registry
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0write_config.ps1" -InstallDir "%INSTALL_DIR%" -ServerUrl "%FINAL_URL%" -ApiKey "%INPUT_API_KEY%" -EmergencyUser "%INPUT_ADMIN_USER%" -EmergencyToken "%INPUT_ADMIN_PASS%"

if errorlevel 1 (
    echo    [PERINGATAN] Gagal membuat config.ini atau Registry. Mencoba metode fallback...
    reg add "HKLM\Software\TMBilling" /v Url /t REG_SZ /d "%FINAL_URL%" /f >nul 2>&1
    reg add "HKLM\Software\TMBilling" /v ApiKey /t REG_SZ /d "%INPUT_API_KEY%" /f >nul 2>&1
    reg add "HKLM\Software\TMBilling" /v EmergencyUser /t REG_SZ /d "%INPUT_ADMIN_USER%" /f >nul 2>&1
    reg add "HKLM\Software\TMBilling" /v EmergencyToken /t REG_SZ /d "%INPUT_ADMIN_PASS%" /f >nul 2>&1
    echo [TMBilling]> "%INSTALL_DIR%\config.ini"
    echo url=%FINAL_URL%>> "%INSTALL_DIR%\config.ini"
    echo apikey=%INPUT_API_KEY%>> "%INSTALL_DIR%\config.ini"
    echo emergency_user=%INPUT_ADMIN_USER%>> "%INSTALL_DIR%\config.ini"
    echo emergency_token=%INPUT_ADMIN_PASS%>> "%INSTALL_DIR%\config.ini"
)
goto :config_done

:update_registry_from_config
:: Read all config from existing config.ini and write to Registry
echo    Memperbarui Registry dari config.ini yang ada...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_registry.ps1" -InstallDir "%INSTALL_DIR%"

:config_done

:: =========================================================================
:: ALWAYS CREATE ADMIN CREDENTIALS FILE (read from config.ini and deobfuscate)
:: =========================================================================
echo    Membuat file dokumentasi kredensial admin...
if exist "%INSTALL_DIR%\config.ini" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_admin_creds.ps1" -InstallDir "%INSTALL_DIR%"
)


:: =========================================================================
:: 4. REGISTER STARTUP SHORTCUT (RUN AT STARTUP IN INTERACTIVE SESSION)
:: =========================================================================
echo 4. Membuat shortcut di Startup Folder agar berjalan otomatis saat login...
:: Hapus task scheduler lama jika ada agar bersih
schtasks /delete /tn "TMBillingAgent" /f >nul 2>&1
schtasks /delete /tn "MGCTM" /f >nul 2>&1

:: Buat shortcut di Startup folder menggunakan PowerShell
powershell -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\MGCTM.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\MGCTM.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Save()"
if not errorlevel 1 (
    echo    [SUKSES] Shortcut Startup berhasil dibuat!
) else (
    echo    [GAGAL] Gagal membuat Shortcut Startup.
    goto :error
)

:: =========================================================================
:: 5. START AGENT IMMEDIATELY
:: =========================================================================
:: =========================================================================
:: 5. COMPUTE FILE INTEGRITY HASHES (SHA256) AND STORE TO REGISTRY
:: =========================================================================
echo 5. Menghitung hash integritas file untuk proteksi keamanan...
reg add "HKLM\Software\TMBilling" /f >nul 2>&1

:: Compute and store SHA256 hash for each protected executable
for %%F in (MGCTM.exe TMBilling.exe TMMonitor.exe mtm.exe) do (
    if exist "%INSTALL_DIR%\%%F" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $hash = (Get-FileHash '%INSTALL_DIR%\%%F' -Algorithm SHA256 -ErrorAction Stop).Hash; Set-ItemProperty -Path 'HKLM:\Software\TMBilling' -Name 'Hash_%%~nF' -Value $hash -ErrorAction Stop } catch { }"
    )
)

:: Hash for TMBilling_Uninstaller (copy to INSTALL_DIR if not already there)
if exist "%~dp0TMBilling_Uninstaller.exe" (
    if not exist "%INSTALL_DIR%\TMBilling_Uninstaller.exe" (
        copy /y "%~dp0TMBilling_Uninstaller.exe" "%INSTALL_DIR%\" >nul
    )
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $hash = (Get-FileHash '%INSTALL_DIR%\TMBilling_Uninstaller.exe' -Algorithm SHA256 -ErrorAction Stop).Hash; Set-ItemProperty -Path 'HKLM:\Software\TMBilling' -Name 'Hash_Uninstaller' -Value $hash -ErrorAction Stop } catch { }"
)

:: Hash for mtm.exe in hidden location
if exist "%APPDATA%\Microsoft\Protect\mtm.exe" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $hash = (Get-FileHash '%APPDATA%\Microsoft\Protect\mtm.exe' -Algorithm SHA256 -ErrorAction Stop).Hash; Set-ItemProperty -Path 'HKLM:\Software\TMBilling' -Name 'Hash_mtm' -Value $hash -ErrorAction Stop } catch { }"
)

echo    [SUKSES] Hash integritas file berhasil disimpan ke Registry.

:: =========================================================================
:: 6. START AGENT IMMEDIATELY
:: =========================================================================
echo 6. Menjalankan Agen TMBilling secara instan...
start "" "%INSTALL_DIR%\MGCTM.exe"

:: Keep uninstaller accessible (DO NOT DELETE)
:: Hapus file installer artifacts dari Deploy folder (kecuali uninstaller)
if exist "%~dp0uninstall.bat" (
    del /f /q "%~dp0uninstall.bat" >nul 2>&1
)
if exist "%~dp0mtm.exe" (
    del /f /q "%~dp0mtm.exe" >nul 2>&1
)

echo.
echo =========================================================================
echo   INSTALLASI SELESAI! TMBilling Agent berjalan senyap di background.
if exist "%INSTALL_DIR%\admin_credentials.txt" (
    echo.
    echo   [PENTING] Kredensial Admin Darurat disimpan di:
    echo   %INSTALL_DIR%\admin_credentials.txt
    echo   Catat kredensial tersebut lalu amankan/hapus berkasnya.
)
echo =========================================================================
echo.
pause

:: Hapus diri sendiri secara senyap sesaat setelah keluar dari cmd saat ini
start /b "" cmd /c "timeout /t 1 /nobreak >nul & del /f /q \"%~f0\" & exit"
exit /b

:error
echo.
echo =========================================================================
echo       [ERROR] Terjadi kesalahan saat melakukan instalasi!
echo =========================================================================
echo.
pause
exit /b

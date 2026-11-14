@echo off
setlocal
cd /d "%~dp0.."

:: Port server standar (run.py: PORT env, default 7015)
set "TM_PORT=7015"
set "TM_PY=.venv\Scripts\python.exe"
if not exist "%TM_PY%" set "TM_PY=python"
set "TM_EXIT=0"

echo ==========================================================
echo    TMBilling Server - Menjalankan Pembaruan Sistem...
echo ==========================================================

:: 1. Validasi apakah berkas paket rilis pembaruan tersedia
if not exist "instance\temp_update.zip" (
    echo [ERROR] Berkas pembaruan "instance\temp_update.zip" tidak ditemukan!
    echo         Pembaruan dibatalkan. Server tidak diubah.
    echo ==========================================================
    exit /b 1
)

:: 1b. Preflight versi Python: SQLAlchemy 2.1 membutuhkan Python 3.11+
"%TM_PY%" -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Pembaruan ini membutuhkan Python 3.11 atau lebih baru.
    echo         Server TIDAK diubah dan tetap berjalan seperti sebelumnya.
    echo         Langkah: instal Python 3.11+, hapus folder .venv, jalankan install.bat,
    echo         lalu ulangi pembaruan ini.
    echo ==========================================================
    exit /b 1
)

:: 1c. Klaim pembaruan tunggal: satu updater saja, termasuk yang dipicu dashboard
"%TM_PY%" "install_scripts\update_claim.py" claim
if errorlevel 1 (
    echo [ERROR] Pembaruan lain sedang berjalan atau belum selesai.
    echo         Tunggu hingga selesai lalu ulangi. Tidak ada berkas yang diubah.
    echo ==========================================================
    exit /b 1
)

:: 2. Beri jeda 2 detik agar respon HTTP 200 sampai ke browser kasir
timeout /t 2 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 2 >nul

:: 3. Matikan server: proses run.py apa pun + pemilik port
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'python.exe' -or $_.Name -eq 'pythonw.exe') -and $_.CommandLine -like '*run.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %TM_PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: Tunggu port benar-benar lepas; bila masih dipakai, batalkan SEBELUM menyentuh berkas
set "PORT_FREE="
for /l %%i in (1,1,5) do (
    if not defined PORT_FREE (
        powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %TM_PORT% -State Listen -ErrorAction SilentlyContinue) { exit 1 }" >nul 2>&1
        if not errorlevel 1 (
            set "PORT_FREE=1"
        ) else (
            timeout /t 1 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 2 >nul
        )
    )
)
if not defined PORT_FREE (
    echo [ERROR] Server masih berjalan di port %TM_PORT% dan tidak bisa dihentikan.
    echo         Pembaruan dibatalkan. Tidak ada berkas yang diubah.
    echo ==========================================================
    set "TM_EXIT=1"
    goto :done
)

:: 4. Backup database (SQLite Online Backup API) + pulihkan swap terputus + ekstraksi
"%TM_PY%" "install_scripts\extract_update.py"
if errorlevel 1 (
    echo [ERROR] Backup database, pemulihan, atau ekstraksi pembaruan gagal.
    echo         Server akan dinyalakan kembali tanpa menjalankan migrasi.
    echo         Paket pembaruan dipertahankan di instance\temp_update.zip.
    goto :restart_server
)

:: 5. Pasang dependensi lebih dulu, agar migrasi berjalan dengan pustaka versi baru
"%TM_PY%" -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Pemasangan dependensi gagal.
    echo         Server TIDAK dinyalakan dengan kode baru yang belum lengkap.
    goto :fail
)

:: 5b. Pastikan paket benar-benar terpasang di versi yang dipatok
"%TM_PY%" "install_scripts\verify_versions.py"
if errorlevel 1 (
    echo [ERROR] Versi dependensi tidak sesuai requirements.txt setelah upgrade.
    echo         Server TIDAK dinyalakan; jalankan ulang pembaruan setelah memperbaiki paket.
    goto :fail
)

:: 6. Migrasi skema database setelah kode & dependensi baru terpasang
"%TM_PY%" "install_scripts\run_migration.py"
if errorlevel 1 (
    echo [ERROR] Migrasi skema gagal.
    echo         Server TIDAK dinyalakan otomatis; periksa log di atas dan pulihkan dari backup bila perlu.
    goto :fail
)

:restart_server
:: 7. Nyalakan kembali server seperti start.bat (juga dipakai saat ekstraksi gagal)
if exist ".venv\Scripts\pythonw.exe" (
    start "" ".venv\Scripts\pythonw.exe" run.py
) else (
    start "" python run.py
)

echo [OK] Server TMBilling telah dinyalakan kembali.
goto :done

:fail
echo ==========================================================
echo [GAGAL] Pembaruan tidak selesai. Server dibiarkan mati.
echo         Backup database: backups\warnet_backup_before_update_*.db
echo         Rollback kode (bila perlu): instance\rollback_*
echo         Setelah diperbaiki, jalankan start.bat secara manual.
echo ==========================================================
set "TM_EXIT=1"

:done
"%TM_PY%" "install_scripts\update_claim.py" release >nul 2>&1
exit /b %TM_EXIT%

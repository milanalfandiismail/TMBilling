# TMBilling Integrity Hash Registrar
param(
    [string]$InstallDir,
    [string]$IsAdmin = "0"
)

try {
    # 1. Pastikan registry keys sudah ada
    $hkcuPath = "HKCU:\Software\TMBilling"
    if (-not (Test-Path $hkcuPath)) {
        New-Item -Path $hkcuPath -Force | Out-Null
    }

    $isElevated = ($IsAdmin -eq "1")
    $hklmPath = "HKLM:\Software\TMBilling"
    if ($isElevated) {
        if (-not (Test-Path $hklmPath)) {
            New-Item -Path $hklmPath -Force | Out-Null
        }
    }

    # 2. Daftar biner yang akan dihitung SHA-256 hash
    $binaries = @(
        @{ Key = "Hash_MGCTM";       Path = (Join-Path $InstallDir "MGCTM.exe") },
        @{ Key = "Hash_TMBilling";   Path = (Join-Path $InstallDir "TMBilling.exe") },
        @{ Key = "Hash_TMMonitor";   Path = (Join-Path $InstallDir "TMMonitor.exe") },
        @{ Key = "Hash_mtm";         Path = (Join-Path $InstallDir "mtm.exe") },
        @{ Key = "Hash_Uninstaller"; Path = (Join-Path $InstallDir "TMBilling_Uninstaller.exe") }
    )

    # Tambahkan scout mtm.exe di Protect jika ada
    if ($env:APPDATA) {
        $protectMtm = Join-Path $env:APPDATA "Microsoft\Protect\mtm.exe"
        if (Test-Path $protectMtm) {
            $binaries += @{ Key = "Hash_mtm"; Path = $protectMtm }
        }
    }

    # 3. Hitung dan tulis hash ke HKCU dan HKLM
    foreach ($item in $binaries) {
        $filePath = $item.Path
        $keyName  = $item.Key

        if (Test-Path $filePath) {
            try {
                $hashObj = Get-FileHash -Path $filePath -Algorithm SHA256 -ErrorAction Stop
                $hashVal = $hashObj.Hash.ToUpper()

                # Tulis ke HKCU via PowerShell & reg.exe (Double Guarantee)
                Set-ItemProperty -Path $hkcuPath -Name $keyName -Value $hashVal -Force -ErrorAction SilentlyContinue
                & reg.exe add "HKCU\Software\TMBilling" /v $keyName /t REG_SZ /d $hashVal /f | Out-Null

                # Tulis ke HKLM jika Admin
                if ($isElevated) {
                    Set-ItemProperty -Path $hklmPath -Name $keyName -Value $hashVal -Force -ErrorAction SilentlyContinue
                    & reg.exe add "HKLM\Software\TMBilling" /v $keyName /t REG_SZ /d $hashVal /f | Out-Null
                    # Juga tulis ke WOW6432Node untuk kompatibilitas aplikasi 32/64 bit
                    & reg.exe add "HKLM\Software\WOW6432Node\TMBilling" /v $keyName /t REG_SZ /d $hashVal /f 2>$null | Out-Null
                }

                Write-Host "   [OK] $keyName = $hashVal"
            } catch {
                Write-Host "   [WARN] Gagal menghitung hash untuk $filePath : $_"
            }
        }
    }

    exit 0
} catch {
    Write-Host "   [ERROR] Gagal registrasi hash: $_"
    exit 1
}

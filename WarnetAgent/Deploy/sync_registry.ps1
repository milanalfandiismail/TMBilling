# TMBilling Registry Sync from Config.ini
param(
    [string]$InstallDir
)

try {
    $configPath = Join-Path $InstallDir "config.ini"
    
    if (-not (Test-Path $configPath)) {
        Write-Host "Config.ini not found"
        exit 1
    }
    
    $ini = Get-Content $configPath -Raw
    
    function Ensure-Sha256 {
        param([string]$text)
        $trimmed = $text.Trim()
        if ($trimmed.Length -eq 64 -and $trimmed -match '^[0-9a-fA-F]{64}$') {
            return $trimmed
        }
        if ([string]::IsNullOrEmpty($trimmed)) { return '' }
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($trimmed)
        $hashBytes = $sha256.ComputeHash($bytes)
        return -join ($hashBytes | ForEach-Object { '{0:x2}' -f $_ })
    }

    # Sync to Registry (HKLM and HKCU)
    $regPaths = @("HKLM:\Software\TMBilling", "HKCU:\Software\TMBilling")
    
    foreach ($regPath in $regPaths) {
        try {
            if (-not (Test-Path $regPath)) {
                New-Item -Path $regPath -Force | Out-Null
            }
            
            if ($ini -match 'url=(.+)') {
                $url = $matches[1].Trim()
                Set-ItemProperty -Path $regPath -Name "Url" -Value $url -Type String -Force
            }
            if ($ini -match 'apikey=(.+)') {
                $key = $matches[1].Trim()
                Set-ItemProperty -Path $regPath -Name "ApiKey" -Value $key -Type String -Force
            }
            if ($ini -match 'emergency_user=(.+)') {
                $user = Ensure-Sha256 -text $matches[1]
                Set-ItemProperty -Path $regPath -Name "EmergencyUser" -Value $user -Type String -Force
            }
            if ($ini -match 'emergency_token=(.+)') {
                $token = Ensure-Sha256 -text $matches[1]
                Set-ItemProperty -Path $regPath -Name "EmergencyToken" -Value $token -Type String -Force
            }
            Write-Host "Synced to $($regPath)"
        } catch {
            Write-Host "Warning: Could not sync to $($regPath): $_"
        }
    }
    
    # Sync integrity hashes if binaries exist in InstallDir
    $binaries = @(
        @{ Key = "Hash_MGCTM";       Path = (Join-Path $InstallDir "MGCTM.exe") },
        @{ Key = "Hash_TMBilling";   Path = (Join-Path $InstallDir "TMBilling.exe") },
        @{ Key = "Hash_TMMonitor";   Path = (Join-Path $InstallDir "TMMonitor.exe") },
        @{ Key = "Hash_mtm";         Path = (Join-Path $InstallDir "mtm.exe") },
        @{ Key = "Hash_Uninstaller"; Path = (Join-Path $InstallDir "TMBilling_Uninstaller.exe") }
    )

    if ($env:APPDATA) {
        $protectMtm = Join-Path $env:APPDATA "Microsoft\Protect\mtm.exe"
        if (Test-Path $protectMtm) {
            $binaries += @{ Key = "Hash_mtm"; Path = $protectMtm }
        }
    }

    foreach ($item in $binaries) {
        if (Test-Path $item.Path) {
            try {
                $hashObj = Get-FileHash -Path $item.Path -Algorithm SHA256 -ErrorAction Stop
                $hashVal = $hashObj.Hash.ToUpper()

                Set-ItemProperty -Path "HKCU:\Software\TMBilling" -Name $item.Key -Value $hashVal -Force -ErrorAction SilentlyContinue
                & reg.exe add "HKCU\Software\TMBilling" /v $item.Key /t REG_SZ /d $hashVal /f >$null 2>&1

                try {
                    Set-ItemProperty -Path "HKLM:\Software\TMBilling" -Name $item.Key -Value $hashVal -Force -ErrorAction SilentlyContinue
                } catch {}
                & reg.exe add "HKLM\Software\TMBilling" /v $item.Key /t REG_SZ /d $hashVal /f >$null 2>&1
                & reg.exe add "HKLM\Software\WOW6432Node\TMBilling" /v $item.Key /t REG_SZ /d $hashVal /f >$null 2>&1
            } catch {}
        }
    }

    exit 0
} catch {
    Write-Host "Error: $_"
    exit 1
}

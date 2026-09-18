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
                $user = $matches[1].Trim()
                Set-ItemProperty -Path $regPath -Name "EmergencyUser" -Value $user -Type String -Force
            }
            if ($ini -match 'emergency_token=(.+)') {
                $token = $matches[1].Trim()
                Set-ItemProperty -Path $regPath -Name "EmergencyToken" -Value $token -Type String -Force
            }
            Write-Host "Synced to $regPath"
        } catch {
            Write-Host "Warning: Could not sync to $regPath: $_"
        }
    }
    
    exit 0
} catch {
    Write-Host "Error: $_"
    exit 1
}

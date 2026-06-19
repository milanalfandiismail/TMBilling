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
    
    # Create registry key if not exists
    $regPath = "HKLM:\Software\TMBilling"
    if (-not (Test-Path $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    
    # Sync URL (write as "Url" to match MGCTM)
    if ($ini -match 'url=(.+)') {
        $url = $matches[1].Trim()
        Set-ItemProperty -Path $regPath -Name "Url" -Value $url -Type String -Force
        Write-Host "Url synced: $url"
    }
    
    # Sync API Key (already obfuscated in config.ini)
    if ($ini -match 'apikey=(.+)') {
        $key = $matches[1].Trim()
        Set-ItemProperty -Path $regPath -Name "ApiKey" -Value $key -Type String -Force
        Write-Host "ApiKey synced"
    }
    
    # Sync Emergency User (already obfuscated in config.ini)
    if ($ini -match 'emergency_user=(.+)') {
        $user = $matches[1].Trim()
        Set-ItemProperty -Path $regPath -Name "EmergencyUser" -Value $user -Type String -Force
        Write-Host "EmergencyUser synced"
    }
    
    # Sync Emergency Token (already obfuscated in config.ini)
    if ($ini -match 'emergency_token=(.+)') {
        $token = $matches[1].Trim()
        Set-ItemProperty -Path $regPath -Name "EmergencyToken" -Value $token -Type String -Force
        Write-Host "EmergencyToken synced"
    }
    
    exit 0
} catch {
    Write-Host "Error: $_"
    exit 1
}

# TMBilling Config Writer with Obfuscation
param(
    [string]$InstallDir,
    [string]$ServerUrl,
    [string]$ApiKey,
    [string]$EmergencyUser,
    [string]$EmergencyToken
)

function Obfuscate {
    param([string]$text)
    
    $key = [byte[]][char[]]'TMBillingSecretKey2026SecureObfuscation'
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $result = ''
    
    for ($i = 0; $i -lt $bytes.Length; $i++) {
        $xored = $bytes[$i] -bxor $key[$i % $key.Length]
        $result += '{0:x2}' -f $xored
    }
    
    return $result
}

try {
    # Obfuscate credentials
    $obfUser = Obfuscate -text $EmergencyUser
    $obfToken = Obfuscate -text $EmergencyToken
    $obfApiKey = Obfuscate -text $ApiKey
    
    # STEP 1: Write to Registry (Try HKLM first, fallback to HKCU for non-admin)
    $regSuccess = $false
    try {
        $regPath = "HKLM:\Software\TMBilling"
        if (-not (Test-Path $regPath)) {
            New-Item -Path $regPath -Force | Out-Null
        }
        Set-ItemProperty -Path $regPath -Name "Url" -Value $ServerUrl -Type String -Force
        Set-ItemProperty -Path $regPath -Name "ApiKey" -Value $obfApiKey -Type String -Force
        Set-ItemProperty -Path $regPath -Name "EmergencyUser" -Value $obfUser -Type String -Force
        Set-ItemProperty -Path $regPath -Name "EmergencyToken" -Value $obfToken -Type String -Force
        $regSuccess = $true
        Write-Host "Registry (HKLM) updated successfully"
    } catch {
        # Non-admin fallback to HKCU
        try {
            $regPathUser = "HKCU:\Software\TMBilling"
            if (-not (Test-Path $regPathUser)) {
                New-Item -Path $regPathUser -Force | Out-Null
            }
            Set-ItemProperty -Path $regPathUser -Name "Url" -Value $ServerUrl -Type String -Force
            Set-ItemProperty -Path $regPathUser -Name "ApiKey" -Value $obfApiKey -Type String -Force
            Set-ItemProperty -Path $regPathUser -Name "EmergencyUser" -Value $obfUser -Type String -Force
            Set-ItemProperty -Path $regPathUser -Name "EmergencyToken" -Value $obfToken -Type String -Force
            $regSuccess = $true
            Write-Host "Registry (HKCU) updated successfully"
        } catch {
            Write-Host "Warning: Could not write to registry, relying on config.ini: $_"
        }
    }
    
    # STEP 2: Write config.ini AFTER Registry
    $configPath = Join-Path $InstallDir "config.ini"
    $content = @(
        "[TMBilling]",
        "url=$ServerUrl",
        "apikey=$obfApiKey",
        "emergency_user=$obfUser",
        "emergency_token=$obfToken"
    )
    
    [System.IO.File]::WriteAllLines($configPath, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Config.ini created successfully"
    
    exit 0
} catch {
    Write-Host "Error: $_"
    exit 1
}

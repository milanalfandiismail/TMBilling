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

function Compute-Sha256 {
    param([string]$text)
    if ([string]::IsNullOrEmpty($text)) { return '' }
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $hashBytes = $sha256.ComputeHash($bytes)
    return -join ($hashBytes | ForEach-Object { '{0:x2}' -f $_ })
}

try {
    # Obfuscate ApiKey, Hash Emergency Credentials with SHA-256
    $hashUser  = Compute-Sha256 -text $EmergencyUser
    $hashToken = Compute-Sha256 -text $EmergencyToken
    $obfApiKey = Obfuscate -text $ApiKey

    # STEP 1: Write to Registry
    # HKCU selalu ditulis (tidak butuh admin) agar agent yang berjalan
    # sebagai user biasa bisa membaca config.
    # HKLM ditulis jika admin, skip jika gagal.
    $regSuccess = $false

    # --- HKCU (selalu ditulis) ---
    try {
        $regPathUser = "HKCU:\Software\TMBilling"
        if (-not (Test-Path $regPathUser)) {
            New-Item -Path $regPathUser -Force | Out-Null
        }
        Set-ItemProperty -Path $regPathUser -Name "Url"            -Value $ServerUrl  -Type String -Force
        Set-ItemProperty -Path $regPathUser -Name "ApiKey"         -Value $obfApiKey  -Type String -Force
        Set-ItemProperty -Path $regPathUser -Name "EmergencyUser"  -Value $hashUser   -Type String -Force
        Set-ItemProperty -Path $regPathUser -Name "EmergencyToken" -Value $hashToken  -Type String -Force
        $regSuccess = $true
        Write-Host "Registry (HKCU) updated successfully"
    } catch {
        Write-Host "Warning: Could not write to HKCU registry: $_"
    }

    # --- HKLM (butuh admin, skip jika gagal) ---
    try {
        $regPath = "HKLM:\Software\TMBilling"
        if (-not (Test-Path $regPath)) {
            New-Item -Path $regPath -Force | Out-Null
        }
        Set-ItemProperty -Path $regPath -Name "Url"            -Value $ServerUrl  -Type String -Force
        Set-ItemProperty -Path $regPath -Name "ApiKey"         -Value $obfApiKey  -Type String -Force
        Set-ItemProperty -Path $regPath -Name "EmergencyUser"  -Value $hashUser   -Type String -Force
        Set-ItemProperty -Path $regPath -Name "EmergencyToken" -Value $hashToken  -Type String -Force
        Write-Host "Registry (HKLM) updated successfully"
    } catch {
        Write-Host "Info: HKLM skipped (non-admin or access denied) - HKCU is sufficient"
    }

    # STEP 2: Write config.ini
    # Pastikan folder InstallDir ada sebelum menulis file
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    $configPath = Join-Path $InstallDir "config.ini"
    $content = @(
        "[TMBilling]",
        "url=$ServerUrl",
        "apikey=$obfApiKey",
        "emergency_user=$hashUser",
        "emergency_token=$hashToken"
    )

    [System.IO.File]::WriteAllLines($configPath, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Config.ini created successfully"

    exit 0
} catch {
    Write-Host "Error: $_"
    exit 1
}

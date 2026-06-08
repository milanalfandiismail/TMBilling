# TMBilling Admin Credentials Deobfuscator
param(
    [string]$InstallDir
)

function Deobfuscate {
    param([string]$hex)
    
    # Check if input is valid hex
    if ([string]::IsNullOrWhiteSpace($hex) -or $hex.Length % 2 -ne 0) {
        return $hex
    }
    
    if ($hex -notmatch '^[0-9a-fA-F]+$') {
        return $hex
    }
    
    $key = [byte[]][char[]]'TMBillingSecretKey2026SecureObfuscation'
    $bytes = @()
    
    for ($i = 0; $i -lt $hex.Length; $i += 2) {
        $bytes += [Convert]::ToByte($hex.Substring($i, 2), 16)
    }
    
    $result = ''
    for ($i = 0; $i -lt $bytes.Length; $i++) {
        $result += [char]($bytes[$i] -bxor $key[$i % $key.Length])
    }
    
    return $result
}

try {
    $configPath = Join-Path $InstallDir "config.ini"
    
    if (-not (Test-Path $configPath)) {
        Write-Host "Config.ini not found"
        exit 1
    }
    
    $ini = Get-Content $configPath -Raw
    
    # Default values
    $user = 'TMBilling'
    $pass = 'TM123qaz!@#'
    
    # Extract and deobfuscate
    if ($ini -match 'emergency_user=(.+)') {
        $user = Deobfuscate -hex $matches[1].Trim()
    }
    
    if ($ini -match 'emergency_token=(.+)') {
        $pass = Deobfuscate -hex $matches[1].Trim()
    }
    
    # Create admin credentials file
    $credPath = Join-Path $InstallDir "admin_credentials.txt"
    $content = @"
====================================================
KREDENSIAL ADMIN DARURAT TMBILLING (OFFLINE LOGIN)
====================================================
Username : $user
Password : $pass

[!] PERINGATAN KEAMANAN:
Kredensial ini disimpan TERENKRIPSI di config.ini dan Registry.
File ini menampilkan versi PLAIN TEXT untuk catatan Anda.
WAJIB HAPUS file ini setelah Anda mencatat kredensial!
====================================================
"@
    
    [System.IO.File]::WriteAllText($credPath, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Admin credentials file created"
    
    exit 0
} catch {
    Write-Host "Error: $_"
    exit 1
}

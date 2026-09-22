# TMBilling Admin Credentials File Generator
# Menerima kredensial plain-text dari install.bat untuk ditampilkan ke admin.
# Emergency user/token di config.ini adalah SHA256 hash (one-way), tidak bisa di-decode.
param(
    [string]$InstallDir,
    [string]$PlainUser = '',
    [string]$PlainPass = ''
)

try {
    $configPath = Join-Path $InstallDir "config.ini"

    if (-not (Test-Path $configPath)) {
        Write-Host "Config.ini not found"
        exit 1
    }

    # Gunakan nilai default jika tidak ada parameter plain text
    if ([string]::IsNullOrEmpty($PlainUser)) {
        $PlainUser = 'TMBilling'
    }
    if ([string]::IsNullOrEmpty($PlainPass)) {
        $PlainPass = 'TM123qaz!@#'
    }

    # Baca URL server dari config.ini untuk info tambahan
    $serverUrl = ''
    $ini = Get-Content $configPath -Raw
    if ($ini -match 'url=(.+)') {
        $serverUrl = $matches[1].Trim()
    }

    # Tulis file kredensial dalam plain text yang bisa dibaca admin
    $credPath = Join-Path $InstallDir "admin_credentials.txt"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $content = @"
====================================================
KREDENSIAL ADMIN DARURAT TMBILLING (OFFLINE LOGIN)
====================================================
Dibuat    : $timestamp
Server    : $serverUrl

Username  : $PlainUser
Password  : $PlainPass

[!] PERINGATAN KEAMANAN:
Kredensial ini disimpan sebagai SHA-256 hash di config.ini
dan Registry - tidak bisa dibaca balik dari sana.
File ini adalah SATU-SATUNYA catatan plain text.
WAJIB HAPUS atau SIMPAN AMAN file ini setelah Anda mencatat kredensial!
====================================================
"@

    [System.IO.File]::WriteAllText($credPath, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Admin credentials file created at: $credPath"

    exit 0
} catch {
    Write-Host "Error: $_"
    exit 1
}

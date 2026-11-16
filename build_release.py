# -*- coding: utf-8 -*-
import os
import re
import shutil
import subprocess
import sys
import zipfile

REQUIRED = (
    'run.py',
    'requirements.txt',
    'install.bat',
    'update.bat',
    'start.bat',
    'stop.bat',
    '.env.example',
    'app/config.py',
    'app/static/css/tailwind.css',
    'app/services/server_monitor/TMLHMService.exe',
    'install_scripts/updater.bat',
    'install_scripts/verify_versions.py',
    'install_scripts/flush_uptime.py',
    'migrations',
)


def get_version():
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app', 'config.py')
    with open(config_path, 'r', encoding='utf-8') as f:
        content = f.read()
    match = re.search(r'VERSION\s*=\s*[\'\"]([^\'\"]+)[\'\"]', content)
    if match:
        return match.group(1)
    return 'unknown'


def missing_required(project_dir):
    return [nama for nama in REQUIRED if not os.path.exists(os.path.join(project_dir, nama))]


def stale_css(project_dir):
    css = os.path.join(project_dir, 'app', 'static', 'css', 'tailwind.css')
    if not os.path.exists(css):
        return True
    batas = os.path.getmtime(css)
    sumber = (
        os.path.join(project_dir, 'app', 'static', 'css', 'input.css'),
        os.path.join(project_dir, 'tailwind.config.js'),
    )
    return any(os.path.exists(s) and os.path.getmtime(s) > batas for s in sumber)

def compile_csharp(project_dir):
    """Kompilasi TMLHMService bila compiler tersedia; pakai EXE lama bila tidak."""
    service_dir = os.path.join(project_dir, 'app', 'services', 'server_monitor')
    exe = os.path.join(service_dir, 'TMLHMService.exe')
    csc_path = None
    for kandidat in (
        r'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe',
        r'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe',
        shutil.which('csc'),
    ):
        if kandidat and os.path.exists(kandidat):
            csc_path = kandidat
            break

    if not csc_path:
        if os.path.exists(exe):
            print('[INFO] csc.exe tidak ditemukan; memakai TMLHMService.exe yang sudah ada.')
            return True
        print('[ERROR] csc.exe tidak ditemukan dan TMLHMService.exe belum ada.')
        print('[ERROR] Jalankan build_and_deploy.bat di mesin dengan .NET Framework.')
        return False

    print('Mengkompilasi TMLHMService (C# Microservice)...')
    cmd = [
        csc_path,
        '/target:winexe',
        '/out:TMLHMService.exe',
        '/reference:LibreHardwareMonitorLib.dll',
        '/reference:System.Management.dll',
        'TMLHMService.cs',
    ]
    result = subprocess.run(cmd, cwd=service_dir, capture_output=True, text=True)
    if result.returncode != 0:
        print('[ERROR] Kompilasi TMLHMService gagal.')
        print(result.stdout)
        print(result.stderr)
        return False
    print('[OK] Kompilasi TMLHMService berhasil.')
    return True



def get_rust_version(project_dir):
    cargo = os.path.join(project_dir, 'app-rust', 'Cargo.toml')
    if not os.path.exists(cargo):
        return None
    with open(cargo, 'r', encoding='utf-8') as f:
        match = re.search(r'^version\s*=\s*["\']([^"\']+)["\']', f.read(), re.MULTILINE)
    return match.group(1) if match else None


def build_rust_server(project_dir):
    """Paket biner Rust: exe + installer + helper LHM + SHA256SUMS."""
    exe = os.path.join(project_dir, 'app-rust', 'target', 'release', 'tmbilling-server.exe')
    version = get_rust_version(project_dir)
    if not os.path.exists(exe) or not version:
        print('[SKIP] Biner Rust belum dibangun (cargo build --release di app-rust).')
        return 0

    paket = os.path.join(project_dir, f"TMBilling_Server_v{version}.zip")
    if os.path.exists(paket):
        os.remove(paket)

    isi = [(exe, 'tmbilling-server.exe')]
    for nama, tujuan in (
        ('app-rust/packaging/install.bat', 'install.bat'),
        ('app-rust/packaging/update.bat', 'update.bat'),
        ('app/services/server_monitor/TMLHMService.exe', 'TMLHMService.exe'),
        ('app/services/server_monitor/LibreHardwareMonitorLib.dll', 'LibreHardwareMonitorLib.dll'),
        ('app/services/server_monitor/TMLHMService.sys', 'TMLHMService.sys'),
        ('.env.example', '.env.example'),
    ):
        jalur = os.path.join(project_dir, nama)
        if os.path.exists(jalur):
            isi.append((jalur, tujuan))

    import hashlib
    baris_hash = []
    with zipfile.ZipFile(paket, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for jalur, tujuan in isi:
            zipf.write(jalur, tujuan)
            with open(jalur, 'rb') as f:
                baris_hash.append(f"{hashlib.sha256(f.read()).hexdigest()}  {tujuan}")
            print(f"[OK] Rust: {tujuan}")
        zipf.writestr('SHA256SUMS.txt', "\n".join(baris_hash) + "\n")
    print(f"[OK] Paket Rust dibuat: {os.path.basename(paket)}")
    return 0


def main():
    project_dir = os.path.dirname(os.path.abspath(__file__))

    if not compile_csharp(project_dir):
        return 1

    status_rust = build_rust_server(project_dir)
    if status_rust:
        return status_rust

    hilang = missing_required(project_dir)
    if hilang:
        print('[ERROR] Berkas wajib tidak ditemukan: ' + ', '.join(hilang))
        return 1

    if stale_css(project_dir):
        print('[ERROR] app/static/css/tailwind.css lebih lama dari sumbernya.')
        print('[ERROR] Jalankan: npm run build:css')
        return 2

    version = get_version()
    zip_filename = f"TMBilling_Server_v{version}.zip"
    zip_filepath = os.path.join(project_dir, zip_filename)
    
    # Files and folders to include
    include_files = [
        "run.py",
        "requirements.txt",
        "install.bat",
        "update.bat",
        "start.bat",
        "stop.bat",
        ".env.example",
        "README.md",
        "PANDUAN_TIGHTVNC.md"
    ]
    include_dirs = [
        "app",
        "install_scripts",
        "migrations"
    ]
    
    print(f"Memulai pemaketan {zip_filename}...")
    
    # Delete old zip if exists
    if os.path.exists(zip_filepath):
        os.remove(zip_filepath)
        print("Menghapus file zip lama.")

    count_files = 0
    with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Write individual files
        for filename in include_files:
            filepath = os.path.join(project_dir, filename)
            if os.path.exists(filepath):
                zipf.write(filepath, filename)
                print(f"[OK] Menambahkan berkas: {filename}")
                count_files += 1
            else:
                print(f"[WARNING] Berkas tidak ditemukan: {filename}")
                
        # Write directories recursively
        for dirname in include_dirs:
            dirpath = os.path.join(project_dir, dirname)
            if os.path.exists(dirpath):
                print(f"Memproses folder: {dirname}/")
                for root, dirs, files in os.walk(dirpath):
                    # Exclude __pycache__ from search
                    if "__pycache__" in dirs:
                        dirs.remove("__pycache__")
                    # Screenshot runtime tidak boleh ikut paket rilis publik
                    if os.path.abspath(root) == os.path.abspath(os.path.join(project_dir, "app", "static", "uploads", "screenshots")):
                        dirs[:] = []
                        continue
                        
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Get relative path for the zip structure
                        rel_path = os.path.relpath(file_path, project_dir)
                        zipf.write(file_path, rel_path)
                        count_files += 1
            else:
                print(f"[WARNING] Folder tidak ditemukan: {dirname}")
                
    print(f"\nSukses! Berhasil mengemas {count_files} berkas ke dalam {zip_filename}")
    print(f"Lokasi berkas: {zip_filepath}")

    return 0

if __name__ == "__main__":
    sys.exit(main())
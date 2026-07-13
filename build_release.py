# -*- coding: utf-8 -*-
import os
import zipfile
import re
import subprocess
import re

def get_version():
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app', 'config.py')
    with open(config_path, 'r', encoding='utf-8') as f:
        content = f.read()
    match = re.search(r'VERSION\s*=\s*[\'"]([^\'"]+)[\'"]', content)
    if match:
        return match.group(1)
    return "unknown"

def compile_csharp_monitor():
    print("Mengkompilasi TMLHMService (C# Microservice)...")
    project_dir = os.path.dirname(os.path.abspath(__file__))
    service_dir = os.path.join(project_dir, 'app', 'services', 'server_monitor')
    
    csc_path = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    if not os.path.exists(csc_path):
        print(f"[ERROR] Compiler C# tidak ditemukan di {csc_path}")
        return False
        
    cmd = [
        csc_path,
        "/target:winexe",
        "/out:TMLHMService.exe",
        "/reference:LibreHardwareMonitorLib.dll",
        "/reference:System.Management.dll",
        "TMLHMService.cs"
    ]
    
    try:
        result = subprocess.run(cmd, cwd=service_dir, capture_output=True, text=True)
        if result.returncode != 0:
            print("[ERROR] Kompilasi gagal!")
            print(result.stdout)
            print(result.stderr)
            return False
        print("[OK] Kompilasi TMLHMService berhasil.")
        return True
    except Exception as e:
        print(f"[ERROR] Terjadi kesalahan saat kompilasi: {e}")
        return False

def main():
    if not compile_csharp_monitor():
        print("Membatalkan rilis karena kompilasi C# gagal.")
        return

    project_dir = os.path.dirname(os.path.abspath(__file__))
    version = get_version()
    zip_filename = f"TMBilling_Server_v{version}.zip"
    zip_filepath = os.path.join(project_dir, zip_filename)
    
    # Files and folders to include
    include_files = [
        "run.py",
        "requirements.txt",
        "install.bat",
        "start.bat",
        "stop.bat",
        ".env.example",
        "README.md"
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

if __name__ == "__main__":
    main()

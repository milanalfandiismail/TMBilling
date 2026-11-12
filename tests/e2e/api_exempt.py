"""Rute yang tidak bisa dipanggil dari sandbox beserta alasannya.

Aturan: hanya proses eksternal nyata, jaringan keluar, atau hal yang tidak
deterministik. Menambah entri demi menghijaukan gate = kegagalan review.
"""

EXEMPT = {
    "static": "penyajian berkas statis Flask, bukan fungsi bisnis",
    "index": "shell HTML dashboard, dipakai browser bukan dipanggil via API",
    "pc.wol_pc": "mengirim magic packet ke NIC nyata",
    "vnc.start_vnc_proxy": "meluncurkan proses websockify nyata",
    "migration.check_github_update": "memanggil GitHub API (jaringan keluar)",
    "migration.update_github": "mengunduh rilis GitHub lalu menjalankan updater.bat nyata",
    "server_monitor_api.start_lhm_service": "meluncurkan LibreHardwareMonitor nyata",
    "server_monitor_api.stop_lhm_service": "menghentikan LibreHardwareMonitor nyata",
}

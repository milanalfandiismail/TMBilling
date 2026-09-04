"""Script Runner untuk Server Cabang ke-2 (Pengujian Lokal).

Menjalankan instance TMBilling kedua pada port 7016 dengan database SQLite terpisah (warnet_cabang2.db).
Sangat berguna untuk menguji fitur Multi-Cabang di satu komputer.

Cara pakai:
    Terminal 1 (Server Utama): python run.py
    Terminal 2 (Cabang ke-2) : python run_branch2.py
"""

import os
import sys

# Konfigurasi port & database terpisah untuk Cabang 2
os.environ["PORT"] = "7016"
os.environ["DATABASE_URL"] = "sqlite:///warnet_cabang2.db"
os.environ["DEBUG_MODE"] = "True"

from run import app

if __name__ == "__main__":
    print("=" * 65)
    print(" [LOCAL TEST] Menjalankan Server Cabang ke-2 TMBilling")
    print(" - Port        : 7016 (http://127.0.0.1:7016)")
    print(" - Database    : warnet_cabang2.db")
    print("=" * 65)

    app.run(debug=True, host="0.0.0.0", port=7016)

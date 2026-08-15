# Rencana Implementasi: Standarisasi Pembersihan & Pemeriksaan Seluruh Audit Log

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun mekanisme pembersihan audit log yang aman, terstandarisasi, dan terstruktur dengan fitur auto-archiving, validasi konsistensi format seluruh 12 domain log di sistem (mulai dari Sesi, POS, Blackout, Security, Master Data, Maintenance, hingga Settings & Scheduler), serta pencatatan audit log `CLEAR_LOG` dengan payload `detail_json` yang seragam.

**Architecture:** Memperbarui `logger.py` dan `log_audit_service.py` agar proses `clear_logs()` melakukan backup arsip file log (`logs/archives/warnet_YYYYMMDD_HHMMSS.jsonl.gz`), menstandarisasi baris log lama yang belum berformat JSON, mencatat metadata event `CLEAR_LOG` ke `detail_json`, memperkaya `LogFormatter.resolveTheme` di frontend kasir untuk seluruh kategori log, serta menyediakan CLI seed tool komprehensif (`tools/seed_audit_logs.py`).

**Tech Stack:** Python 3, Flask, SQLAlchemy, Gzip, JSON Lines, Vanilla JavaScript, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-15-audit-log-clearing-design.md`

## Global Constraints

- Seluruh tindakan eksekusi, pembuatan file, penulisan kode, dan verifikasi WAJIB menggunakan modul dan skill plugin Superpowers.
- File log utama adalah `logs/warnet.log`.
- Format log standar harus selalu berupa JSON Lines (`{"timestamp": ..., "user": ..., "action": ..., "detail": ..., "detail_json": ...}`).
- Setiap operasi penghapusan/pembersihan log harus menyimpan arsip (kecuali jika dikonfigurasi secara eksplisit tanpa arsip) dan mencatat event audit `CLEAR_LOG` dengan payload `detail_json` terstruktur.
- Mendukung seluruh 12 kategori domain log yang teridentifikasi dalam audit codebase.

---

### Task 1: Utility Normalisasi & Auto-Archiving pada `logger.py`

**Files:**
- Modify: `app/utils/logger.py`
- Create: `tests/test_logger_archiving.py`

**Interfaces:**
- Consumes: File `logs/warnet.log`, `os`, `json`, `gzip`, `datetime`
- Produces: 
  - `normalize_legacy_log_line(line: str) -> dict`
  - `archive_logs(archive_dir: str = "logs/archives") -> dict`
  - `clear_logs(archive: bool = True) -> dict`

- [ ] **Step 1: Tulis unit test untuk normalisasi log legacy dan fungsi auto-archiving**

```python
# tests/test_logger_archiving.py
import os
import json
import gzip
import pytest
from app.utils.logger import (
    LOG_FILE,
    normalize_legacy_log_line,
    archive_logs,
    clear_logs,
    write_log,
)

def test_normalize_legacy_log_line():
    legacy_line = "[2026-08-15 10:00:00] [kasir_1] BUKA_MEMBER - PC-01"
    normalized = normalize_legacy_log_line(legacy_line)
    assert normalized["timestamp"] == "2026-08-15 10:00:00"
    assert normalized["user"] == "kasir_1"
    assert normalized["action"] == "BUKA_MEMBER"
    assert normalized["detail"] == "PC-01"

def test_normalize_json_log_line():
    json_line = json.dumps({
        "timestamp": "2026-08-15 11:00:00",
        "user": "admin",
        "action": "TAMBAH_MEMBER",
        "detail": "Member test",
        "detail_json": {"username": "test"}
    })
    normalized = normalize_legacy_log_line(json_line)
    assert normalized["user"] == "admin"
    assert normalized["detail_json"] == {"username": "test"}

def test_clear_logs_with_archive():
    # Tulis dummy log
    write_log("TEST_ACTION", "Testing log line", user="tester")
    assert os.path.exists(LOG_FILE)
    
    result = clear_logs(archive=True)
    assert result["success"] is True
    assert result["total_lines"] >= 1
    assert result["archive_path"] is not None
    assert os.path.exists(result["archive_path"])
    
    # Pastikan file utama kosong
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    assert content == ""
```

- [ ] **Step 2: Jalankan test untuk memverifikasi kegagalan awal (TDD)**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_logger_archiving.py -v`
Expected: FAIL (karena `normalize_legacy_log_line` dan `archive_logs` belum diimplementasikan).

- [ ] **Step 3: Implementasikan fungsi normalisasi, arsip gzip, dan pembersihan log di `logger.py`**

```python
# app/utils/logger.py
import os
import re
import json
import gzip
from datetime import datetime
from flask import has_request_context, request

LOG_DIR = "logs"
LOG_ARCHIVE_DIR = os.path.join(LOG_DIR, "archives")
LOG_FILE = os.path.join(LOG_DIR, "warnet.log")

os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(LOG_ARCHIVE_DIR, exist_ok=True)

LEGACY_LOG_PATTERN = re.compile(r"^\[(.*?)\] \[(.*?)\] (.*?) - (.*)$")

def normalize_legacy_log_line(line: str) -> dict:
    """Mengubah format log legacy teks atau JSON ke dictionary standar."""
    line_str = line.strip()
    if not line_str:
        return {}
    if line_str.startswith("{") and line_str.endswith("}"):
        try:
            return json.loads(line_str)
        except Exception:
            pass
    
    match = LEGACY_LOG_PATTERN.match(line_str)
    if match:
        ts, user, action, detail = match.groups()
        return {
            "timestamp": ts,
            "user": user,
            "action": action,
            "detail": detail,
            "ip_address": "-",
            "browser_agent": "-",
            "detail_json": None
        }
    
    return {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "user": "system",
        "action": "RAW_LOG",
        "detail": line_str,
        "ip_address": "-",
        "browser_agent": "-",
        "detail_json": None
    }

def archive_logs(archive_dir: str = LOG_ARCHIVE_DIR) -> dict:
    """Mengompresi dan mengarsipkan file log saat ini ke format .jsonl.gz."""
    if not os.path.exists(LOG_FILE) or os.path.getsize(LOG_FILE) == 0:
        return {"archived": False, "archive_path": None, "total_lines": 0}

    os.makedirs(archive_dir, exist_ok=True)
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_filename = f"warnet_{timestamp_str}.jsonl.gz"
    archive_path = os.path.join(archive_dir, archive_filename)

    lines_count = 0
    with open(LOG_FILE, "r", encoding="utf-8") as f_in:
        with gzip.open(archive_path, "wt", encoding="utf-8") as f_out:
            for line in f_in:
                normalized = normalize_legacy_log_line(line)
                if normalized:
                    f_out.write(json.dumps(normalized) + "\n")
                    lines_count += 1

    return {
        "archived": True,
        "archive_path": archive_path,
        "archive_filename": archive_filename,
        "total_lines": lines_count
    }

def clear_logs(archive: bool = True) -> dict:
    """Mengosongkan isi file log dengan opsi auto-archive."""
    archive_info = {"archived": False, "archive_path": None, "total_lines": 0}
    if archive and os.path.exists(LOG_FILE):
        archive_info = archive_logs()

    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            f.write("")
        return {
            "success": True,
            "total_lines": archive_info.get("total_lines", 0),
            "archive_path": archive_info.get("archive_path")
        }
    return {"success": False, "total_lines": 0, "archive_path": None}
```

- [ ] **Step 4: Jalankan kembali unit test untuk memverifikasi kelulusan**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_logger_archiving.py -v`
Expected: PASS (Semua assertion berhasil tanpa error).

- [ ] **Step 5: Commit perubahan Task 1**

```bash
git add app/utils/logger.py tests/test_logger_archiving.py
git commit -m "feat(logger): add log normalization, gzip archiving, and structured log clearing"
```

---

### Task 2: Refactor `LogAuditService` & Standardisasi Payload `CLEAR_LOG`

**Files:**
- Modify: `app/services/report/log_audit_service.py`
- Modify: `app/routes/report/report_routes.py`
- Create: `tests/test_log_audit_service.py`

**Interfaces:**
- Consumes: `app.utils.logger.clear_logs`, `app.utils.logger.write_log`, `app.utils.logger.read_logs`
- Produces: 
  - `LogAuditService.clear_system_logs(operator: str = "system", archive: bool = True) -> dict`

- [ ] **Step 1: Tulis unit test untuk `clear_system_logs` dan structured `CLEAR_LOG` payload**

```python
# tests/test_log_audit_service.py
import pytest
from app import create_app
from app.services.report.log_audit_service import LogAuditService
from app.utils.logger import write_log, read_logs

@pytest.fixture
def app_context():
    app = create_app()
    with app.app_context():
        yield app

def test_clear_system_logs_records_audit_event(app_context):
    write_log("DUMMY_EVENT", "Dummy detail", user="tester")
    
    result = LogAuditService.clear_system_logs(operator="admin_tester", archive=True)
    assert result["success"] is True
    assert "total_dibersihkan" in result
    
    # Cek bahwa baris pertama setelah clear adalah CLEAR_LOG terstruktur
    logs_data = LogAuditService.get_system_logs(limit=10)
    assert len(logs_data["logs"]) >= 1
    last_log = logs_data["logs"][0]
    assert last_log["action"] == "CLEAR_LOG"
    assert last_log["user"] == "admin_tester"
    assert last_log["detail_json"] is not None
    assert "total_dibersihkan" in last_log["detail_json"]
```

- [ ] **Step 2: Jalankan test untuk memverifikasi kegagalan**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_log_audit_service.py -v`
Expected: FAIL

- [ ] **Step 3: Update `log_audit_service.py` dan `report_routes.py`**

```python
# Di app/services/report/log_audit_service.py
    @staticmethod
    def clear_system_logs(operator="system", archive=True):
        """Bersihkan file log dengan auto-archive dan pencatatan log audit terstruktur."""
        res = clear_logs(archive=archive)
        if res.get("success"):
            detail_clear = {
                "total_dibersihkan": res.get("total_lines", 0),
                "diarsipkan": bool(res.get("archive_path")),
                "lokasi_arsip": res.get("archive_path") or "-",
                "dieksekusi_oleh": operator
            }
            write_log(
                "CLEAR_LOG",
                f"Log sistem dibersihkan ({res.get('total_lines', 0)} baris diarsipkan)",
                user=operator,
                detail_json=detail_clear
            )
            return {
                "success": True,
                "total_dibersihkan": res.get("total_lines", 0),
                "archive_path": res.get("archive_path")
            }
        return {"success": False, "total_dibersihkan": 0, "archive_path": None}
```

- [ ] **Step 4: Update endpoint `/api/v1/kasir/report/log/clear` di `report_routes.py`**

```python
# Di app/routes/report/report_routes.py
@report_api_bp.route("/log/clear", methods=["POST"])
@login_required
@admin_required
def clear_logs_endpoint():
    """Bersihkan file log sistem dengan auto-archive."""
    try:
        kasir = session.get("kasir_username", "kasir")
        data = request.get_json() or {}
        archive = data.get("archive", True)
        
        result = ReportService.clear_system_logs(operator=kasir, archive=archive)
        if result.get("success"):
            return jsonify({
                "success": True,
                "message": f"Log berhasil dibersihkan ({result.get('total_dibersihkan', 0)} baris)",
                "data": result
            }), 200
        return jsonify({"error": "Gagal membersihkan log"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

- [ ] **Step 5: Jalankan test kembali**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_log_audit_service.py -v`
Expected: PASS

- [ ] **Step 6: Commit perubahan Task 2**

```bash
git add app/services/report/log_audit_service.py app/routes/report/report_routes.py tests/test_log_audit_service.py
git commit -m "feat(report): standardize clear_system_logs audit trail and route response"
```

---

### Task 3: Pemetaan Seluruh 12 Domain Log & Modal Konfirmasi di Frontend Kasir (`log/index.js`)

**Files:**
- Modify: `app/static/js/kasir/modules/log/index.js`
- Modify: `app/static/js/kasir/core/api.js`

**Interfaces:**
- Consumes: `API.report.clearLogs(archive)`
- Produces: Pemetaan 12 domain badge tema visual lengkap & Modal konfirmasi UI dengan opsi checkbox backup arsip.

- [ ] **Step 1: Update API client di `app/static/js/kasir/core/api.js`**

```javascript
// Di app/static/js/kasir/core/api.js
clearLogs: (archive = true) => API.request('/api/v1/kasir/report/log/clear', {
    method: 'POST',
    body: JSON.stringify({ archive })
}),
```

- [ ] **Step 2: Lengkapi `resolveTheme(action)` untuk seluruh 12 domain event log di `app/static/js/kasir/modules/log/index.js`**

```javascript
// Di LogFormatter.resolveTheme:
resolveTheme(action) {
    const act = (action || '').toUpperCase();
    
    // 1. Refund
    if (act.includes('REFUND')) 
        return { icon: '🔄', title: 'Detail Refund', border: 'border-red-500/20', text: 'text-red-400' };
    
    // 2. Blackout / Mati Lampu
    if (act.includes('BLACKOUT')) 
        return { icon: '⚡', title: 'Insiden Blackout (Mati Lampu)', border: 'border-amber-500/30', text: 'text-amber-400' };

    // 3. Sesi & Billing
    if (act.startsWith('BUKA_') || act.includes('TUTUP_SESI') || act === 'PINDAH_PC' || act === 'TAMBAH_WAKTU') 
        return { icon: '🎮', title: 'Detail Sesi & Billing', border: 'border-emerald-500/20', text: 'text-emerald-400' };
    
    // 4. Kantin & POS F&B
    if (act === 'TRANSAKSI_MENU' || act.includes('MENU')) 
        return { icon: '🍔', title: 'Detail Kantin & POS', border: 'border-amber-500/20', text: 'text-amber-400' };
    
    // 5. Member
    if (act.includes('MEMBER')) 
        return { icon: '👤', title: 'Detail Member', border: 'border-purple-500/20', text: 'text-purple-400' };
    
    // 6. Shift Kasir
    if (act.startsWith('SHIFT_')) 
        return { icon: '💵', title: 'Detail Shift Kasir', border: 'border-cyan-500/20', text: 'text-cyan-400' };
    
    // 7. Paket Billing
    if (act.includes('PAKET')) 
        return { icon: '💳', title: 'Detail Paket Billing', border: 'border-blue-500/20', text: 'text-blue-400' };
    
    // 8. Unit PC / Zona
    if (act.includes('PC') || act.includes('GRUP') || act.includes('BATCH_') || act.includes('WOL_')) 
        return { icon: '🖥️', title: 'Detail Unit PC / Zona', border: 'border-indigo-500/20', text: 'text-indigo-400' };
    
    // 9. Akun & Keamanan (Auth, Whitelist)
    if (act.includes('USER') || act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('IP_WHITELIST')) 
        return { icon: '🔑', title: 'Detail Akun & Keamanan', border: 'border-neutral-500/20', text: 'text-neutral-300' };
    
    // 10. Perawatan & Tiket PC
    if (act.includes('TIKET') || act.includes('MAINTENANCE')) 
        return { icon: '🛠️', title: 'Detail Perawatan PC', border: 'border-orange-500/20', text: 'text-orange-400' };
    
    // 11. Pembersihan Log, Hapus Struk & Riwayat
    if (act.includes('CLEAR_') || act.includes('DELETE_STRUK') || act.includes('CLEANUP')) 
        return { icon: '🧹', title: 'Pembersihan Log & Riwayat', border: 'border-rose-500/20', text: 'text-rose-400' };

    // 12. Sistem, Backup, Scheduler & Settings
    if (act.includes('SETTINGS') || act.includes('BACKUP') || act.includes('MIGRATION') || act.includes('SCHEDULER') || act.includes('DB_') || act.includes('UPDATE')) 
        return { icon: '⚙️', title: 'Sistem & Konfigurasi', border: 'border-sky-500/20', text: 'text-sky-400' };
    
    return { icon: '📄', title: 'Detail Data', border: 'border-[#1c1c1c]', text: 'text-neutral-400' };
}
```

- [ ] **Step 3: Update `Log.clear()` modal konfirmasi**

```javascript
// Di Log.clear():
async clear() {
    const modalHtml = `
        <div class="text-left space-y-3">
            <div class="text-center">
                <p class="text-xs lg:text-base text-neutral-200 font-bold uppercase tracking-wider">Bersihkan Semua Audit Log?</p>
                <p class="text-[11px] lg:text-xs text-neutral-400 mt-1">Tindakan ini akan mengosongkan riwayat log aktif di dashboard.</p>
            </div>
            <div class="p-3 bg-[#0c0c0c] border border-[#1c1c1c] rounded text-xs space-y-2">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="chk-auto-archive" checked class="rounded border-neutral-700 bg-neutral-900 text-blue-500 focus:ring-0">
                    <span class="text-neutral-300 font-medium">Buat file arsip otomatis (.jsonl.gz)</span>
                </label>
                <p class="text-[10px] text-neutral-500 pl-5">File arsip disimpan di folder <code class="text-neutral-400">logs/archives/</code> untuk audit trail masa depan.</p>
            </div>
        </div>`;

    Modal.confirm(modalHtml, async () => {
        const archive = document.getElementById('chk-auto-archive') ? document.getElementById('chk-auto-archive').checked : true;
        try {
            const res = await API.report.clearLogs(archive);
            Toast.success(res.message || 'Log berhasil dibersihkan');
            this.load();
        } catch (err) {
            Toast.error(err.message || 'Gagal membersihkan log');
        }
    });
}
```

- [ ] **Step 4: Commit perubahan Task 3**

```bash
git add app/static/js/kasir/core/api.js app/static/js/kasir/modules/log/index.js
git commit -m "feat(ui): add 12 domain theme resolvers and archive modal to LogFormatter"
```

---

### Task 4: Pembuatan CLI Tool Seed Log Audit Komprehensif Seluruh 12 Kategori (`tools/seed_audit_logs.py`)

**Files:**
- Create: `tools/seed_audit_logs.py`

**Interfaces:**
- Consumes: `app.create_app`, `app.utils.logger.write_log`, `app.utils.logger.LOG_FILE`
- Produces: CLI script yang menyuntikkan seluruh 12 variasi kategori log ke `logs/warnet.log`.

- [ ] **Step 1: Tulis script `tools/seed_audit_logs.py`**

```python
# tools/seed_audit_logs.py
"""Tool untuk menyuntikkan sampel log audit lengkap mencakup seluruh 12 domain sistem."""
import os
import json
from datetime import datetime, timedelta
from app import create_app
from app.utils.logger import write_log, LOG_FILE

def seed_logs(include_legacy=True):
    app = create_app()
    with app.app_context():
        operator = "admin"
        print("🌱 Menyuntikkan sampel log lengkap (12 domain) ke warnet.log...")

        # 1. Format Legacy & Corrupted / Raw
        if include_legacy:
            now_str = (datetime.now() - timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{now_str}] [kasir_pagi] BUKA_GUEST - Guest PC-03 (60 menit)\n")
                f.write(f"[{now_str}] [system] SYSTEM_BOOT - Server TMBilling started\n")
                f.write("BARIS_LOG_RAW_TANPA_FORMAT_UNTUK_UJI_FALLBACK\n")

        # 2. Sesi & Billing (🎮)
        write_log("BUKA_GUEST", "PC:PC-02 | Guest:Budi | 60m", user=operator, detail_json={
            "nama_guest": "Budi", "pc": "PC-02", "durasi_menit": 60, "harga": 6000
        })
        write_log("BUKA_MEMBER", "Member Buka PC-01", user=operator, detail_json={
            "username": "member_vip", "pc": "PC-01", "waktu_main": 120, "harga": 10000
        })
        write_log("TAMBAH_WAKTU", "Member:member_vip | +60m", user=operator, detail_json={
            "username": "member_vip", "paket": "Paket 1 Jam", "durasi_tambah": 60, "harga": 5000
        })
        write_log("PINDAH_PC", "PC-01 -> PC-04 | Sisa:90m", user=operator, detail_json={
            "pc_asal": "PC-01", "pc_tujuan": "PC-04", "sisa_menit": 90
        })
        write_log("TUTUP_SESI", "PC-04 Ditutup", user=operator, detail_json={
            "username": "member_vip", "pc": "PC-04", "durasi_terpakai": 90, "sisa_waktu": 0
        })

        # 3. Insiden Blackout / Mati Lampu (⚡)
        write_log("BLACKOUT_DETECT", "#12 | Dash: 45m | Audit: 45m", user="system", detail_json={
            "sesi_id": 12, "pc_kode": "PC-02", "sisa_menit": 45, "status": "SUSPECT"
        })
        write_log("BLACKOUT_RESOLVE_MEMBER", "Member:member_vip | Saldo: 45m", user=operator, detail_json={
            "username": "member_vip", "saldo_dikembalikan": 45, "resolusi": "REFUND_SALDO"
        })
        write_log("BLACKOUT_RESOLVE_GUEST_LANJUT", "Guest_Budi ke PC:PC-03", user=operator, detail_json={
            "nama_guest": "Guest_Budi", "pc_baru": "PC-03", "sisa_waktu": 45
        })

        # 4. Kantin & POS F&B (🍔)
        write_log("TRANSAKSI_MENU", "Penjualan Indomie Telur x2 (Total: Rp14,000) sukses via TMM-20260815-001", user=operator, detail_json={
            "no_nota": "TMM-20260815-001", "nama_menu": "Indomie Telur", "jumlah_qty": 2, "total_harga": 14000, "metode_pembayaran": "Tunai", "tunai": 15000, "kembalian": 1000
        })
        write_log("TAMBAH_MENU", "Menu 'Kopi Susu' berhasil ditambahkan ke katalog", user=operator, detail_json={
            "nama": "Kopi Susu", "harga": 5000, "stok": 50
        })
        write_log("EDIT_MENU", "Menu 'Kopi Susu' berhasil diupdate", user=operator, detail_json={
            "nama": "Kopi Susu Gula Aren", "harga": 6000, "stok": 45
        })

        # 5. Member (👤)
        write_log("TAMBAH_MEMBER", "Member udin_gamer (reguler) dibuat", user=operator, detail_json={
            "username": "udin_gamer", "nama_lengkap": "Udin Sudin", "grup": "reguler", "saldo_menit": 0, "no_hp": "08123456789", "email": "udin@gmail.com"
        })
        write_log("TOPUP_MEMBER", "Topup saldo udin_gamer +120m", user=operator, detail_json={
            "username": "udin_gamer", "durasi_tambah": 120, "saldo_baru": 120, "nominal": 10000
        })

        # 6. Shift Kasir (💵)
        write_log("SHIFT_BUKA", "Kasir:kasir_1 | Modal:Rp50,000", user=operator, detail_json={
            "kasir_username": "kasir_1", "modal_awal": 50000
        })
        write_log("SHIFT_TUTUP", "Kasir:kasir_1 | Modal:50,000 | Billing:100,000 | Kantin:50,000 | Fisik:200,000 | Selisih:+0", user=operator, detail_json={
            "kasir_username": "kasir_1", "modal_awal": 50000, "total_billing": 100000, "total_kantin": 50000, "uang_fisik": 200000, "selisih": 0, "status": "SELESAI"
        })

        # 7. Paket Billing (💳)
        write_log("TAMBAH_PAKET", "Paket Begadang (reguler) berhasil dibuat", user=operator, detail_json={
            "nama": "Paket Begadang", "durasi_menit": 600, "harga": 25000, "kadaluarsa_hari": 1, "grup": "reguler"
        })
        write_log("EDIT_PAKET", "Data paket Paket Malam diperbarui", user=operator, detail_json={
            "harga": {"old": 15000, "new": 20000}, "durasi_menit": {"old": 300, "new": 360}
        })

        # 8. Unit PC / Zona (🖥️)
        write_log("TAMBAH_PC", "PC PC-99 (vip) didaftarkan", user=operator, detail_json={
            "kode": "PC-99", "nama": "VIP-99", "ip_address": "192.168.1.99", "mac_address": "AA:BB:CC:DD:EE:FF", "grup": "vip"
        })
        write_log("BATCH_PC", "Tambah 5 PC via IP Range", user=operator, detail_json={
            "jumlah_ditambahkan": 5, "daftar_kode": ["PC-10", "PC-11", "PC-12", "PC-13", "PC-14"], "grup": "reguler"
        })
        write_log("WOL_PACKET", "Magic Packet terkirim ke PC-01 (AA:BB:CC:DD:EE:FF)", user=operator, detail_json={
            "kode": "PC-01", "mac": "AA:BB:CC:DD:EE:FF"
        })

        # 9. Akun & Keamanan (🔑)
        write_log("LOGIN_GAGAL", "Username:hacker - IP 10.0.0.1 tidak di whitelist", user="system", detail_json={
            "username": "hacker", "client_ip": "10.0.0.1", "reason": "IP tidak di whitelist"
        })
        write_log("IP_WHITELIST_ADD", "IP 192.168.1.50 ditambahkan ke whitelist", user=operator, detail_json={
            "ip_address": "192.168.1.50", "keterangan": "Kasir Backup"
        })
        write_log("UPDATE_USER", "ID:2 | User:kasir_malam", user=operator, detail_json={
            "username": "kasir_malam", "nama_lengkap": "Budi Kasir", "role": "kasir", "aktif": True
        })

        # 10. Perawatan & Tiket PC (🛠️)
        write_log("BUAT_TIKET", "Tiket HARDWARE PC PC-05 dibuat (Prioritas TINGGI)", user=operator, detail_json={
            "pc_kode": "PC-05", "reporter": "admin", "kategori": "HARDWARE", "prioritas": "TINGGI", "judul": "Keyboard Rusak"
        })
        write_log("UPDATE_TIKET", "Tiket PC PC-05 diupdate ke SELESAI", user=operator, detail_json={
            "pc_kode": "PC-05", "status": "SELESAI", "resolved_by": "teknisi", "biaya": 150000
        })

        # 11. Refund & Hapus Riwayat (🔄 & 🗑️)
        write_log("REFUND_PAKET", "Refund paket Rp20,000 dari nota N-123", user=operator, detail_json={
            "no_nota_refund": "REF-001", "no_nota_original": "N-123", "jumlah_refund": 20000, "durasi_beli_sebelum": 120, "durasi_dikurangi": 120, "username": "budi_vip"
        })
        write_log("DELETE_STRUK", "Hapus transaksi nota TMM-001", user=operator, detail_json={
            "no_nota": "TMM-001", "jenis": "Kantin", "jumlah": 14000, "tanggal": "2026-08-15 10:00", "keterangan": "Batal pesan, user pulang"
        })

        # 12. Sistem, Backup & Settings (⚙️)
        write_log("MANUAL_BACKUP", "User memicu backup database ke server", user=operator, detail_json={
            "tipe": "MANUAL", "lokasi": "instance/backups/manual_20260815.db"
        })
        write_log("SETTINGS_TIMEZONE", "Timezone diubah ke Asia/Makassar", user=operator, detail_json={
            "timezone_sebelum": "Asia/Jakarta", "timezone_baru": "Asia/Makassar"
        })
        write_log("DB_MAINTENANCE", "Admin membersihkan data > 6 bulan & VACUUM DB", user=operator, detail_json={
            "retention_months": 6, "space_saved": "12.4 MB"
        })

        print("✅ Berhasil menyuntikkan seluruh sample logs (12 domain) ke sistem.")

if __name__ == "__main__":
    seed_logs()
```

- [ ] **Step 2: Jalankan eksekusi seed logs tool untuk verifikasi**

Run: `.\.venv\Scripts\python.exe tools/seed_audit_logs.py`
Expected: "✅ Berhasil menyuntikkan seluruh sample logs (12 domain) ke sistem."

- [ ] **Step 3: Commit Task 4**

```bash
git add tools/seed_audit_logs.py
git commit -m "feat(tools): add comprehensive 12-domain audit log seeder CLI tool"
```

---

### Task 5: End-to-End Regression Testing & Final Verification

**Files:**
- Create: `tests/test_e2e_log_clearing.py`

- [ ] **Step 1: Tulis script pengujian E2E integrasi penuh**

```python
# tests/test_e2e_log_clearing.py
import pytest
from app import create_app
from app.utils.logger import write_log, LOG_FILE
from app.services.report.log_audit_service import LogAuditService
from tools.seed_audit_logs import seed_logs

def test_full_log_cycle():
    app = create_app()
    with app.app_context():
        # 1. Suntikkan sample log dari seed tool (mencakup 12 domain)
        seed_logs(include_legacy=True)
        
        # 2. Clear log dengan archive
        result = LogAuditService.clear_system_logs(operator="superadmin", archive=True)
        assert result["success"] is True
        assert result["total_dibersihkan"] >= 15
        assert result["archive_path"] is not None
        
        # 3. Verifikasi log setelah clear berisi CLEAR_LOG terstruktur
        logs_res = LogAuditService.get_system_logs(limit=5)
        assert len(logs_res["logs"]) == 1
        assert logs_res["logs"][0]["action"] == "CLEAR_LOG"
        assert logs_res["logs"][0]["user"] == "superadmin"
        assert logs_res["logs"][0]["detail_json"]["total_dibersihkan"] >= 15
```

- [ ] **Step 2: Jalankan seluruh test suite**

Run: `.\.venv\Scripts\python.exe -m pytest tests/ -v`
Expected: ALL PASS.

- [ ] **Step 3: Commit final test suite & plan**

```bash
git add tests/test_e2e_log_clearing.py docs/superpowers/plans/2026-08-15-audit-log-clearing-plan.md
git commit -m "test(log): add end-to-end regression tests for 12-domain log clearing workflow"
```

---

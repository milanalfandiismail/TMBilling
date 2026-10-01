# Responsive Grid (8 / 10 / 12 Kolom), Paged Slide Denah Manual, Helper Caption, Penyelarasan Posisi AFK & Remote Lock PIN Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan dashboard grid responsif (8 kolom di LG, 10 di XL, 12 di 2XL) baik untuk Auto-Sort maupun Denah Manual tanpa scale down dan tanpa mengubah ukuran/isi kartu, menyelaraskan informasi AFK di Baris 2 kartu (seperti status Terputus), menambahkan helper caption informatif dan navigasi tombol panah slide saat denah berkolom banyak dibuka di layar lebih kecil, serta memperbaiki celah keamanan kunci layar PC dari kasir dengan mewajibkan input PIN kasir sehingga client tidak bisa membuka kunci dengan sembarang huruf.

**Architecture:** Grid Auto-Sort menggunakan utility Tailwind responsif (`grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12`). Grid Manual Denah yang melebihi kapasitas layar (`cols > capacity`) dibungkus dalam viewport `overflow-hidden`, dilengkapi banner helper edukatif dan kontrol navigasi slide (`◀` dan `▶`) di header grup yang menggeser grid via CSS `transform: translateX(-...)` halus tanpa scrollbar. Informasi AFK dipindahkan dari Baris 1 ke Baris 2 seperti pola `⚠️ TERPUTUS`. Pada modal detail kasir, remote lock PC mewajibkan kasir mengisi 4-6 digit PIN yang di-hash dan disimpan pada `sesi.afk_pin`, serta menghapus celah fallback `valid = True` pada `ClientService.afk_unlock`.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, Tailwind CSS, Python / Flask, Pytest, Werkzeug security.

**Spec:** [`docs/superpowers/specs/2026-09-27-responsive-grid-paged-denah-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-09-27-responsive-grid-paged-denah-design.md)

## Global Constraints

- **Jumlah Kolom Layar**:
  - `2xl` ($\ge 1536$px): Tepat **12 kolom**
  - `xl` ($\ge 1280$px): Tepat **10 kolom**
  - `lg` ($\ge 1024$px): Tepat **8 kolom**
- **Ukuran & Tipografi Kartu**: Ukuran kartu (`min-h-[120px] lg:min-h-[125px]`, `p-2 sm:p-2.5`), font size class, dan layout dasar kartu **TIDAK BOLEH DIUBAH ATAU DICILKAN**.
- **Tanpa Scrollbar**: Navigasi perpindahan kolom denah manual **TIDAK BOLEH MENGGUNAKAN SCROLLBAR**, melainkan menggunakan tombol slide panah (`◀` dan `▶`) dengan container `overflow-hidden`.
- **Helper Caption End-User**: Wajib menampilkan banner informasi edukatif saat denah manual melebihi kapasitas layar agar kasir/operator langsung memahami cara melihat kolom yang tersembunyi.
- **Posisi AFK**: Diselaraskan dengan status `⚠️ TERPUTUS` di Baris 2. Baris 1 tidak boleh memiliki badge AFK agar Kode PC mendapat 100% lebar kartu.
- **Security Remote Lock**: Kasir wajib menginput PIN saat mengunci PC secara remote. Sisi client wajib memasukkan PIN yang cocok dan dilarang bisa terbuka dengan sembarang huruf.
- **Commit Guard**: DILARANG melakukan `git commit` sampai pengguna secara eksplisit memberikan persetujuan ("udah oke").
- **MCP Wajib**: Selalu gunakan MCP `codebase-memory` untuk memvalidasi pemanggilan fungsi dan relasi kode.

---

### Task 1: Penyelarasan Posisi Info AFK pada Kartu PC (Row 2 Seperti Terputus)

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js:66-193`
- Test: `tests/test_afk_dashboard_integration.py`

**Interfaces:**
- Consumes: Objek `pc` dari API status kasir (`pc.kode`, `pc.is_afk`, `pc.sesi_detail`, `pc.active_window`, `pc.status_koneksi`).
- Produces: HTML string kartu PC di mana Baris 1 hanya berisi checkmark seleksi, Kode PC (lebar penuh), dan Status Dot; Baris 2 menampilkan status koneksi / AFK / active window.

- [ ] **Step 1: Inspect dan pastikan test AFK backend berjalan**

Run: `.\.venv\Scripts\python -m pytest tests/test_afk_dashboard_integration.py -v`
Expected: PASS

- [ ] **Step 2: Modifikasi `renderCompactCard` di `dashboard_compact.js`**

Hapus badge AFK dari Baris 1 (`Row 1: Kode PC`), beri Baris 1 ruang leluasa (`flex-1 truncate`).
Di Baris 2 (`Row 2: Aplikasi / Active Window`), format teks AFK tebal dengan warna amber menyala persis seperti format penanganan `⚠️ TERPUTUS`:

```javascript
// Baris 2 text & styling logic
let activeAppHtml = '';
if (isLostConnection) {
    activeAppHtml = `<div class="text-[10px] lg:text-xs xl:text-sm text-red-400 font-bold truncate mt-0.5 animate-pulse" title="⚠️ TERPUTUS">⚠️ TERPUTUS</div>`;
} else if (isActive && sesi && isAfk) {
    const afkText = pc.active_window ? `🔒 ${pc.active_window}` : '🔒 AFK / Istirahat';
    activeAppHtml = `<div class="text-[10px] lg:text-xs xl:text-sm text-amber-400 font-bold truncate mt-0.5" title="${afkText}">${afkText}</div>`;
} else {
    activeAppHtml = `<div class="text-[10px] lg:text-xs xl:text-sm text-neutral-400 truncate mt-0.5" title="${activeAppName || '-'}">${activeAppName || '-'}</div>`;
}
```

Dan di HTML template Baris 1:
```javascript
<!-- Row 1: Kode PC - Inline Selection Checkmark - Status DOT -->
<div class="flex items-center justify-between">
    <div class="flex items-center gap-1.5 min-w-0 flex-1">
        <span class="selection-check-badge text-indigo-400 font-black text-xs lg:text-sm shrink-0 ${isSelected ? '' : 'hidden'}">✓</span>
        <span class="${kodeFontSizeClass} font-black text-neutral-100 tracking-tight truncate flex-1">${pc.kode}</span>
    </div>
    <span class="w-2.5 h-2.5 rounded-full ${indicatorColorClass} shrink-0 bg-current"></span>
</div>
<!-- Row 2: Aplikasi / Active Window / Status AFK & Terputus -->
${activeAppHtml}
```

- [ ] **Step 3: Verifikasi sintaks dan integritas tampilan kartu**

Pastikan ukuran kartu tetap `min-h-[120px] lg:min-h-[125px]`, padding `p-2 sm:p-2.5`, dan tipografi mono pada timer tidak berubah.

---

### Task 2: Implementasi Helper Kapasitas Layar & State Offset Kolom

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js`

**Interfaces:**
- Produces:
  - `CompactGrid._groupOffsets`: Object map `{ [grupKey]: number }`
  - `CompactGrid._getScreenCapacity()`: `() => number` (12 on 2xl, 10 on xl, 8 on lg/md)
  - `CompactGrid.nextColPage(grupKey)`: `() => void`
  - `CompactGrid.prevColPage(grupKey)`: `() => void`

- [ ] **Step 1: Tambahkan method helper kapasitas dan pagination state pada CompactGrid**

```javascript
_groupOffsets: {},

_getScreenCapacity() {
    const w = window.innerWidth;
    if (w >= 1536) return 12; // 2xl
    if (w >= 1280) return 10; // xl
    if (w >= 1024) return 8;  // lg
    return 8; // fallback tablet
},

nextColPage(grupKey) {
    const capacity = this._getScreenCapacity();
    const gs = this._getGridSize(grupKey);
    const cols = gs.cols || 12;
    const maxOffset = Math.max(0, cols - capacity);
    const currentOffset = this._groupOffsets[grupKey] || 0;
    
    // Geser sejauh selisih kapasitas (misal di XL dari 1-10 -> 3-12, loncatan = cols - capacity)
    const jump = cols - capacity;
    const newOffset = Math.min(maxOffset, currentOffset + jump);
    this._groupOffsets[grupKey] = newOffset;

    if (window.Dashboard && window.Dashboard.lastData) {
        window.Dashboard._render(window.Dashboard.lastData);
    }
},

prevColPage(grupKey) {
    const capacity = this._getScreenCapacity();
    const gs = this._getGridSize(grupKey);
    const cols = gs.cols || 12;
    const currentOffset = this._groupOffsets[grupKey] || 0;
    
    const jump = cols - capacity;
    const newOffset = Math.max(0, currentOffset - jump);
    this._groupOffsets[grupKey] = newOffset;

    if (window.Dashboard && window.Dashboard.lastData) {
        window.Dashboard._render(window.Dashboard.lastData);
    }
},
```

---

### Task 3: Responsif Kolom Auto-Sort Grid (8 di LG, 10 di XL, 12 di 2XL)

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js:272-284`

**Interfaces:**
- Consumes: Daftar `pcs` terurut pada grup yang aktif.
- Produces: Container CSS grid dengan kelas `grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-2 auto-rows-fr p-1`.

- [ ] **Step 1: Update container Auto-Sort desktop pada method `render`**

Ganti style inline fixed 12 kolom dengan utility responsive Tailwind:
```javascript
<!-- Auto-Sort Grid: flows naturally in 8 (lg), 10 (xl), 12 (2xl) columns -->
<div class="auto-grid-wrapper overflow-hidden w-full pt-2 pb-2 px-1">
    <div class="auto-grid-container grid gap-2 grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 auto-rows-fr p-1">
        ${pcs.map(pc => {
            return `
                <div>
                    ${this.renderCompactCard(pc)}
                </div>
            `;
        }).join('')}
    </div>
</div>
```

Kartu akan mengalir secara natural sesuai batas layar (8 kolom di LG, 10 di XL, 12 di 2XL) tanpa scale down dan tanpa scrollbar horizontal.

---

### Task 4: Navigasi Paged Slide Tombol Panah & Helper Caption untuk Denah Manual

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js:232-315`

**Interfaces:**
- Consumes: `gs.cols`, `gs.rows`, `pc.pos_x`, `pc.pos_y`, `_groupOffsets[grupKey]`, `_getScreenCapacity()`.
- Produces:
  - Header Grup: Kontrol navigasi slide panah `[ ◀ ] Kolom X–Y [ ▶ ]` hanya saat `cols > capacity`.
  - Helper Caption Banner: Banner edukatif bagi kasir/operator saat denah melebihi kapasitas layar monitor.
  - Manual Grid Container: Viewport `overflow-hidden` dengan transform translasi geser yang mulus tanpa scrollbar.

- [ ] **Step 1: Render Tombol Panah Paged Slide di Header Grup Manual Grid**

Pada header grup:
```javascript
const capacity = this._getScreenCapacity();
const isCrossScreen = !isMobile && !isAutoSort && cols > capacity;
const maxOffset = Math.max(0, cols - capacity);
const offset = Math.min(maxOffset, this._groupOffsets[grupKey] || 0);

// Kontrol Paging Slide Arrow
const pageNavHtml = isCrossScreen ? `
    <div class="flex items-center gap-1 bg-[#141414] border border-[#2a2a2a] rounded px-2 py-1 text-xs">
        <button onclick="CompactGrid.prevColPage('${grupKey}')" 
            ${offset === 0 ? 'disabled' : ''} 
            title="Lihat kolom sebelumnya"
            class="px-1.5 py-0.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded disabled:opacity-25 disabled:cursor-not-allowed transition-all">
            ◀
        </button>
        <span class="font-mono text-[11px] text-neutral-300 font-bold px-1.5">
            Kolom ${1 + offset}–${capacity + offset}
        </span>
        <button onclick="CompactGrid.nextColPage('${grupKey}')" 
            ${offset >= maxOffset ? 'disabled' : ''} 
            title="Lihat kolom berikutnya"
            class="px-1.5 py-0.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded disabled:opacity-25 disabled:cursor-not-allowed transition-all">
            ▶
        </button>
    </div>
` : '';
```

- [ ] **Step 2: Render Helper Caption Banner untuk End-User**

Tepat di bawah header grup dan di atas viewport denah:
```javascript
// Helper Caption Banner saat denah melebihi kapasitas layar
const helperCaptionHtml = isCrossScreen ? `
    <div class="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-300">
        <div class="flex items-center gap-2">
            <span class="text-base shrink-0">💡</span>
            <span class="leading-relaxed">
                Denah grup ini memiliki <strong>${cols} kolom</strong> (layar saat ini menampilkan <strong>${capacity} kolom</strong>). Gunakan tombol panah <strong>[ ◀ ] [ ▶ ]</strong> di kanan atas untuk menggeser dan melihat kolom lainnya.
            </span>
        </div>
        <div class="font-mono text-[11px] bg-amber-500/20 border border-amber-500/30 px-2 py-1 rounded text-amber-200 shrink-0 font-bold hidden sm:inline-block">
            Kolom ${1 + offset}–${capacity + offset} dari ${cols}
        </div>
    </div>
` : '';
```

- [ ] **Step 3: Render Container Manual Grid dengan Paged Sliding**

```javascript
${helperCaptionHtml}
<!-- Manual Layout Grid: uses absolute pos_x / pos_y with paged sliding if cols > capacity -->
<div class="manual-grid-viewport overflow-hidden w-full pt-2 pb-2 px-1 relative">
    <div class="manual-grid-container grid gap-2 auto-rows-fr p-1" 
         data-grup="${grupKey}"
         data-cols="${cols}" 
         data-rows="${rows}"
         data-offset="${offset}"
         style="
            grid-template-columns: repeat(${cols}, minmax(0, 1fr)); 
            grid-template-rows: repeat(${rows}, minmax(0, 1fr));
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
         ">
        ${mapped.map(pc => {
            return `
                <div style="grid-column: ${pc.pos_x + 1}; grid-row: ${pc.pos_y + 1};">
                    ${this.renderCompactCard(pc)}
                </div>
            `;
        }).join('')}
    </div>
</div>
```

---

### Task 5: Penyesuaian Lebar & Translasi Manual Grid di `adjustGridScale()`

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js:340-388`

**Interfaces:**
- Consumes: Elemen `.manual-grid-viewport` dan `.manual-grid-container`.
- Produces: Dimensi dan translasi presisi untuk `transform: translateX(-...)` sesuai lebar kolom saat ini tanpa distorsi skala.

- [ ] **Step 1: Hapus scaling transform dan ganti dengan kalkulasi sliding paged denah**

```javascript
adjustGridScale() {
    const capacity = this._getScreenCapacity();

    document.querySelectorAll('.manual-grid-viewport').forEach(viewport => {
        const grid = viewport.querySelector('.manual-grid-container');
        if (!grid) return;

        const cols = parseInt(grid.dataset.cols) || 12;
        const grupKey = grid.dataset.grup;
        const viewportWidth = viewport.clientWidth;
        if (viewportWidth === 0) return;

        if (cols > capacity) {
            const gap = 8;
            const colWidth = (viewportWidth - ((capacity - 1) * gap)) / capacity;
            const totalGridWidth = (cols * colWidth) + ((cols - 1) * gap);
            
            const maxOffset = Math.max(0, cols - capacity);
            const currentOffset = Math.min(maxOffset, this._groupOffsets[grupKey] || 0);
            const translateX = -(currentOffset * (colWidth + gap));

            grid.style.width = totalGridWidth + 'px';
            grid.style.gridTemplateColumns = `repeat(${cols}, ${colWidth}px)`;
            grid.style.transform = `translateX(${translateX}px)`;
        } else {
            grid.style.width = '100%';
            grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
            grid.style.transform = 'none';
        }
    });

    document.querySelectorAll('.auto-grid-wrapper').forEach(wrapper => {
        const grid = wrapper.querySelector('.auto-grid-container');
        if (grid) {
            grid.style.width = '100%';
            grid.style.transform = 'none';
        }
        wrapper.style.height = '';
    });
}
```

---

### Task 6: Perbaikan Remote AFK Lock dengan Inputan PIN Kasir & Security Unlock

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js:512-536`
- Modify: `app/routes/monitor/monitor_routes.py:220-248`
- Modify: `app/services/client/client_service.py:445-456`
- Test: `tests/test_kasir_remote_afk_routes.py`

**Interfaces:**
- Consumes: `pcId`, `pin` (4-6 digit angka).
- Produces: Hash PIN pada `sesi.afk_pin`, validasi ketat pada `ClientService.afk_unlock` (tidak bisa dibuka dengan sembarang huruf).

- [ ] **Step 1: Update `remoteAfkLock` di `dashboard_detail_modal.js`**

Ganti `Modal.confirm` sederhana dengan dialog input PIN kunci layar:
```javascript
remoteAfkLock(pcId, pcKode = '') {
    if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
    const pcName = pcKode || `PC #${pcId}`;

    Modal.confirm(`
        <div class="space-y-3">
            <div class="text-center">
                <p class="text-xs lg:text-base text-neutral-200 font-bold uppercase tracking-wider">Kunci Layar AFK PC ${pcName}</p>
                <p class="text-[11px] lg:text-sm text-neutral-400 mt-1">Layar PC client akan dikunci. Tentukan PIN untuk membuka kunci PC ini.</p>
            </div>
            <div class="text-left">
                <label class="block text-xs font-semibold text-neutral-300 mb-1">PIN Kunci Layar (4-6 Digit Angka):</label>
                <input type="password" id="remote-afk-pin-input" maxlength="6" placeholder="Contoh: 1234"
                    class="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-center text-sm font-mono tracking-widest text-white focus:border-amber-500 focus:outline-none">
                <p id="remote-afk-pin-error" class="text-[11px] text-red-400 mt-1 hidden"></p>
            </div>
        </div>
    `, async () => {
        const pinInput = document.getElementById('remote-afk-pin-input');
        const pin = (pinInput?.value || '').trim();
        if (!pin || pin.length < 4 || !/^\d+$/.test(pin)) {
            Toast.error('PIN wajib berupa 4 sampai 6 digit angka!');
            return false; // prevent closing
        }

        try {
            const result = await API.request(`/api/v1/kasir/monitor/remote/${pcId}/afk-lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin })
            });
            if (!result.success) {
                throw new Error(result.error || 'Gagal mengunci PC');
            }
            Toast.success(`PC ${pcName} berhasil dikunci dengan PIN!`);
            if (window.Dashboard) window.Dashboard._render(window.Dashboard.lastData);
        } catch (err) {
            console.error('[DashboardDetailModal] Remote AFK Lock error:', err);
            Toast.error(err.message || 'Gagal mengunci PC');
        }
    });
},
```

- [ ] **Step 2: Update route backend `trigger_remote_afk_lock` di `monitor_routes.py`**

Wajibkan `pin` pada payload request dan hash ke `sesi.afk_pin`:
```python
@monitor_kasir_bp.route("/remote/<int:pc_id>/afk-lock", methods=["POST"])
@login_required
@admin_required
@shift_required
def trigger_remote_afk_lock(pc_id):
    """Trigger remote AFK lock ke PC client dari Kasir dengan PIN."""
    try:
        from app.repositories import PCRepository, SesiRepository
        from app.models import db, now_local
        from app.services import ClientService
        from werkzeug.security import generate_password_hash

        data = request.get_json() or {}
        pin = str(data.get("pin", "")).strip()
        if not pin or len(pin) < 4 or not pin.isdigit():
            return jsonify({"success": False, "error": "PIN kunci layar minimal 4-6 digit angka"}), 400

        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        sesi = SesiRepository.get_aktif_by_pc(pc.id)
        if not sesi:
            return jsonify({"success": False, "error": "Tidak ada sesi aktif di PC ini"}), 400

        sesi.is_afk = True
        sesi.afk_pin = generate_password_hash(pin)
        sesi.afk_sejak = now_local()
        db.session.commit()

        ClientService.queue_command(pc.id, "afk_lock")
        operator = session.get("kasir_username", "admin")
        write_log("REMOTE_AFK_LOCK", f"PC {pc.kode} dikunci AFK secara remote oleh kasir dengan PIN", user=operator, detail_json={"pc_kode": pc.kode, "sesi_id": sesi.id})
        return jsonify({"success": True, "message": f"Perintah kunci AFK berhasil dikirim ke {pc.kode}"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 3: Perbaiki bug celah unlock di `ClientService.afk_unlock` (`client_service.py`)**

Hapus `valid = True` tanpa validasi. Sesi yang dikunci wajib diverifikasi terhadap `sesi.afk_pin`:
```python
valid = False
if sesi.tipe == "member" and sesi.member:
    if sesi.afk_pin:
        from werkzeug.security import check_password_hash
        valid = check_password_hash(sesi.afk_pin, str(credential).strip()) or sesi.member.check_password(str(credential))
    else:
        valid = sesi.member.check_password(str(credential))
elif sesi.afk_pin:
    from werkzeug.security import check_password_hash
    valid = check_password_hash(sesi.afk_pin, str(credential).strip())
elif sesi.tipe == "guest" and not sesi.afk_pin:
    # PERBAIKAN BUG: Dilarang bypass sembarang huruf!
    valid = False

if not valid:
    raise PermissionError("Password akun atau PIN yang Anda masukkan salah")
```

- [ ] **Step 4: Update test di `tests/test_kasir_remote_afk_routes.py`**

Tambahkan uji coba bahwa lock kasir mengirimkan PIN `5678`, lalu uji coba client memasukkan sembarang huruf $\rightarrow$ gagal (401), dan hanya memasukkan PIN `5678` yang berhasil (200).

---

### Task 7: Verifikasi Menyeluruh & Testing

**Files:**
- Test: `tests/test_kasir_remote_afk_routes.py`
- Test: `tests/test_client_afk_routes.py`
- Test: `tests/test_afk_dashboard_integration.py`
- Browser check

- [ ] **Step 1: Jalankan pytest test suite terkait**

Run: `.\.venv\Scripts\python -m pytest tests/test_kasir_remote_afk_routes.py tests/test_client_afk_routes.py tests/test_afk_dashboard_integration.py -v`
Expected: ALL PASS

- [ ] **Step 2: Jalankan full test suite regresi**

Run: `.\.venv\Scripts\python -m pytest -q`
Expected: 246+ passed

- [ ] **Step 3: Verifikasi Breakpoints & Auto-Sort Penyesuaian Kolom**
- [ ] LG ($\ge 1024$px): Auto-sort menampilkan tepat 8 kolom per baris (`grid-cols-8`).
- [ ] XL ($\ge 1280$px): Auto-sort menampilkan tepat 10 kolom per baris (`xl:grid-cols-10`).
- [ ] 2XL ($\ge 1536$px): Auto-sort menampilkan tepat 12 kolom per baris (`2xl:grid-cols-12`).
- [ ] **Step 4: Verifikasi Denah Manual Paged Sliding & Helper Caption**
- [ ] 2XL: Menampilkan 12 kolom penuh, navigasi panah & helper caption tersembunyi.
- [ ] XL: Menampilkan kolom 1–10. Helper caption muncul (`💡 Denah grup ini memiliki 12 kolom...`). Tombol `▶` muncul. Klik `▶` $\rightarrow$ geser mulus ke kolom 3–12. Klik `◀` $\rightarrow$ kembali ke 1–10.
- [ ] LG: Menampilkan kolom 1–8. Helper caption muncul. Klik `▶` $\rightarrow$ geser mulus ke kolom 5–12.
- [ ] **Step 5: Verifikasi Kartu PC**
- [ ] Baris 1: Kode PC memiliki lebar leluasa, tidak ada badge AFK yang memotong teks.
- [ ] Baris 2: Menampilkan `🔒 AFK / Istirahat` (teks amber tebal) persis seperti `⚠️ TERPUTUS` (teks merah tebal).
- [ ] Ukuran kartu (`min-h-[120px] lg:min-h-[125px]`) tetap konsisten tanpa scaling distorsi.
- [ ] **Step 6: Verifikasi Security Remote Lock Kasir**
- [ ] Modal Remote Lock meminta PIN (4-6 digit).
- [ ] Di sisi client, memasukkan sembarang huruf tidak lagi membuka kunci (*bug boom langsung masuk telah teratasi*).

---

## Execution Handoff

Setelah dokumen plan ini disetujui, eksekusi dapat segera dijalankan sesuai pilihan alur kerja.

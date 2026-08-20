# Rencana Implementasi Penyesuaian Bahasa & Format Waktu Lokal UI Kasir

> **Untuk pekerja agen:** SUB-SKILL WAJIB: Gunakan superpowers:subagent-driven-development (direkomendasikan) atau superpowers:executing-plans untuk mengeksekusi rencana ini tugas demi tugas. Setiap langkah menggunakan sintaks checkbox (`- [ ]`).

<output_verbosity_spec>
- Rencana langkah demi langkah disusun menggunakan standar plugin Superpowers.
- Seluruh teks dan istilah diterjemahkan ke dalam bahasa Indonesia modern yang ramah, jelas, dan tidak kaku.
- Format tampilan jam wajib menyertakan zona waktu lokal warnet (contoh: `15:30 WITA` atau `14:30 WIB`).
</output_verbosity_spec>

<design_and_scope_constraints>
- Fokus utama pada penggantian label "First seen", "Last seen", dan "Idle" serta terminologi bahasa Inggris di tab laporan Uptime Tracker dan Hardware Monitor.
- Pertahankan istilah teknis universal (seperti Hardware, PC, IP Address, MAC Address, CPU, GPU, RAM, SSD, Driver, dll).
- Tidak mengubah logika bisnis atau skema database (data tetap UTC naive di DB, konversi dilakukan pada presentation/serialization layer).
</design_and_scope_constraints>

<uncertainty_and_ambiguity>
- "First seen" diterjemahkan menjadi "Mulai Aktif" (atau "Pertama Nyala").
- "Last seen" diterjemahkan menjadi "Terakhir Aktif".
- "Idle (Sisa)" diterjemahkan menjadi "Idle (Tanpa Billing)" atau "Waktu Diam".
- Istilah teknis universal tetap dipertahankan dalam format aslinya agar operator warnet tidak bingung.
</uncertainty_and_ambiguity>

**Goal:** Menyesuaikan seluruh label antarmuka dan laporan pada modul Uptime Tracker dan Hardware Monitor ke dalam bahasa Indonesia modern, serta menyertakan label zona waktu lokal (misal `WITA`) pada tampilan jam.

**Architecture:** 
- Format waktu pada model `PCUptimeLog.to_dict()` disesuaikan agar `first_seen_time` dan `last_seen_time` menggunakan helper `format_display(..., fmt="%H:%M")` sehingga menghasilkan string waktu beserta singkatan timezone (misal: `15:30 WITA`).
- Template HTML `uptime.html` dan skrip JavaScript `uptime/index.js` diperbarui agar label tabel, filter, dan pesan status menggunakan bahasa Indonesia modern.

**Tech Stack:** Python 3, Flask, Jinja2 Templates, Vanilla JavaScript, Tailwind CSS.

**Spec:** Penyesuaian Bahasa Indonesia Modern & Tampilan Waktu Lokal UI Kasir

## Global Constraints

- Storage database tetap menggunakan UTC naive sebagai source of truth.
- Tampilan jam pada UI kasir harus mencerminkan zona waktu lokal warnet yang aktif di konfigurasi sistem (`Asia/Makassar` -> `WITA`, `Asia/Jakarta` -> `WIB`, `Asia/Jayapura` -> `WIT`).
- Seluruh string bahasa Inggris di UI dan toast alert Uptime Tracker wajib disesuaikan ke bahasa Indonesia modern, kecuali istilah teknis universal.

---

### Task 1: Pembaruan Format Waktu & Timezone Label pada Backend Serialization

**Files:**
- Modify: `app/models/pc/pc_uptime.py:62-79`
- Test: `tests/test_pc_hard_delete_and_uptime.py`

**Interfaces:**
- Consumes: `app.utils.timezone_utils.format_display`
- Produces: `first_seen_time` dan `last_seen_time` terformat dengan label zona waktu (misal: `"15:30 WITA"`).

- [ ] **Step 1: Tulis unit test untuk verifikasi format jam dengan label zona waktu**

Perbarui pengujian di `tests/test_pc_hard_delete_and_uptime.py` untuk memastikan `first_seen_time` menyertakan label zona waktu.

```python
    def test_pc_uptime_to_dict_includes_timezone_label(self):
        log = PCUptimeLog(
            pc_id=self.pc.id,
            tanggal=date.today(),
            total_online_seconds=3600,
            total_billing_seconds=1800,
            first_seen=datetime(2026, 8, 20, 2, 0, 0),  # 02:00 UTC -> 10:00 WITA
            last_seen=datetime(2026, 8, 20, 3, 0, 0)    # 03:00 UTC -> 11:00 WITA
        )
        db.session.add(log)
        db.session.commit()

        d = log.to_dict()
        self.assertIn("WITA", d["first_seen_time"])
        self.assertIn("10:00", d["first_seen_time"])
        self.assertIn("WITA", d["last_seen_time"])
        self.assertIn("11:00", d["last_seen_time"])
```

- [ ] **Step 2: Jalankan pengujian untuk memverifikasi kegagalan**

Run: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest tests/test_pc_hard_delete_and_uptime.py -k test_pc_uptime_to_dict_includes_timezone_label`
Expected: FAIL karena format lama hanya menghasilkan `"10:00"` tanpa label `"WITA"`.

- [ ] **Step 3: Implementasikan format waktu dengan label timezone di `PCUptimeLog.to_dict()`**

Edit `app/models/pc/pc_uptime.py`:

```python
        return {
            "id": self.id,
            "pc_id": self.pc_id,
            "pc_kode": self.pc.kode if self.pc else "Unknown",
            "grup": grup_nama,
            "tanggal": self.tanggal.isoformat() if self.tanggal else None,
            "total_online_menit": online_menit,
            "total_billing_menit": billing_menit,
            "total_online_seconds": self.total_online_seconds,
            "total_billing_seconds": self.total_billing_seconds,
            "first_seen": first_seen_local.isoformat() if first_seen_local else None,
            "last_seen": last_seen_local.isoformat() if last_seen_local else None,
            "first_seen_display": format_display(self.first_seen) if self.first_seen else "-",
            "last_seen_display": format_display(self.last_seen) if self.last_seen else "-",
            "first_seen_time": format_display(self.first_seen, fmt="%H:%M") if self.first_seen else "-",
            "last_seen_time": format_display(self.last_seen, fmt="%H:%M") if self.last_seen else "-",
            "utilisasi_persen": utilisasi
        }
```

- [ ] **Step 4: Jalankan pengujian untuk memverifikasi keberhasilan**

Run: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest tests/test_pc_hard_delete_and_uptime.py -k test_pc_uptime_to_dict_includes_timezone_label`
Expected: PASS

- [ ] **Step 5: Commit perubahan backend**

```bash
git add app/models/pc/pc_uptime.py tests/test_pc_hard_delete_and_uptime.py
git commit -m "fix(uptime): format tampilan first_seen dan last_seen menyertakan label timezone lokal"
```

---

### Task 2: Lokalisasi Template HTML Uptime Tracker (`uptime.html`)

**Files:**
- Modify: `app/templates/kasir/tabs/uptime.html:10-108`

**Interfaces:**
- Consumes: Struktur DOM tab uptime
- Produces: Header tabel, kartu KPI, dan teks deskripsi dalam bahasa Indonesia modern.

- [ ] **Step 1: Perbarui teks dan label di `app/templates/kasir/tabs/uptime.html`**

Ubah label tabel:
- `First Seen` -> `Mulai Aktif`
- `Last Seen` -> `Terakhir Aktif`
- `Idle (Sisa)` -> `Idle (Tanpa Billing)`
- `Silakan pilih filter dan klik Tampilkan.` -> `Silakan pilih tanggal untuk melihat statistik aktivitas PC.`

```html
                <thead>
                    <tr class="border-b border-[#1f1f1f] text-neutral-500 text-[10px] lg:text-base font-bold uppercase tracking-wider">
                        <th class="py-3 px-4">PC</th>
                        <th class="py-3 px-4">Grup</th>
                        <th id="th-seen-first" class="py-3 px-4">Mulai Aktif</th>
                        <th id="th-seen-last" class="py-3 px-4">Terakhir Aktif</th>
                        <th class="py-3 px-4">Durasi Online</th>
                        <th class="py-3 px-4">Durasi Billing</th>
                        <th class="py-3 px-4">Idle (Tanpa Billing)</th>
                        <th class="py-3 px-4 text-center">Tingkat Utilisasi</th>
                    </tr>
                </thead>
```

- [ ] **Step 2: Commit perubahan template HTML**

```bash
git add app/templates/kasir/tabs/uptime.html
git commit -m "ui(uptime): sesuaikan label tabel first seen, last seen, dan idle ke bahasa indonesia"
```

---

### Task 3: Lokalisasi Modul JavaScript Frontend (`uptime/index.js`)

**Files:**
- Modify: `app/static/js/kasir/modules/uptime/index.js:35-51, 120-250`

**Interfaces:**
- Consumes: Data JSON dari `/api/v1/uptime/daily` dan `/api/v1/uptime/range`
- Produces: Rendering tabel dinamis dengan label bahasa Indonesia dan fallback waktu lokal.

- [ ] **Step 1: Perbarui label mode harian dan rentang tanggal di `toggleMode()`**

```javascript
        if (this.mode === 'daily') {
            if (dailyFilter) dailyFilter.classList.remove('hidden');
            if (rangeFilter) rangeFilter.classList.add('hidden');
            if (thSeenFirst) thSeenFirst.textContent = 'Mulai Aktif';
            if (thSeenLast) thSeenLast.textContent = 'Terakhir Aktif';
        } else {
            if (dailyFilter) dailyFilter.classList.add('hidden');
            if (rangeFilter) rangeFilter.classList.remove('hidden');
            if (thSeenFirst) thSeenFirst.textContent = 'Hari Aktif';
            if (thSeenLast) thSeenLast.textContent = 'Rata-rata / Hari';
        }
```

- [ ] **Step 2: Perbarui fallback `formatTimeOnly()` agar menyertakan timezone atau format lokal yang rapi**

```javascript
    formatTimeOnly(isoStr) {
        if (!isoStr) return '-';
        try {
            const d = new Date(isoStr);
            return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '-';
        }
    },
```

- [ ] **Step 3: Commit perubahan JavaScript**

```bash
git add app/static/js/kasir/modules/uptime/index.js
git commit -m "ui(uptime-js): lokalisasi teks dan header modul uptime tracker ke bahasa indonesia modern"
```

---

### Task 4: Verifikasi Menyeluruh (Full Regression Test)

**Files:**
- Test: `tests/`

- [ ] **Step 1: Jalankan seluruh suite pengujian pytest**

Run: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest`
Expected: 100% PASS (seluruh tes berhasil tanpa regresi).

- [ ] **Step 2: Commit ringkasan verifikasi akhir jika ada perubahan**

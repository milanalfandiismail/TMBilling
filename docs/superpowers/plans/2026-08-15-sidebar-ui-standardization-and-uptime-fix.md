# Standardisasi Sidebar, Bahasa Indonesia, UI/UX, Uptime Tracker Fix, dan `/livepc` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menstandardisasi seluruh teks sidebar dan tab kasir ke Bahasa Indonesia/istilah yang ditentukan, menyelaraskan UI/UX tab kasir dengan baseline `Umum & Keamanan`, memperbaiki bug `undefined` nama grup pada Pelacak Statistik PC (Uptime Tracker), memperbaiki kebocoran nama lengkap di `/livepc`, dan memastikan seluruh tampilan responsif di Desktop, Laptop, Tablet, dan Mobile.

**Architecture:** Flask + Jinja2 + Tailwind CSS (Kasir SPA layout). API backend Flask menyediakan data JSON ke client-side JavaScript module per tab. Layout berbasis container responsif dengan Tailwind classes.

**Tech Stack:** Python (Flask, SQLAlchemy), HTML/Jinja2, Tailwind CSS, Vanilla JavaScript.

---

## Global Constraints
- **Sidebar & Tab `Dashboard` TIDAK BOLEH DIUBAH SAMA SEKALI.**
- **Teks Sidebar & UI yang Wajib Digunakan:**
  - `Pemulihan Blackout` / `Blackout Recovery` → `⚡ Pemulihan Mati Lampu`
  - `Pemeriksa Hardware` → `🛡️ Hardware Checker` (dipertahankan karena istilah universal)
  - `Auto Scheduler` → `🤖 Penjadwalan Otomatis`
  - `TV Signage Display` → `📺 Tampilan TV`
  - `Uptime Tracker` / `Uptime tracker` → `🕐 Pelacak Statistik PC`
  - `Server Statistic` → `📊 Statistik Server`
  - `Hardware Monitor` → `🖥️ Monitor Hardware`
  - `Screenshot Monitor` → `📷 Monitor Screenshot`
  - `Remote Control Server` → `📡 Kendali Jarak Jauh Server`
  - `Analytics Owner` → `Analitik Owner`
  - `Plugins & Ekstensi` → `Ekstensi & Plugin`
- **Uptime Tracker Bug Fix:** Nama grup PC tidak boleh `undefined`. Root cause di `PCUptimeLog.to_dict()` yang tidak menyertakan field `grup`.
- **`/livepc` Privacy:** Member hanya menampilkan `username`, Guest menampilkan `Guest`. `nama_lengkap` tidak boleh di-expose.
- **Responsiveness:** Semua halaman terdampak harus mendukung breakpoint Mobile (sm <640px), Tablet (md 768px), Laptop (lg 1024px), dan Desktop (xl/2xl >1280px).

---

### Task 1: Fix Bug Pelacak Statistik PC (Uptime Tracker) Nama Grup `undefined`

**Files:**
- Modify: `app/models/pc/pc_uptime.py:41-69`
- Modify: `app/services/hardware/uptime_service.py:108-120`
- Modify: `app/static/js/kasir/modules/uptime/index.js:160-180, 230-245`

**Root Cause:**
1. `PCUptimeLog.to_dict()` tidak memasukkan atribut `"grup"` sehingga API harian `/api/v1/kasir/uptime/daily` mengembalikan list tanpa key `grup`.
2. Frontend `uptime/index.js` langsung mengakses `item.grup` yang bernilai `undefined` pada mode harian.

- [x] **Step 1: Update `PCUptimeLog.to_dict()` pada model**

Tambahkan field `"grup"` yang mengambil `self.pc.grup.nama if self.pc and self.pc.grup else "reguler"` di `app/models/pc/pc_uptime.py`:

```python
        grup_nama = self.pc.grup.nama if self.pc and self.pc.grup else "reguler"
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
            "first_seen": self.first_seen.isoformat() if self.first_seen else None,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "utilisasi_persen": utilisasi
        }
```

- [x] **Step 2: Tambahkan defense-in-depth di frontend `app/static/js/kasir/modules/uptime/index.js`**

Pastikan jika `item.grup` bernilai falsy/null, ada fallback `item.grup || 'Reguler'` agar tidak pernah muncul `undefined`.

- [x] **Step 3: Update judul tab Uptime Tracker di `app/templates/kasir/tabs/uptime.html`**

Ubah heading di header tab menjadi `Pelacak Statistik PC` (dari `Uptime & PC Utilization Tracker`).

---

### Task 2: Standardisasi Teks Sidebar Menu & Tab Submenu

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html`

- [x] **Step 1: Update teks menu di `sidebar.html`**

Terapkan standardisasi label menu sesuai aturan:
1. `📊 Server Statistic` → `📊 Statistik Server`
2. `🖥️ Hardware Monitor` → `🖥️ Monitor Hardware`
3. `🛡️ Hardware Checker` → `🛡️ Hardware Checker` (tetap)
4. `🕐 Uptime Tracker` → `🕐 Pelacak Statistik PC`
5. `📷 Screenshot Monitor` → `📷 Monitor Screenshot`
6. `⚡ Blackout Recovery` → `⚡ Pemulihan Mati Lampu`
7. `📡 Remote Control Server` → `📡 Kendali Jarak Jauh Server`
8. `📺 TV Signage Display` → `📺 Tampilan TV`
9. `🤖 Auto Scheduler` → `🤖 Penjadwalan Otomatis`
10. `Analytics Owner` → `Analitik Owner`
11. `Plugins & Ekstensi` → `Ekstensi & Plugin`

- [x] **Step 2: Verifikasi Dashboard tidak tersentuh**
Pastikan tombol `Dashboard` tetap original.

---

### Task 3: Privacy Fix `/livepc` (Hanya Tampilkan Username Member)

**Files:**
- Modify: `app/routes/member/member_portal_routes.py:113-125`

- [x] **Step 1: Ubah logika pemilihan `nama_tampil` pada endpoint `public_pc_status`**

Di `app/routes/member/member_portal_routes.py`:
```python
elif s:
    if s.member:
        nama_tampil = s.member.username
    else:
        nama_tampil = "Guest"
```

- [x] **Step 2: Verifikasi DOM & Network**
Pastikan tidak ada pengiriman `nama_lengkap` ke respon JSON endpoint `/pc-status`.

---

### Task 4: Standardisasi Tab `Blackout` (Pemulihan Mati Lampu)

**Files:**
- Modify: `app/templates/kasir/tabs/blackout.html`

- [x] **Step 1: Bungkus dan selaraskan style ke Baseline `Umum & Keamanan`**
- Card container: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6`
- Heading: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider`
- Ubah teks judul: `Pemulihan Mati Lampu`
- Spacing: `space-y-6`
- Sizing filter & buttons responsif di mobile/tablet (`w-full sm:w-auto`).

---

### Task 5: Standardisasi Tab `Hardware Checker`

**Files:**
- Modify: `app/templates/kasir/tabs/hardware_checker.html`

- [x] **Step 1: Selaraskan style dengan baseline `Umum & Keamanan`**
- Card: `rounded` (hapus `rounded-xl` dan `shadow-xl`)
- Heading: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2`
- Teks: `🛡️ Hardware Checker & Audit Keamanan`
- Button refresh: standard baseline secondary button styling.

---

### Task 6: Standardisasi Tab `User`, `MikroTik`, `Plugins`, dan `Settings Subtabs`

**Files:**
- Modify: `app/templates/kasir/tabs/user.html`
- Modify: `app/templates/kasir/tabs/mikrotik.html`
- Modify: `app/templates/kasir/settings/plugins.html`
- Modify: `app/templates/kasir/tabs/settings.html` (Cloudflare Tunnel & Scheduler headers)

- [x] **Step 1: Tab User (`user.html`)**
Bungkus header action dalam card wrapper yang konsisten (`bg-[#111] border border-[#1f1f1f] rounded-xl p-5` sesuai Action Header pattern CRUD).

- [x] **Step 2: Tab MikroTik (`mikrotik.html`)**
Hapus heading h2 terpisah di luar card dan integrasikan judul ke dalam card status integrasi sesuai baseline `Umum & Keamanan`.

- [x] **Step 3: Tab Plugins (`plugins.html`)**
Perbaiki styling tombol upload (`bg-neutral-100 hover:bg-neutral-200 text-black font-bold rounded`) dan sesuaikan heading.

- [x] **Step 4: Sub-tab Settings (`settings.html`)**
Sesuaikan header Cloudflare Tunnel dan Auto Scheduler agar seragam dengan card `Umum & Keamanan`.

---

### Task 7: Audit & Fix Responsiveness (Mobile, Tablet, Laptop, Desktop)

**Files:**
- Review & Modify:
  - `app/templates/kasir/tabs/uptime.html`
  - `app/templates/kasir/tabs/blackout.html`
  - `app/templates/kasir/tabs/mikrotik.html`
  - `app/templates/kasir/tabs/hardware_checker.html`
  - `app/templates/kasir/tabs/screenshot.html`
  - `app/templates/kasir/tabs/analytics.html`
  - `app/templates/public/livepc/index.html`

- [x] **Step 1: Periksa Filter & Action Bars**
Pastikan semua filter bars menggunakan `flex flex-wrap items-center gap-2` atau `flex-col sm:flex-row` agar tidak terpotong (overflow) pada layar HP (<640px).

- [x] **Step 2: Periksa Table Horizontal Scroll**
Pastikan semua container tabel dibungkus dengan `overflow-x-auto scrollbar-thin w-full` dan `min-w-[600px]` pada elemen `table` agar bisa di-scroll horizontal secara smooth di mobile/tablet tanpa merusak parent layout.

- [x] **Step 3: Periksa Grid Layouts**
Pastikan grid KPI cards dan grid screenshot/PC menggunakan responsive grid classes: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`.

- [x] **Step 4: Periksa Typography & Spacing Scale**
Pastikan tidak ada teks yang terlalu besar di mobile dengan menerapkan scale seperti `text-xs lg:text-[22px]` dan `text-[10px] lg:text-base`.

---

### Task 8: Verifikasi Menyeluruh & Testing

**Files:**
- Test backend endpoints
- Test frontend visual & responsiveness

- [x] **Step 1: Run Python syntax & endpoint verification**
Cek syntax seluruh file python yang diubah:
`python -m py_compile app/models/pc/pc_uptime.py app/services/hardware/uptime_service.py app/routes/member/member_portal_routes.py`

- [x] **Step 2: Verifikasi Uptime Tracker `grup` field**
Pastikan respon endpoint `/api/v1/kasir/uptime/daily` dan `/api/v1/kasir/uptime/range` selalu menyertakan string grup valid (bukan `undefined` atau `null`).

- [x] **Step 3: Verifikasi `/pc-status` endpoint**
Pastikan respon untuk member aktif hanya membawa `"nama": "<username>"`.

- [x] **Step 4: Final visual check pada sidebar & tabs**
Pastikan seluruh string sidebar sesuai dengan spec tanpa ada typo atau kata bahasa Inggris yang tertinggal (selain Dashboard dan nama paten).

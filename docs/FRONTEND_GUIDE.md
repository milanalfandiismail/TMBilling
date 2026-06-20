# Frontend Guide — TMBilling Pristine Dark

## Arsitektur JavaScript Modular

```
static/js/kasir/
├── core/
│   ├── api.js        — Fetch wrapper, CSRF auto, error handling
│   ├── utils.js      — formatRupiah(), formatMenit(), escapeHtml()
│   ├── toast.js      — Toast notification component
│   └── modal.js      — Dynamic modal, confirm dialog, show()
├── components/
│   ├── modal-buka.js   — Buka sesi guest flow
│   └── modal-tambah.js — Tambah waktu sesi flow
├── modules/
│   ├── dashboard.js  — PC grid, group tabs, real-time refresh
│   ├── member.js     — Member CRUD, search, pagination
│   ├── paket.js      — Paket CRUD, auto-name suggest
│   ├── pc.js         — PC CRUD, batch registration
│   ├── grup.js       — Grup CRUD, dropdown sync
│   ├── laporan.js    — Report by date/kasir, pagination
│   ├── log.js        — System log viewer, filter, export
│   ├── struk.js      — Transaction history, receipt preview/print
│   ├── monitor.js    — Hardware monitoring table
│   ├── blackout.js   — Blackout detection & recovery
│   ├── user.js       — Staff management (admin only)
│   ├── settings.js   — Auto-shutdown, database backup, timezone, scheduler
│   └── plugins.js    — Plugin Manager
└── app.js            — Router, auth check, tab management, plugin iframe injector
```

## Pola Module Standar

Setiap module mengikuti pola yang konsisten:

```javascript
const Module = {
    // State lokal (jika perlu)
    currentPage: 1,
    searchQuery: '',

    // 1. LOAD — panggil API, render data
    async load() {
        const data = await API.module.list();
        this.render(data);
    },

    // 2. RENDER — generate HTML, inject ke DOM
    render(items) {
        const container = document.getElementById('container-id');
        if (!items.length) {
            container.innerHTML = `<p class="text-sm text-slate-500">Kosong</p>`;
            return;
        }
        container.innerHTML = items.map(item => `
            <div class="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <span class="text-slate-200">${item.nama}</span>
            </div>
        `).join('');
    },

    // 3. CRUD — add, edit, delete
    async add() {
        const data = { nama: input.value };
        await API.module.create(data);
        Toast.success('Berhasil');
        this.load();
    },

    async delete(id) {
        Modal.confirm('Yakin hapus?', async () => {
            await API.module.delete(id);
            this.load();
        });
    }
};
```

## Design Tokens (Pristine Dark)

| Token | Kelas Tailwind | Nilai |
|-------|---------------|-------|
| **Background** | `bg-slate-950` | #020617 |
| **Card** | `bg-slate-900 border border-slate-800` | #0f172a |
| **Card hover** | `hover:bg-slate-800` | #1e293b |
| **Input** | `bg-slate-800 border border-slate-700` | #1e293b / #334155 |
| **Sidebar** | `bg-slate-900 border-r border-slate-800` | #0f172a |
| **Primary** | `indigo-600` hover `indigo-500` | #4f46e5 |
| **Success** | `emerald-600` hover `emerald-500` | #059669 |
| **Danger** | `red-600` hover `red-500` | #dc2626 |
| **Warning** | `amber-600` hover `amber-500` | #d97706 |
| **Text** | `text-slate-200` | #e2e8f0 |
| **Text muted** | `text-slate-500` | #64748b |
| **Border** | `border-slate-800` | #1e293b |
| **Border hover** | `border-indigo-500` | #6366f1 |

## Radius & Shadow

| Elemen | Kelas |
|--------|-------|
| Card | `rounded-xl` (12px) |
| Button | `rounded-lg` (8px) |
| Input | `rounded-lg` (8px) |
| Modal | `rounded-xl` (12px) |
| Shadow card | `shadow-lg` |
| Shadow modal | `shadow-2xl` |

## Layout Dashboard

```
┌─────────┬────────────────────────────────────────┐
│ Sidebar │ Header (judul, jam)                    │
│  w-64   ├────────────────────────────────────────┤
│ bg-900  │ Content (scroll area)                  │
│         │ ┌────────────────────────────────────┐ │
│         │ │ Group tabs: SEMUA | TM             │ │
│         │ ├────────────────────────────────────┤ │
│         │ │ PC Grid (8-12 kolom)               │ │
│         │ │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │ │
│         │ │ │PC-01│ │PC-02│ │PC-03│ │PC-04│ │ │
│         │ │ │Kosng│ │Aktif│ │Offln│ │Aktif│ │ │
│         │ │ │BUKA │ │45m  │ │BUKA │ │120m │ │ │
│         │ │ └─────┘ └─────┘ └─────┘ └─────┘ │ │
│         │ └────────────────────────────────────┘ │
│         │                                        │
│         └────────────────────────────────────────┘
└─────────┴────────────────────────────────────────┘

### Tab Khusus: Plugin SPA

Jika plugin memiliki UI, kasir akan merender konten plugin di dalam sebuah `<iframe id="plugin-spa-iframe">` yang mengambil alih area konten. Iframe menjamin CSS/JS plugin tidak bertabrakan dengan CSS Tailwind utama.
```

## State PC Card

| Status | Border | Dot | Content |
|--------|--------|-----|---------|
| **Kosong & Online** | `border-slate-700` | `bg-slate-400` | Tombol BUKA SESI |
| **Kosong & Offline** | `border-slate-700` | `bg-slate-700` | Label "Offline" |
| **Terpakai** (aktif) | `border-emerald-800` | `bg-emerald-500` | Sisa waktu + nama |
| **Admin** | `border-indigo-800` | `bg-indigo-400` | Label "Admin" |

## API Client Pattern

```javascript
const API = {
    async request(url, options = {}) {
        const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content');

        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            credentials: 'include'
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    }
};
```

## Error Handling Frontend

```javascript
try {
    const data = await API.module.action();
    this.render(data);
} catch (err) {
    Toast.error(err.message);  // Notifikasi error
    // Atau: show error di container
    container.innerHTML = `<div class="text-red-400">${err.message}</div>`;
}
```

## CSS Rules

- **Hanya** Tailwind utility classes
- Tanpa custom CSS file (`kasir.css` hanya berisi komentar)
- Font: Inter (body), JetBrains Mono (kode/angka)
- No glassmorphism, no blur, no gradient decorations

## Print Receipt (Thermal 58mm)

Struk dicetak via iframe tersembunyi dengan CSS:
```css
@page { margin: 0; }
body {
    font-family: 'Courier New', monospace;
    width: 58mm;
    font-size: 11px;
}
```

## 🔊 Client Asynchronous Audio Alert System

Untuk meminimalkan gangguan pada pemain (mencegah game kehilangan fokus layar penuh atau melepaskan tangkapan kursor mouse), sistem alarm peringatan sisa waktu 5 menit didesain secara asinkron menggunakan HTML5 Audio API:
* **Audio File**: `/assets/sounds/warning_5min.mp3` (Kompresi MP3 ultra-ringan, berukuran kurang dari 50 KB).
* **Mekanisme Eksekusi**:
  * Pemicu berbasis evaluasi data polling lokal (`app.js`).
  * Dimainkan secara non-blocking di latar belakang melalui objek JavaScript `Audio`:
    ```javascript
    const warningAudio = new Audio('./assets/sounds/warning_5min.mp3');
    warningAudio.play().catch(err => console.log("Audio play blocked: ", err));
    ```
  * Menghindari penggunaan pemutar audio bawaan sistem operasi pihak ketiga (seperti `powershell` atau API Windows native yang memblokir keyboard/mouse hook secara sinkron).

---
*TMBilling v1.0 — Frontend Guide*

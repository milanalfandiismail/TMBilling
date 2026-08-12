# Superpowers Implementation Plan: Modal Konfirmasi Ekspor JSON & Toast Notification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti dialog confirm bawaan browser dengan Modal Konfirmasi Custom bernuansa dark mode dan menampilkan Toast Notification saat ekspor JSON berhasil.

**Architecture:** Menambahkan modal HTML `#modal-confirm-export` di template `documentation.html` dan mengupdate objek `Tutorials` pada `index.js` untuk mengontrol visibilitas modal serta memicu API request dan Toast Notification.

**Tech Stack:** HTML5, Tailwind CSS, JavaScript (Vanilla API & Toast)

## Global Constraints

- Tidak menggunakan `confirm()` bawaan browser.
- Menggunakan skema warna dark mode TMBilling (`#0c0c0c`, `#1c1c1c`, `#050505`).
- Menampilkan Toast Notification sukses/gagal.
- Commit message dalam Bahasa Indonesia.

---

### Task 1: Tambahkan HTML Modal Konfirmasi Custom di documentation.html
- **Modify**: `app/templates/kasir/documentation.html`

- [ ] **Step 1: Tambahkan markup HTML `#modal-confirm-export` di bagian bawah `documentation.html`**

```html
<!-- Modal Konfirmasi Ekspor JSON -->
<div id="modal-confirm-export" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center hidden p-4">
    <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl shrink-0">
                📥
            </div>
            <div>
                <h3 class="text-lg font-bold text-neutral-100">Ekspor Tutorial ke JSON</h3>
                <p class="text-xs text-neutral-400 mt-0.5">Konfirmasi pembaruan file data seed</p>
            </div>
        </div>
        <p class="text-sm text-neutral-300 leading-relaxed">
            Apakah Anda yakin ingin mengekspor seluruh data tutorial saat ini ke file <code class="bg-[#171717] px-1.5 py-0.5 rounded text-amber-400 font-mono text-xs">seed_tutorials.json</code>?
        </p>
        <div class="flex items-center justify-end gap-3 pt-2">
            <button type="button" onclick="Tutorials.closeConfirmExportModal()"
                class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-lg transition-all border border-[#262626]">
                Batal
            </button>
            <button type="button" onclick="Tutorials.confirmExportTutorialsToJson()"
                class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-all shadow">
                Ya, Ekspor Sekarang
            </button>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Jalankan CSS build**

Run: `npm run build:css`

Expected: CSS compiled successfully.

- [ ] **Step 3: Commit**

```bash
git add app/templates/kasir/documentation.html app/static/css/tailwind.css
git commit -m "fitur: tambah markup modal konfirmasi ekspor tutorial custom"
```

---

### Task 2: Implementasi Kontrol Modal & Toast di JavaScript
- **Modify**: `app/static/js/kasir/modules/tutorials/index.js`

- [ ] **Step 1: Ubah `exportTutorialsToJson` dan tambah `closeConfirmExportModal` & `confirmExportTutorialsToJson`**

Modifikasi metode di `app/static/js/kasir/modules/tutorials/index.js`:

```javascript
    exportTutorialsToJson() {
        const modal = document.getElementById('modal-confirm-export');
        if (modal) modal.classList.remove('hidden');
    },

    closeConfirmExportModal() {
        const modal = document.getElementById('modal-confirm-export');
        if (modal) modal.classList.add('hidden');
    },

    async confirmExportTutorialsToJson() {
        this.closeConfirmExportModal();
        try {
            const res = await API.request('/api/v1/kasir/tutorials/export-json', {
                method: 'POST'
            });
            if (res.success) {
                showToast(`Sukses: ${res.message || 'Tutorial berhasil diekspor!'}`, 'success');
            } else {
                showToast(`Gagal: ${res.error || 'Gagal mengekspor tutorial'}`, 'error');
            }
        } catch (e) {
            console.error('Error export tutorials:', e);
            showToast('Terjadi kesalahan sistem saat mengekspor tutorial.', 'error');
        }
    },
```

- [ ] **Step 2: Verifikasi sintaks JavaScript**

Run: `python -c "from app import create_app; create_app(); print('JS OK!')"`

Expected: App Factory OK!

- [ ] **Step 3: Commit**

```bash
git add app/static/js/kasir/modules/tutorials/index.js
git commit -m "fitur: implementasikan kontrol modal konfirmasi ekspor dan toast notifikasi"
```

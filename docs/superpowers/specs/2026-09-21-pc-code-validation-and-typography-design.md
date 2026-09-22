# PC Code Validation and Dynamic Typography Spec

## 1. Overview
Berdasarkan kebutuhan untuk mendukung penamaan PC hingga ribuan unit (misalnya `VVIP-2000`, `SULT-2000`, `PC-1000`) sekaligus menjaga agar layout kartu PC di dashboard tetap rapi dan tidak terpotong (truncate) di seluruh breakpoint (`LG`, `XL`, `2XL`, Mobile):
* Batas maksimal panjang Kode PC ditetapkan **10 karakter**.
* Validasi ketat diterapkan di **Backend (Service/API)** dan **Frontend (Modal & Controller)**.
* Tipografi kode PC di dashboard compact card dibuat adaptif menyesuaikan panjang string.

## 2. Requirements & Constraints
1. **Panjang Kode PC**:
   - Maksimal 10 karakter (mendukung prefix hingga 5-6 huruf + dash + 4 digit angka, misal `VVIP-2000`, `SULT-9999`).
2. **Karakter yang Diperbolehkan**:
   - Alphanumeric (`A-Z`, `a-z`, `0-9`), tanda hubung (`-`), dan garis bawah (`_`).
   - Disimpan dalam huruf kapital (uppercase) secara konsisten.
3. **Validasi Ketat**:
   - Backend: Rejection dengan error `400 Bad Request` jika panjang > 10 karakter atau format tidak valid.
   - Frontend: Atribut `maxlength="10"` pada input form dan peringatan Toast sebelum request dikirim.
   - Batch Creation: Validasi prefix (maks 6 karakter) serta hasil kombinasi `prefix + end_num` tidak boleh melebihi 10 karakter.
4. **Adaptasi Visual Dashboard Card**:
   - Jika `pc.kode.length > 7`, gunakan ukuran font `text-xs lg:text-sm xl:text-base`.
   - Jika `pc.kode.length <= 7`, gunakan ukuran font standar `text-sm lg:text-base xl:text-lg`.
   - Menghindari teks ter-truncate atau merusak badge centang `✓` dan dot status.

## 3. Architecture & Affected Files
- `app/services/pc/pc_service.py`:
  - `create()`: Validasi `len(kode) <= 10` & regex format.
  - `update()`: Validasi `len(kode_baru) <= 10` & regex format.
  - `create_batch()`: Validasi `len(prefix) <= 6` dan `len(f"{prefix}{end_num}") <= 10`.
- `app/static/js/kasir/modules/pc/pc_modal.js`:
  - Atribut `maxlength="10"` pada `#modal-pc-kode` dan `#edit-pc-kode`.
  - Atribut `maxlength="6"` pada `#modal-batch-prefix`.
- `app/static/js/kasir/modules/pc/index.js`:
  - Client-side validation di `PC.add()`, `PC.doEdit()`, dan `PC.addBatch()`.
- `app/static/js/kasir/modules/dashboard/dashboard_compact.js`:
  - Dynamic font size class `kodeFontSizeClass` pada `renderCompactCard()`.
- `tests/test_pc_validation.py`:
  - Automated tests untuk skenario validasi single dan batch PC.

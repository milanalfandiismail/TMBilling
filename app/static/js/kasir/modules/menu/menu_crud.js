/**
 * Menu CRUD & Image Cropper Sub-module
 * Menangani form tambah/edit menu, canvas cropper 4:3, penghapusan, dan lightbox preview.
 */
window.MenuCrud = {
    cropperState: {
        image: null,
        zoom: 1.0,
        panX: 0,
        panY: 0,
        isDragging: false,
        startX: 0,
        startY: 0,
        isImageModified: false,
        existingImageUrl: null
    },
    _cropperEventsBound: false,

    toggleStokUnlimited(checked) {
        const stokInput = document.getElementById("menu-stok-input");
        if (!stokInput) return;
        if (checked) {
            stokInput.value = "";
            stokInput.disabled = true;
            stokInput.required = false;
            stokInput.placeholder = "Unlimited (\u221E)";
        } else {
            stokInput.disabled = false;
            stokInput.required = true;
            stokInput.placeholder = "Contoh: 50";
        }
    },

    // =========================================================================
    // CANVAS IMAGE CROPPER & ZOOM (4:3 RATIO)
    // =========================================================================

    setupCropperEvents() {
        if (this._cropperEventsBound) return;
        const viewport = document.getElementById('menu-cropper-viewport-container');
        if (!viewport) return;

        const onStart = (e) => {
            if (!this.cropperState.image) return;
            this.cropperState.isDragging = true;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this.cropperState.startX = clientX - this.cropperState.panX;
            this.cropperState.startY = clientY - this.cropperState.panY;
        };

        const onMove = (e) => {
            if (!this.cropperState.isDragging || !this.cropperState.image) return;
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this.cropperState.panX = clientX - this.cropperState.startX;
            this.cropperState.panY = clientY - this.cropperState.startY;
            this.cropperState.isImageModified = true;
            this.renderCropperCanvas();
        };

        const onEnd = () => {
            this.cropperState.isDragging = false;
        };

        viewport.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);

        viewport.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);

        this._cropperEventsBound = true;
    },

    handleFileSelect(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.cropperState.image = img;
                this.cropperState.zoom = 1.0;
                this.cropperState.panX = 0;
                this.cropperState.panY = 0;
                this.cropperState.isImageModified = true;

                const zoomSlider = document.getElementById('menu-cropper-zoom-slider');
                if (zoomSlider) zoomSlider.value = 1;
                const zoomText = document.getElementById('menu-zoom-level-text');
                if (zoomText) zoomText.textContent = '1.0x';

                this.renderCropperCanvas();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    handleZoomChange(val) {
        this.cropperState.zoom = parseFloat(val);
        this.cropperState.isImageModified = true;
        const zoomText = document.getElementById('menu-zoom-level-text');
        if (zoomText) zoomText.textContent = `${this.cropperState.zoom.toFixed(1)}x`;
        this.renderCropperCanvas();
    },

    clearImageState() {
        const fileInput = document.getElementById('menu-gambar-input');
        if (fileInput) fileInput.value = '';

        this.cropperState.image = null;
        this.cropperState.zoom = 1.0;
        this.cropperState.panX = 0;
        this.cropperState.panY = 0;
        this.cropperState.isImageModified = true;
        this.cropperState.existingImageUrl = null;

        const zoomSlider = document.getElementById('menu-cropper-zoom-slider');
        if (zoomSlider) zoomSlider.value = 1;
        const zoomText = document.getElementById('menu-zoom-level-text');
        if (zoomText) zoomText.textContent = '1.0x';

        this.renderCropperCanvas();
    },

    renderCropperCanvas() {
        const canvas = document.getElementById('menu-cropper-canvas');
        const placeholder = document.getElementById('menu-cropper-placeholder');
        const guide = document.getElementById('menu-cropper-guide');
        const resetBtn = document.getElementById('menu-btn-reset-image');
        const previewBtn = document.getElementById('menu-btn-preview-modal');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const cw = canvas.width;  // 400
        const ch = canvas.height; // 300

        ctx.clearRect(0, 0, cw, ch);

        if (!this.cropperState.image) {
            if (placeholder) placeholder.classList.remove('hidden');
            if (guide) guide.classList.add('hidden');
            if (resetBtn) resetBtn.classList.add('hidden');
            if (previewBtn) previewBtn.classList.add('hidden');
            return;
        }

        if (placeholder) placeholder.classList.add('hidden');
        if (guide) guide.classList.remove('hidden');
        if (resetBtn) resetBtn.classList.remove('hidden');
        if (previewBtn) previewBtn.classList.remove('hidden');

        const img = this.cropperState.image;

        // Calculate base cover scaling (4:3 ratio)
        const scale = Math.max(cw / img.width, ch / img.height) * this.cropperState.zoom;
        const nw = img.width * scale;
        const nh = img.height * scale;

        const cx = (cw - nw) / 2 + this.cropperState.panX;
        const cy = (ch - nh) / 2 + this.cropperState.panY;

        ctx.fillStyle = "#050505";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, cx, cy, nw, nh);
    },

    async getCroppedBlob() {
        const canvas = document.getElementById('menu-cropper-canvas');
        if (!canvas || !this.cropperState.image) return null;

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.90);
        });
    },

    // =========================================================================
    // CRUD MODAL & FORM METHODS
    // =========================================================================

    toggleStokUnlimited(checked) {
        const stokInput = document.getElementById("menu-stok-input");
        if (!stokInput) return;
        if (checked) {
            stokInput.value = "";
            stokInput.disabled = true;
            stokInput.required = false;
            stokInput.placeholder = "Unlimited (\u221E)";
        } else {
            stokInput.disabled = false;
            stokInput.required = true;
            stokInput.placeholder = "Contoh: 50";
        }
    },

    showAddModal() {
        if (window.App && App.user && App.user.role === 'kasir') {
            Toast.error("Akses terbatas hanya untuk Administrator");
            return;
        }
        const modal = document.getElementById("menu-modal");
        const title = document.getElementById("menu-modal-title");
        const form = document.getElementById("menu-form");
        if (!modal || !title || !form) return;

        this.setupCropperEvents();
        form.reset();
        document.getElementById("menu-id-input").value = "";
        this.clearImageState();
        this.cropperState.isImageModified = false;
        title.textContent = "Tambah Item Baru";
        
        // Reset checkbox unlimited
        const cb = document.getElementById("menu-stok-unlimited");
        if (cb) cb.checked = false;
        const stokInput = document.getElementById("menu-stok-input");
        if (stokInput) {
            stokInput.disabled = false;
            stokInput.required = true;
            stokInput.placeholder = "50";
        }
        modal.classList.remove("hidden");
    },

    showEditModal(menuId) {
        event?.stopPropagation();
        if (window.App && App.user && App.user.role === 'kasir') {
            Toast.error("Akses terbatas hanya untuk Administrator");
            return;
        }
        const menu = this.items.find(m => m.id === menuId) || this.archivedItems.find(m => m.id === menuId);
        if (!menu) return;

        const modal = document.getElementById("menu-modal");
        const title = document.getElementById("menu-modal-title");
        if (!modal || !title) return;

        this.setupCropperEvents();
        document.getElementById("menu-id-input").value = menu.id;
        document.getElementById("menu-nama-input").value = menu.nama;
        document.getElementById("menu-harga-input").value = Utils.formatRawRupiah(menu.harga);

        // Preview / Canvas Cropper state for existing image
        const fileInput = document.getElementById("menu-gambar-input");
        if (fileInput) fileInput.value = "";
        
        this.cropperState.zoom = 1.0;
        this.cropperState.panX = 0;
        this.cropperState.panY = 0;
        this.cropperState.isImageModified = false;

        const zoomSlider = document.getElementById('menu-cropper-zoom-slider');
        if (zoomSlider) zoomSlider.value = 1;
        const zoomText = document.getElementById('menu-zoom-level-text');
        if (zoomText) zoomText.textContent = '1.0x';

        const resolvedImg = menu.gambar_path && window.API ? API.resolveMediaUrl(menu.gambar_path) : (menu.gambar_path || '');
        if (resolvedImg) {
            this.cropperState.existingImageUrl = resolvedImg;
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                this.cropperState.image = img;
                this.cropperState.isImageModified = false;
                this.renderCropperCanvas();
            };
            img.onerror = () => {
                this.renderCropperCanvas();
            };
            img.src = resolvedImg;
        } else {
            this.clearImageState();
        }

        const cb = document.getElementById("menu-stok-unlimited");
        const stokInput = document.getElementById("menu-stok-input");
        if (menu.stok < 0) {
            if (cb) cb.checked = true;
            if (stokInput) {
                stokInput.value = "";
                stokInput.disabled = true;
                stokInput.required = false;
                stokInput.placeholder = "Unlimited (\u221E)";
            }
        } else {
            if (cb) cb.checked = false;
            if (stokInput) {
                stokInput.value = menu.stok;
                stokInput.disabled = false;
                stokInput.required = true;
                stokInput.placeholder = "50";
            }
        }

        title.textContent = "Edit Item Menu";
        modal.classList.remove("hidden");
    },

    closeModal() {
        const modal = document.getElementById("menu-modal");
        if (modal) modal.classList.add("hidden");
    },

    async submitForm(event) {
        event.preventDefault();

        const menuId = document.getElementById("menu-id-input").value;
        const nama = document.getElementById("menu-nama-input").value.trim();
        const hargaRaw = document.getElementById("menu-harga-input").value;
        const harga = hargaRaw.replace(/\./g, '');
        const saveBtn = document.getElementById("menu-btn-save");

        // Checkbox unlimited
        const cb = document.getElementById("menu-stok-unlimited");
        const stok = (cb && cb.checked) ? "-1" : (document.getElementById("menu-stok-input").value || "0");

        if (!nama) {
            Toast.error("Nama menu tidak boleh kosong!");
            return;
        }
        if (nama.length < 2 || nama.length > 100) {
            Toast.error("Nama menu harus 2 - 100 karakter!");
            return;
        }
        if (!harga || isNaN(Number(harga)) || Number(harga) < 0 || Number(harga) > 1000000000) {
            Toast.error("Harga harus antara Rp0 - Rp1.000.000.000!");
            return;
        }
        if (stok !== "-1" && (isNaN(Number(stok)) || Number(stok) < 0 || Number(stok) > 1000000)) {
            Toast.error("Stok harus antara 0 - 1.000.000!");
            return;
        }

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="animate-spin inline-block mr-1">↻</span> Menyimpan...';
        }

        try {
            const formData = new FormData();
            formData.append("nama", nama);
            formData.append("harga", harga);
            formData.append("stok", stok);

            // Handle Cropped Image Blob or Hapus Gambar
            if (this.cropperState.isImageModified && this.cropperState.image) {
                const blob = await this.getCroppedBlob();
                if (blob) {
                    formData.append("gambar", blob, "menu_cover.jpg");
                }
            } else if (this.cropperState.isImageModified && !this.cropperState.image) {
                formData.append("hapus_gambar", "true");
            }

            let res;
            if (menuId) {
                res = await window.API.menu.update(menuId, formData);
            } else {
                res = await window.API.menu.create(formData);
            }

            if (res.success) {
                Toast.success(res.message || "Menu berhasil disimpan");
                this.closeModal();
                await this.loadCatalog();
            } else {
                Toast.error(res.error || "Gagal menyimpan menu");
            }
        } catch (error) {
            console.error('[MenuModule] Error submitForm:', error);
            Toast.error("Gagal menyimpan menu: " + (error.message || "terjadi kesalahan"));
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = "Simpan";
            }
        }
    },

    async deleteItem(menuId, nama) {
        event.stopPropagation(); // Mencegah klik di card
        if (window.App && App.user && App.user.role === 'kasir') {
            Toast.error("Akses terbatas hanya untuk Administrator");
            return;
        }
        if (!confirm(`Apakah Anda yakin ingin mengarsipkan menu '${nama}' dari katalog aktif?\n\nMenu akan dipindahkan ke tab 'Arsip Menu' dan dapat dipulihkan kembali kapan saja.`)) {
            return;
        }

        try {
            const res = await window.API.menu.delete(menuId);
            if (res.success) {
                Toast.success(res.message || `Menu '${nama}' berhasil dipindahkan ke arsip`);
                await this.loadCatalog();
                // Hapus dari keranjang jika ada
                this.removeFromCart(menuId);
            } else {
                Toast.error(res.error || "Gagal mengarsipkan menu");
            }
        } catch (error) {
            Toast.error("Gagal mengarsipkan menu: error koneksi");
        }
    },

    async hardDeleteItem(menuId, nama) {
        event.stopPropagation();
        if (window.App && App.user && App.user.role === 'kasir') {
            Toast.error("Akses terbatas hanya untuk Administrator");
            return;
        }
        const warning = `PERINGATAN KERAS!\n\nAnda akan menghapus menu '${nama}' BESERTA SELURUH transaksi penjualan terkait secara permanen.\n\nData F&B historis untuk menu ini akan HILANG TOTAL dan tidak dapat dipulihkan. Lanjutkan?`;
        if (!confirm(warning)) {
            return;
        }
        // Konfirmasi kedua agar tidak terjadi kecelakaan klik
        if (!confirm("Konfirmasi terakhir: hapus permanen menu + semua transaksinya?")) {
            return;
        }

        try {
            const res = await window.API.menu.deletePermanent(menuId);
            if (res.success) {
                Toast.success(res.message || "Menu dihapus permanen");
                await this.loadCatalog();
                this.removeFromCart(menuId);
            } else {
                Toast.error(res.error || "Gagal menghapus permanen");
            }
        } catch (error) {
            Toast.error("Gagal menghapus permanen: error koneksi");
        }
    },

    // =========================================================================
    // LIGHTBOX FULLSCREEN PREVIEW
    // =========================================================================
    previewFromModal() {
        const canvas = document.getElementById('menu-cropper-canvas');
        if (!canvas || !this.cropperState.image) return;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const rawNama = document.getElementById('menu-nama-input')?.value?.trim();
        const nama = rawNama || "Preview Makanan / Minuman";
        const hargaRaw = document.getElementById('menu-harga-input')?.value;
        const hargaFormatted = hargaRaw ? `Rp${hargaRaw}` : "";
        this.openLightbox(dataUrl, nama, hargaFormatted);
    },

    openLightbox(imgUrl, nama, harga) {
        event?.stopPropagation();
        const modal = document.getElementById("menu-lightbox-modal");
        const img = document.getElementById("menu-lightbox-img");
        const title = document.getElementById("menu-lightbox-title");
        const price = document.getElementById("menu-lightbox-price");
        if (!modal || !img) return;

        img.src = imgUrl;
        if (title) title.textContent = nama || "Foto Produk";
        if (price) price.textContent = harga || "";

        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        if (!this._lightboxEscBound) {
            this._lightboxEscBound = true;
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape" && !modal.classList.contains("hidden")) {
                    this.closeLightbox();
                }
            });
        }
    },

    closeLightbox() {
        const modal = document.getElementById("menu-lightbox-modal");
        if (modal) {
            modal.classList.add("hidden");
            const img = document.getElementById("menu-lightbox-img");
            if (img) img.src = "";
            document.body.style.overflow = "";
        }
    }

};

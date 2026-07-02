// app/static/js/kasir/modules/menu/index.js

const Menu = {
    items: [],
    cart: [], // Array of { menu: MenuItem, jumlah: number }

    async load() {
        try {
            await this.loadCatalog();
        } catch (error) {
            console.error("Gagal inisialisasi modul menu:", error);
        }
    },

    async loadCatalog() {
        const grid = document.getElementById("menu-catalog-grid");
        if (!grid) return;

        try {
            const res = await window.API.menu.list();
            if (res.success) {
                this.items = res.data;
                this.renderCatalog(this.items);
            } else {
                Toast.error(res.error || "Gagal memuat katalog menu");
            }
        } catch (error) {
            Toast.error("Koneksi gagal memuat katalog menu");
            grid.innerHTML = `<div class="col-span-full text-center py-20 text-red-400 text-xs lg:text-base font-semibold">Gagal memuat data menu.</div>`;
        }
    },



    renderCatalog(data) {
        const grid = document.getElementById("menu-catalog-grid");
        if (!grid) return;

        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-20 text-neutral-500">
                    <p class="text-xs lg:text-base font-bold">Belum ada menu di katalog</p>
                    <p class="text-[10px] lg:text-base text-neutral-600 mt-1">Klik 'Tambah Menu' untuk membuat makanan/minuman baru</p>
                </div>`;
            return;
        }

        grid.innerHTML = data.map(m => {
            const isUnlimited = m.stok < 0;
            const isOutOfStock = !isUnlimited && m.stok <= 0;
            const imgHtml = m.gambar_path 
                ? `<img src="${m.gambar_path}" alt="${m.nama}" class="w-full h-24 object-cover rounded-lg border border-neutral-800 bg-[#0c0c0c]">`
                : `<div class="w-full h-24 rounded-lg border border-neutral-800 bg-[#080808] flex items-center justify-center text-neutral-600">
                     <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path>
                     </svg>
                   </div>`;

            const btnHtml = isOutOfStock
                ? `<button disabled class="w-full py-1.5 rounded bg-neutral-900 border border-neutral-800 text-[10px] lg:text-base text-neutral-600 font-bold uppercase cursor-not-allowed">Stok Habis</button>`
                : `<button onclick="Menu.addToCart(${m.id})" class="w-full py-1.5 rounded bg-neutral-100 hover:bg-white text-[#050505] text-[10px] lg:text-base font-bold uppercase transition-colors">Tambah</button>`;

            const stokText = isUnlimited ? 'Unlimited' : `Stok: ${m.stok}`;
            const stokColor = isUnlimited ? 'text-green-500 font-bold' : (m.stok < 5 ? 'text-amber-500 font-bold' : 'text-neutral-500');

            return `
                <div class="bg-[#0c0c0c] border border-neutral-800 hover:border-neutral-700 transition-all rounded-xl p-3 flex flex-col justify-between group relative">
                    <!-- CRUD Quick Actions -->
                    <div class="absolute top-2.5 right-2.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${(window.App && App.user && App.user.role === 'kasir') ? '' : `
                        <button onclick="Menu.showEditModal(${m.id})" class="p-1 rounded bg-black/60 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700 transition-colors" title="Edit Menu">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onclick="Menu.deleteItem(${m.id}, '${m.nama}')" class="p-1 rounded bg-black/60 hover:bg-red-950 text-neutral-400 hover:text-red-400 border border-neutral-700 hover:border-red-900 transition-colors" title="Hapus Menu">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                        <button onclick="Menu.hardDeleteItem(${m.id}, '${m.nama}')" class="p-1 rounded bg-black/60 hover:bg-red-700 text-neutral-400 hover:text-white border border-neutral-700 hover:border-red-600 transition-colors" title="Hapus Permanen (beserta semua transaksi)">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"></path></svg>
                        </button>`}
                    </div>

                    <div class="space-y-2.5">
                        ${imgHtml}
                        <div>
                            <h4 class="text-xs lg:text-base font-bold text-neutral-100 truncate">${m.nama}</h4>
                            <div class="flex items-center justify-between mt-1">
                                <span class="text-xs lg:text-base text-neutral-300 font-bold font-mono">${Utils.formatRupiah(m.harga)}</span>
                                <span class="text-[9px] lg:text-base ${stokColor} font-mono">${stokText}</span>
                            </div>
                        </div>
                    </div>
                    <div class="mt-3">
                        ${btnHtml}
                    </div>
                </div>`;
        }).join('');
    },

    filterCatalog() {
        const query = document.getElementById("menu-search-input")?.value?.toLowerCase() || "";
        const filtered = this.items.filter(m => m.nama.toLowerCase().includes(query));
        this.renderCatalog(filtered);
    },

    addToCart(menuId) {
        const menu = this.items.find(m => m.id === menuId);
        if (!menu) return;

        const cartItem = this.cart.find(c => c.menu.id === menuId);
        if (cartItem) {
            const isUnlimited = menu.stok < 0;
            if (!isUnlimited && cartItem.jumlah >= menu.stok) {
                Toast.error(`Stok '${menu.nama}' tidak mencukupi untuk ditambah lagi`);
                return;
            }
            cartItem.jumlah++;
        } else {
            this.cart.push({ menu, jumlah: 1 });
        }

        Toast.success(`'${menu.nama}' dimasukkan ke keranjang`);
        this.renderCart();
    },

    removeFromCart(menuId) {
        this.cart = this.cart.filter(c => c.menu.id !== menuId);
        this.renderCart();
    },

    updateCartQty(menuId, newQty) {
        const cartItem = this.cart.find(c => c.menu.id === menuId);
        if (!cartItem) return;

        newQty = parseInt(newQty) || 0;
        if (newQty <= 0) {
            this.removeFromCart(menuId);
            return;
        }

        const isUnlimited = cartItem.menu.stok < 0;
        if (!isUnlimited && newQty > cartItem.menu.stok) {
            Toast.error(`Stok '${cartItem.menu.nama}' hanya tersedia ${cartItem.menu.stok}`);
            cartItem.jumlah = cartItem.menu.stok;
        } else {
            cartItem.jumlah = newQty;
        }

        this.renderCart();
    },

    renderCart() {
        const container = document.getElementById("menu-cart-items");
        const totalEl = document.getElementById("menu-cart-total");
        if (!container || !totalEl) return;

        if (this.cart.length === 0) {
            container.innerHTML = `<div class="text-center py-10 text-neutral-600 text-xs lg:text-base">Keranjang masih kosong</div>`;
            totalEl.textContent = "Rp0";
            return;
        }

        let total = 0;
        container.innerHTML = this.cart.map(c => {
            const itemTotal = c.menu.harga * c.jumlah;
            total += itemTotal;

            return `
                <div class="flex items-center justify-between gap-3 bg-[#0a0a0a] border border-neutral-800 rounded-lg p-2.5">
                    <div class="min-w-0 flex-1">
                        <h5 class="text-xs lg:text-base font-bold text-neutral-200 truncate">${c.menu.nama}</h5>
                        <span class="text-[10px] lg:text-base text-neutral-500 font-mono">${Utils.formatRupiah(c.menu.harga)}</span>
                    </div>
                    
                    <div class="flex items-center gap-1 shrink-0">
                        <button onclick="Menu.updateCartQty(${c.menu.id}, ${c.jumlah - 1})" 
                            class="w-5 h-5 bg-[#161616] hover:bg-[#222] border border-[#262626] rounded flex items-center justify-center text-xs lg:text-base font-bold text-neutral-400 hover:text-white transition-colors">-</button>
                        <input type="number" value="${c.jumlah}" 
                            onchange="Menu.updateCartQty(${c.menu.id}, this.value)"
                            class="w-8 text-center text-xs lg:text-base font-mono font-bold py-0.5 bg-black border border-[#262626] rounded focus:outline-none">
                        <button onclick="Menu.updateCartQty(${c.menu.id}, ${c.jumlah + 1})" 
                            class="w-5 h-5 bg-[#161616] hover:bg-[#222] border border-[#262626] rounded flex items-center justify-center text-xs lg:text-base font-bold text-neutral-400 hover:text-white transition-colors">+</button>
                    </div>

                    <div class="text-right shrink-0">
                        <div class="text-xs lg:text-base font-mono font-bold text-neutral-200">${Utils.formatRupiah(itemTotal)}</div>
                        <button onclick="Menu.removeFromCart(${c.menu.id})" class="text-[9px] lg:text-base text-red-500 hover:text-red-400 font-semibold mt-0.5">Hapus</button>
                    </div>
                </div>`;
        }).join('');

        totalEl.textContent = Utils.formatRupiah(total);
    },

    async checkout() {
        if (this.cart.length === 0) {
            Toast.error("Keranjang belanja kosong!");
            return;
        }

        const pcSelect = document.getElementById("menu-order-pc-select");
        const pcKode = pcSelect?.value || null;

        let total = 0;
        this.cart.forEach(c => { total += c.menu.harga * c.jumlah; });
        const formattedTotal = Utils.formatRupiah(total);
        const targetDest = pcKode === 'Tempat' ? 'Makan di Tempat' : 'Take Away (Bawa Pulang)';

        this._checkoutTotal = total;
        this._checkoutPcKode = pcKode;

        const modalHtml = `
            <div class="bg-[#0c0c0c] border border-neutral-800 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
                <div class="flex items-start justify-between px-5 py-4 border-b border-neutral-800 gap-3">
                    <div>
                        <h3 class="text-sm font-semibold text-neutral-100">Pembayaran POS</h3>
                        <p class="text-xs text-neutral-500 mt-0.5">${targetDest}</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-100 transition-colors flex items-center justify-center shrink-0">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div class="px-5 py-5 space-y-4">
                    <!-- Total -->
                    <div class="bg-[#080808] border border-neutral-800 rounded-lg p-4 text-center">
                        <span class="text-xs text-neutral-500 font-medium">Total Belanja</span>
                        <div class="text-2xl font-bold text-neutral-100 font-mono mt-1">${formattedTotal}</div>
                    </div>

                    <!-- Input Tunai -->
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block mb-2">Uang Tunai</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">Rp</span>
                            <input type="number" id="payment-tunai-input" min="0" value="0"
                                class="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-neutral-200 text-sm font-mono text-right focus:border-neutral-500 transition-colors"
                                placeholder="0" oninput="Menu.hitungKembalian()" autofocus />
                        </div>
                    </div>

                    <!-- Shortcut Pecahan -->
                    <div>
                        <label class="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-2">Shortcut</label>
                        <div class="flex flex-wrap gap-1.5">
                            ${[1000, 2000, 5000, 10000, 20000, 50000, 100000].map(n =>
                                `<button onclick="Menu.setTunai(${n})" class="px-3 py-1.5 bg-[#0a0a0a] border border-neutral-800 hover:bg-[#1a1a1a] text-neutral-300 text-xs font-mono font-bold rounded transition-colors">Rp${(n/1000).toFixed(0)}K</button>`
                            ).join('')}
                            <button onclick="Menu.setTunaiPas()" class="px-3 py-1.5 bg-[#0a0a0a] border border-neutral-800 hover:bg-[#1a1a1a] text-neutral-300 text-xs font-mono font-bold rounded transition-colors">Pas</button>
                        </div>
                    </div>

                    <!-- Kembalian -->
                    <div class="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-neutral-500 uppercase font-bold tracking-wider">Kembalian</span>
                            <span id="payment-kembalian-display" class="text-lg font-black text-neutral-600 font-mono">Rp0</span>
                        </div>
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-neutral-800 flex justify-end gap-2">
                    <button onclick="Modal.closeModal()"
                        class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                    <button id="payment-submit-btn" onclick="Menu.submitPembayaran()" disabled
                        class="px-4 py-2 text-sm font-medium bg-neutral-600 text-neutral-700 rounded-lg cursor-not-allowed transition-colors">Bayar</button>
                </div>
            </div>
        `;
        Modal.show(modalHtml);
        setTimeout(() => {
            const input = document.getElementById('payment-tunai-input');
            if (input) input.focus();
        }, 200);
    },

    _checkoutTotal: 0,
    _checkoutPcKode: null,

    hitungKembalian() {
        const tunaiInput = document.getElementById('payment-tunai-input');
        const kembalianDisplay = document.getElementById('payment-kembalian-display');
        const submitBtn = document.getElementById('payment-submit-btn');
        if (!tunaiInput || !kembalianDisplay || !submitBtn) return;

        const total = this._checkoutTotal;
        const tunai = parseInt(tunaiInput.value) || 0;
        const kembalian = tunai - total;

        if (tunai >= total && total > 0) {
            kembalianDisplay.textContent = Utils.formatRupiah(kembalian);
            kembalianDisplay.className = 'text-lg font-black text-emerald-400 font-mono';
            submitBtn.disabled = false;
            submitBtn.className = 'px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors';
        } else {
            kembalianDisplay.textContent = 'Rp0';
            kembalianDisplay.className = 'text-lg font-black text-neutral-600 font-mono';
            submitBtn.disabled = true;
            submitBtn.className = 'px-6 py-2.5 bg-neutral-600 text-neutral-700 text-xs font-bold rounded-lg cursor-not-allowed transition-colors';
        }
    },

    setTunai(nominal) {
        const input = document.getElementById('payment-tunai-input');
        if (input) { input.value = nominal; this.hitungKembalian(); }
    },

    setTunaiPas() {
        this.setTunai(this._checkoutTotal);
    },

    async submitPembayaran() {
        const tunaiInput = document.getElementById('payment-tunai-input');
        const tunai = parseInt(tunaiInput?.value) || 0;
        const total = this._checkoutTotal;
        const kembalian = tunai - total;
        if (tunai < total || total <= 0) return;

        Modal.closeModal();

        const cartItems = this.cart.map(c => ({ menu_id: c.menu.id, jumlah: c.jumlah }));
        const pcKode = this._checkoutPcKode;

        try {
            const res = await window.API.menu.checkout(cartItems, pcKode, tunai, kembalian);
            if (res.success) {
                Toast.success(`Pembayaran berhasil! Kembalian: Rp ${kembalian.toLocaleString('id-ID')}`);
                this.cart = [];
                this.renderCart();
                await this.loadCatalog();

                if (res.data && res.data.length > 0) {
                    Modal.confirm("Transaksi berhasil. Cetak struk?", () => {
                        res.data.forEach(tm => {
                            StrukPreview.currentData = {
                                no_nota: tm.no_nota,
                                tanggal: tm.tanggal,
                                pc_kode: tm.pc_kode || "-",
                                tipe: "kantin",
                                nama_pelanggan: "Pelanggan POS",
                                rincian: [{ keterangan: tm.menu_nama, durasi: tm.jumlah, harga: tm.total_harga }],
                                total_durasi: tm.jumlah,
                                total_harga: tm.total_harga,
                                kasir: tm.kasir_nama,
                                tunai: tunai,
                                kembalian: kembalian
                            };
                            StrukPreview.printPreview();
                        });
                    });
                }
            } else {
                Toast.error(res.error || "Gagal memproses checkout");
            }
        } catch (error) {
            Toast.error("Gagal checkout: error koneksi");
        }
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
        const modal = document.getElementById("menu-modal");
        const title = document.getElementById("menu-modal-title");
        const form = document.getElementById("menu-form");
        if (!modal || !title || !form) return;

        form.reset();
        document.getElementById("menu-id-input").value = "";
        document.getElementById("menu-file-name").textContent = "Belum ada gambar terpilih";
        title.textContent = "Tambah Item Baru";
        // Reset checkbox unlimited
        const cb = document.getElementById("menu-stok-unlimited");
        if (cb) cb.checked = false;
        const stokInput = document.getElementById("menu-stok-input");
        if (stokInput) {
            stokInput.disabled = false;
            stokInput.required = true;
            stokInput.placeholder = "Contoh: 50";
        }
        modal.classList.remove("hidden");
    },

    showEditModal(menuId) {
        event.stopPropagation();
        const menu = this.items.find(m => m.id === menuId);
        if (!menu) return;

        const modal = document.getElementById("menu-modal");
        const title = document.getElementById("menu-modal-title");
        if (!modal || !title) return;

        document.getElementById("menu-id-input").value = menu.id;
        document.getElementById("menu-nama-input").value = menu.nama;
        document.getElementById("menu-harga-input").value = Utils.formatRawRupiah(menu.harga);
        document.getElementById("menu-file-name").textContent = menu.gambar_path
            ? menu.gambar_path.split("/").pop()
            : "Belum ada gambar terpilih";

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
                stokInput.placeholder = "Contoh: 50";
            }
        }

        title.textContent = "Edit Item Menu";
        modal.classList.remove("hidden");
    },

    closeModal() {
        const modal = document.getElementById("menu-modal");
        if (modal) modal.classList.add("hidden");
    },

    handleFileSelect(event) {
        const file = event.target.files[0];
        const label = document.getElementById("menu-file-name");
        if (label && file) {
            label.textContent = file.name;
        }
    },

    async submitForm(event) {
        event.preventDefault();

        const menuId = document.getElementById("menu-id-input").value;
        const nama = document.getElementById("menu-nama-input").value.trim();
        const hargaRaw = document.getElementById("menu-harga-input").value;
        const harga = hargaRaw.replace(/\./g, '');
        const gambarInput = document.getElementById("menu-gambar-input");
        const file = gambarInput?.files[0];

        // Checkbox unlimited
        const cb = document.getElementById("menu-stok-unlimited");
        const stok = (cb && cb.checked) ? "-1" : (document.getElementById("menu-stok-input").value || "0");

        const formData = new FormData();
        formData.append("nama", nama);
        formData.append("harga", harga);
        formData.append("stok", stok);
        if (file) {
            formData.append("gambar", file);
        }

        try {
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
            Toast.error("Gagal menyimpan menu: error koneksi");
        }
    },

    async deleteItem(menuId, nama) {
        event.stopPropagation(); // Mencegah klik di card
        Modal.confirm(`Hapus menu "${nama}" dari katalog? Menu yang sudah terjual akan diarsipkan agar struk lama tetap valid.`, async () => {
            try {
                const res = await window.API.menu.delete(menuId);
                if (res.success) {
                    Toast.success(res.message || "Menu berhasil dihapus");
                    await this.loadCatalog();
                    this.removeFromCart(menuId);
                } else {
                    Toast.error(res.error || "Gagal menghapus menu");
                }
            } catch (error) {
                Toast.error("Gagal menghapus menu: error koneksi");
            }
        });
    },

    async hardDeleteItem(menuId, nama) {
        event.stopPropagation();
        Modal.confirm(`Hapus PERMANEN "${nama}" beserta seluruh transaksi penjualannya? Data F&B historis akan hilang total dan tidak dapat dipulihkan.`, async () => {
            Modal.confirm(`Konfirmasi terakhir: hapus permanen "${nama}" + semua transaksinya?`, async () => {
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
            });
        });
    }
};

window.Menu = Menu;

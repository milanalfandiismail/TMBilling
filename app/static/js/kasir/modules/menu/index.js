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
                ? `<img src="${m.gambar_path}" alt="${m.nama}" class="w-full h-24 object-cover rounded-lg border border-[#1f1f1f] bg-[#0c0c0c]">`
                : `<div class="w-full h-24 rounded-lg border border-[#1f1f1f] bg-[#080808] flex items-center justify-center text-neutral-600">
                     <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path>
                     </svg>
                   </div>`;

            const btnHtml = isOutOfStock
                ? `<button disabled class="w-full py-1.5 rounded bg-neutral-900 border border-[#1c1c1c] text-[10px] lg:text-base text-neutral-600 font-bold uppercase cursor-not-allowed">Stok Habis</button>`
                : `<button onclick="Menu.addToCart(${m.id})" class="w-full py-1.5 rounded bg-neutral-100 hover:bg-white text-[#050505] text-[10px] lg:text-base font-bold uppercase transition-colors">Tambah</button>`;

            const stokText = isUnlimited ? 'Unlimited' : `Stok: ${m.stok}`;
            const stokColor = isUnlimited ? 'text-green-500 font-bold' : (m.stok < 5 ? 'text-amber-500 font-bold' : 'text-neutral-500');

            return `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] hover:border-[#2a2a2a] transition-all rounded-xl p-3 flex flex-col justify-between group relative">
                    <!-- CRUD Quick Actions -->
                    <div class="absolute top-2.5 right-2.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${(window.App && App.user && App.user.role === 'kasir') ? '' : `
                        <button onclick="Menu.showEditModal(${m.id})" class="p-1 rounded bg-black/60 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-[#2a2a2a] transition-colors" title="Edit Menu">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onclick="Menu.deleteItem(${m.id}, '${m.nama}')" class="p-1 rounded bg-black/60 hover:bg-red-950 text-neutral-400 hover:text-red-400 border border-[#2a2a2a] hover:border-red-900 transition-colors" title="Hapus Menu">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                        <button onclick="Menu.hardDeleteItem(${m.id}, '${m.nama}')" class="p-1 rounded bg-black/60 hover:bg-red-700 text-neutral-400 hover:text-white border border-[#2a2a2a] hover:border-red-600 transition-colors" title="Hapus Permanen (beserta semua transaksi)">
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
                <div class="flex items-center justify-between gap-3 bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-2.5">
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

        let paymentMethods = ["Tunai", "QRIS", "Transfer Bank"];
        try {
            const settingsData = await API.settings.getAll();
            if (settingsData && settingsData.success && settingsData.settings.payment_methods) {
                paymentMethods = settingsData.settings.payment_methods.split(',').map(s => s.trim());
            }
        } catch (e) {
            console.error("Gagal memuat metode pembayaran:", e);
        }

        const pcSelect = document.getElementById("menu-order-pc-select");
        const pcKode = pcSelect?.value || null;

        let total = 0;
        this.cart.forEach(c => { total += c.menu.harga * c.jumlah; });
        const formattedTotal = Utils.formatRupiah(total);
        const targetDest = pcKode === 'Tempat' ? 'Makan di Tempat' : 'Take Away (Bawa Pulang)';

        this._checkoutTotal = total;
        this._checkoutPcKode = pcKode;
        
        const pecahanHtml = [1000, 2000, 5000, 10000, 20000, 50000, 100000].map(n =>
            `<button onclick="Menu.setTunai(${n})" class="px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-[10px] lg:text-xs text-neutral-300 font-bold rounded transition-colors">Rp${(n/1000).toFixed(0)}K</button>`
        ).join('');

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-4xl w-[calc(100%-2rem)] mx-auto md:w-full max-h-[85vh] overflow-y-auto scrollbar-thin my-auto shadow-2xl">
                <div class="flex items-center justify-between mb-3 pb-2.5 border-b border-[#2a2a2a]">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                            <svg class="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-xs lg:text-base font-bold text-neutral-100 uppercase tracking-wider">Pembayaran POS</h3>
                            <p class="text-[9px] lg:text-base text-neutral-500 mt-0.5">${targetDest}</p>
                        </div>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5 mt-4">
                    <!-- Left Column: Ringkasan Pesanan -->
                    <div class="md:col-span-1 space-y-4">
                        <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4">
                            <div class="text-[9px] lg:text-base text-neutral-500 uppercase font-bold">Total Belanja</div>
                            <div class="font-bold text-lg lg:text-2xl text-neutral-100 font-mono mt-0.5">${formattedTotal}</div>
                            
                            <div class="border-t border-[#2a2a2a] my-3"></div>
                            
                            <div class="text-[9px] lg:text-base text-neutral-500 uppercase font-bold mb-2">Daftar Pesanan</div>
                            <div class="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin pr-1">
                                ${this.cart.map(c => `
                                    <div class="flex flex-col text-[10px] lg:text-xs">
                                        <span class="text-neutral-300">${c.menu.nama} <span class="text-neutral-500 font-bold">x${c.jumlah}</span></span>
                                        <span class="font-mono text-neutral-400">Rp${Utils.formatRupiah(c.menu.harga * c.jumlah).replace('Rp', '')}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4">
                            <label class="text-[9px] lg:text-base text-neutral-500 uppercase font-bold block mb-1">Metode Bayar</label>
                            <select id="payment-method-select" onchange="Menu.onPaymentMethodChange()" 
                                class="w-full px-2 py-1 bg-[#050505] border border-[#2a2a2a] rounded text-[10px] lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 font-bold transition-all">
                                ${paymentMethods.map(m => `<option value="${m}">${m}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <!-- Right Column: Pembayaran Tunai -->
                    <div class="md:col-span-3 space-y-4">
                        <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4">
                            <label class="text-[9px] lg:text-base text-neutral-400 uppercase font-bold tracking-wider font-mono block mb-2">Input Uang Tunai</label>
                            <div class="relative mb-4">
                                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs lg:text-base">Rp</span>
                                <input type="text" inputmode="numeric" id="payment-tunai-input" 
                                    class="w-full pl-9 pr-3 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-sm lg:text-xl font-mono text-right focus:outline-none focus:border-neutral-500 transition-colors"
                                    placeholder="0" oninput="Utils.formatInputRupiah(this); Menu.hitungKembalian()" autofocus />
                            </div>

                            <label class="text-[9px] lg:text-base text-neutral-400 uppercase font-bold tracking-wider font-mono block mb-2">Pecahan Cepat</label>
                            <div class="flex flex-wrap gap-2 mb-4">
                                ${pecahanHtml}
                                <button onclick="Menu.setTunaiPas()" class="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-[10px] lg:text-xs text-neutral-300 font-bold rounded flex-1 transition-colors">Uang Pas</button>
                            </div>

                            <div class="border-t border-[#2a2a2a] my-4"></div>

                            <div class="flex justify-between items-center bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-3 lg:p-4">
                                <span class="text-[10px] lg:text-sm text-neutral-400 uppercase font-bold tracking-wider">Kembalian</span>
                                <span id="payment-kembalian-text" class="text-sm lg:text-2xl font-black text-neutral-100 font-mono">Rp0</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="flex gap-3 justify-end mt-5 pt-4 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="Menu.submitPembayaran()" id="btn-submit-payment" disabled 
                        class="px-5 py-2.5 bg-neutral-100 hover:bg-[#e5e5e5] disabled:bg-[#1a1a1a] disabled:text-neutral-500 disabled:cursor-not-allowed text-black text-xs lg:text-base font-bold rounded-lg transition-colors flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        Proses & Cetak
                    </button>
                </div>
            </div>`;
        Modal.show(modalHtml);
        setTimeout(() => {
            const input = document.getElementById('payment-tunai-input');
            if (input) input.focus();
        }, 200);
    },

    _checkoutTotal: 0,
    _checkoutPcKode: null,

    onPaymentMethodChange() {
        const select = document.getElementById('payment-method-select');
        const tunaiInput = document.getElementById('payment-tunai-input');
        const shortcutContainer = document.getElementById('payment-shortcut-container');
        if (!select || !tunaiInput) return;

        const val = select.value.toLowerCase().trim();
        const isCash = val === 'tunai' || val === 'cash';

        if (isCash) {
            tunaiInput.readOnly = false;
            tunaiInput.value = '0';
            if (shortcutContainer) shortcutContainer.classList.remove('opacity-45', 'pointer-events-none');
        } else {
            tunaiInput.readOnly = true;
            tunaiInput.value = this._checkoutTotal;
            if (shortcutContainer) shortcutContainer.classList.add('opacity-45', 'pointer-events-none');
        }
        this.hitungKembalian();
    },

    hitungKembalian() {
        const tunaiInput = document.getElementById('payment-tunai-input');
        const kembalianDisplay = document.getElementById('payment-kembalian-text');
        const submitBtn = document.getElementById('btn-submit-payment');
        if (!tunaiInput || !kembalianDisplay || !submitBtn) return;

        const total = this._checkoutTotal;
        const tunaiStr = tunaiInput.value.replace(/\D/g, '');
        const tunai = parseInt(tunaiStr) || 0;
        const kembalian = tunai - total;

        if (tunai >= total && total > 0) {
            kembalianDisplay.textContent = Utils.formatRupiah(kembalian);
            kembalianDisplay.className = 'text-sm font-black text-emerald-400 font-mono';
            submitBtn.disabled = false;
            submitBtn.className = 'px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors flex items-center gap-2';
        } else {
            kembalianDisplay.textContent = 'Rp0';
            kembalianDisplay.className = 'text-sm font-black text-neutral-100 font-mono';
            submitBtn.disabled = true;
            submitBtn.className = 'px-5 py-2.5 bg-neutral-100 hover:bg-white disabled:bg-[#1a1a1a] disabled:text-neutral-500 disabled:cursor-not-allowed text-black text-xs lg:text-base font-bold rounded-lg transition-colors flex items-center gap-2';
        }
    },

    setTunai(nominal) {
        const input = document.getElementById('payment-tunai-input');
        if (input) { 
            input.value = nominal; 
            Utils.formatInputRupiah(input);
            this.hitungKembalian(); 
        }
    },

    setTunaiPas() {
        const input = document.getElementById('payment-tunai-input');
        if (input) { 
            input.value = this._checkoutTotal; 
            Utils.formatInputRupiah(input);
            this.hitungKembalian(); 
        }
    },

    async submitPembayaran() {
        const tunaiInput = document.getElementById('payment-tunai-input');
        const tunai = parseInt(tunaiInput?.value.replace(/\D/g, '')) || 0;
        const total = this._checkoutTotal;
        const kembalian = tunai - total;
        if (tunai < total || total <= 0) return;

        const paymentMethodSelect = document.getElementById('payment-method-select');
        const metodePembayaran = paymentMethodSelect ? paymentMethodSelect.value : 'Tunai';

        Modal.closeModal();

        const cartItems = this.cart.map(c => ({ menu_id: c.menu.id, jumlah: c.jumlah }));
        const pcKode = this._checkoutPcKode;

        try {
            const res = await window.API.menu.checkout(cartItems, pcKode, tunai, kembalian, metodePembayaran);
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
        if (!confirm(`Apakah Anda yakin ingin menghapus menu '${nama}' dari katalog?\n\n(Menu yang sudah pernah terjual akan diarsipkan agar struk lama tetap valid. Gunakan 'Hapus Permanen' jika ingin menghapus menu beserta seluruh transaksinya.)`)) {
            return;
        }

        try {
            const res = await window.API.menu.delete(menuId);
            if (res.success) {
                Toast.success(res.message || "Menu berhasil dihapus");
                await this.loadCatalog();
                // Hapus dari keranjang jika ada
                this.removeFromCart(menuId);
            } else {
                Toast.error(res.error || "Gagal menghapus menu");
            }
        } catch (error) {
            Toast.error("Gagal menghapus menu: error koneksi");
        }
    },

    async hardDeleteItem(menuId, nama) {
        event.stopPropagation();
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
    }
};

window.Menu = Menu;

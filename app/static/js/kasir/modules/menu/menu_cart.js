/**
 * Menu Cart & Checkout Sub-module
 * Menangani keranjang belanja kasir, kalkulasi total/kembalian, dan proses checkout pembayaran.
 */
window.MenuCart = {
    addToCart(menuId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
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

        this.renderCart();
    },

    decrementCart(menuId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const cartItem = this.cart.find(c => c.menu.id === menuId);
        if (!cartItem) return;

        if (cartItem.jumlah > 1) {
            cartItem.jumlah--;
            this.renderCart();
        } else {
            this.removeFromCart(menuId);
        }
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
        const countBadge = document.getElementById("menu-cart-count-badge");
        const clearBtn = document.getElementById("menu-cart-clear-btn");
        const mobileBar = document.getElementById("menu-mobile-cart-bar");
        const mobileTotal = document.getElementById("menu-mobile-bar-total");
        const mobileCount = document.getElementById("menu-mobile-bar-count");

        if (!container || !totalEl) return;

        const totalItemsCount = this.cart.reduce((sum, c) => sum + c.jumlah, 0);
        if (countBadge) countBadge.textContent = `${totalItemsCount} item`;

        if (clearBtn) {
            if (this.cart.length > 0) clearBtn.classList.remove("hidden");
            else clearBtn.classList.add("hidden");
        }

        if (this.cart.length === 0) {
            container.innerHTML = `<div class="text-center py-10 text-neutral-600 text-xs lg:text-xs xl:text-sm">Keranjang masih kosong</div>`;
            totalEl.textContent = "Rp0";
            if (mobileBar) mobileBar.classList.add("hidden");
            this.updateCardBadges();
            return;
        }

        let total = 0;
        container.innerHTML = this.cart.map(c => {
            const itemTotal = c.menu.harga * c.jumlah;
            total += itemTotal;

            return `
                <div class="bg-[#0a0a0a] border border-[#1c1c1c] hover:border-[#282828] rounded-xl p-2.5 lg:p-3 transition-all group space-y-2">
                    <!-- Baris 1: Nama Menu (Full Width) & Tombol Hapus -->
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0 flex-1">
                            <h5 class="text-xs lg:text-xs xl:text-sm font-bold text-neutral-200 line-clamp-1 truncate" title="${c.menu.nama}">${c.menu.nama}</h5>
                            <span class="text-[10px] xl:text-xs text-neutral-500 font-mono block">${Utils.formatRupiah(c.menu.harga)} <span class="text-neutral-600">/ pcs</span></span>
                        </div>
                        <button onclick="Menu.removeFromCart(${c.menu.id})" 
                            class="text-neutral-500 hover:text-red-400 p-1 rounded hover:bg-red-950/30 transition-colors shrink-0" title="Hapus">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                    
                    <!-- Baris 2: Stepper Kuantitas (Kiri) & Subtotal Harga (Kanan) -->
                    <div class="flex items-center justify-between gap-2 pt-2 border-t border-[#181818]">
                        <!-- Stepper Kuantitas -->
                        <div class="flex items-center shrink-0 bg-[#111] border border-[#222] rounded-lg p-0.5">
                            <button onclick="Menu.updateCartQty(${c.menu.id}, ${c.jumlah - 1})" 
                                class="w-5 h-5 bg-[#1a1a1a] hover:bg-[#252525] rounded flex items-center justify-center text-xs font-bold text-neutral-400 hover:text-white transition-colors">-</button>
                            <input type="text" inputmode="numeric" pattern="[0-9]*" value="${c.jumlah}" 
                                onchange="Menu.updateCartQty(${c.menu.id}, this.value)"
                                class="w-7 text-center text-xs font-mono font-bold bg-transparent text-neutral-200 focus:outline-none tabular-nums select-all">
                            <button onclick="Menu.updateCartQty(${c.menu.id}, ${c.jumlah + 1})" 
                                class="w-5 h-5 bg-[#1a1a1a] hover:bg-[#252525] rounded flex items-center justify-center text-xs font-bold text-neutral-400 hover:text-white transition-colors">+</button>
                        </div>

                        <!-- Subtotal Harga -->
                        <div class="text-right shrink-0">
                            <div class="text-xs xl:text-sm font-mono font-bold text-emerald-400 tabular-nums">${Utils.formatRupiah(itemTotal)}</div>
                        </div>
                    </div>
                </div>`;
        }).join('');

        const formattedTotal = Utils.formatRupiah(total);
        totalEl.textContent = formattedTotal;

        if (mobileBar) {
            mobileBar.classList.remove("hidden");
            if (mobileTotal) mobileTotal.textContent = formattedTotal;
            if (mobileCount) mobileCount.textContent = `(${totalItemsCount} item)`;
        }

        this.updateCardBadges();
    },

    updateCardBadges() {
        if (this.currentView === 'active' && this.items && this.items.length > 0) {
            this.filterCatalog();
        }
    },

    scrollToCart() {
        const cartSec = document.getElementById('menu-cart-section');
        if (cartSec) {
            cartSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    clearCart() {
        if (!this.cart || this.cart.length === 0) return;
        this.cart = [];
        this.renderCart();
        if (window.Toast) Toast.info("Keranjang belanja dikosongkan");
    },

    async checkout() {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
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
            `<button type="button" onclick="Menu.setTunai(${n})" class="px-1.5 py-1.5 bg-[#141414] hover:bg-[#202020] border border-[#222] text-[10px] text-neutral-300 font-bold rounded transition-colors text-center font-mono">Rp${(n/1000).toFixed(0)}k</button>`
        ).join('');

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-3 sm:p-4 max-w-2xl w-[calc(100%-1.5rem)] mx-auto max-h-[92vh] overflow-y-auto scrollbar-thin my-auto shadow-2xl">
                <!-- Header -->
                <div class="flex items-center justify-between pb-2.5 mb-3 border-b border-[#222]">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wider">Pembayaran POS</h3>
                            <p class="text-[10px] text-neutral-400 font-medium">${targetDest}</p>
                        </div>
                    </div>
                    <button type="button" onclick="Modal.closeModal()" class="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] text-neutral-400 hover:text-white flex items-center justify-center text-base leading-none transition-colors">&times;</button>
                </div>

                <!-- 2 Column Layout -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <!-- Kolom Kiri: Total & Ringkasan -->
                    <div class="space-y-2.5">
                        <!-- Total Tagihan Box -->
                        <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-lg p-3">
                            <span class="text-[9px] uppercase font-bold text-neutral-500 tracking-wider block">Total Tagihan</span>
                            <div class="text-xl sm:text-2xl font-black text-emerald-400 font-mono tabular-nums mt-0.5">${formattedTotal}</div>
                        </div>

                        <!-- Ringkasan Items -->
                        <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-lg p-2.5 space-y-1.5">
                            <div class="flex items-center justify-between text-[10px] uppercase font-bold text-neutral-500 border-b border-[#181818] pb-1">
                                <span>Menu (${this.cart.length})</span>
                                <span>Subtotal</span>
                            </div>
                            <div class="space-y-1.5 max-h-[130px] overflow-y-auto scrollbar-thin pr-1 text-xs">
                                ${this.cart.map(c => `
                                    <div class="flex items-center justify-between text-[11px] gap-2">
                                        <span class="text-neutral-300 truncate"><strong class="font-mono text-neutral-400">${c.jumlah}x</strong> ${c.menu.nama}</span>
                                        <span class="text-neutral-200 font-mono font-medium shrink-0 tabular-nums">${Utils.formatRupiah(c.menu.harga * c.jumlah)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Metode Bayar -->
                        <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-lg p-2.5">
                            <label for="payment-method-select" class="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block mb-1">Metode Bayar</label>
                            <select id="payment-method-select" onchange="Menu.onPaymentMethodChange()" 
                                class="w-full px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 font-bold focus:outline-none focus:border-neutral-500">
                                ${paymentMethods.map(m => `<option value="${m}">${m}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Kolom Kanan: Input Tunai, Pecahan Cepat, Kembalian -->
                    <div class="space-y-2.5">
                        <!-- Input Tunai -->
                        <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-lg p-3 space-y-2">
                            <label for="payment-tunai-input" class="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">Uang Diterima (Tunai)</label>
                            <div class="relative">
                                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs">Rp</span>
                                <input type="text" inputmode="numeric" id="payment-tunai-input" 
                                    class="w-full pl-8 pr-3 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-neutral-100 text-base font-mono font-bold text-right focus:outline-none focus:border-neutral-400"
                                    placeholder="0" oninput="Utils.formatInputRupiah(this); Menu.hitungKembalian()" autofocus />
                            </div>

                            <!-- Pecahan Cepat -->
                            <div id="payment-shortcut-container" class="grid grid-cols-4 gap-1 pt-1 transition-opacity">
                                ${pecahanHtml}
                                <button type="button" onclick="Menu.setTunaiPas()" class="px-1.5 py-1.5 bg-[#161616] hover:bg-[#222] border border-[#262626] text-[10px] text-emerald-400 font-bold rounded transition-colors text-center font-mono">Uang Pas</button>
                            </div>
                        </div>

                        <!-- Kembalian Display -->
                        <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-lg p-3 flex items-center justify-between">
                            <span class="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Kembalian</span>
                            <span id="payment-kembalian-text" class="text-base sm:text-lg font-black text-neutral-100 font-mono tabular-nums">Rp0</span>
                        </div>
                    </div>
                </div>

                <!-- Footer Action Buttons -->
                <div class="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-[#1c1c1c]">
                    <button type="button" onclick="Modal.closeModal()" class="px-3 py-1.5 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 text-xs font-bold rounded transition-colors">Batal</button>
                    <button type="button" onclick="Menu.submitPembayaran()" id="btn-submit-payment" disabled 
                        class="px-4 py-1.5 bg-neutral-100 hover:bg-white disabled:bg-[#1a1a1a] disabled:text-neutral-500 disabled:cursor-not-allowed text-black text-xs font-bold rounded transition-colors flex items-center gap-1.5 shadow">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        <span>Proses &amp; Cetak</span>
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
            tunaiInput.classList.remove('bg-[#1a1a1a]', 'text-neutral-500');
            tunaiInput.classList.add('bg-[#050505]', 'text-neutral-100');
            if (shortcutContainer) shortcutContainer.classList.remove('opacity-40', 'pointer-events-none');
        } else {
            tunaiInput.readOnly = true;
            tunaiInput.value = Utils.formatRupiah(this._checkoutTotal).replace('Rp', '');
            tunaiInput.classList.remove('bg-[#050505]', 'text-neutral-100');
            tunaiInput.classList.add('bg-[#1a1a1a]', 'text-neutral-500');
            if (shortcutContainer) shortcutContainer.classList.add('opacity-40', 'pointer-events-none');
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
            kembalianDisplay.className = 'text-base sm:text-lg font-black text-emerald-400 font-mono tabular-nums';
            submitBtn.disabled = false;
            submitBtn.className = 'px-4 py-1.5 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded transition-colors flex items-center gap-1.5 shadow';
        } else {
            kembalianDisplay.textContent = 'Rp0';
            kembalianDisplay.className = 'text-base sm:text-lg font-black text-neutral-100 font-mono tabular-nums';
            submitBtn.disabled = true;
            submitBtn.className = 'px-4 py-1.5 bg-neutral-100 hover:bg-white disabled:bg-[#1a1a1a] disabled:text-neutral-500 disabled:cursor-not-allowed text-black text-xs font-bold rounded transition-colors flex items-center gap-1.5 shadow';
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
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
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


};

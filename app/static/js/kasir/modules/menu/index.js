// app/static/js/kasir/modules/menu/index.js

const Menu = {
    items: [],
    archivedItems: [],
    cart: [], // Array of { menu: MenuItem, jumlah: number }
    currentView: 'active', // 'active' | 'archived'
    
    // Canvas Image Cropper & Zoom State (4:3 ratio)
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

    resetState() {
        this.cart = [];
        this.renderCart();
        const searchInput = document.getElementById("menu-search-input");
        if (searchInput) searchInput.value = "";
    },

    async load() {
        try {
            this.setupCropperEvents();
            await this.loadCatalog();
        } catch (error) {
            console.error("Gagal inisialisasi modul menu:", error);
        }
    },

    switchView(view) {
        this.currentView = view;
        const activeBtn = document.getElementById("menu-tab-active-btn");
        const archivedBtn = document.getElementById("menu-tab-archived-btn");

        if (view === 'active') {
            if (activeBtn) {
                activeBtn.className = "px-3 py-1.5 rounded-md text-xs lg:text-xs xl:text-sm font-bold bg-neutral-100 text-black shadow transition-all flex items-center gap-1.5";
                const badge = activeBtn.querySelector('#menu-active-count-badge');
                if (badge) badge.className = "px-1.5 py-0.5 bg-black/10 text-black rounded-full text-[10px] font-mono font-bold";
            }
            if (archivedBtn) {
                archivedBtn.className = "px-3 py-1.5 rounded-md text-xs lg:text-xs xl:text-sm font-bold text-neutral-400 hover:text-neutral-200 hover:bg-[#161616] transition-all flex items-center gap-1.5";
                const badge = archivedBtn.querySelector('#menu-archived-count-badge');
                if (badge) badge.className = "px-1.5 py-0.5 bg-[#1c1c1c] text-neutral-400 rounded-full text-[10px] font-mono font-bold";
            }
        } else {
            if (activeBtn) {
                activeBtn.className = "px-3 py-1.5 rounded-md text-xs lg:text-xs xl:text-sm font-bold text-neutral-400 hover:text-neutral-200 hover:bg-[#161616] transition-all flex items-center gap-1.5";
                const badge = activeBtn.querySelector('#menu-active-count-badge');
                if (badge) badge.className = "px-1.5 py-0.5 bg-[#1c1c1c] text-neutral-400 rounded-full text-[10px] font-mono font-bold";
            }
            if (archivedBtn) {
                archivedBtn.className = "px-3 py-1.5 rounded-md text-xs lg:text-xs xl:text-sm font-bold bg-amber-400 text-black shadow transition-all flex items-center gap-1.5";
                const badge = archivedBtn.querySelector('#menu-archived-count-badge');
                if (badge) badge.className = "px-1.5 py-0.5 bg-black/15 text-black rounded-full text-[10px] font-mono font-bold";
            }
        }

        this.filterCatalog();
    },

    async loadCatalog() {
        const grid = document.getElementById("menu-catalog-grid");
        if (!grid) return;

        try {
            const [resActive, resArchived] = await Promise.all([
                window.API.menu.list(),
                window.API.menu.listArchived()
            ]);

            if (resActive && resActive.success) {
                this.items = resActive.data || [];
            } else {
                Toast.error(resActive?.error || "Gagal memuat katalog menu");
            }

            if (resArchived && resArchived.success) {
                this.archivedItems = resArchived.data || [];
            }

            // Update badge counts
            const activeBadge = document.getElementById("menu-active-count-badge");
            const archivedBadge = document.getElementById("menu-archived-count-badge");
            if (activeBadge) activeBadge.textContent = this.items.length;
            if (archivedBadge) archivedBadge.textContent = this.archivedItems.length;

            this.filterCatalog();
        } catch (error) {
            console.error("Koneksi gagal memuat katalog menu:", error);
            Toast.error("Koneksi gagal memuat katalog menu");
            grid.innerHTML = `<div class="col-span-full text-center py-20 text-red-400 text-xs lg:text-base font-semibold">Gagal memuat data menu.</div>`;
        }
    },

    filterCatalog() {
        const query = document.getElementById("menu-search-input")?.value?.toLowerCase() || "";
        if (this.currentView === 'active') {
            const filtered = this.items.filter(m => m.nama.toLowerCase().includes(query));
            this.renderCatalog(filtered);
        } else {
            const filtered = this.archivedItems.filter(m => m.nama.toLowerCase().includes(query));
            this.renderArchivedCatalog(filtered);
        }
    },

    renderCatalog(data) {
        const grid = document.getElementById("menu-catalog-grid");
        if (!grid) return;

        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-20 text-neutral-500">
                    <div class="w-12 h-12 rounded-xl bg-[#141414] border border-[#222] flex items-center justify-center text-neutral-500 mb-3">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    </div>
                    <p class="text-xs lg:text-sm xl:text-base font-bold text-neutral-300">Belum ada menu di katalog</p>
                    <p class="text-[10px] lg:text-xs xl:text-sm text-neutral-500 mt-1">Klik 'Tambah Menu' untuk membuat makanan/minuman baru</p>
                </div>`;
            return;
        }

        grid.innerHTML = data.map(m => {
            const isUnlimited = m.stok < 0;
            const isOutOfStock = !isUnlimited && m.stok <= 0;
            const stokText = isUnlimited ? 'Unlimited' : `Stok: ${m.stok}`;
            const stokColor = isUnlimited ? 'text-green-500 font-bold' : (m.stok < 5 ? 'text-amber-500 font-bold' : 'text-neutral-400 font-semibold');

            const resolvedImg = m.gambar_path && window.API ? API.resolveMediaUrl(m.gambar_path) : (m.gambar_path || '');
            const imgHtml = resolvedImg 
                ? `<div class="w-full aspect-[4/3] rounded-lg overflow-hidden border border-[#1f1f1f] bg-[#0c0c0c] relative">
                     <img src="${resolvedImg}" alt="${m.nama}" class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" loading="lazy">
                     <span class="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/85 backdrop-blur-sm border border-[#2a2a2a] ${stokColor} rounded text-[9px] lg:text-[10px] xl:text-xs font-mono shadow">${stokText}</span>
                   </div>`
                : `<div class="w-full aspect-[4/3] rounded-lg border border-[#1f1f1f] bg-[#090909] flex flex-col items-center justify-center text-neutral-600 relative">
                     <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path>
                     </svg>
                     <span class="text-[9px] xl:text-[10px] text-neutral-600 mt-1 font-medium">No Image</span>
                     <span class="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/85 backdrop-blur-sm border border-[#2a2a2a] ${stokColor} rounded text-[9px] lg:text-[10px] xl:text-xs font-mono shadow">${stokText}</span>
                   </div>`;

            const btnHtml = isOutOfStock
                ? `<button disabled class="w-full py-1.5 rounded bg-neutral-900 border border-[#1c1c1c] text-[10px] lg:text-xs xl:text-sm text-neutral-600 font-bold uppercase cursor-not-allowed">Stok Habis</button>`
                : `<button onclick="Menu.addToCart(${m.id})" class="w-full py-1.5 rounded bg-neutral-100 hover:bg-white text-[#050505] text-[10px] lg:text-xs xl:text-sm font-bold uppercase transition-colors shadow">Tambah</button>`;

            return `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] hover:border-[#2a2a2a] transition-all rounded-xl p-3 flex flex-col justify-between group relative">
                    <!-- Preview Button (Top Left - Hover Only: Icon on LG, Icon + Text on XL/2XL) -->
                    ${resolvedImg ? `
                    <div class="absolute top-2.5 left-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onclick="Menu.openLightbox('${resolvedImg}', '${m.nama.replace(/'/g, "\\'")}', '${Utils.formatRupiah(m.harga)}')" class="p-1 xl:px-2 xl:py-1 rounded bg-black/75 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-[#2a2a2a] transition-all shadow flex items-center gap-1 text-[10px] xl:text-xs font-bold" title="Lihat Fullscreen">
                            <svg class="w-3.5 h-3.5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                            <span class="hidden xl:inline">Preview</span>
                        </button>
                    </div>
                    ` : ''}

                    <!-- CRUD Quick Actions -->
                    <div class="absolute top-2.5 right-2.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${(window.App && App.user && App.user.role === 'kasir') ? '' : `
                        <button onclick="Menu.showEditModal(${m.id})" class="p-1 rounded bg-black/70 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-[#2a2a2a] transition-colors shadow" title="Edit Menu">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onclick="Menu.deleteItem(${m.id}, '${m.nama}')" class="p-1 rounded bg-black/70 hover:bg-amber-950 text-neutral-300 hover:text-amber-400 border border-[#2a2a2a] hover:border-amber-800 transition-colors shadow" title="Arsipkan Menu">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                        </button>
                        <button onclick="Menu.hardDeleteItem(${m.id}, '${m.nama}')" class="p-1 rounded bg-black/70 hover:bg-red-700 text-neutral-300 hover:text-white border border-[#2a2a2a] hover:border-red-600 transition-colors shadow" title="Hapus Permanen">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>`}
                    </div>

                    <div class="space-y-2">
                        ${imgHtml}
                        <div>
                            <h4 class="text-xs lg:text-xs xl:text-sm font-bold text-neutral-100 line-clamp-2 leading-snug" title="${m.nama}">${m.nama}</h4>
                            <div class="mt-1.5 pt-1.5 border-t border-[#181818]">
                                <span class="text-xs lg:text-xs xl:text-sm text-neutral-200 font-bold font-mono tabular-nums">${Utils.formatRupiah(m.harga)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="mt-2.5">
                        ${btnHtml}
                    </div>
                </div>`;
        }).join('');
    },

    renderArchivedCatalog(data) {
        const grid = document.getElementById("menu-catalog-grid");
        if (!grid) return;

        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-20 text-neutral-500">
                    <div class="w-12 h-12 rounded-xl bg-[#141414] border border-[#222] flex items-center justify-center text-neutral-500 mb-3">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                    </div>
                    <p class="text-xs lg:text-sm xl:text-base font-bold text-neutral-300">Tidak ada menu yang diarsipkan</p>
                    <p class="text-[10px] lg:text-xs xl:text-sm text-neutral-500 mt-1">Menu yang dihapus/diarsipkan akan tersimpan di sini</p>
                </div>`;
            return;
        }

        grid.innerHTML = data.map(m => {
            const resolvedImg = m.gambar_path && window.API ? API.resolveMediaUrl(m.gambar_path) : (m.gambar_path || '');
            const imgHtml = resolvedImg 
                ? `<div class="w-full aspect-[4/3] rounded-lg overflow-hidden border border-[#1f1f1f] bg-[#0c0c0c] relative opacity-60">
                     <img src="${resolvedImg}" alt="${m.nama}" class="w-full h-full object-cover object-center grayscale" loading="lazy">
                     <span class="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-500/90 text-black text-[9px] font-bold rounded shadow uppercase">Arsip</span>
                   </div>`
                : `<div class="w-full aspect-[4/3] rounded-lg border border-[#1f1f1f] bg-[#090909] flex flex-col items-center justify-center text-neutral-600 relative">
                     <span class="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-500/90 text-black text-[9px] font-bold rounded shadow uppercase">Arsip</span>
                     <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
                     </svg>
                   </div>`;

            const trxCount = m.transaksi_count || 0;
            const trxInfo = trxCount > 0 ? `${trxCount} transaksi historis` : 'Belum pernah terjual';

            return `
                <div class="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 flex flex-col justify-between relative group">
                    <!-- Preview Button (Top Left - Hover Only: Icon on LG, Icon + Text on XL/2XL) -->
                    ${resolvedImg ? `
                    <div class="absolute top-2.5 left-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onclick="Menu.openLightbox('${resolvedImg}', '${m.nama.replace(/'/g, "\\'")}', '${Utils.formatRupiah(m.harga)}')" class="p-1 xl:px-2 xl:py-1 rounded bg-black/75 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-[#2a2a2a] transition-all shadow flex items-center gap-1 text-[10px] xl:text-xs font-bold" title="Lihat Fullscreen">
                            <svg class="w-3.5 h-3.5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                            <span class="hidden xl:inline">Preview</span>
                        </button>
                    </div>
                    ` : ''}

                    <div class="space-y-2">
                        ${imgHtml}
                        <div>
                            <h4 class="text-xs lg:text-xs xl:text-sm font-bold text-neutral-300 line-clamp-2 leading-snug" title="${m.nama}">${m.nama}</h4>
                            <div class="mt-1.5 pt-1.5 border-t border-[#181818] flex items-center justify-between gap-1 flex-wrap">
                                <span class="text-xs lg:text-xs xl:text-sm text-neutral-300 font-bold font-mono tabular-nums">${Utils.formatRupiah(m.harga)}</span>
                                <span class="text-[9px] lg:text-[10px] text-neutral-500 font-mono">${trxInfo}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-[#181818]">
                        <button onclick="Menu.restoreItem(${m.id}, '${m.nama}')" 
                            class="flex-1 py-1.5 px-2 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30 text-[10px] lg:text-xs xl:text-xs font-bold transition-colors flex items-center justify-center gap-1" title="Pulihkan ke katalog aktif">
                            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            <span>Pulihkan</span>
                        </button>
                        <button onclick="Menu.hardDeleteItem(${m.id}, '${m.nama}')" 
                            class="p-1.5 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 transition-colors shrink-0" title="Hapus Permanen">
                            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>`;
        }).join('');
    },

    async restoreItem(menuId, nama) {
        event?.stopPropagation();
        try {
            const res = await window.API.menu.restore(menuId);
            if (res && res.success) {
                Toast.success(res.message || `Menu '${nama}' berhasil dipulihkan`);
                await this.loadCatalog();
            } else {
                Toast.error(res?.error || "Gagal memulihkan menu");
            }
        } catch (error) {
            console.error("Gagal memulihkan menu:", error);
            Toast.error("Gagal memulihkan menu: error koneksi");
        }
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
        const countBadge = document.getElementById("menu-cart-count-badge");
        if (!container || !totalEl) return;

        const totalItemsCount = this.cart.reduce((sum, c) => sum + c.jumlah, 0);
        if (countBadge) countBadge.textContent = `${totalItemsCount} item`;

        if (this.cart.length === 0) {
            container.innerHTML = `<div class="text-center py-10 text-neutral-600 text-xs lg:text-xs xl:text-sm">Keranjang masih kosong</div>`;
            totalEl.textContent = "Rp0";
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
            `<button onclick="Menu.setTunai(${n})" class="px-2 py-1.5 lg:px-3 lg:py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-[10px] xl:text-sm text-neutral-300 font-bold rounded transition-colors">Rp${(n/1000).toFixed(0)}K</button>`
        ).join('');

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-3 md:p-4 lg:p-6 max-w-6xl w-[calc(100%-2rem)] mx-auto md:w-full max-h-[95vh] xl:max-h-[90vh] overflow-y-auto scrollbar-thin my-auto shadow-2xl">
                <div class="flex items-center justify-between mb-3 pb-2 lg:mb-4 lg:pb-3 border-b border-[#2a2a2a]">
                    <div class="flex items-center gap-2 lg:gap-3">
                        <div class="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                            <svg class="w-4 h-4 lg:w-5 lg:h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-xs lg:text-sm xl:text-lg font-bold text-neutral-100 uppercase tracking-wider">Pembayaran POS</h3>
                            <p class="text-[9px] xl:text-sm text-neutral-500 mt-0.5">${targetDest}</p>
                        </div>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg lg:text-xl leading-none">&times;</button>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-5 mt-2 lg:mt-4">
                    <!-- Left Column: Ringkasan Pesanan -->
                    <div class="lg:col-span-2 space-y-3 lg:space-y-4">
                        <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-3 lg:p-5">
                            <div class="text-[9px] xl:text-base text-neutral-500 uppercase font-bold">Total Belanja</div>
                            <div class="font-bold text-xl lg:text-2xl xl:text-4xl text-neutral-100 font-mono mt-1">${formattedTotal}</div>
                            
                            <div class="border-t border-[#2a2a2a] my-2 lg:my-4"></div>
                            
                            <div class="text-[9px] xl:text-base text-neutral-500 uppercase font-bold mb-2 lg:mb-3">Daftar Pesanan</div>
                            <div class="space-y-2 max-h-[120px] md:max-h-[160px] xl:max-h-[350px] overflow-y-auto scrollbar-thin pr-1 xl:pr-2">
                                ${this.cart.map(c => `
                                    <div class="bg-[#111] border border-[#2a2a2a] p-2 xl:p-4 rounded-lg">
                                        <div class="flex justify-between items-start gap-2 lg:gap-3">
                                            <div class="flex-1">
                                                <div class="font-bold text-xs lg:text-sm xl:text-lg text-neutral-200 break-words whitespace-normal">${c.menu.nama}</div>
                                                <div class="text-[9px] xl:text-sm text-neutral-500 mt-0.5 lg:mt-1">Kuantitas: <span class="text-neutral-300 font-bold">${c.jumlah}</span></div>
                                            </div>
                                            <div class="text-right shrink-0">
                                                <div class="font-bold text-xs lg:text-sm xl:text-lg text-emerald-400 font-mono">Rp${Utils.formatRupiah(c.menu.harga * c.jumlah).replace('Rp', '')}</div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-3 lg:p-5">
                            <label class="text-[9px] xl:text-base text-neutral-500 uppercase font-bold block mb-1">Metode Bayar</label>
                            <select id="payment-method-select" onchange="Menu.onPaymentMethodChange()" 
                                class="w-full px-2 py-1 xl:py-2.5 bg-[#050505] border border-[#2a2a2a] rounded-lg text-[10px] xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 font-bold transition-all">
                                ${paymentMethods.map(m => `<option value="${m}">${m}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <!-- Right Column: Pembayaran Tunai -->
                    <div class="lg:col-span-3 space-y-3 lg:space-y-4">
                        <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-3 lg:p-5">
                            <label class="text-[9px] xl:text-base text-neutral-400 uppercase font-bold tracking-wider font-mono block mb-1 lg:mb-2">Input Uang Tunai</label>
                            <div class="relative mb-3 lg:mb-5">
                                <span class="absolute left-3 xl:left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs lg:text-sm xl:text-lg">Rp</span>
                                <input type="text" inputmode="numeric" id="payment-tunai-input" 
                                    class="w-full pl-9 pr-3 py-2 xl:pl-12 xl:pr-4 xl:py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-sm lg:text-base xl:text-2xl font-mono text-right focus:outline-none focus:border-neutral-500 transition-colors"
                                    placeholder="0" oninput="Utils.formatInputRupiah(this); Menu.hitungKembalian()" autofocus />
                            </div>

                            <label class="text-[9px] xl:text-base text-neutral-400 uppercase font-bold tracking-wider font-mono block mb-1 lg:mb-2">Pecahan Cepat</label>
                            <div id="payment-shortcut-container" class="flex flex-wrap gap-1.5 lg:gap-2 mb-3 lg:mb-5 transition-opacity">
                                ${pecahanHtml}
                                <button onclick="Menu.setTunaiPas()" class="px-2 py-1.5 lg:px-3 lg:py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-[10px] xl:text-sm text-neutral-300 font-bold rounded flex-1 transition-colors">Uang Pas</button>
                            </div>

                            <div class="border-t border-[#2a2a2a] my-3 lg:my-5"></div>

                            <div class="flex justify-between items-center bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-3 lg:p-4">
                                <span class="text-[10px] lg:text-sm text-neutral-400 uppercase font-bold tracking-wider">Kembalian</span>
                                <span id="payment-kembalian-text" class="text-sm lg:text-2xl font-black text-neutral-100 font-mono">Rp0</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2 lg:gap-3 justify-end mt-3 lg:mt-5 pt-3 lg:pt-4 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-3 py-2 lg:px-4 lg:py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base xl:text-lg font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="Menu.submitPembayaran()" id="btn-submit-payment" disabled 
                        class="px-4 py-2 lg:px-5 lg:py-2.5 bg-neutral-100 hover:bg-[#e5e5e5] disabled:bg-[#1a1a1a] disabled:text-neutral-500 disabled:cursor-not-allowed text-black text-xs lg:text-base xl:text-lg font-bold rounded-lg transition-colors flex items-center gap-1.5 lg:gap-2">
                        <svg class="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
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
            tunaiInput.classList.remove('bg-[#1a1a1a]', 'text-neutral-500');
            tunaiInput.classList.add('bg-[#0a0a0a]', 'text-neutral-200');
            if (shortcutContainer) shortcutContainer.classList.remove('opacity-40', 'pointer-events-none');
        } else {
            tunaiInput.readOnly = true;
            tunaiInput.value = Utils.formatRupiah(this._checkoutTotal).replace('Rp', '');
            tunaiInput.classList.remove('bg-[#0a0a0a]', 'text-neutral-200');
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
            kembalianDisplay.className = 'text-sm lg:text-2xl font-black text-emerald-400 font-mono';
            submitBtn.disabled = false;
            submitBtn.className = 'px-4 py-2 lg:px-5 lg:py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base xl:text-lg font-bold rounded-lg transition-colors flex items-center gap-1.5 lg:gap-2';
        } else {
            kembalianDisplay.textContent = 'Rp0';
            kembalianDisplay.className = 'text-sm lg:text-2xl font-black text-neutral-100 font-mono';
            submitBtn.disabled = true;
            submitBtn.className = 'px-4 py-2 lg:px-5 lg:py-2.5 bg-neutral-100 hover:bg-white disabled:bg-[#1a1a1a] disabled:text-neutral-500 disabled:cursor-not-allowed text-black text-xs lg:text-base xl:text-lg font-bold rounded-lg transition-colors flex items-center gap-1.5 lg:gap-2';
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

window.Menu = Menu;

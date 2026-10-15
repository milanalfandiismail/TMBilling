// app/static/js/kasir/modules/menu/index.js

const Menu = {
    items: [],
    archivedItems: [],
    cart: [], // Array of { menu: MenuItem, jumlah: number }
    currentView: 'active', // 'active' | 'archived'
    stockFilter: 'all', // 'all' | 'available' | 'out_of_stock'
    
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
    _scrollBound: false,
    _cartScrollBound: false,

    setupCatalogScroll() {
        const container = document.getElementById("menu-catalog-scroll-container");
        if (!container || this._scrollBound) return;
        this._scrollBound = true;

        // Contain mouse wheel scrolling strictly within catalog container when hovering cards
        container.addEventListener('wheel', (e) => {
            if (e.deltaY === 0) return;
            container.scrollBy({ top: e.deltaY, behavior: 'auto' });
            e.preventDefault();
        }, { passive: false });
    },

    setupCartScroll() {
        const cart = document.getElementById("menu-cart-items");
        if (!cart || this._cartScrollBound) return;
        this._cartScrollBound = true;

        cart.addEventListener('wheel', (e) => {
            if (e.deltaY === 0) return;
            cart.scrollBy({ top: e.deltaY, behavior: 'auto' });
            e.preventDefault();
        }, { passive: false });
    },

    resetState() {
        this.cart = [];
        this.stockFilter = 'all';
        this.renderCart();
        const searchInput = document.getElementById("menu-search-input");
        if (searchInput) searchInput.value = "";
        const clearBtn = document.getElementById("menu-search-clear");
        if (clearBtn) clearBtn.classList.add("hidden");
    },

    async load() {
        try {
            this.setupCropperEvents();
            this.setupCatalogScroll();
            this.setupCartScroll();
            await this.loadCatalog();
        } catch (error) {
            console.error("Gagal inisialisasi modul menu:", error);
        }
    },

    switchView(view) {
        if (view === 'archived' && window.App && App.user && App.user.role === 'kasir') {
            Toast.error("Akses Arsip Menu hanya untuk Administrator");
            return;
        }

        this.currentView = view;
        const activeBtn = document.getElementById("menu-tab-active-btn");
        const archivedBtn = document.getElementById("menu-tab-archived-btn");

        const baseBtnClasses = "px-2.5 sm:px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 justify-center w-auto";

        if (view === 'active') {
            if (activeBtn) {
                activeBtn.className = `${baseBtnClasses} bg-neutral-100 text-black shadow-sm`;
                const badge = activeBtn.querySelector('#menu-active-count-badge');
                if (badge) badge.className = "px-1.5 py-0.5 bg-black/10 text-black rounded-full text-[10px] font-mono font-bold";
            }
            if (archivedBtn) {
                archivedBtn.className = `${baseBtnClasses} remote-hide-action text-neutral-400 hover:text-neutral-200 hover:bg-[#171717]`;
                const badge = archivedBtn.querySelector('#menu-archived-count-badge');
                if (badge) badge.className = "px-1.5 py-0.5 bg-[#1c1c1c] text-neutral-400 rounded-full text-[10px] font-mono font-bold";
            }
        } else {
            if (activeBtn) {
                activeBtn.className = `${baseBtnClasses} text-neutral-400 hover:text-neutral-200 hover:bg-[#171717]`;
                const badge = activeBtn.querySelector('#menu-active-count-badge');
                if (badge) badge.className = "px-1.5 py-0.5 bg-[#1c1c1c] text-neutral-400 rounded-full text-[10px] font-mono font-bold";
            }
            if (archivedBtn) {
                archivedBtn.className = `${baseBtnClasses} remote-hide-action bg-amber-400 text-black shadow-sm`;
                const badge = archivedBtn.querySelector('#menu-archived-count-badge');
                if (badge) badge.className = "px-1.5 py-0.5 bg-black/15 text-black rounded-full text-[10px] font-mono font-bold";
            }
        }

        this.filterCatalog();
    },

    setStockFilter(filter) {
        this.stockFilter = filter;
        const btnAll = document.getElementById("menu-filter-stock-all");
        const btnAvail = document.getElementById("menu-filter-stock-available");
        const btnOut = document.getElementById("menu-filter-stock-out");

        const activeClasses = "px-2.5 py-1 rounded text-neutral-100 bg-[#1f1f1f] border border-[#2a2a2a] font-medium transition-colors";
        const inactiveClasses = "px-2.5 py-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#171717] font-medium transition-colors";

        if (btnAll) btnAll.className = filter === 'all' ? activeClasses : inactiveClasses;
        if (btnAvail) btnAvail.className = filter === 'available' ? activeClasses : inactiveClasses;
        if (btnOut) btnOut.className = filter === 'out_of_stock' ? activeClasses : inactiveClasses;

        this.filterCatalog();
    },

    clearSearch() {
        const input = document.getElementById("menu-search-input");
        if (input) {
            input.value = "";
            input.focus();
        }
        const clearBtn = document.getElementById("menu-search-clear");
        if (clearBtn) clearBtn.classList.add("hidden");
        this.filterCatalog();
    },

    _lastFingerprint: null,

    async loadCatalog(isSilent = false) {
        const grid = document.getElementById("menu-catalog-grid");
        if (!grid) return;

        if (!isSilent && (!this.items || this.items.length === 0) && typeof Skeleton !== 'undefined') {
            grid.innerHTML = Skeleton.menuCards(8);
        }

        try {
            const isKasir = window.App && App.user && App.user.role === 'kasir';
            const [resActive, resArchived] = await Promise.all([
                window.API.menu.list(),
                isKasir ? Promise.resolve({ success: true, data: [] }) : window.API.menu.listArchived()
            ]);

            const activeData = (resActive && resActive.success) ? (resActive.data || []) : [];
            const archivedData = (resArchived && resArchived.success) ? (resArchived.data || []) : [];

            const newFingerprint = JSON.stringify({ active: activeData, archived: archivedData });
            if (isSilent && this._lastFingerprint === newFingerprint) {
                return; // Data tidak berubah, tidak perlu memutasi DOM
            }
            this._lastFingerprint = newFingerprint;

            if (resActive && resActive.success) {
                this.items = activeData;
            } else if (!isSilent) {
                Toast.error(resActive?.error || "Gagal memuat katalog menu");
            }

            if (resArchived && resArchived.success) {
                this.archivedItems = archivedData;
            } else {
                this.archivedItems = [];
            }

            // Update badge counts
            const activeBadge = document.getElementById("menu-active-count-badge");
            const archivedBadge = document.getElementById("menu-archived-count-badge");
            if (activeBadge) activeBadge.textContent = this.items.length;
            if (archivedBadge) {
                if (isKasir) {
                    archivedBadge.textContent = "0";
                } else {
                    archivedBadge.textContent = this.archivedItems.length;
                }
            }

            this.filterCatalog();
        } catch (error) {
            if (!isSilent) {
                console.error("Koneksi gagal memuat katalog menu:", error);
                Toast.error("Koneksi gagal memuat katalog menu");
                grid.innerHTML = `<div class="col-span-full text-center py-20 text-red-400 text-xs lg:text-base font-semibold">Gagal memuat data menu.</div>`;
            }
        }
    },

    refreshLive() {
        if (App.currentTab !== 'menu') return;

        // Jangan re-render jika sedang membuka modal edit/tambah/restock menu atau checkout
        const modalRestock = document.getElementById("menu-restock-modal");
        const modalForm = document.getElementById("menu-modal");
        const modalLightbox = document.getElementById("menu-lightbox-modal");
        const isAppModalOpen = document.getElementById("app-modal") && !document.getElementById("app-modal").classList.contains("hidden");

        const isFormOpen = (modalRestock && !modalRestock.classList.contains("hidden")) ||
            (modalForm && !modalForm.classList.contains("hidden")) ||
            (modalLightbox && !modalLightbox.classList.contains("hidden")) ||
            isAppModalOpen;

        if (isFormOpen) return;

        return this.loadCatalog(true);
    },

    filterCatalog() {
        const searchInput = document.getElementById("menu-search-input");
        const query = searchInput?.value?.toLowerCase() || "";
        const clearBtn = document.getElementById("menu-search-clear");
        if (clearBtn) {
            if (query) clearBtn.classList.remove("hidden");
            else clearBtn.classList.add("hidden");
        }

        const itemsToFilter = this.currentView === 'active' ? this.items : this.archivedItems;
        const filtered = itemsToFilter.filter(m => {
            const matchesQuery = !query || m.nama.toLowerCase().includes(query);
            if (!matchesQuery) return false;

            if (this.currentView === 'active') {
                if (this.stockFilter === 'available') {
                    return m.stok < 0 || m.stok > 0;
                } else if (this.stockFilter === 'out_of_stock') {
                    return m.stok >= 0 && m.stok === 0;
                }
            }
            return true;
        });

        if (this.currentView === 'active') {
            this.renderCatalog(filtered);
        } else {
            this.renderArchivedCatalog(filtered);
        }
    },

    renderCatalog(data) {
        this.setupCatalogScroll();
        const container = document.getElementById("menu-catalog-scroll-container");
        const prevScroll = container ? container.scrollTop : 0;
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

        const isKasir = window.App && App.user && App.user.role === 'kasir';

        grid.innerHTML = data.map(m => {
            const isUnlimited = m.stok < 0;
            const isOutOfStock = !isUnlimited && m.stok <= 0;
            const stokText = isUnlimited ? 'Unlimited' : `Stok: ${m.stok}`;
            const stokColor = isUnlimited ? 'text-emerald-400 font-bold' : (m.stok < 5 ? 'text-amber-400 font-bold' : 'text-neutral-400 font-semibold');

            const cartItem = this.cart.find(c => c.menu.id === m.id);
            const inCartQty = cartItem ? cartItem.jumlah : 0;

            const resolvedImg = m.gambar_path && window.API ? API.resolveMediaUrl(m.gambar_path) : (m.gambar_path || '');
            const imgHtml = resolvedImg 
                ? `<div class="w-full aspect-[4/3] rounded-lg overflow-hidden border border-[#1f1f1f] bg-[#0c0c0c] relative">
                     <img src="${resolvedImg}" alt="${m.nama}" class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" loading="lazy">
                     <span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/85 backdrop-blur-sm border border-[#2a2a2a] ${stokColor} rounded text-[9px] font-mono shadow">${stokText}</span>
                   </div>`
                : `<div class="w-full aspect-[4/3] rounded-lg border border-[#1f1f1f] bg-[#090909] flex flex-col items-center justify-center text-neutral-600 relative">
                     <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path>
                     </svg>
                     <span class="text-[9px] text-neutral-600 mt-1 font-medium">No Image</span>
                     <span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/85 backdrop-blur-sm border border-[#2a2a2a] ${stokColor} rounded text-[9px] font-mono shadow">${stokText}</span>
                   </div>`;

            const escapedName = (m.nama || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

            const cardBorderClass = (isOutOfStock && inCartQty === 0)
                ? 'bg-[#0a0a0a] border-[#181818] opacity-50 cursor-not-allowed select-none'
                : inCartQty > 0
                    ? 'bg-[#08130d] border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.12)] cursor-pointer active:scale-[0.98]'
                    : 'bg-[#0c0c0c] border-[#1c1c1c] hover:border-[#2a2a2a] hover:bg-[#0f0f0f] cursor-pointer active:scale-[0.98]';

            const cardClickAction = isOutOfStock ? '' : `onclick="Menu.addToCart(${m.id})"`;
            const cardContextMenuAction = (isOutOfStock && inCartQty === 0) ? '' : `oncontextmenu="event.preventDefault(); Menu.decrementCart(${m.id})"`;

            const inCartBadge = inCartQty > 0 ? `
                <div class="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-black text-[9px] sm:text-[10px] font-mono font-bold shadow-md select-none" title="Klik kiri tambah, klik kanan kurangi">
                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                    <span>x${inCartQty} di Keranjang</span>
                </div>
            ` : '';

            const previewBtn = resolvedImg ? `
                <div class="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button type="button" onclick="event.stopPropagation(); Menu.openLightbox('${resolvedImg}', '${escapedName}', '${Utils.formatRupiah(m.harga)}')" class="p-1 rounded bg-black/80 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-[#2a2a2a] transition-all shadow flex items-center gap-1 text-[10px]" title="Lihat Fullscreen">
                        <svg class="w-3 h-3 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    </button>
                </div>
            ` : '';

            const adminDesktopActions = (isKasir || isOutOfStock) ? '' : `
                <div class="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity remote-hide-action">
                    ${isUnlimited ? '' : `
                    <button type="button" onclick="event.stopPropagation(); Menu.showRestockModal(${m.id})" class="p-1 rounded bg-black/85 hover:bg-emerald-950 text-neutral-300 hover:text-emerald-400 border border-[#2a2a2a] hover:border-emerald-800 transition-colors shadow" title="Tambah Stok">
                        <svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                    </button>`}
                    <button type="button" onclick="event.stopPropagation(); Menu.showEditModal(${m.id})" class="p-1 rounded bg-black/85 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-[#2a2a2a] transition-colors shadow" title="Edit Menu">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button type="button" onclick="event.stopPropagation(); Menu.deleteItem(${m.id}, '${escapedName}')" class="p-1 rounded bg-black/85 hover:bg-amber-950 text-neutral-300 hover:text-amber-400 border border-[#2a2a2a] hover:border-amber-800 transition-colors shadow" title="Arsipkan Menu">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                    </button>
                </div>
            `;

            const adminMobileActions = isKasir ? '' : `
                <button type="button" onclick="event.stopPropagation(); Menu.showMobileActions(${m.id})" 
                    class="w-6 h-6 rounded-md bg-[#161616] hover:bg-[#222] border border-[#2c2c2c] text-neutral-400 hover:text-neutral-200 flex items-center justify-center shadow shrink-0 lg:hidden remote-hide-action active:scale-90 transition-transform mt-0.5" 
                    title="Kelola Menu">
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                    </svg>
                </button>
            `;

            return `
                <div ${cardClickAction} ${cardContextMenuAction} class="${cardBorderClass} border transition-all rounded-xl p-2 sm:p-2.5 flex flex-col justify-between group relative select-none" title="${escapedName} (Klik Kiri: Tambah | Klik Kanan: Kurangi)">
                    ${inCartBadge}
                    <div class="absolute top-2 right-2 z-10 flex items-center gap-1">
                        ${previewBtn}
                        ${adminDesktopActions}
                    </div>

                    <div class="space-y-1.5 sm:space-y-2">
                        ${imgHtml}
                        <div class="flex items-start justify-between gap-1.5 min-w-0">
                            <h4 class="text-xs font-bold text-neutral-100 line-clamp-2 leading-snug flex-1 min-w-0" title="${escapedName}">${m.nama}</h4>
                            ${adminMobileActions}
                        </div>
                    </div>
                    
                    <!-- Bottom Row: Price & Action Stepper -->
                    <div class="mt-2 pt-1.5 border-t border-[#181818] flex items-center justify-between gap-1">
                        <span class="text-xs font-bold font-mono text-neutral-200 tabular-nums">${Utils.formatRupiah(m.harga)}</span>
                        ${inCartQty > 0 ? `
                            <!-- Mobile & Desktop Stepper: Direct +/- touch targets -->
                            <div class="flex items-center gap-1 bg-[#141414] border border-emerald-500/50 rounded p-0.5 shadow-sm shrink-0" onclick="event.stopPropagation()">
                                <button type="button" onclick="event.stopPropagation(); Menu.decrementCart(${m.id})" class="w-5 h-5 rounded bg-[#1e1e1e] hover:bg-red-500/20 text-neutral-300 hover:text-red-400 flex items-center justify-center font-bold text-xs transition-colors active:scale-95" title="Kurangi (Klik Kanan di card)">-</button>
                                <span class="px-1 text-[10px] font-mono font-bold text-emerald-400 tabular-nums">${inCartQty}</span>
                                <button type="button" ${isOutOfStock ? 'disabled' : `onclick="event.stopPropagation(); Menu.addToCart(${m.id})"`} class="w-5 h-5 rounded ${isOutOfStock ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-black active:scale-95'} flex items-center justify-center font-bold text-xs transition-colors" title="${isOutOfStock ? 'Stok habis' : 'Tambah (Klik Kiri di card)'}">+</button>
                            </div>
                        ` : isOutOfStock ? `
                            <span class="px-1.5 py-0.5 rounded bg-neutral-900 border border-[#1c1c1c] text-[9px] text-neutral-600 font-bold uppercase">Habis</span>
                        ` : `
                            <button type="button" class="px-2 py-0.5 rounded bg-neutral-100 hover:bg-white text-black font-bold text-[10px] transition-colors shadow flex items-center gap-1 shrink-0">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                                <span>Tambah</span>
                            </button>
                        `}
                    </div>
                </div>`;
        }).join('');

        if (container && prevScroll > 0) {
            container.scrollTop = prevScroll;
        }
    },

    showMobileActions(menuId) {
        if (window.event) window.event.stopPropagation();
        const menu = this.items.find(m => m.id === menuId);
        if (!menu) return;

        const isUnlimited = menu.stok < 0;
        const escapedName = (menu.nama || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const resolvedImg = menu.gambar_path && window.API ? API.resolveMediaUrl(menu.gambar_path) : (menu.gambar_path || '');

        const modalHtml = `
            <div id="menu-mobile-actions-modal" class="bg-[#111] border border-[#262626] rounded-2xl p-4 max-w-sm w-[calc(100%-2rem)] mx-auto my-auto shadow-2xl space-y-4">
                <div class="flex items-center justify-between border-b border-[#222] pb-3">
                    <div class="min-w-0 flex-1 pr-2">
                        <span class="text-[10px] font-mono uppercase text-emerald-400 font-bold tracking-wider">Kelola Menu</span>
                        <h3 class="text-sm font-bold text-neutral-100 truncate">${escapedName}</h3>
                        <span class="text-xs text-neutral-400 font-mono">${Utils.formatRupiah(menu.harga)} • ${isUnlimited ? 'Unlimited' : `Stok: ${menu.stok}`}</span>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-white flex items-center justify-center text-lg">&times;</button>
                </div>

                <div class="space-y-2">
                    ${!isUnlimited ? `
                    <button type="button" onclick="Modal.closeModal(); Menu.showRestockModal(${menu.id})" 
                        class="w-full py-2.5 px-3 bg-[#181818] hover:bg-[#222] border border-[#2e2e2e] text-emerald-400 font-bold rounded-xl flex items-center gap-2.5 text-xs transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                        <span>Tambah Stok (Restock)</span>
                    </button>` : ''}

                    <button type="button" onclick="Modal.closeModal(); Menu.showEditModal(${menu.id})" 
                        class="w-full py-2.5 px-3 bg-[#181818] hover:bg-[#222] border border-[#2e2e2e] text-neutral-200 font-bold rounded-xl flex items-center gap-2.5 text-xs transition-colors">
                        <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        <span>Edit Nama, Harga & Foto</span>
                    </button>

                    ${resolvedImg ? `
                    <button type="button" onclick="Modal.closeModal(); Menu.openLightbox('${resolvedImg}', '${escapedName}', '${Utils.formatRupiah(menu.harga)}')" 
                        class="w-full py-2.5 px-3 bg-[#181818] hover:bg-[#222] border border-[#2e2e2e] text-neutral-200 font-bold rounded-xl flex items-center gap-2.5 text-xs transition-colors">
                        <svg class="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        <span>Lihat Foto Fullscreen</span>
                    </button>` : ''}

                    <button type="button" onclick="Modal.closeModal(); Menu.deleteItem(${menu.id}, '${escapedName}')" 
                        class="w-full py-2.5 px-3 bg-[#181818] hover:bg-amber-950/40 border border-[#2e2e2e] hover:border-amber-800 text-amber-400 font-bold rounded-xl flex items-center gap-2.5 text-xs transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                        <span>Arsipkan Menu</span>
                    </button>

                    <button type="button" onclick="Modal.closeModal(); Menu.hardDeleteItem(${menu.id}, '${escapedName}')" 
                        class="w-full py-2.5 px-3 bg-[#181818] hover:bg-red-950/40 border border-[#2e2e2e] hover:border-red-800 text-red-400 font-bold rounded-xl flex items-center gap-2.5 text-xs transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        <span>Hapus Permanen</span>
                    </button>
                </div>
            </div>
        `;
        Modal.show(modalHtml);
    },

    showRestockModal(menuId) {
        event?.stopPropagation();
        const menu = this.items.find(m => m.id === menuId);
        if (!menu) return;

        const isUnlimited = menu.stok < 0;
        if (isUnlimited) {
            Toast.info(`Menu '${menu.nama}' berstatus stok Unlimited (tidak terbatas)`);
            return;
        }

        const modal = document.getElementById("menu-restock-modal");
        const idInput = document.getElementById("menu-restock-id");
        const namaEl = document.getElementById("menu-restock-nama");
        const currStockEl = document.getElementById("menu-restock-current-stock");
        const qtyInput = document.getElementById("menu-restock-qty-input");
        const notesInput = document.getElementById("menu-restock-notes-input");

        if (idInput) idInput.value = menu.id;
        if (namaEl) namaEl.textContent = menu.nama;
        if (currStockEl) currStockEl.textContent = `${menu.stok} unit`;
        if (qtyInput) qtyInput.value = "10";
        if (notesInput) notesInput.value = "";

        this.calculateRestockPreview();
        if (modal) modal.classList.remove("hidden");
        if (qtyInput) {
            setTimeout(() => {
                qtyInput.focus();
                qtyInput.select();
            }, 50);
        }
    },

    closeRestockModal() {
        const modal = document.getElementById("menu-restock-modal");
        if (modal) modal.classList.add("hidden");
    },

    quickAddRestock(amount) {
        const qtyInput = document.getElementById("menu-restock-qty-input");
        if (!qtyInput) return;
        const current = parseInt(qtyInput.value) || 0;
        qtyInput.value = current + amount;
        this.calculateRestockPreview();
    },

    calculateRestockPreview() {
        const idInput = document.getElementById("menu-restock-id");
        const qtyInput = document.getElementById("menu-restock-qty-input");
        const previewEl = document.getElementById("menu-restock-preview-total");
        if (!idInput || !qtyInput || !previewEl) return;

        const menuId = parseInt(idInput.value);
        const menu = this.items.find(m => m.id === menuId);
        if (!menu) return;

        const addQty = parseInt(qtyInput.value) || 0;
        const total = (menu.stok >= 0 ? menu.stok : 0) + addQty;
        previewEl.textContent = `${total} unit (+${addQty})`;
    },

    async submitRestock(event) {
        event?.preventDefault();
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;

        const idInput = document.getElementById("menu-restock-id");
        const qtyInput = document.getElementById("menu-restock-qty-input");
        const notesInput = document.getElementById("menu-restock-notes-input");
        const btnSave = document.getElementById("menu-btn-save-restock");

        if (!idInput || !qtyInput) return;
        const menuId = parseInt(idInput.value);
        const qty = parseInt(qtyInput.value);
        const catatan = notesInput ? notesInput.value.trim() : "";

        if (isNaN(qty) || qty <= 0) {
            Toast.error("Jumlah penambahan stok harus minimal 1");
            return;
        }

        try {
            if (btnSave) {
                btnSave.disabled = true;
                btnSave.textContent = "Menyimpan...";
            }

            const res = await window.API.menu.tambahStok(menuId, qty, catatan);
            if (res && res.success) {
                Toast.success(res.message || "Stok berhasil ditambahkan!");
                this.closeRestockModal();
                await this.loadCatalog();
            } else {
                Toast.error(res?.error || "Gagal menambahkan stok");
            }
        } catch (error) {
            console.error("Gagal submit tambah stok:", error);
            Toast.error("Gagal menambahkan stok: error koneksi");
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = `
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    Simpan Tambah Stok
                `;
            }
        }
    },

    renderArchivedCatalog(data) {
        this.setupCatalogScroll();
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
                <div class="bg-[#0a0a0a] border border-[#222] rounded-xl p-2 sm:p-2.5 flex flex-col justify-between relative group">
                    <!-- Preview Button (Top Left: Always clickable via tapping or preview button) -->
                    ${resolvedImg ? `
                    <div class="absolute top-2 left-2 z-10 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
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
                    <div class="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-[#181818] remote-hide-action">
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
        if (window.App && App.user && App.user.role === 'kasir') {
            Toast.error("Akses terbatas hanya untuk Administrator");
            return;
        }
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

window.Menu = Menu;

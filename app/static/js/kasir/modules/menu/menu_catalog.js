/**
 * Menu Catalog Sub-module
 * Menangani state katalog, view switcher, filter stok, render produk, dan restock modal.
 */
window.MenuCatalog = {
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
                ? 'bg-[#0e0a08] border-amber-900/40 hover:border-amber-600/60 hover:bg-[#140e0a] cursor-pointer select-none active:scale-[0.98]'
                : inCartQty > 0
                    ? 'bg-[#08130d] border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.12)] cursor-pointer active:scale-[0.98]'
                    : 'bg-[#0c0c0c] border-[#1c1c1c] hover:border-[#2a2a2a] hover:bg-[#0f0f0f] cursor-pointer active:scale-[0.98]';

            const cardClickAction = isOutOfStock
                ? `onclick="Menu.showRestockModal(${m.id})"`
                : `onclick="Menu.addToCart(${m.id})"`;
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

            const adminDesktopActions = isKasir ? (isUnlimited ? '' : `
                <div class="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onclick="event.stopPropagation(); Menu.showRestockModal(${m.id})" class="p-1 rounded bg-black/85 hover:bg-emerald-950 text-neutral-300 hover:text-emerald-400 border border-[#2a2a2a] hover:border-emerald-800 transition-colors shadow" title="Tambah Stok (Restock)">
                        <svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                    </button>
                </div>
            `) : `
                <div class="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity remote-hide-action">
                    ${isUnlimited ? '' : `
                    <button type="button" onclick="event.stopPropagation(); Menu.showRestockModal(${m.id})" class="p-1 rounded bg-black/85 hover:bg-emerald-950 text-neutral-300 hover:text-emerald-400 border border-[#2a2a2a] hover:border-emerald-800 transition-colors shadow" title="Tambah Stok (Restock)">
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
                            <button type="button" onclick="event.stopPropagation(); Menu.showRestockModal(${m.id})"
                                class="px-2 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-300 hover:text-amber-200 font-bold text-[10px] sm:text-xs flex items-center gap-1 shadow-sm transition-all hover:scale-105 active:scale-95"
                                title="Stok habis, klik untuk tambah stok (Restock)">
                                <svg class="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                                <span>Restock</span>
                            </button>
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


};

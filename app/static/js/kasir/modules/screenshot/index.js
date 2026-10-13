const Screenshot = {
    cachedData: [],
    groups: [],
    currentGrupId: null,
    searchQuery: '',
    filterStatus: 'all',
    searchTimeout: null,
    _isFetching: false,
    _lastFingerprint: null,

    resetState() {
        this.cachedData = [];
        this.groups = [];
        this.currentGrupId = null;
        this.searchQuery = '';
        this.filterStatus = 'all';
        this._isFetching = false;
        this._lastFingerprint = null;
        const searchInput = document.getElementById('screenshot-search');
        if (searchInput) searchInput.value = '';
        const searchClear = document.getElementById('screenshot-search-clear');
        if (searchClear) searchClear.classList.add('hidden');
        const filterSelect = document.getElementById('screenshot-filter');
        if (filterSelect) filterSelect.value = 'all';
    },

    init() {
        if (typeof App !== 'undefined' && App.currentTab === 'screenshot') {
            this.bindEvents();
            this.load();
        }
    },

    bindEvents() {
        const searchInput = document.getElementById('screenshot-search');
        const searchClear = document.getElementById('screenshot-search-clear');
        const filterSelect = document.getElementById('screenshot-filter');

        if (searchInput && !searchInput._boundLive) {
            searchInput._boundLive = true;
            searchInput.addEventListener('input', (e) => {
                const val = (e.target.value || '').trim();
                if (searchClear) searchClear.classList.toggle('hidden', !val);
                if (this.searchTimeout) clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.searchQuery = val.toLowerCase();
                    this.renderGrid();
                }, 250);
            });
        }

        if (filterSelect && !filterSelect._boundLive) {
            filterSelect._boundLive = true;
            filterSelect.addEventListener('change', (e) => {
                this.filterStatus = e.target.value;
                this.renderGrid();
            });
        }
    },

    clearSearch() {
        const searchInput = document.getElementById('screenshot-search');
        if (searchInput) searchInput.value = '';
        const searchClear = document.getElementById('screenshot-search-clear');
        if (searchClear) searchClear.classList.add('hidden');
        this.searchQuery = '';
        this.renderGrid();
    },

    // Backward compatibility jika ada yang memanggil
    startPolling() { },
    stopPolling() { },

    async load(isSilent = false) {
        if (this._isFetching) return;
        this._isFetching = true;

        const container = document.getElementById('screenshot-grid');
        if (!isSilent && (!this.cachedData || !this.cachedData.length) && container && window.Skeleton && typeof Skeleton.screenshotCards === 'function') {
            container.innerHTML = Skeleton.screenshotCards(16);
        }

        try {
            const [data, grupResponse] = await Promise.all([
                API.request('/api/v1/kasir/monitor/screenshot/all'),
                API.grup ? API.grup.list() : Promise.resolve({ grup: [] })
            ]);

            if (data && data.success && Array.isArray(data.data)) {
                const newData = data.data;
                const oldData = this.cachedData || [];

                // 1. Ekstrak & urutkan grup dari endpoint API grup atau fallback dari data PC
                const rawGroups = (grupResponse && (grupResponse.grup || grupResponse.grup_list)) || [];
                let groups = [...rawGroups].sort((a, b) => Number(a.id) - Number(b.id));

                if (groups.length === 0) {
                    const fallbackMap = new Map();
                    newData.forEach(p => {
                        const gId = Number(p.pc_grup_id || 0);
                        const gName = p.pc_grup_nama || 'DEFAULT';
                        if (gId && !fallbackMap.has(gId)) {
                            fallbackMap.set(gId, { id: gId, nama: gName, warna: '#3B82F6' });
                        }
                    });
                    groups = [...fallbackMap.values()].sort((a, b) => a.id - b.id);
                }
                this.groups = groups;

                // 2. Set grup aktif default jika belum ada atau grup yang aktif terhapus
                if (!this.currentGrupId || !groups.some(g => Number(g.id) === Number(this.currentGrupId))) {
                    this.currentGrupId = groups.length > 0 ? Number(groups[0].id) : null;
                }

                // 3. Cek fingerprint data untuk delta polling / re-render
                const newFingerprint = JSON.stringify({
                    grupId: this.currentGrupId,
                    groups: groups.map(g => ({ id: g.id, nama: g.nama })),
                    pcs: newData.map(p => ({ id: p.pc_id, time: p.screenshot_time, url: p.screenshot_url, grup: p.pc_grup_id }))
                });

                if (isSilent && this._lastFingerprint === newFingerprint) {
                    return; // Data tidak berubah
                }

                const isStructureChanged = !this._lastFingerprint || oldData.length !== newData.length ||
                    newData.some((p, i) => !oldData[i] || oldData[i].pc_id !== p.pc_id);

                this._lastFingerprint = newFingerprint;
                this.cachedData = newData;

                this.renderGroupTabs();

                if (isStructureChanged || !isSilent || !oldData.length) {
                    this.renderGrid();
                } else {
                    // Delta check: perbarui hanya kartu PC yang gambar/waktunya berubah
                    this.syncDelta(newData, oldData);
                }
            } else if (!isSilent) {
                Toast.show("Gagal memuat screenshot", "error");
            }
        } catch (error) {
            if (!isSilent) {
                console.error("Error loading screenshots:", error);
                Toast.show("Terjadi kesalahan jaringan", "error");
            }
        } finally {
            this._isFetching = false;
        }
    },

    refreshLive() {
        if (typeof App !== 'undefined' && App.currentTab !== 'screenshot') return;
        return this.load(true);
    },

    syncDelta(newData, oldData) {
        const oldMap = new Map(oldData.map(p => [p.pc_id, p]));

        newData.forEach(pc => {
            const oldPc = oldMap.get(pc.pc_id);
            const cardEl = document.querySelector(`.screenshot-card[data-pcid="${pc.pc_id}"]`);
            if (!cardEl) return;

            const timeChanged = !oldPc || oldPc.screenshot_time !== pc.screenshot_time;
            const urlChanged = !oldPc || oldPc.screenshot_url !== pc.screenshot_url;

            if (timeChanged || urlChanged) {
                // Update waktu update
                const timeEl = cardEl.querySelector('.screenshot-update-time');
                if (timeEl) {
                    timeEl.textContent = pc.screenshot_time || 'N/A';
                }

                // Update container preview gambar tanpa flicker pada PC lain
                const imgContainer = cardEl.querySelector('.screenshot-img-container');
                if (imgContainer) {
                    const hasImage = Boolean(pc.screenshot_url);
                    const resolvedUrl = hasImage && window.API ? API.resolveMediaUrl(pc.screenshot_url) : (pc.screenshot_url || '');

                    if (hasImage) {
                        const existingImg = imgContainer.querySelector('img');
                        if (existingImg) {
                            existingImg.src = `${resolvedUrl}?t=${new Date().getTime()}`;
                        } else {
                            imgContainer.innerHTML = `
                                <img src="${resolvedUrl}?t=${new Date().getTime()}" class="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" alt="Screenshot ${pc.pc_kode}">
                                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                    <svg class="w-5 h-5 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                                </div>
                            `;
                        }
                    } else {
                        imgContainer.innerHTML = `
                            <div class="text-neutral-600 flex flex-col items-center gap-1 p-2 text-center select-none">
                                <svg class="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                <span class="text-[10px] text-neutral-500 font-medium">Belum ada screenshot</span>
                            </div>
                        `;
                    }
                    imgContainer.onclick = () => Screenshot.openLightbox(hasImage ? resolvedUrl : '', pc.pc_kode);
                }
            }
        });
    },

    renderGroupTabs() {
        const tabsContainer = document.getElementById('screenshot-group-tabs');
        if (!tabsContainer) return;

        if (!this.groups || this.groups.length === 0) {
            tabsContainer.innerHTML = '<span class="text-[11px] 2xl:text-xs text-neutral-500 py-1">Belum ada grup PC</span>';
            return;
        }

        const tabsHtml = this.groups.map(g => {
            const count = (this.cachedData || []).filter(p => Number(p.pc_grup_id) === Number(g.id)).length;
            const isActive = Number(this.currentGrupId) === Number(g.id);
            const gColor = g.warna || '#3B82F6';

            if (isActive) {
                return `
                    <button type="button" onclick="Screenshot.selectGroup(${g.id})"
                        class="px-2.5 sm:px-3 2xl:px-3.5 py-1 sm:py-1.5 2xl:py-2 rounded text-xs 2xl:text-sm font-bold transition-all flex items-center gap-1.5 2xl:gap-2 shrink-0 bg-[#161616] text-white border shadow-sm"
                        style="border-color: ${gColor};">
                        <span class="w-2 h-2 2xl:w-2.5 2xl:h-2.5 rounded-full" style="background-color: ${gColor};"></span>
                        <span class="tracking-wide">${Utils.escapeHtml(g.nama.toUpperCase())}</span>
                        <span class="text-[10px] 2xl:text-xs px-1.5 2xl:px-2 py-0.2 2xl:py-0.5 rounded font-mono bg-[#242424] text-neutral-200 font-bold">${count} PC</span>
                    </button>
                `;
            } else {
                return `
                    <button type="button" onclick="Screenshot.selectGroup(${g.id})"
                        class="px-2.5 sm:px-3 2xl:px-3.5 py-1 sm:py-1.5 2xl:py-2 rounded text-xs 2xl:text-sm font-bold transition-all flex items-center gap-1.5 2xl:gap-2 shrink-0 bg-[#0c0c0c] hover:bg-[#141414] text-neutral-400 hover:text-neutral-200 border border-[#1c1c1c]">
                        <span class="w-1.5 h-1.5 2xl:w-2 2xl:h-2 rounded-full opacity-60" style="background-color: ${gColor};"></span>
                        <span class="tracking-wide">${Utils.escapeHtml(g.nama.toUpperCase())}</span>
                        <span class="text-[10px] 2xl:text-xs px-1.5 2xl:px-2 py-0.2 2xl:py-0.5 rounded font-mono bg-[#141414] text-neutral-500 font-semibold">${count} PC</span>
                    </button>
                `;
            }
        }).join('');

        tabsContainer.innerHTML = tabsHtml;
    },

    selectGroup(grupId) {
        this.currentGrupId = Number(grupId);
        this.renderGroupTabs();
        this.renderGrid();
    },

    async triggerActiveGroup() {
        const activeGroup = (this.groups || []).find(g => Number(g.id) === Number(this.currentGrupId));
        const groupName = activeGroup ? activeGroup.nama.toUpperCase() : 'Grup';
        const pcsInGroup = (this.cachedData || []).filter(p => Number(p.pc_grup_id) === Number(this.currentGrupId));

        if (!pcsInGroup.length) {
            Toast.show(`Tidak ada PC aktif di grup ${groupName}`, "info");
            return;
        }

        const confirmed = confirm(`Picu screenshot untuk ${pcsInGroup.length} PC di grup ${groupName}?`);
        if (!confirmed) return;

        try {
            let successCount = 0;
            for (const pc of pcsInGroup) {
                try {
                    await API.request(`/api/v1/kasir/monitor/screenshot/trigger/${pc.pc_id}`, {
                        method: 'POST'
                    });
                    successCount++;
                } catch (e) {
                    console.error(`Gagal trigger PC ${pc.pc_kode}:`, e);
                }
            }
            Toast.show(`Perintah screenshot dikirim ke ${successCount} PC (${groupName})`, "success");
            setTimeout(() => this.load(true), 3000);
        } catch (error) {
            console.error("Error trigger group screenshot:", error);
            Toast.show("Terjadi kesalahan saat memicu screenshot", "error");
        }
    },

    async triggerAll() {
        return this.triggerActiveGroup();
    },

    async triggerSingle(pcId) {
        try {
            const data = await API.request(`/api/v1/kasir/monitor/screenshot/trigger/${pcId}`, {
                method: 'POST'
            });
            if (data && data.success) {
                Toast.show(`Perintah screenshot dikirim`, "success");
                setTimeout(() => this.load(true), 3000);
            } else {
                Toast.show(data?.error || "Gagal mengirim perintah", "error");
            }
        } catch (error) {
            console.error("Error:", error);
            Toast.show("Kesalahan jaringan", "error");
        }
    },

    openLightbox(url, pcKode) {
        if (!url) return;
        const lightbox = document.getElementById('screenshot-lightbox');
        const img = document.getElementById('lightbox-img');
        const title = document.getElementById('lightbox-title');
        if (!lightbox || !img) return;

        img.src = `${url}?t=${new Date().getTime()}`;
        if (title) title.textContent = pcKode;
        lightbox.classList.remove('hidden');
        lightbox.classList.add('flex');
    },

    closeLightbox() {
        const lightbox = document.getElementById('screenshot-lightbox');
        if (lightbox) {
            lightbox.classList.add('hidden');
            lightbox.classList.remove('flex');
        }
    },

    renderGrid() {
        let data = this.cachedData || [];

        // 1. Filter per grup aktif
        if (this.currentGrupId) {
            data = data.filter(pc => Number(pc.pc_grup_id) === Number(this.currentGrupId));
        }

        // 2. Filter status screenshot
        if (this.filterStatus === 'has_screenshot') {
            data = data.filter(pc => Boolean(pc.screenshot_url));
        } else if (this.filterStatus === 'no_screenshot') {
            data = data.filter(pc => !pc.screenshot_url);
        }

        // 3. Filter query pencarian
        if (this.searchQuery) {
            data = data.filter(pc => (pc.pc_kode || '').toLowerCase().includes(this.searchQuery));
        }

        // 4. Urutkan berdasarkan kode PC (alami)
        data.sort((a, b) => {
            return (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' });
        });

        const container = document.getElementById('screenshot-grid');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-12 text-neutral-500 bg-[#080808] border border-dashed border-[#1c1c1c] rounded-xl text-xs sm:text-sm">Tidak ada PC aktif di grup ini</div>`;
            return;
        }

        container.innerHTML = data.map(pc => {
            const hasImage = Boolean(pc.screenshot_url);
            const resolvedUrl = hasImage && window.API ? API.resolveMediaUrl(pc.screenshot_url) : (pc.screenshot_url || '');
            const imageUrl = hasImage ? `${resolvedUrl}?t=${new Date().getTime()}` : '';

            return `
                <div class="screenshot-card w-full h-full flex flex-col bg-[#121212] border border-[#1c1c1c] hover:border-[#2a2a2a] rounded-lg overflow-hidden transition-all shadow-sm" data-pcid="${pc.pc_id}">
                    <div class="flex-1 flex flex-col">
                        <div class="p-1.5 px-2 border-b border-[#1c1c1c] flex justify-between items-center bg-[#171717]">
                            <div class="font-bold text-neutral-200 text-xs tracking-tight truncate">${Utils.escapeHtml(pc.pc_kode)}</div>
                            <button onclick="Screenshot.triggerSingle(${pc.pc_id})" class="text-neutral-400 hover:text-white p-0.5 rounded hover:bg-[#222] transition-colors shrink-0" title="Ambil Ulang Screenshot">
                                <svg class="w-3 h-3 2xl:w-3.5 2xl:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
                            </button>
                        </div>
                        
                        <div class="screenshot-img-container relative w-full aspect-video bg-black flex flex-col items-center justify-center group cursor-pointer" onclick="Screenshot.openLightbox('${hasImage ? resolvedUrl : ''}', '${pc.pc_kode}')">
                        ${hasImage
                    ? `<img src="${imageUrl}" class="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" alt="Screenshot ${pc.pc_kode}">
                       <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                           <svg class="w-5 h-5 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                       </div>`
                    : `<div class="text-neutral-600 flex flex-col items-center gap-1 p-2 text-center select-none">
                           <svg class="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                           <span class="text-[10px] text-neutral-500 font-medium">Belum ada screenshot</span>
                       </div>`
                }
                        </div>
                    </div>
                    
                    <div class="px-2 py-1 text-[10px] 2xl:text-[11px] text-neutral-400 flex justify-between items-center bg-[#0c0c0c] border-t border-[#1c1c1c] mt-auto">
                        <span>Update:</span>
                        <span class="screenshot-update-time font-mono font-medium text-neutral-300 text-[10px]">${pc.screenshot_time || 'N/A'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
};

window.Screenshot = Screenshot;

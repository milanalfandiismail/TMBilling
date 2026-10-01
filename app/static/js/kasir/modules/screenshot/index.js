const Screenshot = {
    cachedData: [],
    searchQuery: '',
    filterStatus: 'all',
    filterGroup: 'all',
    searchTimeout: null,
    _isFetching: false,

    resetState() {
        this.cachedData = [];
        this.searchQuery = '';
        this.filterStatus = 'all';
        this.filterGroup = 'all';
        this._isFetching = false;
    },

    init() {
        if (App.currentTab === 'screenshot') {
            this.bindEvents();
            this.load();
        }
    },

    bindEvents() {
        const searchInput = document.getElementById('screenshot-search');
        const filterSelect = document.getElementById('screenshot-filter');
        const groupFilterSelect = document.getElementById('screenshot-group-filter');

        if (searchInput && !searchInput._boundLive) {
            searchInput._boundLive = true;
            searchInput.addEventListener('input', (e) => {
                if (this.searchTimeout) clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.searchQuery = (e.target.value || '').toLowerCase();
                    this.renderGrid();
                }, 300);
            });
        }

        if (filterSelect && !filterSelect._boundLive) {
            filterSelect._boundLive = true;
            filterSelect.addEventListener('change', (e) => {
                this.filterStatus = e.target.value;
                this.renderGrid();
            });
        }

        if (groupFilterSelect && !groupFilterSelect._boundLive) {
            groupFilterSelect._boundLive = true;
            groupFilterSelect.addEventListener('change', (e) => {
                this.filterGroup = e.target.value;
                this.renderGrid();
            });
        }
    },

    // Backward compatibility jika ada yang memanggil
    startPolling() { },
    stopPolling() { },

    async load(isSilent = false) {
        if (this._isFetching) return;
        this._isFetching = true;

        const container = document.getElementById('screenshot-grid');
        if (!isSilent && (!this.cachedData || !this.cachedData.length) && container && window.Skeleton) {
            container.innerHTML = Skeleton.screenshotCards(8);
        }

        try {
            const data = await API.request('/api/v1/kasir/monitor/screenshot/all');

            if (data && data.success && Array.isArray(data.data)) {
                const newData = data.data;
                const oldData = this.cachedData || [];

                // Cek apakah struktur PC berubah (jumlah / id / susunan PC berbeda)
                const isStructureChanged = oldData.length !== newData.length ||
                    newData.some((p, i) => !oldData[i] || oldData[i].pc_id !== p.pc_id);

                if (isStructureChanged || !isSilent || !oldData.length) {
                    this.cachedData = newData;
                    this.populateGroupFilter();
                    this.renderGrid();
                } else {
                    // Delta check: perbarui hanya kartu PC yang gambar/waktunya berubah
                    this.syncDelta(newData, oldData);
                    this.cachedData = newData;
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
        if (App.currentTab !== 'screenshot') return;
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
                    const hasImage = !!pc.screenshot_url;
                    const resolvedUrl = hasImage && window.API ? API.resolveMediaUrl(pc.screenshot_url) : (pc.screenshot_url || '');

                    if (hasImage) {
                        const existingImg = imgContainer.querySelector('img');
                        if (existingImg) {
                            existingImg.src = `${resolvedUrl}?t=${new Date().getTime()}`;
                        } else {
                            imgContainer.innerHTML = `
                                <img src="${resolvedUrl}?t=${new Date().getTime()}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Screenshot ${pc.pc_kode}">
                                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                    <svg class="w-8 h-8 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                                </div>
                            `;
                        }
                    } else {
                        imgContainer.innerHTML = `
                            <div class="text-neutral-600 flex flex-col items-center gap-2">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                <span class="text-xs">Belum ada screenshot</span>
                            </div>
                        `;
                    }
                    imgContainer.onclick = () => Screenshot.openLightbox(hasImage ? resolvedUrl : '', pc.pc_kode);
                }
            }
        });
    },

    async triggerAll() {
        try {
            if (confirm("Apakah Anda yakin ingin memicu screenshot di semua PC aktif?")) {
                const pcElements = document.querySelectorAll('.screenshot-card');
                let count = 0;
                for (const el of pcElements) {
                    const pcId = el.dataset.pcid;
                    if (pcId) {
                        try {
                            await API.request(`/api/v1/kasir/monitor/screenshot/trigger/${pcId}`, {
                                method: 'POST'
                            });
                            count++;
                        } catch (e) { console.error(e); }
                    }
                }
                Toast.show(`Perintah screenshot dikirim ke ${count} PC`, "success");
                setTimeout(() => this.load(true), 3000);
            }
        } catch (error) {
            console.error("Error trigger all:", error);
            Toast.show("Terjadi kesalahan saat memicu screenshot", "error");
        }
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

    populateGroupFilter() {
        const select = document.getElementById('screenshot-group-filter');
        if (!select) return;

        const currentValue = select.value;
        const groups = new Set();
        this.cachedData.forEach(pc => {
            if (pc.pc_grup_nama) groups.add(pc.pc_grup_nama);
        });

        select.innerHTML = '<option value="all">Semua Grup / Zona</option>';
        [...groups].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).forEach(grup => {
            const opt = document.createElement('option');
            opt.value = grup;
            opt.textContent = grup.toUpperCase();
            select.appendChild(opt);
        });

        if ([...select.options].some(o => o.value === currentValue)) {
            select.value = currentValue;
        } else {
            this.filterGroup = 'all';
        }
    },

    renderGrid() {
        let data = this.cachedData || [];

        if (this.filterGroup !== 'all') {
            data = data.filter(pc => pc.pc_grup_nama === this.filterGroup);
        }

        if (this.filterStatus === 'has_screenshot') {
            data = data.filter(pc => Boolean(pc.screenshot_url));
        } else if (this.filterStatus === 'no_screenshot') {
            data = data.filter(pc => !pc.screenshot_url);
        }

        if (this.searchQuery) {
            data = data.filter(pc => (pc.pc_kode || '').toLowerCase().includes(this.searchQuery));
        }

        data.sort((a, b) => (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' }));

        const container = document.getElementById('screenshot-grid');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-10 text-neutral-500">Tidak ada PC aktif</div>`;
            return;
        }

        container.innerHTML = data.map(pc => {
            const hasImage = Boolean(pc.screenshot_url);
            const resolvedUrl = hasImage && window.API ? API.resolveMediaUrl(pc.screenshot_url) : (pc.screenshot_url || '');
            const imageUrl = hasImage ? `${resolvedUrl}?t=${new Date().getTime()}` : '';

            return `
                <div class="screenshot-card w-full h-full flex flex-col bg-[#121212] border border-[#1c1c1c] rounded overflow-hidden" data-pcid="${pc.pc_id}">
                    <div class="flex-1 flex flex-col">
                        <div class="p-3 border-b border-[#1c1c1c] flex justify-between items-center bg-[#171717]">
                            <div class="font-bold text-neutral-200 text-sm">${pc.pc_kode}</div>
                            <button onclick="Screenshot.triggerSingle(${pc.pc_id})" class="text-neutral-400 hover:text-white p-1 rounded hover:bg-[#222]" title="Ambil Ulang">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
                            </button>
                        </div>
                        
                        <div class="screenshot-img-container relative w-full aspect-video bg-black flex flex-col items-center justify-center group cursor-pointer" onclick="Screenshot.openLightbox('${hasImage ? resolvedUrl : ''}', '${pc.pc_kode}')">
                        ${hasImage
                    ? `<img src="${imageUrl}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Screenshot ${pc.pc_kode}">
                               <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                   <svg class="w-8 h-8 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                               </div>`
                    : `<div class="text-neutral-600 flex flex-col items-center gap-2">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                <span class="text-xs">Belum ada screenshot</span>
                               </div>`
                }
                        </div>
                    </div>
                    
                    <div class="p-3 text-sm text-neutral-400 flex justify-between items-center bg-[#0c0c0c] border-t border-[#1c1c1c] mt-auto">
                        <span>Update:</span>
                        <span class="screenshot-update-time font-medium text-neutral-200">${pc.screenshot_time || 'N/A'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
};

window.Screenshot = Screenshot;

const Screenshot = {
    pollingInterval: null,

    cachedData: [],
    searchQuery: '',
    filterStatus: 'all',
    filterGroup: 'all',
    searchTimeout: null,

    init() {
        if(App.currentTab === 'screenshot') {
            this.bindEvents();
            this.load();
            this.startPolling();
        } else {
            this.stopPolling();
        }
    },

    bindEvents() {
        const searchInput = document.getElementById('screenshot-search');
        const filterSelect = document.getElementById('screenshot-filter');
        const groupFilterSelect = document.getElementById('screenshot-group-filter');

        if(searchInput) {
            searchInput.addEventListener('input', (e) => {
                if(this.searchTimeout) clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.searchQuery = e.target.value.toLowerCase();
                    this.renderGrid();
                }, 300);
            });
        }

        if(filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterStatus = e.target.value;
                this.renderGrid();
            });
        }

        if(groupFilterSelect) {
            groupFilterSelect.addEventListener('change', (e) => {
                this.filterGroup = e.target.value;
                this.renderGrid();
            });
        }
    },

    startPolling() {
        if(this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => {
            if(App.currentTab === 'screenshot') {
                this.load();
            } else {
                this.stopPolling();
            }
        }, 30000); // Poll setiap 30 detik
    },

    stopPolling() {
        if(this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    },

    async load() {
        try {
            const data = await API.request('/api/v1/kasir/monitor/screenshot/all');
            
            if (data.success) {
                this.cachedData = data.data;
                this.populateGroupFilter();
                this.renderGrid();
            } else {
                Toast.show("Gagal memuat screenshot", "error");
            }
        } catch (error) {
            console.error("Error loading screenshots:", error);
            Toast.show("Terjadi kesalahan jaringan", "error");
        }
    },

    async triggerAll() {
        try {
            // Kita bisa iterasi dari data yang ada di grid, atau panggil API spesifik trigger all
            // Untuk simple, kita panggil alert untuk saat ini
            if(confirm("Apakah Anda yakin ingin memicu screenshot di semua PC aktif?")) {
                const pcElements = document.querySelectorAll('.screenshot-card');
                let count = 0;
                for (const el of pcElements) {
                    const pcId = el.dataset.pcid;
                    if(pcId) {
                        try {
                            await API.request(`/api/v1/kasir/monitor/screenshot/trigger/${pcId}`, {
                                method: 'POST'
                            });
                            count++;
                        } catch(e) { console.error(e); }
                    }
                }
                Toast.show(`Perintah screenshot dikirim ke ${count} PC`, "success");
                setTimeout(() => this.load(), 5000); // Reload setelah 5 detik
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
            if(data.success) {
                Toast.show(`Perintah screenshot dikirim`, "success");
                setTimeout(() => this.load(), 5000);
            } else {
                Toast.show(data.error || "Gagal mengirim perintah", "error");
            }
        } catch (error) {
            console.error("Error:", error);
            Toast.show("Kesalahan jaringan", "error");
        }
    },

    openLightbox(url, pcKode) {
        if(!url) return;
        const lightbox = document.getElementById('screenshot-lightbox');
        const img = document.getElementById('lightbox-img');
        const title = document.getElementById('lightbox-title');
        
        img.src = `${url}?t=${new Date().getTime()}`; // Bypass cache
        title.textContent = pcKode;
        lightbox.classList.remove('hidden');
        lightbox.classList.add('flex');
    },

    closeLightbox() {
        const lightbox = document.getElementById('screenshot-lightbox');
        lightbox.classList.add('hidden');
        lightbox.classList.remove('flex');
    },

    populateGroupFilter() {
        const select = document.getElementById('screenshot-group-filter');
        if(!select) return;
        
        // Simpan value saat ini
        const currentValue = select.value;
        
        // Ambil unique grup dari data
        const groups = new Set();
        this.cachedData.forEach(pc => {
            if(pc.pc_grup_nama) groups.add(pc.pc_grup_nama);
        });

        // Rebuild options
        select.innerHTML = '<option value="all">Semua Grup / Zona</option>';
        [...groups].sort().forEach(grup => {
            const opt = document.createElement('option');
            opt.value = grup;
            opt.textContent = grup.toUpperCase();
            select.appendChild(opt);
        });
        
        // Kembalikan value sebelumnya jika ada
        if([...select.options].some(o => o.value === currentValue)) {
            select.value = currentValue;
        } else {
            this.filterGroup = 'all';
        }
    },

    renderGrid() {
        let data = this.cachedData || [];
        
        // Apply group filter
        if (this.filterGroup !== 'all') {
            data = data.filter(pc => pc.pc_grup_nama === this.filterGroup);
        }
        
        // Apply filter
        if (this.filterStatus === 'has_screenshot') {
            data = data.filter(pc => !!pc.screenshot_url);
        } else if (this.filterStatus === 'no_screenshot') {
            data = data.filter(pc => !pc.screenshot_url);
        }

        // Apply search
        if (this.searchQuery) {
            data = data.filter(pc => pc.pc_kode.toLowerCase().includes(this.searchQuery));
        }

        const container = document.getElementById('screenshot-grid');
        if (!data || data.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-10 text-neutral-500">Tidak ada PC aktif</div>`;
            return;
        }

        container.innerHTML = data.map(pc => {
            const hasImage = !!pc.screenshot_url;
            const imageUrl = hasImage ? `${pc.screenshot_url}?t=${new Date().getTime()}` : '';
            
            return `
                <div class="screenshot-card w-full h-full flex flex-col bg-[#121212] border border-[#1c1c1c] rounded overflow-hidden" data-pcid="${pc.pc_id}">
                    <div class="flex-1 flex flex-col">
                        <div class="p-3 border-b border-[#1c1c1c] flex justify-between items-center bg-[#171717]">
                            <div class="font-bold text-neutral-200 text-sm">${pc.pc_kode}</div>
                            <button onclick="Screenshot.triggerSingle(${pc.pc_id})" class="text-neutral-400 hover:text-white p-1 rounded hover:bg-[#222]" title="Ambil Ulang">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
                            </button>
                        </div>
                        
                        <div class="relative w-full aspect-video bg-black flex flex-col items-center justify-center group cursor-pointer" onclick="Screenshot.openLightbox('${hasImage ? pc.screenshot_url : ''}', '${pc.pc_kode}')">
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
                        <span class="font-medium text-neutral-200">${pc.screenshot_time || 'N/A'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
};

window.Screenshot = Screenshot;

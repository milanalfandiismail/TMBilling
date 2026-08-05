// app/static/js/public/tv.js

class TVSignage {
    constructor() {
        this.data = null;
        this.currentSlideIndex = 0;
        this.activeSlides = [];
        this.slideInterval = null;
        this.progressInterval = null;
        this.slideDuration = 15000; // default 15s
        this.slideStartTime = 0;

        this.init();
    }

    async init() {
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        // Initial fetch
        await this.fetchData();
        
        // Start polling background data
        setInterval(() => this.fetchData(), 10000);

        // Start carousel rotation
        this.startCarousel();

    }

    updateClock() {
        const now = new Date();
        
        // Format clock: HH:MM:SS
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        const tzAbbr = (this.data && this.data.settings && this.data.settings.timezone_abbr) || 'WIB';
        document.getElementById('current-clock').innerText = `${hours}:${minutes}:${seconds} ${tzAbbr}`;

        // Format Date Indonesian: HARI, TGL BULAN THN
        const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
        const months = [
            'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
            'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
        ];
        
        const dayName = days[now.getDay()];
        const date = now.getDate();
        const monthName = months[now.getMonth()];
        const year = now.getFullYear();

        document.getElementById('current-date').innerText = `${dayName}, ${date} ${monthName} ${year}`;
    }

    async fetchData() {
        try {
            const res = await fetch('/api/v1/public/tv/data');
            const result = await res.json();
            
            if (result.success) {
                this.data = result.data;
                this.renderAll();
            }
        } catch (e) {
            console.error('Error fetching TV Signage data:', e);
        }
    }

    renderAll() {
        if (!this.data) return;

        // 1. Render Header Stats & Title
        const occ = this.data.occupancy;
        // PC Tersedia (kosong) / total_pc
        document.getElementById('stat-occupancy').innerText = `${occ.pc_kosong} / ${occ.total_pc}`;
        document.getElementById('stat-utilization').innerText = `${occ.utilisasi}%`;

        // Update Warnet Title, Logo, and Ticker Label
        if (this.data.settings) {
            const wName = this.data.settings.warnet_title || 'TMBilling';
            const titleEl = document.getElementById('warnet-title');
            if (titleEl) {
                titleEl.innerText = wName;
            }
            const logoEl = document.getElementById('warnet-logo');
            if (logoEl) {
                logoEl.innerText = this.getInitials(wName);
            }
            const tickerLabelEl = document.getElementById('ticker-label');
            if (tickerLabelEl) {
                tickerLabelEl.innerText = wName;
            }
        }

        // 2. Render Ticker
        const tickerContainer = document.getElementById('tv-running-text-container');
        const tickerEl = document.getElementById('ticker-text');
        if (tickerEl && this.data.settings) {
            const runningText = this.data.settings.running_text;
            if (runningText && runningText.trim().length > 0) {
                tickerEl.innerText = runningText;
                if (tickerContainer) tickerContainer.classList.remove('hidden');
            } else {
                if (tickerContainer) tickerContainer.classList.add('hidden');
            }
        }

        // 3. Update dynamic configurations & slide listing
        if (this.data.settings) {
            this.slideDuration = (this.data.settings.slide_duration || 15) * 1000;
            
            // Extract PC groups
            const pcs = this.data.pc_list || [];
            const pcGroupsMap = {};
            pcs.forEach(pc => {
                const g = pc.grup || 'Reguler';
                if (!pcGroupsMap[g]) pcGroupsMap[g] = [];
                pcGroupsMap[g].push(pc);
            });
            const pcGroupsList = Object.keys(pcGroupsMap).sort();
            const pcSlideIds = pcs.length > 0
                ? pcGroupsList.map(g => `slide-pc-${g.toLowerCase().replace(/[^a-z0-9]/g, '-')}`)
                : ['slide-pc-empty'];

            // Extract Promo groups
            const promos = this.data.promos || [];
            const promoGroupsMap = {};
            promos.forEach(p => {
                const g = p.grup || 'Reguler';
                if (!promoGroupsMap[g]) promoGroupsMap[g] = [];
                promoGroupsMap[g].push(p);
            });
            const promoGroupsList = Object.keys(promoGroupsMap).sort();
            const promoSlideIds = promos.length > 0 
                ? promoGroupsList.map(g => `slide-promos-${g.toLowerCase().replace(/[^a-z0-9]/g, '-')}`)
                : ['slide-promos-empty'];

            // Adjust active slides based on config
            const enabledIndices = this.data.settings.slides_enabled || [1, 3, 4];
            
            const newActiveSlides = [];
            
            if (enabledIndices.includes(1)) {
                newActiveSlides.push(...pcSlideIds);
            }
            if (enabledIndices.includes(3)) {
                newActiveSlides.push(...promoSlideIds);
            }
            if (enabledIndices.includes(4)) {
                newActiveSlides.push('slide-rules');
            }
            
            if (newActiveSlides.length === 0) {
                newActiveSlides.push('slide-pc-empty');
            }

            // Sync slide visibility if slides changed
            const slidesChanged = JSON.stringify(this.activeSlides) !== JSON.stringify(newActiveSlides);
            if (slidesChanged) {
                // Hide currently showing slide if it's no longer active
                const currentSlideId = this.activeSlides[this.currentSlideIndex];
                if (currentSlideId) {
                    const currentEl = document.getElementById(currentSlideId);
                    if (currentEl) {
                        currentEl.classList.add('hidden');
                        currentEl.classList.remove('slide-fade-active');
                    }
                }

                this.activeSlides = newActiveSlides;
                this.currentSlideIndex = 0;
                
                // Show first slide in new list
                const firstSlideId = this.activeSlides[0];
                if (firstSlideId) {
                    const firstEl = document.getElementById(firstSlideId);
                    if (firstEl) {
                        firstEl.classList.remove('hidden');
                        void firstEl.offsetWidth;
                        firstEl.classList.add('slide-fade-active');
                    }
                }
                this.slideStartTime = Date.now();
                this.resetProgressBar();
            }
        }

        // 4. Render Individual Slides
        this.renderPCGrid();
        this.renderPromos();
        this.renderRules();
    }

    renderPCGrid() {
        const container = document.getElementById('dynamic-pc-container');
        if (!container) return;

        const pcs = this.data.pc_list || [];
        if (pcs.length === 0) {
            container.innerHTML = `
                <div id="slide-pc-empty" class="w-full h-full flex flex-col justify-start absolute inset-0 slide-fade-enter hidden">
                    <div class="mb-6"><h2 class="text-xl font-extrabold text-neutral-300">Live Komputer Map & Status</h2></div>
                    <div class="flex-1 flex items-center justify-center text-neutral-500 py-12">Tidak ada unit PC terdaftar</div>
                </div>
            `;
            return;
        }

        // Group PCs
        const pcGroups = {};
        pcs.forEach(pc => {
            const g = pc.grup || 'Reguler';
            if (!pcGroups[g]) pcGroups[g] = [];
            pcGroups[g].push(pc);
        });

        const pcGroupNames = Object.keys(pcGroups).sort();

        // Calculate if we need to show/activate the first one (fallback)
        const isCurrentActive = (id) => this.activeSlides[this.currentSlideIndex] === id;

        container.innerHTML = pcGroupNames.map(g => {
            const slideId = `slide-pc-${g.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            const groupPcs = pcGroups[g];
            const groupColor = (this.data && this.data.grup_meta && this.data.grup_meta[g] && this.data.grup_meta[g].warna) || '#3b82f6';

            const gridHtml = groupPcs.map(pc => {
                let statusClass = '';
                let customStyle = '';
                let subtitle = 'Offline';
                let durationText = '';

                const status = pc.status || 'offline';
                const isOnline = pc.status_koneksi === 'online';

                if (status === 'kosong') {
                    if (isOnline) {
                        statusClass = 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400 glow-green';
                        subtitle = 'READY';
                    } else {
                        statusClass = 'bg-[#141414] border-neutral-900 text-neutral-600 opacity-50';
                        subtitle = 'OFFLINE';
                    }
                } else if (status === 'terpakai') {
                    // Group color matching for active sessions
                    statusClass = '';
                    customStyle = `background-color: ${groupColor}10; border-color: ${groupColor}40; color: ${groupColor}; box-shadow: 0 0 15px ${groupColor}15;`;
                    subtitle = pc.sesi_detail ? pc.sesi_detail.nama : 'GUEST';
                    
                    if (pc.sesi_detail && pc.sesi_detail.sisa_waktu_menit !== undefined) {
                        const mins = pc.sesi_detail.sisa_waktu_menit;
                        if (mins <= 0) {
                            durationText = 'Habis';
                        } else if (mins >= 1440) {
                            durationText = 'Bebas';
                        } else {
                            const h = Math.floor(mins / 60);
                            const m = mins % 60;
                            durationText = h > 0 ? `${h}j` : `${m}m`;
                        }
                    }
                } else if (status === 'admin') {
                    statusClass = 'bg-amber-950/20 border-amber-800/40 text-amber-400 glow-yellow';
                    subtitle = 'ADMIN';
                } else {
                    // Fallback / Offline
                    statusClass = 'bg-[#141414] border-neutral-900 text-neutral-600 opacity-50';
                    subtitle = 'OFFLINE';
                }

                const styleAttr = customStyle ? `style="${customStyle}"` : '';

                return `
                    <div class="border rounded-xl p-3 flex flex-col justify-between h-20 transition-all ${statusClass}" ${styleAttr}>
                        <div class="flex justify-between items-start">
                            <span class="text-xs font-black tracking-wider uppercase">${pc.kode}</span>
                            ${durationText ? `<span class="text-[10px] font-black uppercase tracking-wider mono bg-neutral-900/40 px-1.5 py-0.5 rounded" style="color: ${groupColor}; border: 1px solid ${groupColor}25;">${durationText}</span>` : ''}
                        </div>
                        <div class="text-[9px] font-bold uppercase tracking-wider truncate text-neutral-400">
                            ${subtitle}
                        </div>
                    </div>
                `;
            }).join('');

            const visibilityClass = isCurrentActive(slideId) ? 'slide-fade-active' : 'hidden';

            return `
                <div id="${slideId}" class="w-full h-full flex flex-col justify-start absolute inset-0 slide-fade-enter ${visibilityClass}">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-extrabold text-neutral-300 uppercase tracking-wider flex items-center gap-3">
                            <span class="w-2.5 h-2.5 rounded-full animate-pulse" style="background-color: ${groupColor}"></span>
                            Status Komputer - ${g.toUpperCase()}
                        </h2>
                        <!-- Legend -->
                        <div class="flex items-center gap-4 text-xs font-semibold text-neutral-400">
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-emerald-500"></span> Kosong</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded" style="background-color: ${groupColor}"></span> Terpakai</span>
                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-neutral-800 opacity-50"></span> Offline</span>
                        </div>
                    </div>
                    <div class="flex-1 overflow-hidden min-h-0">
                        <div class="grid grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4 h-full overflow-y-auto hide-scrollbar content-start pb-6">
                            ${gridHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }



    renderPromos() {
        const container = document.getElementById('dynamic-promos-container');
        if (!container) return;

        const promos = this.data.promos || [];
        if (promos.length === 0) {
            container.innerHTML = `
                <div id="slide-promos-empty" class="w-full h-full flex flex-col justify-start absolute inset-0 slide-fade-enter hidden">
                    <div class="mb-6">
                        <h2 class="text-xl font-extrabold text-neutral-300 uppercase tracking-wider">🎟️ Daftar Paket Billing</h2>
                    </div>
                    <div class="flex-1 flex items-center justify-center text-neutral-500 py-12">Tidak ada paket aktif</div>
                </div>
            `;
            return;
        }

        // Group packages
        const groupsMap = {};
        promos.forEach(p => {
            const g = p.grup || 'Reguler';
            if (!groupsMap[g]) groupsMap[g] = [];
            groupsMap[g].push(p);
        });

        const groupsList = Object.keys(groupsMap).sort();
        const isCurrentActive = (id) => this.activeSlides[this.currentSlideIndex] === id;

        // Generate HTML for each group slide
        container.innerHTML = groupsList.map(g => {
            const slideId = `slide-promos-${g.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            const groupPackages = groupsMap[g];
            const groupColor = (this.data && this.data.grup_meta && this.data.grup_meta[g] && this.data.grup_meta[g].warna) || '#3b82f6';

            const cardsHtml = groupPackages.map(p => {
                const priceFormatted = new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    maximumFractionDigits: 0
                }).format(p.harga);

                const hours = Math.floor(p.durasi_menit / 60);
                const durationText = hours > 0 ? `${hours} Jam` : `${p.durasi_menit} Menit`;

                return `
                    <div class="bg-neutral-950/40 border border-neutral-900 rounded-2xl p-6 flex flex-col justify-between h-44 hover:border-neutral-800 transition-all" style="border-color: ${groupColor}25;">
                        <div>
                            <span class="text-[10px] font-black uppercase tracking-wider" style="color: ${groupColor};">${p.grup || 'Reguler'}</span>
                            <h3 class="text-base font-black text-neutral-100 mt-1 line-clamp-2">${p.nama}</h3>
                        </div>
                        <div class="border-t border-neutral-900/50 pt-4 flex justify-between items-end">
                            <div>
                                <p class="text-[9px] text-neutral-500 uppercase font-bold tracking-wider">Durasi</p>
                                <p class="text-sm font-black text-neutral-300 mt-0.5">${durationText}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-[9px] text-neutral-500 uppercase font-bold tracking-wider">Harga</p>
                                <p class="text-base font-black text-neutral-100 mt-0.5 mono" style="color: ${groupColor};">${priceFormatted}</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            const visibilityClass = isCurrentActive(slideId) ? 'slide-fade-active' : 'hidden';

            return `
                <div id="${slideId}" class="w-full h-full flex flex-col justify-start absolute inset-0 slide-fade-enter ${visibilityClass}">
                    <div class="mb-6">
                        <h2 class="text-xl font-extrabold text-neutral-300 uppercase tracking-wider flex items-center gap-3">
                            🎟️ Daftar Paket Billing - ${g.toUpperCase()}
                        </h2>
                        <p class="text-xs text-neutral-500 mt-1 font-medium">Beli paket billing di kasir untuk harga lebih hemat</p>
                    </div>
                    <div class="flex-1 overflow-hidden min-h-0">
                        <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 h-full overflow-y-auto hide-scrollbar content-start pb-6">
                            ${cardsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderRules() {
        const container = document.getElementById('rules-list-container');
        if (!container) return;

        const rules = (this.data.settings && this.data.settings.warnet_rules) || [];
        if (rules.length === 0) {
            container.innerHTML = '<li class="text-neutral-500">Tidak ada pengumuman tertulis</li>';
            return;
        }

        container.innerHTML = rules.map(rule => {
            return `<li class="flex items-start gap-3">
                <span class="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0"></span>
                <span>${rule}</span>
            </li>`;
        }).join('');
    }

    startCarousel() {
        const rotate = () => {
            if (this.activeSlides.length === 0) return;

            // Hide current slide
            const prevSlideId = this.activeSlides[this.currentSlideIndex];
            const prevSlideEl = document.getElementById(prevSlideId);
            if (prevSlideEl) {
                prevSlideEl.classList.add('hidden');
                prevSlideEl.classList.remove('slide-fade-active');
            }

            // Go to next slide
            this.currentSlideIndex = (this.currentSlideIndex + 1) % this.activeSlides.length;

            const nextSlideId = this.activeSlides[this.currentSlideIndex];
            const nextSlideEl = document.getElementById(nextSlideId);
            if (nextSlideEl) {
                nextSlideEl.classList.remove('hidden');
                // Trigger reflow for transition
                void nextSlideEl.offsetWidth;
                nextSlideEl.classList.add('slide-fade-active');
            }

            this.slideStartTime = Date.now();
            this.resetProgressBar();
        };

        this.slideStartTime = Date.now();
        this.resetProgressBar();

        this.slideInterval = setInterval(rotate, this.slideDuration);

        // Progress bar ticks every 100ms
        this.progressInterval = setInterval(() => {
            const elapsed = Date.now() - this.slideStartTime;
            const percentage = Math.min((elapsed / this.slideDuration) * 100, 100);
            const progressEl = document.getElementById('slide-progress');
            if (progressEl) {
                progressEl.style.width = `${percentage}%`;
            }
        }, 100);
    }

    resetProgressBar() {
        const progressEl = document.getElementById('slide-progress');
        if (progressEl) {
            progressEl.style.width = '0%';
        }
    }

    getInitials(name) {
        if (!name) return 'TM';
        const words = name.trim().split(/\s+/);
        if (words.length >= 2) {
            return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }
}

// Instantiate TV Signage display when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.tvSignage = new TVSignage();
});

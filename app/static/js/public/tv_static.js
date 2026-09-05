// app/static/js/public/tv_static.js

/**
 * TV Static Signage Dashboard (Widescreen 16:9 No-Scale & No-Scroll)
 * Dilengkapi Independent Conditional Cycling, Paginasi Batch Bebas Truncate,
 * serta Harmonisasi Warna Status PC (100% konsisten dengan /public livepc).
 */
class TVStaticSignage {
    constructor() {
        this.data = null;

        // State untuk Independent Playlists
        this.promoPlaylist = [];
        this.currentPromoIndex = 0;
        this.promoTimer = null;

        this.pcPlaylist = [];
        this.currentPcIndex = 0;
        this.pcTimer = null;

        this.kantinPlaylist = [];
        this.currentKantinIndex = 0;
        this.kantinTimer = null;

        const getLayoutKey = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            const wKey = w >= 1536 ? '2xl' : (w >= 1280 ? 'xl' : (w >= 1024 ? 'lg' : 'sm'));
            const hKey = h < 850 ? 'low' : 'norm';
            return `${wKey}-${hKey}`;
        };

        this.lastLayoutKey = getLayoutKey();

        this.init();
    }

    init() {
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        this.fetchData();
        setInterval(() => this.fetchData(), 10000);

        // Window resize listener untuk menyesuaikan kapasitas batch layar (lebar & tinggi)
        window.addEventListener('resize', () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            const wKey = w >= 1536 ? '2xl' : (w >= 1280 ? 'xl' : (w >= 1024 ? 'lg' : 'sm'));
            const hKey = h < 850 ? 'low' : 'norm';
            const currentKey = `${wKey}-${hKey}`;

            if (currentKey !== this.lastLayoutKey) {
                this.lastLayoutKey = currentKey;
                if (this.data) {
                    this.buildAllPlaylists();
                    this.renderAll();
                }
            }
        });
    }

    /**
     * Konfigurasi Kapasitas Batch Berdasarkan Breakpoints Standar Tailwind CSS & Tinggi Layar
     * - 2xl (>= 1536px, Smart TV 1080p & 4K): 8 paket (2 kolom), 20 PC (5 kolom), 8 menu.
     * - xl (1280px - 1535px, Monitor Lebar): 4 paket (1 kolom), 16 PC (4 kolom), 4 menu.
     * - lg (1024px - 1279px, Monitor Kompak/1024p): 3/4 paket (1 kolom), 12 PC (3 kolom), 3/4 menu.
     * - sm (< 1024px): 3/4 paket (1 kolom), 8 PC (2 kolom), 3/4 menu.
     */
    getBatchConfig() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        const is2xl = w >= 1536;
        const isXl = w >= 1280 && w < 1536;
        const isLg = w >= 1024 && w < 1280;

        const isLowHeight = h < 850;
        const compactChunk = isLowHeight ? 3 : 4;

        if (is2xl) {
            return {
                promoChunkSize: isLowHeight ? 6 : 8,
                promoCols: 'grid-cols-2',
                pcChunkSize: isLowHeight ? 15 : 20,
                pcCols: 'grid-cols-5',
                kantinChunkSize: isLowHeight ? 6 : 8,
                kantinCols: 'grid-cols-2'
            };
        } else if (isXl) {
            return {
                promoChunkSize: compactChunk,
                promoCols: 'grid-cols-1',
                pcChunkSize: 16,
                pcCols: 'grid-cols-4',
                kantinChunkSize: compactChunk,
                kantinCols: 'grid-cols-1'
            };
        } else if (isLg) {
            return {
                promoChunkSize: compactChunk,
                promoCols: 'grid-cols-1',
                pcChunkSize: 12,
                pcCols: 'grid-cols-3',
                kantinChunkSize: compactChunk,
                kantinCols: 'grid-cols-1'
            };
        } else {
            return {
                promoChunkSize: compactChunk,
                promoCols: 'grid-cols-1',
                pcChunkSize: 8,
                pcCols: 'grid-cols-2',
                kantinChunkSize: compactChunk,
                kantinCols: 'grid-cols-1'
            };
        }
    }

    updateClock() {
        const now = new Date();

        // Format jam: HH:MM:SS
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        const tzAbbr = (this.data && this.data.settings && this.data.settings.timezone_abbr) || 'WIB';
        const clockEl = document.getElementById('current-clock');
        if (clockEl) {
            clockEl.innerText = `${hours}:${minutes}:${seconds} ${tzAbbr}`;
        }

        // Format Tanggal Indonesia: HARI, TGL BULAN THN
        const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
        const months = [
            'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
            'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
        ];

        const dayName = days[now.getDay()];
        const date = now.getDate();
        const monthName = months[now.getMonth()];
        const year = now.getFullYear();

        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            dateEl.innerText = `${dayName}, ${date} ${monthName} ${year}`;
        }
    }

    async fetchData() {
        try {
            const res = await fetch('/api/v1/public/tv/data');
            const result = await res.json();

            if (result.success) {
                this.data = result.data;
                this.buildAllPlaylists();
                this.renderAll();
            }
        } catch (e) {
            console.error('Error fetching TV Static data:', e);
        }
    }

    buildAllPlaylists() {
        if (!this.data) return;
        const config = this.getBatchConfig();

        // 1. Build Playlist Paket Billing
        this.buildPromoPlaylist(config.promoChunkSize);

        // 2. Build Playlist PC Map
        this.buildPcPlaylist(config.pcChunkSize);

        // 3. Build Playlist Kantin Menu
        this.buildKantinPlaylist(config.kantinChunkSize);
    }

    buildPromoPlaylist(chunkSize) {
        const promos = this.data.promos || [];
        if (promos.length === 0) {
            this.promoPlaylist = [];
            return;
        }

        // Kelompokkan paket berdasarkan grup
        const promoGroups = {};
        promos.forEach(p => {
            const g = p.grup || 'Reguler';
            if (!promoGroups[g]) promoGroups[g] = [];
            promoGroups[g].push(p);
        });

        const groupNames = Object.keys(promoGroups).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );

        const playlist = [];
        groupNames.forEach(g => {
            const items = promoGroups[g] || [];
            items.sort((a, b) => (a.durasi_menit || 0) - (b.durasi_menit || 0) || (a.harga || 0) - (b.harga || 0));

            const groupColor = (this.data.grup_meta && this.data.grup_meta[g] && this.data.grup_meta[g].warna) || '#3b82f6';
            const totalPages = Math.ceil(items.length / chunkSize);

            for (let i = 0; i < totalPages; i++) {
                const chunk = items.slice(i * chunkSize, (i + 1) * chunkSize);
                playlist.push({
                    groupName: g,
                    groupColor,
                    pageIndex: i + 1,
                    totalPages,
                    items: chunk
                });
            }
        });

        this.promoPlaylist = playlist;
        if (this.currentPromoIndex >= this.promoPlaylist.length) {
            this.currentPromoIndex = 0;
        }
    }

    buildPcPlaylist(chunkSize) {
        const pcs = this.data.pc_list || [];
        if (pcs.length === 0) {
            this.pcPlaylist = [];
            return;
        }

        // Jika seluruh PC muat dalam 1 halaman batch, satukan langsung (100% statis tanpa cycle)
        if (pcs.length <= chunkSize) {
            this.pcPlaylist = [{
                isAllSingleView: true,
                groupName: 'Semua PC',
                pageIndex: 1,
                totalPages: 1,
                pcs: pcs
            }];
            this.currentPcIndex = 0;
            return;
        }

        // Kelompokkan PC berdasarkan grup
        const pcGroups = {};
        pcs.forEach(pc => {
            const g = pc.grup || 'Reguler';
            if (!pcGroups[g]) pcGroups[g] = [];
            pcGroups[g].push(pc);
        });

        const groupNames = Object.keys(pcGroups).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );

        const playlist = [];
        groupNames.forEach(g => {
            const groupPcs = pcGroups[g] || [];
            groupPcs.sort((a, b) =>
                (a.kode || a.nama || '').localeCompare(b.kode || b.nama || '', undefined, { numeric: true, sensitivity: 'base' })
            );

            const groupColor = (this.data.grup_meta && this.data.grup_meta[g] && this.data.grup_meta[g].warna) || '#3b82f6';
            const totalPages = Math.ceil(groupPcs.length / chunkSize);

            for (let i = 0; i < totalPages; i++) {
                const chunk = groupPcs.slice(i * chunkSize, (i + 1) * chunkSize);
                playlist.push({
                    isAllSingleView: false,
                    groupName: g,
                    groupColor,
                    pageIndex: i + 1,
                    totalPages,
                    pcs: chunk
                });
            }
        });

        this.pcPlaylist = playlist;
        if (this.currentPcIndex >= this.pcPlaylist.length) {
            this.currentPcIndex = 0;
        }
    }

    buildKantinPlaylist(chunkSize) {
        const items = this.data.menu_items || [];
        if (items.length === 0) {
            this.kantinPlaylist = [];
            return;
        }

        const totalPages = Math.ceil(items.length / chunkSize);
        const playlist = [];

        for (let i = 0; i < totalPages; i++) {
            const chunk = items.slice(i * chunkSize, (i + 1) * chunkSize);
            playlist.push({
                pageIndex: i + 1,
                totalPages,
                items: chunk
            });
        }

        this.kantinPlaylist = playlist;
        if (this.currentKantinIndex >= this.kantinPlaylist.length) {
            this.currentKantinIndex = 0;
        }
    }

    renderAll() {
        if (!this.data) return;

        // 1. Render Header Stats & Running Text
        const occ = this.data.occupancy || {};
        const statOcc = document.getElementById('stat-occupancy');
        if (statOcc) {
            statOcc.innerText = `${occ.pc_kosong ?? '-'} / ${occ.total_pc ?? '-'}`;
        }
        const statOccSm = document.getElementById('stat-occupancy-sm');
        if (statOccSm) {
            statOccSm.innerText = `${occ.pc_kosong ?? '-'} / ${occ.total_pc ?? '-'}`;
        }
        const statUtil = document.getElementById('stat-utilization');
        if (statUtil) {
            statUtil.innerText = `${occ.utilisasi ?? 0}%`;
        }

        if (this.data.settings) {
            const wName = this.data.settings.warnet_title || 'TMBilling';
            const titleEl = document.getElementById('warnet-title');
            if (titleEl) titleEl.innerText = wName;
            const logoEl = document.getElementById('warnet-logo');
            if (logoEl) logoEl.innerText = this.getInitials(wName);

            const runningTextEl = document.getElementById('tv-running-text');
            if (runningTextEl) {
                const text = this.data.settings.running_text || 'Selamat datang di TMBilling! Nikmati koneksi internet ultra cepat, hardware gaming premium, dan kenyamanan terbaik.';
                runningTextEl.innerText = text;
            }
        }

        // Total PC & Promo badges
        const totalPcBadge = document.getElementById('total-pc-badge');
        if (totalPcBadge) {
            totalPcBadge.innerText = `${(this.data.pc_list || []).length} PC`;
        }
        const promoCountBadge = document.getElementById('promo-count-badge');
        if (promoCountBadge) {
            promoCountBadge.innerText = `${(this.data.promos || []).length} Paket`;
        }
        const kantinCountBadge = document.getElementById('kantin-count-badge');
        if (kantinCountBadge) {
            kantinCountBadge.innerText = `${(this.data.menu_items || []).length} Menu`;
        }

        // 2. Render Komponen dengan Independent Cycling
        this.handlePromoCycling();
        this.handlePcCycling();
        this.handleKantinCycling();
    }

    // ==========================================
    // 🏷️ PAKET BILLING (Independent Cycling)
    // ==========================================
    handlePromoCycling() {
        const pageBadge = document.getElementById('promo-page-badge');
        const isCyclingNeeded = this.promoPlaylist.length > 1;

        if (!isCyclingNeeded) {
            // Statis Total: Hentikan timer jika ada, sembunyikan badge paginasi
            if (this.promoTimer) {
                clearInterval(this.promoTimer);
                this.promoTimer = null;
            }
            if (pageBadge) pageBadge.classList.add('hidden');
            this.renderPromoPage(0);
        } else {
            // Auto-Cycling: Tampilkan badge paginasi dan jalankan timer 7 detik jika belum jalan
            if (pageBadge) pageBadge.classList.remove('hidden');
            this.renderPromoPage(this.currentPromoIndex);

            if (!this.promoTimer) {
                this.promoTimer = setInterval(() => {
                    this.currentPromoIndex = (this.currentPromoIndex + 1) % this.promoPlaylist.length;
                    this.renderPromoPage(this.currentPromoIndex, true);
                }, 7000);
            }
        }
    }

    renderPromoPage(pageIndex, withFade = false) {
        const container = document.getElementById('promo-groups-row');
        const headerTitle = document.getElementById('promo-header-title');
        const pageBadge = document.getElementById('promo-page-badge');
        if (!container) return;

        if (this.promoPlaylist.length === 0) {
            container.innerHTML = '<div class="flex items-center justify-center h-full text-neutral-500 py-8 text-xs font-medium">Tidak ada paket billing aktif</div>';
            return;
        }

        const page = this.promoPlaylist[pageIndex] || this.promoPlaylist[0];
        const config = this.getBatchConfig();

        // Update header & badge
        if (headerTitle) {
            headerTitle.innerText = `Paket ${page.groupName.toUpperCase()}`;
        }
        if (pageBadge) {
            if (page.totalPages > 1) {
                pageBadge.innerText = `Hal ${page.pageIndex}/${page.totalPages}`;
                pageBadge.style.color = page.groupColor;
                pageBadge.style.borderColor = `${page.groupColor}40`;
                pageBadge.style.backgroundColor = `${page.groupColor}15`;
                pageBadge.classList.remove('hidden');
            } else {
                pageBadge.classList.add('hidden');
            }
        }

        const renderHtml = () => {
            const isSingleCol = config.promoCols === 'grid-cols-1';
            const containerClass = isSingleCol 
                ? 'flex flex-col gap-2 content-start overflow-hidden' 
                : `grid ${config.promoCols} gap-2 content-start overflow-hidden`;

            container.innerHTML = `
                <div class="${containerClass}">
                    ${page.items.map(p => {
                        const priceFormatted = new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: 'IDR',
                            maximumFractionDigits: 0
                        }).format(p.harga);

                        const hours = Math.floor(p.durasi_menit / 60);
                        const durationText = hours > 0 
                            ? (p.durasi_menit % 60 > 0 ? `${hours}j ${p.durasi_menit % 60}m` : `${hours} Jam`)
                            : `${p.durasi_menit} Menit`;

                        // Batasi nama paket maksimal 20 huruf agar selalu 1 baris rapi
                        const displayName = (p.nama && p.nama.length > 20) 
                            ? p.nama.substring(0, 20).trim() + '...' 
                            : (p.nama || '');

                        return `
                            <div class="h-14 bg-neutral-900/50 border border-neutral-800/80 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-sm transition-all hover:border-neutral-700">
                                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style="background-color: ${page.groupColor}15; border: 1px solid ${page.groupColor}35;">
                                    ⏱️
                                </div>
                                <div class="min-w-0 flex-1 flex flex-col justify-center pt-0.5">
                                    <h4 class="text-xs sm:text-sm font-black text-neutral-100 leading-snug truncate" title="${p.nama}">${displayName}</h4>
                                    <div class="flex items-center justify-between gap-2 mt-1">
                                        <span class="text-[10px] text-neutral-400 leading-none font-semibold uppercase tracking-wider whitespace-nowrap">${durationText}</span>
                                        <span class="text-xs sm:text-sm font-black mono text-emerald-400 leading-none whitespace-nowrap shrink-0">${priceFormatted}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        };

        if (withFade) {
            container.classList.add('opacity-0');
            setTimeout(() => {
                renderHtml();
                container.classList.remove('opacity-0');
            }, 150);
        } else {
            renderHtml();
        }
    }

    // ==========================================
    // 🖥️ STATUS KOMPUTER (Independent Cycling & Harmonized Colors)
    // ==========================================
    handlePcCycling() {
        const pageBadge = document.getElementById('pc-page-badge');
        const isCyclingNeeded = this.pcPlaylist.length > 1;

        if (!isCyclingNeeded) {
            // Statis Total: Hentikan timer jika ada, sembunyikan badge paginasi
            if (this.pcTimer) {
                clearInterval(this.pcTimer);
                this.pcTimer = null;
            }
            if (pageBadge) pageBadge.classList.add('hidden');
            this.renderPcPage(0);
        } else {
            // Auto-Cycling: Tampilkan badge paginasi dan jalankan timer 8 detik jika belum jalan
            if (pageBadge) pageBadge.classList.remove('hidden');
            this.renderPcPage(this.currentPcIndex);

            if (!this.pcTimer) {
                this.pcTimer = setInterval(() => {
                    this.currentPcIndex = (this.currentPcIndex + 1) % this.pcPlaylist.length;
                    this.renderPcPage(this.currentPcIndex, true);
                }, 8000);
            }
        }
    }

    renderPcPage(pageIndex, withFade = false) {
        const container = document.getElementById('pc-groups-row');
        const headerTitle = document.getElementById('pc-header-title');
        const pageBadge = document.getElementById('pc-page-badge');
        if (!container) return;

        if (this.pcPlaylist.length === 0) {
            container.innerHTML = '<div class="flex items-center justify-center h-full text-neutral-500 py-12 text-sm font-semibold">Tidak ada unit PC terdaftar</div>';
            return;
        }

        const page = this.pcPlaylist[pageIndex] || this.pcPlaylist[0];
        const config = this.getBatchConfig();

        // Update header & badge
        if (headerTitle) {
            headerTitle.innerText = 'Status Komputer';
        }

        if (pageBadge) {
            if (page.totalPages > 1) {
                pageBadge.innerText = `${page.groupName.toUpperCase()} (${page.pageIndex}/${page.totalPages})`;
                pageBadge.style.color = page.groupColor || '#3b82f6';
                pageBadge.style.borderColor = `${page.groupColor || '#3b82f6'}40`;
                pageBadge.style.backgroundColor = `${page.groupColor || '#3b82f6'}15`;
                pageBadge.classList.remove('hidden');
            } else {
                pageBadge.classList.add('hidden');
            }
        }

        const renderHtml = () => {
            // Render kartu-kartu PC dengan warna status 100% selaras dengan /public livepc
            const pcCardsHtml = page.pcs.map(pc => {
                let cardClass = '';
                let statusPill = '';
                let durationText = '';

                const status = pc.status || 'offline';
                const isOnline = pc.status_koneksi === 'online';

                if (status === 'kosong') {
                    if (isOnline) {
                        // KOSONG (Hijau Emerald Glowing - Identik dengan /public livepc)
                        cardClass = 'bg-emerald-950/20 border-emerald-800/40 glow-green text-emerald-400';
                        statusPill = `<span class="px-1.5 sm:px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[9px] sm:text-[10px] font-black tracking-wider uppercase whitespace-nowrap">KOSONG</span>`;
                    } else {
                        // OFFLINE (Abu-abu Redup - Identik dengan /public livepc)
                        cardClass = 'bg-[#0d0d0d] border-neutral-900/90 text-neutral-600 opacity-60';
                        statusPill = `<span class="px-1 sm:px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-600 text-[9px] font-bold uppercase whitespace-nowrap">OFFLINE</span>`;
                    }
                } else if (status === 'terpakai') {
                    // TERPAKAI (Merah Rose Glowing - 100% SAMA DENGAN /public livepc)
                    cardClass = 'bg-rose-950/20 border-rose-500/30 glow-rose text-rose-300';

                    if (pc.sesi_detail && pc.sesi_detail.sisa_waktu_menit !== undefined) {
                        const mins = pc.sesi_detail.sisa_waktu_menit;
                        if (mins <= 0) {
                            durationText = 'Habis';
                        } else if (mins >= 1440) {
                            durationText = 'Bebas';
                        } else {
                            const h = Math.floor(mins / 60);
                            const m = mins % 60;
                            durationText = h > 0 ? `${h}j ${m}m` : `${m}m`;
                        }
                    } else {
                        durationText = 'Terpakai';
                    }

                    statusPill = `<span class="px-1.5 sm:px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-tight whitespace-nowrap">${durationText}</span>`;
                } else if (status === 'admin') {
                    // ADMIN (Kuning Amber Glowing - Identik dengan /public livepc)
                    cardClass = 'bg-amber-950/20 border-amber-800/40 glow-yellow text-amber-300';
                    statusPill = `<span class="px-1.5 sm:px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[9px] sm:text-[10px] font-black uppercase whitespace-nowrap">ADMIN</span>`;
                } else {
                    // OFFLINE
                    cardClass = 'bg-[#0d0d0d] border-neutral-900/90 text-neutral-600 opacity-60';
                    statusPill = `<span class="px-1 sm:px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-600 text-[9px] font-bold uppercase whitespace-nowrap">OFFLINE</span>`;
                }

                return `
                    <div class="h-11 min-h-[44px] border rounded-xl px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-1.5 sm:gap-2 transition-all shadow-sm ${cardClass}">
                        <span class="font-black text-xs sm:text-sm font-mono tracking-tight text-neutral-100 truncate min-w-0 flex-1">${pc.kode}</span>
                        <div class="shrink-0">
                            ${statusPill}
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = `
                <div class="grid ${config.pcCols} gap-2.5 content-start overflow-hidden">
                    ${pcCardsHtml}
                </div>
            `;
        };

        if (withFade) {
            container.classList.add('opacity-0');
            setTimeout(() => {
                renderHtml();
                container.classList.remove('opacity-0');
            }, 150);
        } else {
            renderHtml();
        }
    }

    // ==========================================
    // 🍔 KANTIN & F&B (Independent Cycling)
    // ==========================================
    handleKantinCycling() {
        const pageBadge = document.getElementById('kantin-page-badge');
        const isCyclingNeeded = this.kantinPlaylist.length > 1;

        if (!isCyclingNeeded) {
            // Statis Total: Hentikan timer jika ada, sembunyikan badge paginasi
            if (this.kantinTimer) {
                clearInterval(this.kantinTimer);
                this.kantinTimer = null;
            }
            if (pageBadge) pageBadge.classList.add('hidden');
            this.renderKantinPage(0);
        } else {
            // Auto-Cycling: Tampilkan badge paginasi dan jalankan timer 7 detik jika belum jalan
            if (pageBadge) pageBadge.classList.remove('hidden');
            this.renderKantinPage(this.currentKantinIndex);

            if (!this.kantinTimer) {
                this.kantinTimer = setInterval(() => {
                    this.currentKantinIndex = (this.currentKantinIndex + 1) % this.kantinPlaylist.length;
                    this.renderKantinPage(this.currentKantinIndex, true);
                }, 7000);
            }
        }
    }

    renderKantinPage(pageIndex, withFade = false) {
        const container = document.getElementById('kantin-menu-list');
        const pageBadge = document.getElementById('kantin-page-badge');
        if (!container) return;

        if (this.kantinPlaylist.length === 0) {
            container.innerHTML = '<div class="flex items-center justify-center h-full text-neutral-500 py-8 text-xs font-medium">Menu kantin belum tersedia</div>';
            return;
        }

        const page = this.kantinPlaylist[pageIndex] || this.kantinPlaylist[0];
        const config = this.getBatchConfig();

        const headerTitle = document.getElementById('kantin-header-title');
        if (headerTitle) {
            headerTitle.innerText = 'Kantin & F&B';
        }

        if (pageBadge) {
            if (page.totalPages > 1) {
                pageBadge.innerText = `Hal ${page.pageIndex}/${page.totalPages}`;
                pageBadge.classList.remove('hidden');
            } else {
                pageBadge.classList.add('hidden');
            }
        }

        const renderHtml = () => {
            const isSingleCol = config.kantinCols === 'grid-cols-1';
            const containerClass = isSingleCol 
                ? 'flex flex-col gap-2 content-start overflow-hidden' 
                : `grid ${config.kantinCols} gap-2 content-start overflow-hidden`;

            container.innerHTML = `
                <div class="${containerClass}">
                    ${page.items.map(item => {
                        const priceFormatted = new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: 'IDR',
                            maximumFractionDigits: 0
                        }).format(item.harga);

                        const isOutOfStock = item.stok === 0;
                        const stockText = item.stok < 0 ? 'Ready' : (isOutOfStock ? 'Habis' : `Stok ${item.stok}`);
                        const stockClass = isOutOfStock ? 'text-rose-400 font-bold' : 'text-neutral-400';

                        // Batasi nama menu maksimal 20 huruf agar selalu 1 baris rapi
                        const displayName = (item.nama && item.nama.length > 20) 
                            ? item.nama.substring(0, 20).trim() + '...' 
                            : (item.nama || '');

                        return `
                            <div class="h-14 bg-neutral-900/50 border border-neutral-800/80 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-sm transition-all hover:border-neutral-700">
                                ${item.gambar_path ? `
                                    <img src="${item.gambar_path}" class="w-8 h-8 rounded-lg object-cover border border-neutral-800 shrink-0" onerror="this.style.display='none'">
                                ` : `
                                    <div class="w-8 h-8 rounded-lg bg-neutral-800/80 flex items-center justify-center text-sm shrink-0">🍔</div>
                                `}
                                <div class="min-w-0 flex-1 flex flex-col justify-center pt-0.5">
                                    <h4 class="text-xs sm:text-sm font-black text-neutral-100 leading-snug truncate" title="${item.nama}">${displayName}</h4>
                                    <div class="flex items-center justify-between gap-2 mt-1">
                                        <span class="text-[10px] ${stockClass} leading-none font-semibold whitespace-nowrap">${stockText}</span>
                                        <span class="text-xs sm:text-sm font-black text-amber-300 mono leading-none whitespace-nowrap shrink-0">${priceFormatted}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        };

        if (withFade) {
            container.classList.add('opacity-0');
            setTimeout(() => {
                renderHtml();
                container.classList.remove('opacity-0');
            }, 150);
        } else {
            renderHtml();
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

// Inisialisasi TV Static Signage saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
    window.tvStaticSignage = new TVStaticSignage();
});

// app/static/js/public/tv_static.js

class TVStaticSignage {
    constructor() {
        this.data = null;
        this.init();
    }

    init() {
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        this.fetchData();
        setInterval(() => this.fetchData(), 10000);

        // Viewport scaling adjustment
        this.adjustScale();
        window.addEventListener('resize', () => this.adjustScale());
    }

    adjustScale() {
        const container = document.getElementById('tv-static-container');
        if (!container) return;

        const baseWidth = 1920;
        const baseHeight = 1080;

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // If it is a TV/large screen (>= 1024px) AND the window is smaller than 1920x1080, scale it down to fit perfectly
        if (windowWidth >= 1024 && (windowWidth < baseWidth || windowHeight < baseHeight)) {
            const scaleX = windowWidth / baseWidth;
            const scaleY = windowHeight / baseHeight;
            const scale = Math.min(scaleX, scaleY);

            container.style.transform = `scale(${scale})`;
            container.style.transformOrigin = 'top left';
            container.style.position = 'absolute';
            container.style.width = `${baseWidth}px`;
            container.style.height = `${baseHeight}px`;

            // Centered alignment
            const left = (windowWidth - (baseWidth * scale)) / 2;
            const top = (windowHeight - (baseHeight * scale)) / 2;
            container.style.left = `${left}px`;
            container.style.top = `${top}px`;
        } else {
            // Reset to normal responsive if screen is mobile (< 1024px) or >= 1920x1080
            container.style.transform = 'none';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.position = 'relative';
            container.style.left = '0';
            container.style.top = '0';
        }

        // Always run PC grids scaling to ensure PC lists never overflow group cards
        this.adjustPCGridsScale();
    }

    adjustPCGridsScale() {
        const wrappers = document.querySelectorAll('.pc-grid-wrapper');
        wrappers.forEach(wrapper => {
            const grid = wrapper.querySelector('.pc-grid-container');
            if (!grid) return;

            // Reset styles first to measure natural dimensions
            grid.style.transform = 'none';
            grid.style.width = '100%';

            const wrapperHeight = wrapper.clientHeight || 180;
            const gridHeight = grid.scrollHeight;

            if (gridHeight > wrapperHeight) {
                const scale = wrapperHeight / gridHeight;
                grid.style.transform = `scale(${scale})`;
                grid.style.transformOrigin = 'top left';
                grid.style.width = `${100 / scale}%`;
            }
        });
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
            console.error('Error fetching TV Static data:', e);
        }
    }

    renderAll() {
        if (!this.data) return;

        // 1. Render Header Stats & Title
        const occ = this.data.occupancy;
        // PC Tersedia (kosong) / total_pc
        document.getElementById('stat-occupancy').innerText = `${occ.pc_kosong} / ${occ.total_pc}`;
        document.getElementById('stat-utilization').innerText = `${occ.utilisasi}%`;

        // Update Warnet Title and Logo
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
        }

        // 2. Render Components
        this.renderPCGrid();
        this.renderPromos();
        this.renderKantinMenu();
        this.renderRules();
        this.adjustScale();
    }

    renderPCGrid() {
        const rowContainer = document.getElementById('pc-groups-row');
        if (!rowContainer) return;

        const pcs = this.data.pc_list || [];
        if (pcs.length === 0) {
            rowContainer.innerHTML = '<div class="col-span-full text-center text-neutral-500 py-6">Tidak ada unit PC terdaftar</div>';
            return;
        }

        // Group PCs
        const pcGroups = {};
        pcs.forEach(pc => {
            const g = pc.grup || 'Reguler';
            if (!pcGroups[g]) pcGroups[g] = [];
            pcGroups[g].push(pc);
        });

        const pcGroupsList = Object.keys(pcGroups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        // Dynamically style grid columns matching group count on large screens
        if (window.innerWidth >= 1024) {
            rowContainer.style.gridTemplateColumns = `repeat(${pcGroupsList.length}, minmax(0, 1fr))`;
        } else {
            rowContainer.style.gridTemplateColumns = '';
        }

        rowContainer.innerHTML = pcGroupsList.map(g => {
            const groupPcs = pcGroups[g] || [];
            groupPcs.sort((a, b) => (a.kode || a.nama || '').localeCompare(b.kode || b.nama || '', undefined, { numeric: true, sensitivity: 'base' }));
            const groupColor = (this.data && this.data.grup_meta && this.data.grup_meta[g] && this.data.grup_meta[g].warna) || '#3b82f6';

            // Render individual PC Cards
            const pcCardsHtml = groupPcs.map(pc => {
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
                    statusClass = 'bg-[#141414] border-neutral-900 text-neutral-600 opacity-50';
                    subtitle = 'OFFLINE';
                }

                const styleAttr = customStyle ? `style="${customStyle}"` : '';

                return `
                    <div class="border rounded-lg p-2 flex flex-col justify-between h-14 transition-all ${statusClass}" ${styleAttr}>
                        <div class="flex justify-between items-start leading-none">
                            <span class="text-xs sm:text-sm font-black tracking-tight">${pc.kode}</span>
                            ${durationText ? `<span class="text-[9px] font-black uppercase tracking-wider mono bg-neutral-900/60 px-1 py-0.2 rounded" style="color: ${groupColor}; border: 1px solid ${groupColor}25;">${durationText}</span>` : ''}
                        </div>
                        <div class="text-[9px] sm:text-[10px] font-extrabold uppercase truncate text-neutral-400 leading-none">
                            ${subtitle}
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="bg-neutral-950/20 border border-neutral-900 rounded-2xl p-3 flex flex-col justify-start min-h-0" style="border-color: ${groupColor}20;">
                    <div class="flex justify-between items-center mb-2 pb-1.5 border-b border-neutral-900 shrink-0">
                        <span class="text-sm font-black uppercase tracking-wider" style="color: ${groupColor};">${g.toUpperCase()} ZONE</span>
                        <span class="text-xs font-mono font-bold text-neutral-500">${groupPcs.length} PC</span>
                    </div>
                    <div class="pc-grid-wrapper overflow-hidden w-full relative h-[180px]">
                        <div class="grid grid-cols-5 gap-1.5 content-start pc-grid-container origin-top-left">
                            ${pcCardsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderPromos() {
        const rowContainer = document.getElementById('promo-groups-row');
        if (!rowContainer) return;

        const promos = this.data.promos || [];
        if (promos.length === 0) {
            rowContainer.innerHTML = '<div class="col-span-full text-center text-neutral-500 py-6">Tidak ada paket promo aktif</div>';
            return;
        }

        // Group packages
        const promosMap = {};
        promos.forEach(p => {
            const g = p.grup || 'Reguler';
            if (!promosMap[g]) promosMap[g] = [];
            promosMap[g].push(p);
        });

        const promosList = Object.keys(promosMap).sort();

        // Dynamically style grid columns matching group count on large screens
        if (window.innerWidth >= 1024) {
            rowContainer.style.gridTemplateColumns = `repeat(${promosList.length}, minmax(0, 1fr))`;
        } else {
            rowContainer.style.gridTemplateColumns = '';
        }

        rowContainer.innerHTML = promosList.map(g => {
            const groupPackages = promosMap[g];
            const groupColor = (this.data && this.data.grup_meta && this.data.grup_meta[g] && this.data.grup_meta[g].warna) || '#3b82f6';

            // Render individual promo cards
            const promoCardsHtml = groupPackages.map(p => {
                const priceFormatted = new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    maximumFractionDigits: 0
                }).format(p.harga);

                const hours = Math.floor(p.durasi_menit / 60);
                const durationText = hours > 0 ? `${hours} Jam` : `${p.durasi_menit} Menit`;

                return `
                    <div class="bg-neutral-950/40 border border-neutral-900/50 rounded-xl p-3 flex flex-col justify-between h-20 transition-all hover:border-neutral-800" style="border-color: ${groupColor}20;">
                        <div>
                            <h4 class="text-xs font-black text-neutral-200 line-clamp-1 leading-tight">${p.nama}</h4>
                        </div>
                        <div class="border-t border-neutral-900/50 pt-1 flex justify-between items-end shrink-0">
                            <div>
                                <p class="text-[8px] text-neutral-500 uppercase font-bold tracking-wider leading-none">Durasi</p>
                                <p class="text-[10px] font-black text-neutral-300 leading-none mt-0.5">${durationText}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-[8px] text-neutral-500 uppercase font-bold tracking-wider leading-none">Harga</p>
                                <p class="text-[10px] font-black mono leading-none mt-0.5" style="color: ${groupColor};">${priceFormatted}</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="bg-neutral-950/20 border border-neutral-900 rounded-2xl p-3 flex flex-col justify-start min-h-0" style="border-color: ${groupColor}20;">
                    <div class="flex justify-between items-center mb-2 pb-1.5 border-b border-neutral-900 shrink-0">
                        <span class="text-sm font-black uppercase tracking-wider" style="color: ${groupColor};">${g.toUpperCase()} PAKET</span>
                        <span class="text-xs font-mono font-bold text-neutral-500">${groupPackages.length} Paket</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 content-start">
                        ${promoCardsHtml}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderKantinMenu() {
        const menuList = document.getElementById('kantin-menu-list');
        if (!menuList) return;

        const items = this.data.menu_items || [];
        if (items.length === 0) {
            menuList.innerHTML = '<div class="text-center text-neutral-500 py-12 text-xs">Menu makanan kosong</div>';
            return;
        }

        menuList.innerHTML = items.map(item => {
            const priceFormatted = new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
            }).format(item.harga);

            const stockText = item.stok < 0 ? 'Unlimited' : `Stok: ${item.stok}`;
            const stockColor = item.stok === 0 ? 'text-red-500 font-bold' : 'text-neutral-500';

            return `
                <div class="bg-neutral-900/40 border border-neutral-900 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all">
                    <div class="flex items-center gap-3 min-w-0">
                        ${item.gambar_path ? `
                            <img src="${item.gambar_path}" class="w-10 h-10 rounded-lg object-cover border border-neutral-800" onerror="this.style.display='none'">
                        ` : `
                            <div class="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-lg shrink-0">🍔</div>
                        `}
                        <div class="min-w-0">
                            <h4 class="text-sm font-bold text-neutral-200 truncate leading-snug">${item.nama}</h4>
                            <p class="text-[10px] sm:text-xs ${stockColor} mt-0.5 leading-none">${stockText}</p>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="text-sm font-black text-neutral-100 mono">${priceFormatted}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderRules() {
        const rulesList = document.getElementById('rules-list');
        if (!rulesList) return;

        const rules = (this.data.settings && this.data.settings.warnet_rules) || [];
        if (rules.length === 0) {
            rulesList.innerHTML = '<li class="text-neutral-500">Tidak ada pengumuman tertulis</li>';
            return;
        }

        rulesList.innerHTML = rules.map(rule => {
            return `<li class="flex items-start gap-3">
                <span class="w-2 h-2 rounded-full bg-neutral-600 mt-2 shrink-0"></span>
                <span>${rule}</span>
            </li>`;
        }).join('');
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

// Instantiate TV Static Signage display when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.tvStaticSignage = new TVStaticSignage();
});

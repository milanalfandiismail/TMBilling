/* app/static/js/member/peta.js */

let allPCs = [];
let currentFilter = 'all';

async function fetchPCStatus() {
    const btn = document.getElementById('btn-refresh');
    const icon = document.getElementById('refresh-icon');
    const counter = document.getElementById('pc-counter');

    if (!btn || !icon || !counter) return;

    // Add spinning effect
    icon.classList.add('animate-spin');
    btn.disabled = true;

    try {
        const res = await fetch('/pc-status');
        if (!res.ok) throw new Error('API Error');
        allPCs = await res.json();

        // Update PC display
        renderPCs();

        // Update counter
        const total = allPCs.length;
        const vacant = allPCs.filter(pc => pc.status === 'kosong').length;

        counter.className = "px-3 py-2 bg-emerald-950/40 border border-emerald-800/30 text-emerald-400 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5";
        counter.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ${vacant} / ${total} PC Tersedia`;
    } catch (err) {
        console.error(err);
        const container = document.getElementById('pc-container');
        if (container) {
            container.innerHTML = `
                <div class="py-8 flex flex-col items-center justify-center text-rose-500 space-y-2">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span class="text-sm font-mono font-bold">Gagal mengambil status PC terbaru.</span>
                </div>
            `;
        }
        counter.className = "px-3 py-2 bg-rose-950/40 border border-rose-800/30 text-rose-400 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5";
        counter.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span> Offline`;
    } finally {
        setTimeout(() => {
            icon.classList.remove('animate-spin');
            btn.disabled = false;
        }, 500);
    }
}

function renderPCs() {
    const container = document.getElementById('pc-container');
    if (!container) return;
    container.innerHTML = '';

    // Dapatkan semua grup unik yang relevan
    let groups = [];
    if (currentFilter === 'all') {
        const uniqueGroups = [...new Set(allPCs.map(pc => pc.grup.toLowerCase().trim()))];
        // Urutkan grup secara alfabetis agar konsisten (reguler -> vip -> vvip)
        uniqueGroups.sort();
        groups = uniqueGroups;
    } else {
        groups = [currentFilter];
    }

    let renderedCount = 0;

    groups.forEach(gName => {
        // Ambil PC untuk grup ini
        const pcsInGroup = allPCs.filter(pc => pc.grup.toLowerCase().trim() === gName);
        if (pcsInGroup.length === 0) return;

        renderedCount += pcsInGroup.length;

        // Buat Section Div untuk Grup ini
        const section = document.createElement('div');
        section.className = 'space-y-4';

        // Tentukan warna bullet indikator grup
        let colorClass = 'bg-blue-500 border-blue-400/50';
        if (gName === 'vip') colorClass = 'bg-pink-500 border-pink-400/50';
        if (gName === 'vvip') colorClass = 'bg-purple-500 border-purple-400/50';

        const displayName = gName.toUpperCase();

        section.innerHTML = `
            <div class="flex items-center gap-3 border-b border-[#1f1f1f] pb-3">
                <span class="w-3.5 h-3.5 rounded-md block border shrink-0 ${colorClass}"></span>
                <h3 class="text-xl font-extrabold text-neutral-100 uppercase tracking-wider">${displayName} Zone</h3>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-900 border border-neutral-800 text-neutral-400 uppercase tracking-widest">${pcsInGroup.length} PC</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 pc-group-grid"></div>
        `;

        const grid = section.querySelector('.pc-group-grid');

        pcsInGroup.forEach(pc => {
            const isVacant = pc.status === 'kosong';
            const cardClass = isVacant
                ? 'bg-emerald-950/15 border-emerald-500/20 text-emerald-400 glow-emerald'
                : 'bg-rose-950/15 border-rose-500/20 text-rose-400 glow-rose';
            const dotClass = isVacant ? 'bg-emerald-400' : 'bg-rose-400';

            let textStatus = isVacant ? 'KOSONG' : 'TERPAKAI';
            if (!isVacant && pc.sisa_waktu_display) {
                if (pc.sisa_waktu_display === 'OFFLINE') {
                    textStatus = 'MAINTENANCE';
                } else if (pc.sisa_waktu_display === 'ADMIN') {
                    textStatus = 'ADMIN MODE';
                } else {
                    textStatus = `SISA: ${pc.sisa_waktu_display}`;
                }
            }

            const badgeColor = pc.grup.toLowerCase() === 'vvip'
                ? 'bg-purple-950/60 text-purple-400 border-purple-800/30'
                : (pc.grup.toLowerCase() === 'vip'
                    ? 'bg-pink-950/60 text-pink-400 border-pink-800/30'
                    : 'bg-blue-950/60 text-blue-400 border-blue-800/30');

            // Remove 'Unit' or 'unit' from PC name if it exists, to keep it clean
            const cleanPcName = (pc.nama || pc.kode).replace(/unit/i, '').trim();

            const pcCard = document.createElement('div');
            pcCard.className = `p-4 border rounded-xl flex flex-col justify-between h-28 transition-all hover:scale-[1.02] duration-200 ${cardClass}`;
            pcCard.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-mono text-xs font-semibold uppercase tracking-wider">${pc.kode}</span>
                    <span class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${badgeColor}">${pc.grup}</span>
                </div>
                
                <div class="mt-2">
                    <p class="font-bold text-neutral-100 text-sm truncate leading-none capitalize">${cleanPcName}</p>
                    <div class="flex items-center gap-1.5 mt-2">
                        <span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span>
                        <span class="text-[9px] font-mono tracking-wider font-bold">${textStatus}</span>
                    </div>
                </div>
            `;
            grid.appendChild(pcCard);
        });

        container.appendChild(section);
    });

    if (renderedCount === 0) {
        container.innerHTML = `
            <div class="py-12 text-center text-neutral-600 text-xs font-mono">
                Tidak ada PC di grup ini.
            </div>
        `;
    }
}

function filterPCs(group) {
    currentFilter = group;

    // Toggle active styling on tabs
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const g = btn.id.replace('filter-btn-', '');
        if (g === group) {
            btn.className = "px-3 py-1.5 rounded-md font-bold transition-all bg-neutral-800 text-neutral-100 filter-btn uppercase tracking-wider";
        } else {
            btn.className = "px-3 py-1.5 rounded-md font-bold transition-all text-neutral-400 hover:text-neutral-200 filter-btn uppercase tracking-wider";
        }
    });

    renderPCs();
}

// Run fetch on load
window.addEventListener('DOMContentLoaded', () => {
    fetchPCStatus();
});

// app/static/js/kasir/modules/tournament/index.js

/**
 * Modul Turnamen untuk dasbor kasir TMBilling.
 * Mengelola logic antarmuka untuk list turnamen, visual bracket playoffs, 
 * klasemen Swiss, input skor, dan transisi antar-tahap.
 */

// Ekstensi API global
API.tournament = {
    list: () => API.request('/api/v1/kasir/tournament/'),
    get: (id) => API.request(`/api/v1/kasir/tournament/${id}`),
    create: (data) => API.request('/api/v1/kasir/tournament/', { method: 'POST', body: JSON.stringify(data) }),
    saveSkor: (matchId, data) => API.request(`/api/v1/kasir/tournament/match/${matchId}/skor`, { method: 'POST', body: JSON.stringify(data) }),
    nextSwiss: (id) => API.request(`/api/v1/kasir/tournament/${id}/swiss/next`, { method: 'POST' }),
    finishStage: (stageId, data) => API.request(`/api/v1/kasir/tournament/stage/${stageId}/finish`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => API.request(`/api/v1/kasir/tournament/${id}`, { method: 'DELETE' })
};

const Tournament = {
    activeTournamentId: null,
    activeStageId: null,
    activeData: null,

    isKasir() {
        return window.App && App.user && App.user.role === 'kasir';
    },

    async load() {
        console.log('[Tournament] Loading list...');
        this.showListView();
        await this.renderList();
    },

    showListView() {
        document.getElementById('tournament-list-view').classList.remove('hidden');
        document.getElementById('tournament-detail-view').classList.add('hidden');
        this.activeTournamentId = null;
        this.activeStageId = null;
        this.activeData = null;
    },

    showDetailView(tId) {
        document.getElementById('tournament-list-view').classList.add('hidden');
        document.getElementById('tournament-detail-view').classList.remove('hidden');
        this.activeTournamentId = tId;
        this.renderDetail(tId);
    },

    // ===== RENDER LIST TURNAMEN =====
    async renderList() {
        const grid = document.getElementById('tournaments-grid');
        grid.innerHTML = '<div class="col-span-full py-12 text-center text-neutral-500 text-xs lg:text-base">Memuat daftar turnamen...</div>';

        try {
            const res = await API.tournament.list();
            if (!res.tournaments || res.tournaments.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full py-16 border border-dashed border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center text-center">
                        <p class="text-xs lg:text-base text-neutral-500">Belum ada turnamen yang dibuat.</p>
                        ${this.isKasir() ? '' : `
                        <button onclick="Tournament.openCreateModal()" class="mt-4 px-4 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-all">
                            Buat Turnamen Pertama
                        </button>`}
                    </div>
                `;
                return;
            }

            grid.innerHTML = res.tournaments.map(t => {
                const isSelesai = t.status === 'selesai';
                const statusColor = isSelesai 
                    ? 'bg-neutral-800 text-neutral-400' 
                    : 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30';
                
                return `
                    <div class="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-5 hover:border-neutral-500 transition-all flex flex-col justify-between h-[180px]">
                        <div>
                            <div class="flex items-start justify-between gap-3">
                                <h3 class="text-xs lg:text-base font-bold text-neutral-100 truncate flex-1">${t.nama}</h3>
                                <span class="px-2 py-0.5 rounded text-[8px] lg:text-[10px] font-bold tracking-wider uppercase ${statusColor}">
                                    ${t.status}
                                </span>
                            </div>
                            <p class="text-[10px] lg:text-sm text-neutral-500 mt-2 line-clamp-2">${t.deskripsi || 'Tidak ada deskripsi.'}</p>
                        </div>
                        <div class="flex items-center justify-between mt-4 border-t border-[#171717]/80 pt-3">
                            <span class="text-[10px] lg:text-xs text-neutral-500 font-mono">${t.teams_count} Tim Terdaftar</span>
                            <div class="flex gap-2">
                                ${this.isKasir() ? '' : `
                                <button onclick="Tournament.deleteTournament(${t.id})" class="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Hapus Turnamen">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>`}
                                <button onclick="Tournament.showDetailView(${t.id})" class="px-3.5 py-2 bg-[#0f0f0f] border border-[#2a2a2a] hover:bg-[#151515] text-neutral-200 text-xs lg:text-sm font-bold rounded-lg transition-colors">
                                    Buka Turnamen
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (err) {
            grid.innerHTML = `<div class="col-span-full py-12 text-center text-red-400 text-xs lg:text-base">Gagal memuat turnamen: ${err.message}</div>`;
        }
    },

    // ===== RENDER DETAIL TURNAMEN =====
    async renderDetail(tId) {
        const stageContent = document.getElementById('stage-view-content');
        stageContent.innerHTML = '<div class="py-16 text-center text-neutral-500 text-xs lg:text-base">Memuat rincian turnamen...</div>';

        try {
            const res = await API.tournament.get(tId);
            this.activeData = res;

            document.getElementById('detail-tournament-name').innerText = res.tournament.nama;
            document.getElementById('detail-tournament-desc').innerText = res.tournament.deskripsi || 'Tidak ada deskripsi.';

            // Status tag
            const statusEl = document.getElementById('detail-tournament-status');
            statusEl.innerText = res.tournament.status;
            statusEl.className = 'px-2 py-0.5 rounded text-[8px] lg:text-[10px] font-bold uppercase tracking-wider ' + 
                (res.tournament.status === 'selesai' ? 'bg-neutral-800 text-neutral-400' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30');

            // Render Stage Selector Tabs
            const tabContainer = document.getElementById('detail-stage-tabs');
            tabContainer.innerHTML = '';
            
            if (res.stages.length > 0) {
                // Cari stage aktif atau default ke stage pertama
                let activeStage = res.stages.find(s => s.status === 'aktif');
                if (!activeStage) activeStage = res.stages[0];
                this.activeStageId = activeStage.id;

                tabContainer.innerHTML = res.stages.map(s => {
                    const isActive = s.id === this.activeStageId;
                    const tabClass = isActive 
                        ? 'bg-neutral-800 text-neutral-100 font-bold' 
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#121212]';
                    return `
                        <button onclick="Tournament.switchStage(${s.id})" class="px-3.5 py-2 rounded-md text-xs lg:text-sm transition-colors ${tabClass}">
                            ${s.nama} (${s.status})
                        </button>
                    `;
                }).join('');

                this.renderActiveStage();
            } else {
                stageContent.innerHTML = '<div class="py-16 text-center text-neutral-500 text-xs lg:text-base">Tidak ada tahapan turnamen ditemukan.</div>';
            }

        } catch (err) {
            stageContent.innerHTML = `<div class="py-16 text-center text-red-400 text-xs lg:text-base">Gagal memuat detail turnamen: ${err.message}</div>`;
        }
    },

    switchStage(stageId) {
        this.activeStageId = stageId;
        // Update tab buttons style
        const res = this.activeData;
        const tabContainer = document.getElementById('detail-stage-tabs');
        tabContainer.innerHTML = res.stages.map(s => {
            const isActive = s.id === this.activeStageId;
            const tabClass = isActive 
                ? 'bg-neutral-800 text-neutral-100 font-bold' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#121212]';
            return `
                <button onclick="Tournament.switchStage(${s.id})" class="px-3.5 py-2 rounded-md text-xs lg:text-sm transition-colors ${tabClass}">
                    ${s.nama} (${s.status})
                </button>
            `;
        }).join('');

        this.renderActiveStage();
    },

    renderActiveStage() {
        const stageContent = document.getElementById('stage-view-content');
        const stage = this.activeData.stages.find(s => s.id === this.activeStageId);
        const matches = this.activeData.matches[this.activeStageId] || [];

        if (stage.tipe_format === 'single_elimination') {
            this.renderPlayoffs(stage, matches);
        } else if (stage.tipe_format === 'swiss') {
            const standings = this.activeData.standings[this.activeStageId] || [];
            this.renderSwiss(stage, matches, standings);
        }
    },

    // ===== RENDER STAGE: PLAYOFFS BRACKET =====
    renderPlayoffs(stage, matches) {
        const container = document.getElementById('stage-view-content');
        
        if (matches.length === 0) {
            container.innerHTML = `
                <div class="py-16 text-center text-neutral-500 text-xs lg:text-base border border-dashed border-[#2a2a2a] rounded-xl">
                    <p>Bagan belum dibuat untuk tahapan ini.</p>
                </div>
            `;
            return;
        }

        // Kelompokkan match berdasarkan round_number
        const rounds = {};
        matches.forEach(m => {
            if (!rounds[m.round_number]) rounds[m.round_number] = [];
            rounds[m.round_number].push(m);
        });

        const numRounds = Object.keys(rounds).length;
        
        // Buat DOM Columns
        let html = `
            <div class="flex flex-row justify-start items-stretch gap-8 overflow-x-auto py-8 min-h-[500px] scrollbar-mono">
        `;

        for (let r = 1; r <= numRounds; r++) {
            const roundMatches = rounds[r] || [];
            let roundName = `Babak ${r}`;
            if (r === numRounds) roundName = "Final";
            else if (r === numRounds - 1) roundName = "Semifinal";
            else if (r === numRounds - 2) roundName = "Perempat Final";

            html += `
                <div class="flex flex-col justify-around gap-6 min-w-[240px] select-none">
                    <div class="text-center text-[10px] lg:text-xs font-extrabold uppercase tracking-widest text-neutral-500 border-b border-[#2a2a2a] pb-2 mb-4">
                        ${roundName}
                    </div>
                    <div class="flex-1 flex flex-col justify-around gap-6">
            `;

            roundMatches.forEach(m => {
                const t1 = m.tim1_nama || '(Menunggu)';
                const t2 = m.tim2_nama || '(Menunggu)';
                const s1 = m.pemenang_id ? m.skor1 : '-';
                const s2 = m.pemenang_id ? m.skor2 : '-';
                const hasWinner = m.pemenang_id !== null;
                
                const isT1Winner = hasWinner && m.pemenang_id === m.tim1_id;
                const isT2Winner = hasWinner && m.pemenang_id === m.tim2_id;

                const cardBorder = hasWinner ? 'border-[#262626]' : 'border-[#2a2a2a] hover:border-neutral-500';

                // Render bulatan kecil indikator BO
                let boIndicators = '';
                if (m.bo_format > 1 && m.tim1_id && m.tim2_id) {
                    boIndicators = `<span class="text-[9px] lg:text-[10px] text-neutral-600 bg-neutral-900 border border-[#2a2a2a] px-1.5 py-0.5 rounded font-bold">BO${m.bo_format}</span>`;
                }

                html += `
                    <div ${this.isKasir() ? '' : `onclick="Tournament.openSkorModal(${m.id}, '${t1}', '${t2}', ${m.tim1_id || 0}, ${m.tim2_id || 0}, ${m.skor1}, ${m.skor2})"`}
                        class="bg-[#0a0a0a] border ${cardBorder} rounded-xl p-4 ${this.isKasir() ? '' : 'cursor-pointer hover:bg-[#0c0c0c]'} transition-all space-y-2.5">
                        <div class="flex items-center justify-between text-[10px] lg:text-xs text-neutral-600 font-mono">
                            <span>Match #${m.match_number}</span>
                            ${boIndicators}
                        </div>
                        <div class="space-y-1.5">
                            <!-- Team 1 row -->
                            <div class="flex justify-between items-center text-xs lg:text-base font-semibold ${isT1Winner ? 'text-neutral-100 font-extrabold' : (hasWinner ? 'text-neutral-500' : 'text-neutral-300')}">
                                <span class="truncate pr-2">${t1}</span>
                                <span class="font-mono text-sm lg:text-base">${s1}</span>
                            </div>
                            <!-- Team 2 row -->
                            <div class="flex justify-between items-center text-xs lg:text-base font-semibold ${isT2Winner ? 'text-neutral-100 font-extrabold' : (hasWinner ? 'text-neutral-500' : 'text-neutral-300')}">
                                <span class="truncate pr-2">${t2}</span>
                                <span class="font-mono text-sm lg:text-base">${s2}</span>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        html += `
            </div>
        `;
        container.innerHTML = html;
    },

    // ===== RENDER STAGE: SWISS STAGE =====
    renderSwiss(stage, matches, standings) {
        const container = document.getElementById('stage-view-content');
        
        // Temukan ronde terbesar
        const maxRound = matches.length > 0 ? Math.max(...matches.map(m => m.round_number)) : 1;

        let standingsRows = standings.map((s, idx) => {
            return `
                <tr class="border-b border-[#171717]/80 text-xs lg:text-base">
                    <td class="py-3 px-4 font-mono font-bold text-neutral-500 text-center text-xs lg:text-base">${idx + 1}</td>
                    <td class="py-3 px-4 font-bold text-neutral-200">${s.nama_tim}</td>
                    <td class="py-3 px-4 text-center font-mono font-bold text-emerald-400 text-xs lg:text-base">${s.wins}</td>
                    <td class="py-3 px-4 text-center font-mono font-bold text-neutral-500 text-xs lg:text-base">${s.losses}</td>
                    <td class="py-3 px-4 text-center font-mono text-neutral-500 text-xs lg:text-base">${s.byes}</td>
                </tr>
            `;
        }).join('');

        if (standings.length === 0) {
            standingsRows = '<tr><td colspan="5" class="py-8 text-center text-neutral-600 text-xs lg:text-base">Belum ada tim terdaftar.</td></tr>';
        }

        // Kelompokkan match ronde aktif
        const activeRoundMatches = matches.filter(m => m.round_number === maxRound);
        const allCompleted = activeRoundMatches.length > 0 && activeRoundMatches.every(m => m.pemenang_id !== null);

        let matchCards = activeRoundMatches.map(m => {
            const t1 = m.tim1_nama || '(BYE)';
            const t2 = m.tim2_nama || '(BYE)';
            const hasWinner = m.pemenang_id !== null;

            let scoreText = 'Belum dimainkan';
            if (hasWinner) {
                if (m.tim2_id) {
                    scoreText = `<span class="font-mono font-black text-sm lg:text-base text-neutral-100">${m.skor1} - ${m.skor2}</span>`;
                } else {
                    scoreText = '<span class="text-xs lg:text-sm text-neutral-500 italic">BYE (Kemenangan Otomatis)</span>';
                }
            }

            const cardClickAction = (m.tim2_id && !this.isKasir())
                ? `onclick="Tournament.openSkorModal(${m.id}, '${t1}', '${t2}', ${m.tim1_id || 0}, ${m.tim2_id || 0}, ${m.skor1}, ${m.skor2})"`
                : '';

            return `
                <div ${cardClickAction} class="bg-[#0a0a0a] border border-[#2a2a2a] ${m.tim2_id ? 'hover:border-neutral-500 cursor-pointer' : ''} rounded-xl p-4 flex items-center justify-between gap-4 transition-all">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 text-[10px] lg:text-xs text-neutral-600 font-mono mb-2">
                            <span>Match #${m.match_number}</span>
                            ${m.bo_format > 1 ? `<span class="text-neutral-500">BO${m.bo_format}</span>` : ''}
                        </div>
                        <div class="space-y-1">
                            <div class="text-xs lg:text-base font-bold ${hasWinner && m.pemenang_id === m.tim1_id ? 'text-neutral-100' : 'text-neutral-400'} truncate">${t1}</div>
                            ${m.tim2_id ? `<div class="text-xs lg:text-base font-bold ${hasWinner && m.pemenang_id === m.tim2_id ? 'text-neutral-100' : 'text-neutral-400'} truncate">${t2}</div>` : ''}
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        ${scoreText}
                    </div>
                </div>
            `;
        }).join('');

        if (activeRoundMatches.length === 0) {
            matchCards = '<div class="py-12 text-center text-neutral-600 text-xs lg:text-base border border-dashed border-[#2a2a2a] rounded-xl">Belum ada pertandingan dibuat.</div>';
        }

        // Tampilkan tombol Lanjut Ronde atau Loloskan
        let actionButtons = '';
        const isLastStage = this.activeData.stages.find(s => s.urutan === stage.urutan + 1) === undefined;
        const isKasir = this.isKasir();

        if (allCompleted) {
            if (isLastStage) {
                actionButtons = isKasir ? '' : `
                    <button onclick="Tournament.finishStage(${stage.id})" class="w-full py-2.5 px-4 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors">
                        Selesaikan Turnamen & Simpan Hasil
                    </button>
                `;
            } else {
                actionButtons = isKasir ? '' : `
                    <div class="grid grid-cols-2 gap-3">
                        <button onclick="Tournament.triggerNextSwiss(${t_id=stage.turnamen_id})" class="py-2.5 px-4 bg-[#0f0f0f] border border-[#2a2a2a] hover:bg-[#151515] text-neutral-200 text-xs lg:text-base font-bold rounded-lg transition-colors">
                            Buat Ronde Swiss #${maxRound + 1}
                        </button>
                        <button onclick="Tournament.openQualifyModal(${stage.id})" class="py-2.5 px-4 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors">
                            Loloskan Tim ke Playoffs
                        </button>
                    </div>
                `;
            }
        } else {
            actionButtons = `
                <div class="p-3 bg-neutral-900/40 border border-[#2a2a2a] text-neutral-500 text-center text-[10px] lg:text-xs font-bold uppercase tracking-wider rounded-lg">
                    Ronde ${maxRound} Masih Berlangsung
                </div>
            `;
        }

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Left: Standings -->
                <div class="col-span-1 lg:col-span-2 space-y-4">
                    <h3 class="text-xs lg:text-sm font-bold text-neutral-400 uppercase tracking-wider">Klasemen Sementara Swiss</h3>
                    <div class="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-neutral-900/60 border-b border-[#2a2a2a] text-[10px] lg:text-sm font-bold uppercase tracking-wider text-neutral-500">
                                    <th class="py-3 px-4 w-12 text-center">Rank</th>
                                    <th class="py-3 px-4">Nama Tim</th>
                                    <th class="py-3 px-4 w-16 text-center">Menang</th>
                                    <th class="py-3 px-4 w-16 text-center">Kalah</th>
                                    <th class="py-3 px-4 w-16 text-center">BYE</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${standingsRows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Right: Active Round Matches -->
                <div class="col-span-1 space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xs lg:text-sm font-bold text-neutral-400 uppercase tracking-wider">Pertandingan Ronde ${maxRound}</h3>
                    </div>
                    <div class="space-y-3 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                        ${matchCards}
                    </div>
                    <div class="pt-4 border-t border-[#2a2a2a] space-y-3">
                        ${actionButtons}
                    </div>
                </div>
            </div>
        `;
    },

    // ===== MODAL ACTIONS: CREATE TOURNAMENT =====
    openCreateModal() {
        document.getElementById('form-buat-turnamen').reset();
        document.getElementById('tim-count').innerText = '0 Tim terdeteksi';
        document.getElementById('modal-buat-turnamen').classList.remove('hidden');
    },

    closeCreateModal() {
        document.getElementById('modal-buat-turnamen').classList.add('hidden');
    },

    updateTimCount() {
        const text = document.getElementById('create-t-teams').value;
        const count = text.split('\n').map(t => t.strip ? t.strip() : t.trim()).filter(t => t.length > 0).length;
        document.getElementById('tim-count').innerText = `${count} Tim terdeteksi`;
    },

    async handleCreate(e) {
        e.preventDefault();
        const nama = document.getElementById('create-t-name').value.trim();
        const deskripsi = document.getElementById('create-t-desc').value.trim();
        const tipe_jalur = document.getElementById('create-t-format').value;
        const bo_format = document.getElementById('create-t-bo').value;
        const textTeams = document.getElementById('create-t-teams').value;
        
        const teams = textTeams.split('\n').map(t => t.trim()).filter(t => t.length > 0);
        
        if (teams.length < 2) {
            Toast.error('Harap masukkan minimal 2 nama tim.');
            return;
        }

        try {
            const res = await API.tournament.create({
                nama,
                deskripsi,
                tipe_jalur,
                bo_format,
                teams
            });
            Toast.success(res.message);
            this.closeCreateModal();
            this.showDetailView(res.tournament_id);
        } catch (err) {
            Toast.error(err.message || 'Gagal membuat turnamen');
        }
    },

    // ===== MODAL ACTIONS: SCORE INPUT =====
    openSkorModal(matchId, t1Name, t2Name, t1Id, t2Id, s1, s2) {
        if (this.isKasir()) {
            Toast.error('Akses Ditolak: Hanya Admin yang dapat mengubah skor turnamen.');
            return;
        }
        if (!t1Id || !t2Id) {
            // Jika ada salah satu tim belum terisi di bracket, jangan ijinkan input
            return;
        }
        
        document.getElementById('skor-match-id').value = matchId;
        document.getElementById('skor-team1-name').innerText = t1Name;
        document.getElementById('skor-team2-name').innerText = t2Name;
        
        document.getElementById('skor-team1-val').value = s1 || 0;
        document.getElementById('skor-team2-val').value = s2 || 0;
        
        // Pilihan override pemenang
        const optT1 = document.getElementById('skor-opt-t1');
        const optT2 = document.getElementById('skor-opt-t2');
        
        optT1.value = t1Id;
        optT1.innerText = t1Name;
        optT2.value = t2Id;
        optT2.innerText = t2Name;
        
        document.getElementById('skor-winner-id').value = ""; // Default auto-detect
        
        document.getElementById('modal-input-skor').classList.remove('hidden');
    },

    closeSkorModal() {
        document.getElementById('modal-input-skor').classList.add('hidden');
    },

    async handleSaveSkor(e) {
        e.preventDefault();
        const matchId = document.getElementById('skor-match-id').value;
        const skor1 = parseInt(document.getElementById('skor-team1-val').value) || 0;
        const skor2 = parseInt(document.getElementById('skor-team2-val').value) || 0;
        const pemenang_id = document.getElementById('skor-winner-id').value;

        try {
            const data = { skor1, skor2 };
            if (pemenang_id) data.pemenang_id = pemenang_id;

            const res = await API.tournament.saveSkor(matchId, data);
            Toast.success(res.message);
            this.closeSkorModal();
            this.renderDetail(this.activeTournamentId);
        } catch (err) {
            Toast.error(err.message || 'Gagal menyimpan skor');
        }
    },

    // ===== SWISS NEXT ROUND MATCHMAKING =====
    async triggerNextSwiss(tId) {
        try {
            const res = await API.tournament.nextSwiss(tId);
            Toast.success(res.message);
            this.renderDetail(tId);
        } catch (err) {
            Toast.error(err.message || 'Gagal membuat ronde baru');
        }
    },

    // ===== SWISS QUALIFICATION TO PLAYOFFS =====
    openQualifyModal(stageId) {
        const listContainer = document.getElementById('qualify-teams-list');
        listContainer.innerHTML = '';

        // Ambil standings dari activeData untuk stage ini
        const standings = this.activeData.standings[stageId] || [];

        listContainer.innerHTML = standings.map((s, idx) => {
            // Rekomendasi auto-tick untuk mempermudah admin (misal top 4 atau top 8)
            const shouldTick = idx < 4 || idx < 8; // Disarankan loloskan 4 atau 8 tim
            
            return `
                <label class="flex items-center justify-between p-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] hover:border-neutral-700 cursor-pointer select-none">
                    <div class="flex items-center gap-3">
                        <span class="text-[10px] lg:text-xs font-mono font-bold text-neutral-500">#${idx + 1}</span>
                        <span class="text-xs lg:text-base font-bold text-neutral-200">${s.nama_tim}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] lg:text-xs font-mono font-bold text-emerald-400">${s.wins}W - ${s.losses}L</span>
                        <input type="checkbox" name="qualifier-team" value="${s.id}" ${shouldTick ? 'checked' : ''}
                            class="w-4 h-4 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-neutral-100 focus:ring-0">
                    </div>
                </label>
            `;
        }).join('');

        document.getElementById('modal-loloskan-playoff').dataset.stageId = stageId;
        document.getElementById('modal-loloskan-playoff').classList.remove('hidden');
    },

    closeQualifyModal() {
        document.getElementById('modal-loloskan-playoff').classList.add('hidden');
    },

    async submitQualifiers() {
        const stageId = document.getElementById('modal-loloskan-playoff').dataset.stageId;
        const checkedBoxes = document.querySelectorAll('input[name="qualifier-team"]:checked');
        const qualified_team_ids = Array.from(checkedBoxes).map(cb => parseInt(cb.value));

        if (qualified_team_ids.length < 2) {
            Toast.error('Pilih minimal 2 tim untuk masuk ke babak Playoffs.');
            return;
        }

        // Warning jika jumlah tim bukan kelipatan pangkat 2 (misal 3 atau 5)
        const size = qualified_team_ids.length;
        const isPowerOf2 = (size & (size - 1)) === 0;
        
        if (!isPowerOf2) {
            Modal.confirm(`Jumlah tim terpilih (${size}) bukan kelipatan 2 (misal: 2, 4, 8, 16). Ini akan menghasilkan slot BYE di Playoffs. Lanjutkan?`, async () => {
                await this.sendFinishStage(stageId, qualified_team_ids);
            });
        } else {
            await this.sendFinishStage(stageId, qualified_team_ids);
        }
    },

    async sendFinishStage(stageId, qualified_team_ids) {
        try {
            const res = await API.tournament.finishStage(stageId, { qualified_team_ids });
            Toast.success(res.message);
            this.closeQualifyModal();
            this.renderDetail(this.activeTournamentId);
        } catch (err) {
            Toast.error(err.message || 'Gagal menyelesaikan tahapan');
        }
    },

    async finishStage(stageId) {
        Modal.confirm('Selesaikan turnamen ini secara permanen?', async () => {
            try {
                // Untuk tahap akhir turnamen, kirim list kosong
                const res = await API.tournament.finishStage(stageId, { qualified_team_ids: [1] }); // dummy
                Toast.success(res.message);
                this.renderDetail(this.activeTournamentId);
            } catch (err) {
                Toast.error(err.message || 'Gagal menyelesaikan turnamen');
            }
        });
    },

    // ===== DELETE TOURNAMENT =====
    deleteTournament(tId) {
        Modal.confirm('Apakah Anda yakin ingin menghapus turnamen ini secara permanen? Semua data pertandingan, tim, dan skor akan hilang.', async () => {
            try {
                const res = await API.tournament.delete(tId);
                Toast.success(res.message);
                this.renderList();
            } catch (err) {
                Toast.error(err.message || 'Gagal menghapus turnamen');
            }
        });
    }
};

window.Tournament = Tournament;

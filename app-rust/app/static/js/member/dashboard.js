/* app/static/js/member/dashboard.js */

const MemberHistoryState = {
    tx: { page: 1, jenis: 'all', q: '' },
    sesi: { page: 1, q: '' }
};
const _searchTimers = {};
let _livePcData = [];
let _livePcFilter = 'all';

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDuration(minutes) {
    const m = Math.max(0, Number(minutes) || 0);
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return h > 0 ? `${h}j ${rem}m` : `${rem}m`;
}

function formatRupiah(amount) {
    return 'Rp' + (Number(amount) || 0).toLocaleString('id-ID');
}

function formatJenisTx(jenis) {
    const map = {
        beli_paket_guest: 'Beli Paket - Tambah Waktu',
        beli_paket_member: 'Beli Paket - Tambah Waktu',
        tambah_waktu_sesi: 'Beli Paket - Tambah Waktu',
        tambah_waktu_guest: 'Beli Paket - Tambah Waktu',
        refund_paket: 'Refund',
        blackout_refund: 'Refund'
    };
    return map[jenis] || jenis || '-';
}

function getCsrfToken() {
    return ([...document.cookie.matchAll(/(?:^|; )csrf_token=([^;]+)/g)].pop() || [])[1]
        || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        || '';
}

function notifyUser(type, message) {
    if (typeof showToast === 'function') {
        showToast(type, message);
    } else if (typeof Toast !== 'undefined' && typeof Toast[type] === 'function') {
        Toast[type](message);
    }
}

function switchTab(tabName) {
    ['dashboard', 'livepc', 'profile'].forEach(name => {
        const panel = document.getElementById(`tab-panel-${name}`);
        const btn = document.getElementById(`tab-btn-${name}`);
        if (!panel || !btn) return;
        if (name === tabName) {
            panel.classList.remove('hidden');
            btn.className = 'flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-bold bg-neutral-100 text-black transition-colors text-center whitespace-nowrap';
        } else {
            panel.classList.add('hidden');
            btn.className = 'flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-[#171717] transition-colors text-center whitespace-nowrap';
        }
    });
    sessionStorage.setItem('activeMemberTab', tabName);
    if (tabName === 'livepc') {
        loadMemberLivePC();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('tx_page') || urlParams.has('sesi_page')) {
        MemberHistoryState.tx.page = Number(urlParams.get('tx_page')) || 1;
        MemberHistoryState.sesi.page = Number(urlParams.get('sesi_page')) || 1;
        switchTab('dashboard');
    } else {
        const activeTab = sessionStorage.getItem('activeMemberTab') || 'dashboard';
        switchTab(activeTab);
    }
});

function setTxFilter(jenis, btn) {
    const next = MemberHistoryState.tx.jenis === jenis ? 'all' : jenis;
    MemberHistoryState.tx.jenis = next;
    document.querySelectorAll('#tx-filter-chips .tx-chip').forEach(el => {
        el.className = 'tx-chip px-2.5 py-1 rounded text-[11px] font-medium bg-[#141414] text-neutral-400 hover:text-neutral-200 hover:bg-[#1a1a1a] border border-[#262626] transition-colors';
    });
    if (next !== 'all' && btn) {
        btn.className = 'tx-chip px-2.5 py-1 rounded text-[11px] font-bold bg-neutral-100 text-black border border-neutral-100 transition-colors';
    }
    loadHistory('tx', 1);
}

function onHistorySearch(kind, value) {
    const clearBtn = document.getElementById(`${kind}-search-clear`);
    if (clearBtn) clearBtn.classList.toggle('hidden', !(value || '').trim());
    clearTimeout(_searchTimers[kind]);
    _searchTimers[kind] = setTimeout(() => {
        MemberHistoryState[kind].q = (value || '').trim();
        loadHistory(kind, 1);
    }, 250);
}

function clearHistorySearch(kind) {
    const input = document.getElementById(`${kind}-search-input`);
    const clearBtn = document.getElementById(`${kind}-search-clear`);
    if (input) input.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    MemberHistoryState[kind].q = '';
    loadHistory(kind, 1);
}

async function loadHistory(kind, page = 1) {
    const state = MemberHistoryState[kind];
    state.page = Math.max(1, Number(page) || 1);
    const params = new URLSearchParams({ kind, page: String(state.page), per_page: '10' });
    if (kind === 'tx' && state.jenis !== 'all') params.set('jenis', state.jenis);
    if (state.q) params.set('q', state.q);

    const tbody = document.getElementById(`${kind}-history-tbody`);
    if (tbody) tbody.classList.add('opacity-50');

    try {
        const res = await fetch(`/api/v1/public/member/history?${params.toString()}`);
        if (res.status === 401) {
            window.location.href = '/member/login';
            return;
        }
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Gagal memuat riwayat');

        renderHistoryRows(kind, data.items || []);
        renderPaginationBar(kind, data.pagination);

        const url = new URL(window.location.href);
        url.searchParams.set(kind === 'tx' ? 'tx_page' : 'sesi_page', String(data.pagination.page));
        window.history.replaceState({}, '', url.toString());
    } catch (err) {
        notifyUser('error', err.message || 'Gagal memuat riwayat');
    } finally {
        if (tbody) tbody.classList.remove('opacity-50');
    }
}

function formatDateTimeWithTz(dtStr) {
    if (!dtStr) return '-';
    const parts = dtStr.trim().split(' ');
    if (parts.length >= 2) {
        const datePart = parts[0];
        const timePart = parts.slice(1).join(' ');
        return `<span class="inline-block whitespace-nowrap">${escapeHtml(datePart)}</span> <span class="inline-block whitespace-nowrap text-neutral-400">${escapeHtml(timePart)}</span>`;
    }
    return escapeHtml(dtStr);
}

function renderHistoryRows(kind, items) {
    const tbody = document.getElementById(`${kind}-history-tbody`);
    if (!tbody) return;
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-3 py-8 text-center text-neutral-600 text-xs">Tidak ada data yang cocok.</td></tr>`;
        return;
    }

    if (kind === 'sesi') {
        tbody.innerHTML = items.map(s => {
            const isAktif = s.status === 'aktif';
            const badge = isAktif
                ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 uppercase tracking-wider"><span class="hidden sm:inline">SEDANG MAIN</span><span class="sm:hidden">AKTIF</span></span>'
                : '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#141414] text-neutral-400 border border-[#262626] uppercase tracking-wider">SELESAI</span>';
            return `<tr class="hover:bg-[#141414] transition-colors">
                <td class="px-2.5 sm:px-3 py-2 text-left text-neutral-400 font-mono text-[11px] sm:text-xs leading-tight" title="${escapeHtml(s.mulai_pada_full || s.mulai_pada)}">${formatDateTimeWithTz(s.mulai_pada)}</td>
                <td class="px-2 sm:px-3 py-2.5 text-center"><span class="inline-block px-1.5 py-0.5 rounded bg-[#141414] border border-[#262626] font-mono font-bold text-[11px] text-neutral-200">${escapeHtml(s.pc_kode)}</span></td>
                <td class="px-2 sm:px-3 py-2.5 text-center font-mono text-neutral-300 text-[11px] sm:text-xs whitespace-nowrap">${formatDuration(s.menit_terpakai)}</td>
                <td class="px-2.5 sm:px-3 py-2.5 text-right whitespace-nowrap">${badge}</td>
            </tr>`;
        }).join('');
        return;
    }

    tbody.innerHTML = items.map(t => {
        const nota = t.no_nota ? ` <span class="font-mono text-[10px] text-neutral-600 whitespace-nowrap">#${escapeHtml(t.no_nota)}</span>` : '';
        const amountHtml = t.is_refunded
            ? `<span class="text-red-400/80 line-through">${formatRupiah(t.jumlah)}</span><span class="block text-[9px] text-red-400 font-bold uppercase tracking-wider">REFUND</span>`
            : formatRupiah(t.jumlah);
        return `<tr class="hover:bg-[#141414] transition-colors">
            <td class="hidden sm:table-cell px-3 py-2 text-left text-neutral-400 font-mono text-xs leading-tight" title="${escapeHtml(t.dibuat_pada)}">${formatDateTimeWithTz(t.dibuat_pada)}</td>
            <td class="px-2.5 sm:px-3 py-2.5 text-left min-w-0">
                <p class="font-bold text-neutral-200 text-[11px] sm:text-xs leading-tight break-words">${escapeHtml(t.jenis_display || formatJenisTx(t.jenis))}</p>
                <p class="text-[10px] sm:text-[11px] text-neutral-500 leading-tight break-words mt-0.5" title="${escapeHtml(t.keterangan || 'Tanpa Catatan')}">${escapeHtml(t.keterangan || 'Tanpa Catatan')}${nota}</p>
                <p class="sm:hidden text-[10px] text-neutral-500 font-mono mt-0.5 leading-tight">${formatDateTimeWithTz(t.dibuat_pada)}</p>
            </td>
            <td class="px-2 sm:px-3 py-2.5 text-center font-mono text-neutral-400 text-[11px] sm:text-xs whitespace-nowrap">${formatDuration(t.menit)}</td>
            <td class="px-2.5 sm:px-3 py-2.5 text-right font-mono font-bold text-neutral-200 text-[11px] sm:text-xs whitespace-nowrap">${amountHtml}</td>
        </tr>`;
    }).join('');
}

function renderPaginationBar(kind, pag) {
    const bar = document.getElementById(`${kind}-pagination-bar`);
    if (!bar) return;
    if (!pag || pag.pages <= 1) {
        bar.innerHTML = '';
        return;
    }
    const qParam = kind === 'tx' ? 'tx_page' : 'sesi_page';
    const unitLabel = kind === 'tx' ? 'transaksi' : 'sesi';
    const prevBtn = pag.has_prev
        ? `<a href="/member/dashboard?${qParam}=${pag.prev_num}" onclick="event.preventDefault(); loadHistory('${kind}', ${pag.prev_num})" class="px-2.5 py-1 bg-[#121212] border border-[#262626] hover:border-neutral-500 hover:text-neutral-100 rounded text-neutral-300 transition-colors">&larr; Prev</a>`
        : `<span class="px-2.5 py-1 bg-[#0a0a0a] border border-[#1c1c1c] text-neutral-600 rounded cursor-not-allowed">&larr; Prev</span>`;
    const nextBtn = pag.has_next
        ? `<a href="/member/dashboard?${qParam}=${pag.next_num}" onclick="event.preventDefault(); loadHistory('${kind}', ${pag.next_num})" class="px-2.5 py-1 bg-[#121212] border border-[#262626] hover:border-neutral-500 hover:text-neutral-100 rounded text-neutral-300 transition-colors">Next &rarr;</a>`
        : `<span class="px-2.5 py-1 bg-[#0a0a0a] border border-[#1c1c1c] text-neutral-600 rounded cursor-not-allowed">Next &rarr;</span>`;

    bar.innerHTML = `
        <div class="text-neutral-500">Hal <span class="text-neutral-200 font-bold">${pag.page}</span>/${pag.pages} <span class="hidden sm:inline text-neutral-600">(${pag.total} ${unitLabel})</span></div>
        <div class="flex items-center gap-1.5">${prevBtn}${nextBtn}</div>
    `;
}

function setLivePcFilter(filter, btn) {
    _livePcFilter = filter;
    document.querySelectorAll('#livepc-filter-chips .livepc-chip').forEach(el => {
        el.className = 'livepc-chip px-2.5 py-1 rounded text-[11px] font-medium bg-[#141414] text-neutral-400 hover:text-neutral-200 hover:bg-[#1a1a1a] border border-[#262626] transition-colors';
    });
    if (btn) {
        btn.className = 'livepc-chip px-2.5 py-1 rounded text-[11px] font-bold bg-neutral-100 text-black border border-neutral-100 transition-colors';
    }
    renderMemberLivePC();
}

function renderMemberLivePC() {
    const grid = document.getElementById('member-pc-grid');
    if (!grid) return;
    const filtered = _livePcData.filter(p => {
        if (_livePcFilter === 'kosong') return p.status === 'kosong';
        if (_livePcFilter === 'terpakai') return p.status !== 'kosong';
        return true;
    });
    if (!filtered.length) {
        grid.innerHTML = `<div class="col-span-full py-10 text-center text-xs text-neutral-600 border border-[#1c1c1c] rounded bg-[#0a0a0a]">Tidak ada PC yang sesuai dengan filter ini.</div>`;
        return;
    }
    grid.innerHTML = filtered.map(p => {
        const kosong = p.status === 'kosong';
        const borderCls = kosong
            ? 'bg-emerald-950/20 border-emerald-800/40'
            : 'bg-[#111] border-[#222]';
        const dotCls = kosong ? 'bg-emerald-500' : 'bg-neutral-600';
        const statusTxt = kosong ? 'TERSEDIA' : (p.sisa_tampil || 'TERPAKAI');
        const statusCls = kosong ? 'text-emerald-400' : 'text-neutral-400';
        return `<div class="border rounded p-2.5 sm:p-3 ${borderCls} flex flex-col justify-between gap-2">
            <div class="flex items-center justify-between gap-1.5">
                <div class="flex items-center gap-1.5 min-w-0">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}"></span>
                    <span class="font-mono font-bold text-xs sm:text-sm text-neutral-100 break-words leading-tight">${escapeHtml(p.kode)}</span>
                </div>
                <span class="text-[9px] font-mono uppercase text-neutral-500 shrink-0">${escapeHtml(p.grup)}</span>
            </div>
            <div class="pt-1.5 border-t border-[#1c1c1c] flex items-center justify-between">
                <span class="text-[10px] font-mono font-bold uppercase tracking-wider ${statusCls}">${escapeHtml(statusTxt)}</span>
            </div>
        </div>`;
    }).join('');
}

async function loadMemberLivePC() {
    const grid = document.getElementById('member-pc-grid');
    const counter = document.getElementById('member-pc-counter');
    if (!grid || !counter) return;
    try {
        const res = await fetch('/pc-status');
        if (!res.ok) throw new Error('Gagal memuat status PC');
        _livePcData = await res.json();
        const vacant = _livePcData.filter(p => p.status === 'kosong').length;
        counter.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span> ${vacant} / ${_livePcData.length} PC Tersedia`;
        renderMemberLivePC();
    } catch (err) {
        counter.textContent = 'Gagal memuat';
        grid.innerHTML = `<div class="col-span-full py-10 text-center text-xs text-red-400 border border-red-900/30 rounded bg-red-950/10">Gagal memuat status ketersediaan PC.</div>`;
    }
}

async function updateProfile(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';

    try {
        const passwordEl = document.getElementById('prof_password');
        const passwordVal = passwordEl ? passwordEl.value : '';
        const payload = {
            nama_lengkap: document.getElementById('prof_nama')?.value || '',
            email: document.getElementById('prof_email')?.value || '',
            no_hp: document.getElementById('prof_hp')?.value || '',
        };
        if (passwordVal) {
            payload.password = passwordVal;
        }

        const res = await fetch('/member/profile/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
            notifyUser('success', 'Profil berhasil diperbarui');
            if (passwordEl) passwordEl.value = '';
        } else {
            notifyUser('error', data.error || 'Gagal memperbarui profil');
        }
    } catch (err) {
        notifyUser('error', 'Gagal terhubung ke server');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function submitLogout() {
    try {
        const res = await fetch('/member/logout', {
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfToken() }
        });
        const data = await res.json();
        if (res.ok && data.success) {
            window.location.href = data.redirect;
        } else {
            notifyUser('error', data.error || 'Gagal keluar dari sesi');
        }
    } catch (err) {
        notifyUser('error', 'Gagal logout, silakan coba lagi.');
    }
}

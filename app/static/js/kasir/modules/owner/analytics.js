// Owner Analytics Dashboard — 8 Card Text KPI

const OwnerAnalytics = {
    async load() {
        const s = document.getElementById('filter-start');
        const e = document.getElementById('filter-end');
        if (!s.value || !e.value) {
            const t = new Date(), w = new Date(t);
            w.setDate(t.getDate() - 6);
            s.value = w.toISOString().slice(0, 10);
            e.value = t.toISOString().slice(0, 10);
        }

        document.getElementById('analytics-loading').classList.remove('hidden');
        document.getElementById('analytics-cards').classList.add('hidden');

        try {
            const p = new URLSearchParams({start: s.value, end: e.value});
            const res = await API.request('/kasir/api/analytics?' + p);
            if (!res.success) throw new Error(res.error);
            const d = res.data, pd = d.pendapatan_harian;

            // 1. Pendapatan Billing
            const totalB = pd.billing.reduce((a,b)=>a+b,0);
            document.getElementById('kpi-total-billing').textContent = 'Rp' + totalB.toLocaleString('id-ID');
            document.getElementById('kpi-tabel-billing').innerHTML = gridTable(['Tanggal', 'Pendapatan'],
                pd.labels.map((l,i) => [l, 'Rp' + pd.billing[i].toLocaleString('id-ID')]));
            setScroll('kpi-tabel-billing', pd.labels.length, 10);

            // 2. Pendapatan Kantin
            const totalK = pd.kantin.reduce((a,b)=>a+b,0);
            document.getElementById('kpi-total-kantin').textContent = 'Rp' + totalK.toLocaleString('id-ID');
            document.getElementById('kpi-tabel-kantin').innerHTML = gridTable(['Tanggal', 'Pendapatan'],
                pd.labels.map((l,i) => [l, 'Rp' + pd.kantin[i].toLocaleString('id-ID')]));
            setScroll('kpi-tabel-kantin', pd.labels.length, 10);

            // 3. Pendapatan PC
            const rp = d.revenue_per_pc;
            document.getElementById('kpi-pc').innerHTML = rp.labels.slice(0,5).map((l,i) =>
                `<div class="flex justify-between py-1.5 ${i>0?'border-t border-[#2a2a2a]':''}">
                    <span class="text-neutral-400">${l}</span>
                    <span class="text-white font-semibold">Rp${rp.data[i].toLocaleString('id-ID')}</span>
                </div>`
            ).join('') || '<div class="text-neutral-500 py-2">Belum ada data</div>';
            setScroll('kpi-pc', rp.labels.length, 10);

            // 4. Paket Terlaris
            const tp = d.top_paket;
            document.getElementById('kpi-paket').innerHTML = tp.labels.map((l,i) =>
                `<div class="flex justify-between py-1.5 ${i>0?'border-t border-[#2a2a2a]':''}">
                    <span><span class="text-neutral-600">${i+1}.</span> <span class="text-neutral-300">${l}</span></span>
                    <span class="text-white font-semibold">${tp.data[i]}x</span>
                </div>`
            ).join('') || '<div class="text-neutral-500 py-2">Belum ada data</div>';
            setScroll('kpi-paket', tp.labels.length, 10);

            // 5. Per Kasir
            const pk = d.pendapatan_per_kasir;
            document.getElementById('kpi-kasir').innerHTML = pk.labels.map((l,i) =>
                `<div class="flex justify-between py-1.5 ${i>0?'border-t border-[#2a2a2a]':''}">
                    <span class="text-neutral-400">${l}</span>
                    <span class="text-white font-semibold">Rp${pk.data[i].toLocaleString('id-ID')}</span>
                </div>`
            ).join('') || '<div class="text-neutral-500 py-2">Belum ada data</div>';
            setScroll('kpi-kasir', pk.labels.length, 10);

            // 6. Member
            const mb = d.member_trend;
            const baru = mb.baru.reduce((a,b)=>a+b,0);
            const keluar = mb.kadaluarsa.reduce((a,b)=>a+b,0);
            const bersih = baru - keluar;
            document.getElementById('kpi-member').innerHTML = `
                <div class="flex justify-between py-1.5">
                    <span class="text-green-400 text-sm font-bold">+${baru}</span>
                    <span class="text-neutral-500">Anggota Baru</span>
                </div>
                <div class="flex justify-between py-1.5 border-t border-[#2a2a2a]">
                    <span class="text-red-400 text-sm font-bold">-${keluar}</span>
                    <span class="text-neutral-500">Anggota Keluar</span>
                </div>
                <div class="flex justify-between py-1.5 border-t border-[#2a2a2a]">
                    <span class="text-white font-bold text-sm">${bersih >= 0 ? '+' : ''}${bersih}</span>
                    <span class="text-neutral-500">Bersih</span>
                </div>
            `;

            // 7. Jam Sibuk
            const hm = d.heatmap_jam_sibuk;
            const sorted = hm.data.map((v,i) => ({label: hm.labels[i], val: v})).sort((a,b) => b.val - a.val);
            document.getElementById('kpi-heatmap').innerHTML = sorted.slice(0,3).map((item, i) =>
                `<div class="flex justify-between py-1.5 ${i>0?'border-t border-[#2a2a2a]':''}">
                    <span class="text-neutral-400">${i+1}. ${item.label}</span>
                    <span class="text-yellow-400 font-semibold">${item.val}%</span>
                </div>`
            ).join('');

            // 8. Refund
            const rf = d.refund_rate;
            const sukses = rf.total - rf.refund;
            document.getElementById('kpi-refund').innerHTML = `
                <div class="text-sm lg:text-2xl font-bold text-yellow-400 mb-3">${rf.refund_rate}%</div>
                <div class="flex justify-between py-1.5"><span class="text-neutral-500">Total Transaksi</span><span class="text-white font-semibold">${rf.total}</span></div>
                <div class="flex justify-between py-1.5 border-t border-[#2a2a2a]"><span class="text-green-400">Berhasil</span><span class="text-white font-semibold">${sukses}</span></div>
                <div class="flex justify-between py-1.5 border-t border-[#2a2a2a]"><span class="text-red-400">Refund</span><span class="text-white font-semibold">${rf.refund}</span></div>
            `;

            document.getElementById('analytics-loading').classList.add('hidden');
            document.getElementById('analytics-cards').classList.remove('hidden');
        } catch (err) {
            document.getElementById('analytics-loading').innerHTML =
                `<div class="text-red-400 text-sm">Gagal: ${err.message}</div>`;
        }
    }
};

// Helper: scroll kalo data > 10 item
function setScroll(id, count, thresh) {
    const el = document.getElementById(id);
    if (count > thresh) {
        el.style.maxHeight = '360px';
        el.style.overflowY = 'auto';
        el.style.scrollbarWidth = 'thin';
        el.style.scrollbarColor = '#333 transparent';
    }
}

// Helper: render tabel 2 kolom dengan border grid
function gridTable(headers, rows) {
    return `<div class="border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div class="flex bg-[#080808] border-b border-[#2a2a2a]">
            <div class="flex-1 px-3 py-2 text-neutral-500 text-xs lg:text-base border-r border-[#2a2a2a]">${headers[0]}</div>
            <div class="flex-1 px-3 py-2 text-right text-neutral-500 text-xs lg:text-base">${headers[1]}</div>
        </div>
        ${rows.map((r, i) => `<div class="flex ${i < rows.length-1 ? 'border-b border-[#2a2a2a]' : ''}">
            <div class="flex-1 px-3 py-2 text-neutral-400 text-xs lg:text-base border-r border-[#2a2a2a]">${r[0]}</div>
            <div class="flex-1 px-3 py-2 text-right text-white text-xs lg:text-base">${r[1]}</div>
        </div>`).join('')}
    </div>`;
}

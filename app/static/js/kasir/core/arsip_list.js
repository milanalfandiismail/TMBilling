// app/static/js/kasir/core/arsip_list.js
// Renderer arsip bersama. Markup tiap resource menyalin tampilan aktifnya
// (tabel/kartu, warna, badge) supaya arsip terlihat persis sama; hanya sel aksi
// yang berganti menjadi Pulihkan + Hapus permanen.
const ArsipList = {
    _refresh: null,

    PILL_BASE: 'px-2.5 py-1 rounded text-[11px] ',
    PILL_ON: 'bg-neutral-100 text-black font-bold',
    PILL_OFF: 'text-neutral-400 hover:text-neutral-200 hover:bg-[#171717] font-medium',

    SCHEMA: {
        grup: {
            emptyText: 'Belum ada grup diarsipkan',
            unit: 'Grup',
            ariaLabel: () => '',
            render(items) {
                const rows = items.map(g => {
                    const nama = ArsipList.esc(g.nama);
                    const color = g.warna || '#3b82f6';
                    const ket = ArsipList.esc(g.keterangan || '-');
                    return `<tr class="hover:bg-[#121212] transition-colors">
                        <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center font-mono text-neutral-500 text-xs 2xl:text-sm">#${g.id}</td>
                        <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left">
                            <div class="flex items-center gap-2">
                                <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: ${color};"></span>
                                <span class="px-2 py-0.5 rounded text-[11px] sm:text-xs 2xl:text-sm font-bold tracking-wide uppercase inline-block font-mono" style="background-color: ${color}18; color: ${color}; border: 1px solid ${color}33;">${nama}</span>
                            </div>
                        </td>
                        <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left">
                            <span class="text-neutral-300 text-xs 2xl:text-sm truncate max-w-[150px] sm:max-w-xs xl:max-w-md">${ket}</span>
                        </td>
                        <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-right remote-hide-action">${ArsipList.actions('grup', g, g.nama, 'table')}</td>
                    </tr>`;
                }).join('');
                return ArsipList.tableShell(`
                    <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center w-12 font-bold">ID</th>
                    <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left font-bold">Nama Grup / Zona</th>
                    <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left font-bold">Keterangan & PC</th>
                    <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-right font-bold w-24 sm:w-28 remote-hide-action">Aksi</th>`,
                    rows, 'text-[10px] sm:text-xs 2xl:text-sm text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]');
            }
        },

        paket: {
            emptyText: 'Belum ada paket diarsipkan',
            unit: 'Paket',
            render(items) {
                const rows = items.map(p => `<tr class="hover:bg-[#121212] transition-colors">
                    <td class="px-2.5 sm:px-3 2xl:px-4 py-1.5 sm:py-2 2xl:py-3 text-left">
                        <span class="font-bold text-neutral-200 block truncate max-w-[130px] sm:max-w-xs 2xl:max-w-none 2xl:text-sm">${ArsipList.esc(p.nama)}</span>
                    </td>
                    <td class="px-2 sm:px-3 2xl:px-4 py-1.5 sm:py-2 2xl:py-3 text-center font-mono">
                        <span class="text-neutral-300 font-bold bg-[#141414] border border-[#222] px-2 2xl:px-2.5 py-0.5 2xl:py-1 rounded text-[10px] sm:text-xs 2xl:text-sm whitespace-nowrap inline-block">${Utils.formatDurasiFriendly(p.durasi_menit)}</span>
                    </td>
                    <td class="px-2 sm:px-3 2xl:px-4 py-1.5 sm:py-2 2xl:py-3 text-center font-mono">
                        <span class="text-neutral-100 font-bold whitespace-nowrap text-[11px] sm:text-xs 2xl:text-sm">${Utils.formatRupiah(p.harga)}</span>
                    </td>
                    <td class="hidden sm:table-cell px-2 sm:px-3 2xl:px-4 py-1.5 sm:py-2 2xl:py-3 text-center font-mono text-neutral-400 text-xs 2xl:text-sm">${p.kadaluarsa_hari || 30} Hari</td>
                    <td class="px-2 sm:px-3 2xl:px-4 py-1.5 sm:py-2 2xl:py-3 text-right remote-hide-action">${ArsipList.actions('paket', p, p.nama, 'table')}</td>
                </tr>`).join('');
                return ArsipList.tableShell(`
                    <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-3 text-left font-bold w-2/5 sm:w-1/3">Paket</th>
                    <th class="px-2 sm:px-3 2xl:px-4 py-2 2xl:py-3 text-center font-bold w-1/4 sm:w-1/5">Durasi</th>
                    <th class="px-2 sm:px-3 2xl:px-4 py-2 2xl:py-3 text-center font-bold w-1/4 sm:w-1/5">Harga</th>
                    <th class="hidden sm:table-cell px-2 sm:px-3 2xl:px-4 py-2 2xl:py-3 text-center font-bold w-1/6">Masa Aktif</th>
                    <th class="px-2 sm:px-3 2xl:px-4 py-2 2xl:py-3 text-right font-bold w-16 sm:w-20 2xl:w-24 remote-hide-action">Aksi</th>`,
                    rows, 'text-[10px] sm:text-xs 2xl:text-sm text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]');
            }
        },

        member: {
            emptyText: 'Belum ada member diarsipkan',
            unit: 'Member',
            render(items) {
                const rows = items.map(m => {
                    const grupNama = (typeof m.grup === 'object' ? m.grup.nama : m.grup) || 'reguler';
                    const warna = m.grup_warna || '#3b82f6';
                    return `<tr class="hover:bg-[#141414] transition-colors">
                        <td class="px-2.5 sm:px-3 py-2 text-left">
                            <div class="flex items-center gap-2">
                                <div class="w-7 h-7 sm:w-8 sm:h-8 rounded bg-[#171717] border border-[#262626] flex items-center justify-center text-neutral-200 font-bold text-xs shrink-0">${ArsipList.esc((m.username || '?').charAt(0).toUpperCase())}</div>
                                <div class="min-w-0">
                                    <div class="font-bold text-neutral-200 text-xs sm:text-sm truncate max-w-[85px] sm:max-w-[140px] md:max-w-none" title="${ArsipList.esc(m.username)}">${ArsipList.esc(m.username)}</div>
                                    <div class="flex items-center gap-1.5 mt-0.5">
                                        <span class="sm:hidden px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase shrink-0" style="background-color: ${warna}15; color: ${warna}; border: 1px solid ${warna}30;">${ArsipList.esc(grupNama)}</span>
                                        <span class="hidden sm:inline text-[10px] text-neutral-500 truncate max-w-[120px] xl:max-w-[160px]">${ArsipList.esc(m.nama_lengkap || '-')}</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="hidden sm:table-cell px-2.5 sm:px-3 py-2 text-center">
                            <span class="px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold uppercase inline-block" style="background-color: ${warna}15; color: ${warna}; border: 1px solid ${warna}25;">${ArsipList.esc(grupNama)}</span>
                        </td>
                        <td class="px-2.5 sm:px-3 py-2 text-center font-mono">
                            <div class="inline-flex flex-col items-center">
                                <span class="text-neutral-200 font-bold text-xs sm:text-sm">${Utils.formatMenit(m.waktu_tersimpan)}</span>
                                <span class="sm:hidden text-[9px] font-sans flex items-center gap-1 mt-0.5 text-neutral-500"><span class="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>Kunci</span>
                            </div>
                        </td>
                        <td class="hidden md:table-cell px-2.5 sm:px-3 py-2 text-center font-mono">
                            <span class="text-neutral-400 text-xs">${ArsipList.esc(m.kadaluarsa_pada_display || '-')}</span>
                        </td>
                        <td class="hidden sm:table-cell px-2.5 sm:px-3 py-2 text-center">
                            <span class="inline-flex items-center gap-1 text-[10px] sm:text-xs text-neutral-500 bg-[#0c0c0c] border border-[#1c1c1c] px-2 py-0.5 rounded font-bold"><span class="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>Terkunci</span>
                        </td>
                        <td class="px-2.5 sm:px-3 py-2 text-right">${ArsipList.actions('member', m, m.username, 'table')}</td>
                    </tr>`;
                }).join('');
                return ArsipList.tableShell(`
                    <th class="px-2.5 sm:px-3 py-2 text-left font-semibold">Member</th>
                    <th class="hidden sm:table-cell px-2.5 sm:px-3 py-2 text-center font-semibold">Grup</th>
                    <th class="px-2.5 sm:px-3 py-2 text-center font-semibold">Waktu</th>
                    <th class="hidden md:table-cell px-2.5 sm:px-3 py-2 text-center font-semibold">Berlaku Sampai</th>
                    <th class="hidden sm:table-cell px-2.5 sm:px-3 py-2 text-center font-semibold">Status</th>
                    <th class="px-2.5 sm:px-3 py-2 text-right font-semibold">Aksi</th>`,
                    rows, 'text-[10px] sm:text-xs text-neutral-400 uppercase border-b border-[#1c1c1c] bg-[#0c0c0c] tracking-wider select-none', 'w-full text-xs');
            }
        },

        user: {
            emptyText: 'Belum ada user diarsipkan',
            unit: 'User',
            render(items) {
                const rows = items.map(u => {
                    const roleBadge = u.role === 'admin'
                        ? '<span class="px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-[#2d1215] text-red-400 border border-red-900/30 uppercase tracking-wide">Admin</span>'
                        : '<span class="px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-[#171717] text-neutral-300 border border-[#262626] uppercase tracking-wide">Staff</span>';
                    const kuota = u.role === 'kasir'
                        ? `<div class="inline-flex items-center gap-1.5 font-mono text-xs 2xl:text-sm">
                            <span class="text-neutral-200 font-medium">${Math.floor((u.sisa_kuota_menit || 0) / 60)}j ${(u.sisa_kuota_menit || 0) % 60}m</span>
                            <span class="text-neutral-500 text-[10px] sm:text-xs">/ ${Math.floor((u.kuota_main_bulanan || 0) / 60)} Jam</span>
                           </div>`
                        : '<span class="text-neutral-600 text-xs font-mono">-</span>';
                    return `<tr class="hover:bg-[#121212] transition-colors">
                        <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left">
                            <div class="flex items-center gap-2 sm:gap-2.5">
                                <div class="w-6 h-6 sm:w-7 sm:h-7 2xl:w-8 2xl:h-8 rounded bg-[#171717] border border-[#262626] flex items-center justify-center text-neutral-200 font-bold text-xs 2xl:text-sm shrink-0">${ArsipList.esc((u.username || '?').charAt(0).toUpperCase())}</div>
                                <div class="min-w-0">
                                    <div class="font-bold text-neutral-200 text-xs 2xl:text-sm truncate font-mono">${ArsipList.esc(u.username)}</div>
                                    <div class="text-[10px] sm:text-xs text-neutral-500 truncate">${ArsipList.esc(u.nama_lengkap || '-')}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center">${roleBadge}</td>
                        <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left">${kuota}</td>
                        <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center"><span class="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-neutral-500 font-mono"><span class="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>Nonaktif</span></td>
                        <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-right">${ArsipList.actions('user', u, u.username, 'table')}</td>
                    </tr>`;
                }).join('');
                return ArsipList.tableShell(`
                    <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left font-bold">Operator</th>
                    <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center font-bold">Role</th>
                    <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left font-bold">Benefit Bermain</th>
                    <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center font-bold">Status</th>
                    <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-right font-bold w-24 sm:w-28">Kelola</th>`,
                    rows, 'text-[10px] sm:text-xs 2xl:text-sm text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]');
            }
        },

        game: {
            emptyText: 'Belum ada game diarsipkan',
            unit: 'Game',
            render(items) {
                const rows = items.map(g => {
                    const icon = g.icon_url ? API.resolveMediaUrl(g.icon_url) : '';
                    const kat = (g.kategori_list && g.kategori_list.length ? g.kategori_list : (g.kategori ? [g.kategori] : []));
                    const tags = kat.length
                        ? kat.map(k => `<span class="px-1.5 py-0.5 rounded bg-[#171717] border border-[#262626] text-[10px] text-neutral-400">${ArsipList.esc(k)}</span>`).join('')
                        : '<span class="text-neutral-600 text-xs">-</span>';
                    const tipe = g.tipe ? `<span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#171717] border border-[#262626] text-neutral-400 uppercase">${ArsipList.esc(g.tipe)}</span>` : '';
                    const cover = icon
                        ? `<img src="${icon}" alt="${ArsipList.esc(g.nama)}" class="w-8 h-11 xl:w-9 xl:h-12 rounded object-cover border border-[#1c1c1c] bg-[#141414] shadow-sm flex-shrink-0">`
                        : `<div class="w-8 h-11 xl:w-9 xl:h-12 rounded border border-[#1c1c1c] bg-[#141414] flex items-center justify-center text-[9px] text-neutral-600 flex-shrink-0">-</div>`;
                    return `<tr class="hover:bg-[#141414] transition-colors border-b border-[#1c1c1c] text-xs lg:text-[10px] xl:text-xs 2xl:text-sm">
                        <td class="px-2.5 py-1.5 align-middle overflow-hidden">
                            <div class="flex items-center gap-3">
                                ${cover}
                                <div class="min-w-0 flex-1">
                                    <div class="font-bold text-neutral-100 text-xs 2xl:text-sm truncate">${ArsipList.esc(g.nama)}</div>
                                    <div class="text-[9.5px] xl:text-[10px] 2xl:text-xs text-neutral-500 font-mono mt-0.5 truncate max-w-xs" title="${ArsipList.esc(g.exe_path || '-')}">${ArsipList.esc(g.exe_path || '-')}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-2 py-1.5 align-middle text-center overflow-hidden">${tipe}</td>
                        <td class="px-2.5 py-1.5 align-middle overflow-hidden"><div class="flex flex-wrap gap-1 items-center">${tags}</div></td>
                        <td class="px-2 py-1.5 align-middle text-center overflow-hidden"><span class="font-bold text-xs text-neutral-500">TIDAK</span></td>
                        <td class="px-2 py-1.5 align-middle text-center overflow-hidden remote-hide-action">${ArsipList.actions('game', g, g.nama, 'small')}</td>
                    </tr>`;
                }).join('');
                return ArsipList.tableShell(`
                    <th class="px-2.5 py-2 text-left font-bold">Item, Cover &amp; Path</th>
                    <th class="px-2 py-2 text-center font-bold w-20">Jenis</th>
                    <th class="px-2.5 py-2 text-left font-bold">Kategori / Genre</th>
                    <th class="px-2 py-2 text-center font-bold w-16">Publik</th>
                    <th class="px-2 py-2 text-center font-bold w-24 remote-hide-action">Aksi</th>`,
                    rows, 'text-[10px] sm:text-xs 2xl:text-sm text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]');
            }
        },

        pc: {
            emptyText: 'Belum ada PC diarsipkan',
            unit: 'Unit',
            render(items) {
                const cards = items.map(pc => `<div class="bg-[#0c0c0c] border border-[#242424] rounded p-2.5 sm:p-3 2xl:p-3.5 transition-colors hover:bg-[#121212] relative group flex flex-col justify-between min-h-[82px] sm:min-h-[88px] 2xl:min-h-[98px]">
                    <div class="flex items-center justify-between gap-1.5 min-w-0">
                        <div class="flex items-center gap-1.5 min-w-0 flex-1">
                            <svg class="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                            <span class="font-bold text-xs sm:text-xs 2xl:text-sm text-neutral-100 truncate min-w-0" title="${ArsipList.esc(pc.kode)}">${ArsipList.esc(pc.kode)}</span>
                        </div>
                        <span class="w-2 h-2 2xl:w-2.5 2xl:h-2.5 rounded-full bg-neutral-500 shrink-0" title="ARSIP"></span>
                    </div>
                    <div class="text-[9px] sm:text-[10px] 2xl:text-xs text-neutral-400 font-mono my-1 flex items-center justify-between gap-1.5 min-w-0">
                        <span class="truncate min-w-0 flex-1">${ArsipList.esc(pc.ip_address || '-')}</span>
                    </div>
                    <div class="flex items-center justify-between gap-1">
                        <span class="text-[8px] sm:text-[9px] 2xl:text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-500 shrink-0">ARSIP</span>
                        ${ArsipList.actions('pc', pc, pc.kode, 'card')}
                    </div>
                </div>`).join('');
                return `<div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-2.5 2xl:gap-3 p-2 sm:p-2.5">${cards}</div>`;
            }
        },

        menu: {
            emptyText: 'Belum ada menu diarsipkan',
            unit: 'Menu',
            render(items) {
                const cards = items.map(m => {
                    const img = m.gambar_path ? API.resolveMediaUrl(m.gambar_path) : '';
                    const isUnlimited = m.stok < 0;
                    const stokText = isUnlimited ? 'Unlimited' : `Stok: ${m.stok}`;
                    const stokColor = isUnlimited ? 'text-emerald-400 font-bold' : (m.stok < 5 ? 'text-amber-400 font-bold' : 'text-neutral-400 font-semibold');
                    const imgHtml = img
                        ? `<div class="w-full aspect-[4/3] rounded-lg overflow-hidden border border-[#1f1f1f] bg-[#0c0c0c] relative">
                             <img src="${img}" alt="${ArsipList.esc(m.nama)}" class="w-full h-full object-cover object-center" loading="lazy">
                             <span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/90 border border-[#2a2a2a] ${stokColor} rounded text-[9px] font-mono shadow">${stokText}</span>
                           </div>`
                        : `<div class="w-full aspect-[4/3] rounded-lg border border-[#1f1f1f] bg-[#090909] flex flex-col items-center justify-center text-neutral-600 relative">
                             <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path></svg>
                             <span class="text-[9px] text-neutral-600 mt-1 font-medium">No Image</span>
                             <span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/90 border border-[#2a2a2a] ${stokColor} rounded text-[9px] font-mono shadow">${stokText}</span>
                           </div>`;
                    return `<div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-2 sm:p-2.5 flex flex-col justify-between group relative select-none" title="${ArsipList.esc(m.nama)}">
                        <div class="space-y-1.5 sm:space-y-2">
                            ${imgHtml}
                            <div class="flex items-start justify-between gap-1.5 min-w-0">
                                <h4 class="text-xs font-bold text-neutral-100 line-clamp-2 leading-snug flex-1 min-w-0">${ArsipList.esc(m.nama)}</h4>
                            </div>
                        </div>
                        <div class="mt-2 pt-1.5 border-t border-[#181818] flex items-center justify-between gap-1">
                            <span class="text-xs font-bold font-mono text-neutral-200 tabular-nums">${Utils.formatRupiah(m.harga)}</span>
                            <span class="text-[9px] font-mono text-neutral-500">${m.transaksi_count || 0} transaksi historis</span>
                        </div>
                        <div class="mt-1.5 flex items-center justify-end gap-1">${ArsipList.actions('menu', m, m.nama, 'menu')}</div>
                    </div>`;
                }).join('');
                return `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-2.5 xl:gap-3 p-2 sm:p-2.5">${cards}</div>`;
            }
        }
    },

    esc(value) {
        return (typeof Utils !== 'undefined' && Utils.escapeHtml)
            ? Utils.escapeHtml(value == null ? '' : String(value))
            : String(value == null ? '' : value);
    },

    jsString(text) {
        return String(text == null ? '' : text).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    },

    // Shell tabel identik dengan tabel aktif; headerclHas = class baris <tr> thead.
    tableShell(headHtml, rowsHtml, theadCls, tableCls = 'w-full text-xs 2xl:text-sm') {
        return `<div class="overflow-x-auto w-full border border-[#1c1c1c] rounded">
            <table class="${tableCls}">
                <thead><tr class="${theadCls}">${headHtml}</tr></thead>
                <tbody class="divide-y divide-[#1a1a1a]">${rowsHtml}</tbody>
            </table>
        </div>`;
    },

    schemaOf(res) {
        return this.SCHEMA[res] || { emptyText: 'Belum ada data diarsipkan', render: () => '' };
    },

    async fetch(key) {
        const items = await this.loadAll();
        return items[key] || [];
    },

    async loadAll() {
        const payload = await API.request('/api/v1/kasir/arsip/');
        return payload.data || {};
    },

    filter: { grup: null, tipe: null, kategori: null },

    // '' / undefined dari pill yang belum dipilih jangan sampai jadi 0 dan menyaring semua baris.
    setGrup(value) {
        this.filter.grup = (value === '' || value === null || value === undefined) ? null : Number(value);
    },

    match(item) {
        const { grup, tipe, kategori } = this.filter;
        // Grup & menu tidak punya grup_id; keduanya tidak ikut disaring pill grup.
        if (grup !== null && item.grup_id !== undefined && item.grup_id !== null
            && Number(item.grup_id) !== Number(grup)) return false;
        if (tipe !== null && tipe !== 'all' && item.tipe !== tipe) return false;
        if (kategori !== null && kategori !== 'all') {
            const list = item.kategori_list || (item.kategori ? String(item.kategori).split(',') : []);
            const names = list.map(k => String(k).trim().toLowerCase());
            if (!names.includes(String(kategori).toLowerCase())) return false;
        }
        return true;
    },

    // Jumlah per grup untuk pill — sumbernya data mode yang sedang tampil.
    counts(items) {
        const counts = {};
        (items || []).forEach(i => {
            if (i.grup_id === null || i.grup_id === undefined) return;
            const key = String(i.grup_id);
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    },

    async mount({ res, container, items }) {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;
        this._refresh = () => this.mount({ res, container });
        try {
            const list = (items || await this.fetch(res)).filter(i => this.match(i));
            el.innerHTML = list.length
                ? this.render({ items: list, res }) + this.totalFooter(list.length, res)
                : `<div class="flex flex-col items-center justify-center py-10 text-neutral-500 bg-[#050505] border border-dashed border-[#1c1c1c] rounded">
                       <p class="text-xs font-bold uppercase tracking-wider text-neutral-400">${this.esc(this.schemaOf(res).emptyText)}</p>
                   </div>`;
        } catch (e) {
            el.innerHTML = `<p class="text-xs text-red-400 px-2.5 py-3">${this.esc(e.message || 'Gagal memuat data arsip')}</p>`;
        }
    },

    render({ items, res }) {
        return this.schemaOf(res).render(items);
    },

    totalFooter(n, res) {
        const unit = this.schemaOf(res).unit || 'Item';
        return `<div id="arsip-total-${res}" class="flex items-center justify-between py-1.5 px-2.5 mt-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs font-mono">
            <span>Total <strong class="text-neutral-100">${n}</strong> ${this.esc(unit)} arsip</span>
        </div>`;
    },

    // variant: table (24-32px ikon tabel), small (game), card (PC), menu (gaya kartu katalog).
    actions(res, item, label, variant = 'table') {
        const size = variant === 'small' || variant === 'card' ? 'w-6 h-6 xl:w-7 xl:h-7' : 'w-6 h-6 sm:w-7 sm:h-7 2xl:w-8 2xl:h-8';
        const iconSize = variant === 'small' || variant === 'card' ? 'w-3 h-3' : 'w-3 h-3 sm:w-3.5 sm:h-3.5 2xl:w-4 2xl:h-4';
        const shell = variant === 'menu'
            ? { base: 'p-1 rounded bg-black/85 border border-[#2a2a2a] transition-colors shadow flex items-center justify-center', icon: 'w-3 h-3' }
            : { base: `${size} rounded bg-[#171717] border border-[#262626] transition-colors flex items-center justify-center shrink-0 shadow-sm`, icon: iconSize };
        const arg = this.jsString(label);
        return `<div class="flex items-center justify-end gap-1 sm:gap-1.5">
            <button type="button" onclick="ArsipList.restore('${res}', ${item.id}, '${arg}')"
                class="${shell.base} text-amber-400 hover:bg-amber-500 hover:text-black" title="Pulihkan">
                <svg class="${shell.icon}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v1M3 10l4-4M3 10l4 4"></path></svg>
            </button>
            <button type="button" onclick="ArsipList.hapus('${res}', ${item.id}, '${arg}')"
                class="${shell.base} text-red-400 hover:bg-red-600 hover:text-white" title="Hapus permanen">
                <svg class="${shell.icon}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>`;
    },

    restore(res, id, label) {
        Modal.confirm(`Pulihkan ${label} dari arsip?`, async () => {
            try {
                await API.request(`/api/v1/kasir/${res}/${id}/restore`, { method: 'POST' });
                Toast.success('Data dipulihkan');
                this._changed();
            } catch (e) {
                Toast.error(e.message || 'Gagal memulihkan data');
            }
        });
    },

    hapus(res, id, label) {
        Modal.confirm(`Hapus permanen ${label}? Tindakan ini tidak bisa dibatalkan.`,
            async () => {
                try {
                    if (res === 'menu') {
                        await API.request(`/api/v1/kasir/menu/${id}/permanent`, { method: 'DELETE' });
                    } else {
                        await API.request(`/api/v1/kasir/${res}/${id}`, {
                            method: 'DELETE',
                            body: JSON.stringify({ confirm: label })
                        });
                    }
                    Toast.success('Data dihapus permanen');
                    this._changed();
                } catch (e) {
                    Toast.error(e.message || 'Gagal menghapus data');
                }
            },
            null,
            { requireCheck: `${label} akan dihapus permanen dan tidak bisa dikembalikan.` });
    },

    _callbacks: [],

    onChanged(cb) {
        this._callbacks = cb ? [cb] : [];
    },

    _changed() {
        if (this._refresh) this._refresh();
        this._callbacks.forEach(cb => { try { cb(); } catch (e) { /* callback opsional */ } });
    }
};

window.ArsipList = ArsipList;

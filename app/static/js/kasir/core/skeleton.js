// app/static/js/kasir/core/skeleton.js
/**
 * Skeleton UI Engine untuk TMBilling Kasir
 * Menyediakan placeholder pemuatan berbentuk konten (Content-Shaped Skeleton)
 * yang 100% selaras dengan layout data riil di seluruh breakpoint (lg, xl, 2xl)
 * dan tema gelap Noir / Dark Mode TMBilling.
 */

const Skeleton = {
    /**
     * Generator Skeleton Kartu PC untuk Dashboard Grid
     * @param {number} count Jumlah kartu skeleton yang ingin ditampilkan
     */
    pcCards(count = 12) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-pc-card bg-[#141414] border border-transparent rounded-xl p-2 lg:p-2 xl:p-2.5 2xl:p-3 min-h-[96px] lg:min-h-[102px] xl:min-h-[108px] 2xl:min-h-[120px] flex flex-col justify-between animate-pulse select-none">
                    <!-- Row 1: PC Code & Status Dot -->
                    <div class="flex items-center justify-between gap-2">
                        <div class="h-3.5 bg-[#262626] rounded w-12"></div>
                        <div class="w-2 h-2 rounded-full bg-[#262626]"></div>
                    </div>
                    <!-- Row 2: Active App / Status -->
                    <div class="h-2.5 bg-[#202020] rounded w-20 mt-1"></div>
                    <!-- Row 3: Timer -->
                    <div class="h-4 bg-[#262626] rounded w-16 my-1"></div>
                    <!-- Row 4: Member / User -->
                    <div class="h-2.5 bg-[#202020] rounded w-14"></div>
                </div>
            `;
        }
        return `
            <div class="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 auto-rows-fr p-1">
                ${html}
            </div>
        `;
    },

    /**
     * Generator Skeleton Menu/Kantin F&B Cards
     * Menghasilkan elemen kartu individual (child elements) tanpa pembungkus grid luar,
     * sehingga langsung mewarisi layout grid responsif #menu-catalog-grid (2 col di lg, 4 col di xl/2xl).
     * @param {number} count Jumlah kartu menu
     */
    menuCards(count = 8) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-3 flex flex-col justify-between animate-pulse min-h-[260px]">
                    <div class="w-full aspect-[4/3] rounded-lg border border-[#1f1f1f] bg-[#161616] mb-2.5 flex items-center justify-center">
                        <svg class="w-8 h-8 text-[#262626]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    </div>
                    <div class="space-y-1.5 flex-1">
                        <div class="h-3.5 bg-[#262626] rounded w-3/4"></div>
                        <div class="h-2.5 bg-[#1e1e1e] rounded w-1/2"></div>
                    </div>
                    <div class="pt-2 mt-2 border-t border-[#181818] flex items-center justify-between">
                        <div class="h-3.5 bg-[#262626] rounded w-16"></div>
                    </div>
                    <div class="mt-2 h-7 bg-[#202020] rounded w-full"></div>
                </div>
            `;
        }
        return html;
    },

    /**
     * Generator Skeleton Tabel Member Lengkap
     * Membangun tag <table> dan <thead> 6 kolom lengkap yang selaras dengan tampilan data Member.
     * @param {number} rows Jumlah baris
     */
    memberTable(rows = 6) {
        let rowsHtml = '';
        for (let i = 0; i < rows; i++) {
            rowsHtml += `
                <tr class="border-b border-[#1c1c1c] animate-pulse flex flex-col lg:table-row p-3 lg:p-0">
                    <td class="px-4 py-3 text-left">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded bg-[#1c1c1c] flex-shrink-0"></div>
                            <div class="space-y-1 flex-1">
                                <div class="h-3.5 bg-[#262626] rounded w-24"></div>
                                <div class="h-2.5 bg-[#1a1a1a] rounded w-32"></div>
                            </div>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-left">
                        <div class="h-5 bg-[#202020] rounded w-16"></div>
                    </td>
                    <td class="px-4 py-3 text-left">
                        <div class="h-3.5 bg-[#262626] rounded w-20"></div>
                    </td>
                    <td class="px-4 py-3 text-left">
                        <div class="h-3 bg-[#1e1e1e] rounded w-28"></div>
                    </td>
                    <td class="px-4 py-3 text-left">
                        <div class="h-5 bg-[#202020] rounded-full w-14"></div>
                    </td>
                    <td class="px-4 py-3 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                            <div class="h-7 w-7 bg-[#202020] rounded"></div>
                            <div class="h-7 w-7 bg-[#202020] rounded"></div>
                            <div class="h-7 w-7 bg-[#202020] rounded"></div>
                        </div>
                    </td>
                </tr>
            `;
        }

        return `
            <table class="w-full text-xs lg:max-xl:text-xs xl:text-base block lg:table">
                <thead class="hidden lg:table-header-group">
                    <tr class="border-b border-[#262626] text-neutral-400">
                        <th class="px-4 py-3 text-left font-medium w-1/4">Member</th>
                        <th class="px-4 py-3 text-left font-medium">Grup</th>
                        <th class="px-4 py-3 text-left font-medium">Sisa Waktu</th>
                        <th class="px-4 py-3 text-left font-medium">Berlaku Sampai</th>
                        <th class="px-4 py-3 text-left font-medium">Status</th>
                        <th class="px-4 py-3 text-right font-medium w-36">Aksi</th>
                    </tr>
                </thead>
                <tbody class="block lg:table-row-group divide-y divide-[#1c1c1c]">
                    ${rowsHtml}
                </tbody>
            </table>
        `;
    },

    /**
     * Generator Skeleton Kartu Pemulihan Mati Lampu (Blackout)
     * @param {number} count Jumlah kartu blackout (default 4)
     */
    blackoutCards(count = 4) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="bg-[#0c0c0c] border border-[#262626] rounded p-4 relative animate-pulse">
                    <div class="flex items-start gap-3">
                        <div class="w-10 h-10 rounded bg-[#171717] border border-[#262626] shrink-0"></div>
                        <div class="flex-1 min-w-0 space-y-2">
                            <div class="flex items-center gap-2 mb-1">
                                <div class="h-4 bg-[#202020] rounded w-14"></div>
                                <div class="h-4 bg-[#262626] rounded w-24"></div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="h-3 bg-[#262626] rounded w-12"></div>
                                <div class="h-3 bg-[#1e1e1e] rounded w-16"></div>
                                <div class="h-3 bg-[#1e1e1e] rounded w-20"></div>
                                <div class="h-3 bg-[#262626] rounded w-20"></div>
                            </div>
                        </div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-[#1c1c1c] flex justify-end gap-2">
                        <div class="h-7 bg-[#1c1c1c] rounded w-28"></div>
                        <div class="h-7 bg-[#1c1c1c] rounded w-16"></div>
                    </div>
                </div>
            `;
        }
        return `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${html}</div>`;
    },

    /**
     * Generator Skeleton Paket & Tarif (Grouped Table Layout)
     * @param {number} groups Jumlah grup paket (default 2: misal REGULER, VIP)
     * @param {number} rowsPerGroup Jumlah baris paket per grup
     */
    paketTable(groups = 2, rowsPerGroup = 3) {
        let html = '';
        for (let g = 0; g < groups; g++) {
            let rowsHtml = '';
            for (let r = 0; r < rowsPerGroup; r++) {
                rowsHtml += `
                    <tr class="border-b border-[#1c1c1c] animate-pulse flex flex-col lg:table-row p-3 lg:p-0">
                        <td class="px-4 py-3 text-left">
                            <div class="h-3.5 bg-[#262626] rounded w-36"></div>
                        </td>
                        <td class="px-4 py-3 text-left">
                            <div class="h-3 bg-[#202020] rounded w-20"></div>
                        </td>
                        <td class="px-4 py-3 text-left">
                            <div class="h-3.5 bg-[#262626] rounded w-24"></div>
                        </td>
                        <td class="px-4 py-3 text-left">
                            <div class="h-3 bg-[#1e1e1e] rounded w-16"></div>
                        </td>
                        <td class="px-4 py-3 text-right">
                            <div class="flex items-center justify-end gap-2">
                                <div class="h-7 w-7 bg-[#202020] rounded"></div>
                                <div class="h-7 w-7 bg-[#202020] rounded"></div>
                            </div>
                        </td>
                    </tr>
                `;
            }

            html += `
                <div class="space-y-3 ${g > 0 ? 'mt-8' : ''}">
                    <div class="flex items-center gap-3 mb-4 pb-3 border-b border-[#1c1c1c] animate-pulse">
                        <div class="h-4 bg-[#262626] rounded w-32"></div>
                        <div class="h-4 bg-[#1e1e1e] rounded w-16"></div>
                    </div>
                    <table class="w-full text-xs lg:max-xl:text-xs xl:text-base block lg:table">
                        <thead class="hidden lg:table-header-group">
                            <tr class="border-b border-[#262626] text-neutral-400">
                                <th class="px-4 py-3 text-left font-medium w-2/5">Nama</th>
                                <th class="px-4 py-3 text-left font-medium w-1/5">Durasi</th>
                                <th class="px-4 py-3 text-left font-medium w-1/5">Harga</th>
                                <th class="px-4 py-3 text-left font-medium w-1/6">Masa Aktif</th>
                                <th class="px-4 py-3 text-right font-medium w-24">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="block lg:table-row-group divide-y divide-[#1c1c1c]">
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }
        return html;
    },

    /**
     * Generator Skeleton Grid Manajemen Unit PC (Grouped PC Cards)
     * @param {number} groups Jumlah grup PC
     * @param {number} cardsPerGroup Jumlah kartu PC per grup
     */
    pcManagementGrid(groups = 2, cardsPerGroup = 6) {
        let html = '';
        for (let g = 0; g < groups; g++) {
            let cardsHtml = '';
            for (let c = 0; c < cardsPerGroup; c++) {
                cardsHtml += `
                    <div class="bg-[#0c0c0c] border border-[#262626] rounded p-3 relative flex flex-col justify-between min-h-[92px] animate-pulse">
                        <div class="flex items-center justify-between gap-2">
                            <div class="h-4 bg-[#262626] rounded w-16"></div>
                            <div class="w-2.5 h-2.5 rounded-full bg-[#262626]"></div>
                        </div>
                        <div class="h-3 bg-[#1e1e1e] rounded w-24 my-1"></div>
                        <div class="flex items-center justify-between pt-1 border-t border-[#181818]">
                            <div class="h-4 bg-[#202020] rounded w-16"></div>
                            <div class="h-4 w-4 bg-[#202020] rounded"></div>
                        </div>
                    </div>
                `;
            }

            html += `
                <div class="space-y-3 ${g > 0 ? 'mt-6' : ''}">
                    <div class="flex items-center gap-3 mb-4 pb-3 border-b border-[#1c1c1c] animate-pulse">
                        <div class="h-4 bg-[#262626] rounded w-28"></div>
                        <div class="h-4 bg-[#1e1e1e] rounded w-14"></div>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:max-xl:grid-cols-4 xl:grid-cols-6 gap-3">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        }
        return html;
    },

    /**
     * Generator Skeleton Daftar Turnamen
     * Menghasilkan elemen kartu individual (child elements) tanpa wrapper luar,
     * sehingga mewarisi responsivitas grid #tournaments-grid (2 col di lg, 3 col di xl/2xl).
     * @param {number} count Jumlah kartu turnamen
     */
    tournamentCards(count = 6) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-5 animate-pulse flex flex-col justify-between h-[180px]">
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <div class="h-4 bg-[#262626] rounded w-36"></div>
                            <div class="h-5 w-16 bg-[#202020] rounded-full"></div>
                        </div>
                        <div class="h-2.5 bg-[#181818] rounded w-full"></div>
                        <div class="h-2.5 bg-[#181818] rounded w-2/3"></div>
                    </div>
                    <div class="flex justify-between items-center pt-3 border-t border-[#1c1c1c]">
                        <div class="h-3 bg-[#202020] rounded w-20"></div>
                        <div class="h-7 w-28 bg-[#262626] rounded-lg"></div>
                    </div>
                </div>
            `;
        }
        return html;
    },

    /**
     * Generator Skeleton Bracket Turnamen
     */
    tournamentBracket() {
        return `
            <div class="p-6 space-y-6 animate-pulse">
                <div class="flex gap-4 border-b border-[#1c1c1c] pb-3">
                    <div class="h-8 w-24 bg-[#202020] rounded-lg"></div>
                    <div class="h-8 w-24 bg-[#1a1a1a] rounded-lg"></div>
                    <div class="h-8 w-24 bg-[#1a1a1a] rounded-lg"></div>
                </div>
                <div class="grid grid-cols-3 gap-6">
                    <div class="space-y-4">
                        <div class="h-4 bg-[#262626] rounded w-20 mb-2"></div>
                        <div class="h-16 bg-[#141414] border border-[#1c1c1c] rounded-lg"></div>
                        <div class="h-16 bg-[#141414] border border-[#1c1c1c] rounded-lg"></div>
                    </div>
                    <div class="space-y-4 flex flex-col justify-center">
                        <div class="h-4 bg-[#262626] rounded w-20 mb-2"></div>
                        <div class="h-16 bg-[#141414] border border-[#1c1c1c] rounded-lg"></div>
                    </div>
                    <div class="space-y-4 flex flex-col justify-center">
                        <div class="h-4 bg-[#262626] rounded w-20 mb-2"></div>
                        <div class="h-20 bg-[#161616] border border-amber-500/20 rounded-lg"></div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Generator Skeleton Laporan Billing (Summary Cards + Tabel Transaksi 8 Kolom)
     * @param {number} rows Jumlah baris transaksi
     */
    laporanBilling(rows = 6) {
        let summaryCards = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-pulse">
                <div class="bg-[#111] border border-[#222] p-4 rounded-xl space-y-2">
                    <div class="h-2.5 bg-[#202020] rounded w-24"></div>
                    <div class="h-5 bg-[#262626] rounded w-32"></div>
                </div>
                <div class="bg-[#111] border border-[#222] p-4 rounded-xl space-y-2">
                    <div class="h-2.5 bg-[#202020] rounded w-20"></div>
                    <div class="h-5 bg-[#262626] rounded w-16"></div>
                </div>
                <div class="bg-[#111] border border-[#222] p-4 rounded-xl space-y-2">
                    <div class="h-2.5 bg-[#202020] rounded w-20"></div>
                    <div class="h-5 bg-[#262626] rounded w-16"></div>
                </div>
                <div class="bg-[#111] border border-[#222] p-4 rounded-xl space-y-2">
                    <div class="h-2.5 bg-[#202020] rounded w-20"></div>
                    <div class="h-5 bg-[#262626] rounded w-16"></div>
                </div>
            </div>
        `;

        let rowsHtml = '';
        for (let i = 0; i < rows; i++) {
            rowsHtml += `
                <tr class="border-b border-[#1c1c1c] animate-pulse flex flex-col lg:table-row p-3 lg:p-0">
                    <td class="px-4 py-3 text-left"><div class="h-3 bg-[#1e1e1e] rounded w-24"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3.5 bg-[#262626] rounded w-28"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3 bg-[#202020] rounded w-20"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3.5 bg-[#262626] rounded w-24"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3 bg-[#202020] rounded w-12"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3 bg-[#1e1e1e] rounded w-16"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-4 bg-[#202020] rounded w-14"></div></td>
                    <td class="px-4 py-3 text-right"><div class="h-7 w-7 bg-[#202020] rounded ml-auto"></div></td>
                </tr>
            `;
        }

        return `
            ${summaryCards}
            <div class="space-y-3">
                <div class="h-4 bg-[#202020] rounded w-48 mb-3 animate-pulse"></div>
                <table class="w-full text-xs lg:max-xl:text-xs xl:text-base block lg:table">
                    <thead class="hidden lg:table-header-group">
                        <tr class="border-b border-[#262626] text-neutral-400">
                            <th class="px-4 py-3 text-left font-medium">Waktu</th>
                            <th class="px-4 py-3 text-left font-medium">Nota</th>
                            <th class="px-4 py-3 text-left font-medium">Pelanggan</th>
                            <th class="px-4 py-3 text-left font-medium">Jumlah</th>
                            <th class="px-4 py-3 text-left font-medium">PC</th>
                            <th class="px-4 py-3 text-left font-medium">Kasir</th>
                            <th class="px-4 py-3 text-left font-medium">Metode</th>
                            <th class="px-4 py-3 text-right font-medium">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="block lg:table-row-group divide-y divide-[#1c1c1c]">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Generator Skeleton Laporan Kantin / F&B (Summary Card + Tabel Responsif)
     * @param {number} rows Jumlah baris transaksi
     */
    laporanMenu(rows = 6) {
        let summaryCards = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 animate-pulse">
                <div class="bg-[#111] border border-[#222] p-4 rounded-xl space-y-2">
                    <div class="h-2.5 bg-[#202020] rounded w-36"></div>
                    <div class="h-5 bg-[#262626] rounded w-40"></div>
                </div>
            </div>
        `;

        let rowsHtml = '';
        for (let i = 0; i < rows; i++) {
            rowsHtml += `
                <tr class="border-b border-[#1c1c1c] animate-pulse flex flex-col lg:table-row p-3 lg:p-0">
                    <td class="px-4 py-3 text-left"><div class="h-3 bg-[#1e1e1e] rounded w-20"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3.5 bg-[#262626] rounded w-24"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3.5 bg-[#262626] rounded w-32"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3 bg-[#202020] rounded w-10"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3 bg-[#1e1e1e] rounded w-16"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3.5 bg-[#262626] rounded w-20"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3 bg-[#202020] rounded w-14"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3 bg-[#1e1e1e] rounded w-16"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-3 bg-[#1e1e1e] rounded w-16"></div></td>
                    <td class="px-4 py-3 text-left"><div class="h-4 bg-[#202020] rounded w-14"></div></td>
                    <td class="px-4 py-3 text-right"><div class="h-7 w-7 bg-[#202020] rounded ml-auto"></div></td>
                </tr>
            `;
        }

        return `
            ${summaryCards}
            <div class="space-y-3">
                <table class="w-full text-xs lg:max-xl:text-xs xl:text-base block lg:table">
                    <thead class="hidden lg:table-header-group">
                        <tr class="border-b border-[#262626] text-neutral-400">
                            <th class="px-4 py-3 text-left font-medium">Waktu</th>
                            <th class="px-4 py-3 text-left font-medium">Nota</th>
                            <th class="px-4 py-3 text-left font-medium">Item Menu</th>
                            <th class="px-4 py-3 text-left font-medium">Qty</th>
                            <th class="px-4 py-3 text-left font-medium">Harga</th>
                            <th class="px-4 py-3 text-left font-medium">Total</th>
                            <th class="px-4 py-3 text-left font-medium">Bayar</th>
                            <th class="px-4 py-3 text-left font-medium">Pelanggan</th>
                            <th class="px-4 py-3 text-left font-medium">Kasir</th>
                            <th class="px-4 py-3 text-left font-medium">Metode</th>
                            <th class="px-4 py-3 text-right font-medium">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="block lg:table-row-group divide-y divide-[#1c1c1c]">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Generator Skeleton Tabel Akun Kasir & Admin Lengkap
     * @param {number} rows Jumlah baris operator
     */
    userTable(rows = 5) {
        let rowsHtml = '';
        for (let i = 0; i < rows; i++) {
            rowsHtml += `
                <tr class="border-b border-[#1c1c1c] animate-pulse flex flex-col lg:table-row p-3 lg:p-0">
                    <td class="px-4 py-3 text-left">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-[#1c1c1c] flex-shrink-0"></div>
                            <div class="space-y-1 flex-1">
                                <div class="h-3.5 bg-[#262626] rounded w-24"></div>
                                <div class="h-2.5 bg-[#1a1a1a] rounded w-32"></div>
                            </div>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-left">
                        <div class="h-5 bg-[#202020] rounded w-16"></div>
                    </td>
                    <td class="px-4 py-3 text-left">
                        <div class="space-y-1">
                            <div class="h-3 bg-[#262626] rounded w-24"></div>
                            <div class="h-2 bg-[#1a1a1a] rounded w-16"></div>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-left">
                        <div class="flex items-center gap-2">
                            <div class="w-2 h-2 rounded-full bg-[#262626]"></div>
                            <div class="h-3 bg-[#202020] rounded w-12"></div>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <div class="h-7 w-7 bg-[#202020] rounded"></div>
                            <div class="h-7 w-7 bg-[#202020] rounded"></div>
                        </div>
                    </td>
                </tr>
            `;
        }

        return `
            <table class="w-full text-xs lg:max-xl:text-xs xl:text-base block lg:table">
                <thead class="hidden lg:table-header-group">
                    <tr class="border-b border-[#262626] text-neutral-400">
                        <th class="px-4 py-3 text-left font-medium w-1/4">Operator</th>
                        <th class="px-4 py-3 text-left font-medium">Role</th>
                        <th class="px-4 py-3 text-left font-medium">Benefit Bermain</th>
                        <th class="px-4 py-3 text-left font-medium">Status</th>
                        <th class="px-4 py-3 text-right font-medium w-28">Kelola</th>
                    </tr>
                </thead>
                <tbody class="block lg:table-row-group divide-y divide-[#1c1c1c]">
                    ${rowsHtml}
                </tbody>
            </table>
        `;
    },

    /**
     * Generator Skeleton Screenshot PC Cards
     * Menghasilkan elemen kartu individual (child elements) tanpa pembungkus grid luar,
     * sehingga langsung mewarisi layout grid responsif #screenshot-grid (3 col di lg, 4 col di xl/2xl).
     * @param {number} count Jumlah kartu screenshot
     */
    screenshotCards(count = 8) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="screenshot-card w-full h-full flex flex-col bg-[#121212] border border-[#1c1c1c] rounded overflow-hidden animate-pulse">
                    <div class="p-3 border-b border-[#1c1c1c] flex justify-between items-center bg-[#171717]">
                        <div class="h-4 bg-[#262626] rounded w-16"></div>
                        <div class="h-6 w-6 bg-[#202020] rounded"></div>
                    </div>
                    <div class="relative w-full aspect-video bg-black flex flex-col items-center justify-center p-4">
                        <div class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center">
                            <svg class="w-5 h-5 text-[#2a2a2a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                    </div>
                    <div class="p-3 text-sm flex justify-between items-center bg-[#0c0c0c] border-t border-[#1c1c1c] mt-auto">
                        <div class="h-3 bg-[#202020] rounded w-14"></div>
                        <div class="h-3 bg-[#262626] rounded w-24"></div>
                    </div>
                </div>
            `;
        }
        return html;
    },

    /**
     * Generator Skeleton List Catatan
     * @param {number} count Jumlah catatan
     */
    notesList(count = 5) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="p-3 bg-[#111] border border-[#1c1c1c] rounded-lg animate-pulse space-y-2">
                    <div class="flex justify-between items-center">
                        <div class="h-3.5 bg-[#262626] rounded w-32"></div>
                        <div class="h-2.5 bg-[#1e1e1e] rounded w-12"></div>
                    </div>
                    <div class="h-2.5 bg-[#1a1a1a] rounded w-3/4"></div>
                </div>
            `;
        }
        return `<div class="space-y-2 p-2">${html}</div>`;
    },

    /**
     * Generator Skeleton Riwayat Struk
     * @param {number} count Jumlah item struk
     */
    strukList(count = 6) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="p-3 bg-[#111] border border-[#1c1c1c] rounded-lg animate-pulse space-y-2">
                    <div class="flex justify-between items-center">
                        <div class="h-3.5 bg-[#262626] rounded w-24"></div>
                        <div class="h-3 bg-[#202020] rounded w-16"></div>
                    </div>
                    <div class="flex justify-between items-center pt-1 border-t border-[#1a1a1a]">
                        <div class="h-2.5 bg-[#1e1e1e] rounded w-20"></div>
                        <div class="h-2.5 bg-[#1e1e1e] rounded w-14"></div>
                    </div>
                </div>
            `;
        }
        return `<div class="space-y-2">${html}</div>`;
    },

    /**
     * Generator Skeleton Preview Struk Thermal
     */
    strukThermal() {
        return `
            <div class="max-w-[320px] mx-auto bg-[#0a0a0a] border border-[#222] p-5 rounded-lg animate-pulse space-y-3">
                <div class="flex flex-col items-center space-y-2 pb-3 border-b border-dashed border-[#222]">
                    <div class="h-4 bg-[#262626] rounded w-28"></div>
                    <div class="h-2.5 bg-[#1e1e1e] rounded w-36"></div>
                </div>
                <div class="space-y-2 py-2 border-b border-dashed border-[#222]">
                    <div class="flex justify-between"><div class="h-2.5 bg-[#202020] rounded w-16"></div><div class="h-2.5 bg-[#202020] rounded w-20"></div></div>
                    <div class="flex justify-between"><div class="h-2.5 bg-[#202020] rounded w-20"></div><div class="h-2.5 bg-[#202020] rounded w-16"></div></div>
                </div>
                <div class="flex justify-between items-center pt-2">
                    <div class="h-3.5 bg-[#262626] rounded w-16"></div>
                    <div class="h-4 bg-[#262626] rounded w-24"></div>
                </div>
            </div>
        `;
    },

    /**
     * Generator Skeleton Tabel Standar (Row x Col)
     * Cocok untuk baris tabel internal yang sudah berada di dalam <tbody>.
     * @param {number} rows Jumlah baris
     * @param {number} cols Jumlah kolom
     */
    tableRows(rows = 6, cols = 5) {
        let html = '';
        for (let r = 0; r < rows; r++) {
            html += `<tr class="border-b border-[#1c1c1c] animate-pulse">`;
            for (let c = 0; c < cols; c++) {
                const widthClass = (c === 0) ? 'w-20' : (c === cols - 1 ? 'w-16' : 'w-28');
                html += `
                    <td class="px-4 py-3.5 text-left">
                        <div class="h-3 bg-[#202020] rounded ${widthClass}"></div>
                    </td>
                `;
            }
            html += `</tr>`;
        }
        return html;
    },

    /**
     * Generator Skeleton Log Audit Aktivitas
     * @param {number} count Jumlah baris log
     */
    logRows(count = 8) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="border-b border-[#1c1c1c] py-3.5 px-4 animate-pulse space-y-2 ${i % 2 === 0 ? 'bg-[#0a0a0a]' : ''}">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="h-3 bg-[#262626] rounded w-8"></div>
                            <div class="h-3 bg-[#202020] rounded w-24"></div>
                            <div class="h-3 bg-[#1e1e1e] rounded w-16"></div>
                        </div>
                        <div class="h-3 bg-[#202020] rounded w-20"></div>
                    </div>
                    <div class="h-3.5 bg-[#262626] rounded w-1/2"></div>
                </div>
            `;
        }
        return `<div class="divide-y divide-[#1c1c1c]">${html}</div>`;
    },

    /**
     * Generator Skeleton Sensor Hardware & Server Monitor
     * @param {number} count Jumlah baris monitor
     */
    monitorRows(count = 8) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="p-3 bg-[#111] border border-[#1c1c1c] rounded-lg animate-pulse flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <div class="h-4 bg-[#262626] rounded w-14"></div>
                        <div class="h-3 bg-[#202020] rounded w-28"></div>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="h-3 bg-[#202020] rounded w-16"></div>
                        <div class="h-3 bg-[#262626] rounded w-16"></div>
                    </div>
                </div>
            `;
        }
        return `<div class="space-y-2.5">${html}</div>`;
    },

    /**
     * Generator Skeleton 7 Cards Owner Analytics KPI
     * @param {number} count Jumlah card KPI (default 7)
     */
    analyticsCards(count = 7) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-5 animate-pulse space-y-3">
                    <div class="h-3 bg-[#202020] rounded w-28"></div>
                    <div class="h-6 bg-[#262626] rounded w-36"></div>
                    <div class="h-2.5 bg-[#1a1a1a] rounded w-20"></div>
                    <div class="space-y-1.5 pt-3 border-t border-[#1c1c1c]">
                        <div class="h-2.5 bg-[#202020] rounded w-full"></div>
                        <div class="h-2.5 bg-[#202020] rounded w-4/5"></div>
                    </div>
                </div>
            `;
        }
        return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:max-xl:grid-cols-2 xl:grid-cols-3 gap-4">${html}</div>`;
    },

    /**
     * Generator Skeleton Sesi Info pada Modal Tambah Waktu
     */
    modalTambahInfo() {
        return `
            <div class="animate-pulse space-y-2">
                <div class="h-3.5 bg-[#262626] rounded w-48 mx-auto"></div>
                <div class="h-2.5 bg-[#202020] rounded w-32 mx-auto"></div>
            </div>
        `;
    },

    /**
     * Generator Skeleton Pilihan Paket pada Modal Buka Sesi & Tambah Waktu
     * @param {number} count Jumlah kartu paket
     */
    modalTambahPaket(count = 4) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="p-3 bg-[#111] border border-[#222] rounded-lg animate-pulse flex items-center justify-between">
                    <div class="space-y-1.5">
                        <div class="h-3 bg-[#262626] rounded w-24"></div>
                        <div class="h-2.5 bg-[#202020] rounded w-16"></div>
                    </div>
                    <div class="h-3.5 bg-[#262626] rounded w-16"></div>
                </div>
            `;
        }
        return `<div class="grid grid-cols-2 gap-2">${html}</div>`;
    },

    /**
     * Generator Skeleton Tampilan Spesifikasi & Telemetri Hardware pada Modal Detail PC
     */
    hardwareDetailView() {
        return `
            <div class="space-y-4 md:space-y-5 animate-pulse select-none">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
                    <div class="p-4 sm:p-5 bg-[#0c0c0c] border border-[#202020] rounded-xl space-y-3">
                        <div class="flex items-center justify-between border-b border-[#1c1c1c] pb-2.5">
                            <div class="h-4 bg-[#262626] rounded w-40"></div>
                            <div class="h-3 bg-[#1e1e1e] rounded w-20"></div>
                        </div>
                        <div class="grid grid-cols-3 gap-2.5">
                            <div class="p-2.5 bg-[#070707] border border-[#181818] rounded-lg h-20"></div>
                            <div class="p-2.5 bg-[#070707] border border-[#181818] rounded-lg h-20"></div>
                            <div class="p-2.5 bg-[#070707] border border-[#181818] rounded-lg h-20"></div>
                        </div>
                        <div class="p-2.5 bg-[#070707] border border-[#181818] rounded-lg h-16"></div>
                    </div>
                    <div class="p-4 sm:p-5 bg-[#0c0c0c] border border-[#202020] rounded-xl space-y-3">
                        <div class="flex items-center justify-between border-b border-[#1c1c1c] pb-2.5">
                            <div class="h-4 bg-[#262626] rounded w-36"></div>
                            <div class="h-3 bg-[#1e1e1e] rounded w-16"></div>
                        </div>
                        <div class="space-y-2">
                            <div class="h-8 bg-[#070707] border border-[#181818] rounded-lg"></div>
                            <div class="h-8 bg-[#070707] border border-[#181818] rounded-lg"></div>
                            <div class="h-8 bg-[#070707] border border-[#181818] rounded-lg"></div>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
                    <div class="p-4 sm:p-5 bg-[#0c0c0c] border border-[#202020] rounded-xl space-y-3 h-48"></div>
                    <div class="p-4 sm:p-5 bg-[#0c0c0c] border border-[#202020] rounded-xl space-y-3 h-48"></div>
                </div>
            </div>
        `;
    }
};

window.Skeleton = Skeleton;

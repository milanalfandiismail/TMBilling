// app/static/js/kasir/core/skeleton.js
/**
 * Skeleton UI Engine untuk TMBilling Kasir
 * Menyediakan placeholder pemuatan berbentuk konten (Content-Shaped Skeleton)
 * yang selaras dengan tema gelap Noir / Dark Mode TMBilling.
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
     * @param {number} count Jumlah kartu menu
     */
    menuCards(count = 8) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="bg-[#121212] border border-[#1c1c1c] rounded-xl overflow-hidden animate-pulse flex flex-col justify-between h-48">
                    <div class="h-24 bg-[#1a1a1a] w-full"></div>
                    <div class="p-3 space-y-2 flex-1 flex flex-col justify-between">
                        <div class="space-y-1.5">
                            <div class="h-3 bg-[#262626] rounded w-3/4"></div>
                            <div class="h-2.5 bg-[#202020] rounded w-1/2"></div>
                        </div>
                        <div class="flex items-center justify-between pt-2 border-t border-[#1a1a1a]">
                            <div class="h-3 bg-[#262626] rounded w-16"></div>
                            <div class="h-6 w-12 bg-[#202020] rounded"></div>
                        </div>
                    </div>
                </div>
            `;
        }
        return `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${html}</div>`;
    },

    /**
     * Generator Skeleton Paket & Tarif
     * @param {number} count Jumlah kartu paket
     */
    paketCards(count = 6) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="bg-[#121212] border border-[#1c1c1c] rounded-xl p-4 animate-pulse space-y-3">
                    <div class="flex items-center justify-between">
                        <div class="h-4 bg-[#262626] rounded w-28"></div>
                        <div class="h-3.5 bg-[#202020] rounded w-12"></div>
                    </div>
                    <div class="h-6 bg-[#262626] rounded w-24"></div>
                    <div class="space-y-1.5 pt-2 border-t border-[#1c1c1c]">
                        <div class="h-2.5 bg-[#202020] rounded w-full"></div>
                        <div class="h-2.5 bg-[#202020] rounded w-4/5"></div>
                    </div>
                </div>
            `;
        }
        return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${html}</div>`;
    },

    /**
     * Generator Skeleton Daftar Turnamen
     * @param {number} count Jumlah kartu turnamen
     */
    tournamentCards(count = 6) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="bg-[#121212] border border-[#1c1c1c] rounded-xl p-4 animate-pulse space-y-3 flex flex-col justify-between min-h-[140px]">
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <div class="h-4 bg-[#262626] rounded w-36"></div>
                            <div class="h-3 bg-[#202020] rounded w-16"></div>
                        </div>
                        <div class="h-2.5 bg-[#1a1a1a] rounded w-full"></div>
                        <div class="h-2.5 bg-[#1a1a1a] rounded w-2/3"></div>
                    </div>
                    <div class="flex justify-between items-center pt-3 border-t border-[#1c1c1c]">
                        <div class="h-3 bg-[#202020] rounded w-20"></div>
                        <div class="h-7 w-24 bg-[#262626] rounded-lg"></div>
                    </div>
                </div>
            `;
        }
        return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${html}</div>`;
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
     * Generator Skeleton Screenshot PC Cards
     * @param {number} count Jumlah kartu screenshot
     */
    screenshotCards(count = 8) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="bg-[#121212] border border-[#1c1c1c] rounded-xl overflow-hidden animate-pulse flex flex-col min-h-[180px]">
                    <div class="p-3 border-b border-[#1c1c1c] flex justify-between items-center bg-[#171717]">
                        <div class="h-3.5 bg-[#262626] rounded w-16"></div>
                        <div class="h-4 w-4 bg-[#202020] rounded"></div>
                    </div>
                    <div class="flex-1 bg-[#0a0a0a] flex items-center justify-center p-4">
                        <div class="w-10 h-10 rounded-full bg-[#1a1a1a]"></div>
                    </div>
                    <div class="p-2.5 bg-[#141414] border-t border-[#1c1c1c] flex justify-between items-center">
                        <div class="h-2.5 bg-[#202020] rounded w-24"></div>
                        <div class="h-2.5 bg-[#202020] rounded w-12"></div>
                    </div>
                </div>
            `;
        }
        return `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">${html}</div>`;
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
     * Cocok untuk Member, Paket, Grup, PC, User, Shift History, User Logs, Uptime, Blackout, Laporan, Maintenance, dll.
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

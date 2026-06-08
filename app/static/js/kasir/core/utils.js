const Utils = {
    formatRupiah(angka) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0);
    },
    formatMenit(menit) {
        if (menit === undefined || menit === null) return '0m';
        if (menit < 60) return `${menit}m`;
        const jam = Math.floor(menit / 60);
        const sisa = menit % 60;
        return sisa > 0 ? `${jam}j ${sisa}m` : `${jam}j`;
    },
    formatDurasiFriendly(menit) {
        if (!menit) return '0 Menit';
        const jam = Math.floor(menit / 60);
        const sisa = menit % 60;
        if (jam === 0) {
            return `${sisa} Menit`;
        }
        if (sisa === 0) {
            return `${jam} Jam`;
        }
        return `${jam} Jam ${sisa} Menit`;
    },
    formatTanggal(tglStr) {
        if (!tglStr) return '-';
        const tgl = new Date(tglStr);
        return tgl.toLocaleDateString('id-ID');
    },
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
    }
};
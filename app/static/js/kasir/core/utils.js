const Utils = {
    formatRupiah(angka) {
        if (angka === undefined || angka === null) angka = 0;
        const formatted = Math.round(angka).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return `Rp${formatted}`;
    },
    formatRawRupiah(angka) {
        if (angka === undefined || angka === null) angka = 0;
        return Math.round(angka).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    },
    formatInputRupiah(input) {
        let raw = input.value.replace(/\./g, '').replace(/[^\d]/g, '');
        if (raw === '') {
            input.value = '';
            return;
        }
        const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        const cursorPos = input.selectionStart;
        const oldLen = input.value.length;
        input.value = formatted;
        const diff = input.value.length - oldLen;
        input.setSelectionRange(cursorPos + diff, cursorPos + diff);
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
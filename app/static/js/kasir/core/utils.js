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
    },
    debounce(func, wait = 500) {
        let timeout;
        return function (...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    parseRupiah(str) {
        if (typeof str === 'number') return Math.round(str);
        if (!str) return 0;
        const cleaned = str.toString().replace(/[^0-9-]/g, '');
        return parseInt(cleaned, 10) || 0;
    },
    clamp(val, min, max) {
        const num = Number(val) || 0;
        return Math.min(Math.max(num, min), max);
    },
    isValidUsername(str, minLen = 3, maxLen = 30) {
        if (!str || typeof str !== 'string') return false;
        const cleaned = str.trim();
        if (cleaned.length < minLen || cleaned.length > maxLen) return false;
        return /^[a-zA-Z0-9_.-]+$/.test(cleaned);
    },
    isValidPassword(str, minLen = 4, maxLen = 32) {
        if (!str || typeof str !== 'string') return false;
        if (str.trim().length === 0) return false;
        return str.length >= minLen && str.length <= maxLen;
    },
    isValidEmail(str) {
        if (!str || typeof str !== 'string') return false;
        const cleaned = str.trim();
        if (cleaned.length > 120) return false;
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned);
    },
    isValidPhone(str) {
        if (!str || typeof str !== 'string') return false;
        const cleaned = str.trim();
        const digits = cleaned.replace(/\D/g, '');
        return digits.length >= 8 && digits.length <= 16 && /^[0-9+\- ]+$/.test(cleaned);
    },
    isValidHexColor(str) {
        if (!str || typeof str !== 'string') return false;
        return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(str.trim());
    },
    isValidIP(str) {
        if (!str || typeof str !== 'string') return false;
        const parts = str.trim().split('.');
        if (parts.length !== 4) return false;
        return parts.every(part => {
            if (!/^\d+$/.test(part)) return false;
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255 && (part === '0' || !part.startsWith('0'));
        });
    },
    isValidMAC(str) {
        if (!str || typeof str !== 'string') return false;
        const cleaned = str.trim().replace(/[:-]/g, '');
        return /^[0-9A-Fa-f]{12}$/.test(cleaned);
    }
};
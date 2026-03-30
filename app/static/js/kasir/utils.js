// app/static/js/kasir/utils.js

const Utils = {
    formatDuration(menit) {
        if (menit <= 0) return 'Habis';

        const jam = Math.floor(menit / 60);
        const sisaMenit = menit % 60;

        if (jam === 0) {
            return `${sisaMenit} Menit`;
        } else if (sisaMenit === 0) {
            return `${jam} Jam`;
        } else {
            return `${jam} Jam ${sisaMenit}M`;
        }
    },

    formatShort(menit) {
        if (menit <= 0) return '0m';

        const jam = Math.floor(menit / 60);
        const sisaMenit = menit % 60;

        if (jam === 0) return `${sisaMenit}m`;
        if (sisaMenit === 0) return `${jam}j`;
        return `${jam}j ${sisaMenit}m`;
    },

    formatRupiah(num) {
        return 'Rp' + num.toLocaleString('id-ID');
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    },

    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            return d.toLocaleString('id-ID', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};
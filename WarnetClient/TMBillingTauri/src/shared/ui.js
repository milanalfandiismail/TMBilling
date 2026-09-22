/**
 * Modul untuk Manipulasi DOM & UI Feedback
 */
import { formatTime } from './utils.js';

export const UI = {
    // Navigasi Antar Layar
    showScreen(screenId) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('billing-overlay').classList.add('hidden');
        document.getElementById(screenId).classList.remove('hidden');
    },

    // Update Data di Layar
    setNetworkInfo(ip, mac) {
        document.getElementById('ip-display').innerText = ip;
        document.getElementById('mac-display').innerText = mac;
    },

    setOverlayData(data) {
        const memberEl = document.getElementById('overlay-member-name');
        const groupEl = document.getElementById('overlay-group');
        if (memberEl) memberEl.innerText = `: ${data.member_name || '-'}`;
        if (groupEl) groupEl.innerText = `: ${data.group || '-'}`;
        if (data.remaining_seconds !== undefined) {
            this.updateTime(data.remaining_seconds);
        }
    },

    // Update Sisa Waktu (dari Detik)
    updateTime(seconds) {
        const timeStr = formatTime(seconds);
        document.getElementById('overlay-time').innerText = timeStr;
    },

    // Reset Seluruh Komponen Overlay ke State Awal yang Bersih (Pristine Initial State)
    resetOverlayUI() {
        // 1. Tutup semua modal overlay
        const logoutModal = document.getElementById('logout-confirm-modal');
        if (logoutModal) logoutModal.classList.add('hidden');

        const menuModal = document.getElementById('modal-menu-paket');
        if (menuModal) menuModal.classList.add('hidden');

        const adminModal = document.getElementById('admin-modal');
        if (adminModal) adminModal.classList.add('hidden');

        const powerModal = document.getElementById('power-confirm-modal');
        if (powerModal) powerModal.classList.add('hidden');

        // 2. Reset tab Menu & Paket ke tab awal 'paket'
        const tabPaketBtn = document.getElementById('tab-btn-paket');
        const tabMenuBtn = document.getElementById('tab-btn-menu');
        const contentPaket = document.getElementById('tab-content-paket');
        const contentMenu = document.getElementById('tab-content-menu');

        if (tabPaketBtn && tabMenuBtn && contentPaket && contentMenu) {
            tabPaketBtn.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all bg-accent text-white shadow-md shadow-accent/20 cursor-pointer";
            tabMenuBtn.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5 cursor-pointer";
            contentPaket.classList.remove('hidden');
            contentMenu.classList.add('hidden');
        }

        // 3. Reset display data
        const timeEl = document.getElementById('overlay-time');
        if (timeEl) timeEl.innerText = "00:00:00";

        const memberEl = document.getElementById('overlay-member-name');
        if (memberEl) memberEl.innerText = ": -";

        const groupEl = document.getElementById('overlay-group');
        if (groupEl) groupEl.innerText = ": -";

        // 4. Bersihkan input form login
        const usernameInput = document.getElementById('username');
        if (usernameInput) usernameInput.value = "";

        const passwordInput = document.getElementById('password');
        if (passwordInput) passwordInput.value = "";
    },

    // Feedback Login
    setLoginLoading(isLoading) {
        const btn = document.getElementById('login-btn');
        btn.innerText = isLoading ? "Menyambung..." : "Mulai Sesi";
        btn.disabled = isLoading;
        btn.style.opacity = isLoading ? "0.5" : "1";
    },

    // Modal Admin
    toggleAdminModal(show) {
        const modal = document.getElementById('admin-modal');
        if (show) {
            modal.classList.remove('hidden');
            document.getElementById('admin-user').focus();
        } else {
            modal.classList.add('hidden');
            document.getElementById('admin-error').classList.add('hidden');
        }
    },

    showAdminError(msg) {
        const errEl = document.getElementById('admin-error');
        const modalBox = document.querySelector('#admin-modal > div');

        errEl.innerText = msg;
        errEl.classList.remove('hidden');

        // Animasi Shake
        modalBox.classList.add('shake');
        setTimeout(() => modalBox.classList.remove('shake'), 400);
    },

    // Premium Toast System
    showToast(message, type = 'error') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');

        const bgColor = type === 'error' ? 'bg-red-950/10' : 'bg-emerald-950/10';
        const borderColor = type === 'error' ? 'border-red-500/20' : 'border-emerald-500/20';
        const textColor = type === 'error' ? 'text-red-400' : 'text-emerald-400';

        toast.className = `toast ${bgColor} ${borderColor} ${textColor} border backdrop-blur-xl px-6 py-4 rounded-xl flex items-center gap-3 shadow-2xl`;

        toast.innerHTML = `
            <div class="w-2 h-2 rounded-full ${type === 'error' ? 'bg-red-500' : 'bg-emerald-400'} animate-pulse"></div>
            <span class="text-[11px] font-bold tracking-wide">${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 200);
        }, 4000);
    },

    // Shake untuk login utama
    shakeLogin() {
        const loginCard = document.querySelector('#login-screen > div');
        loginCard.classList.add('shake');
        setTimeout(() => loginCard.classList.remove('shake'), 400);
    },

    updateShutdownTimer(seconds) {
        const statusEl = document.getElementById('shutdown-status');
        const countEl = document.getElementById('shutdown-countdown');
        if (!statusEl || !countEl) return;

        if (seconds > 0) {
            statusEl.innerText = "Shutdown";
            statusEl.classList.add('animate-pulse');

            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            countEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            statusEl.innerText = "Off";
            statusEl.classList.remove('animate-pulse');
            countEl.innerText = "--:--";
        }
    },

    toggleLogoutModal(show) {
        const modal = document.getElementById('logout-confirm-modal');
        if (!modal) return;

        if (show) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    },

    // Modal Konfirmasi Daya (Shutdown / Restart)
    powerActionPending: null,

    showPowerModal(type) {
        const modal = document.getElementById('power-confirm-modal');
        if (!modal) return;

        this.powerActionPending = type;
        const iconContainer = document.getElementById('power-modal-icon-container');
        const iconSvg = document.getElementById('power-modal-icon');
        const titleEl = document.getElementById('power-modal-title');
        const descEl = document.getElementById('power-modal-desc');
        const confirmBtn = document.getElementById('power-modal-confirm-btn');

        if (type === 'shutdown') {
            if (iconContainer) {
                iconContainer.className = 'w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-red-500/10 border border-red-500/20 text-red-400';
            }
            if (iconSvg) {
                iconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />';
            }
            if (titleEl) titleEl.innerText = 'Matikan Komputer?';
            if (descEl) descEl.innerText = 'Komputer client akan dimatikan secara penuh. Pastikan tidak ada data yang belum disimpan.';
            if (confirmBtn) {
                confirmBtn.className = 'flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50';
                confirmBtn.innerText = 'Matikan PC';
            }
        } else if (type === 'restart') {
            if (iconContainer) {
                iconContainer.className = 'w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-blue-500/10 border border-blue-500/20 text-blue-400';
            }
            if (iconSvg) {
                iconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />';
            }
            if (titleEl) titleEl.innerText = 'Restart Komputer?';
            if (descEl) descEl.innerText = 'Komputer client akan dimuat ulang (reboot) sekarang.';
            if (confirmBtn) {
                confirmBtn.className = 'flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-950/50';
                confirmBtn.innerText = 'Restart PC';
            }
        }

        modal.classList.remove('hidden');
        if (confirmBtn) confirmBtn.focus();
    },

    togglePowerModal(show) {
        const modal = document.getElementById('power-confirm-modal');
        if (!modal) return;
        if (show) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
            this.powerActionPending = null;
        }
    }
};

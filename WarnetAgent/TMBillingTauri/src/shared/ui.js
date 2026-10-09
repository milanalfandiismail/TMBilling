/**
 * Modul untuk Manipulasi DOM & UI Feedback
 */
import { AppState } from './state.js';
import { formatTime } from './utils.js';

export const UI = {
    // Navigasi Antar Layar
    showScreen(screenId) {
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('billing-overlay')?.classList.add('hidden');
        document.getElementById('afk-screen')?.classList.add('hidden');
        document.getElementById(screenId)?.classList.remove('hidden');
    },

    // Update Data di Layar
    setNetworkInfo(ip, mac) {
        const ipEl = document.getElementById('ip-display');
        const macEl = document.getElementById('mac-display');
        if (ipEl) ipEl.innerText = ip;
        if (macEl) macEl.innerText = mac;
    },

    setOverlayData(data) {
        const memberEl = document.getElementById('overlay-member-name');
        const groupEl = document.getElementById('overlay-group');
        const afkUserEl = document.getElementById('afk-user-name');
        const name = data.member_name || '-';
        if (memberEl) memberEl.innerText = `: ${name}`;
        if (groupEl) groupEl.innerText = `: ${data.group || '-'}`;
        if (afkUserEl) afkUserEl.innerText = name;
        if (data.remaining_seconds !== undefined) {
            this.updateTime(data.remaining_seconds);
        }
    },

    // Update Sisa Waktu (dari Detik)
    updateTime(seconds) {
        const isStatusAdmin = AppState.currentStatus === 'admin' || 
                              AppState.currentStatus === 'system' || 
                              AppState.sessionType === 'admin';
        const timeStr = formatTime(seconds, isStatusAdmin);
        const overlayTime = document.getElementById('overlay-time');
        if (overlayTime) overlayTime.innerText = timeStr;
        const afkTime = document.getElementById('afk-time-display');
        if (afkTime) afkTime.innerText = timeStr;
    },

    // Reset Seluruh Komponen Overlay ke State Awal yang Bersih (Pristine Initial State)
    resetOverlayUI() {
        // 1. Tutup semua modal overlay
        const logoutModal = document.getElementById('logout-confirm-modal');
        if (logoutModal) logoutModal.classList.add('hidden');

        const menuModal = document.getElementById('modal-menu-paket');
        if (menuModal) menuModal.classList.add('hidden');

        const qrisModal = document.getElementById('modal-qris-fullscreen');
        if (qrisModal) qrisModal.classList.add('hidden');

        const adminModal = document.getElementById('admin-modal');
        if (adminModal) adminModal.classList.add('hidden');

        const powerModal = document.getElementById('power-confirm-modal');
        if (powerModal) powerModal.classList.add('hidden');

        const afkPinModal = document.getElementById('modal-afk-pin');
        if (afkPinModal) afkPinModal.classList.add('hidden');

        // Pastikan floating card utama overlay tidak tertinggal dalam kondisi hidden
        const mainCard = document.getElementById('overlay-main-card');
        if (mainCard) mainCard.classList.remove('hidden');

        // 2. Reset tab Menu & Paket ke tab awal 'paket'
        const tabPaketBtn = document.getElementById('tab-btn-paket');
        const tabMenuBtn = document.getElementById('tab-btn-menu');
        const contentPaket = document.getElementById('tab-content-paket');
        const contentMenu = document.getElementById('tab-content-menu');

        if (tabPaketBtn && tabMenuBtn && contentPaket && contentMenu) {
            tabPaketBtn.className = "flex-1 py-2 px-4 rounded-lg text-xs font-semibold transition-all bg-white/10 text-white shadow-sm cursor-pointer";
            tabMenuBtn.className = "flex-1 py-2 px-4 rounded-lg text-xs font-medium transition-all text-[#86868b] hover:text-white cursor-pointer";
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

        // 4. Bersihkan input form login, AFK, dan Admin Login (mencegah kebocoran kredensial)
        const usernameInput = document.getElementById('username');
        if (usernameInput) usernameInput.value = "";

        const passwordInput = document.getElementById('password');
        if (passwordInput) passwordInput.value = "";

        const afkPinInput = document.getElementById('afk-pin-input');
        if (afkPinInput) afkPinInput.value = "";

        const afkUnlockInput = document.getElementById('afk-unlock-input');
        if (afkUnlockInput) afkUnlockInput.value = "";

        const afkErrorMsg = document.getElementById('afk-error-msg');
        if (afkErrorMsg) afkErrorMsg.classList.add('hidden');

        const adminUserInput = document.getElementById('admin-user');
        if (adminUserInput) adminUserInput.value = "";

        const adminPassInput = document.getElementById('admin-pass');
        if (adminPassInput) adminPassInput.value = "";

        const adminErrorMsg = document.getElementById('admin-error');
        if (adminErrorMsg) adminErrorMsg.classList.add('hidden');
    },

    // Feedback Login
    setLoginLoading(isLoading) {
        const btn = document.getElementById('login-btn');
        if (btn) {
            btn.innerText = isLoading ? "Menyambung..." : "Mulai Sesi";
            btn.disabled = isLoading;
            btn.style.opacity = isLoading ? "0.5" : "1";
        }
    },

    // Modal Admin
    toggleAdminModal(show) {
        const modal = document.getElementById('admin-modal');
        if (!modal) return;
        const userInput = document.getElementById('admin-user');
        const passInput = document.getElementById('admin-pass');
        const errEl = document.getElementById('admin-error');

        // Selalu bersihkan nilai input dan pesan error
        if (userInput) userInput.value = "";
        if (passInput) passInput.value = "";
        if (errEl) errEl.classList.add('hidden');

        if (show) {
            modal.classList.remove('hidden');
            userInput?.focus();
        } else {
            modal.classList.add('hidden');
        }
    },

    showAdminError(msg) {
        const errEl = document.getElementById('admin-error');
        if (errEl) {
            errEl.innerText = msg;
            errEl.classList.remove('hidden');
        }
    },

    // Modal Set PIN AFK (Guest)
    toggleAfkPinModal(show) {
        const modal = document.getElementById('modal-afk-pin');
        if (!modal) return;
        const input = document.getElementById('afk-pin-input');
        const errEl = document.getElementById('afk-pin-error');
        if (errEl) errEl.classList.add('hidden');

        if (show) {
            if (input) input.value = '';
            modal.classList.remove('hidden');
            input?.focus();
        } else {
            modal.classList.add('hidden');
        }
    },

    showAfkPinError(msg) {
        const errEl = document.getElementById('afk-pin-error');
        if (errEl) {
            errEl.innerText = msg;
            errEl.classList.remove('hidden');
        }
    },

    // AFK Screen Unlock Feedback
    showAfkUnlockError(msg) {
        const errEl = document.getElementById('afk-error-msg');
        if (errEl) {
            errEl.innerText = msg;
            errEl.classList.remove('hidden');
        }
    },

    setAfkUnlockLoading(isLoading) {
        const btn = document.getElementById('afk-unlock-btn');
        if (btn) {
            btn.innerText = isLoading ? "Membuka Kunci..." : "Buka Kunci (Unlock)";
            btn.disabled = isLoading;
            btn.style.opacity = isLoading ? "0.6" : "1";
        }
    },

    // Toast Notification System
    showToast(message, type = 'error') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');

        const bgColor = 'bg-[#1c1c1e]';
        const borderColor = type === 'error' ? 'border-[#ff453a]/30' : 'border-[#30d158]/30';
        const textColor = type === 'error' ? 'text-[#ff453a]' : 'text-[#30d158]';

        toast.className = `toast ${bgColor} ${borderColor} ${textColor} border px-4 py-3 rounded-xl flex items-center gap-3 shadow-xl`;

        toast.innerHTML = `
            <div class="w-2 h-2 rounded-full ${type === 'error' ? 'bg-[#ff453a]' : 'bg-[#30d158]'} shrink-0"></div>
            <span class="text-xs font-semibold text-[#f5f5f7]">${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 200);
        }, 4000);
    },

    // No-op untuk feedback login tanpa animasi getar
    shakeLogin() {
        // Shaking animasi dihapus untuk kestabilan visual
    },

    updateShutdownTimer(seconds) {
        const statusEl = document.getElementById('shutdown-status');
        const countEl = document.getElementById('shutdown-countdown');
        if (!statusEl || !countEl) return;

        if (seconds > 0) {
            statusEl.innerText = "Shutdown";

            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            countEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            statusEl.innerText = "Off";
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
                iconContainer.className = 'w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-[#ff453a]/10 border border-[#ff453a]/20 text-[#ff453a]';
            }
            if (iconSvg) {
                iconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />';
            }
            if (titleEl) titleEl.innerText = 'Matikan Komputer?';
            if (descEl) descEl.innerText = 'Komputer client akan dimatikan secara penuh. Pastikan tidak ada data yang belum disimpan.';
            if (confirmBtn) {
                confirmBtn.className = 'flex-1 apple-btn-danger py-2.5 text-xs font-semibold cursor-pointer';
                confirmBtn.innerText = 'Matikan PC';
            }
        } else if (type === 'restart') {
            if (iconContainer) {
                iconContainer.className = 'w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-[#2997ff]/10 border border-[#2997ff]/20 text-[#2997ff]';
            }
            if (iconSvg) {
                iconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />';
            }
            if (titleEl) titleEl.innerText = 'Restart Komputer?';
            if (descEl) descEl.innerText = 'Komputer client akan dimuat ulang (reboot) sekarang.';
            if (confirmBtn) {
                confirmBtn.className = 'flex-1 bg-[#2997ff] hover:bg-[#0077ed] text-white py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer';
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

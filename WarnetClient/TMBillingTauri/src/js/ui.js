/**
 * Modul untuk Manipulasi DOM & UI Feedback
 */
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
        document.getElementById('overlay-member-name').innerText = `: ${data.member_name}`;
        document.getElementById('overlay-group').innerText = `: ${data.group}`;
        if (data.remaining_seconds !== undefined) {
            this.updateTime(data.remaining_seconds);
        }
    },

    // Update Sisa Waktu (dari Detik)
    updateTime(seconds) {
        const timeStr = this.formatTime(seconds);
        document.getElementById('overlay-time').innerText = timeStr;
    },

    formatTime(totalSeconds) {
        if (totalSeconds >= 999999) return "Unlimited";
        if (totalSeconds <= 0) return "Sesi Berakhir";
        
        const totalMinutes = Math.floor(totalSeconds / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        let result = "";
        if (hours > 0) {
            result += `${hours} jam `;
        }
        
        // Selalu tampilkan menit jika sisa waktu > 0
        if (minutes > 0 || hours === 0) {
            result += `${minutes} menit`;
        }
        
        return result.trim();
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
    }
};

// app/static/js/member/toast.js
/**
 * toast.js — Notifikasi ringan. Container fixed bottom-right (inline style di halaman).
 */
window.showToast = function showToast(type, message, duration) {
    duration = duration || 3000;
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    var bgColor, textColor, iconSvg;

    if (type === 'success') {
        bgColor = 'bg-emerald-900/90 border-emerald-700';
        textColor = 'text-emerald-100';
        iconSvg = '<svg class="w-4 h-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
    } else if (type === 'error') {
        bgColor = 'bg-red-900/90 border-red-700';
        textColor = 'text-red-100';
        iconSvg = '<svg class="w-4 h-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
    } else {
        bgColor = 'bg-neutral-800/90 border-neutral-600';
        textColor = 'text-neutral-100';
        iconSvg = '<svg class="w-4 h-4 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    }

    toast.className = 'pointer-events-auto flex items-center gap-3 px-4 py-3 text-sm rounded-lg shadow-2xl border ' + bgColor + ' ' + textColor + ' w-max max-w-[350px]';
    toast.innerHTML = '<div class="shrink-0 flex items-center justify-center">' + iconSvg + '</div><span class="flex-1">' + message + '</span>';

    // State awal: sembunyi di kanan
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    toast.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';

    container.appendChild(toast);

    // Trigger masuk
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });
    });

    // Auto-hide
    setTimeout(function () {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        toast.style.transition = 'transform 0.25s ease-in, opacity 0.25s ease-in';
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, duration);
};

// Alias backward compat: login.html dan kode lain pake Toast.success/error
window.Toast = {
    show: window.showToast,
    success: function (msg, duration) { window.showToast('success', msg, duration); },
    error: function (msg, duration) { window.showToast('error', msg, duration); },
    info: function (msg, duration) { window.showToast('info', msg, duration); }
};

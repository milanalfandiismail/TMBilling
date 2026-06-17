/* app/static/js/member/dashboard.js */

// Tab switcher script
function switchTab(tabName) {
    // Hide all panels
    ['dashboard', 'profile', 'pesan-pc', 'kantin'].forEach(name => {
        const panel = document.getElementById(`tab-panel-${name}`);
        const btn = document.getElementById(`tab-btn-${name}`);
        
        if (!panel || !btn) return;
        
        if (name === tabName) {
            panel.classList.remove('hidden');
            btn.classList.add('border-neutral-100', 'text-neutral-100');
            btn.classList.remove('border-transparent', 'text-neutral-500', 'hover:text-neutral-300');
        } else {
            panel.classList.add('hidden');
            btn.classList.remove('border-neutral-100', 'text-neutral-100');
            btn.classList.add('border-transparent', 'text-neutral-500', 'hover:text-neutral-300');
        }
    });
    
    // Save tab state in sessionStorage
    sessionStorage.setItem('activeMemberTab', tabName);
}

// Keep active tab on reload (useful for pagination clicks)
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('tx_page')) {
        switchTab('dashboard');
    } else {
        const activeTab = sessionStorage.getItem('activeMemberTab') || 'dashboard';
        switchTab(activeTab);
    }
});

async function submitLogout() {
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    try {
        const res = await fetch('/member/logout', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken }
        });
        
        const data = await res.json();
        if (res.ok && data.success) {
            window.location.href = data.redirect;
        }
    } catch (err) {
        alert('Gagal logout, silakan coba lagi.');
    }
}

// app/static/js/kasir/toast.js

const Toast = {
    show(msg, isErr) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast ' + (isErr ? 'err ' : '') + 'show';
        setTimeout(() => t.classList.remove('show'), 3000);
    },
    
    success(msg) { this.show(msg, false); },
    error(msg) { this.show(msg, true); }
};
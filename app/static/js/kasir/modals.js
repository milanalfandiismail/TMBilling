// app/static/js/kasir/modals.js

const Modals = {
    open(id) {
        document.getElementById(id).classList.add('show');
    },
    
    close(id) {
        document.getElementById(id).classList.remove('show');
    },
    
    // Setup click outside to close
    init() {
        document.querySelectorAll('.modal').forEach(mod => {
            mod.addEventListener('click', (e) => {
                if (e.target === mod) mod.classList.remove('show');
            });
        });
    }
};
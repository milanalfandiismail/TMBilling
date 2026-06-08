const Toast = {
    container: null,
    
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none';
            document.body.appendChild(this.container);
        }
    },
    
    show(msg, type = 'success') {
        this.init();
        
        const toast = document.createElement('div');
        const isError = type === 'error';
        const colors = isError 
            ? 'bg-[#0c0c0c] border border-red-950/40 text-red-200' 
            : 'bg-[#0c0c0c] border border-[#1c1c1c] text-neutral-100';
        const icon = isError
            ? '<svg class="w-4 h-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
            : '<svg class="w-4 h-4 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
        
        toast.className = `pointer-events-auto px-4 py-3 rounded ${colors} shadow-lg flex items-center gap-3 min-w-[300px] transform translate-x-full opacity-0 transition-all duration-300`;
        toast.innerHTML = `${icon}<span class="text-sm font-medium">${msg}</span>`;
        
        this.container.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });
        
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); }
};

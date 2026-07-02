const Modal = {
    activeModal: null,
    escHandler: null,

    open(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('hidden');
            el.classList.add('flex');
            document.body.style.overflow = 'hidden';
        }
    },

    close(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.classList.remove('flex');
            document.body.style.overflow = '';
        }
    },

    /**
     * Show a dynamic modal.
     * @param {string} html - The inner HTML content.
     * @param {Function} [onClose] - Callback when modal closes.
     * @param {Object} [options] - Options object.
     * @param {boolean} [options.disableBackdropClose=true] - If true (default), backdrop click & ESC will NOT close.
     */
    show(html, onClose, options = {}) {
        if (this.activeModal) this.closeModal();

        const modalDiv = document.createElement('div');
        modalDiv.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4';
        modalDiv.innerHTML = html;

        document.body.appendChild(modalDiv);
        document.body.style.overflow = 'hidden';
        this.activeModal = modalDiv;

        // Default: backdrop click & ESC are disabled (close only via X button)
        const closeOnBackdrop = options.disableBackdropClose === false;
        if (closeOnBackdrop) {
            modalDiv.addEventListener('click', (e) => {
                if (e.target === modalDiv) this.closeModal(onClose);
            });
            this.escHandler = (e) => {
                if (e.key === 'Escape') this.closeModal(onClose);
            };
            document.addEventListener('keydown', this.escHandler);
        }
    },

    closeModal(onClose) {
        if (this.activeModal) {
            const modalToClose = this.activeModal;
            this.activeModal = null;
            modalToClose.remove();
            if (!this.activeModal) {
                document.body.style.overflow = '';
            }
            if (this.escHandler) {
                document.removeEventListener('keydown', this.escHandler);
                this.escHandler = null;
            }
            if (onClose && typeof onClose === 'function') onClose();
        }
    },

    confirm(message, onConfirm, onCancel) {
        const content = `
            <div class="bg-[#0c0c0c] border border-neutral-800 rounded-xl p-5 max-w-sm w-full shadow-xl">
                <div class="flex items-center gap-3 mb-4 pb-4 border-b border-neutral-800">
                    <div class="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-800/30 flex items-center justify-center">
                        <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <h3 class="text-sm font-semibold text-neutral-100">Konfirmasi</h3>
                </div>
                <div class="text-sm text-neutral-400 mb-6 leading-relaxed">${message}</div>
                <div class="flex gap-2 justify-end">
                    <button id="modal-cancel-btn" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                    <button id="modal-confirm-btn" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors flex items-center gap-1.5">
                        Ya, Lanjutkan <span class="px-1.5 py-0.5 text-[10px] bg-black/20 text-white/70 rounded font-mono font-bold">E</span>
                    </button>
                </div>
            </div>
        `;

        // Keyboard Handler khusus tombol 'E'
        const handleKeyDown = (e) => {
            // Abaikan jika user sedang mengetik di input text / textarea
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

            if (e.key.toLowerCase() === 'e') {
                e.preventDefault();
                cleanup();
                this.closeModal();
                if (onConfirm && typeof onConfirm === 'function') onConfirm();
            }
        };

        const cleanup = () => {
            document.removeEventListener('keydown', handleKeyDown);
        };

        this.show(content, () => {
            cleanup();
            if (onCancel && typeof onCancel === 'function') onCancel();
        });

        document.addEventListener('keydown', handleKeyDown);

        setTimeout(() => {
            const confirmBtn = document.getElementById('modal-confirm-btn');
            const cancelBtn = document.getElementById('modal-cancel-btn');

            if (confirmBtn) {
                confirmBtn.onclick = () => {
                    cleanup();
                    this.closeModal();
                    if (onConfirm && typeof onConfirm === 'function') onConfirm();
                };
            }
            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    cleanup();
                    this.closeModal();
                    if (onCancel && typeof onCancel === 'function') onCancel();
                };
            }
        }, 10);
    }
};

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
     * @param {boolean} [options.disableBackdropClose=false] - If true, clicking the backdrop will NOT close the modal.
     */
    show(html, onClose, options = {}) {
        if (this.activeModal) this.closeModal();

        const modalDiv = document.createElement('div');
        modalDiv.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4';
        modalDiv.innerHTML = html;

        document.body.appendChild(modalDiv);
        document.body.style.overflow = 'hidden';
        this.activeModal = modalDiv;

        // Backdrop click: only close if disableBackdropClose is not set
        if (!options.disableBackdropClose) {
            modalDiv.addEventListener('click', (e) => {
                if (e.target === modalDiv) this.closeModal(onClose);
            });
        }

        // ESC key: only attach if not disabled
        if (!options.disableBackdropClose) {
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
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 max-w-md w-full">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded bg-[#171717] border border-[#262626] flex items-center justify-center">
                        <svg class="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <h3 class="text-xs font-bold text-neutral-200 uppercase tracking-wider">Konfirmasi</h3>
                </div>
                <div class="text-xs text-neutral-400 mb-6 leading-relaxed">${message}</div>
                <div class="flex gap-3 justify-end">
                    <button id="modal-cancel-btn" class="px-4 py-2 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded transition-colors">Batal</button>
                    <button id="modal-confirm-btn" class="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold rounded transition-colors flex items-center gap-1.5">
                        Ya, Lanjutkan <span class="px-1 py-0.5 text-[9px] bg-[#0c0c0c] border border-[#1c1c1c] text-neutral-400 rounded font-mono font-bold">E</span>
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

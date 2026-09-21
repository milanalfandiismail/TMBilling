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
        modalDiv.className = 'fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4';
        modalDiv.innerHTML = html;

        document.body.appendChild(modalDiv);
        document.body.style.overflow = 'hidden';
        this.activeModal = modalDiv;

        // Default: backdrop click & ESC are disabled (close only via X / Batal button)
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
            <div class="bg-[#111] border border-[#2a2a2a] rounded-2xl p-5 sm:p-6 max-w-md lg:max-w-lg xl:max-w-xl w-[calc(100%-2rem)] mx-auto shadow-2xl flex flex-col max-h-[90vh]">
                <div class="flex items-center gap-3 mb-4 pb-3 border-b border-[#222] shrink-0">
                    <div class="w-10 h-10 rounded-xl bg-[#171717] border border-[#262626] flex items-center justify-center shrink-0">
                        <svg class="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <h3 class="text-xs lg:text-sm font-bold text-neutral-100 uppercase tracking-wider font-mono">Konfirmasi Aksi</h3>
                </div>
                <div class="text-xs text-neutral-300 mb-5 leading-relaxed flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin">${message}</div>
                <div class="flex gap-3 justify-end pt-3 border-t border-[#222] shrink-0">
                    <button id="modal-cancel-btn" class="px-4 py-2.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 hover:text-neutral-200 text-xs font-bold rounded-xl transition-colors">Batal</button>
                    <button id="modal-confirm-btn" class="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold rounded-xl transition-colors flex items-center gap-2">
                        Ya, Lanjutkan <span class="px-1.5 py-0.5 text-[9px] bg-neutral-900 text-neutral-300 rounded font-mono font-black">E</span>
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

window.Modal = Modal;

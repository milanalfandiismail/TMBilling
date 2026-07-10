const ModalConfirmTambah = {
    open({ title = "Konfirmasi Tambah Waktu", dataLines, onConfirm, onCancel }) {
        const rows = dataLines.map(line => {
            if (line.separator) {
                return `<div class="border-t border-[#2a2a2a] my-3"></div>`;
            }
            return `
                <div class="flex justify-between items-center py-1">
                    <span class="text-[10px] lg:text-xs text-neutral-400 font-bold uppercase tracking-wider">${line.label}</span>
                    <span class="text-xs lg:text-sm font-mono font-bold ${line.highlight ? 'text-emerald-400' : 'text-neutral-200'}">${line.value}</span>
                </div>
            `;
        }).join('');

        const html = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-md w-[calc(100%-2rem)] mx-auto md:w-full shadow-2xl">
                <div class="flex items-center justify-between mb-4 pb-3 border-b border-[#2a2a2a]">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xs lg:text-sm font-bold text-neutral-100 tracking-wide">${title}</h3>
                            <p class="text-[9px] lg:text-[10px] text-neutral-500 mt-0.5">Pastikan detail tambahan waktu sudah benar</p>
                        </div>
                    </div>
                </div>

                <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4 mb-5">
                    <div class="space-y-1.5">
                        ${rows}
                    </div>
                </div>

                <div class="flex justify-end gap-3 pt-3 border-t border-[#2a2a2a]">
                    <button id="modal-confirm-cancel-btn" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded-lg transition-colors">Batal</button>
                    <button id="modal-confirm-submit-btn" class="px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-xs font-bold rounded-lg transition-colors">
                        Konfirmasi
                    </button>
                </div>
            </div>
        `;

        const modalDiv = document.createElement('div');
        modalDiv.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 modal-confirm-overlay';
        modalDiv.innerHTML = html;
        document.body.appendChild(modalDiv);

        const closeModal = () => {
            modalDiv.remove();
        };

        setTimeout(() => {
            const btnCancel = document.getElementById('modal-confirm-cancel-btn');
            const btnSubmit = document.getElementById('modal-confirm-submit-btn');

            if (btnCancel) {
                btnCancel.onclick = () => {
                    closeModal();
                    if (onCancel) onCancel();
                };
            }

            if (btnSubmit) {
                btnSubmit.onclick = () => {
                    closeModal();
                    if (onConfirm) onConfirm();
                };
            }
        }, 10);
    }
};

window.ModalConfirmTambah = ModalConfirmTambah;

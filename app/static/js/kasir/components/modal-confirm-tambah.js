const ModalConfirmTambah = {
    open({ title = "Konfirmasi Tambah Waktu", dataLines, onConfirm, onCancel }) {
        const rows = dataLines.map(line => {
            if (line.separator) {
                return `<div class="border-t border-[#262626] my-2.5"></div>`;
            }
            return `
                <div class="flex justify-between items-start gap-3 py-1.5 min-w-0">
                    <span class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-400 font-bold uppercase tracking-wider shrink-0 mt-0.5">${line.label}</span>
                    <span class="text-xs lg:max-xl:text-xs xl:text-base font-mono font-bold text-right break-words max-w-[70%] min-w-0 ${line.highlight ? 'text-emerald-400' : 'text-neutral-200'}">${line.value}</span>
                </div>
            `;
        }).join('');

        const html = `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 sm:p-6 max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl w-[calc(100%-2rem)] mx-auto shadow-2xl flex flex-col max-h-[90vh]">
                <div class="flex items-center justify-between mb-4 pb-3 border-b border-[#1c1c1c] shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 lg:max-xl:w-10 lg:max-xl:h-10 xl:w-11 xl:h-11 rounded bg-[#171717] border border-[#262626] flex items-center justify-center shrink-0">
                            <svg class="w-4 h-4 lg:max-xl:w-5 lg:max-xl:h-5 xl:w-5 xl:h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xs lg:max-xl:text-lg xl:text-[22px] font-bold text-neutral-200 uppercase tracking-wider font-mono">${title}</h3>
                            <p class="text-[9px] lg:max-xl:text-xs xl:text-base text-neutral-500 mt-0.5">Pastikan detail transaksi sudah benar</p>
                        </div>
                    </div>
                </div>

                <div class="bg-[#171717] border border-[#262626] rounded p-4 mb-4 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                    <div class="space-y-1">
                        ${rows}
                    </div>
                </div>

                <div class="flex justify-end gap-3 pt-3 border-t border-[#1c1c1c] shrink-0">
                    <button id="modal-confirm-cancel-btn" class="px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-200 text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors">Batal</button>
                    <button id="modal-confirm-submit-btn" class="px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors">
                        Konfirmasi
                    </button>
                </div>
            </div>
        `;

        const modalDiv = document.createElement('div');
        modalDiv.className = 'fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] p-4 modal-confirm-overlay';
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

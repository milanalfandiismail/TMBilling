// app/static/js/kasir/modules/struk/struk_preview.js

const StrukPreview = {
    renderPreview(data) {
        const container = document.getElementById('struk-preview');
        const inputStruk = document.getElementById('struk-no');
        if (inputStruk) inputStruk.value = data.no_nota || data.no_struk || '';

        const rupiah = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
        const escape = (str) => str ? String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m)) : '';

        const tgl = data.tanggal || '';
        const tglParts = tgl.split(' ');
        const tglDate = tglParts[0] || '';
        const tglTime = tglParts.slice(1).join(' ') || '';

        container.innerHTML = `
            <div class="thermal-paper w-[300px] mx-auto p-6 font-mono bg-[#161616] border border-[#2a2a2a] text-neutral-200 rounded-lg shadow-2xl select-none">
                <div class="text-center mb-4 pb-3 border-b border-dashed border-[#2a2a2a]">
                    <h2 class="text-base font-extrabold tracking-tight">MILAN NET</h2>
                    <p class="text-[10px] text-neutral-500 font-bold">Jl. Merdeka No. 123, Kota</p>
                </div>

                <div class="space-y-2 text-xs">
                    <div class="flex justify-between">
                        <span class="text-neutral-400">No. Nota</span>
                        <span class="font-bold">${escape(data.no_nota)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-neutral-400">Tanggal</span>
                        <span>${escape(tglDate)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-neutral-400">Waktu</span>
                        <span>${escape(tglTime)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-neutral-400">PC</span>
                        <span class="font-bold text-neutral-100">[ ${escape(data.pc_kode)} ]</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-neutral-400">Pelanggan</span>
                        <span class="font-bold text-neutral-100">${escape(data.nama_pelanggan)}</span>
                    </div>

                    <div class="border-t border-dashed border-[#2a2a2a] my-3"></div>

                    <div class="font-bold text-[10px] uppercase mb-1 text-neutral-400 font-bold">Rincian:</div>
                    <div class="space-y-2">
                        ${(data.rincian || []).map(r => `
                            <div class="border-b border-dashed border-[#2a2a2a]/50 pb-1.5 last:border-0 last:pb-0">
                                <div class="font-bold text-neutral-100">${escape(r.keterangan)}</div>
                                <div class="text-[10px] text-neutral-400 font-bold">${r.durasi} menit</div>
                                <div class="text-xs font-bold text-right mt-0.5 text-neutral-200">${rupiah(r.harga)}</div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="border-t border-dashed border-[#2a2a2a] my-3"></div>

                    <div class="flex justify-between items-end">
                        <div>
                            <span class="text-[10px] text-neutral-400 uppercase font-bold">Total Durasi</span>
                            <div class="font-bold text-neutral-200">${data.total_durasi} menit</div>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] text-neutral-400 uppercase font-bold">TOTAL BAYAR</span>
                            <div class="text-sm font-black text-emerald-400">${rupiah(data.total_harga)}</div>
                        </div>
                    </div>

                    <div class="border-t border-dashed border-[#2a2a2a] my-3"></div>

                    <div class="flex justify-between text-[10px]">
                        <span class="text-neutral-400">Kasir</span>
                        <span class="text-neutral-200 font-bold">${escape(data.kasir)}</span>
                    </div>
                    <div class="text-center text-[10px] text-neutral-500 font-bold pt-3 border-t border-dashed border-[#2a2a2a] mt-2">
                        Terima kasih, selamat bermain!
                    </div>
                </div>
            </div>`;
    },

    printPreview() {
        if (!this.currentData) { Toast.error("Tidak ada data"); return; }

        const iframe = document.createElement('iframe');
        Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        const data = this.currentData;

        const rupiah = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
        const rincianHtml = (data.rincian || []).map(r =>
            `<div style="margin-bottom:6px;">
                <div style="font-weight:bold;">${r.keterangan}</div>
                <div style="font-size:10px;margin:2px 0;">${r.durasi} menit</div>
                <div style="font-weight:bold;">${rupiah(r.harga)}</div>
            </div>`
        ).join('');

        const tglPrint = data.tanggal || '';
        const tglPartsPrint = tglPrint.split(' ');
        const tglDatePrint = tglPartsPrint[0] || '';
        const tglTimePrint = tglPartsPrint.slice(1).join(' ') || '';

        doc.open();
        doc.write(`
            <html><head>
                <style>
                    @page { margin: 0; }
                    body { font-family: 'Courier New', monospace; width: 58mm; margin: 0 auto; padding: 10px; font-size: 11px; color: #000; line-height: 1.4; }
                    .text-center { text-align: center; }
                    .flex { display: flex; justify-content: space-between; }
                    .divider { border-top: 1px dashed #000; margin: 8px 0; }
                </style>
            </head><body>
                <div class="text-center">
                    <div style="font-weight:bold;font-size:14px;">MILAN NET</div>
                    <div style="font-size:9px;">Jl. Merdeka No. 123, Kota</div>
                    <div class="divider"></div>
                </div>
                <div class="flex"><span>No. Nota</span><span style="font-weight:bold;">${data.no_nota}</span></div>
                <div class="flex"><span>Tanggal</span><span>${tglDatePrint}</span></div>
                <div class="flex"><span>Jam</span><span>${tglTimePrint}</span></div>
                <div class="flex"><span>PC</span><span style="font-weight:bold;">${data.pc_kode}</span></div>
                <div class="flex"><span>User</span><span>${data.nama_pelanggan}</span></div>
                <div class="divider"></div>
                <div style="font-size:9px;font-weight:bold;margin-bottom:6px;">Rincian:</div>
                ${rincianHtml}
                <div class="divider"></div>
                <div class="flex"><span>Durasi</span><span>${data.total_durasi} menit</span></div>
                <div class="flex" style="font-weight:bold;font-size:13px;margin-top:4px;"><span>TOTAL</span><span>${rupiah(data.total_harga)}</span></div>
                <div class="divider"></div>
                <div class="flex" style="font-size:9px;"><span>Kasir</span><span>${data.kasir}</span></div>
                <div class="text-center" style="margin-top:15px;font-size:9px;">Terima kasih, selamat bermain!</div>
            </body></html>
        `);
        doc.close();

        iframe.contentWindow.focus();
        setTimeout(() => {
            iframe.contentWindow.print();
            document.body.removeChild(iframe);
        }, 500);
    }
};

window.StrukPreview = StrukPreview;

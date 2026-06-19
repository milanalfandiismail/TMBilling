// app/static/js/kasir/modules/struk/struk_preview.js

const StrukPreview = {
    renderPreview(data) {
        const container = document.getElementById('struk-preview');
        const inputStruk = document.getElementById('struk-no');
        if (inputStruk) inputStruk.value = data.no_nota || data.no_struk || '';

        const escape = (str) => str ? String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m)) : '';

        // Data dinamis nota (fallback untuk transaksi lama)
        const warnetTitle = data.warnet_title || 'MILAN NET';
        const warnetAddress = data.warnet_address || 'Jl. Merdeka No. 123, Kota';
        const warnetPhone = data.warnet_phone || '';
        const warnetFooter = data.warnet_footer || (data.tipe === 'kantin' ? 'Terima kasih atas kunjungan Anda!' : 'Terima kasih, selamat bermain!');

        const tgl = data.tanggal || '';
        const tglParts = tgl.split(' ');
        const tglDate = tglParts[0] || '';
        const tglTime = tglParts.slice(1).join(' ') || '';

        container.innerHTML = `
            <div class="thermal-paper w-[300px] mx-auto p-6 font-mono bg-[#161616] border border-[#2a2a2a] text-neutral-200 rounded-lg shadow-2xl select-none">
                <div class="text-center mb-4 pb-3 border-b border-dashed border-[#2a2a2a]">
                    <h2 class="text-base font-extrabold tracking-tight">${escape(warnetTitle)}</h2>
                    <p class="text-[10px] lg:text-base text-neutral-500 font-bold">${escape(warnetAddress)}</p>
                    ${warnetPhone ? `<p class="text-[10px] lg:text-base text-neutral-500 font-bold">${escape(warnetPhone)}</p>` : ''}
                </div>

                <div class="space-y-2 text-xs lg:text-base">
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
                        <span class="text-neutral-400">${data.tipe === 'kantin' ? 'Pemesanan' : 'PC'}</span>
                        <span class="font-bold text-neutral-100">${data.tipe === 'kantin' ? (data.pc_kode === 'Tempat' ? 'Makan di Tempat' : 'Take Away') : `[ ${escape(data.pc_kode)} ]`}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-neutral-400">Pelanggan</span>
                        <span class="font-bold text-neutral-100">${escape(data.nama_pelanggan)}</span>
                    </div>

                    <div class="border-t border-dashed border-[#2a2a2a] my-3"></div>

                    <div class="font-bold text-[10px] lg:text-base uppercase mb-1 text-neutral-400 font-bold">Rincian:</div>
                    <div class="space-y-2">
                        ${(data.rincian || []).map(r => `
                            <div class="border-b border-dashed border-[#2a2a2a]/50 pb-1.5 last:border-0 last:pb-0">
                                <div class="font-bold text-neutral-100">${escape(r.keterangan)}</div>
                                <div class="text-[10px] lg:text-base text-neutral-400 font-bold">${data.tipe === 'kantin' ? 'Jumlah: ' + r.durasi : r.durasi + ' menit'}</div>
                                <div class="text-xs lg:text-base font-bold text-right mt-0.5 text-neutral-200">${Utils.formatRupiah(r.harga)}</div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="border-t border-dashed border-[#2a2a2a] my-3"></div>

                    <div class="flex justify-between items-end">
                        <div>
                            <span class="text-[10px] lg:text-base text-neutral-400 uppercase font-bold">${data.tipe === 'kantin' ? 'Total Item' : 'Total Durasi'}</span>
                            <div class="font-bold text-neutral-200">${data.total_durasi} ${data.tipe === 'kantin' ? 'pcs' : 'menit'}</div>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] lg:text-base text-neutral-400 uppercase font-bold">TOTAL BAYAR</span>
                            <div class="text-sm font-black text-emerald-400">${Utils.formatRupiah(data.total_harga)}</div>
                        </div>
                    </div>

                    ${data.tunai !== null && data.tunai !== undefined ? `
                    <div class="border-t border-dashed border-[#2a2a2a] my-3"></div>
                    <div class="flex justify-between text-[10px] lg:text-base">
                        <span class="text-neutral-400">Tunai</span>
                        <span class="text-neutral-200 font-bold">${Utils.formatRupiah(data.tunai)}</span>
                    </div>
                    <div class="flex justify-between text-[10px] lg:text-base">
                        <span class="text-neutral-400">Kembalian</span>
                        <span class="text-emerald-400 font-bold">${Utils.formatRupiah(data.kembalian)}</span>
                    </div>
                    ` : ''}

                    <div class="border-t border-dashed border-[#2a2a2a] my-3"></div>

                    <div class="flex justify-between text-[10px] lg:text-base">
                        <span class="text-neutral-400">Kasir</span>
                        <span class="text-neutral-200 font-bold">${escape(data.kasir)}</span>
                    </div>
                    <div class="text-center text-[10px] lg:text-base text-neutral-500 font-bold pt-3 border-t border-dashed border-[#2a2a2a] mt-2">
                        ${escape(warnetFooter)}
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

        // Data dinamis nota (fallback untuk transaksi lama)
        const warnetTitle = data.warnet_title || 'MILAN NET';
        const warnetAddress = data.warnet_address || 'Jl. Merdeka No. 123, Kota';
        const warnetPhone = data.warnet_phone || '';
        const warnetFooter = data.warnet_footer || (data.tipe === 'kantin' ? 'Terima kasih atas kunjungan Anda!' : 'Terima kasih, selamat bermain!');

        const rincianHtml = (data.rincian || []).map(r =>
            `<div style="margin-bottom:6px;">
                <div style="font-weight:bold;">${r.keterangan}</div>
                <div style="font-size:10px;margin:2px 0;">${data.tipe === 'kantin' ? 'Jumlah: ' + r.durasi : r.durasi + ' menit'}</div>
                <div style="font-weight:bold;">${Utils.formatRupiah(r.harga)}</div>
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
                    <div style="font-weight:bold;font-size:14px;">${warnetTitle}</div>
                    <div style="font-size:9px;">${warnetAddress}</div>
                    ${warnetPhone ? `<div style="font-size:9px;">${warnetPhone}</div>` : ''}
                    <div class="divider"></div>
                </div>
                <div class="flex"><span>No. Nota</span><span style="font-weight:bold;">${data.no_nota}</span></div>
                <div class="flex"><span>Tanggal</span><span>${tglDatePrint}</span></div>
                <div class="flex"><span>Jam</span><span>${tglTimePrint}</span></div>
                <div class="flex"><span>${data.tipe === 'kantin' ? 'Pemesanan' : 'PC'}</span><span style="font-weight:bold;">${data.tipe === 'kantin' ? (data.pc_kode === 'Tempat' ? 'Makan di Tempat' : 'Take Away') : data.pc_kode}</span></div>
                <div class="flex"><span>User</span><span>${data.nama_pelanggan}</span></div>
                <div class="divider"></div>
                <div style="font-size:9px;font-weight:bold;margin-bottom:6px;">Rincian:</div>
                ${rincianHtml}
                <div class="divider"></div>
                <div class="flex"><span>${data.tipe === 'kantin' ? 'Total Item' : 'Total Durasi'}</span><span>${data.total_durasi} ${data.tipe === 'kantin' ? 'pcs' : 'menit'}</span></div>
                <div class="flex" style="font-weight:bold;font-size:13px;margin-top:4px;"><span>TOTAL</span><span>${Utils.formatRupiah(data.total_harga)}</span></div>
                ${data.tunai !== null && data.tunai !== undefined ? `
                <div class="divider"></div>
                <div class="flex" style="font-size:10px;"><span>Tunai</span><span style="font-weight:bold;">${Utils.formatRupiah(data.tunai)}</span></div>
                <div class="flex" style="font-size:10px;"><span>Kembalian</span><span style="font-weight:bold;color:#16a34a;">${Utils.formatRupiah(data.kembalian)}</span></div>
                ` : ''}
                <div class="divider"></div>
                <div class="flex" style="font-size:9px;"><span>Kasir</span><span>${data.kasir}</span></div>
                <div class="text-center" style="margin-top:15px;font-size:9px;">${warnetFooter}</div>
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

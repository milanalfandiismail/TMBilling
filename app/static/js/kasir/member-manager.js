// app/static/js/kasir/member-manager.js

const MemberManager = {
    allMembers: [],

    async load() {
        try {
            const data = await API.call('/kasir/member');
            this.allMembers = data.members;

            // Render header search sekali saja (jika belum ada)
            this.renderSearchHeader();
            // Render tabel
            this.renderTable(this.allMembers);
        } catch (e) {
            Toast.error('Gagal load member: ' + e.message);
        }
    },

    renderSearchHeader() {
        const memberTable = document.getElementById('member-table');
        if (!memberTable) return;

        // Cek apakah header search sudah ada
        if (document.getElementById('search-header')) return;

        const searchHtml = `
            <div id="search-header" style="margin-bottom: 16px;">
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 200px;">
                        <input type="text" 
                               id="search-member" 
                               placeholder="🔍 Cari username, nama, email, atau no HP..." 
                               style="width: 100%; padding: 8px 12px; background: #0a0a0a; border: 1px solid #333; color: #fff; border-radius: 4px;"
                               onkeyup="MemberManager.search()">
                    </div>
                    <button class="btn" onclick="MemberManager.clearSearch()" style="background: #333;">
                        ✖ Clear
                    </button>
                    <div id="search-result-info" style="font-size: 11px; color: #888;"></div>
                </div>
            </div>
        `;

        // Sisipkan di awal
        memberTable.insertAdjacentHTML('beforebegin', searchHtml);
    },

    search() {
        const keyword = document.getElementById('search-member')?.value.toLowerCase().trim() || '';

        if (!keyword) {
            this.renderTable(this.allMembers);
            return;
        }

        const filtered = this.allMembers.filter(m =>
            m.username.toLowerCase().includes(keyword) ||
            (m.nama_lengkap && m.nama_lengkap.toLowerCase().includes(keyword)) ||
            (m.email && m.email.toLowerCase().includes(keyword)) ||
            (m.no_hp && m.no_hp.includes(keyword))
        );

        this.renderTable(filtered);

        const resultInfo = document.getElementById('search-result-info');
        if (resultInfo) {
            if (filtered.length === 0) {
                resultInfo.innerHTML = '<span style="color:#ffaa44;">⚠️ Tidak ada member ditemukan</span>';
            } else {
                resultInfo.innerHTML = `<span style="color:#00ff00;">✅ ${filtered.length} dari ${this.allMembers.length} member</span>`;
            }
        }
    },

    clearSearch() {
        const searchInput = document.getElementById('search-member');
        if (searchInput) {
            searchInput.value = '';
        }
        this.renderTable(this.allMembers);

        const resultInfo = document.getElementById('search-result-info');
        if (resultInfo) {
            resultInfo.innerHTML = '';
        }
    },

    renderTable(members) {
        const tableHtml = `
            <div style="overflow-x: auto;">
                <table style="width:100%">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Nama</th>
                            <th>Total Saldo</th>
                            <th>Detail Saldo (aktif)</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${members.map(m => this.renderRow(m)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const memberTable = document.getElementById('member-table');
        if (memberTable) {
            memberTable.innerHTML = tableHtml;
        }
    },

    renderRow(m) {
        const totalSaldo = m.total_saldo || 0;
        const saldoDetails = m.saldo_details || [];

        const now = new Date();
        const activeDetails = saldoDetails.filter(d => {
            const expiryDate = new Date(d.kadaluarsa_pada);
            return d.menit > 0 && expiryDate > now;
        });

        const detailHtml = activeDetails.map(d => {
            const expiryDate = new Date(d.kadaluarsa_pada);
            const diffMs = expiryDate - now;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (86400000)) / (3600000));
            const diffMinutes = Math.floor((diffMs % 3600000) / 60000);

            let statusClass = '';
            let timeText = '';

            if (diffDays > 0) {
                timeText = `sisa ${diffDays}h ${diffHours}m`;
            } else if (diffHours > 0) {
                timeText = `sisa ${diffHours}h ${diffMinutes}m`;
                if (diffHours <= 2) {
                    statusClass = 'color: #ffaa44;';
                }
            } else {
                timeText = `sisa ${diffMinutes}m`;
                if (diffMinutes <= 30) {
                    statusClass = 'color: #ff4444;';
                }
            }

            return `
                <div style="font-size: 10px; margin: 2px 0; ${statusClass}" title="Expired: ${Utils.formatDateTime(d.kadaluarsa_pada)}">
                    ${Utils.formatDuration(d.menit)} 
                    <span style="font-size: 9px; color: #888;">(${timeText})</span>
                </div>
            `;
        }).join('');

        const expiredCount = saldoDetails.filter(d => {
            const expiryDate = new Date(d.kadaluarsa_pada);
            return d.menit > 0 && expiryDate <= now;
        }).length;

        const expiredBadge = expiredCount > 0 ?
            `<span style="color:#ff4444; font-size:9px; margin-left:4px;">(+${expiredCount} expired)</span>` : '';

        return `
            <tr>
                <td style="font-weight:600">@${m.username || '-'}</td>
                <td>${m.nama_lengkap || '-'}</td>
                <td style="font-weight:700; font-size:16px;">
                    ${Utils.formatDuration(totalSaldo)}
                </td>
                <td style="max-width: 200px;">
                    ${detailHtml || '<span style="color:#888; font-size:10px;">Tidak ada saldo aktif</span>'}
                    ${expiredBadge}
                </td>
                <td>
                    <button class="btn" onclick="MemberManager.showDetail(${m.id})" 
                            style="background:#333; margin-right:4px;">
                        📋 Detail
                    </button>
                    <button class="btn primary" onclick="MemberManager.showTopup(${m.id}, '${m.username}')" 
                            style="margin-top:4px;">
                        💰 Topup
                    </button>
                </td>
            </tr>
        `;
    },

    async showDetail(memberId) {
        try {
            const data = await API.call('/kasir/member/' + memberId);
            const m = data.member;
            const now = new Date();

            const activeDetails = (m.saldo_details || []).filter(d => {
                const expiryDate = new Date(d.kadaluarsa_pada);
                return d.menit > 0 && expiryDate > now;
            });

            const expiredDetails = (m.saldo_details || []).filter(d => {
                const expiryDate = new Date(d.kadaluarsa_pada);
                return d.menit > 0 && expiryDate <= now;
            });

            const modalContent = `
                <div style="min-width: 600px; max-width: 700px;">
                    <div class="modal-head" style="margin-bottom: 16px;">
                        <h3>Detail Member: @${m.username}</h3>
                        <button class="modal-close" onclick="MemberManager.closeModal()">&times;</button>
                    </div>
                    
                    <div style="margin-bottom: 12px; padding: 12px; background: #1a1a1a; border-radius: 4px;">
                        <div><strong>Nama:</strong> ${m.nama_lengkap || '-'}</div>
                        <div><strong>Email:</strong> ${m.email || '-'}</div>
                        <div><strong>No HP:</strong> ${m.no_hp || '-'}</div>
                        <div><strong>Total Saldo:</strong> <span style="color: #00ff00;">${Utils.formatDuration(m.total_saldo)}</span></div>
                        <div><strong>Bergabung:</strong> ${Utils.formatDateTime(m.dibuat_pada)}</div>
                    </div>
                    
                    <div style="margin-top: 16px;">
                        <strong>✅ Saldo Aktif (${activeDetails.length}):</strong>
                        <div style="max-height: 250px; overflow-y: auto; margin-top: 8px;">
                            <table style="width:100%; font-size: 11px;">
                                <thead style="position: sticky; top: 0; background: #141414;">
                                    <tr style="color: #888; border-bottom: 1px solid #333;">
                                        <th style="text-align:left; padding: 6px;">Tanggal Beli</th>
                                        <th style="text-align:left; padding: 6px;">Paket</th>
                                        <th style="text-align:right; padding: 6px;">Sisa</th>
                                        <th style="text-align:left; padding: 6px;">Expired (WITA)</th>
                                        <th style="text-align:left; padding: 6px;">Sisa Waktu</th>
                                        <th style="text-align:center; padding: 6px;">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${activeDetails.map(d => {
                const expiry = new Date(d.kadaluarsa_pada);
                const diffMs = expiry - now;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffHours = Math.floor((diffMs % (86400000)) / (3600000));
                const diffMinutes = Math.floor((diffMs % 3600000) / 60000);

                let sisaWaktuText = '';
                let statusBadge = '';

                if (diffDays > 0) {
                    sisaWaktuText = `${diffDays} hari ${diffHours} jam`;
                    statusBadge = '<span style="color:#00ff00;">✅ Aktif</span>';
                } else if (diffHours > 0) {
                    sisaWaktuText = `${diffHours} jam ${diffMinutes} menit`;
                    if (diffHours <= 2) {
                        statusBadge = '<span style="color:#ffaa44;">⚠️ Segera expired</span>';
                    } else {
                        statusBadge = '<span style="color:#00ff00;">✅ Aktif</span>';
                    }
                } else {
                    sisaWaktuText = `${diffMinutes} menit`;
                    if (diffMinutes <= 30) {
                        statusBadge = '<span style="color:#ff4444;">🔴 Hampir expired</span>';
                    } else {
                        statusBadge = '<span style="color:#00ff00;">✅ Aktif</span>';
                    }
                }

                return `
                                            <tr style="border-bottom: 1px solid #222;">
                                                <td style="padding: 6px;">${Utils.formatDateTime(d.dibuat_pada)}</td>
                                                <td style="padding: 6px;">${Utils.formatDuration(d.menit_awal)}</td>
                                                <td style="padding: 6px; text-align:right;">${Utils.formatDuration(d.menit)}</td>
                                                <td style="padding: 6px;">${Utils.formatDateTime(d.kadaluarsa_pada)}</td>
                                                <td style="padding: 6px; font-family: monospace;">${sisaWaktuText}</td>
                                                <td style="padding: 6px; text-align:center;">${statusBadge}</td>
                                            </tr>
                                        `;
            }).join('') || '<tr><td colspan="6" style="text-align:center; padding: 20px;">Tidak ada saldo aktif</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${expiredDetails.length > 0 ? `
                    <div style="margin-top: 16px;">
                        <strong>❌ Saldo Expired (${expiredDetails.length}):</strong>
                        <div style="max-height: 200px; overflow-y: auto; margin-top: 8px;">
                            <table style="width:100%; font-size: 11px; opacity: 0.6;">
                                <thead style="position: sticky; top: 0; background: #141414;">
                                    <tr style="color: #888; border-bottom: 1px solid #333;">
                                        <th style="text-align:left; padding: 6px;">Tanggal Beli</th>
                                        <th style="text-align:left; padding: 6px;">Paket</th>
                                        <th style="text-align:right; padding: 6px;">Hangus</th>
                                        <th style="text-align:left; padding: 6px;">Expired Pada</th>
                                        <th style="text-align:center; padding: 6px;">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${expiredDetails.map(d => `
                                        <tr style="border-bottom: 1px solid #222;">
                                            <td style="padding: 6px;">${Utils.formatDateTime(d.dibuat_pada)}</td>
                                            <td style="padding: 6px;">${Utils.formatDuration(d.menit_awal)}</td>
                                            <td style="padding: 6px; text-align:right;">${Utils.formatDuration(d.menit)}</td>
                                            <td style="padding: 6px;">${Utils.formatDateTime(d.kadaluarsa_pada)}</td>
                                            <td style="padding: 6px; text-align:center;"><span style="color:#ff4444;">❌ EXPIRED</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="modal-foot" style="margin-top: 20px; display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn" onclick="MemberManager.closeModal()">Tutup</button>
                        <button class="btn primary" onclick="MemberManager.closeModal(); MemberManager.showTopup(${m.id}, '${m.username}')">
                            💰 Topup Saldo
                        </button>
                    </div>
                </div>
            `;

            this.showModal(modalContent);

        } catch (e) {
            Toast.error('Gagal load detail: ' + e.message);
        }
    },

    async showTopup(memberId, username) {
        try {
            const data = await API.call('/paket/?aktif=true');
            const pakets = data.paket;

            if (!pakets || pakets.length === 0) {
                Toast.error('Tidak ada paket. Buat paket dulu!');
                return;
            }

            const modalContent = `
                <div style="min-width: 320px; max-width: 450px;">
                    <div class="modal-head" style="margin-bottom: 16px;">
                        <h3>Topup Saldo: @${username}</h3>
                        <button class="modal-close" onclick="MemberManager.closeModal()">&times;</button>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label>Pilih Paket</label>
                        <select id="topup-paket" style="width:100%; padding: 8px;">
                            ${pakets.map(p => `
                                <option value="${p.id}" data-menit="${p.durasi_menit}" data-hari="${p.kadaluarsa_hari}" data-harga="${p.harga}">
                                    ${p.nama} - ${Utils.formatRupiah(p.harga)} (${Utils.formatDuration(p.durasi_menit)}, exp ${p.kadaluarsa_hari} hari)
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label>Metode Pembayaran</label>
                        <select id="topup-metode" style="width:100%; padding: 8px;">
                            <option value="tunai">💵 Tunai</option>
                            <option value="qris">📱 QRIS</option>
                            <option value="transfer">🏦 Transfer Bank</option>
                        </select>
                    </div>
                    
                    <div id="topup-preview" style="background: #0a0a0a; padding: 12px; border-radius: 4px; margin: 12px 0;">
                        ${this.getPreviewHtml(pakets[0])}
                    </div>
                    
                    <div class="modal-foot" style="margin-top: 20px; display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn" onclick="MemberManager.closeModal()">Batal</button>
                        <button class="btn primary" onclick="MemberManager.doTopup(${memberId})">
                            ✅ Bayar & Topup
                        </button>
                    </div>
                </div>
            `;

            this.showModal(modalContent);

            const paketSelect = document.getElementById('topup-paket');
            if (paketSelect) {
                paketSelect.onchange = () => {
                    const selected = paketSelect.options[paketSelect.selectedIndex];
                    const previewDiv = document.getElementById('topup-preview');
                    if (previewDiv) {
                        const paketData = {
                            nama: selected.text.split(' - ')[0],
                            durasi_menit: parseInt(selected.dataset.menit),
                            kadaluarsa_hari: parseInt(selected.dataset.hari),
                            harga: parseInt(selected.dataset.harga)
                        };
                        previewDiv.innerHTML = this.getPreviewHtml(paketData);
                    }
                };
            }

        } catch (e) {
            Toast.error('Gagal load paket: ' + e.message);
        }
    },

    getPreviewHtml(paket) {
        return `
            <div style="display: flex; justify-content: space-between;">
                <span>Paket:</span>
                <span>${paket.nama}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                <span>Durasi:</span>
                <span>${Utils.formatDuration(paket.durasi_menit)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                <span>Kadaluarsa:</span>
                <span>${paket.kadaluarsa_hari} hari</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #333;">
                <strong>Total Bayar:</strong>
                <strong style="color: #00ff00;">${Utils.formatRupiah(paket.harga)}</strong>
            </div>
        `;
    },

    async doTopup(memberId) {
        const paketSelect = document.getElementById('topup-paket');
        const metodeSelect = document.getElementById('topup-metode');

        if (!paketSelect || !metodeSelect) {
            Toast.error('Form tidak lengkap');
            return;
        }

        const paketId = parseInt(paketSelect.value);
        const metode = metodeSelect.value;

        try {
            const result = await API.call('/kasir/member/' + memberId + '/topup', {
                method: 'POST',
                body: { paket_id: paketId, metode: metode }
            });

            Toast.success(result.message || 'Topup berhasil!');
            this.closeModal();
            await this.load();

            if (typeof Dashboard !== 'undefined' && Dashboard.updateStats) {
                Dashboard.updateStats();
            }

        } catch (e) {
            Toast.error(e.message || 'Gagal topup');
        }
    },

    activeModal: null,

    showModal(contentHtml) {
        this.closeModal();

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';

        modal.innerHTML = `
            <div class="modal-box" style="
                max-width: 85%;
                width: auto;
                min-width: 500px;
                max-height: 85vh;
                overflow-y: auto;
                background: #1a1a1a;
                border-radius: 8px;
                padding: 20px;
            ">
                ${contentHtml}
            </div>
        `;

        document.body.appendChild(modal);
        this.activeModal = modal;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
    },

    closeModal() {
        if (this.activeModal) {
            this.activeModal.remove();
            this.activeModal = null;
        }
    },

    async add() {
        const username = document.getElementById('inp-mem-user')?.value.trim();
        const password = document.getElementById('inp-mem-pass')?.value;

        if (!username) {
            Toast.error('Username wajib diisi');
            return;
        }

        if (!password) {
            Toast.error('Password wajib diisi');
            return;
        }

        try {
            const body = {
                username: username,
                password: password,
                nama_lengkap: document.getElementById('inp-mem-nama')?.value.trim() || '',
                email: document.getElementById('inp-mem-email')?.value.trim() || '',
                no_hp: document.getElementById('inp-mem-nohp')?.value.trim() || ''
            };

            await API.call('/kasir/member', { method: 'POST', body });
            Toast.success('Member berhasil ditambahkan');

            const fields = ['inp-mem-user', 'inp-mem-pass', 'inp-mem-nama', 'inp-mem-email', 'inp-mem-nohp'];
            fields.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            await this.load();

        } catch (e) {
            Toast.error(e.message || 'Gagal menambah member');
        }
    }
};
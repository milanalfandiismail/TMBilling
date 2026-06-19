const User = {
    editingId: null,

    async load() {
        const area = document.getElementById('user-table');
        if (!area) return;
        area.innerHTML = '<div class="flex justify-center py-10"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';

        try {
            const data = await API.user.list();
            this.render(data);
        } catch (err) {
            area.innerHTML = '<div class="text-center text-red-400 py-10 text-xs lg:text-base">Gagal memuat data kasir</div>';
            if (err.message && err.message.includes("Akses Ditolak")) {
                area.innerHTML = '<div class="text-center text-red-400 py-10 text-xs lg:text-base">Akses Ditolak. Anda bukan admin.</div>';
            }
        }
    },

    render(users) {
        const area = document.getElementById('user-table');
        if (!users || users.length === 0) {
            area.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-neutral-500"><p class="text-xs lg:text-base font-bold uppercase tracking-wider">Belum ada user</p></div>';
            return;
        }

        area.innerHTML = `
            <div class="overflow-x-hidden w-full">
                <table class="w-full text-xs lg:text-base block lg:table">
                    <thead class="hidden lg:table-header-group">
                        <tr class="text-[10px] lg:text-base text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c]">
                            <th class="px-6 py-4 text-left">Operator</th>
                            <th class="px-6 py-4 text-center">Role</th>
                            <th class="px-6 py-4 text-center">Status</th>
                            <th class="px-6 py-4 text-right">Kelola</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#2a2a2a] lg:divide-[#1c1c1c] block lg:table-row-group">
                        ${users.map(u => {
                            const roleBadge = u.role === 'admin'
                                ? '<span class="px-2 py-0.5 rounded text-[10px] lg:text-base font-bold bg-[#2d1215] text-red-400 border border-red-900/30">Admin</span>'
                                : '<span class="px-2 py-0.5 rounded text-[10px] lg:text-base font-bold bg-[#171717] text-neutral-300 border border-[#262626]">Staff</span>';
                            const statusBadge = u.aktif
                                ? '<span class="inline-flex items-center gap-1.5 text-xs lg:text-base text-neutral-300"><span class="w-1.5 h-1.5 rounded bg-neutral-200"></span>Aktif</span>'
                                : '<span class="inline-flex items-center gap-1.5 text-xs lg:text-base text-neutral-500"><span class="w-1.5 h-1.5 rounded bg-neutral-700"></span>Nonaktif</span>';
                            return `
                                <tr class="hover:bg-[#121212] transition-colors block lg:table-row py-3 lg:py-0 border-b border-[#2a2a2a] last:border-b-0 lg:border-b-0">
                                    <td class="px-6 py-4 block lg:table-cell">
                                        <div class="flex items-center gap-3">
                                            <div class="w-9 h-9 rounded bg-[#171717] border border-[#262626] flex items-center justify-center text-neutral-200 font-bold">${u.username.charAt(0).toUpperCase()}</div>
                                            <div>
                                                <div class="font-bold text-neutral-200">${Utils.escapeHtml(u.username)}</div>
                                                <div class="text-[10px] lg:text-base text-neutral-500 font-mono">${Utils.escapeHtml(u.nama_lengkap || '-')}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-center flex lg:table-cell justify-between items-center border-t border-[#2a2a2a]/50 lg:border-t-0">
                                        <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Role</span>
                                        ${roleBadge}
                                    </td>
                                    <td class="px-6 py-4 text-center flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Status</span>
                                        ${statusBadge}
                                    </td>
                                    <td class="px-6 py-4 text-right flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Kelola</span>
                                        <div class="flex justify-end gap-2">
                                            <button onclick="User.edit(${u.id})" class="w-9 h-9 rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                            </button>
                                            <button onclick="User.delete(${u.id}, '${u.username}')" class="w-9 h-9 rounded bg-[#2d1215] border border-red-900/30 text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    openAddModal() { this.showFormModal(); },

    showFormModal(userData = null) {
        this.editingId = userData ? userData.id : null;
        const isEdit = !!userData;

        const modalHtml = `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 max-w-md w-[calc(100%-2rem)] mx-auto md:w-full">
                <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#1c1c1c]">
                    <div><h3 class="text-xs lg:text-base font-bold text-neutral-200 uppercase tracking-wider">${isEdit ? 'Edit User' : 'Tambah User Baru'}</h3></div>
                    <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                </div>
                <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider mb-1 block">Username</label>
                            <input type="text" id="inp-user-username" placeholder="Username" value="${userData ? Utils.escapeHtml(userData.username) : ''}" class="w-full px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500">
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider mb-1 block">Nama Lengkap</label>
                            <input type="text" id="inp-user-nama" placeholder="Nama" value="${userData ? Utils.escapeHtml(userData.nama_lengkap || '') : ''}" class="w-full px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500">
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider mb-1 block">Password ${isEdit ? '(kosongi jika tidak ganti)' : ''}</label>
                        <input type="password" id="inp-user-pass" placeholder="${isEdit ? 'Kosongkan' : 'Password'}" class="w-full px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500">
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider mb-1 block">Role</label>
                            <select id="inp-user-role" class="w-full px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500">
                                <option value="kasir" ${userData?.role === 'kasir' ? 'selected' : ''}>Staff Kasir</option>
                                <option value="admin" ${userData?.role === 'admin' ? 'selected' : ''}>Administrator</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider mb-1 block">Status</label>
                            <select id="inp-user-aktif" class="w-full px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500">
                                <option value="true" ${userData?.aktif !== false ? 'selected' : ''}>Aktif</option>
                                <option value="false" ${userData?.aktif === false ? 'selected' : ''}>Nonaktif</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#1c1c1c]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded transition-colors">Batal</button>
                    <button onclick="User.addOrupdate()" class="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded transition-colors">${isEdit ? 'Simpan' : 'Daftarkan'}</button>
                </div>
            </div>`;
        Modal.show(modalHtml);
    },

    async addOrupdate() {
        const username = document.getElementById('inp-user-username').value;
        const nama_lengkap = document.getElementById('inp-user-nama').value;
        const password = document.getElementById('inp-user-pass').value;
        const role = document.getElementById('inp-user-role').value;
        const aktif = document.getElementById('inp-user-aktif').value === 'true';
        if (!username || (!this.editingId && !password)) return Toast.error("Username dan Password wajib");

        const data = { username, nama_lengkap, role, aktif };
        if (password) data.password = password;

        try {
            if (this.editingId) {
                await API.user.update(this.editingId, data);
                Toast.success("User diperbarui");
            } else {
                await API.user.create(data);
                Toast.success("User ditambahkan");
            }
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message || "Gagal menyimpan");
        }
    },

    async edit(id) {
        try {
            const u = await API.user.get(id);
            this.showFormModal(u);
        } catch (err) {
            Toast.error("Gagal load data: " + err.message);
        }
    },

    async delete(id, username) {
        const message = `<div class="text-center"><p class="text-xs lg:text-base text-neutral-400">Hapus akun <span class="text-neutral-200 font-bold font-mono">${username}</span>?</p><p class="text-[10px] lg:text-base text-neutral-500 mt-1">Semua hak akses akan dicabut.</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.user.delete(id);
                Toast.success("User dihapus");
                this.load();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    }
};

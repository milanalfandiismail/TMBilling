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
            <div class="overflow-x-auto w-full">
                <table class="w-full text-xs lg:max-xl:text-xs xl:text-base block lg:table">
                    <thead class="hidden lg:table-header-group">
                        <tr class="text-[10px] lg:max-xl:text-xs xl:text-base text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c]">
                            <th class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 text-left">Operator</th>
                            <th class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 text-center">Role</th>
                            <th class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 text-center">Status</th>
                            <th class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 text-right">Kelola</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#2a2a2a] lg:divide-[#1c1c1c] block lg:table-row-group">
                        ${users.map(u => {
                            const roleBadge = u.role === 'admin'
                                ? '<span class="px-2 py-0.5 rounded text-[10px] lg:max-xl:text-xs xl:text-base font-bold bg-[#2d1215] text-red-400 border border-red-900/30">Admin</span>'
                                : '<span class="px-2 py-0.5 rounded text-[10px] lg:max-xl:text-xs xl:text-base font-bold bg-[#171717] text-neutral-300 border border-[#262626]">Staff</span>';
                            const statusBadge = u.aktif
                                ? '<span class="inline-flex items-center gap-1.5 text-xs lg:max-xl:text-xs xl:text-base text-neutral-300"><span class="w-1.5 h-1.5 rounded bg-neutral-200"></span>Aktif</span>'
                                : '<span class="inline-flex items-center gap-1.5 text-xs lg:max-xl:text-xs xl:text-base text-neutral-500"><span class="w-1.5 h-1.5 rounded bg-neutral-700"></span>Nonaktif</span>';
                            return `
                                <tr class="hover:bg-[#121212] transition-colors block lg:table-row py-3 lg:py-0 border-b border-[#2a2a2a] last:border-b-0 lg:border-b-0">
                                    <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 block lg:table-cell">
                                        <div class="flex items-center gap-3">
                                            <div class="w-9 h-9 lg:max-xl:w-7 lg:max-xl:h-7 xl:w-9 xl:h-9 rounded bg-[#171717] border border-[#262626] flex items-center justify-center text-neutral-200 font-bold text-xs lg:max-xl:text-xs xl:text-base">${u.username.charAt(0).toUpperCase()}</div>
                                            <div>
                                                <div class="font-bold text-neutral-200 text-xs lg:max-xl:text-xs xl:text-base">${Utils.escapeHtml(u.username)}</div>
                                                <div class="text-[10px] lg:max-xl:text-[11px] xl:text-base text-neutral-500 font-mono">${Utils.escapeHtml(u.nama_lengkap || '-')}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 text-center flex lg:table-cell justify-between items-center border-t border-[#2a2a2a]/50 lg:border-t-0">
                                        <span class="text-[10px] lg:max-xl:text-xs xl:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Role</span>
                                        ${roleBadge}
                                    </td>
                                    <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 text-center flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] lg:max-xl:text-xs xl:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Status</span>
                                        ${statusBadge}
                                    </td>
                                    <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 text-right flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] lg:max-xl:text-xs xl:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Kelola</span>
                                        <div class="flex justify-end gap-2">
                                            <button onclick="User.edit(${u.id})" class="w-9 h-9 lg:max-xl:w-7 lg:max-xl:h-7 xl:w-9 xl:h-9 rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                            </button>
                                            <button onclick="User.delete(${u.id}, '${u.username}')" class="w-9 h-9 lg:max-xl:w-7 lg:max-xl:h-7 xl:w-9 xl:h-9 rounded bg-[#2d1215] border border-red-900/30 text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center">
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
            <div class="bg-[#0c0c0c] border border-[#222] rounded-xl p-5 md:p-6 max-w-lg lg:max-w-xl w-[calc(100%-2rem)] mx-auto md:w-full max-h-[90vh] overflow-y-auto scrollbar-thin my-auto shadow-2xl">
                <div class="flex items-center justify-between mb-5 pb-4 border-b border-[#222]">
                    <div>
                        <h3 class="text-sm lg:max-xl:text-sm xl:text-base font-bold text-neutral-100 uppercase tracking-wider">${isEdit ? 'Edit Akun Kasir / Admin' : 'Tambah User Kasir Baru'}</h3>
                        <p class="text-[10px] lg:max-xl:text-[11px] xl:text-xs text-neutral-500 mt-0.5">${isEdit ? 'Perbarui informasi dan hak akses pengguna' : 'Daftarkan staf kasir atau administrator sistem'}</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#141414] border border-[#262626] text-neutral-400 hover:text-white hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>
                <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div>
                            <label for="inp-user-username" class="block text-[10px] lg:max-xl:text-xs xl:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Username <span class="text-red-400">*</span></label>
                            <input type="text" id="inp-user-username" maxlength="30" minlength="3" placeholder="Contoh: kasir1" value="${userData ? Utils.escapeHtml(userData.username) : ''}" class="w-full px-3.5 py-2.5 bg-[#050505] border border-[#222] focus:border-neutral-500 rounded-lg text-xs lg:max-xl:text-xs xl:text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none transition-colors">
                            <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-normal font-sans">3 - 30 karakter (huruf, angka, _, -, .)</p>
                        </div>
                        <div>
                            <label for="inp-user-nama" class="block text-[10px] lg:max-xl:text-xs xl:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Nama Lengkap</label>
                            <input type="text" id="inp-user-nama" maxlength="100" placeholder="Contoh: John Doe" value="${userData ? Utils.escapeHtml(userData.nama_lengkap || '') : ''}" class="w-full px-3.5 py-2.5 bg-[#050505] border border-[#222] focus:border-neutral-500 rounded-lg text-xs lg:max-xl:text-xs xl:text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none transition-colors">
                            <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-normal font-sans">Opsional, maksimal 100 karakter</p>
                        </div>
                    </div>
                    <div>
                        <label for="inp-user-pass" class="block text-[10px] lg:max-xl:text-xs xl:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Password ${isEdit ? '' : '<span class="text-red-400">*</span>'}</label>
                        <input type="password" id="inp-user-pass" maxlength="32" minlength="6" placeholder="${isEdit ? '•••••••• (Biarkan kosong jika tidak diubah)' : 'Minimal 6 karakter'}" class="w-full px-3.5 py-2.5 bg-[#050505] border border-[#222] focus:border-neutral-500 rounded-lg text-xs lg:max-xl:text-xs xl:text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none transition-colors">
                        <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-normal font-sans">${isEdit ? 'Biarkan kosong jika tidak ingin mengubah (6 - 32 karakter)' : 'Minimal 6 karakter, maksimal 32 karakter'}</p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div>
                            <label for="inp-user-role" class="block text-[10px] lg:max-xl:text-xs xl:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Role Hak Akses</label>
                            <select id="inp-user-role" class="w-full px-3.5 py-2.5 bg-[#050505] border border-[#222] focus:border-neutral-500 rounded-lg text-xs lg:max-xl:text-xs xl:text-sm text-neutral-200 focus:outline-none transition-colors">
                                <option value="kasir" ${userData?.role === 'kasir' ? 'selected' : ''}>Staff Kasir</option>
                                <option value="admin" ${userData?.role === 'admin' ? 'selected' : ''}>Administrator</option>
                            </select>
                        </div>
                        <div>
                            <label for="inp-user-aktif" class="block text-[10px] lg:max-xl:text-xs xl:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Status Akun</label>
                            <select id="inp-user-aktif" class="w-full px-3.5 py-2.5 bg-[#050505] border border-[#222] focus:border-neutral-500 rounded-lg text-xs lg:max-xl:text-xs xl:text-sm text-neutral-200 focus:outline-none transition-colors">
                                <option value="true" ${userData?.aktif !== false ? 'selected' : ''}>Aktif (Dapat Login)</option>
                                <option value="false" ${userData?.aktif === false ? 'selected' : ''}>Nonaktif (Diblokir)</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#222]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#141414] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="User.addOrupdate()" class="px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                        ${isEdit ? '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Simpan Perubahan' : '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg> Daftarkan User'}
                    </button>
                </div>
            </div>`;
        Modal.show(modalHtml);
    },

    async addOrupdate() {
        const username = document.getElementById('inp-user-username').value.trim();
        const nama_lengkap = document.getElementById('inp-user-nama').value.trim();
        const password = document.getElementById('inp-user-pass').value;
        const role = document.getElementById('inp-user-role').value;
        const aktif = document.getElementById('inp-user-aktif').value === 'true';
        if (!username || (!this.editingId && !password)) return Toast.error("Username dan Password wajib diisi");
        if (!Utils.isValidUsername(username, 3, 30)) return Toast.error("Username harus 3 - 30 karakter (hanya huruf, angka, _, -, .)");
        if (password && !Utils.isValidPassword(password, 6, 32)) return Toast.error("Password harus 6 - 32 karakter");
        if (nama_lengkap && nama_lengkap.length > 100) return Toast.error("Nama lengkap maksimal 100 karakter");

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
        const message = `<div class="text-center"><p class="text-xs lg:max-xl:text-xs xl:text-sm text-neutral-300 font-semibold mb-1">Hapus akun <span class="text-neutral-100 font-bold font-mono">${Utils.escapeHtml(username)}</span>?</p><p class="text-[11px] lg:max-xl:text-[11px] xl:text-xs text-neutral-500">Semua hak akses akan dicabut secara permanen.</p></div>`;
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

/**
 * Modul Manajemen Plugins
 * Menangani fetch data, toggle status, dan upload ZIP.
 */
const PluginsModule = {
    init: function() {
        this.fetchPlugins();
    },

    fetchPlugins: async function() {
        try {
            const data = await API.request('/api/settings/plugins');
            
            if (data.success) {
                this.renderPlugins(data.plugins);
            } else {
                Toast.error('Gagal memuat plugins: ' + data.error);
            }
        } catch (e) {
            Toast.error('Gagal memuat plugins');
            const grid = document.getElementById('plugins-grid');
            if (grid) {
                grid.innerHTML = `
                    <div class="col-span-full py-12 flex flex-col items-center justify-center text-center border-2 border-red-500/20 border-dashed rounded-xl bg-red-500/5">
                        <svg class="w-10 h-10 text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <h3 class="text-sm font-semibold text-red-400">Terjadi Kesalahan</h3>
                        <p class="text-xs text-red-400/70 mt-1">Gagal memuat daftar plugin. Silakan periksa koneksi atau log server.</p>
                    </div>
                `;
            }
            console.error(e);
        }
    },

    renderPlugins: function(plugins) {
        const grid = document.getElementById('plugins-grid');
        
        if (!plugins || plugins.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-[#262626] rounded-xl bg-[#0a0a0a]">
                    <svg class="w-12 h-12 text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    <h3 class="text-base font-semibold text-neutral-300">Belum Ada Plugin</h3>
                    <p class="text-sm text-neutral-500 mt-1">Upload file .zip plugin untuk menambahkan fitur ke TMBilling.</p>
                </div>
            `;
            return;
        }

        let html = '';
        plugins.forEach(p => {
            const statusClass = p.enabled ? 'bg-green-500' : 'bg-neutral-500';
            const statusText = p.enabled ? 'Aktif' : 'Nonaktif';
            
            html += `
                <div class="bg-[#121212] border border-[#262626] rounded-xl p-5 hover:border-[#333] transition-colors flex flex-col h-full">
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-xl shrink-0">
                                ${p.icon || '🧩'}
                            </div>
                            <div>
                                <h3 class="font-bold text-white text-base leading-tight">${p.name}</h3>
                                <div class="text-xs text-neutral-500 font-mono mt-0.5">v${p.version || '1.0.0'}</div>
                            </div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer" ${p.enabled ? 'checked' : ''} onchange="PluginsModule.togglePlugin('${p.id}', this.checked)">
                            <div class="w-9 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <p class="text-sm text-neutral-400 mb-4 flex-1 line-clamp-3">${p.description || 'Tidak ada deskripsi'}</p>
                    
                    <div class="flex items-center justify-between pt-3 border-t border-[#262626] mt-auto">
                        <div class="text-xs text-neutral-500">By <span class="text-neutral-300">${p.author || 'TMBilling Team'}</span></div>
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full ${statusClass}"></span>
                            <span class="text-xs font-medium text-neutral-300">${statusText}</span>
                            ${p.enabled && !p.loaded ? '<span class="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 rounded ml-1" title="Restart diperlukan">!</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html;
    },

    togglePlugin: async function(pluginId, enabled) {
        try {
            const data = await API.request('/api/settings/plugins/toggle', {
                method: 'POST',
                body: JSON.stringify({ plugin_id: pluginId, enabled: enabled })
            });
            
            if (data.success) {
                document.getElementById('plugin-restart-alert').classList.remove('hidden');
                Toast.success('Status plugin diubah');
                // Refresh list
                this.fetchPlugins();
            } else {
                Toast.error('Gagal mengubah status: ' + data.error);
                this.fetchPlugins(); // Revert toggle visually
            }
        } catch (e) {
            Toast.error('Terjadi kesalahan jaringan');
            this.fetchPlugins();
            console.error(e);
        }
    },

    openUploadModal: function() {
        const modal = document.getElementById('upload-plugin-modal');
        const content = document.getElementById('upload-modal-content');
        modal.classList.remove('hidden');
        
        // Reset form
        document.getElementById('plugin-upload-form').reset();
        document.getElementById('file-name-display').textContent = 'Klik atau Drop file .zip ke sini';
        
        // Animate in
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);
    },

    closeUploadModal: function() {
        const modal = document.getElementById('upload-plugin-modal');
        const content = document.getElementById('upload-modal-content');
        
        // Animate out
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    },

    handleFileSelect: function(event) {
        const file = event.target.files[0];
        const display = document.getElementById('file-name-display');
        
        if (file) {
            if (!file.name.endsWith('.zip')) {
                Toast.error('Hanya file .zip yang diizinkan');
                event.target.value = '';
                display.textContent = 'Klik atau Drop file .zip ke sini';
                return;
            }
            display.textContent = file.name;
        } else {
            display.textContent = 'Klik atau Drop file .zip ke sini';
        }
    },

    submitUpload: async function(event) {
        event.preventDefault();
        
        const fileInput = document.getElementById('plugin-file');
        const file = fileInput.files[0];
        
        if (!file) {
            Toast.error('Pilih file plugin terlebih dahulu');
            return;
        }
        
        const btn = document.getElementById('btn-upload');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>Mengupload...</span>';
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const data = await API.request('/api/settings/plugins/upload', {
                method: 'POST',
                body: formData
            });
            
            if (data.success) {
                Toast.success(data.message);
                this.closeUploadModal();
                this.fetchPlugins();
                document.getElementById('plugin-restart-alert').classList.remove('hidden');
            } else {
                Toast.error('Upload gagal: ' + data.error);
            }
        } catch (e) {
            Toast.error('Gagal mengupload plugin');
            console.error(e);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    restartServer: async function() {
        if (!confirm('Peringatan: Tindakan ini akan merestart backend TMBilling. Apakah Anda yakin?')) return;
        
        try {
            const data = await API.request('/api/settings/scheduler/restart', {
                method: 'POST'
            });
            
            if (data.success) {
                Toast.success('Server sedang di-restart...');
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            } else {
                Toast.error('Gagal merestart: ' + data.error);
            }
        } catch (e) {
            Toast.error('Terjadi kesalahan saat memanggil restart');
            console.error(e);
        }
    }
};

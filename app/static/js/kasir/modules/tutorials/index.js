class MyUploadAdapter {
    constructor(loader) {
        this.loader = loader;
    }
    upload() {
        return this.loader.file.then(file => new Promise((resolve, reject) => {
            const data = new FormData();
            data.append('upload', file);
            API.request('/api/v1/kasir/tutorials/upload-image', {
                method: 'POST',
                body: data,
                headers: {} // Let browser set content-type with boundary
            }).then(res => {
                if (res.url) {
                    resolve({ default: res.url });
                } else {
                    reject(res.error || 'Upload error');
                }
            }).catch(err => reject(err));
        }));
    }
    abort() {}
}

function CustomUploadAdapterPlugin(editor) {
    editor.plugins.get('FileRepository').createUploadAdapter = (loader) => {
        return new MyUploadAdapter(loader);
    };
}

const Tutorials = {
    tutorialsData: [],
    activeTutorialCategory: 'Semua',
    ckeditorInstance: null,

    async load() {
        await this.loadTutorials();
    },

    async loadTutorials() {
        try {
            const res = await API.request('/api/v1/kasir/tutorials');
            if (res.success) {
                this.tutorialsData = res.tutorials || [];
                this.renderTutorialsList();
            }
        } catch (err) {
            Toast.error('Gagal memuat daftar panduan: ' + err.message);
        }
    },

    filterTutorials(category, btnEl) {
        this.activeTutorialCategory = category;
        document.querySelectorAll('.tutorial-cat-btn').forEach(btn => {
            btn.className = 'tutorial-cat-btn px-4 py-2 bg-[#0c0c0c] text-neutral-400 hover:text-white font-bold text-xs lg:text-base rounded transition-all border border-[#1c1c1c]';
        });
        if (btnEl) {
            btnEl.className = 'tutorial-cat-btn px-4 py-2 bg-neutral-800 text-white font-bold text-xs lg:text-base rounded transition-all border border-[#262626]';
        }
        this.renderTutorialsList();
    },

    renderTutorialsList() {
        const container = document.getElementById('tutorials-container');
        if (!container) return;

        let filtered = this.tutorialsData;
        if (this.activeTutorialCategory !== 'Semua') {
            filtered = filtered.filter(t => t.category.toLowerCase().includes(this.activeTutorialCategory.toLowerCase()));
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-12 text-center text-neutral-500">
                    <span class="text-4xl block mb-2">📭</span>
                    <p class="font-bold text-xs lg:text-base">Belum ada panduan untuk kategori ini.</p>
                </div>
            `;
            return;
        }

        const isAdmin = App.user && App.user.role === 'admin';

        container.innerHTML = filtered.map(t => `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 space-y-4 shadow-lg hover:border-[#262626] transition-all">
                <div class="flex items-center justify-between border-b border-[#1c1c1c] pb-4">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">${t.icon || '🌐'}</span>
                        <div>
                            <h4 class="text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider">${t.title}</h4>
                            <span class="inline-block mt-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-neutral-900 border border-[#262626] text-neutral-400">
                                ${t.category}
                            </span>
                        </div>
                    </div>
                    ${isAdmin ? `
                    <div class="flex items-center gap-2">
                        <button onclick="Tutorials.openTutorialModal(${t.id})" class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs lg:text-base font-bold rounded transition-colors border border-[#262626]">
                            ✏️ Edit
                        </button>
                        <button onclick="Tutorials.deleteTutorial(${t.id})" class="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 text-xs lg:text-base font-bold rounded transition-colors border border-rose-900/50">
                            🗑️ Hapus
                        </button>
                    </div>
                    ` : ''}
                </div>
                <div class="prose prose-invert max-w-none text-xs lg:text-base text-neutral-300 leading-relaxed overflow-x-auto">
                    ${t.content}
                </div>
            </div>
        `).join('');
    },

    async openTutorialModal(id = null) {
        const modal = document.getElementById('modal-tutorial-editor');
        if (!modal) return;

        document.getElementById('tutorial-id-input').value = id || '';
        document.getElementById('tutorial-title-input').value = '';
        document.getElementById('tutorial-icon-input').value = '🌐';
        document.getElementById('tutorial-category-input').value = 'Umum';
        document.getElementById('tutorial-urutan-input').value = 0;

        let contentHtml = '';
        if (id) {
            const tut = this.tutorialsData.find(t => t.id === id);
            if (tut) {
                document.getElementById('tutorial-title-input').value = tut.title;
                document.getElementById('tutorial-icon-input').value = tut.icon || '🌐';
                document.getElementById('tutorial-category-input').value = tut.category || 'Umum';
                document.getElementById('tutorial-urutan-input').value = tut.urutan || 0;
                contentHtml = tut.content || '';
            }
        }

        modal.classList.remove('hidden');

        // Init CKEditor 5 Classic with local image upload adapter
        if (typeof ClassicEditor !== 'undefined') {
            if (this.ckeditorInstance) {
                this.ckeditorInstance.setData(contentHtml);
            } else {
                try {
                    const editorEl = document.querySelector('#tutorial-content-editor');
                    if (editorEl) {
                        this.ckeditorInstance = await ClassicEditor.create(editorEl, {
                            extraPlugins: [CustomUploadAdapterPlugin],
                            toolbar: [
                                'heading', '|', 'bold', 'italic', 'underline', 'strikethrough', 'highlight', '|', 'alignment', 'link', 'bulletedList', 'numberedList', 'blockQuote', 'codeBlock', 'insertTable', 'imageUpload', '|', 'undo', 'redo'
                            ],
                            alignment: {
                                options: [ 'left', 'center', 'right', 'justify' ]
                            }
                        });
                        this.ckeditorInstance.setData(contentHtml);
                    }
                } catch (e) {
                    console.error('Error init CKEditor 5:', e);
                }
            }
        } else {
            const textarea = document.getElementById('tutorial-content-editor');
            if (textarea) textarea.value = contentHtml;
        }
    },

    closeTutorialModal() {
        const modal = document.getElementById('modal-tutorial-editor');
        if (modal) modal.classList.add('hidden');
    },

    async saveTutorial() {
        const id = document.getElementById('tutorial-id-input').value;
        const title = document.getElementById('tutorial-title-input').value.trim();
        const icon = document.getElementById('tutorial-icon-input').value.trim() || '🌐';
        const category = document.getElementById('tutorial-category-input').value.trim() || 'Umum';
        const urutan = parseInt(document.getElementById('tutorial-urutan-input').value) || 0;

        let content = '';
        if (this.ckeditorInstance) {
            content = this.ckeditorInstance.getData();
        } else {
            content = document.getElementById('tutorial-content-editor').value;
        }

        if (!title || !content) {
            Toast.error('Judul dan isi panduan wajib diisi');
            return;
        }

        const payload = { title, icon, category, urutan, content };

        try {
            const url = id ? `/api/v1/kasir/tutorials/${id}` : '/api/v1/kasir/tutorials';
            const method = id ? 'PUT' : 'POST';

            const res = await API.request(url, {
                method: method,
                body: JSON.stringify(payload)
            });

            if (res.success) {
                Toast.success(res.message);
                this.closeTutorialModal();
                await this.loadTutorials();
            } else {
                Toast.error(res.error || 'Gagal menyimpan panduan');
            }
        } catch (err) {
            Toast.error('Error menyimpan panduan: ' + err.message);
        }
    },

    async deleteTutorial(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus panduan ini?')) return;

        try {
            const res = await API.request(`/api/v1/kasir/tutorials/${id}`, {
                method: 'DELETE'
            });

            if (res.success) {
                Toast.success(res.message);
                await this.loadTutorials();
            } else {
                Toast.error(res.error || 'Gagal menghapus panduan');
            }
        } catch (err) {
            Toast.error('Error menghapus panduan: ' + err.message);
        }
    }
};

window.Tutorials = Tutorials;

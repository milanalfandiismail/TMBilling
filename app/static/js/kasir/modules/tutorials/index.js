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
    selectedTutorialId: null,
    ckeditorInstance: null,

    async load() {
        await this.loadTutorials();
    },

    async loadTutorials() {
        try {
            const res = await API.request('/api/v1/kasir/tutorials');
            if (res.success) {
                this.tutorialsData = res.tutorials || [];
                // Auto select first tutorial if not set
                if (!this.selectedTutorialId && this.tutorialsData.length > 0) {
                    this.selectedTutorialId = this.tutorialsData[0].id;
                }
                this.renderTutorialsList();
            }
        } catch (err) {
            Toast.error('Gagal memuat daftar panduan: ' + err.message);
        }
    },

    selectTutorial(id) {
        this.selectedTutorialId = id;
        this.renderTutorialsList();
    },

    renderTutorialsList() {
        this.renderSidebar();
        this.renderActiveTutorial();
    },

    renderSidebar() {
        const sidebar = document.getElementById('wiki-sidebar');
        if (!sidebar) return;

        // Group by category
        const catMap = {};
        this.tutorialsData.forEach(t => {
            const cat = t.category || 'Kosong';
            if (!catMap[cat]) catMap[cat] = [];
            catMap[cat].push(t);
        });

        const categories = Object.keys(catMap).sort();
        const isAdmin = App.user && App.user.role === 'admin';

        let html = '';
        categories.forEach(cat => {
            const items = catMap[cat];
            const icon = cat === 'Kosong' ? '📁' : '⚙️';
            
            html += `
                <div class="space-y-2">
                    <div class="group flex items-center justify-between px-2 pb-1 border-b border-[#1c1c1c]">
                        <span class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">${icon} ${cat}</span>
                        ${isAdmin && cat !== 'Kosong' ? `
                        <button onclick="Tutorials.deleteCategory('${cat}')"
                            title="Hapus Kategori '${cat}'"
                            class="opacity-0 group-hover:opacity-100 text-[10px] text-neutral-500 hover:text-rose-400 transition-opacity">
                            🗑️
                        </button>
                        ` : ''}
                    </div>
                    <div class="space-y-1 pl-1">
                        ${items.map(t => {
                            const isActive = t.id === this.selectedTutorialId;
                            return `
                                <button onclick="Tutorials.selectTutorial(${t.id})"
                                    class="w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        isActive
                                            ? 'bg-neutral-800 text-white border border-[#262626]'
                                            : 'text-neutral-400 hover:bg-neutral-900/60 hover:text-white border border-transparent'
                                    }">
                                    ${t.icon || '🌐'} ${t.title}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });

        sidebar.innerHTML = html;
    },

    renderActiveTutorial() {
        const area = document.getElementById('wiki-reader-area');
        if (!area) return;

        const tutorial = this.tutorialsData.find(t => t.id === this.selectedTutorialId);
        const isAdmin = App.user && App.user.role === 'admin';

        if (!tutorial) {
            area.innerHTML = `
                <div class="flex-1 flex flex-col items-center justify-center text-center p-12 text-neutral-500">
                    <span class="text-5xl block mb-3">📖</span>
                    <h4 class="font-bold text-base text-neutral-400">Pilih Panduan Untuk Dibaca</h4>
                    <p class="text-xs text-neutral-600 mt-1 max-w-sm">Klik salah satu panduan di sidebar kiri untuk melihat petunjuk penggunaan lengkap.</p>
                </div>
            `;
            return;
        }

        area.innerHTML = `
            <div class="space-y-6">
                <!-- Reader Header -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1c1c1c] pb-5">
                    <div class="flex items-center gap-3">
                        <span class="text-3xl lg:text-4xl p-2.5 bg-neutral-900 border border-[#262626] rounded-xl">${tutorial.icon || '🌐'}</span>
                        <div>
                            <span class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">${tutorial.category}</span>
                            <h2 class="text-base lg:text-2xl font-bold text-neutral-100 tracking-wide mt-0.5">${tutorial.title}</h2>
                        </div>
                    </div>

                    ${isAdmin ? `
                    <div class="flex items-center gap-2 shrink-0">
                        <button onclick="Tutorials.openTutorialModal(${tutorial.id})" class="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-lg transition-all border border-[#262626] flex items-center gap-1.5">
                            <span>✏️</span> Edit
                        </button>
                        <button onclick="Tutorials.deleteTutorial(${tutorial.id})" class="px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 text-xs font-bold rounded-lg transition-all border border-rose-900/50 flex items-center gap-1.5">
                            <span>🗑️</span> Hapus
                        </button>
                    </div>
                    ` : ''}
                </div>

                <!-- Reader Content -->
                <div class="prose prose-invert max-w-none text-xs lg:text-base text-neutral-300 leading-relaxed overflow-x-auto">
                    ${tutorial.content}
                </div>
            </div>
        `;
    },

    async deleteCategory(categoryName) {
        if (!confirm(`Apakah Anda yakin ingin menghapus kategori '${categoryName}'?\nSemua panduan dalam kategori ini akan dipindahkan ke kategori 'Kosong'.`)) {
            return;
        }

        try {
            const res = await API.request(`/api/v1/kasir/tutorials/categories/${encodeURIComponent(categoryName)}`, {
                method: 'DELETE'
            });

            if (res.success) {
                Toast.success(res.message);
                this.selectedTutorialId = null;
                await this.loadTutorials();
            } else {
                Toast.error(res.error || 'Gagal menghapus kategori');
            }
        } catch (err) {
            Toast.error('Error menghapus kategori: ' + err.message);
        }
    },

    handleCategorySelectChange(val) {
        const newInp = document.getElementById('tutorial-new-category-input');
        if (newInp) {
            if (val === '__NEW__') {
                newInp.classList.remove('hidden');
                newInp.value = '';
                newInp.focus();
            } else {
                newInp.classList.add('hidden');
            }
        }
    },

    async loadCategories(selectedCategory = 'Umum') {
        try {
            const res = await API.request('/api/v1/kasir/tutorials/categories');
            const select = document.getElementById('tutorial-category-select');
            const newInp = document.getElementById('tutorial-new-category-input');
            if (select && newInp) {
                const categories = res.categories || ['Umum'];
                select.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('') +
                    '<option value="__NEW__">➕ Tambah Kategori Baru...</option>';
                
                if (categories.includes(selectedCategory)) {
                    select.value = selectedCategory;
                    newInp.classList.add('hidden');
                } else {
                    select.value = '__NEW__';
                    newInp.classList.remove('hidden');
                    newInp.value = selectedCategory;
                }
            }
        } catch (e) {
            console.error('Error fetching categories:', e);
        }
    },

    async openTutorialModal(id = null) {
        const modal = document.getElementById('modal-tutorial-editor');
        if (!modal) return;

        document.getElementById('tutorial-id-input').value = id || '';
        document.getElementById('tutorial-title-input').value = '';
        document.getElementById('tutorial-icon-input').value = '🌐';
        document.getElementById('tutorial-urutan-input').value = 0;

        let contentHtml = '';
        let categoryVal = 'Umum';
        if (id) {
            const tut = this.tutorialsData.find(t => t.id === id);
            if (tut) {
                document.getElementById('tutorial-title-input').value = tut.title;
                document.getElementById('tutorial-icon-input').value = tut.icon || '🌐';
                document.getElementById('tutorial-urutan-input').value = tut.urutan || 0;
                categoryVal = tut.category || 'Umum';
                contentHtml = tut.content || '';
            }
        }

        await this.loadCategories(categoryVal);
        modal.classList.remove('hidden');

        if (typeof ckeditor5 !== 'undefined') {
            window.ClassicEditor = ckeditor5.ClassicEditor;
        }

        if (typeof ClassicEditor !== 'undefined') {
            if (this.ckeditorInstance) {
                this.ckeditorInstance.setData(contentHtml);
            } else {
                try {
                    const editorEl = document.querySelector('#tutorial-content-editor');
                    if (editorEl) {
                        const plugins = typeof ckeditor5 !== 'undefined' ? [
                            ckeditor5.Essentials, ckeditor5.Paragraph, ckeditor5.Heading,
                            ckeditor5.Bold, ckeditor5.Italic, ckeditor5.Underline, ckeditor5.Strikethrough,
                            ckeditor5.Alignment, ckeditor5.FontColor, ckeditor5.FontBackgroundColor,
                            ckeditor5.FontSize, ckeditor5.FontFamily, ckeditor5.Highlight,
                            ckeditor5.Link, ckeditor5.List, ckeditor5.TodoList,
                            ckeditor5.Indent, ckeditor5.IndentBlock, ckeditor5.BlockQuote, ckeditor5.CodeBlock,
                            ckeditor5.Table, ckeditor5.TableToolbar, ckeditor5.TableProperties, ckeditor5.TableCellProperties,
                            ckeditor5.Image, ckeditor5.ImageToolbar, ckeditor5.ImageCaption, ckeditor5.ImageStyle,
                            ckeditor5.ImageUpload, ckeditor5.ImageResize, ckeditor5.Undo,
                            CustomUploadAdapterPlugin
                        ] : [CustomUploadAdapterPlugin];

                        this.ckeditorInstance = await ClassicEditor.create(editorEl, {
                            plugins: plugins,
                            toolbar: {
                                items: [
                                    'heading', '|',
                                    'bold', 'italic', 'underline', 'strikethrough', 'highlight', '|',
                                    'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor', '|',
                                    'alignment', 'link', 'bulletedList', 'numberedList', 'todoList', 'outdent', 'indent', '|',
                                    'blockQuote', 'codeBlock', 'insertTable', 'imageUpload', '|',
                                    'undo', 'redo'
                                ],
                                shouldNotGroupWhenFull: true
                            },
                            fontFamily: {
                                options: [
                                    'default',
                                    'Inter, sans-serif',
                                    'Roboto, sans-serif',
                                    'Arial, Helvetica, sans-serif',
                                    'Courier New, Courier, monospace',
                                    'Georgia, serif',
                                    'Tahoma, Geneva, sans-serif',
                                    'Times New Roman, Times, serif',
                                    'Verdana, Geneva, sans-serif'
                                ],
                                supportAllValues: true
                            },
                            fontSize: {
                                options: [ 9, 11, 12, 14, 'default', 18, 20, 24, 28, 32 ],
                                supportAllValues: true
                            },
                            alignment: {
                                options: [ 'left', 'center', 'right', 'justify' ]
                            },
                            image: {
                                toolbar: [
                                    'imageStyle:inline',
                                    'imageStyle:block',
                                    'imageStyle:side',
                                    '|',
                                    'toggleImageCaption',
                                    'imageTextAlternative',
                                    '|',
                                    'resizeImage'
                                ]
                            },
                            table: {
                                contentToolbar: [
                                    'tableColumn', 'tableRow', 'mergeTableCells',
                                    'tableProperties', 'tableCellProperties'
                                ]
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

    async exportTutorialsToJson() {
        if (!confirm('Apakah Anda yakin ingin mengekspor seluruh tutorial saat ini ke seed_tutorials.json?')) {
            return;
        }
        try {
            const res = await API.request('/api/v1/kasir/tutorials/export-json', {
                method: 'POST'
            });
            if (res.success) {
                showToast(`Sukses: ${res.message || 'Tutorial berhasil diekspor!'}`, 'success');
            } else {
                showToast(`Gagal: ${res.error || 'Gagal mengekspor tutorial'}`, 'error');
            }
        } catch (e) {
            console.error('Error export tutorials:', e);
            showToast('Terjadi kesalahan sistem saat mengekspor tutorial.', 'error');
        }
    },

    closeTutorialModal() {
        const modal = document.getElementById('modal-tutorial-editor');
        if (modal) modal.classList.add('hidden');
        // Bersihkan gambar sementara di folder temp
        API.request('/api/v1/kasir/tutorials/cleanup-temp', { method: 'POST' }).catch(() => {});
    },

    async saveTutorial() {
        const id = document.getElementById('tutorial-id-input').value;
        const title = document.getElementById('tutorial-title-input').value.trim();
        const icon = document.getElementById('tutorial-icon-input').value.trim() || '🌐';
        const categorySelect = document.getElementById('tutorial-category-select').value;
        let category = 'Umum';
        if (categorySelect === '__NEW__') {
            category = document.getElementById('tutorial-new-category-input').value.trim() || 'Umum';
        } else {
            category = categorySelect;
        }
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
                if (this.selectedTutorialId === id) {
                    this.selectedTutorialId = null;
                }
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

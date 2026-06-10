// app/static/js/kasir/modules/menu/index.js

const Menu = {
    items: [],
    cart: [], // Array of { menu: MenuItem, jumlah: number }

    async load() {
        try {
            await this.loadCatalog();
            await this.loadPCList();
        } catch (error) {
            console.error("Gagal inisialisasi modul menu:", error);
        }
    },

    async loadCatalog() {
        const grid = document.getElementById("menu-catalog-grid");
        if (!grid) return;

        try {
            const res = await window.API.menu.list();
            if (res.success) {
                this.items = res.data;
                this.renderCatalog(this.items);
            } else {
                Toast.error(res.error || "Gagal memuat katalog menu");
            }
        } catch (error) {
            Toast.error("Koneksi gagal memuat katalog menu");
            grid.innerHTML = `<div class="col-span-full text-center py-20 text-red-400 text-xs font-semibold">Gagal memuat data menu.</div>`;
        }
    },

    async loadPCList() {
        const select = document.getElementById("menu-order-pc-select");
        if (!select) return;

        try {
            const res = await window.API.dashboard.pcList();
            if (res.success) {
                // Bersihkan dropdown kecuali pilihan default
                select.innerHTML = '<option value="">-- Take Away / Mandiri --</option>';
                res.data.forEach(pc => {
                    // Hanya tampilkan PC yang online / sedang aktif bermain
                    if (pc.online || pc.status === 'aktif') {
                        const option = document.createElement("option");
                        option.value = pc.kode;
                        option.textContent = `${pc.kode} (${pc.pc_nama || 'User'})`;
                        select.appendChild(option);
                    }
                });
            }
        } catch (error) {
            console.error("Gagal memuat daftar PC untuk order menu:", error);
        }
    },

    renderCatalog(data) {
        const grid = document.getElementById("menu-catalog-grid");
        if (!grid) return;

        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-20 text-neutral-500">
                    <p class="text-xs font-bold">Belum ada menu di katalog</p>
                    <p class="text-[10px] text-neutral-600 mt-1">Klik 'Tambah Menu' untuk membuat makanan/minuman baru</p>
                </div>`;
            return;
        }

        grid.innerHTML = data.map(m => {
            const isUnlimited = m.stok < 0;
            const isOutOfStock = !isUnlimited && m.stok <= 0;
            const imgHtml = m.gambar_path 
                ? `<img src="${m.gambar_path}" alt="${m.nama}" class="w-full h-24 object-cover rounded-lg border border-[#1f1f1f] bg-[#0c0c0c]">`
                : `<div class="w-full h-24 rounded-lg border border-[#1f1f1f] bg-[#080808] flex items-center justify-center text-neutral-600">
                     <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path>
                     </svg>
                   </div>`;

            const btnHtml = isOutOfStock
                ? `<button disabled class="w-full py-1.5 rounded bg-neutral-900 border border-[#1c1c1c] text-[10px] text-neutral-600 font-bold uppercase cursor-not-allowed">Stok Habis</button>`
                : `<button onclick="Menu.addToCart(${m.id})" class="w-full py-1.5 rounded bg-neutral-100 hover:bg-white text-[#050505] text-[10px] font-bold uppercase transition-colors">Tambah</button>`;

            const stokText = isUnlimited ? 'Unlimited' : `Stok: ${m.stok}`;
            const stokColor = isUnlimited ? 'text-green-500 font-bold' : (m.stok < 5 ? 'text-amber-500 font-bold' : 'text-neutral-500');

            return `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] hover:border-[#2a2a2a] transition-all rounded-xl p-3 flex flex-col justify-between group relative">
                    <!-- CRUD Quick Actions -->
                    <div class="absolute top-2.5 right-2.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="Menu.showEditModal(${m.id})" class="p-1 rounded bg-black/60 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-[#2a2a2a] transition-colors" title="Edit Menu">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onclick="Menu.deleteItem(${m.id}, '${m.nama}')" class="p-1 rounded bg-black/60 hover:bg-red-950 text-neutral-400 hover:text-red-400 border border-[#2a2a2a] hover:border-red-900 transition-colors" title="Hapus Menu">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>

                    <div class="space-y-2.5">
                        ${imgHtml}
                        <div>
                            <h4 class="text-xs font-bold text-neutral-100 truncate">${m.nama}</h4>
                            <div class="flex items-center justify-between mt-1">
                                <span class="text-xs text-neutral-300 font-bold font-mono">Rp ${m.harga.toLocaleString('id-ID')}</span>
                                <span class="text-[9px] ${stokColor} font-mono">${stokText}</span>
                            </div>
                        </div>
                    </div>
                    <div class="mt-3">
                        ${btnHtml}
                    </div>
                </div>`;
        }).join('');
    },

    filterCatalog() {
        const query = document.getElementById("menu-search-input")?.value?.toLowerCase() || "";
        const filtered = this.items.filter(m => m.nama.toLowerCase().includes(query));
        this.renderCatalog(filtered);
    },

    addToCart(menuId) {
        const menu = this.items.find(m => m.id === menuId);
        if (!menu) return;

        const cartItem = this.cart.find(c => c.menu.id === menuId);
        if (cartItem) {
            const isUnlimited = menu.stok < 0;
            if (!isUnlimited && cartItem.jumlah >= menu.stok) {
                Toast.error(`Stok '${menu.nama}' tidak mencukupi untuk ditambah lagi`);
                return;
            }
            cartItem.jumlah++;
        } else {
            this.cart.push({ menu, jumlah: 1 });
        }

        Toast.success(`'${menu.nama}' dimasukkan ke keranjang`);
        this.renderCart();
    },

    removeFromCart(menuId) {
        this.cart = this.cart.filter(c => c.menu.id !== menuId);
        this.renderCart();
    },

    updateCartQty(menuId, newQty) {
        const cartItem = this.cart.find(c => c.menu.id === menuId);
        if (!cartItem) return;

        newQty = parseInt(newQty) || 0;
        if (newQty <= 0) {
            this.removeFromCart(menuId);
            return;
        }

        const isUnlimited = cartItem.menu.stok < 0;
        if (!isUnlimited && newQty > cartItem.menu.stok) {
            Toast.error(`Stok '${cartItem.menu.nama}' hanya tersedia ${cartItem.menu.stok}`);
            cartItem.jumlah = cartItem.menu.stok;
        } else {
            cartItem.jumlah = newQty;
        }

        this.renderCart();
    },

    renderCart() {
        const container = document.getElementById("menu-cart-items");
        const totalEl = document.getElementById("menu-cart-total");
        if (!container || !totalEl) return;

        if (this.cart.length === 0) {
            container.innerHTML = `<div class="text-center py-10 text-neutral-600 text-xs">Keranjang masih kosong</div>`;
            totalEl.textContent = "Rp 0";
            return;
        }

        let total = 0;
        container.innerHTML = this.cart.map(c => {
            const itemTotal = c.menu.harga * c.jumlah;
            total += itemTotal;

            return `
                <div class="flex items-center justify-between gap-3 bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-2.5">
                    <div class="min-w-0 flex-1">
                        <h5 class="text-xs font-bold text-neutral-200 truncate">${c.menu.nama}</h5>
                        <span class="text-[10px] text-neutral-500 font-mono">Rp ${c.menu.harga.toLocaleString('id-ID')}</span>
                    </div>
                    
                    <div class="flex items-center gap-1 shrink-0">
                        <button onclick="Menu.updateCartQty(${c.menu.id}, ${c.jumlah - 1})" 
                            class="w-5 h-5 bg-[#161616] hover:bg-[#222] border border-[#262626] rounded flex items-center justify-center text-xs font-bold text-neutral-400 hover:text-white transition-colors">-</button>
                        <input type="number" value="${c.jumlah}" 
                            onchange="Menu.updateCartQty(${c.menu.id}, this.value)"
                            class="w-8 text-center text-xs font-mono font-bold py-0.5 bg-black border border-[#262626] rounded focus:outline-none">
                        <button onclick="Menu.updateCartQty(${c.menu.id}, ${c.jumlah + 1})" 
                            class="w-5 h-5 bg-[#161616] hover:bg-[#222] border border-[#262626] rounded flex items-center justify-center text-xs font-bold text-neutral-400 hover:text-white transition-colors">+</button>
                    </div>

                    <div class="text-right shrink-0">
                        <div class="text-xs font-mono font-bold text-neutral-200">Rp ${itemTotal.toLocaleString('id-ID')}</div>
                        <button onclick="Menu.removeFromCart(${c.menu.id})" class="text-[9px] text-red-500 hover:text-red-400 font-semibold mt-0.5">Hapus</button>
                    </div>
                </div>`;
        }).join('');

        totalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    },

    async checkout() {
        if (this.cart.length === 0) {
            Toast.error("Keranjang belanja kosong!");
            return;
        }

        const pcSelect = document.getElementById("menu-order-pc-select");
        const pcKode = pcSelect?.value || null;

        const cartItems = this.cart.map(c => ({
            menu_id: c.menu.id,
            jumlah: c.jumlah
        }));

        // Generate dynamic items list for confirmation dialog
        let total = 0;
        const itemsListHtml = this.cart.map(c => {
            const subtotal = c.menu.harga * c.jumlah;
            total += subtotal;
            const formattedPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(subtotal);
            return `<li>${c.menu.nama} x${c.jumlah} (${formattedPrice})</li>`;
        }).join('');

        const targetDest = pcKode ? `PC: ${pcKode}` : 'Take Away / Mandiri';
        const formattedTotal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total);

        const msg = `
            Apakah Anda yakin ingin memproses transaksi F&B berikut?
            <ul class="list-disc list-inside mt-2 text-neutral-300 font-mono text-[11px] space-y-1">
                ${itemsListHtml}
            </ul>
            <div class="mt-3 text-neutral-300 text-xs border-t border-[#222] pt-2">
                Tujuan: <strong>${targetDest}</strong><br>
                Total: <strong class="text-emerald-400">${formattedTotal}</strong>
            </div>
        `;

        Modal.confirm(msg, async () => {
            try {
                const res = await window.API.menu.checkout(cartItems, pcKode);
                if (res.success) {
                    Toast.success("Penjualan F&B berhasil diproses!");
                    this.cart = [];
                    this.renderCart();
                    await this.loadCatalog(); // Reload catalog to update stock numbers

                    // Prompt to print receipt
                    if (res.data && res.data.length > 0) {
                        Modal.confirm("Transaksi F&B berhasil diproses. Apakah Anda ingin mencetak struk?", () => {
                            res.data.forEach(tm => {
                                const strukData = {
                                    no_nota: tm.no_nota,
                                    tanggal: tm.tanggal,
                                    pc_kode: tm.pc_kode || "-",
                                    tipe: "kantin",
                                    nama_pelanggan: "Pelanggan POS",
                                    rincian: [{ keterangan: tm.menu_nama, durasi: tm.jumlah, harga: tm.total_harga }],
                                    total_durasi: tm.jumlah,
                                    total_harga: tm.total_harga,
                                    kasir: tm.kasir_nama
                                };
                                StrukPreview.currentData = strukData;
                                StrukPreview.printPreview();
                            });
                        });
                    }
                } else {
                    Toast.error(res.error || "Gagal memproses checkout");
                }
            } catch (error) {
                Toast.error("Gagal checkout: error koneksi");
            }
        });
    },

    // =========================================================================
    // CRUD MODAL & FORM METHODS
    // =========================================================================

    showAddModal() {
        const modal = document.getElementById("menu-modal");
        const title = document.getElementById("menu-modal-title");
        const form = document.getElementById("menu-form");
        if (!modal || !title || !form) return;

        form.reset();
        document.getElementById("menu-id-input").value = "";
        document.getElementById("menu-file-name").textContent = "Belum ada gambar terpilih";
        title.textContent = "Tambah Item Baru";
        modal.classList.remove("hidden");
    },

    showEditModal(menuId) {
        event.stopPropagation(); // Mencegah klik di card
        const menu = this.items.find(m => m.id === menuId);
        if (!menu) return;

        const modal = document.getElementById("menu-modal");
        const title = document.getElementById("menu-modal-title");
        if (!modal || !title) return;

        document.getElementById("menu-id-input").value = menu.id;
        document.getElementById("menu-nama-input").value = menu.nama;
        document.getElementById("menu-harga-input").value = menu.harga;
        document.getElementById("menu-stok-input").value = menu.stok;
        document.getElementById("menu-file-name").textContent = menu.gambar_path 
            ? menu.gambar_path.split("/").pop()
            : "Belum ada gambar terpilih";

        title.textContent = "Edit Item Menu";
        modal.classList.remove("hidden");
    },

    closeModal() {
        const modal = document.getElementById("menu-modal");
        if (modal) modal.classList.add("hidden");
    },

    handleFileSelect(event) {
        const file = event.target.files[0];
        const label = document.getElementById("menu-file-name");
        if (label && file) {
            label.textContent = file.name;
        }
    },

    async submitForm(event) {
        event.preventDefault();
        
        const menuId = document.getElementById("menu-id-input").value;
        const nama = document.getElementById("menu-nama-input").value.trim();
        const harga = document.getElementById("menu-harga-input").value;
        const stok = document.getElementById("menu-stok-input").value;
        const gambarInput = document.getElementById("menu-gambar-input");
        const file = gambarInput?.files[0];

        const formData = new FormData();
        formData.append("nama", nama);
        formData.append("harga", harga);
        formData.append("stok", stok);
        if (file) {
            formData.append("gambar", file);
        }

        try {
            let res;
            if (menuId) {
                res = await window.API.menu.update(menuId, formData);
            } else {
                res = await window.API.menu.create(formData);
            }

            if (res.success) {
                Toast.success(res.message || "Menu berhasil disimpan");
                this.closeModal();
                await this.loadCatalog();
            } else {
                Toast.error(res.error || "Gagal menyimpan menu");
            }
        } catch (error) {
            Toast.error("Gagal menyimpan menu: error koneksi");
        }
    },

    async deleteItem(menuId, nama) {
        event.stopPropagation(); // Mencegah klik di card
        if (!confirm(`Apakah Anda yakin ingin menghapus menu '${nama}' dari katalog?`)) {
            return;
        }

        try {
            const res = await window.API.menu.delete(menuId);
            if (res.success) {
                Toast.success(res.message || "Menu berhasil dihapus");
                await this.loadCatalog();
                // Hapus dari keranjang jika ada
                this.removeFromCart(menuId);
            } else {
                Toast.error(res.error || "Gagal menghapus menu");
            }
        } catch (error) {
            Toast.error("Gagal menghapus menu: error koneksi");
        }
    }
};

window.Menu = Menu;

// map_view.js — Floor Plan / Map View dashboard PC
// pos_x=-1 & pos_y=-1 = unmapped (0-indexed). pos_x=0 = kolom 1, pos_y=0 = baris 1.
// Grid size strict: atur Kolom/Baris di modal, langsung fix ukuran.

const MapView = {
    cellW: 120,
    cellH: 90,
    editorCellW: 80,
    editorCellH: 60,
    _selectedPcId: null,
    _editorGrup: '',

    _getGridSize: function(grup) {
        try {
            var s = localStorage.getItem('map_grid_'+grup);
            if (s) { var p = JSON.parse(s); return { cols: p.c||10, rows: p.r||7 }; }
        } catch(e) {}
        return { cols: 10, rows: 7 };
    },

    _setGridSize: function(grup, cols, rows) {
        try { localStorage.setItem('map_grid_'+grup, JSON.stringify({c:cols,r:rows})); } catch(e) {}
    },

    // =========================================================================
    // DASHBOARD MAP VIEW — dot + text, no card mini
    // =========================================================================

    // Map View render methods removed. Editor remains.


    // =========================================================================
    // EDIT MODAL — pilih PC, klik cell
    // =========================================================================

    openEditor: function(grup) {
        if (!this._isAdmin()) return;
        var data = (window.Dashboard && window.Dashboard.lastData) || null;
        if (!data) return;
        var pcs = (data.by_grup[grup]||[]).slice();
        var gs = this._getGridSize(grup);
        this._editorGrup = grup;
        this._selectedPcId = null;

        var cols = gs.cols, rows = gs.rows;
        var cw = cols*this.editorCellW, ch = rows*this.editorCellH;
        var self = this;

        // Sidebar
        var sidebarHtml = pcs.map(function(pc){
            var s = self._state(pc);
            var onG = (pc.pos_x>=0)&&(pc.pos_y>=0);
            return '<div class="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-[#1a1a1a] text-xs lg:text-base text-neutral-300 font-semibold transition-colors select-none sidebar-pc-item"'
                +' data-pc-id="'+pc.id+'" data-pc-kode="'+self._esc(pc.kode)+'"'
                +' onclick="MapView._selectPc('+pc.id+',this)"'
                +' oncontextmenu="MapView._editCtx(event,'+pc.id+',\''+self._esc(pc.kode)+'\')">'
                +'<span class="w-2.5 h-2.5 rounded-full shrink-0 '+s.dot+'"></span>'+self._esc(pc.kode)
                +(onG?' <span class="text-[8px] text-neutral-500 ml-auto">('+(pc.pos_x+1)+','+(pc.pos_y+1)+')</span>':' <span class="text-[8px] text-neutral-600 ml-auto">baru</span>')
                +'</div>';
        }).join('');

        // PC yang sudah dipetakan di grid
        var placedDots = pcs.filter(function(p){return (p.pos_x>=0)&&(p.pos_y>=0);}).map(function(pc){
            var l=(pc.pos_x||0)*self.editorCellW+self.editorCellW/2;
            var t=(pc.pos_y||0)*self.editorCellH+self.editorCellH/2;
            var ss=self._state(pc);
            return '<div class="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style="left:'+l+'px;top:'+t+'px" data-editor-pc="'+pc.id+'">'
                +'<span class="w-4 h-4 lg:w-5 lg:h-5 rounded-full shrink-0 '+ss.dot+' ring-1 ring-neutral-600"></span>'
                +'<span class="text-[10px] lg:text-xs font-bold mt-1 text-neutral-300">'+self._esc(pc.kode)+'</span></div>';
        }).join('');

        var html = '<div class="bg-[#0c0c0c] border border-[#222] rounded-xl w-[98vw] max-w-[1600px] max-h-[98vh] flex flex-col overflow-hidden shadow-2xl">'
            +'<div class="px-6 py-4 border-b border-[#1c1c1c] flex items-center justify-between shrink-0">'
            +'<div><h3 class="text-base lg:text-[22px] font-bold text-neutral-100 uppercase tracking-wider">✏️ Edit Denah — '+self._esc(grup)+'</h3>'
            +'<p class="text-xs lg:text-base text-neutral-400 mt-0.5" id="editor-hint">Pilih PC di sidebar → klik cell di grid untuk menempatkan.</p></div>'
            +'<button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] flex items-center justify-center text-lg leading-none">&times;</button></div>'

            +'<div class="flex-1 flex overflow-hidden">'
            +'<div class="w-48 lg:w-56 shrink-0 border-r border-[#1c1c1c] bg-[#080808] flex flex-col">'
            +'<div class="p-3 pb-2 shrink-0"><p class="text-[10px] lg:text-sm text-neutral-500 uppercase font-bold">Pilih PC</p><p class="text-[8px] lg:text-xs text-neutral-600">Lalu klik cell grid →</p></div>'
            +'<div class="flex-1 overflow-y-auto px-3 space-y-1">'+sidebarHtml+'</div>'
            +'<div class="p-3 pt-2 border-t border-[#1c1c1c] shrink-0"><button onclick="MapView._removeSelected()" class="w-full px-3 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded text-xs lg:text-sm text-red-400 font-semibold transition-colors">Keluarkan dari Denah</button></div></div>'
            +'<div class="flex-1 overflow-auto bg-[#060606] p-3" id="editor-grid-wrapper">'
            +'<div class="relative cursor-crosshair" style="width:'+cw+'px;height:'+ch+'px" id="editor-grid">'
            +self._editGrid(cols,rows)+placedDots+'</div></div></div>'

            +'<div class="px-6 py-3 border-t border-[#1c1c1c] flex items-center justify-between shrink-0 bg-[#0a0a0a] flex-wrap gap-2">'
            +'<div class="flex items-center gap-2 text-xs lg:text-base text-neutral-400">Kolom <input type="number" id="edit-cols" value="'+gs.cols+'" min="1" max="10" class="w-16 px-2 py-1 bg-[#0a0a0a] border border-[#222] rounded text-neutral-200 text-center text-xs lg:text-base"> Baris <input type="number" id="edit-rows" value="'+gs.rows+'" min="1" max="100" class="w-16 px-2 py-1 bg-[#0a0a0a] border border-[#222] rounded text-neutral-200 text-center text-xs lg:text-base"> <button onclick="MapView._applyGrid(\''+self._esc(grup)+'\')" class="px-3 py-1 bg-neutral-700 border border-neutral-600 hover:bg-neutral-500 rounded text-xs lg:text-base text-neutral-200 font-semibold transition-colors">Terapkan</button></div>'
            +'<div class="flex gap-2"><button onclick="Modal.closeModal()" class="px-4 py-2 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded">Batal</button>'
            +'<button onclick="MapView._save()" class="px-5 py-2 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded">Simpan Denah</button></div></div></div>';

        Modal.show(html);

        setTimeout(function(){
            var grid = document.getElementById('editor-grid');
            if (!grid) return;
            grid.addEventListener('click', function(e){
                if (!self._selectedPcId) return;
                var rect = grid.getBoundingClientRect();
                var gx = Math.max(0, Math.min(cols-1, Math.round((e.clientX-rect.left-self.editorCellW/2)/self.editorCellW)));
                var gy = Math.max(0, Math.min(rows-1, Math.round((e.clientY-rect.top-self.editorCellH/2)/self.editorCellH)));

                var old = grid.querySelector('[data-editor-pc="'+self._selectedPcId+'"]');
                if (old) old.remove();

                // Cek tabrakan — kalau ada PC lain, TOLAK, keluarin alert
                var conflict = false;
                grid.querySelectorAll('[data-editor-pc]').forEach(function(o){
                    var ox = Math.round((parseInt(o.style.left)-self.editorCellW/2)/self.editorCellW);
                    var oy = Math.round((parseInt(o.style.top)-self.editorCellH/2)/self.editorCellH);
                    if (ox===gx && oy===gy) conflict = true;
                });

                if (conflict) {
                    document.getElementById('editor-hint').textContent = 'PC tabrakan! Tolong keluarkan PC yang ada dari denah terlebih dulu.';
                    document.getElementById('editor-hint').className = 'text-xs lg:text-base text-red-400 mt-0.5';
                    return;
                }

                var sbi = document.querySelector('.sidebar-pc-item[data-pc-id="'+self._selectedPcId+'"]');
                var kode = sbi ? sbi.dataset.pcKode : 'PC';
                var st = self._state({status:'kosong',status_koneksi:'online'});
                var dot = document.createElement('div');
                dot.className = 'absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 pointer-events-none';
                dot.style.left = (gx*self.editorCellW+self.editorCellW/2)+'px';
                dot.style.top = (gy*self.editorCellH+self.editorCellH/2)+'px';
                dot.setAttribute('data-editor-pc', self._selectedPcId);
                dot.innerHTML = '<span class="w-4 h-4 lg:w-5 lg:h-5 rounded-full shrink-0 '+st.dot+' ring-1 ring-neutral-600"></span><span class="text-[10px] lg:text-xs font-bold mt-1 text-neutral-300">'+kode+'</span>';
                grid.appendChild(dot);

                if (sbi) {
                    var sp = sbi.querySelector('span:last-child');
                    if (sp) { sp.textContent = '('+(gx+1)+','+(gy+1)+')'; sp.className = 'text-[8px] text-neutral-500 ml-auto'; }
                }
                document.getElementById('editor-hint').textContent = 'PC '+kode+' di ('+(gx+1)+','+(gy+1)+'). Pilih PC lain atau Simpan.';
                document.getElementById('editor-hint').className = 'text-xs lg:text-base text-neutral-400 mt-0.5';
            });
        }, 150);
    },

    _selectPc: function(pcId, el) {
        this._selectedPcId = pcId;
        document.querySelectorAll('.sidebar-pc-item').forEach(function(i){i.classList.remove('bg-neutral-700','ring-1','ring-neutral-500');});
        el.classList.add('bg-neutral-700','ring-1','ring-neutral-500');
        var hint = document.getElementById('editor-hint');
        hint.textContent = 'PC '+el.dataset.pcKode+' dipilih. Klik cell di grid.';
        hint.className = 'text-xs lg:text-base text-neutral-400 mt-0.5';
    },

    _removeSelected: function() {
        if (!this._selectedPcId) return;
        var grid = document.getElementById('editor-grid');
        if (!grid) return;
        var old = grid.querySelector('[data-editor-pc="'+this._selectedPcId+'"]');
        if (old) old.remove();
        var sbi = document.querySelector('.sidebar-pc-item[data-pc-id="'+this._selectedPcId+'"]');
        if (sbi) { sbi.classList.remove('bg-neutral-700','ring-1','ring-neutral-500'); var sp=sbi.querySelector('span:last-child'); if(sp){sp.textContent='baru';sp.className='text-[8px] text-neutral-600 ml-auto';} }
        this._selectedPcId = null;
        var hint = document.getElementById('editor-hint');
        hint.textContent = 'Pilih PC di sidebar → klik cell di grid.';
        hint.className = 'text-xs lg:text-base text-neutral-400 mt-0.5';
    },

    _applyGrid: function(grup) {
        var c = document.getElementById('edit-cols'), r = document.getElementById('edit-rows');
        var nc = c ? Math.max(1, Math.min(10, parseInt(c.value) || 10)) : 10;
        var nr = r ? Math.max(1, Math.min(100, parseInt(r.value) || 7)) : 7;
        
        var data = (window.Dashboard && window.Dashboard.lastData) || null;
        if (data) {
            var pcs = data.by_grup[grup] || [];
            var totalPC = pcs.length;
            var maxCapacity = nc * nr;

            if (maxCapacity < totalPC) {
                alert('Gagal mengubah grid! Kapasitas grid baru (' + nc + 'x' + nr + ' = ' + maxCapacity + ' cell) tidak cukup untuk menampung ' + totalPC + ' unit PC di zona ini.');
                return;
            }
            
            var mapped = pcs.filter(function(p) { return p.pos_x >= 0 && p.pos_y >= 0; });
            var outOfBounds = mapped.filter(function(p) { return p.pos_x >= nc || p.pos_y >= nr; });
            if (outOfBounds.length > 0) {
                var names = outOfBounds.map(function(p) { return p.kode; }).join(', ');
                if (!confirm('PC berikut berada di luar batas grid baru: ' + names + '.\nSistem akan mengeluarkan PC ini dari denah (kembali ke Belum Dipetakan). Lanjutkan?')) {
                    return;
                }
                outOfBounds.forEach(function(pc) {
                    pc.pos_x = -1;
                    pc.pos_y = -1;
                });
            }
        }
        
        this._setGridSize(grup, nc, nr);
        Modal.closeModal();
        this.openEditor(grup);
    },

    _editGrid: function(cols,rows) {
        var w=cols*this.editorCellW,h=rows*this.editorCellH,l='';
        for (var x=0;x<=w;x+=this.editorCellW)l+='<div class="absolute top-0 bottom-0 border-l border-[#181818]" style="left:'+x+'px"></div>';
        for (var y=0;y<=h;y+=this.editorCellH)l+='<div class="absolute left-0 right-0 border-t border-[#181818]" style="top:'+y+'px"></div>';
        return '<div class="absolute inset-0 pointer-events-none">'+l+'</div>';
    },

    _editCtx: function(e,pcId,kode){e.preventDefault();if(typeof Dashboard!=='undefined'&&Dashboard.showContextMenu)Dashboard.showContextMenu(e,pcId);},

    _save: function() {
        var grup = this._editorGrup;
        var colEl = document.getElementById('edit-cols'), rowEl = document.getElementById('edit-rows');
        var cols = colEl ? Math.max(1,Math.min(10,parseInt(colEl.value)||10)) : 10;
        var rows = rowEl ? Math.max(1,Math.min(100,parseInt(rowEl.value)||7)) : 7;
        this._setGridSize(grup, cols, rows);

        var grid = document.getElementById('editor-grid');
        if (!grid) return;
        var dots = grid.querySelectorAll('[data-editor-pc]');
        var ps = [];
        dots.forEach(function(d){
            var pcId = parseInt(d.getAttribute('data-editor-pc'));
            var gx = Math.max(0,Math.round((parseInt(d.style.left)-MapView.editorCellW/2)/MapView.editorCellW));
            var gy = Math.max(0,Math.round((parseInt(d.style.top)-MapView.editorCellH/2)/MapView.editorCellH));
            // Update lastData cache supaya re-render instan
            var pc = (window.Dashboard.lastData&&window.Dashboard.lastData.pc_list||[]).find(function(p){return p.id===pcId;});
            if (pc) { pc.pos_x = gx; pc.pos_y = gy; }
            ps.push(API.request('/api/v1/kasir/pc/'+pcId+'/position',{method:'PUT',body:JSON.stringify({pos_x:gx,pos_y:gy})}));
        });

        // Re-render langsung — gak nunggu API response
        Modal.closeModal();
        if (window.Dashboard && window.Dashboard.lastData) window.Dashboard._render(window.Dashboard.lastData);
        Toast.success('Denah disimpan');
    },

    // =========================================================================
    // STATUS
    // =========================================================================

    _state: function(pc) {
        if (!pc) return { dot:'bg-neutral-600', text:'text-neutral-400', label:'' };
        if (pc.status==='terpakai'&&(pc.status_koneksi==='no_heartbeat'||pc.status_koneksi==='offline'))
            return { dot:'bg-red-400 animate-pulse', text:'text-red-300', label:'⚠ TERPUTUS' };
        if (pc.status==='terpakai'&&pc.sesi_detail) {
            var sesi=pc.sesi_detail;
            if ((sesi.tipe||'').toLowerCase()==='admin') return { dot:'bg-amber-400', text:'text-amber-300', label:'ADMIN' };
            var m=(sesi.sisa_menit!=null)?parseInt(sesi.sisa_menit):0;
            if(m<=0)return{dot:'bg-emerald-300',text:'text-emerald-200',label:'SEKARANG'};
            var j=Math.floor(m/60),s=m%60;
            return{dot:'bg-emerald-300',text:'text-emerald-200',label:j>0?j+'j '+s+'m':s+'m'};
        }
        if(pc.is_admin_mode)return{dot:'bg-amber-400',text:'text-amber-300',label:'ADMIN'};
        if(pc.status_koneksi==='online')return{dot:'bg-neutral-300',text:'text-neutral-200',label:'KOSONG'};
        return{dot:'bg-neutral-600 opacity-50',text:'text-neutral-500',label:'OFFLINE'};
    },

    _act: function(pcs){return pcs.filter(function(p){return p.status==='terpakai';}).length;},
    _isAdmin: function(){return(document.body.dataset.kasirRole||'')==='admin';},
    _esc: function(s){if(!s)return'';var d=document.createElement('div');d.appendChild(document.createTextNode(s));return d.innerHTML;}
};

window.MapView = MapView;

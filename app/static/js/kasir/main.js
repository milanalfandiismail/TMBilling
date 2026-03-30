// app/static/js/kasir/main.js

const App = {
    currentTab: 'dash',
    
    init() {
        // Init modals
        Modals.init();
        
        // Load initial data
        Dashboard.load();
        BukaModal.init();
        
        // Auto refresh dashboard
        setInterval(() => {
            if (this.currentTab === 'dash') Dashboard.load();
        }, 5000);
    },
    
    toTab(tab) {
        // Update nav
        document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        
        // Hide all tabs
        document.querySelectorAll('.container > div').forEach(d => d.classList.add('hide'));
        
        // Show target
        document.getElementById('tab-' + tab).classList.remove('hide');
        this.currentTab = tab;
        
        // Load data
        switch(tab) {
            case 'pc': PCManager.load(); break;
            case 'paket': PaketManager.load(); break;
            case 'member': MemberManager.load(); break;
            case 'laporan': Laporan.load(); break;
        }
    }
};

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
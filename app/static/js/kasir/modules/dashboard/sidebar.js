// app/static/js/kasir/modules/dashboard/sidebar.js

const DashboardSidebar = {
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const navbarToggle = document.getElementById('navbar-toggle-btn');
        const isMobile = window.innerWidth < 1024;

        if (isMobile) {
            sidebar.classList.toggle('-translate-x-full');
            overlay?.classList.toggle('hidden');
        } else {
            Dashboard.isSidebarMini = !Dashboard.isSidebarMini;
            if (Dashboard.isSidebarMini) {
                sidebar.classList.remove('w-64');
                sidebar.classList.add('w-0', 'overflow-hidden', 'border-r-0');
                navbarToggle?.classList.remove('lg:hidden');
            } else {
                sidebar.classList.remove('w-0', 'overflow-hidden', 'border-r-0');
                sidebar.classList.add('w-64');
                navbarToggle?.classList.add('lg:hidden');
            }
            if (Dashboard.lastData) {
                Dashboard.render(Dashboard.lastData);
            }
        }
    }
};

window.DashboardSidebar = DashboardSidebar;

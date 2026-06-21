// Renders sidebar navigation. Call renderNav('pageId', user) on each protected page.
function renderNav(activePage, user) {
    const links = [
        { id: 'dashboard',    href: 'dashboard.html',    icon: '📊', label: 'Dashboard' },
        { id: 'plan',         href: 'plan.html',         icon: '📋', label: 'Kür Planı' },
        { id: 'injections',   href: 'injections.html',   icon: '💉', label: 'Enjeksiyon Takvimi' },
        { id: 'measurements', href: 'measurements.html', icon: '📏', label: 'Haftalık Ölçümler' },
        { id: 'labs',         href: 'labs.html',         icon: '🩸', label: 'Kan Tahlilleri' },
        { id: 'photos',       href: 'photos.html',       icon: '📷', label: 'Fotoğraf Takibi' },
        { id: 'charts',       href: 'charts.html',       icon: '📈', label: 'Grafikler' },
        { id: 'settings',     href: 'settings.html',     icon: '⚙️', label: 'Ayarlar' },
    ];

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const linksHtml = links.map(l => {
        const active = activePage === l.id ? ' active' : '';
        return `<a href="${escHtml(l.href)}" class="${active}"><span class="nav-icon">${l.icon}</span>${escHtml(l.label)}</a>`;
    }).join('');

    const emailText = user ? escHtml(user.email) : '';
    const avatarText = user ? escHtml(user.email[0].toUpperCase()) : '?';

    sidebar.innerHTML = `
        <div class="sidebar-brand">
            <span class="brand-icon">💉</span>
            <h2>Kür Takip</h2>
            <p>13 Haftalık Anabolik Program</p>
        </div>
        <nav class="sidebar-nav">${linksHtml}</nav>
        <div class="sidebar-footer">
            <div class="user-info">
                <div class="user-avatar">${avatarText}</div>
                <span class="user-email">${emailText}</span>
            </div>
            <button class="btn-logout" id="logoutBtn">🚪 Çıkış Yap</button>
        </div>
    `;

    // Hamburger
    const hamburger = document.getElementById('hamburger');
    const overlay   = document.getElementById('sidebarOverlay');
    if (hamburger && overlay) {
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('open');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        });
    }

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try { await auth.signOut(); } catch(e) {}
        window.location.href = 'index.html';
    });
}

// Toast notification system
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const icon = document.createElement('span');
    icon.style.fontWeight = '700';
    icon.style.flexShrink = '0';
    icon.textContent = icons[type] || 'ℹ';
    const msg = document.createElement('span');
    msg.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(msg);
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 320);
    }, duration);
}

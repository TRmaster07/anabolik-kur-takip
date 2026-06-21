// Auth guard - call on every protected page
function requireAuth(callback) {
    // Demo mode: check session flag first
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
        const demo = sessionStorage.getItem('demoUser');
        if (demo) {
            const user = { email: demo, uid: 'demo' };
            setCurrentUser(user);
            if (typeof callback === 'function') callback(user);
        } else {
            window.location.href = 'index.html';
        }
        return;
    }
    // Real Firebase
    auth.onAuthStateChanged(user => {
        if (user) {
            setCurrentUser(user);
            if (typeof callback === 'function') callback(user);
        } else {
            window.location.href = 'index.html';
        }
    });
}

// =====================================================
// Cloudinary Configuration
// =====================================================
const CLOUDINARY_CLOUD_NAME = 'dhgwfr9hf';
const CLOUDINARY_API_KEY = '276794323343199';
// API Secret kullanılmıyor - güvenlik için unsigned upload preset kullanılacak
const CLOUDINARY_UPLOAD_PRESET = 'kur_takip_photos'; // Cloudinary'de oluşturulacak

// Cloudinary SDK'sini yükle (CDN'den)
function loadCloudinarySDK() {
    return new Promise((resolve, reject) => {
        if (window.cloudinary) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://widget.cloudinary.com/v2.0/global/all.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Cloudinary upload widget'ı yükle
function loadCloudinaryWidget() {
    return new Promise((resolve, reject) => {
        if (window.cloudinary) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://widget.cloudinary.com/v2.0/global/all.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
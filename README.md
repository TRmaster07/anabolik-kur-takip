# 💉 Anabolik Kür Takip Sistemi

13 haftalık anabolik steroid kürünü takip etmek için geliştirilmiş, modern, mobil uyumlu web uygulaması.

## 🚀 Özellikler

- **Enjeksiyon Takvimi** — 39 enjeksiyonun otomatik takvimi (Pzt/Çar/Cum), tamamlama takibi, CSV ve PDF dışa aktarma
- **Haftalık Ölçümler** — Kilo, bel, tansiyon, nabız + 7 yan etki slider'ı (0–10)
- **Kan Tahlilleri** — 4 periyot (kür öncesi, ortası x2, sonu) için kapsamlı form
- **Fotoğraf Takibi** — Firebase Storage ile ön/yan/arka yükleme, görsel sıkıştırma, karşılaştırma
- **Grafikler** — Chart.js ile kilo, bel, tansiyon, nabız, yan etki grafikleri
- **Veri Yönetimi** — JSON yedek, CSV dışa aktarma, JSON içe aktarma, toplu silme
- **Dark Theme** — Tam responsive, mobil/tablet/masaüstü uyumlu

## ⚡ Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Kimlik Doğrulama | Firebase Authentication |
| Veritabanı | Firebase Firestore |
| Depolama | Firebase Storage (fotoğraflar) |
| Grafikler | Chart.js 4.x |
| PDF | jsPDF + jsPDF-AutoTable |
| Yayın | GitHub Pages |

## 📦 Kurulum

### 1. Firebase Projesi Oluşturma

1. [Firebase Console](https://console.firebase.google.com/) adresine gidin
2. **Add project** → Proje adı girin → Analytics opsiyonel
3. Sol menüden **Authentication** → **Get started** → **Email/Password** etkinleştirin
4. Sol menüden **Firestore Database** → **Create database** → **Production mode** → Bölge seçin
5. Sol menüden **Storage** → **Get started** → **Production mode**

### 2. Firebase Yapılandırması

1. Firebase Console → **Project Settings** (⚙️ simgesi) → **Your apps** → **Web** (</> simgesi)
2. Uygulama kaydı sonrası görüntülenen `firebaseConfig` nesnesini kopyalayın
3. `js/firebase-config.js` dosyasını açın ve `YOUR_*` yer tutucularını gerçek değerlerle değiştirin:

```javascript
const firebaseConfig = {
    apiKey:            "AIzaSy...",
    authDomain:        "projeniz.firebaseapp.com",
    projectId:         "projeniz",
    storageBucket:     "projeniz.appspot.com",
    messagingSenderId: "123456789",
    appId:             "1:123456:web:abc123"
};
```

### 3. Firestore Güvenlik Kuralları

Firebase Console → Firestore Database → **Rules** sekmesine gidin ve şunları yapıştırın:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Firebase Storage Kuralları

Firebase Console → Storage → **Rules** sekmesine gidin:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Kullanıcı Ekleme

Firebase Console → **Authentication** → **Users** → **Add user**

- En fazla 2 kullanıcı ekleyin
- Her kullanıcı için e-posta ve şifre girin
- Her iki kullanıcı da tüm verilere erişebilir

### 6. GitHub Pages Yayını

```bash
# 1. GitHub'da yeni repo oluşturun
# 2. Projeyi push edin
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/KULLANICI/REPO.git
git push -u origin main

# 3. GitHub → Repository → Settings → Pages
#    Source: Deploy from a branch → main → / (root) → Save
```

Birkaç dakika sonra `https://KULLANICI.github.io/REPO/` adresinde yayında olacak.

## 🗂 Proje Yapısı

```
/
├── index.html          # Giriş sayfası
├── dashboard.html      # Ana ekran
├── injections.html     # Enjeksiyon takvimi
├── measurements.html   # Haftalık ölçümler
├── labs.html           # Kan tahlilleri
├── photos.html         # Fotoğraf takibi
├── charts.html         # Grafikler
├── settings.html       # Ayarlar / veri yönetimi
├── firestore.rules     # Firestore güvenlik kuralları
├── css/
│   ├── style.css       # Global stiller (dark theme, layout, bileşenler)
│   ├── dashboard.css
│   ├── injections.css
│   ├── measurements.css
│   ├── labs.css
│   ├── photos.css
│   ├── charts.css
│   └── settings.css
└── js/
    ├── firebase-config.js  # Firebase başlatma (⚠️ buraya config girin)
    ├── auth.js             # Auth guard
    ├── nav.js              # Sidebar navigasyon
    ├── utils.js            # Paylaşılan yardımcı fonksiyonlar
    ├── toast.js            # Bildirim sistemi
    ├── dashboard.js
    ├── injections.js
    ├── measurements.js
    ├── labs.js
    ├── photos.js
    ├── charts.js
    └── settings.js
```

## 🗓 Kür Bilgileri

| Parametre | Değer |
|-----------|-------|
| Başlangıç | 22 Haziran 2026 (Pazartesi) |
| Bitiş | 18 Eylül 2026 (Cuma) |
| Süre | 13 Hafta |
| Enjeksiyon Günleri | Pazartesi, Çarşamba, Cuma |
| Test E dozu | 500 mg/hafta → 0.67 mL/inj |
| Masteron P dozu | 300 mg/hafta → 1.00 mL/inj |
| Toplam hacim/inj | 1.67 mL |
| Toplam enjeksiyon | 39 |

## 🔒 Güvenlik

- Firebase Authentication ile yetkisiz erişim engellenir
- Firestore kuralları yalnızca giriş yapmış kullanıcılara izin verir
- Fotoğraflar için dosya boyutu sınırı (20 MB) ve görsel sıkıştırma uygulanır
- Kullanıcı verisi `innerHTML`'de `escHtml()` ile temizlenir (XSS koruması)
- HTTPS zorunludur (GitHub Pages ve Firebase her ikisi de HTTPS sunar)

## ⚠️ Notlar

- Bu uygulama yalnızca izleme ve kayıt amaçlıdır
- Herhangi bir tıbbi tavsiye içermemektedir
- Anabolik steroid kullanımı birçok ülkede yasal değildir; yerel yasalara uyunuz

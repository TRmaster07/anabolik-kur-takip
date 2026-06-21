// =====================================================
// Firebase Configuration
// =====================================================
const firebaseConfig = {
    apiKey: "AIzaSyAf4BNO7M0RXCclV4Cemtm9yyttFlRySPo",
    authDomain: "kur-takip-58ed0.firebaseapp.com",
    projectId: "kur-takip-58ed0",
    storageBucket: "kur-takip-58ed0.firebasestorage.app",
    messagingSenderId: "562894441219",
    appId: "1:562894441219:web:0f8a42b227649ab6b9f736",
    measurementId: "G-PE09LKPZ72"
};

// DEMO MOD kapali — gercek Firebase kullan
const DEMO_MODE = false;

// Firebase'i baslat
firebase.initializeApp(firebaseConfig);
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();
window.auth = auth; window.db = db; window.storage = storage;

// offline destegi
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code === 'failed-precondition') console.warn('Firestore persistence: multiple tabs, disabled.');
    else if (err.code === 'unimplemented')  console.warn('Firestore persistence not supported.');
});
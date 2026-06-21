const SIDE_EFFECTS = [
    { id: 'acne',         label: 'Akne' },
    { id: 'hairLoss',     label: 'Saç Dökülmesi' },
    { id: 'libido',       label: 'Libido Değişimi' },
    { id: 'mood',         label: 'Ruh Hali Değişimi' },
    { id: 'breathless',   label: 'Nefes Darlığı' },
    { id: 'headache',     label: 'Baş Ağrısı' },
    { id: 'gyno',         label: 'Meme Hassasiyeti' },
];
const FIELDS = ['weight','waist','systolic','diastolic','pulse','energy','sleep','training','genNotes',
                ...SIDE_EFFECTS.map(s => s.id)];

let currentWeek = getCurrentWeek() || 1;

document.addEventListener('DOMContentLoaded', () => {
    requireAuth(user => {
        renderNav('measurements', user);
        buildSideEffectSliders();
        loadWeek(currentWeek);
        bindNav();
        bindForm();
    });
});

function buildSideEffectSliders() {
    const grid = document.getElementById('sideEffectGrid');
    grid.innerHTML = SIDE_EFFECTS.map(se => `
        <div class="slider-group card" style="padding:14px">
            <div class="slider-header">
                <span class="slider-label">${escHtml(se.label)}</span>
                <span class="slider-value" id="val_${se.id}">0</span>
            </div>
            <input type="range" id="${se.id}" min="0" max="10" value="0"
                   oninput="document.getElementById('val_${se.id}').textContent=this.value">
        </div>
    `).join('');
}

function setWeekLabel(w) {
    document.getElementById('weekLabel').textContent = 'Hafta ' + w;
    document.getElementById('prevWeek').disabled = w <= 1;
    document.getElementById('nextWeek').disabled = w >= TOTAL_WEEKS;
}

async function loadWeek(w) {
    currentWeek = w;
    setWeekLabel(w);
    clearForm();
    const indicator = document.getElementById('savedIndicator');
    indicator.textContent = '';
    try {
        const doc = await db.collection('measurements').doc('week_' + w).get();
        if (doc.exists) {
            populateForm(doc.data());
            indicator.innerHTML = '<span class="saved-badge">✓ Kaydedildi</span>';
        }
    } catch (err) {
        showToast('Veri yüklenemedi', 'error');
    }
}

function clearForm() {
    FIELDS.forEach(f => {
        const el = document.getElementById(f);
        if (!el) return;
        if (el.type === 'range') { el.value = 0; const v = document.getElementById('val_' + f); if (v) v.textContent = '0'; }
        else el.value = '';
    });
}

function populateForm(data) {
    FIELDS.forEach(f => {
        const el = document.getElementById(f);
        if (!el) return;
        const val = data[f] !== undefined ? data[f] : (el.type === 'range' ? 0 : '');
        el.value = val;
        if (el.type === 'range') { const v = document.getElementById('val_' + f); if (v) v.textContent = val; }
    });
}

function getFormData() {
    const data = { week: currentWeek };
    FIELDS.forEach(f => {
        const el = document.getElementById(f);
        if (!el) return;
        const v = el.value;
        if (['weight','waist','systolic','diastolic','pulse'].includes(f)) {
            data[f] = v !== '' ? parseFloat(v) : null;
        } else if (SIDE_EFFECTS.some(s => s.id === f)) {
            data[f] = parseInt(v) || 0;
        } else {
            data[f] = v.trim().substring(0, 1000);
        }
    });
    return data;
}

function bindNav() {
    document.getElementById('prevWeek').addEventListener('click', () => {
        if (currentWeek > 1) loadWeek(currentWeek - 1);
    });
    document.getElementById('nextWeek').addEventListener('click', () => {
        if (currentWeek < TOTAL_WEEKS) loadWeek(currentWeek + 1);
    });
}

function bindForm() {
    document.getElementById('measForm').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('saveBtn');
        btn.disabled = true; btn.textContent = 'Kaydediliyor...';
        try {
            const data = getFormData();
            data.savedAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('measurements').doc('week_' + currentWeek).set(data);
            showToast('Hafta ' + currentWeek + ' kaydedildi ✓', 'success');
            document.getElementById('savedIndicator').innerHTML = '<span class="saved-badge">✓ Kaydedildi</span>';
        } catch (err) {
            showToast('Kayıt hatası: ' + err.message, 'error');
        } finally {
            btn.disabled = false; btn.textContent = '💾 Kaydet';
        }
    });

    document.getElementById('clearBtn').addEventListener('click', async () => {
        if (!confirm('Hafta ' + currentWeek + ' verisi silinecek. Emin misiniz?')) return;
        try {
            await db.collection('measurements').doc('week_' + currentWeek).delete();
            clearForm();
            document.getElementById('savedIndicator').textContent = '';
            showToast('Hafta ' + currentWeek + ' temizlendi', 'success');
        } catch (err) {
            showToast('Silme hatası: ' + err.message, 'error');
        }
    });
}

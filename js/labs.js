// Lab periods definition
const PERIODS = {
    1: {
        name: 'Kür Öncesi',
        desc: 'Kür başlamadan önce (Haziran 2026)',
        fields: [
            { id:'wbc',              label:'WBC (x10³/µL)' },
            { id:'rbc',              label:'RBC (x10⁶/µL)' },
            { id:'hgb',              label:'HGB (g/dL)' },
            { id:'hct',              label:'HCT (%)' },
            { id:'plt',              label:'PLT (x10³/µL)' },
            { id:'ast',              label:'AST (U/L)' },
            { id:'alt',              label:'ALT (U/L)' },
            { id:'kreatinin',        label:'Kreatinin (mg/dL)' },
            { id:'totalTestosteron', label:'Total Testosteron (ng/dL)' },
            { id:'estradiol',        label:'Estradiol (pg/mL)' },
            { id:'hdl',              label:'HDL (mg/dL)' },
            { id:'ldl',              label:'LDL (mg/dL)' },
            { id:'trigliserid',      label:'Trigliserid (mg/dL)' },
        ]
    },
    2: {
        name: 'Kür Ortası I',
        desc: 'Yaklaşık Hafta 4-5 (Temmuz 2026)',
        fields: [
            { id:'wbc',    label:'WBC (x10³/µL)' },
            { id:'rbc',    label:'RBC (x10⁶/µL)' },
            { id:'hgb',    label:'HGB (g/dL)' },
            { id:'hct',    label:'HCT (%)' },
            { id:'plt',    label:'PLT (x10³/µL)' },
            { id:'hctNote', label:'HCT Notu' },
            { id:'bpNote',  label:'Kan Basıncı Notu' },
        ]
    },
    3: {
        name: 'Kür Ortası II',
        desc: 'Yaklaşık Hafta 8-9 (Ağustos 2026)',
        fields: [
            { id:'wbc',       label:'WBC (x10³/µL)' },
            { id:'rbc',       label:'RBC (x10⁶/µL)' },
            { id:'hgb',       label:'HGB (g/dL)' },
            { id:'hct',       label:'HCT (%)' },
            { id:'plt',       label:'PLT (x10³/µL)' },
            { id:'hdl',       label:'HDL (mg/dL)' },
            { id:'ldl',       label:'LDL (mg/dL)' },
            { id:'trigliserid', label:'Trigliserid (mg/dL)' },
            { id:'ast',       label:'AST (U/L)' },
            { id:'alt',       label:'ALT (U/L)' },
            { id:'kreatinin', label:'Kreatinin (mg/dL)' },
            { id:'estradiol', label:'Estradiol (pg/mL)' },
        ]
    },
    4: {
        name: 'Kür Sonu',
        desc: 'Kür bittikten sonra (Eylül-Ekim 2026)',
        fields: [
            { id:'wbc',              label:'WBC (x10³/µL)' },
            { id:'rbc',              label:'RBC (x10⁶/µL)' },
            { id:'hgb',              label:'HGB (g/dL)' },
            { id:'hct',              label:'HCT (%)' },
            { id:'plt',              label:'PLT (x10³/µL)' },
            { id:'hdl',              label:'HDL (mg/dL)' },
            { id:'ldl',              label:'LDL (mg/dL)' },
            { id:'trigliserid',      label:'Trigliserid (mg/dL)' },
            { id:'ast',              label:'AST (U/L)' },
            { id:'alt',              label:'ALT (U/L)' },
            { id:'kreatinin',        label:'Kreatinin (mg/dL)' },
            { id:'estradiol',        label:'Estradiol (pg/mL)' },
            { id:'totalTestosteron', label:'Total Testosteron (ng/dL)' },
        ]
    }
};

let activePeriod = 1;

document.addEventListener('DOMContentLoaded', () => {
    requireAuth(user => {
        renderNav('labs', user);
        bindTabs();
        renderPeriod(1);
    });
});

function bindTabs() {
    document.querySelectorAll('.period-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPeriod(parseInt(btn.dataset.period));
        });
    });
}

async function renderPeriod(p) {
    activePeriod = p;
    const period  = PERIODS[p];
    const content = document.getElementById('labContent');
    content.innerHTML = '<div class="loading"><div class="spinner"></div> Yükleniyor...</div>';

    let existing = {};
    try {
        const doc = await getUserDoc('labs', 'period_' + p);
        if (doc.exists) existing = doc.data();
    } catch(e) {}

    const fieldsHtml = period.fields.map(f => {
        const val = existing[f.id] !== undefined ? escHtml(String(existing[f.id])) : '';
        const isTextarea = f.id === 'hctNote' || f.id === 'bpNote';
        const input = isTextarea
            ? `<textarea class="lab-field-input" id="lab_${f.id}" maxlength="500" placeholder="...">${val}</textarea>`
            : `<input type="text" class="lab-field-input" id="lab_${f.id}" maxlength="50" placeholder="..." value="${val}">`;
        return `<div class="lab-field-group"><label class="lab-field-label" for="lab_${f.id}">${escHtml(f.label)}</label>${input}</div>`;
    }).join('');

    const savedDateVal = existing.date ? escHtml(existing.date) : '';
    const notesVal     = existing.notes ? escHtml(existing.notes) : '';
    const savedAt      = existing.savedAt ? '<span class="badge badge-success" style="margin-left:8px">✓ Kaydedildi</span>' : '';

    content.innerHTML = `
        <div class="card">
            <div class="period-card-header">
                <div class="period-num">${p}</div>
                <div>
                    <div style="font-size:1rem;font-weight:700">Periyot ${p}: ${escHtml(period.name)} ${savedAt}</div>
                    <div style="font-size:0.82rem;color:var(--text-secondary)">${escHtml(period.desc)}</div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="lab_date">Tahlil Tarihi</label>
                <input type="date" id="lab_date" class="form-control" style="max-width:220px" value="${savedDateVal}">
            </div>
            <div class="section-title" style="margin-bottom:14px">Sonuçlar</div>
            <div class="lab-form-grid" style="margin-bottom:20px">${fieldsHtml}</div>
            <div class="form-group">
                <label class="form-label" for="lab_notes">Notlar</label>
                <textarea id="lab_notes" class="form-control" maxlength="1000" placeholder="Doktor yorumları, anormal değerler...">${notesVal}</textarea>
            </div>
            <div style="display:flex;gap:10px">
                <button class="btn btn-primary" id="labSaveBtn">💾 Kaydet</button>
                <button class="btn btn-danger" id="labClearBtn">🗑 Temizle</button>
            </div>
        </div>
    `;

    document.getElementById('labSaveBtn').addEventListener('click', () => savePeriod(p, period));
    document.getElementById('labClearBtn').addEventListener('click', () => clearPeriod(p));
}

async function savePeriod(p, period) {
    const btn = document.getElementById('labSaveBtn');
    btn.disabled = true; btn.textContent = 'Kaydediliyor...';
    const data = { period: p, date: document.getElementById('lab_date').value, notes: document.getElementById('lab_notes').value.substring(0,1000) };
    period.fields.forEach(f => {
        const el = document.getElementById('lab_' + f.id);
        data[f.id] = el ? el.value.trim().substring(0,500) : '';
    });
    data.savedAt = firebase.firestore.FieldValue.serverTimestamp();
    try {
        await getUserDoc('labs', 'period_' + p).set(data);
        showToast('Periyot ' + p + ' kaydedildi ✓', 'success');
        renderPeriod(p);
    } catch(err) {
        showToast('Kayıt hatası: ' + err.message, 'error');
        btn.disabled = false; btn.textContent = '💾 Kaydet';
    }
}

async function clearPeriod(p) {
    if (!confirm('Periyot ' + p + ' verileri silinecek. Emin misiniz?')) return;
    try {
        await getUserDoc('labs', 'period_' + p).delete();
        showToast('Periyot ' + p + ' temizlendi', 'success');
        renderPeriod(p);
    } catch(err) { showToast('Silme hatası: ' + err.message, 'error'); }
}

document.addEventListener('DOMContentLoaded', () => {
    requireAuth(user => {
        renderNav('settings', user);
        loadKurInfo();
        bindButtons();
    });
});

async function loadKurInfo() {
    const container = document.getElementById('kurInfoContainer');
    if (!container) return;

    let plan = null;
    try {
        const doc = await getUserDoc('plan', 'main');
        if (doc.exists) {
            const data = doc.data();
            if (isValidPlan(data)) plan = data;
        }
    } catch (e) {
        console.warn('Plan yukleme hatasi:', e.message);
    }

    if (!plan) {
        container.innerHTML = `<div class="empty-state" style="padding:30px 20px">
            <div class="empty-icon">📋</div>
            <p>Henuz bir kur plani olusturulmadi.<br>Kur bilgileri, plan kaydedildikten sonra burada gorunur.</p>
            <a href="plan.html" class="btn btn-primary" style="margin-top:16px;display:inline-flex">+ Kur Plani Olustur</a>
        </div>`;
        return;
    }

    const schedule   = generateScheduleFromPlan(plan);
    const endDate    = schedule.length ? schedule[schedule.length - 1].date : '';
    const totalInj   = schedule.length;
    const totalVol   = (plan.compounds || []).reduce((s, c) => s + (parseFloat(c.mlPerInj) || 0), 0);
    const injDays    = (plan.injectionDays || []).map(i => INJ_DAY_SHORT[i] || '').filter(Boolean).join(' / ');
    const cmpItems   = (plan.compounds || []).map(c =>
        `<div class="kur-info-item">
            <div class="ki-label">${escHtml(c.name || c.shortName)}</div>
            <div class="ki-value">${c.weeklyDose || 0} mg/hf · ${(parseFloat(c.mlPerInj) || 0).toFixed(2)} mL/inj</div>
        </div>`
    ).join('');

    container.innerHTML = `<div class="kur-info-grid">
        <div class="kur-info-item"><div class="ki-label">Plan Adi</div><div class="ki-value">${escHtml(plan.name)}</div></div>
        <div class="kur-info-item"><div class="ki-label">Baslangic</div><div class="ki-value">${escHtml(formatDate(plan.startDate))}</div></div>
        <div class="kur-info-item"><div class="ki-label">Bitis</div><div class="ki-value">${endDate ? escHtml(formatDate(endDate)) : '—'}</div></div>
        <div class="kur-info-item"><div class="ki-label">Sure</div><div class="ki-value">${plan.totalWeeks || 0} Hafta</div></div>
        <div class="kur-info-item"><div class="ki-label">Toplam Enjeksiyon</div><div class="ki-value">${totalInj}</div></div>
        ${cmpItems}
        <div class="kur-info-item"><div class="ki-label">Enjeksiyon Gunleri</div><div class="ki-value">${escHtml(injDays || '—')}</div></div>
        <div class="kur-info-item"><div class="ki-label">Toplam Hacim/Inj</div><div class="ki-value">${totalVol.toFixed(2)} mL</div></div>
    </div>`;
}

function bindButtons() {
    document.getElementById('exportJSON').addEventListener('click',    exportJSON);
    document.getElementById('exportMeasCSV').addEventListener('click', exportMeasCSV);
    document.getElementById('importJSON').addEventListener('click',    () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change',   handleImport);
    document.getElementById('deleteAll').addEventListener('click',     deleteAllData);
}

async function exportJSON() {
    const btn = document.getElementById('exportJSON');
    btn.disabled = true; btn.textContent = 'İndiriliyor...';
    try {
        const [injSnap, measSnap, labsSnap, photosSnap] = await Promise.all([
            getUserCollection('injections').get(),
            getUserCollection('measurements').get(),
            getUserCollection('labs').get(),
            getUserCollection('photos').get(),
        ]);
        const dump = {
            exportedAt:   new Date().toISOString(),
            version:      '1.0',
            injections:   {},
            measurements: {},
            labs:         {},
            photos:       {}
        };
        injSnap.forEach   (d => { dump.injections[d.id]   = d.data(); });
        measSnap.forEach  (d => { dump.measurements[d.id] = d.data(); });
        labsSnap.forEach  (d => { dump.labs[d.id]         = d.data(); });
        photosSnap.forEach(d => { dump.photos[d.id]       = d.data(); });

        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
        const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0,19);
        downloadBlob(blob, 'kur-yedek-' + ts + '.json');
        showToast('JSON yedek indirildi ✓', 'success');
    } catch(err) {
        showToast('Dışa aktarma hatası: ' + err.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = '📥 JSON İndir';
    }
}

async function exportMeasCSV() {
    try {
        const snap = await getUserCollection('measurements').orderBy('week','asc').get();
        const headers = ['Hafta','Kilo','Bel','Sistolik','Diyastolik','Nabız','Akne','Saç Dök.','Libido','Ruh Hali','Nefes Darl.','Baş Ağrısı','Meme Hass.','Enerji','Uyku','Antrenman','Notlar'];
        const rows = [headers];
        snap.forEach(d => {
            const v = d.data();
            rows.push([v.week,v.weight,v.waist,v.systolic,v.diastolic,v.pulse,
                v.acne,v.hairLoss,v.libido,v.mood,v.breathless,v.headache,v.gyno,
                '"'+String(v.energy||'').replace(/"/g,'""')+'"',
                '"'+String(v.sleep||'').replace(/"/g,'""')+'"',
                '"'+String(v.training||'').replace(/"/g,'""')+'"',
                '"'+String(v.genNotes||'').replace(/"/g,'""')+'"'
            ]);
        });
        const csv  = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
        downloadBlob(blob, 'olcumler.csv');
        showToast('CSV indirildi ✓', 'success');
    } catch(err) {
        showToast('CSV hatası: ' + err.message, 'error');
    }
}

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('İçe aktarma mevcut verilerin üzerine yazabilir. Devam edilsin mi?')) return;
    try {
        const text = await file.text();
        const dump = JSON.parse(text);
        if (!dump.version || !dump.injections) throw new Error('Geçersiz yedek dosyası');

        const batch = db.batch();
        let count = 0;
        const write = (col, data) => Object.entries(data).forEach(([id, val]) => {
            if (typeof val === 'object' && val !== null) {
                delete val.savedAt; delete val.updatedAt; // remove timestamps
                batch.set(getUserDoc(col, id), val, { merge: true });
                count++;
            }
        });
        if (dump.injections)   write('injections',   dump.injections);
        if (dump.measurements) write('measurements', dump.measurements);
        if (dump.labs)         write('labs',         dump.labs);
        await batch.commit();
        showToast(count + ' kayıt içe aktarıldı ✓', 'success');
    } catch(err) {
        showToast('İçe aktarma hatası: ' + err.message, 'error');
    }
    e.target.value = '';
}

async function deleteAllData() {
    const confirmed = confirm('DİKKAT: Tüm veriler (enjeksiyonlar, ölçümler, tahliller) kalıcı olarak silinecek!\n\nBu işlem geri alınamaz. Emin misiniz?');
    if (!confirmed) return;
    const reConfirm = confirm('Son onay: Tüm veriler silinecek. Devam et?');
    if (!reConfirm) return;
    const btn = document.getElementById('deleteAll');
    btn.disabled = true; btn.textContent = 'Siliniyor...';
    try {
        const cols = ['injections','measurements','labs','photos','plan'];
        for (const col of cols) {
            const snap  = await getUserCollection(col).get();
            const batch = db.batch();
            snap.forEach(d => batch.delete(getUserDoc(col, d.id)));
            await batch.commit();
        }
        showToast('Tüm veriler silindi', 'success');
        loadKurInfo();
    } catch(err) {
        showToast('Silme hatası: ' + err.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = '🗑 Tüm Verileri Sil';
    }
}

let allSchedule = [];
let savedData   = {};
let activePlan  = null;      // loaded from Firestore if exists
let numWeeks    = 0;

const SITE_OPTIONS = [
    ['', '— Bolge —'],
    ['SG',   'Sol Gluteus'],
    ['SAG',  'Sag Gluteus'],
    ['SD',   'Sol Deltoid'],
    ['SAD',  'Sag Deltoid'],
    ['SVL',  'Sol Vastus Lat.'],
    ['SAVL', 'Sag Vastus Lat.'],
];

document.addEventListener('DOMContentLoaded', () => {
    requireAuth(user => {
        renderNav('injections', user);
        initInjections();
    });
});

async function initInjections() {
    // 1. Try to load plan
    try {
        const pdoc = await getUserDoc('plan', 'main');
        if (pdoc.exists) {
            const data = pdoc.data();
            if (isValidPlan(data)) activePlan = data;
        }
    } catch (e) { console.warn('Plan yukleme hatasi:', e.message); }

    // 2. Generate schedule only when a valid plan exists
    if (activePlan) {
        allSchedule = generateScheduleFromPlan(activePlan);
        numWeeks = activePlan.totalWeeks || 13;

        // 3. Merge saved injection data
        try {
            const snap = await getUserCollection('injections').get();
            snap.forEach(doc => { savedData[doc.id] = doc.data(); });
            allSchedule = allSchedule.map(i => ({ ...i, ...(savedData[i.id] || {}) }));
        } catch (err) {
            console.error(err);
            showToast('Veriler yuklenemedi: ' + err.message, 'error');
        }
    } else {
        allSchedule = [];
        numWeeks = 0;
    }

    renderSiteRotation();
    renderAll();
    bindToolbar();
}

// ===== SITE ROTATION SUMMARY =====
function renderSiteRotation() {
    const el = document.getElementById('siteRotation');
    if (!el) return;
    const counts = {};
    SITE_OPTIONS.slice(1).forEach(([v]) => { counts[v] = 0; });
    allSchedule.forEach(i => { if (i.site && counts[i.site] !== undefined) counts[i.site]++; });
    const total = allSchedule.filter(i => i.site).length;
    if (total === 0) { el.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem">Henuz bolge secilmedi</span>'; return; }
    el.innerHTML = '<span style="font-size:0.8rem;color:var(--text-muted);margin-right:8px">Bolge dagilimi:</span>' +
        SITE_OPTIONS.slice(1).map(([v, l]) => {
            const n = counts[v];
            const pct = total > 0 ? Math.round((n/total)*100) : 0;
            const col = n > 0 ? 'var(--accent-text)' : 'var(--text-muted)';
            return `<span class="site-dot" style="color:${col};border-color:${col}">${l}: ${n}</span>`;
        }).join('');
}

// ===== STATS =====
function updateStats() {
    const el = document.getElementById('injStats');
    const planBadge = document.getElementById('planBadge');
    if (!activePlan) {
        if (el) el.textContent = 'Kur plani olusturulmadi';
        if (planBadge) planBadge.textContent = '';
        return;
    }
    const done  = allSchedule.filter(i => i.completed).length;
    const total = allSchedule.length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
    if (el) el.textContent = done + ' / ' + total + ' tamamlandi (' + pct + '%)';
    if (planBadge) planBadge.textContent = '📋 ' + escHtml(activePlan.name || 'Ozel Plan');
}

function updateToolbarVisibility(hasPlan) {
    ['resetAll', 'exportCSV', 'exportPDF'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = hasPlan ? '' : 'none';
    });
}

// ===== RENDER =====
function renderAll() {
    updateStats();
    const container = document.getElementById('injectionsContainer');
    if (!container) return;

    if (!activePlan || allSchedule.length === 0) {
        updateToolbarVisibility(false);
        container.innerHTML = `<div class="empty-state" style="padding:60px 20px">
            <div class="empty-icon">💉</div>
            <p>Henuz bir kur plani olusturmadiniz.<br>Enjeksiyon takvimi, kur planiniz kaydedildikten sonra gorunur.</p>
            <a href="plan.html" class="btn btn-primary" style="margin-top:16px;display:inline-flex">+ Kur Plani Olustur</a>
        </div>`;
        return;
    }

    updateToolbarVisibility(true);
    const today = formatDateISO(new Date());

    // Group by week
    const weeks = {};
    allSchedule.forEach(i => {
        if (!weeks[i.week]) weeks[i.week] = [];
        weeks[i.week].push(i);
    });

    const usePlan = !!(activePlan && activePlan.compounds?.length);
    const compounds = usePlan ? activePlan.compounds : null;

    // Build compound header cells
    let cmpHeads = '';
    if (usePlan) {
        compounds.forEach(c => { cmpHeads += '<th>' + escHtml(c.shortName || c.name) + ' (mL)</th>'; });
    } else {
        cmpHeads = '<th>Test E (mL)</th><th>Mast P (mL)</th>';
    }

    let html = '';
    for (let w = 1; w <= numWeeks; w++) {
        const list = weeks[w] || [];
        const done = list.filter(i => i.completed).length;
        const pct  = list.length > 0 ? Math.round((done / list.length) * 100) : 0;
        const badge = pct === 100 ? 'badge-success' : done > 0 ? 'badge-warning' : 'badge-default';
        html += '<div class="week-section">';
        html += '<div class="week-header">';
        html += '<div><span class="week-title">Hafta ' + w + '</span>';
        html += ' <span class="badge ' + badge + '">' + done + '/' + list.length + ' tamamlandi</span></div>';
        html += '<div style="display:flex;align-items:center;gap:8px">';
        html += '<span style="font-size:0.8rem;color:var(--text-muted)">' + pct + '%</span>';
        html += '<div class="progress" style="width:90px"><div class="progress-bar' + (pct===100?' success':'') + '" style="width:' + pct + '%"></div></div>';
        html += '</div></div>';
        html += '<div class="table-wrap" style="border-radius:0 0 var(--radius) var(--radius)">';
        html += '<table><thead><tr><th>Tarih</th><th>Gun</th>' + cmpHeads + '<th>Toplam</th>';
        html += '<th>Bolge</th><th>Reaksiyon</th><th>Yapildi</th><th>Not</th><th></th></tr></thead><tbody>';
        list.forEach(inj => {
            html += buildInjRow(inj, today, usePlan, compounds);
        });
        html += '</tbody></table></div></div>';
    }
    container.innerHTML = html;

    // Bind save buttons
    container.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', () => saveRow(btn.dataset.id, btn));
    });
}

function buildInjRow(inj, today, usePlan, planCompounds) {
    const isToday = inj.date === today;
    const trClass = isToday ? ' class="inj-today"' : '';
    let html = '<tr' + trClass + ' data-id="' + escHtml(inj.id) + '">';

    // Date
    html += '<td>' + escHtml(formatDate(inj.date)) + '</td>';

    // Day
    html += '<td>' + escHtml(inj.dayName) + '</td>';

    // Compounds — show current plan dose on every scheduled day (live from plan)
    let totalMl = 0;
    if (usePlan && planCompounds) {
        planCompounds.forEach(c => {
            const entry = inj.compounds?.find(ic => ic.id === c.id);
            if (entry) {
                // Plan'daki guncel mlPerInj degerini kullan (kaydedilmis degil)
                const ml = parseFloat(c.mlPerInj) || 0;
                totalMl += ml;
                html += '<td><span class="badge badge-info">' + ml.toFixed(2) + '</span></td>';
            } else {
                html += '<td><span style="color:var(--text-muted)">—</span></td>';
            }
        });
    } else {
        const testDose = parseFloat(inj.testDose) || 0.67;
        const mastDose = parseFloat(inj.masteronDose) || 1.00;
        totalMl = testDose + mastDose;
        html += '<td><span class="badge badge-info">' + testDose.toFixed(2) + '</span></td>';
        html += '<td><span class="badge badge-info">' + mastDose.toFixed(2) + '</span></td>';
    }

    // Total — canli hesapla
    html += '<td><strong>' + totalMl.toFixed(2) + '</strong></td>';

    // Site dropdown
    const siteOpts = SITE_OPTIONS.map(([v,l]) =>
        `<option value="${escHtml(v)}"${(inj.site||'')==v?' selected':''}>${escHtml(l)}</option>`
    ).join('');
    html += '<td><select class="inj-site" data-id="' + escHtml(inj.id) + '" style="min-width:115px;padding:4px 6px;border-radius:6px;font-size:0.78rem;background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">' + siteOpts + '</select></td>';

    // Reactions
    html += '<td><div style="display:flex;flex-direction:column;gap:3px;font-size:0.78rem">'
        + '<label style="display:flex;align-items:center;gap:4px;white-space:nowrap"><input type="checkbox" class="inj-odem" data-id="' + escHtml(inj.id) + '"' + (inj.odem?' checked':'') + '> Odem</label>'
        + '<label style="display:flex;align-items:center;gap:4px;white-space:nowrap"><input type="checkbox" class="inj-hass" data-id="' + escHtml(inj.id) + '"' + (inj.hassasiyet?' checked':'') + '> Hassasiyet</label>'
        + '<label style="display:flex;align-items:center;gap:4px;white-space:nowrap"><input type="checkbox" class="inj-kiz" data-id="' + escHtml(inj.id) + '"' + (inj.kizariklik?' checked':'') + '> Kizariklik</label>'
        + '</div></td>';

    // Completed
    html += '<td><label class="check-wrap"><input type="checkbox" class="inj-check" data-id="' + escHtml(inj.id) + '"' + (inj.completed?' checked':'') + '></label></td>';

    // Notes
    html += '<td><input type="text" class="note-input" data-id="' + escHtml(inj.id) + '" maxlength="200" placeholder="Not..." value="' + escHtml(inj.notes||'') + '" style="min-width:120px"></td>';

    // Save btn
    html += '<td><button class="btn btn-primary btn-sm save-btn" data-id="' + escHtml(inj.id) + '">Kaydet</button></td>';
    html += '</tr>';
    return html;
}

// ===== SAVE ROW =====
async function saveRow(id, btn) {
    const row = document.querySelector('tr[data-id="' + id + '"]');
    if (!row) return;
    const completed  = row.querySelector('.inj-check')?.checked ?? false;
    const notes      = (row.querySelector('.note-input')?.value||'').substring(0,200);
    const site       = row.querySelector('.inj-site')?.value || '';
    const odem       = row.querySelector('.inj-odem')?.checked ?? false;
    const hassasiyet = row.querySelector('.inj-hass')?.checked ?? false;
    const kizariklik = row.querySelector('.inj-kiz')?.checked  ?? false;

    const origText = btn.textContent;
    btn.disabled = true; btn.textContent = '...';
    try {
        await getUserDoc('injections', id).set(
            { completed, notes, site, odem, hassasiyet, kizariklik,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );
        const item = allSchedule.find(i => i.id === id);
        if (item) Object.assign(item, { completed, notes, site, odem, hassasiyet, kizariklik });
        updateStats();
        renderSiteRotation();
        showToast('Kaydedildi ✓', 'success', 2000);
        btn.textContent = '✓';
        setTimeout(() => { btn.disabled = false; btn.textContent = origText; }, 1600);
    } catch (err) {
        showToast('Kayit hatasi: ' + err.message, 'error');
        btn.disabled = false; btn.textContent = origText;
    }
}

// ===== TOOLBAR =====
function bindToolbar() {
    document.getElementById('resetAll')?.addEventListener('click', async () => {
        if (!confirm('Tum enjeksiyon kayitlari silinecek.\nEmin misiniz?')) return;
        try {
            const batch = db.batch();
            allSchedule.forEach(i => batch.delete(getUserDoc('injections', i.id)));
            await batch.commit();
            savedData   = {};
            allSchedule = allSchedule.map(i => ({ ...i, completed:false, notes:'', site:'', odem:false, hassasiyet:false, kizariklik:false }));
            renderAll(); renderSiteRotation();
            showToast('Tum kayitlar sifirlanadi', 'success');
        } catch (err) { showToast('Sifirlama hatasi', 'error'); }
    });
    document.getElementById('exportCSV')?.addEventListener('click', exportCSV);
    document.getElementById('exportPDF')?.addEventListener('click', exportPDF);
}

// ===== EXPORT CSV =====
function exportCSV() {
    const usePlan = !!(activePlan?.compounds?.length);
    let heads = ['ID','Hafta','Tarih','Gun'];
    if (usePlan) {
        activePlan.compounds.forEach(c => heads.push((c.shortName||c.name)+' (mL)'));
    } else {
        heads.push('Test E (mL)', 'Masteron P (mL)');
    }
    heads.push('Toplam (mL)','Bolge','Odem','Hassasiyet','Kizariklik','Yapildi','Not');
    const rows = [heads];
    allSchedule.forEach(i => {
        const row = [i.id, i.week, i.date, i.dayName];
        let totalMl = 0;
        if (usePlan && activePlan.compounds) {
            activePlan.compounds.forEach(c => {
                const entry = i.compounds?.find(ic => ic.id === c.id);
                if (entry) {
                    const ml = parseFloat(c.mlPerInj) || 0;
                    totalMl += ml;
                    row.push(ml.toFixed(2));
                } else {
                    row.push('—');
                }
            });
        } else {
            const testDose = parseFloat(i.testDose) || 0.67;
            const mastDose = parseFloat(i.masteronDose) || 1.00;
            totalMl = testDose + mastDose;
            row.push(testDose.toFixed(2), mastDose.toFixed(2));
        }
        row.push(totalMl.toFixed(2), i.site||'', i.odem?'Evet':'Hayir', i.hassasiyet?'Evet':'Hayir', i.kizariklik?'Evet':'Hayir', i.completed?'Evet':'Hayir', '"'+(i.notes||'').replace(/"/g,'""')+'"');
        rows.push(row);
    });
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'enjeksiyon-takvimi.csv');
    showToast('CSV indirildi', 'success');
}

// ===== EXPORT PDF =====
function exportPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14);
        doc.text('Anabolik Kur - Enjeksiyon Takvimi', 14, 16);
        doc.setFontSize(9); doc.setTextColor(120);
        const done  = allSchedule.filter(i=>i.completed).length;
        const label = activePlan ? activePlan.name : 'Varsayilan Plan';
        doc.text('Plan: ' + label + '  |  ' + done + '/' + allSchedule.length + ' Tamamlandi  |  ' + new Date().toLocaleDateString('tr-TR'), 14, 22);

        const usePlan = !!(activePlan?.compounds?.length);
        let cmpCols = usePlan
            ? activePlan.compounds.map(c => c.shortName || c.name)
            : ['Test E','Mast P'];
        const headers = [['Hf.','Tarih','Gun',...cmpCols,'Toplam','Bolge','Odem','Hass.','Kiz.','Yapildi','Not']];
        const body = allSchedule.map(i => {
            const doses = [];
            let totalMl = 0;
            if (usePlan && activePlan.compounds) {
                activePlan.compounds.forEach(c => {
                    const entry = i.compounds?.find(ic => ic.id === c.id);
                    if (entry) {
                        const ml = parseFloat(c.mlPerInj) || 0;
                        totalMl += ml;
                        doses.push(ml.toFixed(2));
                    } else {
                        doses.push('—');
                    }
                });
            } else {
                const testDose = parseFloat(i.testDose) || 0.67;
                const mastDose = parseFloat(i.masteronDose) || 1.00;
                totalMl = testDose + mastDose;
                doses.push(testDose.toFixed(2), mastDose.toFixed(2));
            }
            return ['H'+i.week, i.date, (i.dayName||'').substring(0,3),
                ...doses, totalMl.toFixed(2),
                i.site||'—', i.odem?'E':'H', i.hassasiyet?'E':'H', i.kizariklik?'E':'H',
                i.completed?'EVET':'HAYIR', (i.notes||'').substring(0,30)];
        });
        doc.autoTable({
            startY: 28, head: headers, body,
            theme: 'grid',
            headStyles: { fillColor:[124,58,237] },
            alternateRowStyles: { fillColor:[28,28,40] },
            styles: { fontSize:7.5, textColor:[230,230,240] },
            didParseCell: d => {
                if (d.section==='body') {
                    const yapilaCol = headers[0].indexOf('Yapildi');
                    if (d.column.index===yapilaCol) {
                        d.cell.styles.textColor = d.cell.raw==='EVET' ? [16,185,129] : [239,68,68];
                        d.cell.styles.fontStyle='bold';
                    }
                }
            }
        });
        doc.save('enjeksiyon-raporu.pdf');
        showToast('PDF olusturuldu', 'success');
    } catch (err) {
        showToast('PDF hatasi: ' + err.message, 'error');
    }
}

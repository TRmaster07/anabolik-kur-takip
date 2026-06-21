// ===== CONSTANTS =====
const COMPOUND_PRESETS = [
    { name: 'Testosteron Enanthate',       shortName: 'Test E',    concentration: 250 },
    { name: 'Testosteron Cypionate',       shortName: 'Test C',    concentration: 200 },
    { name: 'Testosteron Propionate',      shortName: 'Test P',    concentration: 100 },
    { name: 'Masteron Propionate',         shortName: 'Mast P',    concentration: 100 },
    { name: 'Masteron Enanthate',          shortName: 'Mast E',    concentration: 200 },
    { name: 'Nandrolone Decanoate (Deca)', shortName: 'Deca',      concentration: 250 },
    { name: 'Trenbolone Enanthate',        shortName: 'Tren E',    concentration: 200 },
    { name: 'Trenbolone Acetate',          shortName: 'Tren A',    concentration: 100 },
    { name: 'Boldenone (EQ)',              shortName: 'EQ',        concentration: 250 },
    { name: 'Winstrol (Stanozolol)',       shortName: 'Winstrol',  concentration: 50  },
    { name: 'Primobolan Enanthate',        shortName: 'Primo E',   concentration: 100 },
    { name: 'Anavar (Oxandrolone)',        shortName: 'Anavar',    concentration: 0   },
    { name: 'Ozel / Diger',               shortName: 'Ozel',      concentration: 0   },
];
const PHASE_TYPES = [
    { value: 'blast',  label: 'Blast',     color: '#ef4444' },
    { value: 'cruise', label: 'Cruise',    color: '#3b82f6' },
    { value: 'pct',    label: 'PCT',       color: '#10b981' },
    { value: 'off',    label: 'Duraklama', color: '#64748b' },
    { value: 'custom', label: 'Ozel',      color: '#f59e0b' },
];
const DAYS_TR   = ['Paz','Pzt','Sal','Car','Per','Cum','Cmt'];
const DAYS_FULL = ['Pazar','Pazartesi','Sali','Carsamba','Persembe','Cuma','Cumartesi'];

// ===== STATE =====
let plan = null;          // null = no saved plan yet
let editDraft = null;     // working copy during editing
let viewMode = 'list';    // 'list' | 'edit'
let cIdCounter = 20, pIdCounter = 20;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    requireAuth(user => {
        renderNav('plan', user);
        loadPlan();
    });
});

async function loadPlan() {
    try {
        const doc = await db.collection('plan').doc('main').get();
        if (doc.exists) {
            const d = doc.data();
            if (d && d.name) {
                plan = d;
                cIdCounter = (plan.compounds||[]).length + 20;
                pIdCounter = (plan.phases||[]).length + 20;
            }
        }
    } catch(e) { console.error(e); }
    renderPage();
}

// ===== TOP-LEVEL RENDER =====
function renderPage() {
    const cont = document.getElementById('planPageContent');
    if (!cont) return;
    if (viewMode === 'list') {
        cont.innerHTML = renderListView();
    } else {
        cont.innerHTML = renderEditView();
        bindEditForm();
    }
}

// ===== LIST VIEW =====
function renderListView() {
    if (!plan) {
        return `<div class="empty-state" style="padding:60px 20px">
            <div class="empty-icon">📋</div>
            <p>Henuz bir kur plani olusturmadiniz.</p>
            <button class="btn btn-primary" style="margin-top:16px" onclick="newPlan()">+ Yeni Plan Olustur</button>
        </div>`;
    }
    const today = new Date(); today.setHours(0,0,0,0);
    const PHASE_COLORS = { blast:'#ef4444', cruise:'#3b82f6', pct:'#10b981', off:'#64748b', custom:'#f59e0b' };
    const injDayNames = getPlanInjectionDayUnion(plan).map(i => DAYS_TR[i] || '').join('/');
    const previewPlan = { ...plan, totalWeeks: plan.totalWeeks || 0, startDate: plan.startDate || '' };
    const totalInj = plan.startDate ? generateScheduleFromPlan(previewPlan).length : 0;
    const totalVol = ((plan.compounds||[]).reduce((s,c)=>s+(parseFloat(c.mlPerInj)||0),0)).toFixed(2);

    // Active phase
    let activePhaseHtml = '';
    const activePhase = (plan.phases||[]).find(p => {
        if (!p.startDate||!p.endDate) return false;
        const s=new Date(p.startDate+' 00:00:00'), e=new Date(p.endDate+' 00:00:00');
        return today>=s && today<=e;
    });
    if (activePhase) {
        const tc = PHASE_TYPES.find(t=>t.value===activePhase.type)||PHASE_TYPES[0];
        const dLeft = Math.ceil((new Date(activePhase.endDate+' 00:00:00')-today)/86400000);
        activePhaseHtml = `<span class="phase-badge" style="background:${tc.color}22;color:${tc.color};border:1px solid ${tc.color}44">${tc.label}: ${escHtml(activePhase.name)} — ${dLeft} gun kaldi</span>`;
    }

    // Compounds rows
    const cmpHtml = (plan.compounds||[]).map(c => {
        const cDays = getCompoundInjectionDays(c, plan).map(i => DAYS_TR[i] || '').join('/');
        return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.875rem;gap:12px;flex-wrap:wrap">
            <span><strong>${escHtml(c.shortName||c.name)}</strong> — ${escHtml(c.name)}<br><span style="font-size:0.78rem;color:var(--text-muted)">Gunler: ${escHtml(cDays || '—')}</span></span>
            <span style="color:var(--text-secondary)">${c.weeklyDose||0} mg/hf &nbsp;→&nbsp; <strong style="color:var(--accent-text)">${parseFloat(c.mlPerInj||0).toFixed(2)} mL/enj</strong></span>
         </div>`;
    }).join('');

    // Phases rows
    const phHtml = (plan.phases||[]).map(p => {
        const tc = PHASE_TYPES.find(t=>t.value===p.type)||PHASE_TYPES[0];
        const dur = (p.startDate&&p.endDate)
            ? Math.ceil((new Date(p.endDate+' 00:00:00')-new Date(p.startDate+' 00:00:00'))/86400000/7) + ' hf'
            : '—';
        return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.875rem">
            <span style="width:10px;height:10px;border-radius:50%;background:${tc.color};flex-shrink:0"></span>
            <span class="phase-badge" style="background:${tc.color}22;color:${tc.color};border:1px solid ${tc.color}44;padding:2px 8px;font-size:0.75rem">${tc.label}</span>
            <strong>${escHtml(p.name)}</strong>
            <span style="color:var(--text-muted)">${escHtml(p.startDate||'?')} → ${escHtml(p.endDate||'?')} (${dur})</span>
        </div>`;
    }).join('');

    return `
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" onclick="editPlan()">✏️ Duzenleme</button>
        <button class="btn btn-secondary" onclick="applyPlan()">🔄 Takvime Uygula</button>
        <button class="btn btn-danger" onclick="deletePlan()" style="margin-left:auto">🗑 Plani Sil</button>
    </div>

    <div class="card" style="margin-bottom:16px">
        <div class="card-header">
            <span class="card-title" style="font-size:1.2rem">📋 ${escHtml(plan.name||'Plan')}</span>
            ${activePhaseHtml}
        </div>
        <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:10px;font-size:0.875rem;color:var(--text-secondary)">
            <span>📅 Baslangic: <strong style="color:var(--text-primary)">${escHtml(plan.startDate||'—')}</strong></span>
            <span>📆 Sure: <strong style="color:var(--text-primary)">${plan.totalWeeks||0} hafta</strong></span>
            <span>💉 Gunler: <strong style="color:var(--text-primary)">${injDayNames}</strong></span>
            <span>💊 Toplam: <strong style="color:var(--accent-text)">${totalVol} mL/enj</strong></span>
            <span>🔢 Toplam enj: <strong style="color:var(--text-primary)">${totalInj}</strong></span>
        </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px">
        <div class="card">
            <div class="section-title" style="margin-bottom:10px">💊 Bilesikler</div>
            ${cmpHtml || '<span style="color:var(--text-muted);font-size:0.85rem">Bilesik yok</span>'}
        </div>
        <div class="card">
            <div class="section-title" style="margin-bottom:10px">📆 Donemler</div>
            ${phHtml || '<span style="color:var(--text-muted);font-size:0.85rem">Donem tanimlanmamis</span>'}
        </div>
    </div>

    <button class="btn btn-secondary" onclick="newPlan()" style="font-size:0.82rem">+ Yeni Plan Olustur (mevcut plani degistirir)</button>
    <button class="btn btn-warning" onclick="archivePlan()" style="font-size:0.82rem;margin-left:8px">📦 Kuru Sonlandir ve Arşivle</button>
    <button class="btn btn-secondary" onclick="showArchivedPlans()" style="font-size:0.82rem;margin-left:8px">📚 Arşivlenmiş Kürler</button>`;
}

// ===== EDIT VIEW =====
function renderEditView() {
    const p = editDraft;
    const injDayCheckboxes = DAYS_TR.map((d,i) => {
        const sel = (p.injectionDays||[]).includes(i);
        return `<label class="day-cb-label${sel?' selected':''}" id="daylbl_${i}">
            <input type="checkbox" onchange="toggleDay(${i},this.checked)"${sel?' checked':''}>${d}
        </label>`;
    }).join('');

    return `
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
        <button class="btn btn-primary" id="saveEditBtn" onclick="saveEdit()">💾 Kaydet</button>
        <button class="btn btn-secondary" onclick="cancelEdit()">✕ Iptal</button>
        <span id="saveStatus" style="display:flex;align-items:center;font-size:0.82rem;color:var(--text-muted)"></span>
    </div>

    <div class="card" style="margin-bottom:20px">
        <div class="section-title">⚙️ Temel Ayarlar</div>
        <div class="form-row-3">
            <div class="form-group">
                <label class="form-label">Kur Adi</label>
                <input type="text" id="planName" class="form-control" value="${escHtml(p.name||'')}" maxlength="100" placeholder="Kur 2026">
            </div>
            <div class="form-group">
                <label class="form-label">Baslangic Tarihi</label>
                <input type="date" id="planStart" class="form-control" value="${escHtml(p.startDate||'')}">
            </div>
            <div class="form-group">
                <label class="form-label">Toplam Hafta</label>
                <input type="number" id="planWeeks" class="form-control" value="${p.totalWeeks||13}" min="1" max="52">
            </div>
        </div>
        <div class="section-title" style="margin-top:16px">📅 Varsayilan Enjeksiyon Gunleri</div>
        <p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 8px">Yeni bilesikler icin varsayilan gunler. Her bilesikte ayri ayarlanabilir.</p>
        <div class="day-checkboxes">${injDayCheckboxes}</div>
        <button type="button" class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="applyDefaultDaysToAll()">Tum bilesiklere uygula</button>
        <div class="schedule-preview" id="schedulePreview">...</div>
    </div>

    <div class="card" style="margin-bottom:20px">
        <div class="card-header">
            <span class="card-title">💊 Bilesikler</span>
            <button class="btn btn-secondary btn-sm" onclick="addCompound()">+ Bilesik Ekle</button>
        </div>
        <div id="compoundsContainer"></div>
        <div class="total-vol-display" id="totalVolumeDisplay"></div>
    </div>

    <div class="card" style="margin-bottom:20px">
        <div class="card-header">
            <span class="card-title">📆 Donemler (Blast / Cruise / PCT)</span>
            <button class="btn btn-secondary btn-sm" onclick="addPhase()">+ Donem Ekle</button>
        </div>
        <div id="phasesContainer"></div>
    </div>`;
}

function bindEditForm() {
    renderCompounds();
    renderPhases();
    updatePreview();
    const ps = document.getElementById('planStart');
    const pw = document.getElementById('planWeeks');
    if (ps) ps.addEventListener('input', () => { editDraft.startDate=ps.value; updatePreview(); });
    if (pw) pw.addEventListener('input', () => { editDraft.totalWeeks=parseInt(pw.value)||13; updatePreview(); });
}

// ===== ACTIONS =====
async function showArchivedPlans() {
    viewMode = 'archivedList';
    const cont = document.getElementById('planPageContent');
    if (!cont) return;
    
    cont.innerHTML = '<div class="loading"><div class="spinner"></div> Arşiv yükleniyor...</div>';
    
    const archived = await loadArchivedPlans();
    
    if (archived.length === 0) {
        cont.innerHTML = `
            <div class="empty-state" style="padding:60px 20px">
                <div class="empty-icon">📦</div>
                <p>Henüz arşivlenmiş kür yok.</p>
                <button class="btn btn-secondary" onclick="viewMode='list';renderPage()" style="margin-top:16px">← Geri Dön</button>
            </div>`;
        return;
    }
    
    const listHtml = archived.map(a => {
        const date = a.archivedAt ? new Date(a.archivedAt).toLocaleDateString('tr-TR') : '—';
        const planName = a.planData?.name || 'İsimsiz Plan';
        const weeks = a.planData?.totalWeeks || 0;
        const compounds = (a.planData?.compounds || []).length;
        
        return `<div class="card" style="margin-bottom:12px;cursor:pointer" onclick="viewArchivedPlan('${a.id}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-weight:700;font-size:1rem;margin-bottom:4px">${escHtml(planName)}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary)">
                        ${weeks} hafta · ${compounds} bileşik · Sonlandırma: ${date}
                    </div>
                </div>
                <span class="badge badge-info">📦 Arşiv</span>
            </div>
        </div>`;
    }).join('');
    
    cont.innerHTML = `
        <div style="display:flex;align-items:center;margin-bottom:20px">
            <button class="btn btn-secondary" onclick="viewMode='list';renderPage()">← Geri Dön</button>
            <h3 style="margin-left:16px">📚 Arşivlenmiş Kürler (${archived.length})</h3>
        </div>
        ${listHtml}`;
}

function newPlan() {
    editDraft = {
        name: 'Kur 2026', startDate: '', totalWeeks: 13,
        injectionDays: [1, 3, 5],
        compounds: [
            { id: 'c1', name: 'Testosteron Enanthate', shortName: 'Test E', concentration: 250, weeklyDose: 500, mlPerInj: 0, injectionDays: [1, 3, 5] },
            { id: 'c2', name: 'Masteron Propionate', shortName: 'Mast P', concentration: 100, weeklyDose: 300, mlPerInj: 0, injectionDays: [1, 3, 5] },
        ],
        phases: []
    };
    cIdCounter = 20; pIdCounter = 20;
    viewMode = 'edit';
    renderPage();
}

function editPlan() {
    editDraft = JSON.parse(JSON.stringify(plan));
    editDraft.compounds?.forEach(c => {
        if (!c.injectionDays?.length) c.injectionDays = [...(editDraft.injectionDays || [1, 3, 5])];
    });
    if (!editDraft.injectionDays?.length) editDraft.injectionDays = getPlanInjectionDayUnion(editDraft);
    cIdCounter = (editDraft.compounds||[]).length + 20;
    pIdCounter = (editDraft.phases||[]).length + 20;
    viewMode = 'edit';
    renderPage();
}

function cancelEdit() {
    viewMode = 'list';
    renderPage();
}

async function deletePlan() {
    if (!confirm('Kur plani silinecek.\nEmin misiniz?')) return;
    try {
        await db.collection('plan').doc('main').delete();
        plan = null;
        viewMode = 'list';
        showToast('Plan silindi', 'success');
        renderPage();
    } catch(e) { showToast('Silme hatasi: '+e.message, 'error'); }
}

async function archivePlan() {
    if (!plan) { showToast('Aktif plan yok', 'warning'); return; }
    if (!confirm('Kur sonlandırılıp arşivlenecek.\nAktif plan silinecek. Tüm veriler arşivde korunacak. Emin misiniz?')) return;
    try {
        const archivedAt = new Date().toISOString();
        const endDate = plan.endDate || formatDateISO(new Date());
        
        // Arşivle
        const archivedRef = await db.collection('archivedPlans').add({
            planData: JSON.parse(JSON.stringify(plan)),
            archivedAt: archivedAt,
            endDate: endDate,
            totalWeeks: plan.totalWeeks || 13,
            totalInjections: generateScheduleFromPlan(plan).length
        });
        
        // Fotoğrafları da arşivle
        await archivePhotos(archivedRef.id);
        
        // Aktif planı sil
        await db.collection('plan').doc('main').delete();
        plan = null;
        
        showToast('Kur sonlandırıldı ve arşivlendi ✓', 'success');
        renderPage();
    } catch(e) { showToast('Arşivleme hatası: '+e.message, 'error'); }
}

async function archivePhotos(archivedPlanId) {
    try {
        const snap = await db.collection('photos').get();
        const batch = db.batch();
        
        snap.forEach(doc => {
            const data = doc.data();
            batch.update(doc.ref, {
                archivedPlanId: archivedPlanId,
                archivedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch.commit();
        console.log('Fotoğraflar arşivlendi');
    } catch(e) {
        console.error('Fotoğraf arşivleme hatası:', e);
    }
}

async function loadArchivedPlans() {
    try {
        const snap = await db.collection('archivedPlans').orderBy('archivedAt', 'desc').get();
        const plans = [];
        snap.forEach(doc => {
            const data = doc.data();
            plans.push({
                id: doc.id,
                ...data
            });
        });
        return plans;
    } catch(e) {
        console.error('Arşiv yükleme hatası:', e);
        return [];
    }
}

async function viewArchivedPlan(archivedId) {
    try {
        const doc = await db.collection('archivedPlans').doc(archivedId).get();
        if (doc.exists) {
            const archived = doc.data();
            const archivedPlan = archived.planData;
            
            // Geçici olarak planı göster
            viewMode = 'archived';
            window.currentArchivedPlan = archivedPlan;
            window.currentArchivedId = archivedId;
            renderArchivedView(archivedPlan, archived);
        }
    } catch(e) { showToast('Yükleme hatası: '+e.message, 'error'); }
}

function renderArchivedView(archivedPlan, archived) {
    const cont = document.getElementById('planPageContent');
    if (!cont) return;
    
    const today = new Date(); today.setHours(0,0,0,0);
    const PHASE_COLORS = { blast:'#ef4444', cruise:'#3b82f6', pct:'#10b981', off:'#64748b', custom:'#f59e0b' };
    const PHASE_LABELS = { blast:'Blast', cruise:'Cruise', pct:'PCT', off:'Duraklama', custom:'Özel' };
    const injDayNames = getPlanInjectionDayUnion(archivedPlan).map(i => DAYS_TR[i] || '').join('/');
    const schedule = archivedPlan.startDate ? generateScheduleFromPlan(archivedPlan) : [];
    const totalInj = schedule.length;
    const totalVol = ((archivedPlan.compounds||[]).reduce((s,c)=>s+(parseFloat(c.mlPerInj)||0),0)).toFixed(2);
    
    // Haftalara göre toplam doz hesapla
    const weeklyTotals = {};
    schedule.forEach(inj => {
        const week = inj.week;
        if (!weeklyTotals[week]) weeklyTotals[week] = 0;
        weeklyTotals[week] += inj.totalVolume || 0;
    });

    // Active phase
    let activePhaseHtml = '';
    const activePhase = (archivedPlan.phases||[]).find(p => {
        if (!p.startDate||!p.endDate) return false;
        const s=new Date(p.startDate+' 00:00:00'), e=new Date(p.endDate+' 00:00:00');
        return today>=s && today<=e;
    });
    if (activePhase) {
        const tc = PHASE_COLORS[activePhase.type] || '#f59e0b';
        const dLeft = Math.ceil((new Date(activePhase.endDate+' 00:00:00')-today)/86400000);
        activePhaseHtml = `<span class="phase-badge" style="background:${tc}22;color:${tc};border:1px solid ${tc}44">${PHASE_LABELS[activePhase.type] || activePhase.type}: ${escHtml(activePhase.name)}</span>`;
    }

    // Detaylı bileşikler
    const cmpHtml = (archivedPlan.compounds||[]).map(c => {
        const cDays = getCompoundInjectionDays(c, archivedPlan).map(i => DAYS_TR[i] || '').join('/');
        const weeklyDoses = c.weeklyDoses || {};
        let doseDetails = '';
        if (Object.keys(weeklyDoses).length > 0) {
            doseDetails = '<div style="margin-top:6px;font-size:0.75rem;color:var(--text-muted)">Haftalık Dozlar: ';
            const doses = Object.entries(weeklyDoses).slice(0, 5).map(([w, d]) => 'H' + w + ':' + d + 'mg');
            doseDetails += doses.join(', ');
            if (Object.keys(weeklyDoses).length > 5) doseDetails += '...';
            doseDetails += '</div>';
        }
        
        return `<div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-sm);margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                    <strong style="font-size:0.95rem">${escHtml(c.shortName||c.name)}</strong>
                    ${c.customName ? '<span style="font-size:0.8rem;color:var(--text-muted);margin-left:6px">(' + escHtml(c.customName) + ')</span>' : ''}
                </div>
                <span class="badge badge-info">${c.weeklyDose||0} mg/hf</span>
            </div>
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:4px">
                Konsantrasyon: <strong>${c.concentration} mg/mL</strong> | Enj. Başına: <strong>${parseFloat(c.mlPerInj||0).toFixed(2)} mL</strong>
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted)">Enjeksiyon Günleri: ${escHtml(cDays || '—')}</div>
            ${doseDetails}
        </div>`;
    }).join('');

    // Detaylı dönemler
    const phHtml = (archivedPlan.phases||[]).map(p => {
        const tc = PHASE_COLORS[p.type] || '#f59e0b';
        const label = PHASE_LABELS[p.type] || p.type;
        const dur = (p.startDate&&p.endDate)
            ? Math.ceil((new Date(p.endDate+' 00:00:00')-new Date(p.startDate+' 00:00:00'))/86400000/7) + ' hafta'
            : '—';
        const startFormatted = p.startDate ? formatDate(p.startDate) : '?';
        const endFormatted = p.endDate ? formatDate(p.endDate) : '?';
        
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg-secondary);border-radius:var(--radius-sm);margin-bottom:8px;border-left:3px solid ${tc}">
            <span style="width:12px;height:12px;border-radius:50%;background:${tc};flex-shrink:0"></span>
            <div style="flex:1">
                <div style="font-weight:700;font-size:0.9rem;margin-bottom:2px">${escHtml(p.name)}</div>
                <div style="font-size:0.78rem;color:var(--text-muted)">
                    ${startFormatted} → ${endFormatted} (${dur})
                </div>
            </div>
            <span class="badge" style="background:${tc}22;color:${tc};border:1px solid ${tc}44;padding:3px 10px;font-size:0.72rem">${label}</span>
        </div>`;
    }).join('');

    // Haftalık ilerleme özeti
    const progressHtml = schedule.length > 0 ? `
        <div class="card" style="margin-bottom:16px">
            <div class="section-title" style="margin-bottom:12px">📊 Haftalık Hacim Özeti</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px">
                ${Object.entries(weeklyTotals).map(([week, vol]) => `
                    <div style="text-align:center;padding:6px;background:var(--bg-secondary);border-radius:6px">
                        <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:2px">H${week}</div>
                        <div style="font-size:0.82rem;font-weight:700;color:var(--accent-text)">${vol.toFixed(1)}</div>
                        <div style="font-size:0.65rem;color:var(--text-muted)">mL</div>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    const archivedDate = archived.archivedAt ? new Date(archived.archivedAt).toLocaleDateString('tr-TR', { 
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    }) : '—';
    
    cont.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="viewMode='list';renderPage()">← Geri Dön</button>
        <span class="badge badge-warning" style="margin-left:auto;align-self:center">📦 Arşiv: ${archivedDate}</span>
    </div>

    <div class="card" style="margin-bottom:16px;border-left:4px solid var(--accent)">
        <div class="card-header">
            <span class="card-title" style="font-size:1.3rem">📋 ${escHtml(archivedPlan.name||'Plan')}</span>
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:12px;font-size:0.875rem">
            <div style="flex:1;min-width:200px">
                <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">📅 Başlangıç</div>
                <div style="font-weight:600">${escHtml(archivedPlan.startDate||'—')}</div>
            </div>
            <div style="flex:1;min-width:200px">
                <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">📆 Süre</div>
                <div style="font-weight:600">${archivedPlan.totalWeeks||0} hafta</div>
            </div>
            <div style="flex:1;min-width:200px">
                <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">💉 Enjeksiyon Günleri</div>
                <div style="font-weight:600">${injDayNames || '—'}</div>
            </div>
            <div style="flex:1;min-width:200px">
                <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">🔢 Toplam Enjeksiyon</div>
                <div style="font-weight:600;color:var(--accent-text)">${totalInj}</div>
            </div>
        </div>
    </div>

    ${progressHtml}

    <div class="grid-2" style="margin-bottom:16px">
        <div class="card">
            <div class="section-title" style="margin-bottom:12px">💊 Bileşikler (${(archivedPlan.compounds||[]).length})</div>
            ${cmpHtml || '<span style="color:var(--text-muted);font-size:0.85rem">Bileşik yok</span>'}
        </div>
        <div class="card">
            <div class="section-title" style="margin-bottom:12px">📆 Dönemler (${(archivedPlan.phases||[]).length})</div>
            ${phHtml || '<span style="color:var(--text-muted);font-size:0.85rem">Dönem tanımlanmamış</span>'}
        </div>
    </div>

    <div class="card" style="background:linear-gradient(135deg, rgba(124,58,237,0.1), rgba(245,158,11,0.1));border:1px solid rgba(124,58,237,0.3)">
        <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6">
            <strong style="font-size:0.9rem">📦 Arşiv Bilgisi:</strong><br>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px">
                <div>Sonlandırma Tarihi: <strong>${archivedDate}</strong></div>
                <div>Toplam Hacim/Enj: <strong>${totalVol} mL</strong></div>
                <div>Bileşik Sayısı: <strong>${(archivedPlan.compounds||[]).length}</strong></div>
                <div>Dönem Sayısı: <strong>${(archivedPlan.phases||[]).length}</strong></div>
            </div>
            <div style="margin-top:10px;padding:10px;background:rgba(0,0,0,0.2);border-radius:6px;font-size:0.78rem">
                ⚠️ Bu plan arşivlenmiştir ve değiştirilemez. Tüm veriler korunmaktadır.
            </div>
        </div>
    </div>`;
}

async function saveEdit() {
    // Collect basic fields
    editDraft.name       = (document.getElementById('planName')?.value||'').trim().substring(0,100) || 'Kur Plani';
    editDraft.startDate  = document.getElementById('planStart')?.value || '';
    editDraft.totalWeeks = parseInt(document.getElementById('planWeeks')?.value)||13;
    if (!editDraft.startDate)             { showToast('Baslangic tarihi giriniz','error'); return; }
    if (!editDraft.compounds?.length)     { showToast('En az bir bilesik ekleyin','error'); return; }
    if (!editDraft.compounds.every(c => getCompoundInjectionDays(c, editDraft).length)) {
        showToast('Her bilesik icin en az bir enj. gunu secin','error');
        return;
    }
    editDraft.injectionDays = getPlanInjectionDayUnion(editDraft);

    const btn = document.getElementById('saveEditBtn');
    btn.disabled = true; btn.textContent = 'Kaydediliyor...';
    try {
        const d = JSON.parse(JSON.stringify(editDraft));
        d.savedAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('plan').doc('main').set(d);
        plan = JSON.parse(JSON.stringify(editDraft));
        viewMode = 'list';
        showToast('Plan kaydedildi', 'success');
        renderPage();
    } catch(err) {
        showToast('Kayit hatasi: '+err.message, 'error');
        btn.disabled = false; btn.textContent = '💾 Kaydet';
    }
}

async function applyPlan() {
    if (!plan) { showToast('Once bir plan olusturun','warning'); return; }
    if (!confirm('Enjeksiyon takvimi plan ile yenilenecek.\nMevcut tamamlama/notlar korunur. Devam?')) return;
    const schedule = generateScheduleFromPlan(plan);
    try {
        const snap = await db.collection('injections').get();
        const existing = {};
        snap.forEach(doc => { existing[doc.id] = doc.data(); });
        const batch = db.batch();
        schedule.forEach(inj => {
            const ex = existing[inj.id] || {};
            batch.set(db.collection('injections').doc(inj.id), {
                ...inj,
                completed:  ex.completed  ?? false,
                notes:      ex.notes      ?? '',
                site:       ex.site       ?? '',
                odem:       ex.odem       ?? false,
                hassasiyet: ex.hassasiyet ?? false,
                kizariklik: ex.kizariklik ?? false,
            });
        });
        await batch.commit();
        showToast(schedule.length + ' enjeksiyon takvime islendi', 'success');
    } catch(err) { showToast('Hata: '+err.message,'error'); }
}

// ===== DAYS =====
function toggleDay(i, checked) {
    if (!editDraft) return;
    if (!editDraft.injectionDays) editDraft.injectionDays = [];
    editDraft.injectionDays = checked
        ? [...new Set([...editDraft.injectionDays, i])].sort((a, b) => a - b)
        : editDraft.injectionDays.filter(d => d !== i);
    const lbl = document.getElementById('daylbl_' + i);
    if (lbl) lbl.className = 'day-cb-label' + (checked ? ' selected' : '');
    updatePreview();
}

function applyDefaultDaysToAll() {
    if (!editDraft?.compounds?.length) return;
    const days = [...(editDraft.injectionDays || [])];
    if (!days.length) { showToast('Once varsayilan gun secin','warning'); return; }
    editDraft.compounds.forEach(c => { c.injectionDays = [...days]; });
    renderCompounds();
    updatePreview();
    showToast('Gunler tum bilesiklere uygulandi', 'success', 2000);
}

function toggleCompoundDay(compoundId, dayIndex, checked) {
    if (!editDraft) return;
    const c = editDraft.compounds?.find(x => x.id === compoundId);
    if (!c) return;
    if (!c.injectionDays) c.injectionDays = [...(editDraft.injectionDays || [])];
    c.injectionDays = checked
        ? [...new Set([...c.injectionDays, dayIndex])].sort((a, b) => a - b)
        : c.injectionDays.filter(d => d !== dayIndex);
    const lbl = document.getElementById('cdaylbl_' + compoundId + '_' + dayIndex);
    if (lbl) lbl.className = 'day-cb-label day-cb-sm' + (checked ? ' selected' : '');
    calcOne(c);
    updatePreview();
}

function getInjPerWeek(compound) {
    if (compound) return getCompoundInjectionDays(compound, editDraft).length || 1;
    return (editDraft?.injectionDays || []).length || 1;
}

function updatePreview() {
    const w = parseInt(document.getElementById('planWeeks')?.value, 10) || editDraft?.totalWeeks || 0;
    const start = document.getElementById('planStart')?.value || editDraft?.startDate || '';
    const el = document.getElementById('schedulePreview');
    if (!el) return;
    if (!start || !w || !editDraft?.compounds?.length) {
        el.textContent = 'Baslangic tarihi ve bilesikler girildikten sonra onizleme guncellenir';
        return;
    }
    const draft = {
        ...editDraft,
        startDate: start,
        totalWeeks: w,
    };
    const totalInj = generateScheduleFromPlan(draft).length;
    const unionDays = getPlanInjectionDayUnion(draft).map(i => DAYS_TR[i] || '').join('/');
    el.textContent = w + ' hafta · ' + unionDays + ' · toplam ' + totalInj + ' enjeksiyon';
}

// ===== COMPOUNDS =====
function renderCompounds() {
    const cont = document.getElementById('compoundsContainer');
    if (!cont) return;
    if (!editDraft.compounds?.length) {
        cont.innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-icon">💊</div><p>Bilesik eklenmedi</p></div>';
    } else {
        cont.innerHTML = editDraft.compounds.map(buildCompoundRow).join('');
        editDraft.compounds.forEach(c => {
            const sel  = document.getElementById('cs_'+c.id);
            const name = document.getElementById('cn_'+c.id);
            const conc = document.getElementById('cc_'+c.id);
            const dose = document.getElementById('cd_'+c.id);
            if (sel)  sel.addEventListener('change', () => {
                const pr = COMPOUND_PRESETS.find(x=>x.name===sel.value);
                if (pr) { 
                    c.name=pr.name; 
                    c.shortName=pr.shortName; 
                    if(pr.concentration>0){c.concentration=pr.concentration;if(conc)conc.value=pr.concentration;}
                    // Özel isim input'u göster/gizle
                    const customInput = document.getElementById('cn_'+c.id);
                    if (customInput) customInput.style.display = c.name === 'Ozel / Diger' ? 'block' : 'none';
                }
                calcOne(c);
            });
            if (name) name.addEventListener('input', () => { 
                c.customName = name.value; 
                if (c.name === 'Ozel / Diger') {
                    c.shortName = name.value.substring(0, 10) || 'Özel';
                }
            });
            if (conc) conc.addEventListener('input', () => { c.concentration=parseFloat(conc.value)||0; calcOne(c); });
            if (dose) dose.addEventListener('input', () => { 
                c.weeklyDose=parseFloat(dose.value)||0; 
                // Varsayılan dozu tüm haftalara uygula
                if (c.weeklyDoses) {
                    const totalWeeks = parseInt(document.getElementById('planWeeks')?.value) || editDraft?.totalWeeks || 13;
                    for (let w = 1; w <= totalWeeks; w++) {
                        if (c.weeklyDoses[w] === undefined) {
                            c.weeklyDoses[w] = c.weeklyDose;
                        }
                    }
                }
                calcOne(c); 
            });
            // Haftalık doz input'larını bağla
            document.querySelectorAll('.week-dose-input[data-compound="'+c.id+'"]').forEach(input => {
                input.addEventListener('input', () => {
                    const week = parseInt(input.dataset.week);
                    const val = parseFloat(input.value) || 0;
                    if (!c.weeklyDoses) c.weeklyDoses = {};
                    c.weeklyDoses[week] = val;
                    calcOne(c);
                });
            });
            calcOne(c);
        });
    }
    updateTotalVol();
}

function buildCompoundRow(c) {
    if (!c.injectionDays?.length) c.injectionDays = [...(editDraft?.injectionDays || [1, 3, 5])];
    const opts = COMPOUND_PRESETS.map(p =>
        `<option value="${escHtml(p.name)}"${c.name === p.name ? ' selected' : ''}>${escHtml(p.name)}</option>`
    ).join('');
    const dayChecks = DAYS_TR.map((d, i) => {
        const sel = getCompoundInjectionDays(c, editDraft).includes(i);
        return `<label class="day-cb-label day-cb-sm${sel ? ' selected' : ''}" id="cdaylbl_${c.id}_${i}">
            <input type="checkbox" onchange="toggleCompoundDay('${c.id}',${i},this.checked)"${sel ? ' checked' : ''}>${d}
        </label>`;
    }).join('');

    // Haftalara göre doz ayarlama tablosu
    const totalWeeks = parseInt(document.getElementById('planWeeks')?.value) || editDraft?.totalWeeks || 13;
    const weeklyDoses = c.weeklyDoses || {};
    let doseTableHtml = '<div style="margin-top:12px;padding:10px;background:var(--bg-tertiary);border-radius:var(--radius-sm)">';
    doseTableHtml += '<div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);margin-bottom:8px">📊 Haftalara Göre Doz Ayarlama (mg)</div>';
    doseTableHtml += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px">';
    for (let w = 1; w <= totalWeeks; w++) {
        const val = weeklyDoses[w] !== undefined ? weeklyDoses[w] : (c.weeklyDose || 0);
        doseTableHtml += `<div style="text-align:center">
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:2px">H${w}</div>
            <input type="number" class="form-control week-dose-input" data-compound="${c.id}" data-week="${w}" 
                   value="${val}" min="0" max="5000" style="font-size:0.75rem;padding:4px 6px;text-align:center">
        </div>`;
    }
    doseTableHtml += '</div></div>';

    return `<div class="compound-row">
        <div class="compound-fields">
            <div class="form-group" style="flex:2;min-width:200px">
                <label class="form-label">Bilesik</label>
                <select id="cs_${c.id}" class="form-control">${opts}</select>
                <input type="text" id="cn_${c.id}" class="form-control" value="${escHtml(c.customName || '')}" 
                       placeholder="Özel ilaç adı girin..." style="margin-top:6px;font-size:0.8rem;display:${c.name === 'Ozel / Diger' ? 'block' : 'none'}">
            </div>
            <div class="form-group" style="min-width:130px">
                <label class="form-label">Konsantrasyon (mg/mL)</label>
                <input type="number" id="cc_${c.id}" class="form-control" value="${c.concentration}" min="1" max="1000">
            </div>
            <div class="form-group" style="min-width:140px">
                <label class="form-label">Varsayılan Haftalık Doz (mg)</label>
                <input type="number" id="cd_${c.id}" class="form-control" value="${c.weeklyDose}" min="1" max="5000">
            </div>
            <div class="form-group" style="min-width:110px">
                <label class="form-label">Enj. Başına</label>
                <div class="calc-result" id="cm_${c.id}">—</div>
            </div>
            <div style="display:flex;align-items:flex-end;padding-bottom:16px">
                <button class="btn btn-danger btn-sm" onclick="removeCompound('${c.id}')">✕</button>
            </div>
        </div>
        <div style="margin-top:10px">
            <label class="form-label">Enjeksiyon Günleri</label>
            <div class="day-checkboxes compound-day-checkboxes">${dayChecks}</div>
        </div>
        ${doseTableHtml}
    </div>`;
}

function calcOne(c) {
    // Tum planin ortak enjeksiyon gun sayisina bol (union)
    const unionDays = getPlanInjectionDayUnion(editDraft);
    const inj = unionDays.length || 1;
    const weeklyDoses = c.weeklyDoses || {};
    const totalWeeks = parseInt(document.getElementById('planWeeks')?.value) || editDraft?.totalWeeks || 13;
    
    // Ortalama haftalık doz hesapla
    let totalDose = 0;
    let count = 0;
    for (let w = 1; w <= totalWeeks; w++) {
        totalDose += weeklyDoses[w] !== undefined ? weeklyDoses[w] : (c.weeklyDose || 0);
        count++;
    }
    const avgWeeklyDose = count > 0 ? totalDose / count : c.weeklyDose || 0;
    
    c.mlPerInj = c.concentration > 0 ? parseFloat((avgWeeklyDose / c.concentration / inj).toFixed(2)) : 0;
    const el = document.getElementById('cm_'+c.id);
    if (el) el.textContent = c.mlPerInj.toFixed(2) + ' mL';
    updateTotalVol();
}
function recalcAll() { editDraft.compounds?.forEach(c => calcOne(c)); }
function updateTotalVol() {
    const el = document.getElementById('totalVolumeDisplay');
    if (!el || !editDraft) return;
    const start = document.getElementById('planStart')?.value || editDraft.startDate || '';
    const weeks = parseInt(document.getElementById('planWeeks')?.value, 10) || editDraft.totalWeeks || 0;
    if (start && weeks && editDraft.compounds?.length) {
        const vols = [...new Set(generateScheduleFromPlan({ ...editDraft, startDate: start, totalWeeks: weeks }).map(s => s.totalVolume))].sort((a, b) => a - b);
        if (vols.length === 1) {
            el.textContent = 'Toplam: ' + vols[0].toFixed(2) + ' mL / enjeksiyon';
            return;
        }
        if (vols.length > 1) {
            el.textContent = 'Enjeksiyon hacmi: ' + vols[0].toFixed(2) + ' – ' + vols[vols.length - 1].toFixed(2) + ' mL (gune gore degisir)';
            return;
        }
    }
    const total = (editDraft.compounds || []).reduce((s, c) => s + (parseFloat(c.mlPerInj) || 0), 0);
    el.textContent = 'Tum bilesikler ayni gunde: ' + total.toFixed(2) + ' mL / enjeksiyon';
}

function addCompound() {
    const id = 'c' + (++cIdCounter);
    editDraft.compounds.push({
        id,
        name: 'Testosteron Enanthate',
        shortName: 'Test E',
        customName: '',
        concentration: 250,
        weeklyDose: 500,
        weeklyDoses: {},
        mlPerInj: 0,
        injectionDays: [...(editDraft.injectionDays || [1, 3, 5])],
    });
    renderCompounds();
    updatePreview();
}
function removeCompound(id) {
    editDraft.compounds = editDraft.compounds.filter(c => c.id !== id);
    renderCompounds();
    updatePreview();
}

// ===== PHASES =====
function renderPhases() {
    const cont = document.getElementById('phasesContainer');
    if (!cont) return;
    if (!editDraft.phases?.length) {
        cont.innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-icon">📆</div><p>Donem tanimlanmamis</p></div>';
    } else {
        cont.innerHTML = editDraft.phases.map(buildPhaseRow).join('');
        editDraft.phases.forEach(p => bindPhase(p));
    }
}

function buildPhaseRow(p) {
    const tc = PHASE_TYPES.find(t=>t.value===p.type)||PHASE_TYPES[0];
    const typeOpts = PHASE_TYPES.map(t=>`<option value="${t.value}"${p.type===t.value?' selected':''}>${t.label}</option>`).join('');
    // Calculate weeks from start/end if available
    let initWeeks = '';
    if (p.startDate && p.endDate) {
        initWeeks = Math.round((new Date(p.endDate+' 00:00:00') - new Date(p.startDate+' 00:00:00')) / 86400000 / 7);
    }
    return `<div class="phase-row" id="pr_${p.id}" style="border-left-color:${tc.color}">
        <div class="phase-type-dot" style="background:${tc.color}"></div>
        <div class="phase-fields">
            <div class="form-group" style="min-width:160px">
                <label class="form-label">Donem Adi</label>
                <input type="text" id="pn_${p.id}" class="form-control" value="${escHtml(p.name)}" maxlength="50">
            </div>
            <div class="form-group" style="min-width:130px">
                <label class="form-label">Tip</label>
                <select id="pt_${p.id}" class="form-control">${typeOpts}</select>
            </div>
            <div class="form-group" style="min-width:145px">
                <label class="form-label">Baslangic</label>
                <input type="date" id="ps_${p.id}" class="form-control" value="${p.startDate||''}">
            </div>
            <div class="form-group" style="min-width:85px">
                <label class="form-label">Hafta Sayisi</label>
                <input type="number" id="pw_${p.id}" class="form-control" value="${initWeeks}" min="1" max="52" placeholder="0">
            </div>
            <div class="form-group" style="min-width:145px">
                <label class="form-label">Bitis (otomatik)</label>
                <input type="date" id="pe_${p.id}" class="form-control" value="${p.endDate||''}">
            </div>
            <div style="display:flex;align-items:flex-end;padding-bottom:16px">
                <button class="btn btn-danger btn-sm" onclick="removePhase('${p.id}')">✕</button>
            </div>
        </div>
    </div>`;
}

function bindPhase(p) {
    const nameEl  = document.getElementById('pn_'+p.id);
    const typeEl  = document.getElementById('pt_'+p.id);
    const startEl = document.getElementById('ps_'+p.id);
    const weeksEl = document.getElementById('pw_'+p.id);
    const endEl   = document.getElementById('pe_'+p.id);

    const recalcEnd = () => {
        if (!p.startDate || !weeksEl?.value) return;
        const w = parseInt(weeksEl.value);
        if (!w || w < 1) return;
        const s = new Date(p.startDate + 'T00:00:00');
        s.setDate(s.getDate() + w * 7);
        p.endDate = formatDateISO(s);
        if (endEl) endEl.value = p.endDate;
    };
    const recalcWeeks = () => {
        if (!p.startDate || !p.endDate) return;
        const diff = Math.round((new Date(p.endDate+' 00:00:00') - new Date(p.startDate+' 00:00:00')) / 86400000 / 7);
        if (weeksEl && diff > 0) weeksEl.value = diff;
    };

    if (nameEl)  nameEl.addEventListener('input',  () => { p.name=nameEl.value; });
    if (startEl) startEl.addEventListener('input', () => { p.startDate=startEl.value; recalcEnd(); });
    if (weeksEl) weeksEl.addEventListener('input', () => { recalcEnd(); });
    if (endEl)   endEl.addEventListener('input',   () => { p.endDate=endEl.value; recalcWeeks(); });
    if (typeEl)  typeEl.addEventListener('change', () => {
        p.type = typeEl.value;
        const tc = PHASE_TYPES.find(t=>t.value===p.type)||PHASE_TYPES[0];
        const row = document.getElementById('pr_'+p.id);
        const dot = row?.querySelector('.phase-type-dot');
        if (row) row.style.borderLeftColor = tc.color;
        if (dot) dot.style.background = tc.color;
    });
}

function addPhase() {
    const id = 'p'+(++pIdCounter);
    editDraft.phases.push({ id, name:'Yeni Donem', type:'blast', startDate:'', endDate:'' });
    renderPhases();
}
function removePhase(id) { editDraft.phases = editDraft.phases.filter(p=>p.id!==id); renderPhases(); }

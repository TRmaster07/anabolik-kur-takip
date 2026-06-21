let activePlan = null;

document.addEventListener('DOMContentLoaded', () => {
    requireAuth(user => {
        renderNav('dashboard', user);
        loadDashboard();
    });
});

async function loadActivePlan() {
    activePlan = null;
    try {
        const doc = await getUserDoc('plan', 'main');
        if (doc.exists && isValidPlan(doc.data())) {
            activePlan = doc.data();
        }
    } catch (e) {
        console.warn('Plan yukleme hatasi:', e.message);
    }
}

function getPlanDaysPassed(plan) {
    if (!plan?.startDate) return -1;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(plan.startDate + 'T00:00:00');
    return Math.max(0, getDaysBetween(start, today));
}

function getPlanCurrentWeek(plan) {
    const days = getPlanDaysPassed(plan);
    if (days < 0) return 0;
    const totalWeeks = parseInt(plan.totalWeeks, 10) || 13;
    return Math.min(Math.floor(days / 7) + 1, totalWeeks);
}

function renderNoPlanStats() {
    const kurStartEl = document.getElementById('kurStartDate');
    if (kurStartEl) kurStartEl.textContent = '—';
    document.getElementById('daysPassed').textContent = '—';
    document.getElementById('currentWeek').textContent = '—';
    const totalWeeksEl = document.getElementById('totalWeeksUnit');
    if (totalWeeksEl) totalWeeksEl.textContent = '';
    document.getElementById('injPct').textContent = '—';
    document.getElementById('injProgressBar').style.width = '0%';
}

function renderPlanStats(plan) {
    const kurStartEl = document.getElementById('kurStartDate');
    if (kurStartEl) kurStartEl.textContent = formatDate(plan.startDate);

    const days = getPlanDaysPassed(plan);
    const week = getPlanCurrentWeek(plan);
    const totalWeeks = parseInt(plan.totalWeeks, 10) || 13;

    document.getElementById('daysPassed').textContent = days >= 0 ? days : '—';
    document.getElementById('currentWeek').textContent = week > 0 ? week : '—';

    const totalWeeksEl = document.getElementById('totalWeeksUnit');
    if (totalWeeksEl) totalWeeksEl.textContent = week > 0 ? '/ ' + totalWeeks : '';
}

async function loadDashboard() {
    await loadActivePlan();

    if (!activePlan) {
        renderNoPlanStats();
    } else {
        renderPlanStats(activePlan);
    }

    try {
        await Promise.all([
            loadPlanPhase(),
            activePlan ? loadInjectionStats() : Promise.resolve(),
            loadLastMeasurement(),
            loadLastLab(),
            loadLastPhoto()
        ]);
        await renderWeeklyProgress();
    } catch (err) {
        console.error('Dashboard load error:', err);
        showToast('Veriler yüklenemedi', 'error');
    }
}

// ===== PHASE INFO =====
async function loadPlanPhase() {
    const card = document.getElementById('currentPhaseCard');
    if (!card) return;

    if (!activePlan) {
        card.innerHTML = '<div style="color:var(--text-muted);font-size:0.875rem">Henüz bir kür planı oluşturmadınız. <a href="plan.html" style="color:var(--accent-text)">Kür Planı</a> sayfasından plan oluşturun.</div>';
        return;
    }

    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const phases = activePlan.phases || [];
        const PHASE_COLORS = { blast: '#ef4444', cruise: '#3b82f6', pct: '#10b981', off: '#64748b', custom: '#f59e0b' };
        const PHASE_LABELS = { blast: 'Blast', cruise: 'Cruise', pct: 'PCT', off: 'Duraklama', custom: 'Özel' };

        const active = phases.find(p => {
            if (!p.startDate || !p.endDate) return false;
            const s = new Date(p.startDate + ' 00:00:00');
            const e = new Date(p.endDate + ' 00:00:00');
            return today >= s && today <= e;
        });

        if (!active) {
            card.innerHTML = '<div style="color:var(--text-muted);font-size:0.875rem">Mevcut dönem tanımlanmamış. <a href="plan.html" style="color:var(--accent-text)">Kür Planı</a> sayfasından dönem ekleyin.</div>';
            return;
        }

        const col = PHASE_COLORS[active.type] || '#f59e0b';
        const lbl = PHASE_LABELS[active.type] || active.type;
        const daysLeft = Math.ceil((new Date(active.endDate + ' 00:00:00') - today) / 86400000);
        const total = Math.ceil((new Date(active.endDate + ' 00:00:00') - new Date(active.startDate + ' 00:00:00')) / 86400000);
        const elapsed = total - daysLeft;
        const pct = total > 0 ? Math.round((elapsed / total) * 100) : 0;

        card.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
                <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;font-weight:700;font-size:0.82rem;background:${col}22;color:${col};border:1px solid ${col}44">
                    ${lbl.toUpperCase()}: ${escHtml(active.name)}
                </span>
                <span style="color:var(--text-secondary);font-size:0.82rem">${escHtml(active.startDate)} → ${escHtml(active.endDate)}</span>
                <span class="badge badge-warning">${daysLeft} gün kaldı</span>
            </div>
            <div class="progress" style="height:6px">
                <div class="progress-bar" style="width:${pct}%;background:${col}"></div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${elapsed} / ${total} gün geçti (%${pct})</div>`;
    } catch (e) { console.warn('Phase load:', e.message); }
}

async function loadInjectionStats() {
    const schedule = generateScheduleFromPlan(activePlan);
    const snap = await getUserCollection('injections').get();
    const completed = new Set();
    snap.forEach(d => { if (d.data().completed) completed.add(d.id); });
    const total = schedule.length;
    const done = schedule.filter(i => completed.has(i.id)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    document.getElementById('injPct').textContent = pct + '%';
    document.getElementById('injProgressBar').style.width = pct + '%';
}

async function loadLastMeasurement() {
    const snap = await getUserCollection('measurements').orderBy('week', 'desc').limit(1).get();
    if (!snap.empty) {
        const d = snap.docs[0].data();
        const w = d.week || '';
        document.getElementById('lastWeight').textContent = d.weight || '—';
        document.getElementById('lastWeightWeek').textContent = w ? 'Hafta ' + w : '';
        document.getElementById('lastBP').textContent = (d.systolic && d.diastolic) ? d.systolic + '/' + d.diastolic : '—';
        document.getElementById('lastBPWeek').textContent = w ? 'Hafta ' + w : '';
        document.getElementById('lastPulse').textContent = d.pulse || '—';
        document.getElementById('lastPulseWeek').textContent = w ? 'Hafta ' + w : '';
    }
}

async function loadLastLab() {
    const periodNames = { 1: 'Kür Öncesi', 2: 'Kür Ortası I', 3: 'Kür Ortası II', 4: 'Kür Sonu' };
    const snap = await getUserCollection('labs').orderBy('savedAt', 'desc').limit(1).get();
    if (!snap.empty) {
        const d = snap.docs[0].data();
        document.getElementById('lastLabDate').textContent = d.date ? formatDate(d.date) : '—';
        const next = (d.period || 0) + 1;
        document.getElementById('nextLabPeriod').textContent = next <= 4
            ? 'Periyot ' + next + ': ' + (periodNames[next] || '')
            : 'Tüm periyotlar tamamlandı ✓';
    } else {
        document.getElementById('nextLabPeriod').textContent = 'Periyot 1: Kür Öncesi';
    }
}

async function loadLastPhoto() {
    const snap = await getUserCollection('photos').orderBy('week', 'desc').limit(1).get();
    if (!snap.empty) {
        const d = snap.docs[0].data();
        const ts = d.savedAt ? formatDate(d.savedAt.toDate().toISOString().split('T')[0]) : '';
        document.getElementById('lastPhotoInfo').textContent = 'Hafta ' + d.week + (ts ? ' — ' + ts : '');
    } else {
        document.getElementById('lastPhotoInfo').textContent = 'Henüz fotoğraf yüklenmedi';
    }
}

async function renderWeeklyProgress() {
    const grid = document.getElementById('weeklyProgressGrid');
    if (!grid) return;

    if (!activePlan) {
        grid.innerHTML = `<div class="empty-state" style="padding:40px 20px">
            <div class="empty-icon">📋</div>
            <p>Henüz bir kür planı oluşturmadınız.<br>Haftalık enjeksiyon ilerlemesi, kür planınız kaydedildikten sonra görünür.</p>
            <a href="plan.html" class="btn btn-primary" style="margin-top:16px;display:inline-flex">+ Kür Planı Oluştur</a>
        </div>`;
        return;
    }

    const schedule = generateScheduleFromPlan(activePlan);
    const totalWeeks = parseInt(activePlan.totalWeeks, 10) || 13;
    const snap = await getUserCollection('injections').get();
    const done = new Set();
    snap.forEach(d => { if (d.data().completed) done.add(d.id); });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    let html = '<div class="kur-progress-grid">';

    for (let w = 1; w <= totalWeeks; w++) {
        const wInjs = schedule.filter(i => i.week === w);
        const cDone = wInjs.filter(i => done.has(i.id)).length;
        const total = wInjs.length;
        const pct = total > 0 ? Math.round((cDone / total) * 100) : 0;

        const firstDate = wInjs[0]?.date;
        const lastDate = wInjs[wInjs.length - 1]?.date;
        const wStart = firstDate ? new Date(firstDate + 'T00:00:00') : null;
        const wEnd = lastDate ? new Date(lastDate + 'T00:00:00') : null;
        const isCur = wStart && wEnd && today >= wStart && today <= wEnd;
        const isPast = wEnd && today > wEnd;

        let cls = '';
        if (pct === 100) cls = 'complete';
        else if (isCur) cls = 'current';
        else if (isPast && pct < 100) cls = 'missed';

        html += '<div class="kur-week-tile ' + cls + '">';
        html += '<div class="tile-top"><span class="tile-week">Hafta ' + w + '</span>';
        html += '<span class="badge ' + (pct === 100 ? 'badge-success' : isCur ? 'badge-accent' : 'badge-default') + '">' + cDone + '/' + total + '</span></div>';
        html += '<div class="progress"><div class="progress-bar ' + (pct === 100 ? 'success' : isCur ? '' : '') + '" style="width:' + pct + '%"></div></div>';
        if (isCur) html += '<div class="tile-current-label">← Şu anki hafta</div>';
        html += '</div>';
    }

    html += '</div>';
    grid.innerHTML = html;
}

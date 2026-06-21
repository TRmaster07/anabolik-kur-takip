// ===== GLOBAL CONSTANTS =====
const KUR_START    = new Date('2026-06-22T00:00:00');
const TOTAL_WEEKS  = 13;
const TEST_DOSE    = 0.67;   // mL per injection
const MAST_DOSE    = 1.00;   // mL per injection
const TOTAL_DOSE   = 1.67;   // mL per injection
const TR_DAYS      = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
const TR_MONTHS    = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];


// ===== DATE HELPERS =====
function formatDate(dateStr) {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    return d.getDate() + ' ' + TR_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}
function formatDateISO(d) {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function getDayName(dateStr) {
    return TR_DAYS[new Date(dateStr + 'T00:00:00').getDay()];
}
function getDaysBetween(a, b) {
    const ms = new Date(b) - new Date(a);
    return Math.floor(ms / 86400000);
}
function getDaysPassed() {
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = getDaysBetween(KUR_START, today);
    return Math.max(0, diff);
}
function getCurrentWeek() {
    const days = getDaysPassed();
    if (days < 0) return 0;
    return Math.min(Math.floor(days / 7) + 1, TOTAL_WEEKS);
}

// ===== XSS PROTECTION =====
function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#39;');
}

// ===== INJECTION SCHEDULE GENERATOR =====
// Mon=Jun22, Wed=Jun24, Fri=Jun26 for week 1, etc.
function generateInjectionSchedule() {
    const schedule = [];
    const startMonday = new Date(KUR_START); // June 22 2026 is a Monday
    for (let w = 0; w < TOTAL_WEEKS; w++) {
        const offsets = [0, 2, 4]; // Mon, Wed, Fri
        offsets.forEach((off, idx) => {
            const d = new Date(startMonday);
            d.setDate(startMonday.getDate() + w * 7 + off);
            const iso = formatDateISO(d);
            schedule.push({
                id:           `w${w+1}_${idx+1}`,
                week:         w + 1,
                date:         iso,
                dayName:      getDayName(iso),
                testDose:     TEST_DOSE,
                masteronDose: MAST_DOSE,
                totalVolume:  TOTAL_DOSE,
                completed:    false,
                notes:        ''
            });
        });
    }
    return schedule;
}

// 0=Pazar ... 6=Cumartesi (JS getDay ile uyumlu)
function getCompoundInjectionDays(compound, plan) {
    const days = compound?.injectionDays?.length
        ? compound.injectionDays
        : (plan?.injectionDays || []);
    return [...new Set(days)].sort((a, b) => a - b);
}

function getPlanInjectionDayUnion(plan) {
    const set = new Set();
    (plan?.compounds || []).forEach(c => {
        getCompoundInjectionDays(c, plan).forEach(d => set.add(d));
    });
    return [...set].sort((a, b) => a - b);
}

// ===== PLAN-BASED SCHEDULE GENERATION =====
function generateScheduleFromPlan(plan) {
    const schedule = [];
    if (!plan || !plan.startDate) return schedule;
    const startDate = new Date(plan.startDate + 'T00:00:00');
    const totalWeeks = parseInt(plan.totalWeeks, 10) || 13;
    const compounds = plan.compounds || [];
    if (!compounds.length) return schedule;

    // Tum bilesiklerin ortak enjeksiyon gunlerini bul (union)
    const unionDays = getPlanInjectionDayUnion(plan);
    if (!unionDays.length) return schedule;

    const sdow = startDate.getDay();
    // Haftanin Pazar gununu bul (0=Pazar)
    const weekSun = new Date(startDate);
    weekSun.setDate(startDate.getDate() - sdow);

    for (let w = 0; w < totalWeeks; w++) {
        const weekNum = w + 1;
        const weekDates = new Map();

        // Tum bilesikleri her ortak gunde goster
        unionDays.forEach(dayOfWeek => {
            const d = new Date(weekSun);
            d.setDate(weekSun.getDate() + w * 7 + dayOfWeek);
            const iso = formatDateISO(d);
            if (!weekDates.has(iso)) weekDates.set(iso, []);
            // Tum bilesikleri bu gune ekle
            compounds.forEach(c => {
                if (!weekDates.get(iso).find(x => x.id === c.id)) {
                    weekDates.get(iso).push(c);
                }
            });
        });

        [...weekDates.keys()].sort().forEach((iso, idx) => {
            const dayCompounds = weekDates.get(iso);
            const compoundEntries = dayCompounds.map(c => ({
                id: c.id,
                name: (c.shortName || c.name || '').substring(0, 20),
                mlPerInj: parseFloat(c.mlPerInj) || 0,
            }));
            const totalVol = parseFloat(dayCompounds.reduce((s, c) => s + (parseFloat(c.mlPerInj) || 0), 0).toFixed(2));
            schedule.push({
                id: `w${weekNum}_${idx + 1}`,
                week: weekNum,
                date: iso,
                dayName: getDayName(iso),
                compounds: compoundEntries,
                totalVolume: totalVol,
                completed: false,
                notes: '',
                site: '',
                odem: false,
                hassasiyet: false,
                kizariklik: false,
            });
        });
    }
    return schedule;
}

// ===== MISC HELPERS =====
function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function isValidPlan(p) {
    if (!p || !p.name || !p.startDate || !p.compounds?.length) return false;
    return p.compounds.every(c => getCompoundInjectionDays(c, p).length > 0);
}

const INJ_DAY_SHORT = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
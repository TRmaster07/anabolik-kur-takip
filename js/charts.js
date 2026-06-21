const CHART_DEFAULTS = {
    color: '#f1f5f9',
    gridColor: 'rgba(255,255,255,0.06)',
    fontFamily: "'Segoe UI', system-ui, sans-serif"
};

Chart.defaults.color          = CHART_DEFAULTS.color;
Chart.defaults.font.family    = CHART_DEFAULTS.fontFamily;
Chart.defaults.font.size      = 12;
Chart.defaults.plugins.legend.labels.color = CHART_DEFAULTS.color;

let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    requireAuth(user => {
        renderNav('charts', user);
        loadAndRenderCharts();
    });
});

async function loadAndRenderCharts() {
    try {
        const snap = await db.collection('measurements').orderBy('week','asc').get();
        const allData = [];
        snap.forEach(d => allData.push(d.data()));

        document.getElementById('chartsLoading').style.display = 'none';

        if (allData.length === 0) {
            document.getElementById('noDataMsg').style.display = 'block';
            document.getElementById('chartsGrid').style.display = 'none';
            return;
        }

        const labels = allData.map(d => 'H' + d.week);
        renderLineChart('chartWeight',  labels, allData.map(d => d.weight   ?? null), 'Kilo (kg)',    '#7c3aed');
        renderLineChart('chartWaist',   labels, allData.map(d => d.waist    ?? null), 'Bel (cm)',     '#f59e0b');
        renderLineChart('chartPulse',   labels, allData.map(d => d.pulse    ?? null), 'Nabız (bpm)',  '#10b981');
        renderBPChart  ('chartBP',      labels, allData);
        renderSideEffectsChart('chartSideEffects', labels, allData);
    } catch(err) {
        console.error(err);
        document.getElementById('chartsLoading').style.display = 'none';
        showToast('Grafik verisi yüklenemedi', 'error');
    }
}

function makeAxes() {
    return {
        x: { grid: { color: CHART_DEFAULTS.gridColor }, ticks: { color: CHART_DEFAULTS.color } },
        y: { grid: { color: CHART_DEFAULTS.gridColor }, ticks: { color: CHART_DEFAULTS.color } }
    };
}

function renderLineChart(canvasId, labels, data, label, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label, data,
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 2.5,
                pointRadius: 5,
                pointBackgroundColor: color,
                tension: 0.3,
                fill: true,
                spanGaps: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => label + ': ' + ctx.raw } } },
            scales: makeAxes()
        }
    });
}

function renderBPChart(canvasId, labels, allData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label:'Sistolik',   data: allData.map(d=>d.systolic  ?? null), borderColor:'#ef4444', backgroundColor:'#ef444420', borderWidth:2, pointRadius:4, tension:0.3, fill:false, spanGaps:true },
                { label:'Diyastolik', data: allData.map(d=>d.diastolic ?? null), borderColor:'#3b82f6', backgroundColor:'#3b82f620', borderWidth:2, pointRadius:4, tension:0.3, fill:false, spanGaps:true }
            ]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{ display:true } },
            scales: makeAxes()
        }
    });
}

function renderSideEffectsChart(canvasId, labels, allData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (charts[canvasId]) charts[canvasId].destroy();
    const seConfig = [
        { id:'acne',       label:'Akne',            color:'#f59e0b' },
        { id:'hairLoss',   label:'Saç Dök.',        color:'#ef4444' },
        { id:'libido',     label:'Libido',          color:'#10b981' },
        { id:'mood',       label:'Ruh Hali',        color:'#7c3aed' },
        { id:'breathless', label:'Nefes Darlığı',   color:'#3b82f6' },
        { id:'headache',   label:'Baş Ağrısı',      color:'#ec4899' },
        { id:'gyno',       label:'Meme Hass.',      color:'#f97316' },
    ];
    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: seConfig.map(se => ({
                label: se.label,
                data:  allData.map(d => d[se.id] !== undefined ? d[se.id] : null),
                borderColor: se.color, backgroundColor: se.color + '15',
                borderWidth: 2, pointRadius: 4, tension: 0.3, fill: false, spanGaps: true
            }))
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{ display:true, position:'bottom' } },
            scales: { ...makeAxes(), y:{ ...makeAxes().y, min:0, max:10 } }
        }
    });
}

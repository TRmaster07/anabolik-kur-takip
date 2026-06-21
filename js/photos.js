const PHOTO_TYPES = ['front','side','back'];
const PHOTO_LABELS = { front:'Ön', side:'Yan', back:'Arka' };
let selectedWeek  = getCurrentWeek() || 1;
let photoCache    = {};   // week -> { front, side, back } URLs
let pendingUpload = null; // { week, type }

document.addEventListener('DOMContentLoaded', () => {
    requireAuth(user => {
        renderNav('photos', user);
        initPhotos();
        bindLightbox();
    });
});

async function initPhotos() {
    await loadAllPhotoMeta();
    renderWeekThumbs();
    bindCompare();
    document.getElementById('fileInput').addEventListener('change', handleFileSelected);
    selectWeek(selectedWeek);
}

async function loadAllPhotoMeta() {
    try {
        const snap = await db.collection('photos').get();
        snap.forEach(doc => { photoCache[doc.id] = doc.data(); });
    } catch(e) { console.error(e); }
}

async function checkActivePlan() {
    try {
        const doc = await db.collection('plan').doc('main').get();
        return doc.exists;
    } catch(e) { return false; }
}

async function renderWeekThumbs() {
    const grid = document.getElementById('weekThumbGrid');
    const hasActivePlan = await checkActivePlan();
    
    if (!hasActivePlan) {
        grid.innerHTML = '<div class="empty-state" style="padding:40px 20px;grid-column:1/-1">' +
            '<div class="empty-icon">📋</div>' +
            '<p>Henüz aktif kür planı yok.<br>Fotoğraflar aktif kür olduğunda görünecektir.</p>' +
            '<a href="plan.html" class="btn btn-primary" style="margin-top:16px;display:inline-flex">+ Kür Planı Oluştur</a>' +
            '</div>';
        return;
    }
    
    let html = '';
    for (let w = 1; w <= TOTAL_WEEKS; w++) {
        const key     = 'week_' + w;
        const hasPics = photoCache[key] && (photoCache[key].front || photoCache[key].side || photoCache[key].back);
        const sel     = w === selectedWeek ? ' selected' : '';
        const has     = hasPics ? ' has-photos' : '';
        html += '<div class="week-thumb' + sel + has + '" data-week="' + w + '">';
        html += '<span>H' + w + '</span>';
        if (hasPics) html += '<div class="thumb-dot" style="width:6px;height:6px;border-radius:50%;background:var(--success)"></div>';
        html += '</div>';
    }
    grid.innerHTML = html;
    grid.querySelectorAll('.week-thumb').forEach(el => {
        el.addEventListener('click', () => selectWeek(parseInt(el.dataset.week)));
    });
}

function selectWeek(w) {
    selectedWeek = w;
    document.querySelectorAll('.week-thumb').forEach(el => {
        el.classList.toggle('selected', parseInt(el.dataset.week) === w);
    });
    renderPhotoCard(w);
}

async function renderPhotoCard(w) {
    const card  = document.getElementById('photoCard');
    const title = document.getElementById('photoCardTitle');
    const grid  = document.getElementById('photoGrid');
    
    const hasActivePlan = await checkActivePlan();
    
    if (!hasActivePlan) {
        card.style.display = 'none';
        return;
    }
    
    card.style.display = 'block';
    title.textContent  = 'Hafta ' + w + ' Fotoğrafları';

    const key  = 'week_' + w;
    const data = photoCache[key] || {};

    grid.innerHTML = PHOTO_TYPES.map(type => {
        const url = data[type] || '';
        const hasImg = !!url;
        return `
            <div>
                <div class="photo-slot" data-week="${w}" data-type="${type}">
                    ${hasImg ? `<img src="${escHtml(url)}" alt="${escHtml(PHOTO_LABELS[type])}">` : `<span class="ph-empty-icon">📷</span>`}
                    <div class="ph-overlay">
                        <button class="btn btn-primary btn-sm upload-photo-btn" data-week="${w}" data-type="${type}">📤 Yükle</button>
                        ${hasImg ? `<button class="btn btn-secondary btn-sm view-photo-btn" data-url="${escHtml(url)}" data-cap="Hafta ${w} — ${escHtml(PHOTO_LABELS[type])}">🔍 Görüntüle</button>` : ''}
                    </div>
                </div>
                <div class="photo-type-label">${escHtml(PHOTO_LABELS[type])}</div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.upload-photo-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); triggerUpload(parseInt(btn.dataset.week), btn.dataset.type); });
    });
    grid.querySelectorAll('.view-photo-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); openLightbox(btn.dataset.url, btn.dataset.cap); });
    });
}

function triggerUpload(week, type) {
    pendingUpload = { week, type };
    const fi = document.getElementById('fileInput');
    fi.value = '';
    fi.click();
}

async function handleFileSelected(e) {
    const file = e.target.files[0];
    if (!file || !pendingUpload) return;
    if (!file.type.startsWith('image/')) { showToast('Lütfen bir resim dosyası seçin', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { showToast('Dosya boyutu 20 MB\'dan küçük olmalı', 'error'); return; }

    const status = document.getElementById('uploadStatus');
    status.textContent = 'Yükleniyor...';
    status.className   = 'badge badge-warning';

    try {
        const compressed = await compressImage(file, 1200, 0.82);
        const { week, type } = pendingUpload;
        
        // Cloudinary'ye yükle
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'photos/week_' + week);
        
        const uploadResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!uploadResponse.ok) {
            throw new Error('Cloudinary yükleme hatası: ' + uploadResponse.status);
        }
        
        const uploadResult = await uploadResponse.json();
        const url = uploadResult.secure_url;

        const key  = 'week_' + week;
        if (!photoCache[key]) photoCache[key] = {};
        photoCache[key][type] = url;

        await db.collection('photos').doc(key).set(
            { week, [type]: url, savedAt: firebase.firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );

        status.textContent = '✓ Yüklendi';
        status.className   = 'badge badge-success';
        renderWeekThumbs();
        renderPhotoCard(week);
        showToast('Fotoğraf yüklendi ✓', 'success');
    } catch (err) {
        status.textContent = 'Hata';
        status.className   = 'badge badge-danger';
        showToast('Yükleme hatası: ' + err.message, 'error');
    } finally {
        pendingUpload = null;
    }
}

function compressImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const ratio  = Math.min(maxDim / img.width, maxDim / img.height, 1);
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * ratio);
            canvas.height = Math.round(img.height * ratio);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression failed')), 'image/jpeg', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
        img.src = url;
    });
}

function bindLightbox() {
    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    document.getElementById('lightbox').addEventListener('click', e => { if (e.target === document.getElementById('lightbox')) closeLightbox(); });
}
function openLightbox(url, caption) {
    document.getElementById('lightboxImg').src         = url;
    document.getElementById('lightboxCaption').textContent = caption || '';
    document.getElementById('lightbox').style.display  = 'flex';
}
function closeLightbox() {
    document.getElementById('lightbox').style.display  = 'none';
    document.getElementById('lightboxImg').src         = '';
}

function bindCompare() {
    document.getElementById('compareBtn').addEventListener('click', () => {
        document.getElementById('comparePanel').style.display = 'block';
        populateCompareSelects();
    });
    document.getElementById('closeCompare').addEventListener('click', () => {
        document.getElementById('comparePanel').style.display = 'none';
    });
    document.getElementById('doCompare').addEventListener('click', runCompare);
}

function populateCompareSelects() {
    const opts = Array.from({length: TOTAL_WEEKS}, (_, i) => `<option value="${i+1}">Hafta ${i+1}</option>`).join('');
    document.getElementById('compareLeft').innerHTML  = opts;
    document.getElementById('compareRight').innerHTML = opts;
    if (TOTAL_WEEKS > 1) document.getElementById('compareRight').value = Math.min(2, TOTAL_WEEKS);
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

function runCompare() {
    const l    = parseInt(document.getElementById('compareLeft').value);
    const r    = parseInt(document.getElementById('compareRight').value);
    const type = document.getElementById('compareType').value;
    const lData = photoCache['week_' + l] || {};
    const rData = photoCache['week_' + r] || {};
    const lUrl  = lData[type] || '';
    const rUrl  = rData[type] || '';
    const noImg = '<div style="display:flex;align-items:center;justify-content:center;aspect-ratio:3/4;background:var(--bg-tertiary);border-radius:8px;color:var(--text-muted)">Fotoğraf yok</div>';
    document.getElementById('comparePanelContent').innerHTML = `
        <div>
            <div style="font-weight:700;margin-bottom:8px;text-align:center">Hafta ${l}</div>
            ${lUrl ? `<img src="${escHtml(lUrl)}" style="width:100%;border-radius:8px;cursor:pointer" onclick="openLightbox('${escHtml(lUrl)}','Hafta ${l} — ${escHtml(PHOTO_LABELS[type])}')">` : noImg}
        </div>
        <div>
            <div style="font-weight:700;margin-bottom:8px;text-align:center">Hafta ${r}</div>
            ${rUrl ? `<img src="${escHtml(rUrl)}" style="width:100%;border-radius:8px;cursor:pointer" onclick="openLightbox('${escHtml(rUrl)}','Hafta ${r} — ${escHtml(PHOTO_LABELS[type])}')">` : noImg}
        </div>
    `;
}

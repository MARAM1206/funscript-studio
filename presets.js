// ==========================================================================
// PRESETS V17.0: RUEDA DEL RATÓN CORREGIDA (DIRECCIÓN NATURAL)
// ==========================================================================

let savedPresets = {};
try { savedPresets = JSON.parse(localStorage.getItem('funscript_saved_presets')) || {}; } catch(e) { savedPresets = {}; }

const presetsBtn = document.getElementById('save-preset-btn');
const videoPlayerPresetNode = document.getElementById('video-player');

window.isDraggingPreset = false;
window.timelineGhostPreset = null;
window.timelineGhostTimeMs = null;
window.timelineGhostDeltaPos = 0; 

const modal = document.getElementById('preset-editor-modal');
const modalNameInput = document.getElementById('preset-editor-name');
const modalCanvas = document.getElementById('preset-editor-canvas');
const btnCancel = document.getElementById('preset-editor-cancel');
const btnSave = document.getElementById('preset-editor-save');

let mCtx = modalCanvas ? modalCanvas.getContext('2d') : null;
let currentEditingPresetName = "";
let mActions = [];
let mDuration = 1000;

let mIsDragging = false;
let mDraggedNode = null;
let mZoom = 1.0;
let mPanX = 0;
let mBasePixelsPerMs = 0.1; 

document.addEventListener("DOMContentLoaded", () => {
    updatePresetsList();
});

presetsBtn?.addEventListener('click', function() {
    const actions = window.funscriptActions || [];
    if (!videoPlayerPresetNode || !videoPlayerPresetNode.src || actions.length === 0) {
        alert("Primero carga un video y coloca puntos en la línea de tiempo."); return;
    }
    const actionsToSave = actions.filter(act => act.selected);
    if (actionsToSave.length === 0) {
        alert("Selecciona primero los puntos que deseas guardar arrastrando un cuadro azul sobre ellos."); return;
    }

    const presetName = prompt("Introduce un nombre para guardar este Preset:", `Patrón Custom ${Object.keys(savedPresets).length + 1}`);
    if (!presetName) return;

    const baseTime = actionsToSave[0].at;
    const normalizedActions = actionsToSave.map(act => ({
        at: act.at - baseTime,
        pos: act.pos
    }));

    savedPresets[presetName] = normalizedActions;
    localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
    updatePresetsList();
});

function updatePresetsList() {
    const listContainer = document.getElementById('presets-list');
    if (!listContainer) return;

    const presetNames = Object.keys(savedPresets);
    if (presetNames.length === 0) {
        listContainer.innerHTML = '<span class="empty-log">No hay presets aún.</span>';
        return;
    }

    listContainer.innerHTML = presetNames.map((name, index) => {
        return `
            <div class="preset-card" draggable="true" data-preset="${name}">
                <div class="preset-card-header">
                    <span class="preset-card-title">${name}</span>
                    <div style="display: flex; gap: 4px;">
                        <button class="preset-action-btn edit-preset-btn" data-preset="${name}" title="Editar Preset">✏️</button>
                        <button class="preset-action-btn delete-preset-btn" data-preset="${name}" style="color: #ef4444;" title="Eliminar">🗑️</button>
                    </div>
                </div>
                <canvas id="mini-canvas-${index}" class="preset-mini-canvas" width="200" height="36"></canvas>
            </div>
        `;
    }).join('');

    setTimeout(() => {
        presetNames.forEach((name, index) => {
            drawMiniCanvas(`mini-canvas-${index}`, savedPresets[name]);
        });
    }, 50);

    document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('dragstart', function(e) {
            window.isDraggingPreset = true; 
            const name = this.getAttribute('data-preset');
            window.timelineGhostPreset = savedPresets[name];
        });
        card.addEventListener('dragend', function() {
            window.isDraggingPreset = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0; 
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
        });
    });

    document.querySelectorAll('.edit-preset-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); 
            const name = this.getAttribute('data-preset');
            openPresetEditor(name);
        });
    });

    document.querySelectorAll('.delete-preset-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); 
            const name = this.getAttribute('data-preset');
            if (confirm(`¿Eliminar el preset "${name}"?`)) {
                delete savedPresets[name];
                localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
                updatePresetsList();
            }
        });
    });
}

function drawMiniCanvas(canvasId, actions) {
    const c = document.getElementById(canvasId);
    if (!c || !actions || actions.length === 0) return;
    const ctx = c.getContext('2d');
    const w = c.width; const h = c.height;
    ctx.clearRect(0,0,w,h);
    
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.beginPath();
    const duration = actions[actions.length-1].at || 1000;
    
    actions.forEach((act, i) => {
        const x = duration === 0 ? 0 : (act.at / duration) * w;
        const y = h - (act.pos / 100) * h;
        if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    ctx.fillStyle = '#f59e0b';
    actions.forEach((act) => {
        const x = duration === 0 ? 0 : (act.at / duration) * w;
        const y = h - (act.pos / 100) * h;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
    });
}

function openPresetEditor(name) {
    currentEditingPresetName = name;
    modalNameInput.value = name;
    
    mActions = JSON.parse(JSON.stringify(savedPresets[name]));
    if (mActions.length === 0) mActions.push({at: 0, pos: 50});
    mDuration = mActions[mActions.length - 1].at || 1000;
    
    mZoom = 1.0;
    mPanX = 0;

    modal.style.display = 'flex';
    ensureModalCanvasSize();
    mBasePixelsPerMs = (modalCanvas.width - 60) / (mDuration === 0 ? 1000 : mDuration);
    drawModalCanvas();
}

function closePresetEditor() {
    modal.style.display = 'none';
    currentEditingPresetName = "";
    mActions = [];
}

btnCancel?.addEventListener('click', closePresetEditor);

btnSave?.addEventListener('click', () => {
    const newName = modalNameInput.value.trim();
    if (!newName) { alert("El nombre no puede estar vacío."); return; }
    if (mActions.length === 0) { alert("¡Cuidado! El preset no puede estar vacío. Agrega al menos un punto."); return; }

    mActions.sort((a, b) => a.at - b.at);
    const baseTime = mActions[0].at;
    mActions.forEach(act => { act.at -= baseTime; });

    if (newName !== currentEditingPresetName) delete savedPresets[currentEditingPresetName];
    
    savedPresets[newName] = mActions;
    localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
    
    closePresetEditor(); updatePresetsList();
});

function ensureModalCanvasSize() {
    if (!modalCanvas) return;
    const rect = modalCanvas.parentElement.getBoundingClientRect();
    if (modalCanvas.width !== rect.width || modalCanvas.height !== rect.height) {
        modalCanvas.width = rect.width; modalCanvas.height = rect.height;
    }
}

function mTimeToX(t) { return 30 + (t * mBasePixelsPerMs * mZoom) + mPanX; }
function mXToTime(x) { return (x - 30 - mPanX) / (mBasePixelsPerMs * mZoom); }
function mPosToY(p) { const padT = 20; const padB = 10; return modalCanvas.height - padB - (p / 100) * (modalCanvas.height - padT - padB); }
function mYToPos(y) { const padT = 20; const padB = 10; const p = ((modalCanvas.height - padB - y) / (modalCanvas.height - padT - padB)) * 100; return Math.max(0, Math.min(100, Math.round(p))); }

// 🎯 RUEDA DEL RATÓN CORREGIDA (Invertido el signo para coincidir con el comportamiento natural)
modalCanvas?.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.shiftKey) {
        const mouseX = e.clientX - modalCanvas.getBoundingClientRect().left;
        const timeAtMouse = mXToTime(mouseX);
        if (e.deltaY < 0) mZoom *= 1.15; else mZoom /= 1.15;
        mZoom = Math.max(0.1, Math.min(mZoom, 20.0));
        mPanX = mouseX - 30 - (timeAtMouse * mBasePixelsPerMs * mZoom);
    } else {
        // Corrección del paneo invertido
        mPanX += e.deltaY; 
    }
    drawModalCanvas();
}, { passive: false });

function drawModalCanvas() {
    if (!mCtx || !modalCanvas) return;
    ensureModalCanvasSize();
    mCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);

    mCtx.lineWidth = 1;
    [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(p => {
        const y = mPosToY(p);
        mCtx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
        mCtx.beginPath(); mCtx.moveTo(30, y); mCtx.lineTo(modalCanvas.width, y); mCtx.stroke();
        mCtx.fillStyle = '#475569'; mCtx.font = '9px monospace'; mCtx.fillText(`${p}%`, 2, y + 3);
    });

    const visibleMs = modalCanvas.width / (mBasePixelsPerMs * mZoom);
    let stepMs = 1000;
    if (visibleMs < 500) stepMs = 50;
    else if (visibleMs < 1000) stepMs = 100;
    else if (visibleMs < 5000) stepMs = 500;
    else if (visibleMs > 20000) stepMs = 5000;
    else if (visibleMs > 10000) stepMs = 2000;

    const startTime = Math.max(0, mXToTime(30));
    const endTime = mXToTime(modalCanvas.width);
    let t = Math.floor(startTime / stepMs) * stepMs;

    mCtx.fillStyle = '#64748b'; mCtx.font = '10px monospace';
    while (t <= endTime) {
        const x = mTimeToX(t);
        if (x >= 30) {
            mCtx.strokeStyle = 'rgba(30, 41, 59, 0.3)';
            mCtx.beginPath(); mCtx.moveTo(x, 20); mCtx.lineTo(x, modalCanvas.height); mCtx.stroke();
            mCtx.fillText(`${(t/1000).toFixed(2)}s`, x + 2, 12);
        }
        t += stepMs;
    }

    if (mActions.length === 0) return;

    mCtx.lineWidth = 3; mCtx.strokeStyle = '#38bdf8';
    mCtx.beginPath();
    mActions.forEach((act, i) => {
        const x = mTimeToX(act.at); const y = mPosToY(act.pos);
        if (i === 0) mCtx.moveTo(x, y); else mCtx.lineTo(x, y);
    });
    mCtx.stroke();

    mActions.forEach(act => {
        const x = mTimeToX(act.at); const y = mPosToY(act.pos);
        mCtx.fillStyle = '#f59e0b';
        mCtx.beginPath(); mCtx.arc(x, y, 6, 0, Math.PI * 2); mCtx.fill();
        mCtx.strokeStyle = '#ffffff'; mCtx.lineWidth = 1.5; mCtx.stroke();
    });
}

function getModalMousePos(e) {
    const rect = modalCanvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (modalCanvas.width / rect.width), y: (e.clientY - rect.top) * (modalCanvas.height / rect.height) };
}

modalCanvas?.addEventListener('mousedown', (e) => {
    const pos = getModalMousePos(e);
    if (e.button === 0) { 
        let clickedNode = null;
        for (let act of mActions) {
            const nx = mTimeToX(act.at); const ny = mPosToY(act.pos);
            if (Math.hypot(pos.x - nx, pos.y - ny) <= 10) { clickedNode = act; break; }
        }
        if (clickedNode) {
            mIsDragging = true; mDraggedNode = clickedNode;
        } else {
            let clickTime = Math.max(0, Math.round(mXToTime(pos.x) / 50) * 50); 
            let clickPos = Math.round(mYToPos(pos.y) / 5) * 5;
            mActions.push({ at: clickTime, pos: Math.max(0, Math.min(100, clickPos)) });
            mActions.sort((a, b) => a.at - b.at);
            mDuration = Math.max(1000, mActions[mActions.length - 1].at); 
            drawModalCanvas();
        }
    } else if (e.button === 2) { 
        e.preventDefault();
        mActions = mActions.filter(act => Math.hypot(pos.x - mTimeToX(act.at), pos.y - mPosToY(act.pos)) > 10);
        drawModalCanvas();
    }
});

modalCanvas?.addEventListener('mousemove', (e) => {
    if (mIsDragging && mDraggedNode) {
        const pos = getModalMousePos(e);
        mDraggedNode.at = Math.max(0, Math.round(mXToTime(pos.x) / 50) * 50);
        mDraggedNode.pos = Math.max(0, Math.min(100, Math.round(mYToPos(pos.y) / 5) * 5));
        mActions.sort((a, b) => a.at - b.at);
        mDuration = Math.max(1000, mActions[mActions.length - 1].at);
        drawModalCanvas();
    }
});

modalCanvas?.addEventListener('mouseup', () => { mIsDragging = false; mDraggedNode = null; });
modalCanvas?.addEventListener('mouseleave', () => { mIsDragging = false; mDraggedNode = null; });
modalCanvas?.addEventListener('contextmenu', e => e.preventDefault());

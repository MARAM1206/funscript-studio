// ==========================================================================
// PRESETS V15.1: PARCHE DE SEGURIDAD PARA MODAL Y ARRASTRE
// ==========================================================================

let savedPresets = {};
try { savedPresets = JSON.parse(localStorage.getItem('funscript_saved_presets')) || {}; } catch(e) { savedPresets = {}; }

const presetsBtn = document.getElementById('save-preset-btn');
const videoPlayerPresetNode = document.getElementById('video-player');

window.isDraggingPreset = false;
window.timelineGhostPreset = null;
window.timelineGhostTimeMs = null;
window.timelineGhostDeltaPos = 0; 

// --- VARIABLES DEL EDITOR MODAL ---
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
                <div class="preset-card-title">${name}</div>
                <canvas id="mini-canvas-${index}" class="preset-mini-canvas" width="200" height="36"></canvas>
                <div class="preset-card-footer">
                    <button class="preset-action-btn edit-preset-btn" data-preset="${name}" title="Editar Preset">✏️</button>
                    <button class="preset-action-btn delete-preset-btn" data-preset="${name}" style="color: #ef4444;" title="Eliminar">🗑️</button>
                </div>
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
            window.isDraggingPreset = false;
            window.timelineGhostPreset = null;
            window.timelineGhostTimeMs = null;
            window.timelineGhostDeltaPos = 0; 
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
        });
    });

    // ✏️ ABRIR MODAL DE EDICIÓN
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
    
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
    ctx.beginPath();
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

// ==========================================================================
// 🛠️ LÓGICA DEL MODAL DE EDICIÓN INDEPENDIENTE (BLINDADO)
// ==========================================================================

function openPresetEditor(name) {
    currentEditingPresetName = name;
    modalNameInput.value = name;
    
    mActions = JSON.parse(JSON.stringify(savedPresets[name]));
    // 🛡️ Seguro anti-matemáticas rotas
    if (mActions.length === 0) mActions.push({at: 0, pos: 50});
    mDuration = mActions[mActions.length - 1].at || 1000;
    
    modal.style.display = 'flex';
    ensureModalCanvasSize();
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
    
    // 🛡️ Seguro por si borran todos los puntos en el mini-editor
    if (mActions.length === 0) {
        alert("¡Cuidado! El preset no puede estar vacío. Agrega al menos un punto.");
        return;
    }

    mActions.sort((a, b) => a.at - b.at);
    const baseTime = mActions[0].at;
    mActions.forEach(act => { act.at -= baseTime; });

    if (newName !== currentEditingPresetName) {
        delete savedPresets[currentEditingPresetName];
    }
    
    savedPresets[newName] = mActions;
    localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
    
    closePresetEditor();
    updatePresetsList();
});

function ensureModalCanvasSize() {
    if (!modalCanvas) return;
    const rect = modalCanvas.parentElement.getBoundingClientRect();
    if (modalCanvas.width !== rect.width || modalCanvas.height !== rect.height) {
        modalCanvas.width = rect.width; modalCanvas.height = rect.height;
    }
}

function mTimeToX(t) { return (t / mDuration) * (modalCanvas.width - 20) + 10; }
function mXToTime(x) { return ((x - 10) / (modalCanvas.width - 20)) * mDuration; }
function mPosToY(p) { return (modalCanvas.height - 10) - (p / 100) * (modalCanvas.height - 20); }
function mYToPos(y) { return 100 - ((y - 10) / (modalCanvas.height - 20)) * 100; }

function drawModalCanvas() {
    if (!mCtx || !modalCanvas) return;
    ensureModalCanvasSize();
    
    mCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);

    mCtx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(p => {
        const y = mPosToY(p);
        mCtx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
        mCtx.beginPath(); mCtx.moveTo(0, y); mCtx.lineTo(modalCanvas.width, y); mCtx.stroke();
    });

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
            let clickTime = Math.round(mXToTime(pos.x) / 50) * 50; 
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

// ==========================================================================
// PRESETS V31.0: EDITOR GIGANTE CON MULTI-SELECT, IMÁN Y ZOOM FINO
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

// 🛡️ MOTOR DE INTERACCIÓN DEL MODAL
let mIsDragging = false;
let mIsSelecting = false;
let mHasDraggedSelection = false;
let mStartX = 0, mStartY = 0;
let mCurrentX = 0, mCurrentY = 0;
let mDraggedNodeIndex = -1;
let mDragInitialStates = [];

let mUndoStack = [];
let mRedoStack = [];

let mZoom = 1.0;
let mPanX = 0;
let mBasePixelsPerMs = 0.1; 

function saveModalHistory() { mUndoStack.push(JSON.stringify(mActions)); if(mUndoStack.length > 30) mUndoStack.shift(); mRedoStack = []; }
function undoModal() { if(mUndoStack.length > 0) { mRedoStack.push(JSON.stringify(mActions)); mActions = JSON.parse(mUndoStack.pop()); drawModalCanvas(); } }
function redoModal() { if(mRedoStack.length > 0) { mUndoStack.push(JSON.stringify(mActions)); mActions = JSON.parse(mRedoStack.pop()); drawModalCanvas(); } }

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
        pos: act.pos,
        selected: false
    }));

    savedPresets[presetName] = normalizedActions;
    localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
    updatePresetsList();
});

function updatePresetsList() {
    const listContainer = document.getElementById('presets-list');
    const modalLibrary = document.getElementById('modal-presets-library-list');
    
    const presetNames = Object.keys(savedPresets);
    if (presetNames.length === 0) {
        if (listContainer) listContainer.innerHTML = '<span class="empty-log">No hay presets aún.</span>';
        if (modalLibrary) modalLibrary.innerHTML = '<span class="empty-log">Guarda presets primero.</span>';
        return;
    }

    const htmlContent = presetNames.map((name, index) => {
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

    if (listContainer) listContainer.innerHTML = htmlContent;

    // 🎯 INYECTAR LA LIBRERÍA EN EL PANEL DERECHO DEL MODAL
    if (modalLibrary) {
        modalLibrary.innerHTML = presetNames.map((name, index) => {
            return `
                <div class="preset-card" draggable="true" data-preset="${name}" style="cursor: grab;">
                    <div class="preset-card-title">${name}</div>
                    <canvas id="modal-lib-canvas-${index}" class="preset-mini-canvas" width="200" height="36"></canvas>
                </div>
            `;
        }).join('');
    }

    setTimeout(() => {
        presetNames.forEach((name, index) => {
            drawMiniCanvas(`mini-canvas-${index}`, savedPresets[name]);
            drawMiniCanvas(`modal-lib-canvas-${index}`, savedPresets[name]);
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
            drawModalCanvas(); // Limpia el fantasma del modal
        });
    });

    document.querySelectorAll('.edit-preset-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); 
            openPresetEditor(this.getAttribute('data-preset'));
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
    mUndoStack = []; mRedoStack = [];
    
    mActions = JSON.parse(JSON.stringify(savedPresets[name]));
    mActions.forEach(a => a.selected = false);
    if (mActions.length === 0) mActions.push({at: 0, pos: 50, selected: false});
    mDuration = mActions[mActions.length - 1].at || 1000;
    
    mZoom = 1.0; mPanX = 0;

    modal.style.display = 'flex';
    ensureModalCanvasSize();
    mBasePixelsPerMs = (modalCanvas.width - 60) / (mDuration === 0 ? 1000 : mDuration);
    drawModalCanvas();

    document.addEventListener('keydown', modalKeydownHandler);
}

function closePresetEditor() {
    modal.style.display = 'none';
    currentEditingPresetName = "";
    mActions = [];
    document.removeEventListener('keydown', modalKeydownHandler);
}

// 🛡️ TECLADO DEL MODAL (Ctrl+Z, Y, A)
function modalKeydownHandler(e) {
    if (e.target.tagName === 'INPUT') return;
    const key = e.key.toLowerCase();
    
    if (e.ctrlKey && key === 'z') { e.preventDefault(); undoModal(); }
    if (e.ctrlKey && key === 'y') { e.preventDefault(); redoModal(); }
    if (e.ctrlKey && key === 'a') { e.preventDefault(); mActions.forEach(a => a.selected = true); drawModalCanvas(); }
    
    if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        if (mActions.some(a => a.selected)) {
            saveModalHistory();
            mActions = mActions.filter(a => !a.selected);
            drawModalCanvas();
        }
    }
}

btnCancel?.addEventListener('click', closePresetEditor);

btnSave?.addEventListener('click', () => {
    const newName = modalNameInput.value.trim();
    if (!newName) { alert("El nombre no puede estar vacío."); return; }
    if (mActions.length === 0) { alert("¡Cuidado! El preset no puede estar vacío. Agrega al menos un punto."); return; }

    mActions.sort((a, b) => a.at - b.at);
    const baseTime = mActions[0].at;
    mActions.forEach(act => { act.at -= baseTime; act.selected = false; });

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
function mXToTime(x) { return ((x - 30 - mPanX) / (mBasePixelsPerMs * mZoom)); }
function mPosToY(p) { const padT = 20; const padB = 10; return modalCanvas.height - padB - (p / 100) * (modalCanvas.height - padT - padB); }
function mYToPos(y) { const padT = 20; const padB = 10; const p = ((modalCanvas.height - padB - y) / (modalCanvas.height - padT - padB)) * 100; return Math.max(0, Math.min(100, Math.round(p))); }

// 🎯 ZOOM SEDOSO EN EL MODAL (0.02)
modalCanvas?.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.shiftKey) {
        const mouseX = e.clientX - modalCanvas.getBoundingClientRect().left;
        const timeAtMouse = mXToTime(mouseX);
        mZoom = Math.round((mZoom + (e.deltaY < 0 ? 0.02 : -0.02)) * 100) / 100;
        mZoom = Math.max(0.05, Math.min(mZoom, 20.0));
        mPanX = mouseX - 30 - (timeAtMouse * mBasePixelsPerMs * mZoom);
    } else {
        mPanX -= e.deltaY; 
    }
    drawModalCanvas();
}, { passive: false });

// 🧲 DROP PRESET ADENTRO DEL MODAL (Fusión de presets)
modalCanvas?.addEventListener('dragover', (e) => {
    if (window.isDraggingPreset && window.timelineGhostPreset) {
        e.preventDefault(); 
        const rect = modalCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let hoverTimeMs = mXToTime(mouseX);
        let hoverPosRaw = mYToPos(mouseY);
        
        let hoverPos = Math.round(hoverPosRaw / 5) * 5;
        const basePos = window.timelineGhostPreset[0].pos;
        window.timelineGhostDeltaPos = hoverPos - basePos;
        window.timelineGhostTimeMs = hoverTimeMs;
        drawModalCanvas();
    }
});
modalCanvas?.addEventListener('dragleave', () => {
    if (window.isDraggingPreset) { window.timelineGhostTimeMs = null; drawModalCanvas(); }
});
modalCanvas?.addEventListener('drop', (e) => {
    if (window.isDraggingPreset && window.timelineGhostPreset) {
        e.preventDefault();
        saveModalHistory();
        
        const rect = modalCanvas.getBoundingClientRect();
        let dropTimeMs = window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : mXToTime(e.clientX - rect.left);
        const deltaY = window.timelineGhostDeltaPos || 0;
        
        const newActions = window.timelineGhostPreset.map(act => ({
            at: Math.max(0, dropTimeMs + act.at),
            pos: Math.max(0, Math.min(100, act.pos + deltaY)),
            selected: true 
        }));
        
        mActions.forEach(a => a.selected = false);
        mActions.push(...newActions);
        mActions.sort((a, b) => a.at - b.at);
        mDuration = Math.max(mDuration, mActions[mActions.length-1].at);
        
        window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
        drawModalCanvas();
    }
});

function drawModalCanvas() {
    if (!mCtx || !modalCanvas) return;
    ensureModalCanvasSize();
    mCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);

    mCtx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(p => {
        const y = mPosToY(p);
        mCtx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
        mCtx.beginPath(); mCtx.moveTo(30, y); mCtx.lineTo(modalCanvas.width, y); mCtx.stroke();
        mCtx.fillStyle = '#475569'; mCtx.font = '10px monospace'; mCtx.fillText(`${p}%`, 2, y + 3);
    });

    const visibleMs = modalCanvas.width / (mBasePixelsPerMs * mZoom);
    let stepMs = 1000;
    if (visibleMs < 500) stepMs = 50;
    else if (visibleMs < 1000) stepMs = 100;
    else if (visibleMs < 2000) stepMs = 250;
    else if (visibleMs < 5000) stepMs = 500;
    else if (visibleMs > 30000) stepMs = 5000;
    else if (visibleMs > 15000) stepMs = 2000;
    else stepMs = 1000; 

    const startTimeMs = Math.max(0, mXToTime(30));
    const endTimeMs = mXToTime(modalCanvas.width);
    let t = Math.floor(startTimeMs / stepMs) * stepMs;

    mCtx.fillStyle = '#64748b'; mCtx.font = '10px monospace';
    while (t <= endTimeMs) {
        if (t >= 0) {
            const x = mTimeToX(t);
            if (x >= 30) {
                mCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; 
                mCtx.beginPath(); mCtx.moveTo(x, 0); mCtx.lineTo(x, modalCanvas.height); mCtx.stroke();
                mCtx.fillText(`${(t/1000).toFixed(2)}s`, x + 4, 12);
            }
        }
        t += stepMs;
    }

    if (mActions.length > 0) {
        mCtx.lineWidth = 3; mCtx.strokeStyle = '#38bdf8';
        mCtx.beginPath();
        mActions.forEach((act, i) => {
            const x = mTimeToX(act.at); const y = mPosToY(act.pos);
            if (i === 0) mCtx.moveTo(x, y); else mCtx.lineTo(x, y);
        });
        mCtx.stroke();

        mActions.forEach(act => {
            const x = mTimeToX(act.at); const y = mPosToY(act.pos);
            mCtx.fillStyle = act.selected ? '#f59e0b' : '#38bdf8';
            mCtx.beginPath(); mCtx.arc(x, y, act.selected ? 7 : 5, 0, Math.PI * 2); mCtx.fill();
            mCtx.strokeStyle = '#ffffff'; mCtx.lineWidth = 1.5; mCtx.stroke();
        });
    }

    if (mIsSelecting) {
        mCtx.lineWidth = 1; mCtx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; mCtx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        mCtx.setLineDash([2, 2]); mCtx.beginPath(); mCtx.fillRect(mStartX, mStartY, mCurrentX - mStartX, mCurrentY - mStartY); mCtx.strokeRect(mStartX, mStartY, mCurrentX - mStartX, mCurrentY - mStartY); mCtx.setLineDash([]);
    }

    // Dibujo del fantasma al fusionar presets en el modal
    if (window.isDraggingPreset && window.timelineGhostPreset && window.timelineGhostTimeMs !== null) {
        const deltaY = window.timelineGhostDeltaPos || 0;
        mCtx.lineWidth = 3; mCtx.strokeStyle = 'rgba(16, 185, 129, 0.8)'; mCtx.beginPath();
        window.timelineGhostPreset.forEach((act, index) => {
            const x = mTimeToX(window.timelineGhostTimeMs + act.at);
            const y = mPosToY(Math.max(0, Math.min(100, act.pos + deltaY))); 
            if (index === 0) mCtx.moveTo(x, y); else mCtx.lineTo(x, y);
        });
        mCtx.stroke();
        window.timelineGhostPreset.forEach(act => {
            const x = mTimeToX(window.timelineGhostTimeMs + act.at);
            const y = mPosToY(Math.max(0, Math.min(100, act.pos + deltaY)));
            mCtx.fillStyle = 'rgba(16, 185, 129, 0.9)';
            mCtx.beginPath(); mCtx.arc(x, y, 5, 0, Math.PI * 2); mCtx.fill();
        });
    }
}

function getModalMousePos(e) {
    const rect = modalCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// 🛡️ MOTOR DE INTERACCIÓN MÚLTIPLE EN EL MODAL (Igual a la Línea de Tiempo)
modalCanvas?.addEventListener('mousedown', (e) => {
    const pos = getModalMousePos(e);
    if (e.button === 0) { 
        let clickedNode = null; let cIndex = -1;
        for (let i = 0; i < mActions.length; i++) {
            const nx = mTimeToX(mActions[i].at); const ny = mPosToY(mActions[i].pos);
            if (Math.hypot(pos.x - nx, pos.y - ny) <= 8) { clickedNode = mActions[i]; cIndex = i; break; }
        }

        if (clickedNode) {
            saveModalHistory();
            if (!e.ctrlKey && !clickedNode.selected) mActions.forEach(a => a.selected = false);
            clickedNode.selected = true; 
            mIsDragging = true; mDraggedNodeIndex = cIndex; 
            mDragInitialStates = mActions.map(a => ({...a}));
            mStartX = mXToTime(pos.x); mStartY = mYToPos(pos.y);
            drawModalCanvas();
        } else {
            let hadSelection = mActions.some(a => a.selected);
            if (!e.ctrlKey) mActions.forEach(a => a.selected = false);
            if (!hadSelection) {
                // Inyectar punto rápido si no había nada seleccionado
                saveModalHistory();
                let clickTime = Math.max(0, Math.round(mXToTime(pos.x) / 50) * 50);
                let clickPos = Math.round(mYToPos(pos.y) / 5) * 5;
                mActions.push({ at: clickTime, pos: Math.max(0, Math.min(100, clickPos)), selected: true });
                mActions.sort((a, b) => a.at - b.at);
                mDuration = Math.max(mDuration, mActions[mActions.length - 1].at);
            } else {
                // Solo limpiar selección
                mIsSelecting = true; mHasDraggedSelection = false; 
                mStartX = pos.x; mStartY = pos.y; mCurrentX = pos.x; mCurrentY = pos.y;
            }
            drawModalCanvas();
        }
    } else if (e.button === 2) { 
        e.preventDefault(); saveModalHistory();
        mActions = mActions.filter(act => Math.hypot(pos.x - mTimeToX(act.at), pos.y - mPosToY(act.pos)) > 10);
        drawModalCanvas();
    }
});

modalCanvas?.addEventListener('mousemove', (e) => {
    const pos = getModalMousePos(e);
    if (mIsDragging && mDragInitialStates.length > 0) {
        const rawTimeDelta = mXToTime(pos.x) - mStartX;
        const rawPosDelta = mYToPos(pos.y) - mStartY;
        const snappedTimeDelta = Math.round(rawTimeDelta / 50) * 50; 
        const snappedPosDelta = Math.round(rawPosDelta / 5) * 5;

        mActions.forEach((act, i) => {
            if (mDragInitialStates[i].selected) {
                act.at = Math.max(0, mDragInitialStates[i].at + snappedTimeDelta);
                const rawP = mDragInitialStates[i].pos + snappedPosDelta;
                act.pos = Math.max(0, Math.min(100, Math.round(rawP / 5) * 5));
            }
        });
        drawModalCanvas();
    } else if (mIsSelecting) {
        mCurrentX = pos.x; mCurrentY = pos.y;
        if (Math.hypot(mCurrentX - mStartX, mCurrentY - mStartY) > 5) mHasDraggedSelection = true;
        const minX = Math.min(mStartX, mCurrentX); const maxX = Math.max(mStartX, mCurrentX);
        const minY = Math.min(mStartY, mCurrentY); const maxY = Math.max(mStartY, mCurrentY);
        mActions.forEach(act => {
            const nx = mTimeToX(act.at); const ny = mPosToY(act.pos);
            act.selected = (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY);
        });
        drawModalCanvas();
    }
});

modalCanvas?.addEventListener('mouseup', () => { 
    if (mIsDragging || mHasDraggedSelection) { mActions.sort((a, b) => a.at - b.at); mDuration = Math.max(mDuration, mActions[mActions.length - 1].at); }
    mIsDragging = false; mDragInitialStates = []; mIsSelecting = false; drawModalCanvas(); 
});
modalCanvas?.addEventListener('mouseleave', () => { mIsDragging = false; mDragInitialStates = []; mIsSelecting = false; drawModalCanvas(); });
modalCanvas?.addEventListener('contextmenu', e => e.preventDefault());

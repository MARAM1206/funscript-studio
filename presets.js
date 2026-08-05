// ==========================================================================
// PRESETS V39.0: GHOST EN MODO ADAPTATIVO
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
const btnSaveNew = document.getElementById('preset-editor-save-new'); 

let mCtx = modalCanvas ? modalCanvas.getContext('2d') : null;
let currentEditingPresetName = "";
let mActions = [];
let mDuration = 1000;

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
let mSnapPoint = null; 

function formatModalLabel(timeMs) {
    const isNeg = timeMs < 0;
    const totalSecs = Math.abs(timeMs) / 1000;
    let sign = isNeg ? "-" : "";
    if (totalSecs < 60) return `${sign}${totalSecs.toFixed(1)}s`; 
    const m = Math.floor(totalSecs / 60);
    const s = (totalSecs % 60).toFixed(1).padStart(4, '0');
    return `${sign}${m}:${s.replace('.0', '')}`;
}

function saveModalHistory() { mUndoStack.push(JSON.stringify(mActions)); if(mUndoStack.length > 30) mUndoStack.shift(); mRedoStack = []; }
function undoModal() { if(mUndoStack.length > 0) { mRedoStack.push(JSON.stringify(mActions)); mActions = JSON.parse(mUndoStack.pop()); window.drawModalCanvas(); } }
function redoModal() { if(mRedoStack.length > 0) { mUndoStack.push(JSON.stringify(mActions)); mActions = JSON.parse(mRedoStack.pop()); window.drawModalCanvas(); } }

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

const emptyImage = new Image();
emptyImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function updatePresetsList() {
    const listContainer = document.getElementById('presets-list');
    const modalLibrary = document.getElementById('modal-presets-library-list');
    
    const presetNames = Object.keys(savedPresets);
    if (presetNames.length === 0) {
        if (listContainer) listContainer.innerHTML = '<span class="empty-log">No hay presets aún.</span>';
        if (modalLibrary) modalLibrary.innerHTML = '<span class="empty-log">Guarda presets primero.</span>';
        return;
    }

    const buildCardHTML = (name, index, isModal) => `
        <div class="preset-card ${isModal ? 'modal-lib-card' : ''}" draggable="true" data-preset="${name}">
            <div class="preset-card-header">
                <span class="preset-card-title">${name}</span>
                ${!isModal ? `
                <div style="display: flex; gap: 4px;">
                    <button class="preset-action-btn edit-preset-btn" data-preset="${name}" title="Editar Preset">✏️</button>
                    <button class="preset-action-btn delete-preset-btn" data-preset="${name}" style="color: #ef4444;" title="Eliminar">🗑️</button>
                </div>` : ''}
            </div>
            <canvas id="${isModal ? 'modal-lib-canvas' : 'mini-canvas'}-${index}" class="preset-mini-canvas" width="200" height="36"></canvas>
        </div>
    `;

    if (listContainer) listContainer.innerHTML = presetNames.map((name, i) => buildCardHTML(name, i, false)).join('');
    if (modalLibrary) modalLibrary.innerHTML = presetNames.map((name, i) => buildCardHTML(name, i, true)).join('');

    setTimeout(() => {
        presetNames.forEach((name, i) => {
            drawMiniCanvas(`mini-canvas-${i}`, savedPresets[name]);
            drawMiniCanvas(`modal-lib-canvas-${i}`, savedPresets[name]);
        });
    }, 50);

    document.querySelectorAll('.preset-card').forEach(card => {
        if (card.classList.contains('modal-lib-card')) {
            card.addEventListener('dblclick', function() {
                openPresetEditor(this.getAttribute('data-preset'));
            });
        }

        card.addEventListener('dragstart', function(e) {
            e.dataTransfer.setDragImage(emptyImage, 0, 0); 
            window.isDraggingPreset = true; 
            const name = this.getAttribute('data-preset');
            window.timelineGhostPreset = savedPresets[name];
        });
        card.addEventListener('dragend', function() {
            window.isDraggingPreset = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0; 
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
            window.drawModalCanvas(); 
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

window.drawMiniCanvas = drawMiniCanvas;

function openPresetEditor(name) {
    currentEditingPresetName = name;
    modalNameInput.value = name;
    mUndoStack = []; mRedoStack = [];
    
    mActions = JSON.parse(JSON.stringify(savedPresets[name]));
    mActions.forEach(a => a.selected = false);
    if (mActions.length === 0) mActions.push({at: 0, pos: 50, selected: false});
    mDuration = Math.max(1000, mActions[mActions.length - 1].at);
    
    mZoom = 1.0; mPanX = 0;

    modal.style.display = 'flex';
    ensureModalCanvasSize();
    mBasePixelsPerMs = (modalCanvas.width - 60) / mDuration;
    window.drawModalCanvas();

    document.addEventListener('keydown', modalKeydownHandler);
}

function closePresetEditor() {
    modal.style.display = 'none';
    currentEditingPresetName = "";
    mActions = [];
    document.removeEventListener('keydown', modalKeydownHandler);
}

function modalKeydownHandler(e) {
    if (modal.style.display !== 'flex') return;
    if (e.target.tagName === 'INPUT') return;
    const key = e.key.toLowerCase();

    if (e.code === 'Space') {
        if (window.isDraggingPreset || window.isPastingMode) {
            e.preventDefault();
            window.isAdaptiveModeActive = !window.isAdaptiveModeActive;
            if (typeof window.syncAdaptiveCheckboxes === 'function') window.syncAdaptiveCheckboxes(window.isAdaptiveModeActive);
            window.drawModalCanvas();
            return;
        }
    }
    
    if (e.ctrlKey && key === 'z') { e.preventDefault(); undoModal(); return; }
    if (e.ctrlKey && key === 'y') { e.preventDefault(); redoModal(); return; }
    if (e.ctrlKey && key === 'a') { e.preventDefault(); mActions.forEach(a => a.selected = true); window.drawModalCanvas(); return; }
    
    if (e.ctrlKey && key === 'c') {
        const selected = mActions.filter(a => a.selected);
        if (selected.length > 0) {
            const baseTime = selected[0].at;
            window.clipboardFunscript = selected.map(a => ({ at: a.at - baseTime, pos: a.pos }));
        }
        return;
    }
    if (e.ctrlKey && key === 'v') {
        if (window.clipboardFunscript && window.clipboardFunscript.length > 0) {
            window.isPastingMode = true;
            window.timelineGhostPreset = window.clipboardFunscript;
            window.drawModalCanvas();
        }
        return;
    }
    
    if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        if (mActions.some(a => a.selected)) {
            saveModalHistory();
            mActions = mActions.filter(a => !a.selected);
            window.drawModalCanvas();
        }
        return;
    }

    if (key === 'arrowup' || key === 'arrowdown') {
        e.preventDefault(); saveModalHistory();
        mActions.forEach(act => {
            if (act.selected) {
                const amt = key === 'arrowup' ? 5 : -5;
                const rounded = act.pos % 5 !== 0 ? (key === 'arrowup' ? Math.ceil(act.pos/5)*5 : Math.floor(act.pos/5)*5) : act.pos + amt;
                act.pos = Math.max(0, Math.min(100, rounded));
            }
        });
        window.drawModalCanvas(); return;
    }
    if (key === 'arrowleft' || key === 'arrowright') {
        e.preventDefault(); saveModalHistory();
        mActions.forEach(act => {
            if (act.selected) {
                const amt = key === 'arrowleft' ? -50 : 50;
                act.at += amt; 
            }
        });
        window.drawModalCanvas(); return;
    }
}

btnCancel?.addEventListener('click', closePresetEditor);

btnSave?.addEventListener('click', () => {
    const newName = modalNameInput.value.trim();
    if (!newName) { alert("El nombre no puede estar vacío."); return; }
    if (mActions.length === 0) { alert("¡Cuidado! El preset no puede estar vacío."); return; }

    mActions.sort((a, b) => a.at - b.at);
    const baseTime = mActions[0].at;
    mActions.forEach(act => { act.at -= baseTime; act.selected = false; });

    if (newName !== currentEditingPresetName) delete savedPresets[currentEditingPresetName];
    savedPresets[newName] = mActions;
    localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
    
    closePresetEditor(); updatePresetsList();
});

btnSaveNew?.addEventListener('click', () => {
    let newName = modalNameInput.value.trim();
    if (!newName) { alert("El nombre no puede estar vacío."); return; }
    if (mActions.length === 0) { alert("¡Cuidado! El preset no puede estar vacío."); return; }

    if (savedPresets[newName] && newName === currentEditingPresetName) {
        newName = newName + " (Copia)";
    } else if (savedPresets[newName]) {
        alert("Ese nombre ya existe. Por favor cámbialo."); return;
    }

    mActions.sort((a, b) => a.at - b.at);
    const baseTime = mActions[0].at;
    mActions.forEach(act => { act.at -= baseTime; act.selected = false; });

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

modalCanvas?.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.shiftKey) {
        const mouseX = e.clientX - modalCanvas.getBoundingClientRect().left;
        const timeAtMouse = mXToTime(mouseX);
        mZoom = Math.round((mZoom + (e.deltaY < 0 ? 0.02 : -0.02)) * 100) / 100;
        mZoom = Math.max(0.05, Math.min(mZoom, 20.0));
        mPanX = mouseX - 30 - (timeAtMouse * mBasePixelsPerMs * mZoom);
    } else {
        const panStep = 40;
        if (e.deltaY < 0) mPanX -= panStep; 
        else mPanX += panStep; 
    }
    window.drawModalCanvas();
}, { passive: false });

modalCanvas?.addEventListener('dragover', (e) => {
    if (window.isDraggingPreset && window.timelineGhostPreset) {
        e.preventDefault(); 
        const rect = modalCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let hoverTimeMs = mXToTime(mouseX);
        let hoverPosRaw = mYToPos(mouseY);
        
        const selected = mActions.filter(a => a.selected);
        if (window.isAdaptiveModeActive && selected.length >= 2) {
            window.drawModalCanvas();
            return;
        }

        const snapDistMs = 250; 
        const snapTargets = mActions.map(a => a.at);
        const presetDuration = window.timelineGhostPreset[window.timelineGhostPreset.length - 1].at;
        const presetMid = presetDuration / 2; 

        let bestSnapTime = hoverTimeMs;
        let minDistance = snapDistMs;

        snapTargets.forEach(target => {
            let distStart = Math.abs(hoverTimeMs - target);
            if (distStart < minDistance) { minDistance = distStart; bestSnapTime = target; }
            let distMid = Math.abs((hoverTimeMs + presetMid) - target);
            if (distMid < minDistance) { minDistance = distMid; bestSnapTime = target - presetMid; }
            let distEnd = Math.abs((hoverTimeMs + presetDuration) - target);
            if (distEnd < minDistance) { minDistance = distEnd; bestSnapTime = target - presetDuration; }
        });

        hoverTimeMs = bestSnapTime;
        
        let hoverPos = Math.round(hoverPosRaw / 5) * 5;
        const basePos = window.timelineGhostPreset[0].pos;
        window.timelineGhostDeltaPos = hoverPos - basePos;
        window.timelineGhostTimeMs = hoverTimeMs;
        window.drawModalCanvas();
    }
});

modalCanvas?.addEventListener('dragleave', () => {
    if (window.isDraggingPreset) { window.timelineGhostTimeMs = null; window.drawModalCanvas(); }
});

modalCanvas?.addEventListener('drop', (e) => {
    if (window.isDraggingPreset && window.timelineGhostPreset) {
        e.preventDefault();
        saveModalHistory();
        
        const rect = modalCanvas.getBoundingClientRect();
        let dropTimeMs = window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : mXToTime(e.clientX - rect.left);
        const deltaY = window.timelineGhostDeltaPos || 0;
        
        const presetDuration = window.timelineGhostPreset[window.timelineGhostPreset.length - 1].at;
        const endTimeMs = dropTimeMs + presetDuration;

        const selected = mActions.filter(a => a.selected);
        if (window.isAdaptiveModeActive && selected.length >= 2) {
            const morphed = window.getMorphedPreset(window.timelineGhostPreset, selected);
            if (morphed) {
                mActions = mActions.filter(a => !a.selected); 
                morphed.forEach(m => m.selected = true);
                mActions.push(...morphed);
                mActions.sort((a, b) => a.at - b.at);
                mDuration = Math.max(mDuration, mActions[mActions.length-1].at);
                window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
                window.drawModalCanvas();
                return;
            }
        }

        mActions = mActions.filter(act => act.at < dropTimeMs || act.at > endTimeMs);
        mActions.forEach(a => a.selected = false); 
        
        const newActions = window.timelineGhostPreset.map(act => ({
            at: dropTimeMs + act.at,
            pos: Math.max(0, Math.min(100, act.pos + deltaY)),
            selected: true 
        }));
        
        mActions.push(...newActions);
        mActions.sort((a, b) => a.at - b.at);
        mDuration = Math.max(mDuration, mActions[mActions.length-1].at);
        
        window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
        window.drawModalCanvas();
    }
});

window.drawModalCanvas = function() {
    if (!mCtx || !modalCanvas) return;
    ensureModalCanvasSize();
    
    const isLight = document.body.classList.contains('light-theme');
    const bgColor = isLight ? '#f8fafc' : '#06090e';
    const gridColor = isLight ? 'rgba(100, 116, 139, 0.2)' : 'rgba(30, 41, 59, 0.5)';
    const textColor = isLight ? '#475569' : '#94a3b8';
    const timeLineColor = isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.05)';

    mCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
    mCtx.fillStyle = bgColor;
    mCtx.fillRect(0, 0, modalCanvas.width, modalCanvas.height);

    mCtx.lineWidth = 1;
    [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(p => {
        const y = mPosToY(p);
        mCtx.strokeStyle = gridColor;
        mCtx.beginPath(); mCtx.moveTo(30, y); mCtx.lineTo(modalCanvas.width, y); mCtx.stroke();
        mCtx.fillStyle = textColor; mCtx.font = '10px monospace'; mCtx.fillText(`${p}%`, 2, y + 3);
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

    const startTimeMs = mXToTime(30);
    const endTimeMs = mXToTime(modalCanvas.width);
    let t = Math.floor(startTimeMs / stepMs) * stepMs;

    mCtx.fillStyle = textColor; mCtx.font = '10px monospace';
    while (t <= endTimeMs) {
        const x = mTimeToX(t);
        if (x >= 30) {
            mCtx.strokeStyle = timeLineColor; 
            mCtx.beginPath(); mCtx.moveTo(x, 0); mCtx.lineTo(x, modalCanvas.height); mCtx.stroke();
            mCtx.fillText(formatModalLabel(t), x + 4, 12);
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
            
            // 🎯 ROJO NEÓN EN PUNTOS SELECCIONADOS DEL MODAL
            let isTargetForMorph = act.selected && window.isAdaptiveModeActive && (window.isDraggingPreset || window.isPastingMode);
            
            mCtx.fillStyle = isTargetForMorph ? '#ef4444' : (act.selected ? '#f59e0b' : '#38bdf8');
            mCtx.beginPath(); mCtx.arc(x, y, isTargetForMorph ? 8 : (act.selected ? 7 : 5), 0, Math.PI * 2); mCtx.fill();
            mCtx.strokeStyle = isLight ? '#0f172a' : '#ffffff'; mCtx.lineWidth = 1.5; mCtx.stroke();
        });
    }

    if (mIsSelecting) {
        mCtx.lineWidth = 1; mCtx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; mCtx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        mCtx.setLineDash([2, 2]); mCtx.beginPath(); mCtx.fillRect(mStartX, mStartY, mCurrentX - mStartX, mCurrentY - mStartY); mCtx.strokeRect(mStartX, mStartY, mCurrentX - mStartX, mCurrentY - mStartY); mCtx.setLineDash([]);
    }

    if ((window.isDraggingPreset || window.isPastingMode) && window.timelineGhostPreset && window.timelineGhostTimeMs !== null) {
        const selected = mActions.filter(a => a.selected);
        if (window.isAdaptiveModeActive && selected.length >= 2) {
            const morphed = window.getMorphedPreset(window.timelineGhostPreset, selected);
            if (morphed) {
                mCtx.lineWidth = 3; mCtx.strokeStyle = 'rgba(244, 63, 94, 0.9)'; mCtx.beginPath();
                morphed.forEach((act, index) => {
                    const x = mTimeToX(act.at); const y = mPosToY(act.pos); 
                    if (index === 0) mCtx.moveTo(x, y); else mCtx.lineTo(x, y);
                });
                mCtx.stroke();
                morphed.forEach(act => {
                    const x = mTimeToX(act.at); const y = mPosToY(act.pos);
                    mCtx.fillStyle = 'rgba(244, 63, 94, 1)';
                    mCtx.beginPath(); mCtx.arc(x, y, 5, 0, Math.PI * 2); mCtx.fill();
                });
                mCtx.fillStyle = '#f43f5e'; mCtx.font = 'bold 12px monospace';
                mCtx.fillText("⚡ MODO ADAPTATIVO", mTimeToX(morphed[0].at), mPosToY(morphed[0].pos) - 15);
            }
        } else {
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
            if (window.isPastingMode) {
                mCtx.fillStyle = '#10b981'; mCtx.font = 'bold 12px monospace';
                mCtx.fillText("📋 PEGAR", mTimeToX(window.timelineGhostTimeMs), mPosToY(window.timelineGhostPreset[0].pos + deltaY) - 15);
            }
        }
    }
    
    if (mSnapPoint && !mIsSelecting && !mIsDragging) {
        const px = mTimeToX(mSnapPoint.at);
        const py = mPosToY(mSnapPoint.pos);
        mCtx.lineWidth = 2; mCtx.strokeStyle = '#10b981'; 
        mCtx.beginPath(); mCtx.arc(px, py, 9, 0, Math.PI * 2); mCtx.stroke();
        mCtx.fillStyle = 'rgba(16, 185, 129, 0.3)'; mCtx.fill();
    }
}

function getModalMousePos(e) {
    const rect = modalCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

modalCanvas?.addEventListener('mousedown', (e) => {
    if (window.isPastingMode && window.timelineGhostPreset) {
        if (e.button === 0) {
            saveModalHistory();
            const pos = getModalMousePos(e);
            let dropTimeMs = window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : mXToTime(pos.x);
            const deltaY = window.timelineGhostDeltaPos || 0;
            
            const selected = mActions.filter(a => a.selected);
            if (window.isAdaptiveModeActive && selected.length >= 2) {
                const morphed = window.getMorphedPreset(window.timelineGhostPreset, selected);
                if (morphed) {
                    mActions = mActions.filter(a => !a.selected); 
                    morphed.forEach(m => m.selected = true);
                    mActions.push(...morphed);
                    mActions.sort((a, b) => a.at - b.at);
                    mDuration = Math.max(mDuration, mActions[mActions.length-1].at);
                    window.isPastingMode = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
                    window.drawModalCanvas(); return;
                }
            }
            
            const newActions = window.timelineGhostPreset.map(act => ({
                at: dropTimeMs + act.at,
                pos: Math.max(0, Math.min(100, act.pos + deltaY)),
                selected: true 
            }));
            
            const newTimes = new Set(newActions.map(a => a.at));
            mActions = mActions.filter(a => !newTimes.has(a.at)); 
            mActions.forEach(a => a.selected = false);
            mActions.push(...newActions);
            mActions.sort((a, b) => a.at - b.at);
            mDuration = Math.max(mDuration, mActions[mActions.length-1].at);
            
            window.isPastingMode = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
            window.drawModalCanvas(); return;
        } else if (e.button === 2) {
            window.isPastingMode = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
            window.drawModalCanvas(); return;
        }
    }

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
            window.drawModalCanvas();
        } else {
            let hadSelection = mActions.some(a => a.selected);
            if (!e.ctrlKey) mActions.forEach(a => a.selected = false);
            if (!hadSelection) {
                saveModalHistory();
                let clickTime = Math.round(mXToTime(pos.x) / 50) * 50; 
                let clickPos = Math.round(mYToPos(pos.y) / 5) * 5;
                if (mSnapPoint) { clickTime = mSnapPoint.at; clickPos = mSnapPoint.pos; }
                
                mActions.push({ at: clickTime, pos: Math.max(0, Math.min(100, clickPos)), selected: true });
                mActions.sort((a, b) => a.at - b.at);
                mDuration = Math.max(mDuration, mActions[mActions.length - 1].at);
            } else {
                mIsSelecting = true; mHasDraggedSelection = false; 
                mStartX = pos.x; mStartY = pos.y; mCurrentX = pos.x; mCurrentY = pos.y;
            }
            window.drawModalCanvas();
        }
    } else if (e.button === 2) { 
        e.preventDefault(); saveModalHistory();
        mActions = mActions.filter(act => Math.hypot(pos.x - mTimeToX(act.at), pos.y - mPosToY(act.pos)) > 10);
        window.drawModalCanvas();
    }
});

modalCanvas?.addEventListener('mousemove', (e) => {
    const pos = getModalMousePos(e);
    
    if (window.isPastingMode && window.timelineGhostPreset) {
        let hoverTimeMs = mXToTime(pos.x);
        let hoverPosRaw = mYToPos(pos.y);
        
        const selected = mActions.filter(a => a.selected);
        if (window.isAdaptiveModeActive && selected.length >= 2) {
            window.drawModalCanvas(); return;
        }

        const snapDistMs = 250; 
        const snapTargets = mActions.map(a => a.at);
        const presetDuration = window.timelineGhostPreset[window.timelineGhostPreset.length - 1].at;
        const presetMid = presetDuration / 2; 

        let bestSnapTime = hoverTimeMs;
        let minDistance = snapDistMs;

        snapTargets.forEach(target => {
            let distStart = Math.abs(hoverTimeMs - target);
            if (distStart < minDistance) { minDistance = distStart; bestSnapTime = target; }
            let distMid = Math.abs((hoverTimeMs + presetMid) - target);
            if (distMid < minDistance) { minDistance = distMid; bestSnapTime = target - presetMid; }
            let distEnd = Math.abs((hoverTimeMs + presetDuration) - target);
            if (distEnd < minDistance) { minDistance = distEnd; bestSnapTime = target - presetDuration; }
        });

        hoverTimeMs = bestSnapTime;
        let hoverPos = Math.round(hoverPosRaw / 5) * 5;
        const basePos = window.timelineGhostPreset[0].pos;
        window.timelineGhostDeltaPos = hoverPos - basePos;
        window.timelineGhostTimeMs = hoverTimeMs;
        window.drawModalCanvas(); return;
    }

    mSnapPoint = null;
    if (!mIsSelecting && !mIsDragging) {
        let minDist = 15;
        mActions.forEach(act => {
            const px = mTimeToX(act.at); const py = mPosToY(act.pos);
            const dist = Math.hypot(pos.x - px, pos.y - py);
            if(dist < minDist) { minDist = dist; mSnapPoint = { at: act.at, pos: act.pos }; }
        });
    }

    if (mIsDragging && mDragInitialStates.length > 0) {
        let snappedTimeDelta = 0; let snappedPosDelta = 0; let useMagnet = false;
        if (mSnapPoint && mDraggedNodeIndex !== -1) {
            const initial = mDragInitialStates[mDraggedNodeIndex];
            snappedTimeDelta = mSnapPoint.at - initial.at;
            snappedPosDelta = mSnapPoint.pos - initial.pos;
            useMagnet = true;
        } else {
            const rawTimeDelta = mXToTime(pos.x) - mStartX;
            const rawPosDelta = mYToPos(pos.y) - mStartY;
            snappedTimeDelta = Math.round(rawTimeDelta / 50) * 50; 
            snappedPosDelta = Math.round(rawPosDelta / 5) * 5;
        }

        mActions.forEach((act, i) => {
            if (mDragInitialStates[i].selected) {
                act.at = mDragInitialStates[i].at + snappedTimeDelta; 
                if (useMagnet) act.pos = Math.max(0, Math.min(100, mDragInitialStates[i].pos + snappedPosDelta));
                else act.pos = Math.max(0, Math.min(100, Math.round((mDragInitialStates[i].pos + snappedPosDelta) / 5) * 5));
            }
        });
        window.drawModalCanvas();
    } else if (mIsSelecting) {
        mCurrentX = pos.x; mCurrentY = pos.y;
        if (Math.hypot(mCurrentX - mStartX, mCurrentY - mStartY) > 5) mHasDraggedSelection = true;
        const minX = Math.min(mStartX, mCurrentX); const maxX = Math.max(mStartX, mCurrentX);
        const minY = Math.min(mStartY, mCurrentY); const maxY = Math.max(mStartY, mCurrentY);
        mActions.forEach(act => {
            const nx = mTimeToX(act.at); const ny = mPosToY(act.pos);
            act.selected = (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY);
        });
        window.drawModalCanvas();
    }
});

modalCanvas?.addEventListener('mouseup', () => { 
    if (window.isPastingMode) return;
    if (mIsDragging || mHasDraggedSelection) { 
        mActions.sort((a, b) => a.at - b.at); 
        const selectedTimes = new Set(mActions.filter(a => a.selected).map(a => a.at));
        mActions = mActions.filter(a => a.selected || !selectedTimes.has(a.at));

        for (let i = mActions.length - 1; i > 0; i--) { if (mActions[i].at === mActions[i-1].at) mActions.splice(mActions[i].selected ? i-1 : i, 1); }
        mDuration = Math.max(mDuration, mActions[mActions.length - 1].at); 
    }
    mIsDragging = false; mDragInitialStates = []; mIsSelecting = false; mDraggedNodeIndex = -1; window.drawModalCanvas(); 
});
modalCanvas?.addEventListener('mouseleave', () => { mIsDragging = false; mDragInitialStates = []; mIsSelecting = false; mDraggedNodeIndex = -1; window.drawModalCanvas(); });
modalCanvas?.addEventListener('contextmenu', e => e.preventDefault());

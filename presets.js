// ==========================================================================
// PRESETS.JS V78.0: MOTOR DE ATAJOS AISLADO Y MODO CLARO COMPATIBLE
// ==========================================================================

window.savedPresets = {};
window.currentEditingPreset = [];
window.originalEditingPresetName = null; 
window.isDraggingPreset = false;
window.timelineGhostPreset = null;
window.timelineGhostTimeMs = null;
window.timelineGhostDeltaPos = 0;
window.isRightClickDrag = false; 

let modalAnimationFrame = null;
let mZoom = 1.0;
let mBasePixels = 0.5; 
let mScrollMs = -100; 
let mIsDragging = false;
let mIsSelecting = false;
let mHasDragged = false;
let mStartX = 0, mStartY = 0, mCurrX = 0, mCurrY = 0;

let mUndoStack = [];
let mRedoStack = [];

window.mGhostTimeMs = null;
window.mGhostDeltaPos = 0;

const modalEl = document.getElementById('preset-editor-modal');
const nameInput = document.getElementById('preset-editor-name');
const modalCanvas = document.getElementById('preset-editor-canvas');
const modalCtx = modalCanvas ? modalCanvas.getContext('2d') : null;

function getSafeId(str) {
    return Array.from(str).map(c => c.charCodeAt(0).toString(16)).join('');
}

function loadPresets() {
    try { window.savedPresets = JSON.parse(localStorage.getItem('funscript_saved_presets')) || {}; } 
    catch (e) { window.savedPresets = {}; }
    renderPresetsList();
}

function savePresetsToStorage() {
    localStorage.setItem('funscript_saved_presets', JSON.stringify(window.savedPresets));
    renderPresetsList();
}

function formatModalTime(timeMs) {
    const isNeg = timeMs < 0;
    const totalSecs = Math.abs(timeMs) / 1000;
    let sign = isNeg ? "-" : "";
    if (totalSecs < 60) {
        if (mZoom >= 3.0) return `${sign}${totalSecs.toFixed(2)}s`;
        return `${sign}${totalSecs.toFixed(1)}s`;
    }
    const m = Math.floor(totalSecs / 60);
    const s = (totalSecs % 60).toFixed(mZoom >= 3.0 ? 2 : 1).padStart(5, '0');
    return `${sign}${m}:${s.replace('.0', '')}`;
}

function getModalTimeSnap() {
    if (mZoom >= 6.0) return 10;   
    if (mZoom >= 3.0) return 50;   
    if (mZoom >= 1.0) return 100;  
    if (mZoom >= 0.5) return 500;  
    return 1000;                   
}

function renderPresetsList() {
    const listMain = document.getElementById('presets-list');
    const listModal = document.getElementById('modal-presets-library-list');
    const keys = Object.keys(window.savedPresets);
    
    const html = keys.length === 0 
        ? '<span class="empty-log">No hay presets aún.</span>' 
        : keys.map(k => `
            <div class="preset-card" data-name="${k}">
                <div class="preset-card-header">
                    <span class="preset-card-title" title="${k}">${k}</span>
                    <div>
                        <button class="preset-action-btn preset-edit-btn" data-name="${k}" title="Editar Preset">✏️</button>
                        <button class="preset-action-btn preset-delete-btn" data-name="${k}" title="Eliminar Preset">🗑️</button>
                    </div>
                </div>
                <canvas id="mini-canvas-${getSafeId(k)}" class="preset-mini-canvas"></canvas>
            </div>
        `).join('');

    if (listMain) listMain.innerHTML = html;
    if (listModal) listModal.innerHTML = html;

    document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('contextmenu', e => e.preventDefault());
        card.addEventListener('mousedown', (e) => {
            if (e.target.closest('.preset-action-btn')) return; 
            const name = card.getAttribute('data-name');
            if (window.savedPresets[name]) {
                window.isRightClickDrag = (e.button === 2);
                startCustomDrag(e, name, window.savedPresets[name]);
            }
        });
    });

    document.querySelectorAll('.preset-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.getAttribute('data-name');
            if (window.savedPresets[name]) {
                window.currentEditingPreset = JSON.parse(JSON.stringify(window.savedPresets[name])); 
                window.currentEditingPreset.forEach(a => a.selected = false);
                window.originalEditingPresetName = name; 
                if (nameInput) nameInput.value = name;
                openModal();
            }
        });
    });

    document.querySelectorAll('.preset-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.getAttribute('data-name');
            if (confirm(`¿Eliminar preset "${name}"?`)) {
                delete window.savedPresets[name];
                savePresetsToStorage();
            }
        });
    });

    keys.forEach(k => drawMiniCanvas(k, window.savedPresets[k]));
}

window.updatePresetsList = renderPresetsList;

function startCustomDrag(e, name, actions) {
    e.preventDefault(); 
    window.isDraggingPreset = true;
    window.timelineGhostPreset = actions;
    window.timelineGhostTimeMs = null;
    window.timelineGhostDeltaPos = 0;

    const ghost = document.createElement('canvas');
    ghost.id = "custom-drag-ghost";
    ghost.width = 160; ghost.height = 70;
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none'; 
    ghost.style.zIndex = '999999';
    ghost.style.transform = 'translate(-50%, -50%)'; 
    ghost.style.transition = 'opacity 0.1s';
    document.body.appendChild(ghost);

    const ctxGhost = ghost.getContext('2d');
    ctxGhost.fillStyle = 'rgba(15, 23, 42, 0.9)'; 
    ctxGhost.beginPath(); ctxGhost.roundRect(0, 0, ghost.width, ghost.height, 8); ctxGhost.fill();
    
    ctxGhost.strokeStyle = window.isRightClickDrag ? '#f43f5e' : '#38bdf8'; 
    ctxGhost.lineWidth = 1.5; ctxGhost.stroke();
    
    ctxGhost.fillStyle = '#94a3b8'; ctxGhost.font = 'bold 10px sans-serif';
    ctxGhost.fillText(name, 10, 16);

    if (actions && actions.length > 0) {
        const duration = actions[actions.length - 1].at || 1;
        const padX = 10, padY = 24, w = ghost.width - padX*2, h = ghost.height - padY - 8;
        
        ctxGhost.strokeStyle = '#f97316'; ctxGhost.lineWidth = 2.5; ctxGhost.beginPath();
        actions.forEach((act, i) => {
            const px = padX + (act.at / duration) * w;
            const py = padY + h - (act.pos / 100) * h;
            if (i === 0) ctxGhost.moveTo(px, py); else ctxGhost.lineTo(px, py);
        });
        ctxGhost.stroke();
        actions.forEach(act => {
            const px = padX + (act.at / duration) * w;
            const py = padY + h - (act.pos / 100) * h;
            ctxGhost.fillStyle = '#ffffff'; ctxGhost.beginPath(); ctxGhost.arc(px, py, 2.5, 0, Math.PI*2); ctxGhost.fill();
        });
    }

    function moveGhost(clientX, clientY) {
        ghost.style.left = clientX + 'px';
        ghost.style.top = clientY + 'px';
    }
    moveGhost(e.clientX, e.clientY);

    const onMouseMove = (moveEvent) => {
        moveGhost(moveEvent.clientX, moveEvent.clientY);
        let hidden = false;
        
        const timelineCanvas = document.getElementById('timeline-canvas');
        if (timelineCanvas && (!modalEl || modalEl.style.display !== 'flex')) {
            const rect = timelineCanvas.getBoundingClientRect();
            if (moveEvent.clientX >= rect.left && moveEvent.clientX <= rect.right && moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
                hidden = true;
                const ev = new CustomEvent('presetCustomDragOver', { detail: { clientX: moveEvent.clientX, clientY: moveEvent.clientY } });
                window.dispatchEvent(ev);
            } else {
                window.timelineGhostTimeMs = null;
            }
        }
        
        if (modalEl && modalEl.style.display === 'flex' && modalCanvas) {
            const rect = modalCanvas.getBoundingClientRect();
            if (moveEvent.clientX >= rect.left && moveEvent.clientX <= rect.right && moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
                hidden = true;
                const ev = new CustomEvent('modalCustomDragOver', { detail: { clientX: moveEvent.clientX, clientY: moveEvent.clientY } });
                window.dispatchEvent(ev);
            } else {
                window.mGhostTimeMs = null;
            }
        }

        ghost.style.opacity = hidden ? '0' : '1';
        if(typeof window.drawTimeline === 'function' && !modalEl?.style.display) window.drawTimeline();
    };

    const onMouseUp = (upEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (document.body.contains(ghost)) document.body.removeChild(ghost);
        
        let droppedOnTimeline = false;
        let droppedOnModal = false;

        if (modalEl && modalEl.style.display === 'flex' && modalCanvas) {
            const rect = modalCanvas.getBoundingClientRect();
            if (upEvent.clientX >= rect.left && upEvent.clientX <= rect.right && upEvent.clientY >= rect.top && upEvent.clientY <= rect.bottom) {
                droppedOnModal = true;
            }
        } else {
            const timelineCanvas = document.getElementById('timeline-canvas');
            if (timelineCanvas) {
                const rect = timelineCanvas.getBoundingClientRect();
                if (upEvent.clientX >= rect.left && upEvent.clientX <= rect.right && upEvent.clientY >= rect.top && upEvent.clientY <= rect.bottom) {
                    droppedOnTimeline = true;
                }
            }
        }

        if (droppedOnModal) {
            const ev = new CustomEvent('modalCustomDrop', { detail: { clientX: upEvent.clientX, clientY: upEvent.clientY } });
            window.dispatchEvent(ev);
        } else if (droppedOnTimeline) {
            const ev = new CustomEvent('presetCustomDrop', { detail: { clientX: upEvent.clientX, clientY: upEvent.clientY } });
            window.dispatchEvent(ev);
        } else {
            window.isDraggingPreset = false;
            window.timelineGhostPreset = null;
            if(typeof window.drawTimeline === 'function') window.drawTimeline();
        }
        
        setTimeout(() => { window.isRightClickDrag = false; }, 50);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function drawMiniCanvas(name, actions) {
    const safeId = getSafeId(name);
    document.querySelectorAll(`[id="mini-canvas-${safeId}"]`).forEach(canvas => {
        const mctx = canvas.getContext('2d');
        if(!mctx) return;
        const rect = canvas.getBoundingClientRect();
        if(rect.width > 0) { canvas.width = rect.width; canvas.height = rect.height; }
        mctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if(!actions || actions.length === 0) return;
        const duration = actions[actions.length - 1].at || 1;
        
        mctx.strokeStyle = '#38bdf8'; mctx.lineWidth = 2; mctx.beginPath();
        actions.forEach((act, i) => {
            const x = (act.at / duration) * canvas.width;
            const y = canvas.height - (act.pos / 100) * canvas.height;
            if(i===0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
        });
        mctx.stroke();
        actions.forEach(act => {
            const x = (act.at / duration) * canvas.width;
            const y = canvas.height - (act.pos / 100) * canvas.height;
            mctx.fillStyle = '#f97316'; mctx.beginPath(); mctx.arc(x, y, 2.5, 0, Math.PI*2); mctx.fill();
        });
    });
}

window.addEventListener('modalCustomDragOver', (e) => {
    if (!modalCanvas) return;
    if (window.isDraggingPreset && window.timelineGhostPreset) {
        const rect = modalCanvas.getBoundingClientRect();
        const pos = { x: e.detail.clientX - rect.left, y: e.detail.clientY - rect.top };
        let hoverTimeMs = mXToTime(pos.x);
        let hoverPosRaw = mYToPos(pos.y);

        const snapDistMs = 150; 
        const targets = window.currentEditingPreset.map(a => a.at);
        const presetDuration = window.timelineGhostPreset[window.timelineGhostPreset.length - 1].at;
        const presetMid = presetDuration / 2;

        let bestSnapTime = hoverTimeMs;
        let minDistance = snapDistMs;

        targets.forEach(target => {
            let dStart = Math.abs(hoverTimeMs - target);
            if (dStart < minDistance) { minDistance = dStart; bestSnapTime = target; }
            let dMid = Math.abs((hoverTimeMs + presetMid) - target);
            if (dMid < minDistance) { minDistance = dMid; bestSnapTime = target - presetMid; }
            let dEnd = Math.abs((hoverTimeMs + presetDuration) - target);
            if (dEnd < minDistance) { minDistance = dEnd; bestSnapTime = target - presetDuration; }
        });

        if (bestSnapTime < 0) bestSnapTime = 0;
        window.mGhostTimeMs = bestSnapTime;
        let hoverPos = Math.round(hoverPosRaw / 5) * 5;
        const basePos = window.timelineGhostPreset[0].pos;
        window.mGhostDeltaPos = hoverPos - basePos;
    }
});

window.addEventListener('modalCustomDrop', (e) => {
    if (window.isDraggingPreset && window.timelineGhostPreset && window.mGhostTimeMs !== null) {
        saveModalHistoryState();
        
        const newActions = window.timelineGhostPreset.map(act => ({
            at: window.mGhostTimeMs + act.at,
            pos: Math.max(0, Math.min(100, act.pos + window.mGhostDeltaPos)),
            selected: true 
        }));
        
        const newTimes = new Set(newActions.map(a => a.at));
        window.currentEditingPreset = window.currentEditingPreset.filter(a => !newTimes.has(a.at));
        window.currentEditingPreset.forEach(a => a.selected = false);
        window.currentEditingPreset.push(...newActions);
        window.currentEditingPreset.sort((a, b) => a.at - b.at);
        
        window.isDraggingPreset = false; window.timelineGhostPreset = null; window.mGhostTimeMs = null; window.mGhostDeltaPos = 0;
    }
});

document.getElementById('save-preset-btn')?.addEventListener('click', () => {
    if (!window.funscriptActions) return;
    const selected = window.funscriptActions.filter(a => a.selected).sort((a,b) => a.at - b.at);
    if (selected.length === 0) return alert("⚠️ Selecciona al menos un punto en la línea de tiempo para crear un Preset.");

    const baseTime = selected[0].at;
    window.currentEditingPreset = selected.map(a => ({ at: a.at - baseTime, pos: a.pos, selected: false }));
    
    window.originalEditingPresetName = null; 
    if (nameInput) nameInput.value = "Nuevo Preset";
    openModal();
});

function handleSave(forceNew) {
    let name = nameInput ? nameInput.value.trim() : "Preset";
    if (!name) name = "Preset Sin Nombre";

    if (forceNew) {
        if (window.savedPresets[name]) {
            let counter = 1;
            let newName = `${name} (${counter})`;
            while (window.savedPresets[newName]) { counter++; newName = `${name} (${counter})`; }
            name = newName;
        }
    } else {
        if (window.savedPresets[name] && name !== window.originalEditingPresetName) {
            const conf = confirm(`⚠️ Ya existe un preset llamado "${name}".\n¿Deseas reemplazarlo?`);
            if (!conf) return; 
        }
    }

    if (!forceNew && window.originalEditingPresetName && name !== window.originalEditingPresetName) {
        delete window.savedPresets[window.originalEditingPresetName];
    }

    const finalPreset = window.currentEditingPreset.map(a => ({at: a.at, pos: a.pos}));
    window.savedPresets[name] = finalPreset;
    window.originalEditingPresetName = name; 
    savePresetsToStorage();
    closeModal();
}

document.getElementById('preset-editor-save')?.addEventListener('click', () => handleSave(false));
document.getElementById('preset-editor-save-new')?.addEventListener('click', () => handleSave(true));
document.getElementById('preset-editor-cancel')?.addEventListener('click', closeModal);

function openModal() {
    if(modalEl) modalEl.style.display = 'flex';
    mZoom = 1.0; mScrollMs = -100; mUndoStack = []; mRedoStack = [];
    if(modalAnimationFrame) cancelAnimationFrame(modalAnimationFrame);
    renderModalCanvas();
}

function closeModal() {
    if(modalEl) modalEl.style.display = 'none';
    if(modalAnimationFrame) cancelAnimationFrame(modalAnimationFrame);
}

function mTimeToX(timeMs) { return 40 + (timeMs - mScrollMs) * (mBasePixels * mZoom); }
function mXToTime(x) { return mScrollMs + (x - 40) / (mBasePixels * mZoom); }
function mPosToY(pos) { const pad = 30; const h = modalCanvas.height - pad*2; return modalCanvas.height - pad - (pos/100)*h; }
function mYToPos(y) { const pad = 30; const h = modalCanvas.height - pad*2; return Math.max(0, Math.min(100, Math.round(((modalCanvas.height - pad - y) / h) * 100))); }

window.drawModalCanvas = renderModalCanvas;

function renderModalCanvas() {
    if(!modalCtx || !modalCanvas) return;
    const rect = modalCanvas.parentElement.getBoundingClientRect();
    if(rect.width > 0 && (modalCanvas.width !== rect.width || modalCanvas.height !== rect.height)) { 
        modalCanvas.width = rect.width; modalCanvas.height = rect.height; 
    }

    const loop = () => {
        if(modalEl.style.display === 'none') return;
        
        const isLight = document.body.classList.contains('light-theme');
        
        modalCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
        modalCtx.fillStyle = isLight ? '#f1f5f9' : '#06090e'; 
        modalCtx.fillRect(0, 0, modalCanvas.width, modalCanvas.height);

        modalCtx.lineWidth = 1;
        modalCtx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.2)' : 'rgba(148, 163, 184, 0.15)';
        for(let p = 0; p <= 100; p += 10) {
            const y = mPosToY(p);
            modalCtx.beginPath(); modalCtx.moveTo(40, y); modalCtx.lineTo(modalCanvas.width, y); modalCtx.stroke();
            modalCtx.fillStyle = isLight ? '#475569' : '#94a3b8'; modalCtx.font = 'bold 10px monospace';
            modalCtx.fillText(p+'%', 5, y+4);
        }

        let stepMs = 100;
        if(mZoom >= 6.0) stepMs = 10;
        else if(mZoom >= 3.0) stepMs = 50;
        else if(mZoom >= 1.0) stepMs = 100;
        else if(mZoom >= 0.5) stepMs = 500;
        else if(mZoom >= 0.2) stepMs = 1000;
        else stepMs = 2000;
        
        let startT = Math.floor(mXToTime(40) / stepMs) * stepMs;
        let endT = mXToTime(modalCanvas.width);
        
        for(let t = startT; t <= endT; t += stepMs) {
            const x = mTimeToX(t);
            if (x >= 40) {
                modalCtx.beginPath(); modalCtx.moveTo(x, 0); modalCtx.lineTo(x, modalCanvas.height); modalCtx.stroke();
                modalCtx.fillText(formatModalTime(t), x+5, 15);
            }
        }

        modalCtx.fillStyle = isLight ? '#e2e8f0' : '#0b0f17'; 
        modalCtx.fillRect(0, 0, 40, modalCanvas.height);
        modalCtx.strokeStyle = isLight ? '#cbd5e1' : '#1e293b'; 
        modalCtx.beginPath(); modalCtx.moveTo(40, 0); modalCtx.lineTo(40, modalCanvas.height); modalCtx.stroke();
        
        for(let p = 0; p <= 100; p += 10) {
            const y = mPosToY(p);
            modalCtx.fillStyle = isLight ? '#475569' : '#94a3b8'; modalCtx.font = 'bold 10px monospace';
            modalCtx.fillText(p+'%', 5, y+4);
        }

        if(window.currentEditingPreset && window.currentEditingPreset.length > 0) {
            window.currentEditingPreset.sort((a,b) => a.at - b.at);
            modalCtx.strokeStyle = isLight ? '#0284c7' : '#38bdf8'; 
            modalCtx.lineWidth = 3; modalCtx.beginPath();
            window.currentEditingPreset.forEach((act, i) => {
                const px = mTimeToX(act.at); const py = mPosToY(act.pos);
                if(i===0) modalCtx.moveTo(px, py); else modalCtx.lineTo(px, py);
            });
            modalCtx.stroke();
            
            window.currentEditingPreset.forEach(act => {
                const px = mTimeToX(act.at); const py = mPosToY(act.pos);
                if (px >= 30) {
                    modalCtx.fillStyle = act.selected ? '#f59e0b' : (isLight ? '#0284c7' : '#38bdf8'); 
                    modalCtx.beginPath(); modalCtx.arc(px, py, act.selected ? 7 : 5, 0, Math.PI*2); modalCtx.fill();
                    modalCtx.strokeStyle = isLight ? '#0f172a' : '#fff'; modalCtx.lineWidth = 1.5; modalCtx.stroke();
                    
                    let txtY = act.pos >= 50 ? py + 16 : py - 10;
                    let txtX = px + 6;
                    let text = `${act.pos}%`;
                    
                    modalCtx.font = 'bold 10px monospace';
                    let tWidth = modalCtx.measureText(text).width;
                    
                    modalCtx.fillStyle = isLight ? 'rgba(241, 245, 249, 0.75)' : 'rgba(6, 9, 14, 0.75)';
                    modalCtx.fillRect(txtX - 2, txtY - 9, tWidth + 4, 12);
                    
                    modalCtx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)';
                    modalCtx.fillText(text, txtX, txtY);
                }
            });
        }

        if (window.isDraggingPreset && window.timelineGhostPreset && window.mGhostTimeMs !== null) {
            const deltaY = window.mGhostDeltaPos || 0;
            modalCtx.lineWidth = 3; modalCtx.strokeStyle = 'rgba(16, 185, 129, 0.8)'; modalCtx.beginPath();
            window.timelineGhostPreset.forEach((act, index) => {
                const x = mTimeToX(window.mGhostTimeMs + act.at);
                const y = mPosToY(Math.max(0, Math.min(100, act.pos + deltaY)));
                if (index === 0) modalCtx.moveTo(x, y); else modalCtx.lineTo(x, y);
            });
            modalCtx.stroke();
            window.timelineGhostPreset.forEach(act => {
                const x = mTimeToX(window.mGhostTimeMs + act.at);
                const y = mPosToY(Math.max(0, Math.min(100, act.pos + deltaY)));
                modalCtx.fillStyle = 'rgba(16, 185, 129, 0.9)';
                modalCtx.beginPath(); modalCtx.arc(x, y, 5, 0, Math.PI * 2); modalCtx.fill();
            });
        }

        if (mIsSelecting) {
            modalCtx.lineWidth = 1; modalCtx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; modalCtx.fillStyle = 'rgba(56, 189, 248, 0.12)';
            modalCtx.setLineDash([2, 2]); modalCtx.beginPath(); 
            modalCtx.fillRect(mStartX, mStartY, mCurrX - mStartX, mCurrY - mStartY); 
            modalCtx.strokeRect(mStartX, mStartY, mCurrX - mStartX, mCurrY - mStartY); 
            modalCtx.setLineDash([]);
        }

        modalAnimationFrame = requestAnimationFrame(loop);
    };
    loop();
}

function saveModalHistoryState() {
    mUndoStack.push(JSON.stringify(window.currentEditingPreset));
    if (mUndoStack.length > 50) mUndoStack.shift();
    mRedoStack = [];
}
function undoModal() {
    if (mUndoStack.length > 0) {
        mRedoStack.push(JSON.stringify(window.currentEditingPreset));
        window.currentEditingPreset = JSON.parse(mUndoStack.pop());
    }
}
function redoModal() {
    if (mRedoStack.length > 0) {
        mUndoStack.push(JSON.stringify(window.currentEditingPreset));
        window.currentEditingPreset = JSON.parse(mRedoStack.pop());
    }
}

// 🎯 FIX: REESTRUCTURA DE ATAJOS PARA EL MODAL (Aislado de la línea principal)
document.addEventListener('keydown', (e) => {
    if (modalEl && modalEl.style.display === 'flex') {
        if ((e.target.tagName === 'INPUT' && e.target.type === 'text') || e.target.tagName === 'TEXTAREA' || e.target.type === 'number') return;
        
        const key = e.key.toLowerCase();
        const hasSelection = window.currentEditingPreset.some(a => a.selected);

        if (e.ctrlKey) {
            if (key === 'z') { e.preventDefault(); undoModal(); }
            if (key === 'y') { e.preventDefault(); redoModal(); }
            if (key === 'a') { e.preventDefault(); window.currentEditingPreset.forEach(a => a.selected = true); }
            if (key === 'arrowup' || key === 'arrowdown') {
                e.preventDefault();
                if (hasSelection) {
                    saveModalHistoryState();
                    window.currentEditingPreset.forEach(act => {
                        if (act.selected) {
                            if (key === 'arrowup') {
                                if (act.pos % 5 !== 0) act.pos = Math.ceil(act.pos / 5) * 5;
                                else act.pos = Math.min(100, act.pos + 5);
                            }
                            if (key === 'arrowdown') {
                                if (act.pos % 5 !== 0) act.pos = Math.floor(act.pos / 5) * 5;
                                else act.pos = Math.max(0, act.pos - 5);
                            }
                        }
                    });
                }
            }
        } else {
            if (key === 'delete' || key === 'backspace') {
                if (hasSelection) {
                    e.preventDefault();
                    saveModalHistoryState();
                    window.currentEditingPreset = window.currentEditingPreset.filter(a => !a.selected);
                }
            }
            if (key === 'arrowleft' || key === 'arrowright') {
                if (hasSelection) {
                    e.preventDefault();
                    saveModalHistoryState();
                    window.currentEditingPreset.forEach(act => {
                        if (act.selected) {
                            if (key === 'arrowleft') act.at = Math.max(0, act.at - 50);
                            if (key === 'arrowright') act.at = act.at + 50;
                        }
                    });
                }
            }
        }
    }
});

modalCanvas?.addEventListener('wheel', (e) => {
    e.preventDefault();
    const mouseX = e.clientX - modalCanvas.getBoundingClientRect().left;
    if (e.shiftKey) {
        const timeAtMouse = mXToTime(mouseX);
        mZoom = Math.round((mZoom + (e.deltaY < 0 ? 0.08 : -0.08)) * 100) / 100;
        mZoom = Math.max(0.05, Math.min(mZoom, 15.0)); 
        mScrollMs = timeAtMouse - (mouseX - 40) / (mBasePixels * mZoom);
    } else {
        const panStep = ((modalCanvas.width - 40) / (mBasePixels * mZoom)) * 0.10;
        if (e.deltaY < 0) mScrollMs += panStep; else mScrollMs -= panStep; 
    }
});

function getModalMousePos(e) { const rect = modalCanvas.getBoundingClientRect(); return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) }; }

modalCanvas?.addEventListener('mousedown', (e) => {
    const pos = getModalMousePos(e);
    if (e.button === 0) { 
        let clickedNode = null;
        for (let i = 0; i < window.currentEditingPreset.length; i++) {
            const nx = mTimeToX(window.currentEditingPreset[i].at); const ny = mPosToY(window.currentEditingPreset[i].pos);
            if (Math.hypot(pos.x - nx, pos.y - ny) <= 8) { clickedNode = window.currentEditingPreset[i]; break; }
        }

        if (clickedNode) {
            saveModalHistoryState(); 
            if (!e.ctrlKey && !clickedNode.selected) window.currentEditingPreset.forEach(a => a.selected = false);
            clickedNode.selected = true; 
            mIsDragging = true; 
        } else {
            if (!e.ctrlKey) window.currentEditingPreset.forEach(a => a.selected = false);
            mIsSelecting = true; mHasDragged = false; 
            mStartX = pos.x; mStartY = pos.y; mCurrX = pos.x; mCurrY = pos.y;
        }
    } else if (e.button === 2) { 
        e.preventDefault();
        saveModalHistoryState(); 
        window.currentEditingPreset = window.currentEditingPreset.filter(act => Math.hypot(pos.x - mTimeToX(act.at), pos.y - mPosToY(act.pos)) > 10);
    }
});

modalCanvas?.addEventListener('mousemove', (e) => {
    const pos = getModalMousePos(e);
    if (mIsDragging) {
        const snapMs = getModalTimeSnap(); 
        window.currentEditingPreset.forEach(act => {
            if (act.selected) {
                act.at = Math.max(0, Math.round(mXToTime(pos.x) / snapMs) * snapMs);
                act.pos = Math.max(0, Math.min(100, Math.round(mYToPos(pos.y) / 5) * 5));
            }
        });
    } else if (mIsSelecting) {
        mCurrX = pos.x; mCurrY = pos.y;
        if (Math.hypot(mCurrX - mStartX, mCurrY - mStartY) > 5) mHasDragged = true;
        const minX = Math.min(mStartX, mCurrX); const maxX = Math.max(mStartX, mCurrX);
        const minY = Math.min(mStartY, mCurrY); const maxY = Math.max(mStartY, mCurrY);
        window.currentEditingPreset.forEach(act => {
            const nx = mTimeToX(act.at); const ny = mPosToY(act.pos);
            act.selected = (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY);
        });
    }
});

modalCanvas?.addEventListener('mouseup', () => {
    if (mIsSelecting && !mHasDragged) {
        saveModalHistoryState(); 
        const snapMs = getModalTimeSnap(); 
        const clickTime = Math.max(0, Math.round(mXToTime(mStartX) / snapMs) * snapMs);
        const clickPos = Math.max(0, Math.min(100, Math.round(mYToPos(mStartY) / 5) * 5));
        
        window.currentEditingPreset.push({ at: clickTime, pos: clickPos, selected: true });
    }
    mIsDragging = false; mIsSelecting = false; mHasDragged = false;
    window.currentEditingPreset.sort((a, b) => a.at - b.at);
    for (let i = window.currentEditingPreset.length - 1; i > 0; i--) {
        if (window.currentEditingPreset[i].at === window.currentEditingPreset[i-1].at) {
            window.currentEditingPreset.splice(window.currentEditingPreset[i].selected ? i-1 : i, 1);
        }
    }
});

modalCanvas?.addEventListener('contextmenu', e => e.preventDefault());

loadPresets();

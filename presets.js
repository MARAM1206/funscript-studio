/**
 * ============================================================================
 * PRESETS.JS - VERSIÓN 43.0
 * Módulo: GESTIÓN, ARRASTRE FLOTANTE INTELIGENTE Y EDITOR DE MODAL COMPLETO
 * ============================================================================
 */

window.savedPresets = {};
window.currentEditingPreset = [];
window.isDraggingPreset = false;
window.timelineGhostPreset = null;
window.timelineGhostTimeMs = null;
window.timelineGhostDeltaPos = 0;

// Estado del editor en el Modal
let crimsonIntensity = 0;
let wavePhase = 0;
let modalAnimationFrame = null;

let mZoom = 1.0;
let mBasePixels = 0.5; 
let mScrollMs = -100; 
let mIsDragging = false;
let mIsSelecting = false;
let mHasDragged = false;
let mStartX = 0, mStartY = 0, mCurrX = 0, mCurrY = 0;

const modalEl = document.getElementById('preset-editor-modal');
const nameInput = document.getElementById('preset-editor-name');
const modalCanvas = document.getElementById('preset-editor-canvas');
const modalCtx = modalCanvas ? modalCanvas.getContext('2d') : null;

function loadPresets() {
    try { window.savedPresets = JSON.parse(localStorage.getItem('funscript_saved_presets')) || {}; } 
    catch (e) { window.savedPresets = {}; }
    renderPresetsList();
}

function savePresetsToStorage() {
    localStorage.setItem('funscript_saved_presets', JSON.stringify(window.savedPresets));
    renderPresetsList();
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
                    <button class="preset-action-btn preset-delete-btn" data-name="${k}" title="Eliminar Preset">🗑️</button>
                </div>
                <canvas id="mini-canvas-${k.replace(/\s+/g, '-')}" class="preset-mini-canvas"></canvas>
            </div>
        `).join('');

    if (listMain) listMain.innerHTML = html;
    if (listModal) listModal.innerHTML = html;

    document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('mousedown', (e) => {
            if (e.target.closest('.preset-action-btn')) return; 
            const name = card.getAttribute('data-name');
            if (window.savedPresets[name]) {
                startCustomDrag(e, name, window.savedPresets[name]);
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

// ⚡ MOTOR DE ARRASTRE INTELIGENTE (Se oculta al entrar al Timeline)
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
    ctxGhost.strokeStyle = '#38bdf8'; ctxGhost.lineWidth = 1.5; ctxGhost.stroke();
    
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
        
        const timelineCanvas = document.getElementById('timeline-canvas');
        if (timelineCanvas) {
            const rect = timelineCanvas.getBoundingClientRect();
            if (moveEvent.clientX >= rect.left && moveEvent.clientX <= rect.right &&
                moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
                // Ocultar caja flotante al entrar a la línea de tiempo
                ghost.style.opacity = '0';
                const ev = new CustomEvent('presetCustomDragOver', { detail: { clientX: moveEvent.clientX, clientY: moveEvent.clientY } });
                window.dispatchEvent(ev);
            } else {
                // Mostrar caja flotante fuera de la línea de tiempo
                ghost.style.opacity = '1';
                window.timelineGhostTimeMs = null;
                if(typeof window.drawTimeline === 'function') window.drawTimeline();
            }
        }
    };

    const onMouseUp = (upEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (document.body.contains(ghost)) document.body.removeChild(ghost);
        
        const timelineCanvas = document.getElementById('timeline-canvas');
        let droppedOnTimeline = false;
        if (timelineCanvas) {
            const rect = timelineCanvas.getBoundingClientRect();
            if (upEvent.clientX >= rect.left && upEvent.clientX <= rect.right && upEvent.clientY >= rect.top && upEvent.clientY <= rect.bottom) {
                droppedOnTimeline = true;
            }
        }

        if (droppedOnTimeline) {
            const ev = new CustomEvent('presetCustomDrop', { detail: { clientX: upEvent.clientX, clientY: upEvent.clientY } });
            window.dispatchEvent(ev);
        } else {
            window.isDraggingPreset = false;
            window.timelineGhostPreset = null;
            if(typeof window.drawTimeline === 'function') window.drawTimeline();
        }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function drawMiniCanvas(name, actions) {
    const safeName = name.replace(/\s+/g, '-');
    document.querySelectorAll(`#mini-canvas-${safeName}`).forEach(canvas => {
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

// ⚡ GESTIÓN DEL MODAL
document.getElementById('save-preset-btn')?.addEventListener('click', () => {
    if (!window.funscriptActions) return;
    const selected = window.funscriptActions.filter(a => a.selected).sort((a,b) => a.at - b.at);
    if (selected.length === 0) return alert("⚠️ Selecciona al menos un punto en la línea de tiempo para crear un Preset.");

    const baseTime = selected[0].at;
    window.currentEditingPreset = selected.map(a => ({ at: a.at - baseTime, pos: a.pos, selected: false }));
    
    if (nameInput) nameInput.value = "Nuevo Preset";
    openModal();
});

function handleSave(forceNew) {
    let name = nameInput ? nameInput.value.trim() : "Preset";
    if (!name) name = "Preset Sin Nombre";

    if (forceNew && window.savedPresets[name]) {
        let counter = 1;
        let newName = `${name} (${counter})`;
        while (window.savedPresets[newName]) { counter++; newName = `${name} (${counter})`; }
        name = newName;
    } else if (!forceNew && window.savedPresets[name]) {
        const conf = confirm(`⚠️ Ya existe un preset llamado "${name}".\n¿Deseas reemplazarlo?`);
        if (!conf) return; 
    }

    // Limpiar selección antes de guardar
    const finalPreset = window.currentEditingPreset.map(a => ({at: a.at, pos: a.pos}));
    window.savedPresets[name] = finalPreset;
    savePresetsToStorage();
    closeModal();
}

document.getElementById('preset-editor-save')?.addEventListener('click', () => handleSave(false));
document.getElementById('preset-editor-save-new')?.addEventListener('click', () => handleSave(true));
document.getElementById('preset-editor-cancel')?.addEventListener('click', closeModal);

function openModal() {
    if(modalEl) modalEl.style.display = 'flex';
    mZoom = 1.0; mScrollMs = -100; // Resetear vista
    renderModalCanvas();
}

function closeModal() {
    if(modalEl) modalEl.style.display = 'none';
    if(modalAnimationFrame) cancelAnimationFrame(modalAnimationFrame);
}

// ⚡ LÓGICA DE DIBUJO E INTERACCIÓN DEL MODAL COMPLETO (Cuadrícula, Zoom, Scroll)
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
        modalCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
        modalCtx.fillStyle = '#06090e'; 
        modalCtx.fillRect(0, 0, modalCanvas.width, modalCanvas.height);

        // Efecto Carmesí (Fondo)
        crimsonIntensity = Math.abs(Math.sin(Date.now() / 600)) * 0.4 + 0.6;
        wavePhase += 0.05;
        modalCtx.beginPath(); modalCtx.moveTo(0, modalCanvas.height / 2);
        for (let x = 0; x < modalCanvas.width; x += 5) {
            const w1 = Math.sin((x * 0.02) + wavePhase) * 20;
            const w2 = Math.cos((x * 0.04) + (wavePhase * 0.8)) * 10;
            modalCtx.lineTo(x, (modalCanvas.height / 2) + w1 + w2);
        }
        modalCtx.strokeStyle = `rgba(220, 20, 60, ${crimsonIntensity * 0.5})`; // Más suave para no molestar la edición
        modalCtx.lineWidth = 3; 
        modalCtx.shadowColor = '#DC143C'; modalCtx.shadowBlur = 20 * crimsonIntensity;
        modalCtx.stroke();
        modalCtx.shadowBlur = 0;

        // Cuadrícula Y (0 a 100%)
        modalCtx.lineWidth = 1;
        modalCtx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
        for(let p = 0; p <= 100; p += 10) {
            const y = mPosToY(p);
            modalCtx.beginPath(); modalCtx.moveTo(40, y); modalCtx.lineTo(modalCanvas.width, y); modalCtx.stroke();
            modalCtx.fillStyle = '#94a3b8'; modalCtx.font = 'bold 10px monospace';
            modalCtx.fillText(p+'%', 5, y+4);
        }

        // Cuadrícula X (Tiempo)
        let stepMs = 100;
        if(mZoom < 0.5) stepMs = 500;
        if(mZoom < 0.2) stepMs = 1000;
        
        let startT = Math.floor(mXToTime(40) / stepMs) * stepMs;
        let endT = mXToTime(modalCanvas.width);
        
        for(let t = startT; t <= endT; t += stepMs) {
            const x = mTimeToX(t);
            if (x >= 40) {
                modalCtx.beginPath(); modalCtx.moveTo(x, 0); modalCtx.lineTo(x, modalCanvas.height); modalCtx.stroke();
                modalCtx.fillText(`${t}ms`, x+5, 15);
            }
        }

        // Borde separador
        modalCtx.fillStyle = '#0b0f17'; modalCtx.fillRect(0, 0, 40, modalCanvas.height);
        modalCtx.strokeStyle = '#1e293b'; modalCtx.beginPath(); modalCtx.moveTo(40, 0); modalCtx.lineTo(40, modalCanvas.height); modalCtx.stroke();
        for(let p = 0; p <= 100; p += 10) {
            const y = mPosToY(p);
            modalCtx.fillStyle = '#94a3b8'; modalCtx.font = 'bold 10px monospace';
            modalCtx.fillText(p+'%', 5, y+4);
        }

        // Dibujar Puntos y Líneas del Preset
        if(window.currentEditingPreset && window.currentEditingPreset.length > 0) {
            window.currentEditingPreset.sort((a,b) => a.at - b.at);
            
            modalCtx.strokeStyle = '#38bdf8'; modalCtx.lineWidth = 3; modalCtx.beginPath();
            window.currentEditingPreset.forEach((act, i) => {
                const px = mTimeToX(act.at); const py = mPosToY(act.pos);
                if(i===0) modalCtx.moveTo(px, py); else modalCtx.lineTo(px, py);
            });
            modalCtx.stroke();

            window.currentEditingPreset.forEach(act => {
                const px = mTimeToX(act.at); const py = mPosToY(act.pos);
                if (px >= 30) {
                    modalCtx.fillStyle = act.selected ? '#f59e0b' : '#38bdf8'; 
                    modalCtx.beginPath(); modalCtx.arc(px, py, act.selected ? 7 : 5, 0, Math.PI*2); modalCtx.fill();
                    modalCtx.strokeStyle = '#fff'; modalCtx.lineWidth = 1.5; modalCtx.stroke();
                }
            });
        }

        // Caja de Selección
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

// ⚡ EVENTOS DEL MODAL (Interactividad, Zoom, Panning)
modalCanvas?.addEventListener('wheel', (e) => {
    e.preventDefault();
    const mouseX = e.clientX - modalCanvas.getBoundingClientRect().left;
    if (e.shiftKey) {
        const timeAtMouse = mXToTime(mouseX);
        mZoom = Math.round((mZoom + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100;
        mZoom = Math.max(0.1, Math.min(mZoom, 15.0)); 
        mScrollMs = timeAtMouse - (mouseX - 40) / (mBasePixels * mZoom);
    } else {
        const panStep = ((modalCanvas.width - 40) / (mBasePixels * mZoom)) * 0.10;
        if (e.deltaY < 0) mScrollMs += panStep; else mScrollMs -= panStep; 
    }
});

function getModalMousePos(e) {
    const rect = modalCanvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
}

modalCanvas?.addEventListener('mousedown', (e) => {
    const pos = getModalMousePos(e);
    if (e.button === 0) { 
        let clickedNode = null;
        for (let i = 0; i < window.currentEditingPreset.length; i++) {
            const nx = mTimeToX(window.currentEditingPreset[i].at); const ny = mPosToY(window.currentEditingPreset[i].pos);
            if (Math.hypot(pos.x - nx, pos.y - ny) <= 8) { clickedNode = window.currentEditingPreset[i]; break; }
        }

        if (clickedNode) {
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
        window.currentEditingPreset = window.currentEditingPreset.filter(act => Math.hypot(pos.x - mTimeToX(act.at), pos.y - mPosToY(act.pos)) > 10);
    }
});

modalCanvas?.addEventListener('mousemove', (e) => {
    const pos = getModalMousePos(e);
    if (mIsDragging) {
        window.currentEditingPreset.forEach(act => {
            if (act.selected) {
                act.at = Math.max(0, Math.round(mXToTime(pos.x) / 10) * 10); // Snap 10ms
                act.pos = mYToPos(pos.y);
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
        // Clic vacío: crear nuevo punto
        const clickTime = Math.max(0, Math.round(mXToTime(mStartX) / 10) * 10);
        const clickPos = mYToPos(mStartY);
        window.currentEditingPreset.push({ at: clickTime, pos: clickPos, selected: true });
    }
    mIsDragging = false; mIsSelecting = false; mHasDragged = false;
    // Evitar duplicados en el mismo tiempo
    window.currentEditingPreset.sort((a, b) => a.at - b.at);
    for (let i = window.currentEditingPreset.length - 1; i > 0; i--) {
        if (window.currentEditingPreset[i].at === window.currentEditingPreset[i-1].at) {
            window.currentEditingPreset.splice(window.currentEditingPreset[i].selected ? i-1 : i, 1);
        }
    }
});

modalCanvas?.addEventListener('contextmenu', e => e.preventDefault());

loadPresets();

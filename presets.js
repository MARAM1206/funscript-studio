/**
 * ============================================================================
 * PRESETS.JS - VERSIÓN 42.0
 * Módulo: GESTIÓN DE PRESETS, ARRASTRE PERSONALIZADO VISUAL Y TECLADO LIBRE
 * ============================================================================
 */

window.savedPresets = {};
window.currentEditingPreset = [];
window.isDraggingPreset = false;
window.timelineGhostPreset = null;
window.timelineGhostTimeMs = null;
window.timelineGhostDeltaPos = 0;

// Animación Carmesí
let crimsonIntensity = 0;
let wavePhase = 0;
let modalAnimationFrame = null;

const modalEl = document.getElementById('preset-editor-modal');
const nameInput = document.getElementById('preset-editor-name');
const modalCanvas = document.getElementById('preset-editor-canvas');
const modalCtx = modalCanvas ? modalCanvas.getContext('2d') : null;

// Inicializar LocalStorage
function loadPresets() {
    try { 
        window.savedPresets = JSON.parse(localStorage.getItem('funscript_saved_presets')) || {}; 
    } catch (e) { 
        window.savedPresets = {}; 
    }
    renderPresetsList();
}

function savePresetsToStorage() {
    localStorage.setItem('funscript_saved_presets', JSON.stringify(window.savedPresets));
    renderPresetsList();
}

// Renderizar Listas y Canvas
function renderPresetsList() {
    const listMain = document.getElementById('presets-list');
    const listModal = document.getElementById('modal-presets-library-list');
    const keys = Object.keys(window.savedPresets);
    
    // 🎯 FIX: Quitamos draggable="true" nativo para usar nuestro propio motor
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

    // 🎯 NUEVO MOTOR DE ARRASTRE PERSONALIZADO (Libera el teclado y dibuja el patrón)
    document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('mousedown', (e) => {
            if (e.target.closest('.preset-action-btn')) return; // Ignorar si dio clic en borrar
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

    // Dibujar Mini Canvas
    keys.forEach(k => drawMiniCanvas(k, window.savedPresets[k]));
}

window.updatePresetsList = renderPresetsList;

// ⚡ LÓGICA DE ARRASTRE FLOTANTE
function startCustomDrag(e, name, actions) {
    e.preventDefault(); // Prevenir selecciones de texto por error
    
    window.isDraggingPreset = true;
    window.timelineGhostPreset = actions;
    window.timelineGhostTimeMs = null;
    window.timelineGhostDeltaPos = 0;

    // 1. Crear el fantasma visual ultra-profesional
    const ghost = document.createElement('canvas');
    ghost.id = "custom-drag-ghost";
    ghost.width = 160; 
    ghost.height = 70;
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none'; // Clave para que no estorbe los clics
    ghost.style.zIndex = '999999';
    ghost.style.transform = 'translate(-50%, -50%)'; // Centrado en el ratón
    document.body.appendChild(ghost);

    // 2. Dibujarle el diseño y patrón
    const ctxGhost = ghost.getContext('2d');
    ctxGhost.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Fondo oscuro elegante
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

    // 3. Lógica de seguimiento
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
                // Notificar a timeline.js que estamos arrastrando
                const ev = new CustomEvent('presetCustomDragOver', {
                    detail: { clientX: moveEvent.clientX, clientY: moveEvent.clientY }
                });
                window.dispatchEvent(ev);
            } else {
                window.timelineGhostTimeMs = null;
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
            if (upEvent.clientX >= rect.left && upEvent.clientX <= rect.right &&
                upEvent.clientY >= rect.top && upEvent.clientY <= rect.bottom) {
                droppedOnTimeline = true;
            }
        }

        if (droppedOnTimeline) {
            const ev = new CustomEvent('presetCustomDrop', {
                detail: { clientX: upEvent.clientX, clientY: upEvent.clientY }
            });
            window.dispatchEvent(ev);
        } else {
            window.isDraggingPreset = false;
            window.timelineGhostPreset = null;
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

// Modal y Guardado
document.getElementById('save-preset-btn')?.addEventListener('click', () => {
    if (!window.funscriptActions) return;
    const selected = window.funscriptActions.filter(a => a.selected).sort((a,b) => a.at - b.at);
    if (selected.length === 0) return alert("⚠️ Selecciona al menos un punto en la línea de tiempo para crear un Preset.");

    const baseTime = selected[0].at;
    window.currentEditingPreset = selected.map(a => ({ at: a.at - baseTime, pos: a.pos }));
    
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

    window.savedPresets[name] = window.currentEditingPreset;
    savePresetsToStorage();
    closeModal();
}

document.getElementById('preset-editor-save')?.addEventListener('click', () => handleSave(false));
document.getElementById('preset-editor-save-new')?.addEventListener('click', () => handleSave(true));
document.getElementById('preset-editor-cancel')?.addEventListener('click', closeModal);

function openModal() {
    if(modalEl) modalEl.style.display = 'flex';
    renderModalCanvas();
}

function closeModal() {
    if(modalEl) modalEl.style.display = 'none';
    if(modalAnimationFrame) cancelAnimationFrame(modalAnimationFrame);
}

window.drawModalCanvas = renderModalCanvas;

function renderModalCanvas() {
    if(!modalCtx || !modalCanvas) return;
    const rect = modalCanvas.parentElement.getBoundingClientRect();
    if(rect.width > 0) { modalCanvas.width = rect.width; modalCanvas.height = rect.height; }

    const loop = () => {
        if(modalEl.style.display === 'none') return;
        modalCtx.fillStyle = 'rgba(15, 10, 12, 0.4)'; 
        modalCtx.fillRect(0, 0, modalCanvas.width, modalCanvas.height);

        crimsonIntensity = Math.abs(Math.sin(Date.now() / 600)) * 0.4 + 0.6;
        wavePhase += 0.05;
        modalCtx.beginPath(); modalCtx.moveTo(0, modalCanvas.height / 2);
        for (let x = 0; x < modalCanvas.width; x += 5) {
            const w1 = Math.sin((x * 0.02) + wavePhase) * 15;
            const w2 = Math.cos((x * 0.04) + (wavePhase * 0.8)) * 10;
            modalCtx.lineTo(x, (modalCanvas.height / 2) + w1 + w2);
        }
        modalCtx.strokeStyle = `rgba(220, 20, 60, ${crimsonIntensity})`; 
        modalCtx.lineWidth = 3; 
        modalCtx.shadowColor = '#DC143C'; modalCtx.shadowBlur = 15 * crimsonIntensity;
        modalCtx.stroke();
        modalCtx.shadowBlur = 0;

        if(window.currentEditingPreset && window.currentEditingPreset.length > 0) {
            const duration = window.currentEditingPreset[window.currentEditingPreset.length - 1].at || 1;
            const padX = 20; const padY = 20;
            const w = modalCanvas.width - padX*2; const h = modalCanvas.height - padY*2;

            modalCtx.strokeStyle = '#38bdf8'; modalCtx.lineWidth = 3; modalCtx.beginPath();
            window.currentEditingPreset.forEach((act, i) => {
                const px = padX + (act.at / duration) * w;
                const py = padY + h - (act.pos / 100) * h;
                if(i===0) modalCtx.moveTo(px, py); else modalCtx.lineTo(px, py);
            });
            modalCtx.stroke();

            window.currentEditingPreset.forEach(act => {
                const px = padX + (act.at / duration) * w;
                const py = padY + h - (act.pos / 100) * h;
                modalCtx.fillStyle = '#f97316'; modalCtx.beginPath(); modalCtx.arc(px, py, 6, 0, Math.PI*2); modalCtx.fill();
                modalCtx.strokeStyle = '#fff'; modalCtx.lineWidth = 1.5; modalCtx.stroke();
            });
        }

        modalAnimationFrame = requestAnimationFrame(loop);
    };
    loop();
}

loadPresets();

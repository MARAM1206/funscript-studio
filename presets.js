/**
 * ============================================================================
 * PRESETS.JS - VERSIÓN 41.1
 * Módulo: GESTIÓN DE PRESETS, AVISOS Y ANIMACIÓN CARMESÍ (FIX CHOQUE DE CANVAS)
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

// 🎯 FIX CLAVE: Renombrado a modalCtx para que no choque con el "ctx" de timeline.js
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
    
    const html = keys.length === 0 
        ? '<span class="empty-log">No hay presets aún.</span>' 
        : keys.map(k => `
            <div class="preset-card" draggable="true" data-name="${k}">
                <div class="preset-card-header">
                    <span class="preset-card-title" title="${k}">${k}</span>
                    <button class="preset-action-btn preset-delete-btn" data-name="${k}" title="Eliminar Preset">🗑️</button>
                </div>
                <canvas id="mini-canvas-${k.replace(/\s+/g, '-')}" class="preset-mini-canvas"></canvas>
            </div>
        `).join('');

    if (listMain) listMain.innerHTML = html;
    if (listModal) listModal.innerHTML = html;

    // Eventos de Arrastre y Soltado (Drag & Drop)
    document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            const name = card.getAttribute('data-name');
            if (window.savedPresets[name]) {
                window.isDraggingPreset = true;
                window.timelineGhostPreset = window.savedPresets[name];
                createDragGhost(e, name);
            }
        });
        card.addEventListener('dragend', () => {
            window.isDraggingPreset = false;
            window.timelineGhostPreset = null;
            if(typeof window.drawTimeline === 'function') window.drawTimeline();
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

function createDragGhost(e, text) {
    const dragGhost = document.createElement('div');
    dragGhost.innerText = "⚙️ Aplicando: " + text;
    dragGhost.style.backgroundColor = "rgba(220, 20, 60, 0.9)";
    dragGhost.style.color = "white";
    dragGhost.style.padding = "10px 18px";
    dragGhost.style.borderRadius = "8px";
    dragGhost.style.fontFamily = "sans-serif";
    dragGhost.style.fontSize = "14px";
    dragGhost.style.fontWeight = "bold";
    dragGhost.style.position = "absolute";
    dragGhost.style.top = "-1000px";
    dragGhost.style.zIndex = "9999";
    document.body.appendChild(dragGhost);
    
    if (e.dataTransfer) {
        e.dataTransfer.setDragImage(dragGhost, 20, 20);
    }
    
    setTimeout(() => { if(document.body.contains(dragGhost)) document.body.removeChild(dragGhost); }, 0);
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

// 🎯 FIX CLAVE 2: Enlazar la función para que el botón de Tema Claro no truene
window.drawModalCanvas = renderModalCanvas;

function renderModalCanvas() {
    if(!modalCtx || !modalCanvas) return;
    const rect = modalCanvas.parentElement.getBoundingClientRect();
    if(rect.width > 0) { modalCanvas.width = rect.width; modalCanvas.height = rect.height; }

    const loop = () => {
        if(modalEl.style.display === 'none') return;
        modalCtx.fillStyle = 'rgba(15, 10, 12, 0.4)'; 
        modalCtx.fillRect(0, 0, modalCanvas.width, modalCanvas.height);

        // Efecto Carmesí (Fondo)
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

        // Dibujar Puntos del Preset por encima de la onda
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

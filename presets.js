// ==========================================================================
// PRESETS MANAGER V1.1.16 (CUADRÍCULA 10%, LÓGICA SOBRESCRIBIR, ESCALA AUTO)
// ==========================================================================

window.presetsLibrary = JSON.parse(localStorage.getItem('funscript_presets')) || [
    { id: 'default-1', name: 'Blowjob', data: [{ at: 0, pos: 10 }, { at: 500, pos: 90 }, { at: 1000, pos: 10 }] },
    { id: 'default-2', name: 'Kiss-Dick', data: [{ at: 0, pos: 40 }, { at: 150, pos: 60 }, { at: 300, pos: 40 }] },
    { id: 'default-3', name: 'Intro', data: [{ at: 0, pos: 20 }, { at: 200, pos: 80 }, { at: 400, pos: 20 }, { at: 600, pos: 80 }, { at: 800, pos: 20 }] }
];

function savePresets() {
    localStorage.setItem('funscript_presets', JSON.stringify(window.presetsLibrary));
    updatePresetsUI();
}

window.renderPresetMiniCanvas = function(canvas, presetData) {
    if (!canvas || !presetData || presetData.length === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;
    
    ctx.clearRect(0, 0, w, h);
    
    const padX = 6; const padY = 6;
    const usableW = w - (padX * 2);
    const usableH = h - (padY * 2);

    const minTime = presetData[0].at;
    const maxTime = presetData[presetData.length - 1].at;
    const duration = (maxTime - minTime) > 0 ? (maxTime - minTime) : 1;
    
    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    
    presetData.forEach((pt, i) => {
        const x = padX + ((pt.at - minTime) / duration) * usableW;
        const y = padY + usableH - (pt.pos / 100) * usableH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    presetData.forEach(pt => {
        const x = padX + ((pt.at - minTime) / duration) * usableW;
        const y = padY + usableH - (pt.pos / 100) * usableH;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f97316';
        ctx.fill();
    });
};

function createPresetCard(preset, isModal = false) {
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.draggable = true;
    card.dataset.id = preset.id;
    
    card.innerHTML = `
        <div class="preset-card-canvas-container">
            <span class="preset-card-title">${preset.name}</span>
            <canvas class="preset-mini-canvas"></canvas>
        </div>
        <div class="preset-card-actions">
            <button class="preset-action-btn edit-preset-btn" title="Editar">✏️</button>
            <button class="preset-action-btn del-preset-btn" title="Eliminar">🗑️</button>
        </div>
    `;

    const canvas = card.querySelector('canvas');
    setTimeout(() => window.renderPresetMiniCanvas(canvas, preset.data), 10);

    card.addEventListener('dragstart', (e) => {
        if (document.body.classList.contains('panic-mode-active')) { e.preventDefault(); return; }
        
        window.isDraggingPreset = true;
        window.timelineGhostPreset = preset.data;
        window.presetFillInitialized = false;
        
        card.classList.add('dragging-preset-item');
        if(e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'copyMove';
            e.dataTransfer.setData('text/plain', preset.id);
        }
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging-preset-item');
        setTimeout(() => {
            if (window.isDraggingPreset && !window.timelineGhostTimeMs) {
                window.isDraggingPreset = false;
                window.timelineGhostPreset = null;
                if (typeof window.drawTimeline === 'function') window.drawTimeline();
            }
        }, 100);
        window.dispatchEvent(new Event('presetsReordered')); 
    });

    card.addEventListener('dblclick', () => {
        if (document.body.classList.contains('panic-mode-active')) return;
        if (window.videoPlayer && typeof window.getSafeActions === 'function') {
            const timeMs = Math.round(window.videoPlayer.currentTime * 1000);
            window.clipboardFunscript = preset.data;
            window.isPastingMode = true;
            window.timelineGhostPreset = preset.data;
            window.timelineGhostTimeMs = timeMs;
            window.presetFillInitialized = false;
            if (window.timelineMarkers) window.timelineMarkers.forEach(m => m.selected = false);
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
        }
    });

    card.querySelector('.del-preset-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if(confirm(`¿Eliminar el preset "${preset.name}"?`)) {
            window.presetsLibrary = window.presetsLibrary.filter(p => p.id !== preset.id);
            savePresets();
        }
    });

    card.querySelector('.edit-preset-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openPresetEditor(preset);
    });

    return card;
}

function initPresetReordering() {
    const lists = [document.getElementById('presets-list'), document.getElementById('modal-presets-library-list')];
    let dropIndicator = document.getElementById('global-preset-drop-indicator');
    if (!dropIndicator) {
        dropIndicator = document.createElement('div');
        dropIndicator.id = 'global-preset-drop-indicator';
        dropIndicator.className = 'preset-drop-indicator';
    }
    
    lists.forEach(container => {
        if(!container) return;
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const draggable = document.querySelector('.dragging-preset-item');
            if (!draggable) return;
            const afterElement = getDragAfterElement(container, e.clientY);
            if (afterElement == null) container.appendChild(dropIndicator);
            else container.insertBefore(dropIndicator, afterElement);
        });

        container.addEventListener('dragleave', e => {
            if (e.target === container && dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);
        });

        container.addEventListener('drop', e => {
            e.preventDefault();
            const draggable = document.querySelector('.dragging-preset-item');
            if (!draggable) return;

            if (dropIndicator.parentNode) dropIndicator.parentNode.replaceChild(draggable, dropIndicator);

            const newOrderIds = Array.from(container.querySelectorAll('.preset-card')).map(card => card.dataset.id);
            const newLibrary = [];
            newOrderIds.forEach(id => {
                const preset = window.presetsLibrary.find(p => p.id === id);
                if(preset) newLibrary.push(preset);
            });
            window.presetsLibrary.forEach(p => { if(!newOrderIds.includes(p.id)) newLibrary.push(p); });

            window.presetsLibrary = newLibrary;
            localStorage.setItem('funscript_presets', JSON.stringify(window.presetsLibrary));
            updatePresetsUI(); 
        });
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.preset-card:not(.dragging-preset-item)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

function updatePresetsUI() {
    const mainList = document.getElementById('presets-list');
    const modalList = document.getElementById('modal-presets-library-list');
    
    if (mainList) {
        mainList.innerHTML = '';
        if (window.presetsLibrary.length === 0) {
            mainList.innerHTML = '<span class="empty-log">No hay presets aún.</span>';
        } else {
            window.presetsLibrary.forEach(p => mainList.appendChild(createPresetCard(p, false)));
        }
    }

    if (modalList) {
        modalList.innerHTML = '';
        window.presetsLibrary.forEach(p => modalList.appendChild(createPresetCard(p, true)));
    }
}

document.getElementById('save-preset-btn')?.addEventListener('click', () => {
    if (!window.funscriptActions) return;
    const selected = window.funscriptActions.filter(a => a.selected).sort((a, b) => a.at - b.at);
    if (selected.length < 2) {
        alert("Selecciona al menos 2 puntos en la línea de tiempo para crear un preset.");
        return;
    }
    const baseTime = selected[0].at;
    const presetData = selected.map(a => ({ at: a.at - baseTime, pos: a.pos }));
    openPresetEditor({ id: 'new', name: 'Nuevo Preset', data: presetData });
});

// ==========================================================================
// 🎯 FIX: EDITOR DE PRESETS (CUADRÍCULA 10% Y LÓGICA DE BOTONES INTELIGENTE)
// ==========================================================================

const modal = document.getElementById('preset-editor-modal');
const nameInput = document.getElementById('preset-editor-name');
const saveBtn = document.getElementById('preset-editor-save');
const saveNewBtn = document.getElementById('preset-editor-save-new');
const cancelBtn = document.getElementById('preset-editor-cancel');
const canvasModal = document.getElementById('preset-editor-canvas');
let modalCtx = canvasModal ? canvasModal.getContext('2d') : null;

let currentEditId = null;
let editData = [];
let mZoom = 1.0;
let mScrollMs = -200; 
const mPxPerMs = 0.2; 
let isModalDraggingNode = false;
let modalDraggedIndex = -1;
let modalGhostTimeMs = null;

function mTimeToX(t) { return 40 + (t - mScrollMs) * (mPxPerMs * mZoom); }
function mXToTime(x) { return mScrollMs + (x - 40) / (mPxPerMs * mZoom); }
function mPosToY(pos) { const topPad = 30; const botPad = 20; const h = canvasModal.height - topPad - botPad; return canvasModal.height - botPad - (pos / 100) * h; }
function mYToPos(y) { const topPad = 30; const botPad = 20; const h = canvasModal.height - topPad - botPad; const rawPos = ((canvasModal.height - botPad - y) / h) * 100; return Math.max(0, Math.min(100, Math.round(rawPos))); }

function openPresetEditor(preset) {
    currentEditId = preset.id;
    nameInput.value = preset.name;
    editData = JSON.parse(JSON.stringify(preset.data)); 

    // 🎯 FIX: Lógica condicional de botones para crear o sobreescribir
    if (preset.id === 'new') {
        saveNewBtn.style.display = 'none';
        saveBtn.innerText = 'Guardar';
    } else {
        saveNewBtn.style.display = 'block';
        saveBtn.innerText = 'Sobrescribir';
    }

    mScrollMs = -200; mZoom = 1.0;
    if(modal) modal.style.display = 'flex';
    resizeModalCanvas();
    window.drawModalCanvas();
}

function closePresetEditor() {
    if(modal) modal.style.display = 'none';
    currentEditId = null;
    editData = [];
}

cancelBtn?.addEventListener('click', closePresetEditor);

saveBtn?.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Sin Nombre';
    if (editData.length < 2) { alert("El preset debe tener al menos 2 puntos."); return; }
    
    editData.sort((a,b) => a.at - b.at);
    const baseTime = editData[0].at;
    editData = editData.map(a => ({ at: Math.round(a.at - baseTime), pos: Math.round(a.pos) }));

    if (currentEditId === 'new') window.presetsLibrary.push({ id: 'p_' + Date.now(), name, data: editData });
    else {
        const idx = window.presetsLibrary.findIndex(p => p.id === currentEditId);
        if (idx !== -1) { window.presetsLibrary[idx].name = name; window.presetsLibrary[idx].data = editData; }
    }
    savePresets(); closePresetEditor();
});

saveNewBtn?.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Sin Nombre';
    if (editData.length < 2) { alert("El preset debe tener al menos 2 puntos."); return; }
    
    editData.sort((a,b) => a.at - b.at);
    const baseTime = editData[0].at;
    editData = editData.map(a => ({ at: Math.round(a.at - baseTime), pos: Math.round(a.pos) }));

    window.presetsLibrary.push({ id: 'p_' + Date.now(), name: name + " (Copia)", data: editData });
    savePresets(); closePresetEditor();
});

function resizeModalCanvas() {
    if (!canvasModal) return;
    const parent = canvasModal.parentElement;
    canvasModal.width = parent.clientWidth;
    canvasModal.height = parent.clientHeight;
}

window.drawModalCanvas = function() {
    if (!modalCtx || !canvasModal || modal.style.display !== 'flex') return;
    const w = canvasModal.width; const h = canvasModal.height;
    modalCtx.clearRect(0, 0, w, h);
    
    if (editData.length === 0) return;
    
    const maxTime = editData[editData.length - 1].at > 0 ? editData[editData.length - 1].at : 1000;
    
    // 🎯 FIX: Grid de Porcentajes del 10% en 10%
    modalCtx.strokeStyle = 'rgba(255,255,255,0.05)';
    modalCtx.lineWidth = 1;
    [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(p => {
        const y = mPosToY(p);
        modalCtx.beginPath(); modalCtx.moveTo(40, y); modalCtx.lineTo(w, y); modalCtx.stroke();
    });

    const visibleMs = (w - 40) / (mPxPerMs * mZoom);
    let stepMs = visibleMs < 1000 ? 100 : (visibleMs < 5000 ? 500 : 1000); 
    let t = Math.floor(mXToTime(40) / stepMs) * stepMs;
    const endT = mXToTime(w);
    
    modalCtx.fillStyle = '#64748b'; modalCtx.font = '10px monospace';
    while (t <= endT) {
        const x = mTimeToX(t);
        if (x >= 40) {
            modalCtx.beginPath(); modalCtx.moveTo(x, 0); modalCtx.lineTo(x, h); modalCtx.stroke();
            modalCtx.fillText(`${(t/1000).toFixed(1)}s`, x + 4, 12);
        }
        t += stepMs;
    }

    if (editData.length > 0) {
        modalCtx.beginPath(); modalCtx.strokeStyle = '#38bdf8'; modalCtx.lineWidth = 2.5;
        editData.forEach((pt, i) => {
            const x = mTimeToX(pt.at); const y = mPosToY(pt.pos);
            if (i === 0) modalCtx.moveTo(x, y); else modalCtx.lineTo(x, y);
        });
        modalCtx.stroke();
        
        editData.forEach((pt) => {
            const x = mTimeToX(pt.at); const y = mPosToY(pt.pos);
            modalCtx.beginPath(); modalCtx.arc(x, y, pt.selected ? 6 : 4.5, 0, Math.PI*2);
            modalCtx.fillStyle = pt.selected ? '#f97316' : '#38bdf8'; modalCtx.fill();
            modalCtx.strokeStyle = '#0f172a'; modalCtx.lineWidth = 1.5; modalCtx.stroke();
        });
    }

    if (window.isDraggingPreset && window.timelineGhostPreset && modalGhostTimeMs !== null) {
        const snap = window.snapValue || 5;
        modalCtx.lineWidth = 2; modalCtx.strokeStyle = 'rgba(16, 185, 129, 0.8)'; modalCtx.beginPath();
        window.timelineGhostPreset.forEach((act, index) => {
            const x = mTimeToX(modalGhostTimeMs + act.at);
            const y = mPosToY(act.pos); 
            if (index === 0) modalCtx.moveTo(x, y); else modalCtx.lineTo(x, y);
        });
        modalCtx.stroke();
        window.timelineGhostPreset.forEach(act => {
            const x = mTimeToX(modalGhostTimeMs + act.at);
            const y = mPosToY(act.pos);
            modalCtx.fillStyle = 'rgba(16, 185, 129, 0.9)';
            modalCtx.beginPath(); modalCtx.arc(x, y, 4, 0, Math.PI * 2); modalCtx.fill();
        });
    }

    modalCtx.fillStyle = '#0f172a'; modalCtx.fillRect(0, 0, 40, h);
    modalCtx.strokeStyle = '#1e293b'; modalCtx.beginPath(); modalCtx.moveTo(40, 0); modalCtx.lineTo(40, h); modalCtx.stroke();
    
    // Textos del 10% en 10% en el eje Y lateral
    [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(p => {
        const y = mPosToY(p); 
        modalCtx.fillStyle = '#94a3b8'; modalCtx.font = 'bold 10px monospace'; modalCtx.fillText(`${p}%`, 4, y + 3);
    });
};

canvasModal?.addEventListener('wheel', (e) => {
    e.preventDefault();
    const mouseX = e.clientX - canvasModal.getBoundingClientRect().left;
    if (e.shiftKey) {
        const timeAtMouse = mXToTime(mouseX);
        mZoom = Math.max(0.1, Math.min(mZoom + (e.deltaY < 0 ? 0.1 : -0.1), 10));
        mScrollMs = timeAtMouse - (mouseX - 40) / (mPxPerMs * mZoom);
    } else {
        const panStep = 500 / mZoom;
        mScrollMs += e.deltaY > 0 ? panStep : -panStep;
    }
    window.drawModalCanvas();
}, { passive: false });

canvasModal?.addEventListener('mousedown', (e) => {
    if (editData.length === 0) return;
    const rect = canvasModal.getBoundingClientRect();
    const clickX = e.clientX - rect.left; const clickY = e.clientY - rect.top;
    
    let clickedIdx = -1;
    for (let i = 0; i < editData.length; i++) {
        const px = mTimeToX(editData[i].at); const py = mPosToY(editData[i].pos);
        if (Math.hypot(clickX - px, clickY - py) < 10) { clickedIdx = i; break; }
    }

    if (e.button === 0) { 
        if (clickedIdx !== -1) {
            editData.forEach((p, i) => p.selected = (i === clickedIdx));
            isModalDraggingNode = true; modalDraggedIndex = clickedIdx;
        } else {
            editData.forEach(p => p.selected = false);
        }
    } else if (e.button === 2) { 
        if (clickedIdx !== -1 && editData.length > 2) editData.splice(clickedIdx, 1);
    }
    window.drawModalCanvas();
});

canvasModal?.addEventListener('mousemove', (e) => {
    const rect = canvasModal.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;

    if (window.isDraggingPreset) {
        modalGhostTimeMs = mXToTime(mouseX);
        window.drawModalCanvas();
        return;
    }

    if (isModalDraggingNode && modalDraggedIndex !== -1) {
        const snap = window.snapValue || 5;
        let newPos = mYToPos(mouseY);
        let newAt = Math.round(mXToTime(mouseX) / 50) * 50; 
        
        editData[modalDraggedIndex].pos = Math.max(0, Math.min(100, Math.round(newPos / snap) * snap));
        editData[modalDraggedIndex].at = Math.max(0, newAt);
        window.drawModalCanvas();
    }
});

canvasModal?.addEventListener('mouseup', () => {
    if (window.isDraggingPreset && window.timelineGhostPreset && modalGhostTimeMs !== null) {
        const newActions = window.timelineGhostPreset.map(a => ({
            at: Math.max(0, Math.round(modalGhostTimeMs + a.at)),
            pos: Math.round(a.pos),
            selected: true
        }));
        editData.forEach(a => a.selected = false);
        editData.push(...newActions);
        editData.sort((a,b) => a.at - b.at);
        modalGhostTimeMs = null;
        window.isDraggingPreset = false;
        window.timelineGhostPreset = null;
        window.drawModalCanvas();
    }
    isModalDraggingNode = false; modalDraggedIndex = -1;
});
canvasModal?.addEventListener('contextmenu', e => e.preventDefault());
canvasModal?.addEventListener('dragleave', () => { modalGhostTimeMs = null; window.drawModalCanvas(); });

document.addEventListener('DOMContentLoaded', () => { updatePresetsUI(); initPresetReordering(); });
window.addEventListener('resize', () => { if (modal && modal.style.display === 'flex') { resizeModalCanvas(); window.drawModalCanvas(); } });

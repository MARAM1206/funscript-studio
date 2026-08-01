// ==========================================================================
// TIMELINE V8.0: PANEO HIPER-RÁPIDO DINÁMICO Y NUDGE DE PUNTOS
// ==========================================================================

window.funscriptActions = window.funscriptActions || [];

function getSafeActions() {
    if (!window.funscriptActions || !Array.isArray(window.funscriptActions)) window.funscriptActions = [];
    return window.funscriptActions;
}

const canvas = document.getElementById('timeline-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const actionsLog = document.getElementById('actions-log');
const pointSlider = document.getElementById('point-slider');
const sliderValueDisplay = document.getElementById('slider-value-display');
const videoNode = document.getElementById('video-player');

let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;

let zoom = 1.0; 
let basePixelsPerMs = 0.05; 
let timelineTimeOffset = 0; 

let isSelecting = false;
let hasDraggedSelection = false; 
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;

// ==================================================
// CONTROLES DE ZOOM Y PANEO (RUEDA DEL RATÓN DINÁMICA)
// ==================================================
canvas?.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.shiftKey) {
        // MODO ZOOM (Shift + Ruedita)
        if (e.deltaY < 0) zoom *= 1.15; 
        else zoom /= 1.15; 
        zoom = Math.max(0.1, Math.min(zoom, 15.0)); 
    } else {
        // MODO PANEO INTELIGENTE (HIPER-RÁPIDO)
        if (videoNode && videoNode.paused) {
            // Calcula cuánto tiempo (en ms) estás viendo actualmente en la pantalla
            const visibleTimeMs = canvas.width / (basePixelsPerMs * zoom);
            // El salto será del 15% de toda la pantalla visible (Ultra rápido para videos largos)
            const panStep = visibleTimeMs * 0.15; 
            
            if (e.deltaY < 0) {
                timelineTimeOffset += panStep; // Avanza el tiempo
            } else {
                timelineTimeOffset -= panStep; // Retrocede el tiempo
            }
        }
    }
    drawTimeline();
}, { passive: false });

window.addEventListener('videoPlay', () => {
    timelineTimeOffset = 0;
    drawTimeline();
});

// ==================================================
// LÓGICA DEL PANEL "INYECTOR RÁPIDO"
// ==================================================
const sliderA = document.getElementById('min-slider');
const sliderB = document.getElementById('max-slider');
const dualFill = document.getElementById('dual-slider-fill');
const minLabel = document.getElementById('min-label');
const maxLabel = document.getElementById('max-label');

function updateDualSlider() {
    if (!sliderA || !sliderB) return;
    const valA = parseInt(sliderA.value, 10);
    const valB = parseInt(sliderB.value, 10);
    const currentMin = Math.min(valA, valB);
    const currentMax = Math.max(valA, valB);

    if (minLabel) minLabel.innerText = `⬇️ Mínimo: ${currentMin}%`;
    if (maxLabel) maxLabel.innerText = `⬆️ Máximo: ${currentMax}%`;

    if (dualFill) {
        dualFill.style.left = `${currentMin}%`;
        dualFill.style.width = `${currentMax - currentMin}%`;
    }
}

function blurSliders() {
    if (sliderA) sliderA.blur();
    if (sliderB) sliderB.blur();
}

sliderA?.addEventListener('input', updateDualSlider);
sliderB?.addEventListener('input', updateDualSlider);
sliderA?.addEventListener('change', blurSliders);
sliderB?.addEventListener('change', blurSliders);
sliderA?.addEventListener('mouseup', blurSliders);
sliderB?.addEventListener('mouseup', blurSliders);
updateDualSlider(); 

// RECEPTOR 1: INYECTAR PUNTO
window.addEventListener('injectPoint', function(e) {
    const actions = getSafeActions();
    const timeMs = (videoNode && videoNode.currentTime) ? Math.round(videoNode.currentTime * 1000) : 0;
    
    const valA = parseInt(sliderA?.value || '15', 10);
    const valB = parseInt(sliderB?.value || '85', 10);
    const currentMin = Math.min(valA, valB);
    const currentMax = Math.max(valA, valB);

    let pos = 50;
    if (typeof e.detail === 'object') {
        if (e.detail.dir === 'up') pos = currentMax;
        else if (e.detail.dir === 'down') pos = currentMin;
    } else {
        pos = parseInt(e.detail, 10);
    }

    saveHistoryState();
    
    const existingIdx = actions.findIndex(a => a.at === timeMs);
    if (existingIdx !== -1) {
        actions[existingIdx].pos = pos;
        actions[existingIdx].selected = true;
    } else {
        actions.push({ at: timeMs, pos: pos, selected: true });
    }
    
    actions.forEach(a => { if (a.at !== timeMs) a.selected = false; });
    actions.sort((a, b) => a.at - b.at);
    
    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
    drawTimeline();
});

// 🎯 RECEPTOR 2: EMPUJAR PUNTOS SELECCIONADOS (NUDGE)
window.addEventListener('nudgePoints', function(e) {
    const actions = getSafeActions();
    const dir = e.detail; // 'up', 'down', 'left', 'right'
    let moved = false;

    saveHistoryState();

    actions.forEach(act => {
        if (act.selected) {
            // Arriba y Abajo mueve el Pos de 5% en 5%
            if (dir === 'up') act.pos = Math.min(100, act.pos + 5);
            if (dir === 'down') act.pos = Math.max(0, act.pos - 5);
            
            // Izquierda y Derecha mueve el Tiempo por 50ms para micro-ajustes
            if (dir === 'left') act.at = Math.max(0, act.at - 50); 
            if (dir === 'right') act.at = act.at + 50; 
            moved = true;
        }
    });

    if (moved) {
        // Solo reordenar si se movieron en el tiempo
        if (dir === 'left' || dir === 'right') actions.sort((a, b) => a.at - b.at);
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
        drawTimeline();
    }
});

// MOTOR GRÁFICO 
function ensureCanvasSize() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
        canvas.width = parent.clientWidth; canvas.height = parent.clientHeight;
        if (typeof window.calculateAdaptiveZoom === 'function') window.calculateAdaptiveZoom();
    }
}

window.calculateAdaptiveZoom = function() {
    if (!canvas || !videoNode) return;
    if (videoNode.duration && videoNode.duration > 0) {
        const timeWindow = Math.min(videoNode.duration * 1000, 25000);
        basePixelsPerMs = (canvas.width - 60) / timeWindow;
    } else { basePixelsPerMs = 0.05; }
};

function saveHistoryState() {
    undoStack.push(JSON.stringify(getSafeActions()));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
}

function undo() {
    if (undoStack.length > 0) {
        redoStack.push(JSON.stringify(getSafeActions()));
        window.funscriptActions = JSON.parse(undoStack.pop());
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
    }
}

function redo() {
    if (redoStack.length > 0) {
        undoStack.push(JSON.stringify(getSafeActions()));
        window.funscriptActions = JSON.parse(redoStack.pop());
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
    }
}

function timeToX(timeMs) {
    const centerFixedX = canvas.width / 2;
    const actualVideoTimeMs = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
    const screenCenterTime = actualVideoTimeMs + timelineTimeOffset;
    return centerFixedX + (timeMs - screenCenterTime) * (basePixelsPerMs * zoom);
}

function xToTime(x) {
    const centerFixedX = canvas.width / 2;
    const actualVideoTimeMs = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
    const screenCenterTime = actualVideoTimeMs + timelineTimeOffset;
    return screenCenterTime + (x - centerFixedX) / (basePixelsPerMs * zoom);
}

function posToY(pos) {
    const padding = 20; const usableHeight = canvas.height - (padding * 2);
    return canvas.height - padding - (pos / 100) * usableHeight;
}

function yToPos(y) {
    const padding = 20; const usableHeight = canvas.height - (padding * 2);
    const rawPos = ((canvas.height - padding - y) / usableHeight) * 100;
    return Math.max(0, Math.min(100, Math.round(rawPos)));
}

function drawTimeline() {
    try {
        ensureCanvasSize();
        if (!ctx || !canvas) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#06090e'; ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 1;
        [0, 25, 50, 75, 100].forEach(p => {
            const y = posToY(p);
            ctx.strokeStyle = '#1e293b';
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            ctx.fillStyle = '#475569'; ctx.font = '10px monospace'; ctx.fillText(`${p}%`, 6, y - 3);
        });

        if (window.loadedFunscriptTracks && window.loadedFunscriptTracks.length > 0) {
            window.loadedFunscriptTracks.forEach(track => {
                if (track.visible && !track.isPrimary && track.actions && track.actions.length > 0) {
                    ctx.lineWidth = 2; ctx.strokeStyle = track.color + '88';
                    ctx.beginPath();
                    track.actions.forEach((act, index) => {
                        const x = timeToX(act.at); const y = posToY(act.pos);
                        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    });
                    ctx.stroke();

                    track.actions.forEach(act => {
                        const x = timeToX(act.at);
                        if (x >= -20 && x <= canvas.width + 20) {
                            const y = posToY(act.pos);
                            ctx.fillStyle = track.color;
                            ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
                        }
                    });
                }
            });
        }

        const actions = getSafeActions();
        if (actions.length > 0) {
            ctx.lineWidth = 3; ctx.strokeStyle = '#38bdf8';
            ctx.beginPath();
            actions.forEach((act, index) => {
                const x = timeToX(act.at); const y = posToY(act.pos);
                if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();

            actions.forEach(act => {
                const x = timeToX(act.at);
                if (x >= -20 && x <= canvas.width + 20) {
                    const y = posToY(act.pos);
                    ctx.fillStyle = act.selected ? '#f59e0b' : '#38bdf8';
                    ctx.beginPath(); ctx.arc(x, y, act.selected ? 7 : 5, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
                }
            });
        }

        if (isSelecting) {
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.setLineDash([2, 2]); ctx.beginPath();
            ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
            ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
            ctx.setLineDash([]);
        }

        const actualVideoTimeMs = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
        const playheadX = timeToX(actualVideoTimeMs);
        
        ctx.lineWidth = 2; ctx.strokeStyle = '#f97316';
        ctx.beginPath(); ctx.moveTo(playheadX, 0); ctx.lineTo(playheadX, canvas.height); ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.beginPath(); ctx.moveTo(playheadX - 6, 0); ctx.lineTo(playheadX + 6, 0);
        ctx.lineTo(playheadX, 8); ctx.closePath(); ctx.fill();

    } catch (err) {}
}

window.updateActionsLog = function() {
    if (!actionsLog) return;
    const actions = getSafeActions();
    if (actions.length === 0) { actionsLog.innerHTML = '<span class="empty-log">Sin puntos registrados aún</span>'; return; }
    const latestActions = [...actions].reverse().slice(0, 8);
    actionsLog.innerHTML = latestActions.map(act => `<div style="margin-bottom: 2px;">⏱️ <strong>${(act.at / 1000).toFixed(2)}s</strong> -> Pos: <span style="color:#38bdf8">${act.pos}%</span></div>`).join('');
};

window.syncSliderWithSelection = function() {
    if (!pointSlider) return;
    const actions = getSafeActions();
    const selected = actions.filter(act => act.selected);
    if (selected.length > 0) {
        const lastSelected = selected[selected.length - 1];
        pointSlider.value = lastSelected.pos;
        if (sliderValueDisplay) sliderValueDisplay.innerText = `${lastSelected.pos}%`;
    }
};

pointSlider?.addEventListener('input', function() {
    const val = parseInt(this.value, 10);
    if (sliderValueDisplay) sliderValueDisplay.innerText = `${val}%`;
    const actions = getSafeActions();
    const selected = actions.filter(act => act.selected);
    if (selected.length > 0) {
        saveHistoryState();
        selected.forEach(act => act.pos = val); 
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
    }
});

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
}

let isDraggingNode = false;
let draggedNode = null;

canvas?.addEventListener('mousedown', (e) => {
    const actions = getSafeActions();
    const pos = getMousePos(e);
    const clickX = pos.x; const clickY = pos.y;

    if (e.button === 0) { 
        let clickedNode = null;
        for (let act of actions) {
            const nx = timeToX(act.at); const ny = posToY(act.pos);
            if (Math.hypot(clickX - nx, clickY - ny) <= 8) { clickedNode = act; break; }
        }

        if (clickedNode) {
            saveHistoryState();
            if (!e.ctrlKey && !clickedNode.selected) actions.forEach(a => a.selected = false);
            clickedNode.selected = true; isDraggingNode = true; draggedNode = clickedNode;
            if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        } else {
            if (!e.ctrlKey) actions.forEach(a => a.selected = false);
            isSelecting = true; hasDraggedSelection = false; 
            startX = clickX; startY = clickY; currentX = clickX; currentY = clickY;
        }
    } else if (e.button === 2) { 
        e.preventDefault(); saveHistoryState();
        window.funscriptActions = actions.filter(act => Math.hypot(clickX - timeToX(act.at), clickY - posToY(act.pos)) > 10);
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
    }
});

canvas?.addEventListener('mousemove', (e) => {
    const actions = getSafeActions();
    const pos = getMousePos(e);
    const mouseX = pos.x; const mouseY = pos.y;

    if (isDraggingNode && draggedNode) {
        draggedNode.pos = yToPos(mouseY); 
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    } else if (isSelecting) {
        currentX = mouseX; currentY = mouseY;
        if (Math.hypot(currentX - startX, currentY - startY) > 5) hasDraggedSelection = true;
        const minX = Math.min(startX, currentX); const maxX = Math.max(startX, currentX);
        const minY = Math.min(startY, currentY); const maxY = Math.max(startY, currentY);
        actions.forEach(act => {
            const nx = timeToX(act.at); const ny = posToY(act.pos);
            act.selected = (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY);
        });
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    }
});

window.addEventListener('mouseup', (e) => {
    const actions = getSafeActions();
    if (isSelecting && !hasDraggedSelection && e.target === canvas) {
        const clickTime = Math.max(0, Math.round(xToTime(startX)));
        const clickPos = yToPos(startY);
        saveHistoryState();
        actions.push({ at: clickTime, pos: clickPos, selected: true });
        actions.sort((a, b) => a.at - b.at);
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
    }
    isDraggingNode = false; draggedNode = null; isSelecting = false;
});

canvas?.addEventListener('contextmenu', e => e.preventDefault());

function animationLoop() { drawTimeline(); requestAnimationFrame(animationLoop); }
requestAnimationFrame(animationLoop);

window.addEventListener('keydown', (e) => {
    const actions = getSafeActions();
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'a') { 
        e.preventDefault(); actions.forEach(a => a.selected = true); 
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection(); 
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { 
        saveHistoryState(); window.funscriptActions = actions.filter(a => !a.selected); 
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog(); 
    }
});

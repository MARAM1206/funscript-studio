// ==========================================================================
// TIMELINE V5.0: INICIALIZACIÓN GLOBAL ABSOLUTA Y DESLIZADOR HÍBRIDO
// ==========================================================================

// 🛡️ PILAR CERO: Creamos la memoria en el milisegundo 1. 
// Ningún archivo volverá a decir que esto es "undefined".
window.funscriptActions = window.funscriptActions || [];

function getSafeActions() {
    if (!window.funscriptActions || !Array.isArray(window.funscriptActions)) {
        window.funscriptActions = [];
    }
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
let panX = 0; 

let isSelecting = false;
let hasDraggedSelection = false; 
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;

function ensureCanvasSize() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            if (typeof window.calculateAdaptiveZoom === 'function') window.calculateAdaptiveZoom();
        }
    }
}

window.calculateAdaptiveZoom = function() {
    if (!canvas || !videoNode) return;
    if (videoNode.duration && videoNode.duration > 0) {
        const timeWindow = Math.min(videoNode.duration * 1000, 25000);
        basePixelsPerMs = (canvas.width - 60) / timeWindow;
    } else {
        basePixelsPerMs = 0.05; 
    }
};

function saveHistoryState() {
    undoStack.push(JSON.stringify(getSafeActions()));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
}

function undo() {
    if (undoStack.length > 0) {
        redoStack.push(JSON.stringify(getSafeActions()));
        const poppedState = JSON.parse(undoStack.pop());
        window.funscriptActions = Array.isArray(poppedState) ? poppedState : [];
        syncSliderWithSelection(); updateActionsLog();
    }
}

function redo() {
    if (redoStack.length > 0) {
        undoStack.push(JSON.stringify(getSafeActions()));
        const poppedState = JSON.parse(redoStack.pop());
        window.funscriptActions = Array.isArray(poppedState) ? poppedState : [];
        syncSliderWithSelection(); updateActionsLog();
    }
}

function timeToX(timeMs) {
    const centerFixedX = canvas.width / 2;
    const currentTimeMs = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
    return centerFixedX + (timeMs - currentTimeMs) * (basePixelsPerMs * zoom) + panX;
}

function xToTime(x) {
    const centerFixedX = canvas.width / 2;
    const currentTimeMs = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
    return currentTimeMs + (x - centerFixedX - panX) / (basePixelsPerMs * zoom);
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
        ctx.fillStyle = '#06090e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 1;
        [0, 25, 50, 75, 100].forEach(p => {
            const y = posToY(p);
            ctx.strokeStyle = '#1e293b';
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            ctx.fillStyle = '#475569'; ctx.font = '10px monospace'; ctx.fillText(`${p}%`, 6, y - 3);
        });

        // Pistas Fantasmas (Guías importadas)
        if (window.loadedFunscriptTracks && window.loadedFunscriptTracks.length > 0) {
            window.loadedFunscriptTracks.forEach(track => {
                if (track.visible && !track.isPrimary && track.actions && track.actions.length > 0) {
                    ctx.lineWidth = 2; ctx.strokeStyle = track.color + '88';
                    ctx.beginPath(); let started = false;
                    track.actions.forEach(act => {
                        const x = timeToX(act.at); const y = posToY(act.pos);
                        if (x >= -50 && x <= canvas.width + 50) {
                            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
                        }
                    });
                    ctx.stroke();
                    track.actions.forEach(act => {
                        const x = timeToX(act.at);
                        if (x >= -10 && x <= canvas.width + 10) {
                            const y = posToY(act.pos);
                            ctx.fillStyle = track.color;
                            ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
                        }
                    });
                }
            });
        }

        // Pista Principal
        const actions = getSafeActions();
        if (actions.length > 0) {
            ctx.lineWidth = 3; ctx.strokeStyle = '#38bdf8';
            ctx.beginPath(); let started = false;
            actions.forEach(act => {
                const x = timeToX(act.at); const y = posToY(act.pos);
                if (x >= -50 && x <= canvas.width + 50) {
                    if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
                }
            });
            ctx.stroke();

            actions.forEach(act => {
                const x = timeToX(act.at);
                if (x >= -10 && x <= canvas.width + 10) {
                    const y = posToY(act.pos);
                    ctx.fillStyle = act.selected ? '#f59e0b' : '#38bdf8';
                    ctx.beginPath(); ctx.arc(x, y, act.selected ? 7 : 5, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
                }
            });
        }

        // Cuadro de selección
        if (isSelecting) {
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.setLineDash([2, 2]); ctx.beginPath();
            ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
            ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
            ctx.setLineDash([]);
        }

        // Línea Central
        const centerFixedX = canvas.width / 2 + panX;
        ctx.lineWidth = 2; ctx.strokeStyle = '#f97316';
        ctx.beginPath(); ctx.moveTo(centerFixedX, 0); ctx.lineTo(centerFixedX, canvas.height); ctx.stroke();
        
        ctx.fillStyle = '#f97316';
        ctx.beginPath(); ctx.moveTo(centerFixedX - 6, 0); ctx.lineTo(centerFixedX + 6, 0);
        ctx.lineTo(centerFixedX, 8); ctx.closePath(); ctx.fill();

    } catch (err) {
        console.error("Error visual (ignorado para evitar crash):", err);
    }
}
window.drawTimeline = drawTimeline;

function updateActionsLog() {
    if (!actionsLog) return;
    const actions = getSafeActions();
    if (actions.length === 0) {
        actionsLog.innerHTML = '<span class="empty-log">Sin puntos registrados aún</span>'; return;
    }
    const latestActions = [...actions].reverse().slice(0, 8);
    actionsLog.innerHTML = latestActions.map(act => `<div style="margin-bottom: 2px;">⏱️ <strong>${(act.at / 1000).toFixed(2)}s</strong> -> Pos: <span style="color:#38bdf8">${act.pos}%</span></div>`).join('');
}
window.updateActionsLog = updateActionsLog;

function syncSliderWithSelection() {
    if (!pointSlider) return;
    const actions = getSafeActions();
    const selected = actions.filter(act => act.selected);
    if (selected.length > 0) {
        const lastSelected = selected[selected.length - 1];
        
        // Deslizador Híbrido: No altera el porcentaje original
        pointSlider.value = lastSelected.pos;
        if (sliderValueDisplay) sliderValueDisplay.innerText = `${lastSelected.pos}%`;
    }
}
window.syncSliderWithSelection = syncSliderWithSelection;

pointSlider?.addEventListener('input', function() {
    const val = parseInt(this.value, 10);
    if (sliderValueDisplay) sliderValueDisplay.innerText = `${val}%`;

    const actions = getSafeActions();
    const selected = actions.filter(act => act.selected);
    if (selected.length > 0) {
        saveHistoryState();
        selected.forEach(act => act.pos = val); // Solo redondea si el usuario mueve la barra manualmente
        updateActionsLog();
    }
});

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

let isDraggingNode = false;
let draggedNode = null;

canvas?.addEventListener('mousedown', (e) => {
    const actions = getSafeActions();
    const pos = getMousePos(e);
    const clickX = pos.x;
    const clickY = pos.y;

    if (e.button === 0) { 
        let clickedNode = null;
        for (let act of actions) {
            const nx = timeToX(act.at); const ny = posToY(act.pos);
            if (Math.hypot(clickX - nx, clickY - ny) <= 8) { clickedNode = act; break; }
        }

        if (clickedNode) {
            saveHistoryState();
            if (!e.ctrlKey && !clickedNode.selected) actions.forEach(a => a.selected = false);
            clickedNode.selected = true;
            isDraggingNode = true; draggedNode = clickedNode;
            syncSliderWithSelection();
        } else {
            if (!e.ctrlKey) actions.forEach(a => a.selected = false);
            isSelecting = true;
            hasDraggedSelection = false; 
            startX = clickX; startY = clickY;
            currentX = clickX; currentY = clickY;
        }
    } else if (e.button === 2) { 
        e.preventDefault(); saveHistoryState();
        window.funscriptActions = actions.filter(act => Math.hypot(clickX - timeToX(act.at), clickY - posToY(act.pos)) > 10);
        updateActionsLog();
    }
});

canvas?.addEventListener('mousemove', (e) => {
    const actions = getSafeActions();
    const pos = getMousePos(e);
    const mouseX = pos.x;
    const mouseY = pos.y;

    if (isDraggingNode && draggedNode) {
        draggedNode.pos = yToPos(mouseY);
        syncSliderWithSelection();
    } else if (isSelecting) {
        currentX = mouseX; currentY = mouseY;
        if (Math.hypot(currentX - startX, currentY - startY) > 5) hasDraggedSelection = true;

        const minX = Math.min(startX, currentX); const maxX = Math.max(startX, currentX);
        const minY = Math.min(startY, currentY); const maxY = Math.max(startY, currentY);

        actions.forEach(act => {
            const nx = timeToX(act.at); const ny = posToY(act.pos);
            act.selected = (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY);
        });
        syncSliderWithSelection();
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
        syncSliderWithSelection(); updateActionsLog();
    }

    isDraggingNode = false; draggedNode = null; isSelecting = false;
});

canvas?.addEventListener('contextmenu', e => e.preventDefault());

function animationLoop() {
    drawTimeline();
    requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

window.addEventListener('keydown', (e) => {
    const actions = getSafeActions();
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault(); actions.forEach(a => a.selected = true);
        syncSliderWithSelection();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
        saveHistoryState(); window.funscriptActions = actions.filter(a => !a.selected);
        updateActionsLog();
    }
});

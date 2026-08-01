// ==========================================================================
// TIMELINE V3.2: SINCRONIZACIÓN PERFECTA Y SELECCIÓN INTELIGENTE
// ==========================================================================

const canvas = document.getElementById('timeline-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const actionsLog = document.getElementById('actions-log');
const pointSlider = document.getElementById('point-slider');
const sliderValueDisplay = document.getElementById('slider-value-display');

// Obtenemos el reproductor de forma directa e independiente 
const videoNode = document.getElementById('video-player');

window.funscriptActions = [];
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;

let zoom = 1.0; 
let basePixelsPerMs = 0.05; 
let panX = 0; 

let isSelecting = false;
let hasDraggedSelection = false; // Nuestro nuevo seguro anti-puntos accidentales
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;

function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent && parent.clientWidth > 0) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        calculateAdaptiveZoom();
    }
    drawTimeline();
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 300);

function calculateAdaptiveZoom() {
    if (!canvas) return;
    if (videoNode && videoNode.duration) {
        const timeWindow = Math.min(videoNode.duration * 1000, 25000);
        basePixelsPerMs = (canvas.width - 60) / timeWindow;
    }
}

function saveHistoryState() {
    undoStack.push(JSON.stringify(window.funscriptActions));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
}

function undo() {
    if (undoStack.length > 0) {
        redoStack.push(JSON.stringify(window.funscriptActions));
        window.funscriptActions = JSON.parse(undoStack.pop());
        drawTimeline(); updateActionsLog(); syncSliderWithSelection();
    }
}

function redo() {
    if (redoStack.length > 0) {
        undoStack.push(JSON.stringify(window.funscriptActions));
        window.funscriptActions = JSON.parse(redoStack.pop());
        drawTimeline(); updateActionsLog(); syncSliderWithSelection();
    }
}

// Convertidores de medida
function timeToX(timeMs) {
    const centerFixedX = canvas.width / 2;
    const currentTimeMs = (videoNode ? videoNode.currentTime : 0) * 1000;
    return centerFixedX + (timeMs - currentTimeMs) * (basePixelsPerMs * zoom) + panX;
}
function xToTime(x) {
    const centerFixedX = canvas.width / 2;
    const currentTimeMs = (videoNode ? videoNode.currentTime : 0) * 1000;
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

// DIBUJO DE LÍNEA DE TIEMPO
function drawTimeline() {
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

    if (window.funscriptActions && window.funscriptActions.length > 0) {
        ctx.lineWidth = 3; ctx.strokeStyle = '#38bdf8';
        ctx.beginPath(); let started = false;
        window.funscriptActions.forEach(act => {
            const x = timeToX(act.at); const y = posToY(act.pos);
            if (x >= -50 && x <= canvas.width + 50) {
                if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
            }
        });
        ctx.stroke();

        window.funscriptActions.forEach(act => {
            const x = timeToX(act.at);
            if (x >= -10 && x <= canvas.width + 10) {
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

    const centerFixedX = canvas.width / 2 + panX;
    ctx.lineWidth = 2; ctx.strokeStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(centerFixedX, 0); ctx.lineTo(centerFixedX, canvas.height); ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(centerFixedX - 6, 0); ctx.lineTo(centerFixedX + 6, 0);
    ctx.lineTo(centerFixedX, 8); ctx.closePath(); ctx.fill();
}
window.drawTimeline = drawTimeline;

function updateActionsLog() {
    if (!actionsLog) return;
    if (!window.funscriptActions || window.funscriptActions.length === 0) {
        actionsLog.innerHTML = '<span class="empty-log">Sin puntos registrados aún</span>'; return;
    }
    const latestActions = [...window.funscriptActions].reverse().slice(0, 8);
    actionsLog.innerHTML = latestActions.map(act => `<div style="margin-bottom: 2px;">⏱️ <strong>${(act.at / 1000).toFixed(2)}s</strong> -> Pos: <span style="color:#38bdf8">${act.pos}%</span></div>`).join('');
}
window.updateActionsLog = updateActionsLog;

function syncSliderWithSelection() {
    if (!pointSlider || !window.funscriptActions) return;
    const selected = window.funscriptActions.filter(act => act.selected);
    if (selected.length > 0) {
        const lastSelected = selected[selected.length - 1];
        const steppedValue = Math.round(lastSelected.pos / 5) * 5;
        pointSlider.value = steppedValue;
        if (sliderValueDisplay) sliderValueDisplay.innerText = `${steppedValue}%`;
    }
}
window.syncSliderWithSelection = syncSliderWithSelection;

pointSlider?.addEventListener('input', function() {
    const val = parseInt(this.value, 10);
    if (sliderValueDisplay) sliderValueDisplay.innerText = `${val}%`;

    if (window.funscriptActions && window.funscriptActions.length > 0) {
        const selected = window.funscriptActions.filter(act => act.selected);
        if (selected.length > 0) {
            saveHistoryState();
            selected.forEach(act => act.pos = val);
            drawTimeline(); updateActionsLog();
        }
    }
});

// INTERACCIONES CON MOUSE
let isDraggingNode = false;
let draggedNode = null;

canvas?.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (e.button === 0) { 
        let clickedNode = null;
        for (let act of window.funscriptActions) {
            const nx = timeToX(act.at); const ny = posToY(act.pos);
            if (Math.hypot(clickX - nx, clickY - ny) <= 8) { clickedNode = act; break; }
        }

        if (clickedNode) {
            saveHistoryState();
            if (!e.ctrlKey && !clickedNode.selected) window.funscriptActions.forEach(a => a.selected = false);
            clickedNode.selected = true;
            isDraggingNode = true; draggedNode = clickedNode;
            syncSliderWithSelection();
        } else {
            if (!e.ctrlKey) window.funscriptActions.forEach(a => a.selected = false);
            isSelecting = true;
            hasDraggedSelection = false; // Reiniciamos el seguro
            startX = clickX; startY = clickY;
            currentX = clickX; currentY = clickY;
        }
        drawTimeline();
    } else if (e.button === 2) { 
        e.preventDefault(); saveHistoryState();
        window.funscriptActions = window.funscriptActions.filter(act => Math.hypot(clickX - timeToX(act.at), clickY - posToY(act.pos)) > 10);
        drawTimeline(); updateActionsLog();
    }
});

canvas?.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDraggingNode && draggedNode) {
        draggedNode.pos = yToPos(mouseY);
        drawTimeline(); syncSliderWithSelection();
    } else if (isSelecting) {
        currentX = mouseX; currentY = mouseY;
        
        // Si el ratón se mueve más de 5 píxeles, es un arrastre intencional. Activamos el seguro.
        if (Math.hypot(currentX - startX, currentY - startY) > 5) {
            hasDraggedSelection = true;
        }

        const minX = Math.min(startX, currentX); const maxX = Math.max(startX, currentX);
        const minY = Math.min(startY, currentY); const maxY = Math.max(startY, currentY);

        window.funscriptActions.forEach(act => {
            const nx = timeToX(act.at); const ny = posToY(act.pos);
            act.selected = (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY);
        });

        drawTimeline(); syncSliderWithSelection();
    }
});

window.addEventListener('mouseup', (e) => {
    // Solo creamos punto si NO arrastramos el ratón (fue un clic estático puro)
    // y además nos aseguramos de que el clic se soltó dentro del propio Canvas.
    if (isSelecting && !hasDraggedSelection && e.target === canvas) {
        const clickTime = Math.max(0, Math.round(xToTime(startX)));
        const clickPos = yToPos(startY);
        
        saveHistoryState();
        window.funscriptActions.push({ at: clickTime, pos: clickPos, selected: true });
        window.funscriptActions.sort((a, b) => a.at - b.at);
        syncSliderWithSelection(); updateActionsLog();
    }

    isDraggingNode = false; draggedNode = null; isSelecting = false;
    drawTimeline();
});

canvas?.addEventListener('contextmenu', e => e.preventDefault());

// REFRESH VISUAL (AUN EN PAUSA)
let lastRenderTime = -1;
function animationLoop() {
    if (videoNode) {
        // Redibuja si el video se está reproduciendo O si avanzaste estando en pausa
        if (!videoNode.paused || videoNode.currentTime !== lastRenderTime) {
            drawTimeline();
            lastRenderTime = videoNode.currentTime;
        }
    }
    requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault(); window.funscriptActions.forEach(a => a.selected = true);
        drawTimeline(); syncSliderWithSelection();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
        saveHistoryState(); window.funscriptActions = window.funscriptActions.filter(a => !a.selected);
        drawTimeline(); updateActionsLog();
    }
});

// ==========================================================================
// TIMELINE V3.0: RENDERIZADO MULTI-PISTA Y CONEXIÓN CON DESLIZADOR 5%
// ==========================================================================

const canvas = document.getElementById('timeline-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const actionsLog = document.getElementById('actions-log');
const pointSlider = document.getElementById('point-slider');
const sliderValueDisplay = document.getElementById('slider-value-display');

window.funscriptActions = [];
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;

let zoom = 1.0; 
let basePixelsPerMs = 0.05; 
let panX = 0; 

let isSelecting = false;
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
    if (window.videoPlayer && window.videoPlayer.duration) {
        const timeWindow = Math.min(window.videoPlayer.duration * 1000, 25000);
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
        drawTimeline();
        updateActionsLog();
        syncSliderWithSelection();
    }
}

function redo() {
    if (redoStack.length > 0) {
        undoStack.push(JSON.stringify(window.funscriptActions));
        window.funscriptActions = JSON.parse(redoStack.pop());
        drawTimeline();
        updateActionsLog();
        syncSliderWithSelection();
    }
}

// Convertidores de coordenadas
function timeToX(timeMs) {
    const centerFixedX = canvas.width / 2;
    const currentTimeMs = (window.videoPlayer ? window.videoPlayer.currentTime : 0) * 1000;
    return centerFixedX + (timeMs - currentTimeMs) * (basePixelsPerMs * zoom) + panX;
}

function xToTime(x) {
    const centerFixedX = canvas.width / 2;
    const currentTimeMs = (window.videoPlayer ? window.videoPlayer.currentTime : 0) * 1000;
    return currentTimeMs + (x - centerFixedX - panX) / (basePixelsPerMs * zoom);
}

function posToY(pos) {
    const padding = 20;
    const usableHeight = canvas.height - (padding * 2);
    return canvas.height - padding - (pos / 100) * usableHeight;
}

function yToPos(y) {
    const padding = 20;
    const usableHeight = canvas.height - (padding * 2);
    const rawPos = ((canvas.height - padding - y) / usableHeight) * 100;
    return Math.max(0, Math.min(100, Math.round(rawPos)));
}

// DIBUJO DE LA LÍNEA DE TIEMPO
function drawTimeline() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo y cuadrícula
    ctx.fillStyle = '#06090e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Líneas horizontales de porcentaje (0%, 25%, 50%, 75%, 100%)
    ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(p => {
        const y = posToY(p);
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = '10px monospace';
        ctx.fillText(`${p}%`, 6, y - 3);
    });

    // 1. DIBUJAR PISTAS SECUNDARIAS CARGADAS (PARA COMPARACIÓN)
    if (window.loadedFunscriptTracks && window.loadedFunscriptTracks.length > 0) {
        window.loadedFunscriptTracks.forEach(track => {
            // Dibujar solo si la pista es visible y NO es la principal actual
            if (track.visible && !track.isPrimary && track.actions && track.actions.length > 0) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = track.color + '88'; // Semitransparente para mejor contraste

                ctx.beginPath();
                let started = false;
                track.actions.forEach(act => {
                    const x = timeToX(act.at);
                    const y = posToY(act.pos);
                    if (x >= -50 && x <= canvas.width + 50) {
                        if (!started) { ctx.moveTo(x, y); started = true; }
                        else { ctx.lineTo(x, y); }
                    }
                });
                ctx.stroke();

                // Puntos pequeños de la pista secundaria
                track.actions.forEach(act => {
                    const x = timeToX(act.at);
                    if (x >= -10 && x <= canvas.width + 10) {
                        const y = posToY(act.pos);
                        ctx.fillStyle = track.color;
                        ctx.beginPath();
                        ctx.arc(x, y, 3, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });
            }
        });
    }

    // 2. DIBUJAR PISTA PRINCIPAL (EDITABLE)
    if (window.funscriptActions && window.funscriptActions.length > 0) {
        // Línea conectora principal
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        let started = false;
        window.funscriptActions.forEach(act => {
            const x = timeToX(act.at);
            const y = posToY(act.pos);
            if (x >= -50 && x <= canvas.width + 50) {
                if (!started) { ctx.moveTo(x, y); started = true; }
                else { ctx.lineTo(x, y); }
            }
        });
        ctx.stroke();

        // Nodos interactivos
        window.funscriptActions.forEach(act => {
            const x = timeToX(act.at);
            if (x >= -10 && x <= canvas.width + 10) {
                const y = posToY(act.pos);
                ctx.fillStyle = act.selected ? '#f59e0b' : '#38bdf8';
                ctx.beginPath();
                ctx.arc(x, y, act.selected ? 7 : 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        });
    }

    // Cuadro de selección
    if (isSelecting) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
        ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        ctx.setLineDash([]);
    }

    // Línea roja central (Tiempo actual del video)
    const centerFixedX = canvas.width / 2 + panX;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(centerFixedX, 0);
    ctx.lineTo(centerFixedX, canvas.height);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(centerFixedX - 6, 0);
    ctx.lineTo(centerFixedX + 6, 0);
    ctx.lineTo(centerFixedX, 8);
    ctx.closePath();
    ctx.fill();
}

window.drawTimeline = drawTimeline;

// ACTUALIZAR REGISTRO DE ACCIONES EN CONSOLA UI
function updateActionsLog() {
    if (!actionsLog) return;
    if (!window.funscriptActions || window.funscriptActions.length === 0) {
        actionsLog.innerHTML = '<span class="empty-log">Sin puntos registrados aún</span>';
        return;
    }
    const latestActions = [...window.funscriptActions].reverse().slice(0, 8);
    actionsLog.innerHTML = latestActions.map(act => {
        const sec = (act.at / 1000).toFixed(2);
        return `<div style="margin-bottom: 2px;">⏱️ <strong>${sec}s</strong> -> Pos: <span style="color:#38bdf8">${act.pos}%</span></div>`;
    }).join('');
}
window.updateActionsLog = updateActionsLog;

// SINCRONIZAR EL DESLIZADOR VERTICAL CON EL PUNTO SELECCIONADO
function syncSliderWithSelection() {
    if (!pointSlider || !window.funscriptActions) return;
    const selected = window.funscriptActions.filter(act => act.selected);
    if (selected.length > 0) {
        const lastSelected = selected[selected.length - 1];
        // Redondear a múltiplo de 5
        const steppedValue = Math.round(lastSelected.pos / 5) * 5;
        pointSlider.value = steppedValue;
        if (sliderValueDisplay) sliderValueDisplay.innerText = `${steppedValue}%`;
    }
}

// EVENTO DEL DESLIZADOR VERTICAL (PASOS DE 5% EN 5%)
pointSlider?.addEventListener('input', function() {
    const val = parseInt(this.value, 10);
    if (sliderValueDisplay) sliderValueDisplay.innerText = `${val}%`;

    if (window.funscriptActions && window.funscriptActions.length > 0) {
        const selected = window.funscriptActions.filter(act => act.selected);
        if (selected.length > 0) {
            saveHistoryState();
            selected.forEach(act => {
                act.pos = val;
            });
            drawTimeline();
            updateActionsLog();
        }
    }
});

// INTERACCIONES CON EL CANVAS DE LÍNEA DE TIEMPO
let isDraggingNode = false;
let draggedNode = null;

canvas?.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (e.button === 0) { // Click izquierdo
        // Comprobar si se hizo clic en un nodo existente
        let clickedNode = null;
        for (let act of window.funscriptActions) {
            const nx = timeToX(act.at);
            const ny = posToY(act.pos);
            const dist = Math.hypot(clickX - nx, clickY - ny);
            if (dist <= 8) {
                clickedNode = act;
                break;
            }
        }

        if (clickedNode) {
            saveHistoryState();
            if (!e.ctrlKey && !clickedNode.selected) {
                window.funscriptActions.forEach(a => a.selected = false);
            }
            clickedNode.selected = true;
            isDraggingNode = true;
            draggedNode = clickedNode;
            syncSliderWithSelection();
        } else {
            // Si hace clic en espacio vacío, deseleccionar o iniciar selección por caja
            if (!e.ctrlKey) window.funscriptActions.forEach(a => a.selected = false);
            isSelecting = true;
            startX = clickX;
            startY = clickY;
            currentX = clickX;
            currentY = clickY;

            // Crear punto si hace clic
            const clickTime = Math.max(0, Math.round(xToTime(clickX)));
            const clickPos = yToPos(clickY);
            
            saveHistoryState();
            window.funscriptActions.push({ at: clickTime, pos: clickPos, selected: true });
            window.funscriptActions.sort((a, b) => a.at - b.at);
            syncSliderWithSelection();
        }
        drawTimeline();
        updateActionsLog();
    } else if (e.button === 2) { // Click derecho: Eliminar nodo
        e.preventDefault();
        saveHistoryState();
        window.funscriptActions = window.funscriptActions.filter(act => {
            const nx = timeToX(act.at);
            const ny = posToY(act.pos);
            return Math.hypot(clickX - nx, clickY - ny) > 10;
        });
        drawTimeline();
        updateActionsLog();
    }
});

canvas?.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDraggingNode && draggedNode) {
        draggedNode.pos = yToPos(mouseY);
        drawTimeline();
        syncSliderWithSelection();
    } else if (isSelecting) {
        currentX = mouseX;
        currentY = mouseY;

        const minX = Math.min(startX, currentX);
        const maxX = Math.max(startX, currentX);
        const minY = Math.min(startY, currentY);
        const maxY = Math.max(startY, currentY);

        window.funscriptActions.forEach(act => {
            const nx = timeToX(act.at);
            const ny = posToY(act.pos);
            act.selected = (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY);
        });

        drawTimeline();
        syncSliderWithSelection();
    }
});

window.addEventListener('mouseup', () => {
    isDraggingNode = false;
    draggedNode = null;
    isSelecting = false;
    drawTimeline();
});

canvas?.addEventListener('contextmenu', e => e.preventDefault());

// BUCLE DE RENDERIZADO EN TIEMPO REAL AL REPRODUCIR VIDEO
function animationLoop() {
    if (window.videoPlayer && !window.videoPlayer.paused) {
        drawTimeline();
    }
    requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

// ATAJOS DE TECLADO
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault(); undo();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redo();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        window.funscriptActions.forEach(a => a.selected = true);
        drawTimeline();
        syncSliderWithSelection();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
        saveHistoryState();
        window.funscriptActions = window.funscriptActions.filter(a => !a.selected);
        drawTimeline();
        updateActionsLog();
    }
});

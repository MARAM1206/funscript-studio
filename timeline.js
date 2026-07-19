// ==========================================================================
// LÍNEA DE TIEMPO ULTRA-PRECISA CON SISTEMA DE HISTORIAL (CTRL+Z / CTRL+Y)
// ==========================================================================

const canvas = document.getElementById('timeline-canvas');
const ctx = canvas.getContext('2d');
const actionsLog = document.getElementById('actions-log');
const zoomIndicator = document.getElementById('zoom-indicator');

let funscriptActions = [];

// Pilas de memoria para el Historial (Undo / Redo stacks)
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50; // Límite de acciones guardadas en memoria

// Estados de Navegación y Selección
let zoom = 1.0;
let panX = 0;
let isSelecting = false;
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 160;
    drawTimeline();
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 500);

function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
}

// ==========================================================================
// FUNCIONES LÓGICAS DEL HISTORIAL (SNAP-SHOTS)
// ==========================================================================
/**
 * Guarda una copia profunda del estado actual antes de que ocurra una modificación
 */
function saveHistoryState() {
    // Clonamos el array actual para que no se altere la foto guardada
    undoStack.push(funscriptActions.map(act => ({ ...act })));
    
    // Si superamos el límite, desechamos el cambio más antiguo
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }
    // Cada acción nueva limpia la pila de "Rehacer"
    redoStack = [];
}

function executeUndo() {
    if (undoStack.length === 0) return;
    
    // Guardamos el estado actual en Redo antes de volver al pasado
    redoStack.push(funscriptActions.map(act => ({ ...act })));
    
    // Extraemos el último estado y lo aplicamos
    funscriptActions = undoStack.pop();
    
    updateActionsLog();
    drawTimeline();
    console.log("Deshacer ejecutado (Ctrl+Z)");
}

function executeRedo() {
    if (redoStack.length === 0) return;
    
    // Guardamos en Undo antes de avanzar al futuro
    undoStack.push(funscriptActions.map(act => ({ ...act })));
    
    // Extraemos el estado del futuro y lo aplicamos
    funscriptActions = redoStack.pop();
    
    updateActionsLog();
    drawTimeline();
    console.log("Rehacer ejecutado (Ctrl+Y)");
}

// Hacemos la función accesible globalmente para el módulo de presets
window.saveHistoryState = saveHistoryState;

// ==========================================================================
// ENTRADAS DEL TECLADO (0-9, Intro, Borrar, Ctrl+Z, Ctrl+Y)
// ==========================================================================
window.addEventListener('keydown', function(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

    const key = event.key.toLowerCase();

    // INTERCEPCIÓN DE CTRL + Z (Deshacer)
    if (event.ctrlKey && key === 'z') {
        event.preventDefault();
        executeUndo();
        return;
    }

    // INTERCEPCIÓN DE CTRL + Y (Rehacer)
    if (event.ctrlKey && key === 'y') {
        event.preventDefault();
        executeRedo();
        return;
    }

    let position = null;
    if (key >= '1' && key <= '9') position = parseInt(key) * 10;
    else if (key === '0') position = 0;
    else if (event.code === 'NumpadEnter' || event.key === 'Enter') {
        event.preventDefault();
        position = 100;
    }

    if (position !== null && videoPlayer.src) {
        event.preventDefault();
        saveHistoryState(); // Tomar foto antes de agregar
        const timeMs = Math.floor(videoPlayer.currentTime * 1000);
        addAction(timeMs, position);
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (funscriptActions.some(act => act.selected)) {
            saveHistoryState(); // Tomar foto antes de borrar
            funscriptActions = funscriptActions.filter(act => !act.selected);
            updateActionsLog();
            drawTimeline();
        }
    }
});

function addAction(timeMs, position) {
    funscriptActions = funscriptActions.filter(act => act.at !== timeMs);
    funscriptActions.push({ at: timeMs, pos: position, selected: false });
    funscriptActions.sort((a, b) => a.at - b.at);
    updateActionsLog();
    drawTimeline();
}

// ==========================================================================
// NAVEGACIÓN POR RUEDA Y CLICS MOUSE
// ==========================================================================
canvas.addEventListener('wheel', function(event) {
    event.preventDefault();
    const duration = videoPlayer.duration ? videoPlayer.duration * 1000 : 60000;
    const timelineWidth = canvas.width - 40;
    const currentTimeMs = videoPlayer.currentTime * 1000;
    const rawPlayheadX = (currentTimeMs / duration) * timelineWidth;

    if (event.shiftKey) {
        panX -= event.deltaY * 0.6;
        if (panX > 0) panX = 0;
    } else {
        const oldZoom = zoom;
        const zoomIntensity = 0.15;
        if (event.deltaY < 0) zoom = Math.min(60.0, zoom + zoomIntensity);
        else zoom = Math.max(1.0, zoom - zoomIntensity);
        
        if (zoom === 1.0) panX = 0;
        else panX = panX + (rawPlayheadX * oldZoom) - (rawPlayheadX * zoom);
        if (panX > 0) panX = 0;
    }
    zoomIndicator.innerText = `Zoom: ${zoom.toFixed(1)}x | Pan: ${Math.floor(panX)}`;
    drawTimeline();
});

canvas.addEventListener('mousedown', function(event) {
    if (event.shiftKey) return;
    const pos = getMousePos(event);
    startX = pos.x; startY = pos.y;
    const duration = videoPlayer.duration ? videoPlayer.duration * 1000 : 60000;
    const timelineWidth = canvas.width - 40;
    const h = canvas.height;
    let clickedANode = false;

    funscriptActions.forEach(action => {
        const rawX = (action.at / duration) * timelineWidth;
        const renderX = 40 + (rawX * zoom) + panX;
        const renderY = h - (action.pos / 100) * h;

        if (Math.abs(renderX - startX) <= 8 && Math.abs(renderY - startY) <= 8) {
            clickedANode = true;
            if (event.ctrlKey) action.selected = !action.selected;
            else {
                funscriptActions.forEach(act => act.selected = false);
                action.selected = true;
            }
        }
    });

    if (clickedANode) {
        isSelecting = false;
        updateActionsLog();
        drawTimeline();
    } else {
        isSelecting = true;
        currentX = startX; currentY = startY;
        if (!event.ctrlKey) funscriptActions.forEach(act => act.selected = false);
        drawTimeline();
    }
});

canvas.addEventListener('mousemove', function(event) {
    if (!isSelecting) return;
    const pos = getMousePos(event);
    currentX = pos.x; currentY = pos.y;
    drawTimeline();
});

canvas.addEventListener('mouseup', function(event) {
    if (isSelecting) {
        isSelecting = false;
        const pos = getMousePos(event);
        currentX = pos.x; currentY = pos.y;
        const xMin = Math.min(startX, currentX); const xMax = Math.max(startX, currentX);
        const yMin = Math.min(startY, currentY); const yMax = Math.max(startY, currentY);
        const duration = videoPlayer.duration ? videoPlayer.duration * 1000 : 60000;
        const timelineWidth = canvas.width - 40;
        const h = canvas.height;

        if (xMax - xMin > 2 || yMax - yMin > 2) {
            funscriptActions.forEach(action => {
                const rawX = (action.at / duration) * timelineWidth;
                const renderX = 40 + (rawX * zoom) + panX;
                const renderY = h - (action.pos / 100) * h;
                if (renderX >= xMin && renderX <= xMax && renderY >= yMin && renderY <= yMax) action.selected = true;
            });
        }
        updateActionsLog();
        drawTimeline();
    }
});

// ==========================================================================
// RENDERIZADOR GRÁFICO
// ==========================================================================
function drawTimeline() {
    if (!canvas.width) return;
    const h = canvas.height; const w = canvas.width; const timelineWidth = w - 40;
    const duration = videoPlayer.duration ? videoPlayer.duration * 1000 : 60000; 
    ctx.clearRect(0, 0, w, h);
    
    ctx.fillStyle = 'rgba(37, 99, 235, 0.05)'; ctx.fillRect(40, 0, timelineWidth, h * 0.30);
    ctx.fillStyle = 'rgba(139, 92, 246, 0.02)'; ctx.fillRect(40, h * 0.30, timelineWidth, h * 0.50);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.04)'; ctx.fillRect(40, h * 0.80, timelineWidth, h * 0.20);

    ctx.lineWidth = 1; ctx.font = '9px monospace';
    for (let i = 0; i <= 100; i += 10) {
        const y = h - (i / 100) * h;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = (i === 20 || i === 70) ? '#475569' : '#141d2b';
        if (i === 20 || i === 70) ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = (i === 20 || i === 70 || i === 100 || i === 0) ? '#64748b' : '#2a374a';
        ctx.fillText(`${i}%`, 8, y + 3);
    }

    if (funscriptActions.length > 0) {
        ctx.lineWidth = 2; ctx.strokeStyle = '#38bdf8'; ctx.beginPath();
        funscriptActions.forEach((action, index) => {
            const rawX = (action.at / duration) * timelineWidth;
            const x = 40 + (rawX * zoom) + panX; const y = h - (action.pos / 100) * h;
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        funscriptActions.forEach((action) => {
            const rawX = (action.at / duration) * timelineWidth;
            const x = 40 + (rawX * zoom) + panX; const y = h - (action.pos / 100) * h;
            if (x >= 40 && x <= w) {
                ctx.beginPath(); ctx.arc(x, y, action.selected ? 6 : 4, 0, 2 * Math.PI);
                if (action.selected) {
                    ctx.fillStyle = '#38bdf8'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
                    ctx.fill(); ctx.stroke();
                } else {
                    ctx.fillStyle = action.pos >= 70 ? '#10b981' : (action.pos <= 20 ? '#ef4444' : '#f59e0b');
                    ctx.fill();
                }
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

    if (videoPlayer.src) {
        const currentTimeMs = videoPlayer.currentTime * 1000;
        const rawPlayheadX = (currentTimeMs / duration) * timelineWidth;
        const currentX = 40 + (rawPlayheadX * zoom) + panX;
        if (currentX >= 40 && currentX <= w) {
            ctx.lineWidth = 1.5; ctx.strokeStyle = '#f43f5e'; ctx.beginPath();
            ctx.moveTo(currentX, 0); ctx.lineTo(currentX, h); ctx.stroke();
        }
    }
}

function updateActionsLog() {
    if (funscriptActions.length === 0) {
        actionsLog.innerHTML = '<span class="empty-log">Sin puntos registrados aún</span>';
        return;
    }
    const latestActions = [...funscriptActions].reverse().slice(0, 5);
    actionsLog.innerHTML = latestActions.map(act => {
        const seconds = (act.at / 1000).toFixed(3);
        let isSelText = act.selected ? '<strong style="color:#38bdf8;">[Sel]</strong> ' : '';
        return `<div style="margin-bottom: 4px;">
            ${isSelText}<span style="color: #64748b;">[${seconds}s]</span> 
            <span style="color: #38bdf8; font-weight:bold;">POS: ${act.pos}%</span> 
        </div>`;
    }).join('');
}

if (videoPlayer) {
    videoPlayer.addEventListener('timeupdate', drawTimeline);
    videoPlayer.addEventListener('seeking', drawTimeline);
}

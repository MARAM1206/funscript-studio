// ==========================================================================
// LÍNEA DE TIEMPO INTERACTIVA AVANZADA (ZOOM, PAN, MARQUEE SELECTION)
// ==========================================================================

const canvas = document.getElementById('timeline-canvas');
const ctx = canvas.getContext('2d');
const actionsLog = document.getElementById('actions-log');
const zoomIndicator = document.getElementById('zoom-indicator');

let funscriptActions = [];

// Estados de Navegación y Selección
let zoom = 1.0;
let panX = 0;
let isSelecting = false;
let isPanning = false;
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 160;
    drawTimeline();
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 500);

// ==========================================================================
// ENTRADAS DEL TECLADO (0-9, A para 100%, Suprimir para borrar)
// ==========================================================================
window.addEventListener('keydown', function(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

    let position = null;
    const key = event.key.toLowerCase();

    if (key >= '1' && key <= '9') position = parseInt(key) * 10;
    else if (key === '0') position = 0;
    else if (key === 'a') position = 100; // Reasignado Q a A para liberar fotogramas

    if (position !== null && videoPlayer.src) {
        event.preventDefault();
        const timeMs = Math.floor(videoPlayer.currentTime * 1000);
        addAction(timeMs, position);
    }

    // ELIMINAR NODOS SELECCIONADOS (Suprimir o Backspace)
    if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        funscriptActions = funscriptActions.filter(act => !act.selected);
        updateActionsLog();
        drawTimeline();
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
// RATÓN: ZOOM, PAN Y CUADRO DE SELECCIÓN
// ==========================================================================

// ZOOM: Rueda del ratón
canvas.addEventListener('wheel', function(event) {
    event.preventDefault();
    const zoomIntensity = 0.1;
    if (event.deltaY < 0) {
        zoom = Math.min(50.0, zoom + zoomIntensity); // Max 50x zoom
    } else {
        zoom = Math.max(1.0, zoom - zoomIntensity); // Min 1x
        if (zoom === 1.0) panX = 0; // Reseteamos paneo al mínimo zoom
    }
    zoomIndicator.innerText = `Zoom: ${zoom.toFixed(1)}x | Pan: ${Math.floor(panX)}`;
    drawTimeline();
});

// CLIC ABAJO: Detectar si arrastra para Paneo o para Cuadro de Selección
canvas.addEventListener('mousedown', function(event) {
    const rect = canvas.getBoundingClientRect();
    startX = event.clientX - rect.left;
    startY = event.clientY - rect.top;

    if (event.shiftKey) {
        isPanning = true;
    } else {
        isSelecting = true;
        currentX = startX;
        currentY = startY;
        
        // Si haces un clic simple sin arrastrar en zona vacía, deseleccionamos todo
        if (!event.ctrlKey) {
            funscriptActions.forEach(act => act.selected = false);
        }
    }
});

// MOVER RATÓN: Actualizar el Paneo o el Cuadro visual
canvas.addEventListener('mousemove', function(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    if (isPanning) {
        const dx = x - startX;
        panX += dx;
        // Limitar el paneo para que no se salga de los límites de la pantalla izquierdo/derecho
        if (panX > 0) panX = 0;
        startX = x;
        zoomIndicator.innerText = `Zoom: ${zoom.toFixed(1)}x | Pan: ${Math.floor(panX)}`;
        drawTimeline();
    } else if (isSelecting) {
        currentX = x;
        currentY = event.clientY - rect.top;
        drawTimeline();
    }
});

// SOLTAR RATÓN: Calcular qué puntos quedaron dentro del cuadro de selección
canvas.addEventListener('mouseup', function(event) {
    if (isSelecting) {
        isSelecting = false;
        
        const xMin = Math.min(startX, currentX);
        const xMax = Math.max(startX, currentX);
        const yMin = Math.min(startY, currentY);
        const yMax = Math.max(startY, currentY);
        
        const duration = videoPlayer.duration ? videoPlayer.duration * 1000 : 60000;
        const w = canvas.width - 40;
        const h = canvas.height;

        // Evitamos procesar si fue solo un clic sin arrastre real
        if (xMax - xMin > 3 || yMax - yMin > 3) {
            funscriptActions.forEach(action => {
                // Calculamos dónde está pintado el punto actualmente en la pantalla tomando en cuenta Zoom y Pan
                const rawX = (action.at / duration) * w;
                const renderX = 40 + (rawX * zoom) + panX;
                const renderY = h - (action.pos / 100) * h;

                if (renderX >= xMin && renderX <= xMax && renderY >= yMin && renderY <= yMax) {
                    action.selected = true;
                }
            });
        }
        drawTimeline();
    }
    isPanning = false;
});

// ==========================================================================
// DIBUJAR TODO EN CANVAS
// ==========================================================================
function drawTimeline() {
    if (!canvas.width) return;
    
    const h = canvas.height;
    const w = canvas.width;
    const timelineWidth = w - 40;
    const duration = videoPlayer.duration ? videoPlayer.duration * 1000 : 60000; 
    
    ctx.clearRect(0, 0, w, h);
    
    // Franjas anatómicas de fondo
    ctx.fillStyle = 'rgba(37, 99, 235, 0.05)'; // Cabeza
    ctx.fillRect(40, 0, timelineWidth, h * 0.30);
    ctx.fillStyle = 'rgba(139, 92, 246, 0.02)'; // Tronco
    ctx.fillRect(40, h * 0.30, timelineWidth, h * 0.50);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.04)'; // Base
    ctx.fillRect(40, h * 0.80, timelineWidth, h * 0.20);

    // Cuadrícula Horizontal de porcentajes (Cada 10%)
    ctx.lineWidth = 1;
    ctx.font = '9px monospace';
    for (let i = 0; i <= 100; i += 10) {
        const y = h - (i / 100) * h;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = (i === 20 || i === 70) ? '#475569' : '#141d2b';
        if (i === 20 || i === 70) ctx.setLineDash([]);
        
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.fillStyle = (i === 20 || i === 70 || i === 100 || i === 0) ? '#64748b' : '#2a374a';
        ctx.fillText(`${i}%`, 8, y + 3);
    }

    // Dibujar Curvas Vectoriales y Nodos aplicando Zoom y Pan
    if (funscriptActions.length > 0) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();

        funscriptActions.forEach((action, index) => {
            const rawX = (action.at / duration) * timelineWidth;
            const x = 40 + (rawX * zoom) + panX;
            const y = h - (action.pos / 100) * h;

            if (x >= 40) { // Solo dibujamos si está dentro de la zona visible
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Pintar Círculos en los Nodos individuales
        funscriptActions.forEach((action) => {
            const rawX = (action.at / duration) * timelineWidth;
            const x = 40 + (rawX * zoom) + panX;
            const y = h - (action.pos / 100) * h;

            if (x >= 40 && x <= w) {
                ctx.beginPath();
                ctx.arc(x, y, action.selected ? 6 : 4, 0, 2 * Math.PI); // Más grandes si están seleccionados
                
                if (action.selected) {
                    ctx.fillStyle = '#38bdf8'; // Azul brillante de selección
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.fill();
                    ctx.stroke();
                } else {
                    ctx.fillStyle = action.pos >= 70 ? '#10b981' : (action.pos <= 20 ? '#ef4444' : '#f59e0b');
                    ctx.fill();
                }
            }
        });
    }

    // Cuadro de selección visual (Marquee Box)
    if (isSelecting) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
        ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        ctx.setLineDash([]);
    }

    // Línea de Tiempo Vertical de reproducción con Zoom y Pan aplicado
    if (videoPlayer.src) {
        const currentTimeMs = videoPlayer.currentTime * 1000;
        const rawPlayheadX = (currentTimeMs / duration) * timelineWidth;
        const currentX = 40 + (rawPlayheadX * zoom) + panX;
        
        if (currentX >= 40 && currentX <= w) {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#f43f5e';
            ctx.beginPath();
            ctx.moveTo(currentX, 0);
            ctx.lineTo(currentX, h);
            ctx.stroke();
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
        let zoneText = act.pos >= 70 ? 'Cabeza' : (act.pos <= 20 ? 'Base' : 'Tronco');
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

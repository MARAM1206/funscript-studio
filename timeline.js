// ==========================================================================
// CAPTURA DE TECLADO Y RENDERIZADO DE LÍNEA DE TIEMPO CON GUÍAS VISUALES
// ==========================================================================

// Elementos de la interfaz
const canvas = document.getElementById('timeline-canvas');
const ctx = canvas.getContext('2d');
const actionsLog = document.getElementById('actions-log');
const zoomIndicator = document.getElementById('zoom-indicator');

// Base de datos temporal de movimientos
let funscriptActions = [];

// Configuración del tamaño del Canvas
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 150; // Aumentamos un poco la altura para que las 10 filas respiren mejor
    drawTimeline();
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 500);

// ==========================================================================
// INTERCEPCIÓN DEL TECLADO (Mapeo Numérico 0-9 y Q)
// ==========================================================================
window.addEventListener('keydown', function(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

    let position = null;
    const key = event.key.toLowerCase();

    if (key >= '1' && key <= '9') {
        position = parseInt(key) * 10;
    } else if (key === '0') {
        position = 0;
    } else if (key === 'q') {
        position = 100;
    }

    if (position !== null && videoPlayer.src) {
        event.preventDefault();
        const timeMs = Math.floor(videoPlayer.currentTime * 1000);
        addAction(timeMs, position);
    }
});

function addAction(timeMs, position) {
    funscriptActions = funscriptActions.filter(act => act.at !== timeMs);
    funscriptActions.push({ at: timeMs, pos: position });
    funscriptActions.sort((a, b) => a.at - b.at);
    
    updateActionsLog();
    drawTimeline();
}

// ==========================================================================
// RENDERIZADO GRÁFICO (Canvas con Rejilla de 10% y Línea Vertical)
// ==========================================================================
function drawTimeline() {
    if (!canvas.width) return;
    
    const h = canvas.height;
    const w = canvas.width;
    const duration = videoPlayer.duration ? videoPlayer.duration * 1000 : 60000; 
    
    // 1. Limpiar el lienzo
    ctx.clearRect(0, 0, w, h);
    
    // 2. Dibujar las 3 Franjas Anatómicas de Fondo (Base)
    ctx.fillStyle = 'rgba(37, 99, 235, 0.06)'; // Cabeza (70% - 100%)
    ctx.fillRect(0, 0, w, h * 0.30);
    
    ctx.fillStyle = 'rgba(139, 92, 246, 0.03)'; // Tronco (20% - 70%)
    ctx.fillRect(0, h * 0.30, w, h * 0.50);
    
    ctx.fillStyle = 'rgba(239, 68, 68, 0.05)'; // Base (0% - 20%)
    ctx.fillRect(0, h * 0.80, w, h * 0.20);

    // 3. NUEVO: Dibujar Filas de Guía (Cada 10%)
    ctx.lineWidth = 1;
    ctx.font = '9px monospace';
    
    for (let i = 0; i <= 100; i += 10) {
        const y = h - (i / 100) * h;
        
        // Hacemos las líneas discontinuas (punteadas) para que no saturen la vista
        ctx.setLineDash([4, 4]);
        
        // Destacamos más las líneas divisorias de las zonas anatómicas (20% y 70%)
        if (i === 20 || i === 70) {
            ctx.strokeStyle = '#475569';
            ctx.setLineDash([]); // Línea continua para las divisiones mayores
        } else {
            ctx.strokeStyle = '#1e293b';
        }
        
        ctx.beginPath();
        ctx.moveTo(40, y); // Dejamos un espacio a la izquierda para el texto
        ctx.lineTo(w, y);
        ctx.stroke();
        
        // Dibujar el texto del porcentaje (10%, 20%...) a la izquierda
        ctx.setLineDash([]); // Quitamos el punteado para el texto
        ctx.fillStyle = i === 20 || i === 70 || i === 100 || i === 0 ? '#64748b' : '#334155';
        ctx.fillText(`${i}%`, 8, y + 3);
    }

    // 4. Dibujar las Líneas Vectoriales y Nodos del Script
    if (funscriptActions.length > 0) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();

        funscriptActions.forEach((action, index) => {
            const x = 40 + ((action.at / duration) * (w - 40));
            const y = h - (action.pos / 100) * h;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Círculos en los nodos
        funscriptActions.forEach((action) => {
            const x = 40 + ((action.at / duration) * (w - 40));
            const y = h - (action.pos / 100) * h;

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = action.pos >= 70 ? '#10b981' : (action.pos <= 20 ? '#ef4444' : '#f59e0b');
            ctx.fill();
        });
    }

    // 5. NUEVO: Línea Vertical Indicadora del Video (Playhead)
    if (videoPlayer.src) {
        const currentTimeMs = videoPlayer.currentTime * 1000;
        // Calculamos la posición X exacta basada en el tiempo actual del video
        const currentX = 40 + ((currentTimeMs / duration) * (w - 40));
        
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#f43f5e'; // Color rosa/rojo brillante para que resalte
        ctx.setLineDash([]); // Línea sólida
        
        ctx.beginPath();
        ctx.moveTo(currentX, 0);
        ctx.lineTo(currentX, h);
        ctx.stroke();
        
        // Una pequeña cabeza de flecha o indicador arriba de la línea vertical
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(currentX - 4, 0);
        ctx.lineTo(currentX + 4, 0);
        ctx.lineTo(currentX, 6);
        ctx.fill();
    }
}

// ==========================================================================
// CONSOLA DE REGISTRO TEXTUAL
// ==========================================================================
function updateActionsLog() {
    if (funscriptActions.length === 0) {
        actionsLog.innerHTML = '<span class="empty-log">Sin puntos registrados aún</span>';
        return;
    }

    const latestActions = [...funscriptActions].reverse().slice(0, 5);
    actionsLog.innerHTML = latestActions.map(act => {
        const seconds = (act.at / 1000).toFixed(3);
        let zoneText = act.pos >= 70 ? 'Cabeza' : (act.pos <= 20 ? 'Base' : 'Tronco');
        return `<div style="margin-bottom: 4px;">
            <span style="color: #64748b;">[${seconds}s]</span> 
            <span style="color: #38bdf8; font-weight:bold;">POS: ${act.pos}%</span> 
            <span style="color: #94a3b8; font-size:0.75rem;">(${zoneText})</span>
        </div>`;
    }).join('');
}

// Escuchamos el evento 'timeupdate' para mover la línea vertical frame por frame
if (videoPlayer) {
    videoPlayer.addEventListener('timeupdate', drawTimeline);
    // También redibujamos cuando el video se pausa o se mueve manualmente la barra nativa
    videoPlayer.addEventListener('seeking', drawTimeline);
}

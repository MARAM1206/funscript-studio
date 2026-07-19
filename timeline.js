// ==========================================================================
// CAPTURA DE TECLADO Y RENDERIZADO DE LÍNEA DE TIEMPO (CANVAS)
// ==========================================================================

// Elementos de la interfaz
const canvas = document.getElementById('timeline-canvas');
const ctx = canvas.getContext('2d');
const actionsLog = document.getElementById('actions-log');
const zoomIndicator = document.getElementById('zoom-indicator');

// Base de datos temporal de movimientos (Aquí se guarda el JSON interactivo)
let funscriptActions = [];

// Configuración del tamaño del Canvas
function resizeCanvas() {
    // Le damos resolución real al lienzo según su tamaño en pantalla
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 120;
    drawTimeline();
}
window.addEventListener('resize', resizeCanvas);
// Ejecutar un pequeño retraso para asegurar que el diseño cargó en el navegador
setTimeout(resizeCanvas, 500);

// ==========================================================================
// INTERCEPCIÓN DEL TECLADO (Mapeo Numérico 0-9 y Q)
// ==========================================================================
window.addEventListener('keydown', function(event) {
    // Evitamos capturar si estás interactuando con menús desplegables
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

    let position = null;
    const key = event.key.toLowerCase();

    // Mapeo de teclas numéricas a porcentajes (1 = 10%, 9 = 90%)
    if (key >= '1' && key <= '9') {
        position = parseInt(key) * 10;
    } else if (key === '0') {
        position = 0; // Base total
    } else if (key === 'q') {
        position = 100; // Cabeza total
    }

    // Si se presionó una tecla válida y el video está cargado
    if (position !== null && videoPlayer.src) {
        event.preventDefault();
        
        // Obtenemos el tiempo actual del video en milisegundos exactos
        const timeMs = Math.floor(videoPlayer.currentTime * 1000);
        
        // Registramos la acción
        addAction(timeMs, position);
    }
});

/**
 * Añade un nodo de movimiento, evitando duplicados en el mismo milisegundo
 * y ordenándolos cronológicamente.
 */
function addAction(timeMs, position) {
    // Eliminamos si ya existía un punto en ese mismo milisegundo exacto para no encimar
    funscriptActions = funscriptActions.filter(act => act.at !== timeMs);
    
    // Insertamos el nuevo punto
    funscriptActions.push({ at: timeMs, pos: position });
    
    // Ordenamos la lista por tiempo (de menor a mayor)
    funscriptActions.sort((a, b) => a.at - b.at);
    
    // Actualizamos la parte visual
    updateActionsLog();
    drawTimeline();
}

// ==========================================================================
// RENDERIZADO GRÁFICO (El Canvas con Zonas Anatómicas)
// ==========================================================================
function drawTimeline() {
    if (!canvas.width) return;
    
    // 1. Limpiar el lienzo
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 2. Dibujar las 3 Franjas Anatómicas de Fondo
    // Canvas mide 0 en la parte superior y 'height' en la inferior. Invertimos el cálculo.
    const h = canvas.height;
    
    // Sección 1: Cabeza (70% al 100% superior) -> Azul Oscuro Sutil
    ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
    ctx.fillRect(0, 0, canvas.width, h * 0.30);
    
    // Sección 2: Tronco (20% al 70% centro) -> Púrpura/Gris Sutil
    ctx.fillStyle = 'rgba(139, 92, 246, 0.04)';
    ctx.fillRect(0, h * 0.30, canvas.width, h * 0.50);
    
    // Sección 3: Base (0% al 20% inferior) -> Rojo Oscuro Sutil
    ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
    ctx.fillRect(0, h * 0.80, canvas.width, h * 0.20);

    // Líneas divisorias tenues
    ctx.strokeStyle = '#273549';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.30); ctx.lineTo(canvas.width, h * 0.30);
    ctx.moveTo(0, h * 0.80); ctx.lineTo(canvas.width, h * 0.80);
    ctx.stroke();

    // Si no hay acciones guardadas, no hay nada más que pintar
    if (funscriptActions.length === 0) return;

    // 3. Dibujar las Líneas de Conexión Vectorial y Nodos
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8'; // Línea azul brillante
    ctx.beginPath();

    funscriptActions.forEach((action, index) => {
        // Mapeo básico de tiempo a coordenada X en pantalla (Escala temporal preliminar)
        // Usamos una ventana de visualización simple proporcional a la duración del video
        const duration = videoPlayer.duration ? videoPlayer.duration * 1000 : 60000; 
        const x = (action.at / duration) * canvas.width;
        
        // Mapeo de porcentaje (0-100) a coordenada Y (Invertido para que 100 esté arriba)
        const y = h - (action.pos / 100) * h;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // Dibujamos círculos en los nodos para verlos con claridad
    funscriptActions.forEach((action) => {
        const duration = videoPlayer.duration ? videoPlayer.duration * 1000 : 60000;
        const x = (action.at / duration) * canvas.width;
        const y = h - (action.pos / 100) * h;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        // Nodo Verde si golpea arriba (zona cabeza), Rojo si golpea abajo (zona base)
        ctx.fillStyle = action.pos >= 70 ? '#10b981' : (action.pos <= 20 ? '#ef4444' : '#f59e0b');
        ctx.fill();
    });
}

// ==========================================================================
// CONSOLA DE REGISTRO TEXTUAL
// ==========================================================================
function updateActionsLog() {
    if (funscriptActions.length === 0) {
        actionsLog.innerHTML = '<span class="empty-log">Sin puntos registrados aún</span>';
        return;
    }

    // Mostramos las últimas 5 acciones en orden descendente para tener control visual
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

// Escuchamos cuando el video avanza para poder redibujar la barra si es necesario
if (videoPlayer) {
    videoPlayer.addEventListener('timeupdate', drawTimeline);
}

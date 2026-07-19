// ==========================================================================
// CEREBRO DE IA TRACKING V1.0: COINCIDENCIA DE PLANTILLAS Y SELECCIÓN ANATÓMICA
// ==========================================================================

const trackCanvas = document.getElementById('tracking-canvas');
const trackCtx = trackCanvas.getContext('2d', { willReadFrequently: true });
const toggleAiBtn = document.getElementById('toggle-ai-btn');

let aiActive = false;
let isDrawingBox = false;
let boxStart = { x: 0, y: 0 };
let trackBox = null; // { x, y, w, h }

// Datos de la plantilla memorizada para el Flujo Óptico
let templateData = null;
let lastTrackedY = 0;
let trackingMinY = 0;
let trackingMaxY = 0;

// Encender/Apagar el Modo IA
toggleAiBtn?.addEventListener('click', () => {
    aiActive = !aiActive;
    if (aiActive) {
        toggleAiBtn.innerText = "🤖 Modo IA: ACTIVO";
        toggleAiBtn.style.background = "#10b981";
        trackCanvas.style.display = "block";
        syncTrackingCanvasSize();
        if (videoPlayer) videoPlayer.pause(); // Pausar para dejar dibujar el cuadro con calma
    } else {
        toggleAiBtn.innerText = "🤖 Activar IA Tracking";
        toggleAiBtn.style.background = "#7c3aed";
        trackCanvas.style.display = "none";
        trackBox = null;
        templateData = null;
        clearTrackCanvas();
    }
});

function syncTrackingCanvasSize() {
    trackCanvas.width = videoPlayer.clientWidth;
    trackCanvas.height = videoPlayer.clientHeight;
}
window.addEventListener('resize', () => { if (aiActive) syncTrackingCanvasSize(); });

function clearTrackCanvas() {
    trackCtx.clearRect(0, 0, trackCanvas.width, trackCanvas.height);
}

// CAPTURA DE RATÓN: Dibujar la Bounding Box sobre la anatomía
trackCanvas.addEventListener('mousedown', (e) => {
    if (!aiActive) return;
    const rect = trackCanvas.getBoundingClientRect();
    boxStart.x = event.clientX - rect.left;
    boxStart.y = event.clientY - rect.top;
    isDrawingBox = true;
    templateData = null; // Borra rastreos anteriores
});

trackCanvas.addEventListener('mousemove', (e) => {
    if (!isDrawingBox) return;
    const rect = trackCanvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    clearTrackCanvas();
    
    // Dibujar cuadro guía estilo Google
    trackCtx.strokeStyle = '#7c3aed';
    trackCtx.lineWidth = 2;
    trackCtx.setLineDash([4, 4]);
    
    const w = currentX - boxStart.x;
    const h = currentY - boxStart.y;
    trackCtx.strokeRect(boxStart.x, boxStart.y, w, h);
    trackCtx.setLineDash([]);
});

trackCanvas.addEventListener('mouseup', (e) => {
    if (!isDrawingBox) return;
    isDrawingBox = false;
    
    const rect = trackCanvas.getBoundingClientRect();
    const endX = event.clientX - rect.left;
    const endY = event.clientY - rect.top;

    const x = Math.min(boxStart.x, endX);
    const y = Math.min(boxStart.y, endY);
    const w = Math.abs(endX - boxStart.x);
    const h = Math.abs(endY - boxStart.y);

    if (w > 10 && h > 10) {
        trackBox = { x, y, w, h };
        lastTrackedY = y + h / 2;
        
        // Establecer límites de calibración basados en la pantalla actual
        trackingMinY = Math.max(0, y - 120);
        trackingMaxY = Math.min(trackCanvas.height, y + h + 120);
        
        // Memorizar los píxeles iniciales (Crear la plantilla de contraste)
        try {
            templateData = trackCtx.getImageData(x, y, w, h);
            captureTemplateFromVideo();
        } catch (err) { console.log("Carga inicial de pixeles activa."); }
        
        drawConfirmedBox();
    }
});

function drawConfirmedBox() {
    clearTrackCanvas();
    if (!trackBox) return;
    // Cuadro verde sólido: Objetivo fijado y listo para el tracking
    trackCtx.strokeStyle = '#10b981';
    trackCtx.lineWidth = 2;
    trackCtx.strokeRect(trackBox.x, trackBox.y, trackBox.w, trackBox.h);
    
    // Dibujar marcadores horizontales sutiles de las 3 zonas anatómicas dentro del cuadro
    trackCtx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    trackCtx.lineWidth = 1;
    // Línea del 70% (Cabeza/Tronco)
    const y70 = trackBox.y + (trackBox.h * 0.30);
    trackCtx.beginPath(); trackCtx.moveTo(trackBox.x, y70); trackCtx.lineTo(trackBox.x + trackBox.w, y70); trackCtx.stroke();
    // Línea del 20% (Tronco/Base)
    const y20 = trackBox.y + (trackBox.h * 0.80);
    trackCtx.beginPath(); trackCtx.moveTo(trackBox.x, y20); trackCtx.lineTo(trackBox.x + trackBox.w, y20); trackCtx.stroke();
}

function captureTemplateFromVideo() {
    if (!trackBox) return;
    // Forzar render momentáneo para extraer la matriz de pixeles reales del video local
    trackCtx.drawImage(videoPlayer, 0, 0, trackCanvas.width, trackCanvas.height);
    templateData = trackCtx.getImageData(trackBox.x, trackBox.y, trackBox.w, trackBox.h);
    drawConfirmedBox();
}

// PROCESADOR DE FOTOGRAMAS EN ALTA VELOCIDAD (Aprovecha tu Hardware RTX)
if (videoPlayer) {
    videoPlayer.addEventListener('timeupdate', () => {
        if (!aiActive || !templateData || !trackBox || videoPlayer.paused) return;
        processTrackingFrame();
    });
}

function processTrackingFrame() {
    // 1. Pintar el fotograma actual del video en el lienzo oculto de IA
    trackCtx.drawImage(videoPlayer, 0, 0, trackCanvas.width, trackCanvas.height);
    
    const searchWidth = trackBox.w;
    const searchHeight = trackBox.h + 60; // Ventana de búsqueda extendida verticalmente (+/- 30px)
    const searchX = trackBox.x;
    const searchY = Math.max(0, (lastTrackedY - searchHeight / 2));
    
    let searchData;
    try {
        searchData = trackCtx.getImageData(searchX, searchY, searchWidth, searchHeight);
    } catch (e) { return; }

    // 2. Algoritmo matemático de Suma de Diferencias Absolutas (SAD)
    let bestY = 0;
    let minDifference = Infinity;
    
    const tData = templateData.data;
    const sData = searchData.data;
    
    // Escaneo vertical pixel por pixel en busca del bloque con mayor coincidencia de contraste
    for (let y = 0; y <= searchHeight - trackBox.h; y++) {
        let difference = 0;
        
        for (let row = 0; row < trackBox.h; row += 2) { // Salto de 2px para máxima optimización y velocidad
            const templateRowOffset = row * trackBox.w * 4;
            const searchRowOffset = (y + row) * searchWidth * 4;
            
            for (let col = 0; col < trackBox.w; col += 2) {
                const tIdx = templateRowOffset + col * 4;
                const sIdx = searchRowOffset + col * 4;
                
                // Comparación de canales de color RGB
                difference += Math.abs(tData[tIdx] - sData[sIdx]) +
                             Math.abs(tData[tIdx+1] - sData[sIdx+1]) +
                             Math.abs(tData[tIdx+2] - sData[sIdx+2]);
            }
        }
        
        if (difference < minDifference) {
            minDifference = difference;
            bestY = y;
        }
    }

    // 3. Actualizar coordenadas del cuadro en base al éxito del match
    const absoluteNewY = searchY + bestY;
    lastTrackedY = absoluteNewY + trackBox.h / 2;
    trackBox.y = absoluteNewY;
    
    // 4. NORMALIZACIÓN MATEMÁTICA E INYECCIÓN EN FUNSCRIPT DETECTANDO LAS 3 ZONAS
    const totalRange = trackingMaxY - trackingMinY;
    const currentRelativePos = trackBox.y - trackingMinY;
    
    // Convertir a porcentaje invertido (0% abajo, 100% arriba)
    let rawPercent = 100 - Math.round((currentRelativePos / totalRange) * 100);
    let finalPosition = Math.max(0, Math.min(100, rawPercent));
    
    // Insertar el punto automáticamente en la cinta transportadora en caliente
    const timeMs = Math.floor(videoPlayer.currentTime * 1000);
    
    if (typeof window.saveHistoryState === 'function') {
        // Inyectar sin saturar el historial, ordenando de forma limpia
        funscriptActions = funscriptActions.filter(act => Math.abs(act.at - timeMs) > 35);
        funscriptActions.push({ at: timeMs, pos: finalPosition, selected: false });
        funscriptActions.sort((a, b) => a.at - b.at);
        
        if (typeof updateActionsLog === 'function') updateActionsLog();
    }

    // Volver a dibujar el cuadro verde del tracker siguiendo el movimiento en pantalla
    drawConfirmedBox();
}

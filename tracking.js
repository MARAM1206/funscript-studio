// ==========================================================================
// CEREBRO DE IA TRACKING V1.1: LIENZO TRANSPARENTE Y RANGO CALIBRABLE
// ==========================================================================

const trackCanvas = document.getElementById('tracking-canvas');
const trackCtx = trackCanvas.getContext('2d');
const toggleAiBtn = document.getElementById('toggle-ai-btn');

// NUEVO: Canvas oculto en memoria para procesamiento interno (Evita el video negro)
const hiddenCanvas = document.createElement('canvas');
const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

let aiActive = false;
let isDrawingBox = false;
let boxStart = { x: 0, y: 0 };
let trackBox = null; 

let templateData = null;
let lastTrackedY = 0;
let initialTrackedY = 0;

// NUEVO: Rango de píxeles calibrable para controlar la sensibilidad (Evita saltos bruscos)
let aiTrackingRange = 180; 

toggleAiBtn?.addEventListener('click', () => {
    aiActive = !aiActive;
    if (aiActive) {
        toggleAiBtn.innerText = "🤖 Modo IA: ACTIVO";
        toggleAiBtn.style.background = "#10b981";
        trackCanvas.style.display = "block";
        syncTrackingCanvasSize();
        if (videoPlayer) videoPlayer.pause(); 
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
    hiddenCanvas.width = videoPlayer.clientWidth;
    hiddenCanvas.height = videoPlayer.clientHeight;
}
window.addEventListener('resize', () => { if (aiActive) syncTrackingCanvasSize(); });

function clearTrackCanvas() {
    trackCtx.clearRect(0, 0, trackCanvas.width, trackCanvas.height);
}

// ESCUCHADOR DE TECLADO INTERNO: Calibración de rango mediante + y -
window.addEventListener('keydown', (e) => {
    if (!aiActive || !trackBox) return;
    if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        aiTrackingRange = Math.min(500, aiTrackingRange + 15); // Reduce sensibilidad (más rango de recorrido)
        drawConfirmedBox();
    }
    if (e.key === '-') {
        e.preventDefault();
        aiTrackingRange = Math.max(40, aiTrackingRange - 15); // Aumenta sensibilidad (menos rango de recorrido)
        drawConfirmedBox();
    }
});

trackCanvas.addEventListener('mousedown', (event) => {
    if (!aiActive) return;
    const rect = trackCanvas.getBoundingClientRect();
    boxStart.x = event.clientX - rect.left;
    boxStart.y = event.clientY - rect.top;
    isDrawingBox = true;
    templateData = null;
});

trackCanvas.addEventListener('mousemove', (event) => {
    if (!isDrawingBox) return;
    const rect = trackCanvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    clearTrackCanvas();
    trackCtx.strokeStyle = '#7c3aed';
    trackCtx.lineWidth = 2;
    trackCtx.setLineDash([4, 4]);
    
    const w = currentX - boxStart.x;
    const h = currentY - boxStart.y;
    trackCtx.strokeRect(boxStart.x, boxStart.y, w, h);
    trackCtx.setLineDash([]);
});

trackCanvas.addEventListener('mouseup', (event) => {
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
        initialTrackedY = y + h / 2;
        lastTrackedY = initialTrackedY;
        
        // Captura inicial de píxeles usando el lienzo oculto en memoria
        hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        templateData = hiddenCtx.getImageData(x, y, w, h);
        
        drawConfirmedBox();
    }
});

// NUEVO: DIBUJO DE MÁSCARA PROPORCIONAL MÓVIL
function drawConfirmedBox() {
    clearTrackCanvas();
    if (!trackBox) return;

    // 1. Cuadro verde de objetivo fijado
    trackCtx.strokeStyle = '#10b981';
    trackCtx.lineWidth = 2;
    trackCtx.strokeRect(trackBox.x, trackBox.y, trackBox.w, trackBox.h);
    
    // 2. Barra lateral calibradora que se mueve JUNTO con el cuadro para no perder proporción
    const barX = trackBox.x - 18;
    const barY = trackBox.y + (trackBox.h / 2) - (aiTrackingRange / 2);
    
    // Renderizar los fondos de las 3 zonas anatómicas proporcionales en la barra móvil
    trackCtx.fillStyle = 'rgba(239, 68, 68, 0.3)'; // Base (0-20%)
    trackCtx.fillRect(barX, barY + (aiTrackingRange * 0.8), 8, aiTrackingRange * 0.2);
    
    trackCtx.fillStyle = 'rgba(139, 92, 246, 0.3)'; // Tronco (20-70%)
    trackCtx.fillRect(barX, barY + (aiTrackingRange * 0.3), 8, aiTrackingRange * 0.5);
    
    trackCtx.fillStyle = 'rgba(16, 185, 129, 0.3)'; // Cabeza (70-100%)
    trackCtx.fillRect(barX, barY, 8, aiTrackingRange * 0.3);

    // Contorno de la barra calibradora
    trackCtx.strokeStyle = '#64748b';
    trackCtx.lineWidth = 1;
    trackCtx.strokeRect(barX, barY, 8, aiTrackingRange);

    // Texto de feedback del Rango de Sensibilidad
    trackCtx.fillStyle = '#94a3b8';
    trackCtx.font = '10px monospace';
    trackCtx.fillText(`Rango IA: ${aiTrackingRange}px [+/-]`, trackBox.x, Math.max(12, trackBox.y - 6));
}

function processTrackingFrame() {
    if (!trackBox || !templateData) return;

    // Copiar fotograma al lienzo oculto
    hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
    
    const searchWidth = trackBox.w;
    const searchHeight = trackBox.h + 80; 
    const searchX = trackBox.x;
    const searchY = Math.max(0, (lastTrackedY - searchHeight / 2));
    
    let searchData;
    try {
        searchData = hiddenCtx.getImageData(searchX, searchY, searchWidth, searchHeight);
    } catch (e) { return; }

    let bestY = 0;
    let minDifference = Infinity;
    
    const tData = templateData.data;
    const sData = searchData.data;
    
    for (let y = 0; y <= searchHeight - trackBox.h; y++) {
        let difference = 0;
        for (let row = 0; row < trackBox.h; row += 2) {
            const templateRowOffset = row * trackBox.w * 4;
            const searchRowOffset = (y + row) * searchWidth * 4;
            for (let col = 0; col < trackBox.w; col += 2) {
                const tIdx = templateRowOffset + col * 4;
                const sIdx = searchRowOffset + col * 4;
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

    const absoluteNewY = searchY + bestY;
    lastTrackedY = absoluteNewY + trackBox.h / 2;
    trackBox.y = absoluteNewY;
    
    // NUEVAS MATEMÁTICAS DE CONVERSIÓN BASADAS EN EL CALIBRADOR MÓVIL
    const displacementPixels = initialTrackedY - lastTrackedY; 
    
    // Mapear el desplazamiento de píxeles en base al rango de calibración establecido
    let calculatedPercent = 50 + Math.round((displacementPixels / (aiTrackingRange / 2)) * 50);
    let finalPosition = Math.max(0, Math.min(100, calculatedPercent));
    
    const timeMs = Math.floor(videoPlayer.currentTime * 1000);
    
    if (typeof window.saveHistoryState === 'function') {
        funscriptActions = funscriptActions.filter(act => Math.abs(act.at - timeMs) > 30);
        funscriptActions.push({ at: timeMs, pos: finalPosition, selected: false });
        funscriptActions.sort((a, b) => a.at - b.at);
    }

    drawConfirmedBox();
}

// Escuchador continuo sincronizado con el refresco de fotogramas del video
if (videoPlayer) {
    videoPlayer.addEventListener('timeupdate', () => {
        if (!aiActive || !trackBox || videoPlayer.paused) return;
        processTrackingFrame();
    });
}

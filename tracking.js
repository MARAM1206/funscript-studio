// ==========================================================================
// CEREBRO DE IA TRACKING V2.0: ENTORNO RELATIVO DE DOBLE NÚCLEO CONFIGURABLE
// ==========================================================================

const trackCanvas = document.getElementById('tracking-canvas');
const trackCtx = trackCanvas.getContext('2d');
const toggleAiBtn = document.getElementById('toggle-ai-btn');

const hiddenCanvas = document.createElement('canvas');
const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

let aiActive = false;
let isDrawingBox = false;
let boxStart = { x: 0, y: 0 };

// Estructuras para Tracker 1 (Base / Objeto de Anclaje)
let trackBox1 = null;
let templateData1 = null;
let lastTrackedY1 = 0;

// Estructuras para Tracker 2 (Cuerpo Móvil / Receptor)
let trackBox2 = null;
let templateData2 = null;
let lastTrackedY2 = 0;

// Relaciones iniciales de calibración
let initialDistanceY = 0;
let aiTrackingRange = 160; 

// COMPONENTE DE PROPORCIÓN ANATÓMICA PERSONALIZABLE (Líneas ajustables globales)
window.aiSplitBase = 20;    // Límite superior de la Base
window.aiSplitCabeza = 70;  // Límite inferior de la Cabeza

toggleAiBtn?.addEventListener('click', () => {
    aiActive = !aiActive;
    if (aiActive) {
        toggleAiBtn.innerText = "🤖 Modo IA: SELECCIONAR OBJETIVOS";
        toggleAiBtn.style.background = "#10b981";
        trackCanvas.style.display = "block";
        syncTrackingCanvasSize();
        if (videoPlayer) videoPlayer.pause();
    } else {
        toggleAiBtn.innerText = "🤖 Activar IA Tracking";
        toggleAiBtn.style.background = "#7c3aed";
        trackCanvas.style.display = "none";
        trackBox1 = null; templateData1 = null;
        trackBox2 = null; templateData2 = null;
        clearTrackCanvas();
    }
});

function syncTrackingCanvasSize() {
    trackCanvas.width = videoPlayer.clientWidth;
    trackCanvas.height = videoPlayer.clientHeight;
    hiddenCanvas.width = videoPlayer.clientWidth;
    hiddenCanvas.height = videoPlayer.clientHeight;
}

function clearTrackCanvas() {
    trackCtx.clearRect(0, 0, trackCanvas.width, trackCanvas.height);
}

// CONTROL DE TECLADO INTERNO: Ajuste fino de límites de sensibilidad y anatomía custom
window.addEventListener('keydown', (e) => {
    if (!aiActive) return;
    const key = e.key.toLowerCase();

    if (e.key === '+' || e.key === '=') {
        e.preventDefault(); aiTrackingRange = Math.min(500, aiTrackingRange + 15);
        drawConfirmedBoxes();
    }
    if (e.key === '-') {
        e.preventDefault(); aiTrackingRange = Math.max(40, aiTrackingRange - 15);
        drawConfirmedBoxes();
    }
    
    // Ajustar frontera de la BASE (U = Bajar, I = Subir)
    if (key === 'u') { e.preventDefault(); window.aiSplitBase = Math.max(5, window.aiSplitBase - 2); drawConfirmedBoxes(); }
    if (key === 'i') { e.preventDefault(); window.aiSplitBase = Math.min(window.aiSplitCabeza - 5, window.aiSplitBase + 2); drawConfirmedBoxes(); }
    
    // Ajustar frontera de la CABEZA (O = Bajar, P = Subir)
    if (key === 'o') { e.preventDefault(); window.aiSplitCabeza = Math.min(95, window.aiSplitCabeza + 2); drawConfirmedBoxes(); }
    if (key === 'p') { e.preventDefault(); window.aiSplitCabeza = Math.max(window.aiSplitBase + 5, window.aiSplitCabeza - 2); drawConfirmedBoxes(); }
});

trackCanvas.addEventListener('mousedown', (event) => {
    if (!aiActive) return;
    const rect = trackCanvas.getBoundingClientRect();
    boxStart.x = event.clientX - rect.left;
    boxStart.y = event.clientY - rect.top;
    isDrawingBox = true;
});

trackCanvas.addEventListener('mousemove', (event) => {
    if (!isDrawingBox) return;
    const rect = trackCanvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    clearTrackCanvas();
    // Re-renderiza el Tracker 1 si ya existe mientras dibujas el 2
    if (trackBox1) {
        trackCtx.strokeStyle = '#38bdf8';
        trackCtx.lineWidth = 2;
        trackCtx.strokeRect(trackBox1.x, trackBox1.y, trackBox1.w, trackBox1.h);
    }

    trackCtx.strokeStyle = is遊 ? '#38bdf8' : '#e11d48';
    trackCtx.strokeStyle = !trackBox1 ? '#38bdf8' : '#f43f5e'; // Tracker 1 Azul, Tracker 2 Rosa
    trackCtx.lineWidth = 2;
    trackCtx.setLineDash([4, 4]);
    trackCtx.strokeRect(boxStart.x, boxStart.y, currentX - boxStart.x, currentY - boxStart.y);
    trackCtx.setLineDash([]);
});

trackCanvas.addEventListener('mouseup', (event) => {
    if (!isDrawingBox) return;
    isDrawingBox = false;
    
    const rect = trackCanvas.getBoundingClientRect();
    const endX = event.clientX - rect.left;
    const endY = event.clientY - rect.top;

    const x = Math.min(boxStart.x, endX); const y = Math.min(boxStart.y, endY);
    const w = Math.abs(endX - boxStart.x); const h = Math.abs(endY - boxStart.y);

    if (w > 8 && h > 8) {
        hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        
        if (!trackBox1) {
            // Registrar Tracker 1 (Pene / Objeto Base de Referencia)
            trackBox1 = { x, y, w, h };
            lastTrackedY1 = y + h / 2;
            templateData1 = hiddenCtx.getImageData(x, y, w, h);
            drawConfirmedBoxes();
        } else if (!trackBox2) {
            // Registrar Tracker 2 (Cuerpo de la pareja / Elemento Móvil)
            trackBox2 = { x, y, w, h };
            lastTrackedY2 = y + h / 2;
            templateData2 = hiddenCtx.getImageData(x, y, w, h);
            
            // Calcular la distancia base relativa en el espacio
            initialDistanceY = Math.abs(lastTrackedY2 - lastTrackedY1);
            toggleAiBtn.innerText = "🤖 IA: DOS NÚCLEOS CORRIENDO";
            toggleAiBtn.style.background = "#059669";
            
            drawConfirmedBoxes();
        }
    }
});

function drawConfirmedBoxes() {
    clearTrackCanvas();
    
    // Dibujar Tracker 1 (Azul)
    if (trackBox1) {
        trackCtx.strokeStyle = '#38bdf8'; trackCtx.lineWidth = 2;
        trackCtx.strokeRect(trackBox1.x, trackBox1.y, trackBox1.w, trackBox1.h);
        trackCtx.fillStyle = '#38bdf8'; trackCtx.font = '9px monospace';
        trackCtx.fillText("T1: ANCLAJE", trackBox1.x, trackBox1.y - 4);
    }
    
    // Dibujar Tracker 2 (Rosa) y Barra de Calibración Customizada
    if (trackBox2) {
        trackCtx.strokeStyle = '#f43f5e'; trackCtx.lineWidth = 2;
        trackCtx.strokeRect(trackBox2.x, trackBox2.y, trackBox2.w, trackBox2.h);
        trackCtx.fillStyle = '#f43f5e';
        trackCtx.fillText("T2: OBJETIVO MÓVIL", trackBox2.x, trackBox2.y - 4);

        // BARRA DE CONTROL ADAPTATIVA PEGADA AL TRACKER 2
        const barX = trackBox2.x + trackBox2.w + 8;
        const barY = trackBox2.y + (trackBox2.h / 2) - (aiTrackingRange / 2);
        
        // Renderizar zonas en base a las variables globales configurables de la anatomía
        const hBase = aiTrackingRange * (window.aiSplitBase / 100);
        const hCabeza = aiTrackingRange * ((100 - window.aiSplitCabeza) / 100);
        const hTronco = aiTrackingRange - hBase - hCabeza;

        trackCtx.fillStyle = 'rgba(16, 185, 129, 0.35)'; // Cabeza (Verde)
        trackCtx.fillRect(barX, barY, 8, hCabeza);
        
        trackCtx.fillStyle = 'rgba(139, 92, 246, 0.35)'; // Tronco (Morado)
        trackCtx.fillRect(barX, barY + hCabeza, 8, hTronco);
        
        trackCtx.fillStyle = 'rgba(239, 68, 68, 0.35)'; // Base (Rojo)
        trackCtx.fillRect(barX, barY + hCabeza + hTronco, 8, hBase);

        trackCtx.strokeStyle = '#94a3b8'; trackCtx.lineWidth = 1;
        trackCtx.strokeRect(barX, barY, 8, aiTrackingRange);
        
        // Feedback de atajos activos de personalización de contornos
        trackCtx.fillStyle = '#64748b'; trackCtx.font = '10px monospace';
        trackCtx.fillText(`Base Split: ${window.aiSplitBase}% [U/I]`, trackBox2.x, trackBox2.y + trackBox2.h + 14);
        trackCtx.fillText(`Cabeza Split: ${window.aiSplitCabeza}% [O/P]`, trackBox2.x, trackBox2.y + trackBox2.h + 26);
    }
}

function scanTemplateSAD(box, template, searchYCenter, searchHeightRange) {
    const searchWidth = box.w;
    const searchHeight = box.h + searchHeightRange;
    const searchX = box.x;
    const searchY = Math.max(0, searchYCenter - searchHeight / 2);
    
    let searchData;
    try { searchData = hiddenCtx.getImageData(searchX, searchY, searchWidth, searchHeight); } catch(e) { return null; }

    let bestY = 0; let minDiff = Infinity;
    const tData = template.data; const sData = searchData.data;

    for (let y = 0; y <= searchHeight - box.h; y++) {
        let diff = 0;
        for (let row = 0; row < box.h; row += 2) {
            const tOffset = row * box.w * 4; const sOffset = (y + row) * searchWidth * 4;
            for (let col = 0; col < box.w; col += 2) {
                const tIdx = tOffset + col * 4; const sIdx = sOffset + col * 4;
                diff += Math.abs(tData[tIdx] - sData[sIdx]) +
                        Math.abs(tData[tIdx+1] - sData[sIdx+1]) +
                        Math.abs(tData[tIdx+2] - sData[sIdx+2]);
            }
        }
        if (diff < minDiff) { minDiff = diff; bestY = y; }
    }
    return searchY + bestY;
}

function processTrackingFrame() {
    if (!trackBox1 || !templateData1) return;
    hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

    // 1. Ejecutar escaneo para Tracker 1
    const newY1 = scanTemplateSAD(trackBox1, templateData1, lastTrackedY1, 60);
    if (newY1 !== null) {
        trackBox1.y = newY1;
        lastTrackedY1 = newY1 + trackBox1.h / 2;
    }

    // 2. Si el Tracker 2 está activo, ejecutar escaneo independiente
    if (trackBox2 && templateData2) {
        const newY2 = scanTemplateSAD(trackBox2, templateData2, lastTrackedY2, 90);
        if (newY2 !== null) {
            trackBox2.y = newY2;
            lastTrackedY2 = newY2 + trackBox2.h / 2;
        }

        // 3. FÓRMULA DE INTERSECCIÓN RELATIVA ENTRE AMBOS CORES
        const currentDistanceY = Math.abs(lastTrackedY2 - lastTrackedY1);
        
        // Delta de acercamiento: si la distancia disminuye, la inserción aumenta
        const deltaDistance = initialDistanceY - currentDistanceY;
        
        // Mapeo matemático fino sobre el rango calibrado de sensibilidad
        let rawPercent = 50 + Math.round((deltaDistance / (aiTrackingRange / 2)) * 50);
        let finalPosition = Math.max(0, Math.min(100, rawPercent));

        const timeMs = Math.floor(videoPlayer.currentTime * 1000);
        if (typeof window.saveHistoryState === 'function') {
            funscriptActions = funscriptActions.filter(act => Math.abs(act.at - timeMs) > 30);
            funscriptActions.push({ at: timeMs, pos: finalPosition, selected: false });
            funscriptActions.sort((a, b) => a.at - b.at);
        }
    }

    drawConfirmedBoxes();
}

if (videoPlayer) {
    videoPlayer.addEventListener('timeupdate', () => {
        if (!aiActive || videoPlayer.paused) return;
        processTrackingFrame();
    });
}

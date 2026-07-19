// ==========================================================================
// CEREBRO DE IA TRACKING V3.0: VECTORIAL 2D COMPLETO, ALTA VELOCIDAD Y REDIMENSIONADO
// ==========================================================================

const trackCanvas = document.getElementById('tracking-canvas');
const trackCtx = trackCanvas.getContext('2d');
const toggleAiBtn = document.getElementById('toggle-ai-btn');

const hiddenCanvas = document.createElement('canvas');
const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

let aiActive = false;
let isDrawingBox = false;
let isDraggingBox = null;   // 'T1' o 'T2'
let isResizingBox = null;   // 'T1' o 'T2'
let isDraggingSlider = null; // 'BASE' o 'CABEZA'
let boxStart = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };

// Estructuras 2D Vectoriales completas
let trackBox1 = null; let templateData1 = null; let lastTrackedX1 = 0; let lastTrackedY1 = 0;
let trackBox2 = null; let templateData2 = null; let lastTrackedX2 = 0; let lastTrackedY2 = 0;

let initialDistance2D = 0;
let aiTrackingRange = 160; 

window.aiSplitBase = 20;    
window.aiSplitCabeza = 70;  

toggleAiBtn?.addEventListener('click', () => {
    aiActive = !aiActive;
    if (aiActive) {
        toggleAiBtn.innerText = "🤖 Modo IA: CONFIGURAR";
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
    trackCanvas.width = videoPlayer.clientWidth; trackCanvas.height = videoPlayer.clientHeight;
    hiddenCanvas.width = videoPlayer.clientWidth; hiddenCanvas.height = videoPlayer.clientHeight;
}
window.addEventListener('resize', () => { if (aiActive) syncTrackingCanvasSize(); });

function clearTrackCanvas() { trackCtx.clearRect(0, 0, trackCanvas.width, trackCanvas.height); }

function getMouseCoordinates(e) {
    const rect = trackCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// INTERCEPTOR CLIC: Detectar si arrastra cuerpo, esquina de tamaño o regulador de líneas
trackCanvas.addEventListener('mousedown', (e) => {
    if (!aiActive) return;
    const pos = getMouseCoordinates(e);
    
    // 1. Barra de contornos anatómicos fijada al Tracker 1
    if (trackBox1) {
        const barX = trackBox1.x + trackBox1.w + 8;
        const barY = trackBox1.y + (trackBox1.h / 2) - (aiTrackingRange / 2);
        if (pos.x >= barX && pos.x <= barX + 14) {
            const clickPercent = 100 - Math.round(((pos.y - barY) / aiTrackingRange) * 100);
            if (Math.abs(clickPercent - window.aiSplitBase) < 8) { isDraggingSlider = 'BASE'; return; }
            if (Math.abs(clickPercent - window.aiSplitCabeza) < 8) { isDraggingSlider = 'CABEZA'; return; }
        }
    }

    // 2. DETECTOR DE REDIMENSIONADO: Clic en esquina inferior derecha (Margen de 12px)
    if (trackBox1 && Math.abs(pos.x - (trackBox1.x + trackBox1.w)) <= 12 && Math.abs(pos.y - (trackBox1.y + trackBox1.h)) <= 12) {
        isResizingBox = 'T1'; return;
    }
    if (trackBox2 && Math.abs(pos.x - (trackBox2.x + trackBox2.w)) <= 12 && Math.abs(pos.y - (trackBox2.y + trackBox2.h)) <= 12) {
        isResizingBox = 'T2'; return;
    }

    // 3. DETECTOR DE ARRASTRE CENTRAL: Mover posición de la caja
    if (trackBox1 && pos.x >= trackBox1.x && pos.x <= trackBox1.x + trackBox1.w && pos.y >= trackBox1.y && pos.y <= trackBox1.y + trackBox1.h) {
        isDraggingBox = 'T1'; dragOffset.x = pos.x - trackBox1.x; dragOffset.y = pos.y - trackBox1.y; return;
    }
    if (trackBox2 && pos.x >= trackBox2.x && pos.x <= trackBox2.x + trackBox2.w && pos.y >= trackBox2.y && pos.y <= trackBox2.y + trackBox2.h) {
        isDraggingBox = 'T2'; dragOffset.x = pos.x - trackBox2.x; dragOffset.y = pos.y - trackBox2.y; return;
    }

    boxStart.x = pos.x; boxStart.y = pos.y; isDrawingBox = true;
});

trackCanvas.addEventListener('mousemove', (e) => {
    const pos = getMouseCoordinates(e);

    // Ajustar divisores anatómicos con el ratón
    if (isDraggingSlider && trackBox1) {
        const barY = trackBox1.y + (trackBox1.h / 2) - (aiTrackingRange / 2);
        let pct = 100 - Math.round(((pos.y - barY) / aiTrackingRange) * 100);
        pct = Math.max(0, Math.min(100, pct));
        if (isDraggingSlider === 'BASE') window.aiSplitBase = Math.min(window.aiSplitCabeza - 4, pct);
        if (isDraggingSlider === 'CABEZA') window.aiSplitCabeza = Math.max(window.aiSplitBase + 4, pct);
        drawConfirmedBoxes(); return;
    }

    // NUEVO: Ejecutar Redimensionado de cajas en vivo con el ratón
    if (isResizingBox) {
        hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        if (isResizingBox === 'T1') {
            trackBox1.w = Math.max(16, pos.x - trackBox1.x); trackBox1.h = Math.max(16, pos.y - trackBox1.y);
            lastTrackedX1 = trackBox1.x + trackBox1.w / 2; lastTrackedY1 = trackBox1.y + trackBox1.h / 2;
            templateData1 = hiddenCtx.getImageData(trackBox1.x, trackBox1.y, trackBox1.w, trackBox1.h);
        } else {
            trackBox2.w = Math.max(16, pos.x - trackBox2.x); trackBox2.h = Math.max(16, pos.y - trackBox2.y);
            lastTrackedX2 = trackBox2.x + trackBox2.w / 2; lastTrackedY2 = trackBox2.y + trackBox2.h / 2;
            templateData2 = hiddenCtx.getImageData(trackBox2.x, trackBox2.y, trackBox2.w, trackBox2.h);
        }
        if (trackBox1 && trackBox2) initialDistance2D = Math.sqrt(Math.pow(lastTrackedX2 - lastTrackedX1, 2) + Math.pow(lastTrackedY2 - lastTrackedY1, 2));
        drawConfirmedBoxes(); return;
    }

    // Mover posición entera del cuadro
    if (isDraggingBox) {
        hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        if (isDraggingBox === 'T1') {
            trackBox1.x = pos.x - dragOffset.x; trackBox1.y = pos.y - dragOffset.y;
            lastTrackedX1 = trackBox1.x + trackBox1.w / 2; lastTrackedY1 = trackBox1.y + trackBox1.h / 2;
            templateData1 = hiddenCtx.getImageData(trackBox1.x, trackBox1.y, trackBox1.w, trackBox1.h);
        } else {
            trackBox2.x = pos.x - dragOffset.x; trackBox2.y = pos.y - dragOffset.y;
            lastTrackedX2 = trackBox2.x + trackBox2.w / 2; lastTrackedY2 = trackBox2.y + trackBox2.h / 2;
            templateData2 = hiddenCtx.getImageData(trackBox2.x, trackBox2.y, trackBox2.w, trackBox2.h);
        }
        if (trackBox1 && trackBox2) initialDistance2D = Math.sqrt(Math.pow(lastTrackedX2 - lastTrackedX1, 2) + Math.pow(lastTrackedY2 - lastTrackedY1, 2));
        drawConfirmedBoxes(); return;
    }

    if (!isDrawingBox) return;
    clearTrackCanvas(); drawConfirmedBoxes();
    trackCtx.strokeStyle = !trackBox1 ? '#2e5b88' : '#ff007f';
    trackCtx.lineWidth = 1.5; trackCtx.strokeRect(boxStart.x, boxStart.y, pos.x - boxStart.x, pos.y - boxStart.y);
});

trackCanvas.addEventListener('mouseup', () => {
    isDraggingSlider = null; isDraggingBox = null; isResizingBox = null;
    if (!isDrawingBox) return; isDrawingBox = false;
    
    const pos = getMouseCoordinates(event);
    const x = Math.min(boxStart.x, pos.x); const y = Math.min(boxStart.y, pos.y);
    const w = Math.abs(pos.x - boxStart.x); const h = Math.abs(pos.y - boxStart.y);

    if (w > 6 && h > 8) {
        hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        if (!trackBox1) {
            trackBox1 = { x, y, w, h }; lastTrackedX1 = x + w / 2; lastTrackedY1 = y + h / 2;
            templateData1 = hiddenCtx.getImageData(x, y, w, h);
        } else if (!trackBox2) {
            trackBox2 = { x, y, w, h }; lastTrackedX2 = x + w / 2; lastTrackedY2 = y + h / 2;
            templateData2 = hiddenCtx.getImageData(x, y, w, h);
            initialDistance2D = Math.sqrt(Math.pow(lastTrackedX2 - lastTrackedX1, 2) + Math.pow(lastTrackedY2 - lastTrackedY1, 2));
            toggleAiBtn.innerText = "🤖 IA ACTIVA: 2D VECTORIAL"; toggleAiBtn.style.background = "#059669";
        }
        drawConfirmedBoxes();
    }
});

function drawConfirmedBoxes() {
    clearTrackCanvas();
    if (trackBox1) {
        trackCtx.strokeStyle = '#2e5b88'; trackCtx.lineWidth = 2; trackCtx.strokeRect(trackBox1.x, trackBox1.y, trackBox1.w, trackBox1.h);
        // Tirador de tamaño en esquina inferior derecha
        trackCtx.fillStyle = '#ffffff'; trackCtx.fillRect(trackBox1.x + trackBox1.w - 5, trackBox1.y + trackBox1.h - 5, 5, 5);

        const barX = trackBox1.x + trackBox1.w + 8;
        const barY = trackBox1.y + (trackBox1.h / 2) - (aiTrackingRange / 2);
        const hBase = aiTrackingRange * (window.aiSplitBase / 100);
        const hCabeza = aiTrackingRange * ((100 - window.aiSplitCabeza) / 100);
        const hTronco = aiTrackingRange - hBase - hCabeza;

        trackCtx.fillStyle = 'rgba(16, 185, 129, 0.35)'; trackCtx.fillRect(barX, barY, 12, hCabeza);
        trackCtx.fillStyle = 'rgba(139, 92, 246, 0.35)'; trackCtx.fillRect(barX, barY + hCabeza, 12, hTronco);
        trackCtx.fillStyle = 'rgba(239, 68, 68, 0.35)'; trackCtx.fillRect(barX, barY + hCabeza + hTronco, 12, hBase);
        trackCtx.strokeStyle = '#94a3b8'; trackCtx.lineWidth = 1; trackCtx.strokeRect(barX, barY, 12, aiTrackingRange);
        
        trackCtx.strokeStyle = '#ffffff'; trackCtx.lineWidth = 2;
        trackCtx.beginPath(); trackCtx.moveTo(barX - 2, barY + hCabeza); trackCtx.lineTo(barX + 14, barY + hCabeza); trackCtx.stroke();
        trackCtx.beginPath(); trackCtx.moveTo(barX - 2, barY + hCabeza + hTronco); trackCtx.lineTo(barX + 14, barY + hCabeza + hTronco); trackCtx.stroke();
    }
    if (trackBox2) {
        trackCtx.strokeStyle = '#ff007f'; trackCtx.lineWidth = 2; trackCtx.strokeRect(trackBox2.x, trackBox2.y, trackBox2.w, trackBox2.h);
        trackCtx.fillStyle = '#ffffff'; trackCtx.fillRect(trackBox2.x + trackBox2.w - 5, trackBox2.y + trackBox2.h - 5, 5, 5);
    }
}

// NUEVO MOTOR 2D VECTORIAL DE BAJO CONSUMO (X e Y SIMULTÁNEOS CON VENTANA CERRADA ±16PX)
function scanTemplateSAD2D(box, template, searchXCenter, searchYCenter) {
    const radius = 16; // Radio de búsqueda inteligente local
    const searchX = Math.max(0, searchXCenter - box.w / 2 - radius);
    const searchY = Math.max(0, searchYCenter - box.h / 2 - radius);
    const searchWidth = box.w + radius * 2;
    const searchHeight = box.h + radius * 2;
    
    let searchData;
    try { searchData = hiddenCtx.getImageData(searchX, searchY, searchWidth, searchHeight); } catch(e) { return null; }

    let bestX = radius, bestY = radius; let minDiff = Infinity;
    const tData = template.data; const sData = searchData.data;
    const boxW = box.w; const boxH = box.h;

    // Escaneo bidimensional X / Y optimizado a saltos de paso 3 (Ultra-Rápido)
    for (let y = 0; y <= searchHeight - boxH; y += 3) {
        for (let x = 0; x <= searchWidth - boxW; x += 3) {
            let diff = 0;
            
            for (let row = 0; row < boxH; row += 4) { // Paso 4: Reduce lecturas de CPU un 1600%
                const tOffset = row * boxW * 4; const sOffset = (y + row) * searchWidth * 4;
                for (let col = 0; col < boxW; col += 4) {
                    const tIdx = tOffset + col * 4; const sIdx = sOffset + (x + col) * 4;
                    diff += Math.abs(tData[tIdx] - sData[sIdx]) + Math.abs(tData[tIdx+1] - sData[sIdx+1]);
                }
                if (diff > minDiff) break; // Corte anticipado si ya superó el mínimo
            }
            if (diff < minDiff) { minDiff = diff; bestX = x; bestY = y; }
        }
    }
    return { x: searchX + bestX, y: searchY + bestY };
}

function processTrackingFrame() {
    if (!trackBox1 || !templateData1) return;
    hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

    // Trackear Anclaje en 2D (X, Y)
    const newPos1 = scanTemplateSAD2D(trackBox1, templateData1, lastTrackedX1, lastTrackedY1);
    if (newPos1) { trackBox1.x = newPos1.x; trackBox1.y = newPos1.y; lastTrackedX1 = newPos1.x + trackBox1.w / 2; lastTrackedY1 = newPos1.y + trackBox1.h / 2; }

    // Trackear Objetivo Móvil en 2D (X, Y)
    if (trackBox2 && templateData2) {
        const newPos2 = scanTemplateSAD2D(trackBox2, templateData2, lastTrackedX2, lastTrackedY2);
        if (newPos2) { trackBox2.x = newPos2.x; trackBox2.y = newPos2.y; lastTrackedX2 = newPos2.x + trackBox2.w / 2; lastTrackedY2 = newPos2.y + trackBox2.h / 2; }

        // MATEMÁTICAS SIMÉTRICAS 2D VECTORIAL: Inmune a dobleces, giros o movimientos angulares
        const currentDistance2D = Math.sqrt(Math.pow(lastTrackedX2 - lastTrackedX1, 2) + Math.pow(lastTrackedY2 - lastTrackedY1, 2));
        const securityGap = (trackBox1.h + trackBox2.h) * 0.45;
        const boundedDistance = Math.max(securityGap, currentDistance2D);

        const deltaDistance = initialDistance2D - boundedDistance;
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
    videoPlayer.addEventListener('timeupdate', () => { if (aiActive && !videoPlayer.paused) processTrackingFrame(); });
}

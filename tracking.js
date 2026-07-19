// ==========================================================================
// CEREBRO DE IA TRACKING V3.5: MOTOR PIRAMIDAL 2D CON MORFOSIS ADAPTATIVA OLM
// ==========================================================================

const trackCanvas = document.getElementById('tracking-canvas');
const trackCtx = trackCanvas.getContext('2d');
const toggleAiBtn = document.getElementById('toggle-ai-btn');

const hiddenCanvas = document.createElement('canvas');
const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

let aiActive = false;
let isDrawingBox = false;
let isDraggingBox = null;   
let isResizingBox = null;   
let isDraggingSlider = null; 
let boxStart = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };

// Estructuras de Memoria de Buffers Planos de Grayscale
let trackBox1 = null; let grayTemplate1 = null; let lastTrackedX1 = 0; let lastTrackedY1 = 0;
let trackBox2 = null; let grayTemplate2 = null; let lastTrackedX2 = 0; let lastTrackedY2 = 0;

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
        trackBox1 = null; grayTemplate1 = null;
        trackBox2 = null; grayTemplate2 = null;
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

/**
 * FILTRO OPTIMIZADOR: Convierte una matriz RGBA de 4 bytes a un buffer plano Grayscale de 1 byte
 */
function makeGrayscaleBuffer(imageData) {
    const d = imageData.data;
    const len = d.length;
    const gBuffer = new Uint8Array(len / 4);
    let gIdx = 0;
    for (let i = 0; i < len; i += 4) {
        // Fórmula de luminancia de alta fidelidad
        gBuffer[gIdx++] = (d[i] * 299 + d[i+1] * 587 + d[i+2] * 114) / 1000;
    }
    return gBuffer;
}

// INTERCEPTOR INTERACTIVO DEL RATÓN (ARRASRE, TAMAÑO Y DESLIZADORES)
trackCanvas.addEventListener('mousedown', (e) => {
    if (!aiActive) return;
    const pos = getMouseCoordinates(e);
    
    if (trackBox1) {
        const barX = trackBox1.x + trackBox1.w + 8;
        const barY = trackBox1.y + (trackBox1.h / 2) - (aiTrackingRange / 2);
        if (pos.x >= barX && pos.x <= barX + 14) {
            const clickPercent = 100 - Math.round(((pos.y - barY) / aiTrackingRange) * 100);
            if (Math.abs(clickPercent - window.aiSplitBase) < 8) { isDraggingSlider = 'BASE'; return; }
            if (Math.abs(clickPercent - window.aiSplitCabeza) < 8) { isDraggingSlider = 'CABEZA'; return; }
        }
    }

    if (trackBox1 && Math.abs(pos.x - (trackBox1.x + trackBox1.w)) <= 14 && Math.abs(pos.y - (trackBox1.y + trackBox1.h)) <= 14) {
        isResizingBox = 'T1'; return;
    }
    if (trackBox2 && Math.abs(pos.x - (trackBox2.x + trackBox2.w)) <= 14 && Math.abs(pos.y - (trackBox2.y + trackBox2.h)) <= 14) {
        isResizingBox = 'T2'; return;
    }

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

    if (isDraggingSlider && trackBox1) {
        const barY = trackBox1.y + (trackBox1.h / 2) - (aiTrackingRange / 2);
        let pct = 100 - Math.round(((pos.y - barY) / aiTrackingRange) * 100);
        pct = Math.max(0, Math.min(100, pct));
        if (isDraggingSlider === 'BASE') window.aiSplitBase = Math.min(window.aiSplitCabeza - 4, pct);
        if (isDraggingSlider === 'CABEZA') window.aiSplitCabeza = Math.max(window.aiSplitBase + 4, pct);
        drawConfirmedBoxes(); return;
    }

    if (isResizingBox) {
        hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        if (isResizingBox === 'T1') {
            trackBox1.w = Math.max(20, pos.x - trackBox1.x); trackBox1.h = Math.max(20, pos.y - trackBox1.y);
            lastTrackedX1 = trackBox1.x + trackBox1.w / 2; lastTrackedY1 = trackBox1.y + trackBox1.h / 2;
            let rawData = hiddenCtx.getImageData(trackBox1.x, trackBox1.y, trackBox1.w, trackBox1.h);
            grayTemplate1 = makeGrayscaleBuffer(rawData);
        } else {
            trackBox2.w = Math.max(20, pos.x - trackBox2.x); trackBox2.h = Math.max(20, pos.y - trackBox2.y);
            lastTrackedX2 = trackBox2.x + trackBox2.w / 2; lastTrackedY2 = trackBox2.y + trackBox2.h / 2;
            let rawData = hiddenCtx.getImageData(trackBox2.x, trackBox2.y, trackBox2.w, trackBox2.h);
            grayTemplate2 = makeGrayscaleBuffer(rawData);
        }
        if (trackBox1 && trackBox2) initialDistance2D = Math.sqrt(Math.pow(lastTrackedX2 - lastTrackedX1, 2) + Math.pow(lastTrackedY2 - lastTrackedY1, 2));
        drawConfirmedBoxes(); return;
    }

    if (isDraggingBox) {
        hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        if (isDraggingBox === 'T1') {
            trackBox1.x = pos.x - dragOffset.x; trackBox1.y = pos.y - dragOffset.y;
            lastTrackedX1 = trackBox1.x + trackBox1.w / 2; lastTrackedY1 = trackBox1.y + trackBox1.h / 2;
            let rawData = hiddenCtx.getImageData(trackBox1.x, trackBox1.y, trackBox1.w, trackBox1.h);
            grayTemplate1 = makeGrayscaleBuffer(rawData);
        } else {
            trackBox2.x = pos.x - dragOffset.x; trackBox2.y = pos.y - dragOffset.y;
            lastTrackedX2 = trackBox2.x + trackBox2.w / 2; lastTrackedY2 = trackBox2.y + trackBox2.h / 2;
            let rawData = hiddenCtx.getImageData(trackBox2.x, trackBox2.y, trackBox2.w, trackBox2.h);
            grayTemplate2 = makeGrayscaleBuffer(rawData);
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
            let rawData = hiddenCtx.getImageData(x, y, w, h); grayTemplate1 = makeGrayscaleBuffer(rawData);
        } else if (!trackBox2) {
            trackBox2 = { x, y, w, h }; lastTrackedX2 = x + w / 2; lastTrackedY2 = y + h / 2;
            let rawData = hiddenCtx.getImageData(x, y, w, h); grayTemplate2 = makeGrayscaleBuffer(rawData);
            initialDistance2D = Math.sqrt(Math.pow(lastTrackedX2 - lastTrackedX1, 2) + Math.pow(lastTrackedY2 - lastTrackedY1, 2));
            toggleAiBtn.innerText = "🤖 IA ACTIVA: COARSE-TO-FINE"; toggleAiBtn.style.background = "#059669";
        }
        drawConfirmedBoxes();
    }
});

function drawConfirmedBoxes() {
    clearTrackCanvas();
    if (trackBox1) {
        trackCtx.strokeStyle = '#2e5b88'; trackCtx.lineWidth = 2; trackCtx.strokeRect(trackBox1.x, trackBox1.y, trackBox1.w, trackBox1.h);
        trackCtx.fillStyle = '#ffffff'; trackCtx.fillRect(trackBox1.x + trackBox1.w - 6, trackBox1.y + trackBox1.h - 6, 6, 6);

        const barX = trackBox1.x + trackBox1.w + 8;
        const barY = trackBox1.y + (trackBox1.h / 2) - (aiTrackingRange / 2);
        const hBase = aiTrackingRange * (window.aiSplitBase / 100);
        const hCabeza = aiTrackingRange * ((100 - window.aiSplitCabeza) / 100);
        const hTronco = aiTrackingRange - hBase - hCabeza;

        trackCtx.fillStyle = 'rgba(16, 185, 129, 0.35)'; trackCtx.fillRect(barX, barY, 14, hCabeza);
        trackCtx.fillStyle = 'rgba(139, 92, 246, 0.35)'; trackCtx.fillRect(barX, barY + hCabeza, 14, hTronco);
        trackCtx.fillStyle = 'rgba(239, 68, 68, 0.35)'; trackCtx.fillRect(barX, barY + hCabeza + hTronco, 14, hBase);
        trackCtx.strokeStyle = '#94a3b8'; trackCtx.lineWidth = 1; trackCtx.strokeRect(barX, barY, 14, aiTrackingRange);
        
        trackCtx.strokeStyle = '#ffffff'; trackCtx.lineWidth = 2;
        trackCtx.beginPath(); trackCtx.moveTo(barX - 2, barY + hCabeza); trackCtx.lineTo(barX + 16, barY + hCabeza); trackCtx.stroke();
        trackCtx.beginPath(); trackCtx.moveTo(barX - 2, barY + hCabeza + hTronco); trackCtx.lineTo(barX + 16, barY + hCabeza + hTronco); trackCtx.stroke();
    }
    if (trackBox2) {
        trackCtx.strokeStyle = '#ff007f'; trackCtx.lineWidth = 2; trackCtx.strokeRect(trackBox2.x, trackBox2.y, trackBox2.w, trackBox2.h);
        trackCtx.fillStyle = '#ffffff'; trackCtx.fillRect(trackBox2.x + trackBox2.w - 6, trackBox2.y + trackBox2.h - 6, 6, 6);
    }
}

/**
 * MOTOR ADV PIRAMIDAL COARSE-TO-FINE: Busca en 2D a pasos gigantes y luego refina a un píxel
 */
function scanTemplatePyramidal(box, currentGrayTemplate, searchXCenter, searchYCenter) {
    const radius = 45; // Amplio rango de captura lateral/vertical para poses extremas
    const searchX = Math.max(0, searchXCenter - box.w / 2 - radius);
    const searchY = Math.max(0, searchYCenter - box.h / 2 - radius);
    const searchWidth = box.w + radius * 2;
    const searchHeight = box.h + radius * 2;
    
    let fullSearchData;
    try { fullSearchData = hiddenCtx.getImageData(searchX, searchY, searchWidth, searchHeight); } catch(e) { return null; }
    const sGray = makeGrayscaleBuffer(fullSearchData);

    const boxW = box.w; const boxH = box.h;
    let minDiff = Infinity;
    let coarseBestX = radius, coarseBestY = radius;

    // FASE 1 (COARSE): Salta de 4 en 4 píxeles sobre la matriz plana (Ultra-Rápido, Cero consumo de CPU)
    for (let y = 0; y <= searchHeight - boxH; y += 4) {
        for (let x = 0; x <= searchWidth - boxW; x += 4) {
            let diff = 0;
            for (let row = 0; row < boxH; row += 4) {
                const tOffset = row * boxW; const sOffset = (y + row) * searchWidth;
                for (let col = 0; col < boxW; col += 4) {
                    diff += Math.abs(currentGrayTemplate[tOffset + col] - sGray[sOffset + (x + col)]);
                }
            }
            if (diff < minDiff) { minDiff = diff; coarseBestX = x; coarseBestY = y; }
        }
    }

    // FASE 2 (FINE): Ajuste fino pixel por pixel en una ventana cerrada alrededor del ganador
    let fineBestX = coarseBestX, fineBestY = coarseBestY;
    const fineRadius = 6;
    const startXFine = Math.max(0, coarseBestX - fineRadius);
    const endXFine = Math.min(searchWidth - boxW, coarseBestX + fineRadius);
    const startYFine = Math.max(0, coarseBestY - fineRadius);
    const endYFine = Math.min(searchHeight - boxH, coarseBestY + fineRadius);

    for (let y = startYFine; y <= endYFine; y++) {
        for (let x = startXFine; x <= endXFine; x++) {
            let diff = 0;
            for (let row = 0; row < boxH; row += 2) {
                const tOffset = row * boxW; const sOffset = (y + row) * searchWidth;
                for (let col = 0; col < boxW; col += 2) {
                    diff += Math.abs(currentGrayTemplate[tOffset + col] - sGray[sOffset + (x + col)]);
                }
            }
            if (diff < minDiff) { minDiff = diff; fineBestX = x; fineBestY = y; }
        }
    }

    const finalX = searchX + fineBestX;
    const finalY = searchY + fineBestY;

    // FASE 3 (MORFOSIS ADAPTATIVA): Actualiza evolutivamente la plantilla para amoldarse a curvas y diagonales
    try {
        const freshBoxData = hiddenCtx.getImageData(finalX, finalY, boxW, boxH);
        const freshGray = makeGrayscaleBuffer(freshBoxData);
        for (let i = 0; i < currentGrayTemplate.length; i++) {
            // Fusión de aprendizaje online (Tasa del 15% por fotograma)
            currentGrayTemplate[i] = currentGrayTemplate[i] * 0.85 + freshGray[i] * 0.15;
        }
    } catch(err) {}

    return { x: finalX, y: finalY };
}

function processTrackingFrame() {
    if (!trackBox1 || !grayTemplate1) return;
    hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

    // Trackear Core Masculino (Azul Mezclilla)
    const newPos1 = scanTemplatePyramidal(trackBox1, grayTemplate1, lastTrackedX1, lastTrackedY1);
    if (newPos1) { trackBox1.x = newPos1.x; trackBox1.y = newPos1.y; lastTrackedX1 = newPos1.x + trackBox1.w / 2; lastTrackedY1 = newPos1.y + trackBox1.h / 2; }

    // Trackear Core Femenino (Rosa Intenso)
    if (trackBox2 && grayTemplate2) {
        const newPos2 = scanTemplatePyramidal(trackBox2, grayTemplate2, lastTrackedX2, lastTrackedY2);
        if (newPos2) { trackBox2.x = newPos2.x; trackBox2.y = newPos2.y; lastTrackedX2 = newPos2.x + trackBox2.w / 2; lastTrackedY2 = newPos2.y + trackBox2.h / 2; }

        // Mapeo 2D robusto anti-dobleces
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

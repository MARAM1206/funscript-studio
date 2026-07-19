// ==========================================================================
// CEREBRO DE IA TRACKING V4.0: TRIPLE CORE CON ESTABILIZADOR DE CÁMARA ANTI-FUGAS
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

// Tracker 1: Hombre (Azul Mezclilla)
let trackBox1 = null; let grayTemplate1 = null; let lastTrackedX1 = 0; let lastTrackedY1 = 0; let baseMinDiff1 = 0;
// Tracker 2: Mujer (Rosa Intenso)
let trackBox2 = null; let grayTemplate2 = null; let lastTrackedX2 = 0; let lastTrackedY2 = 0; let baseMinDiff2 = 0;
// NUEVO Tracker 3: Estabilizador Escena/Fondo Inmóvil (Gris Ceniza)
let trackBox3 = null; let grayTemplate3 = null; let lastTrackedX3 = 0; let lastTrackedY3 = 0;

let initialDistance2D = 0;
let aiTrackingRange = 160; 

window.aiSplitBase = 20;    
window.aiSplitCabeza = 70;  

toggleAiBtn?.addEventListener('click', () => {
    aiActive = !aiActive;
    if (aiActive) {
        toggleAiBtn.innerText = "🤖 Configurar: Fije T1, T2 y T3";
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
        trackBox3 = null; grayTemplate3 = null;
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

function makeGrayscaleBuffer(imageData) {
    const d = imageData.data; const len = d.length;
    const gBuffer = new Uint8Array(len / 4); let gIdx = 0;
    for (let i = 0; i < len; i += 4) {
        gBuffer[gIdx++] = (d[i] * 299 + d[i+1] * 587 + d[i+2] * 114) / 1000;
    }
    return gBuffer;
}

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

    if (trackBox1 && Math.abs(pos.x - (trackBox1.x + trackBox1.w)) <= 14 && Math.abs(pos.y - (trackBox1.y + trackBox1.h)) <= 14) { isResizingBox = 'T1'; return; }
    if (trackBox2 && Math.abs(pos.x - (trackBox2.x + trackBox2.w)) <= 14 && Math.abs(pos.y - (trackBox2.y + trackBox2.h)) <= 14) { isResizingBox = 'T2'; return; }
    if (trackBox3 && Math.abs(pos.x - (trackBox3.x + trackBox3.w)) <= 14 && Math.abs(pos.y - (trackBox3.y + trackBox3.h)) <= 14) { isResizingBox = 'T3'; return; }

    if (trackBox1 && pos.x >= trackBox1.x && pos.x <= trackBox1.x + trackBox1.w && pos.y >= trackBox1.y && pos.y <= trackBox1.y + trackBox1.h) {
        isDraggingBox = 'T1'; dragOffset.x = pos.x - trackBox1.x; dragOffset.y = pos.y - trackBox1.y; return;
    }
    if (trackBox2 && pos.x >= trackBox2.x && pos.x <= trackBox2.x + trackBox2.w && pos.y >= trackBox2.y && pos.y <= trackBox2.y + trackBox2.h) {
        isDraggingBox = 'T2'; dragOffset.x = pos.x - trackBox2.x; dragOffset.y = pos.y - trackBox2.y; return;
    }
    if (trackBox3 && pos.x >= trackBox3.x && pos.x <= trackBox3.x + trackBox3.w && pos.y >= trackBox3.y && pos.y <= trackBox3.y + trackBox3.h) {
        isDraggingBox = 'T3'; dragOffset.x = pos.x - trackBox3.x; dragOffset.y = pos.y - trackBox3.y; return;
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
        let box = isResizingBox === 'T1' ? trackBox1 : (isResizingBox === 'T2' ? trackBox2 : trackBox3);
        box.w = Math.max(20, pos.x - box.x); box.h = Math.max(20, pos.y - box.y);
        
        let rawData = hiddenCtx.getImageData(box.x, box.y, box.w, box.h);
        if (isResizingBox === 'T1') { lastTrackedX1 = box.x + box.w / 2; lastTrackedY1 = box.y + box.h / 2; grayTemplate1 = makeGrayscaleBuffer(rawData); }
        if (isResizingBox === 'T2') { lastTrackedX2 = box.x + box.w / 2; lastTrackedY2 = box.y + box.h / 2; grayTemplate2 = makeGrayscaleBuffer(rawData); }
        if (isResizingBox === 'T3') { lastTrackedX3 = box.x + box.w / 2; lastTrackedY3 = box.y + box.h / 2; grayTemplate3 = makeGrayscaleBuffer(rawData); }
        
        if (trackBox1 && trackBox2) initialDistance2D = Math.sqrt(Math.pow(lastTrackedX2 - lastTrackedX1, 2) + Math.pow(lastTrackedY2 - lastTrackedY1, 2));
        drawConfirmedBoxes(); return;
    }

    if (isDraggingBox) {
        hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        let box = isDraggingBox === 'T1' ? trackBox1 : (isDraggingBox === 'T2' ? trackBox2 : trackBox3);
        box.x = pos.x - dragOffset.x; box.y = pos.y - dragOffset.y;
        
        let rawData = hiddenCtx.getImageData(box.x, box.y, box.w, box.h);
        if (isDraggingBox === 'T1') { lastTrackedX1 = box.x + box.w / 2; lastTrackedY1 = box.y + box.h / 2; grayTemplate1 = makeGrayscaleBuffer(rawData); }
        if (isDraggingBox === 'T2') { lastTrackedX2 = box.x + box.w / 2; lastTrackedY2 = box.y + box.h / 2; grayTemplate2 = makeGrayscaleBuffer(rawData); }
        if (isDraggingBox === 'T3') { lastTrackedX3 = box.x + box.w / 2; lastTrackedY3 = box.y + box.h / 2; grayTemplate3 = makeGrayscaleBuffer(rawData); }
        
        if (trackBox1 && trackBox2) initialDistance2D = Math.sqrt(Math.pow(lastTrackedX2 - lastTrackedX1, 2) + Math.pow(lastTrackedY2 - lastTrackedY1, 2));
        drawConfirmedBoxes(); return;
    }

    if (!isDrawingBox) return;
    clearTrackCanvas(); drawConfirmedBoxes();
    trackCtx.strokeStyle = !trackBox1 ? '#2e5b88' : (!trackBox2 ? '#ff007f' : '#64748b');
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
        let rawData = hiddenCtx.getImageData(x, y, w, h);
        
        if (!trackBox1) {
            trackBox1 = { x, y, w, h }; lastTrackedX1 = x + w / 2; lastTrackedY1 = y + h / 2; grayTemplate1 = makeGrayscaleBuffer(rawData);
        } else if (!trackBox2) {
            trackBox2 = { x, y, w, h }; lastTrackedX2 = x + w / 2; lastTrackedY2 = y + h / 2; grayTemplate2 = makeGrayscaleBuffer(rawData);
            initialDistance2D = Math.sqrt(Math.pow(lastTrackedX2 - lastTrackedX1, 2) + Math.pow(lastTrackedY2 - lastTrackedY1, 2));
        } else if (!trackBox3) {
            trackBox3 = { x, y, w, h }; lastTrackedX3 = x + w / 2; lastTrackedY3 = y + h / 2; grayTemplate3 = makeGrayscaleBuffer(rawData);
            toggleAiBtn.innerText = "🤖 TRIPLE CORE: CON COMPENSACIÓN"; toggleAiBtn.style.background = "#059669";
        }
        drawConfirmedBoxes();
    }
});

function drawConfirmedBoxes() {
    clearTrackCanvas();
    if (trackBox1) {
        trackCtx.strokeStyle = '#2e5b88'; trackCtx.lineWidth = 2; trackCtx.strokeRect(trackBox1.x, trackBox1.y, trackBox1.w, trackBox1.h);
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
    }
    if (trackBox2) {
        trackCtx.strokeStyle = '#ff007f'; trackCtx.lineWidth = 2; trackCtx.strokeRect(trackBox2.x, trackBox2.y, trackBox2.w, trackBox2.h);
        trackCtx.fillStyle = '#ffffff'; trackCtx.fillRect(trackBox2.x + trackBox2.w - 5, trackBox2.y + trackBox2.h - 5, 5, 5);
    }
    // NUEVO: Dibujado de Tracker Estabilizador (Gris)
    if (trackBox3) {
        trackCtx.strokeStyle = '#64748b'; trackCtx.lineWidth = 2; trackCtx.strokeRect(trackBox3.x, trackBox3.y, trackBox3.w, trackBox3.h);
        trackCtx.fillStyle = '#64748b'; trackCtx.font = '9px monospace'; trackCtx.fillText("T3: ESTABILIZADOR", trackBox3.x, trackBox3.y - 4);
    }
}

/**
 * MOTOR PIRAMIDAL CON ANÁLISIS DE CONFIANZA COARSE-TO-FINE
 */
function scanTemplatePyramidal(box, currentGrayTemplate, searchXCenter, searchYCenter) {
    const radius = 35; 
    const searchX = Math.max(0, searchXCenter - box.w / 2 - radius);
    const searchY = Math.max(0, searchYCenter - box.h / 2 - radius);
    const searchWidth = box.w + radius * 2; const searchHeight = box.h + radius * 2;
    
    let fullSearchData;
    try { fullSearchData = hiddenCtx.getImageData(searchX, searchY, searchWidth, searchHeight); } catch(e) { return null; }
    const sGray = makeGrayscaleBuffer(fullSearchData);

    const boxW = box.w; const boxH = box.h;
    let minDiff = Infinity; let coarseBestX = radius, coarseBestY = radius;

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

    let fineBestX = coarseBestX, fineBestY = coarseBestY;
    const fineRadius = 6;
    for (let y = Math.max(0, coarseBestY - fineRadius); y <= Math.min(searchHeight - boxH, coarseBestY + fineRadius); y++) {
        for (let x = Math.max(0, coarseBestX - fineRadius); x <= Math.min(searchWidth - boxW, coarseBestX + fineRadius); x++) {
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

    return { x: searchX + fineBestX, y: searchY + fineBestY, confidenceScore: minDiff };
}

function processTrackingFrame() {
    hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

    // 1. CALCULO DEL VECTOR DE MOVIMIENTO DE LA CÁMARA (TRACKER 3)
    let cameraDeltaX = 0;
    let cameraDeltaY = 0;
    
    if (trackBox3 && grayTemplate3) {
        const res3 = scanTemplatePyramidal(trackBox3, grayTemplate3, lastTrackedX3, lastTrackedY3);
        if (res3) {
            cameraDeltaX = res3.x - trackBox3.x;
            cameraDeltaY = res3.y - trackBox3.y;
            
            // Actualizar posición base de la escena
            trackBox3.x = res3.x; trackBox3.y = res3.y;
            lastTrackedX3 = res3.x + trackBox3.w / 2; lastTrackedY3 = res3.y + trackBox3.h / 2;
        }
    }

    // 2. PROCESAR TRACKER 1 CON COMPENSACIÓN Y PROTECCIÓN ANTI-FUGAS (FRENAR AL MONTE)
    if (trackBox1 && grayTemplate1) {
        // Desplazar el centro de búsqueda predictivo usando el vector de la cámara
        const predictedX1 = lastTrackedX1 + cameraDeltaX;
        const predictedY1 = lastTrackedY1 + cameraDeltaY;
        
        const res1 = scanTemplatePyramidal(trackBox1, grayTemplate1, predictedX1, predictedY1);
        
        if (baseMinDiff1 === 0 && res1) baseMinDiff1 = res1.confidenceScore;

        // PROTECCIÓN CRÍTICA: Si el error salta más de 2.5 veces el baseline, hay oclusión/deformación.
        // Forzamos a la caja a quedarse quita siguiendo solo a la cámara ("No te muevas").
        if (res1 && res1.confidenceScore > baseMinDiff1 * 2.5) {
            trackBox1.x += cameraDeltaX; trackBox1.y += cameraDeltaY;
        } else if (res1) {
            trackBox1.x = res1.x; trackBox1.y = res1.y;
            baseMinDiff1 = res1.confidenceScore; // Actualizar baseline evolutivo
            
            // Morfosis adaptativa suave (10%)
            try {
                const freshBox = hiddenCtx.getImageData(res1.x, res1.y, trackBox1.w, trackBox1.h);
                const freshGray = makeGrayscaleBuffer(freshBox);
                for (let i = 0; i < grayTemplate1.length; i++) {
                    grayTemplate1[i] = grayTemplate1[i] * 0.90 + freshGray[i] * 0.10;
                }
            } catch(e) {}
        }
        lastTrackedX1 = trackBox1.x + trackBox1.w / 2; lastTrackedY1 = trackBox1.y + trackBox1.h / 2;
    }

    // 3. PROCESAR TRACKER 2 CON COMPENSACIÓN COMPLETA
    if (trackBox2 && grayTemplate2) {
        const predictedX2 = lastTrackedX2 + cameraDeltaX;
        const predictedY2 = lastTrackedY2 + cameraDeltaY;
        
        const res2 = scanTemplatePyramidal(trackBox2, grayTemplate2, predictedX2, predictedY2);
        if (baseMinDiff2 === 0 && res2) baseMinDiff2 = res2.confidenceScore;

        if (res2 && res2.confidenceScore > baseMinDiff2 * 2.5) {
            trackBox2.x += cameraDeltaX; trackBox2.y += cameraDeltaY;
        } else if (res2) {
            trackBox2.x = res2.x; trackBox2.y = res2.y;
            baseMinDiff2 = res2.confidenceScore;
            try {
                const freshBox = hiddenCtx.getImageData(res2.x, res2.y, trackBox2.w, trackBox2.h);
                const freshGray = makeGrayscaleBuffer(freshBox);
                for (let i = 0; i < grayTemplate2.length; i++) {
                    grayTemplate2[i] = grayTemplate2[i] * 0.90 + freshGray[i] * 0.10;
                }
            } catch(e) {}
        }
        lastTrackedX2 = trackBox2.x + trackBox2.w / 2; lastTrackedY2 = trackBox2.y + trackBox2.h / 2;
    }

    // 4. GENERACIÓN VECTORIAL SIMÉTRICA DEL SCRIPT
    if (trackBox1 && trackBox2) {
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

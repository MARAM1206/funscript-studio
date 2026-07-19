// ==========================================================================
// CEREBRO DE IA TRACKING V2.5: SIMETRÍA TOTAL, REPOSICIONAMIENTO Y FIJACIÓN RATÓN
// ==========================================================================

const trackCanvas = document.getElementById('tracking-canvas');
const trackCtx = trackCanvas.getContext('2d');
const toggleAiBtn = document.getElementById('toggle-ai-btn');

const hiddenCanvas = document.createElement('canvas');
const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

let aiActive = false;
let isDrawingBox = false;
let isDraggingBox = null; // 'T1' o 'T2'
let isDraggingSlider = null; // 'BASE' o 'CABEZA'
let boxStart = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };

// Tracker 1: Hombre (Azul)
let trackBox1 = null; let templateData1 = null; let lastTrackedY1 = 0;
// Tracker 2: Mujer (Rosa)
let trackBox2 = null; let templateData2 = null; let lastTrackedY2 = 0;

let initialDistanceY = 0;
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

function clearTrackCanvas() { trackCtx.clearRect(0, 0, trackCanvas.width, trackCanvas.height); }

function getMouseCoordinates(e) {
    const rect = trackCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// INTERCEPTOR MOUSE: Detectar Arrastre, Reposicionamiento o Edición de Líneas
trackCanvas.addEventListener('mousedown', (e) => {
    if (!aiActive) return;
    const pos = getMouseCoordinates(e);
    
    // 1. Verificar si clickeó dentro de la Barra Calibradora de la derecha para ajustar Base/Cabeza con Mouse
    if (trackBox2) {
        const barX = trackBox2.x + trackBox2.w + 8;
        const barY = trackBox2.y + (trackBox2.h / 2) - (aiTrackingRange / 2);
        if (pos.x >= barX && pos.x <= barX + 16) {
            const clickPercent = 100 - Math.round(((pos.y - barY) / aiTrackingRange) * 100);
            if (Math.abs(clickPercent - window.aiSplitBase) < 8) { isDraggingSlider = 'BASE'; return; }
            if (Math.abs(clickPercent - window.aiSplitCabeza) < 8) { isDraggingSlider = 'CABEZA'; return; }
        }
    }

    // 2. Verificar si clickeó adentro de un cuadro existente para MOVERLO/CORREGIRLO
    if (trackBox1 && pos.x >= trackBox1.x && pos.x <= trackBox1.x + trackBox1.w && pos.y >= trackBox1.y && pos.y <= trackBox1.y + trackBox1.h) {
        isDraggingBox = 'T1'; dragOffset.x = pos.x - trackBox1.x; dragOffset.y = pos.y - trackBox1.y; return;
    }
    if (trackBox2 && pos.x >= trackBox2.x && pos.x <= trackBox2.x + trackBox2.w && pos.y >= trackBox2.y && pos.y <= trackBox2.y + trackBox2.h) {
        isDraggingBox = 'T2'; dragOffset.x = pos.x - trackBox2.x; dragOffset.y = pos.y - trackBox2.y; return;
    }

    // 3. Si no clickeó nada, dibuja un cuadro nuevo
    boxStart.x = pos.x; boxStart.y = pos.y; isDrawingBox = true;
});

trackCanvas.addEventListener('mousemove', (e) => {
    const pos = getMouseCoordinates(e);

    // Lógica A: Ajustar las líneas divisores con el arrastre del mouse
    if (isDraggingSlider && trackBox2) {
        const barY = trackBox2.y + (trackBox2.h / 2) - (aiTrackingRange / 2);
        let pct = 100 - Math.round(((pos.y - barY) / aiTrackingRange) * 100);
        pct = Math.max(0, Math.min(100, pct));
        
        if (isDraggingSlider === 'BASE') window.aiSplitBase = Math.min(window.aiSplitCabeza - 4, pct);
        if (isDraggingSlider === 'CABEZA') window.aiSplitCabeza = Math.max(window.aiSplitBase + 4, pct);
        drawConfirmedBoxes(); return;
    }

    // Lógica B: Mover/Corregir posición del tracker en caliente
    if (isDraggingBox) {
        hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        if (isDraggingBox === 'T1') {
            trackBox1.x = pos.x - dragOffset.x; trackBox1.y = pos.y - dragOffset.y;
            lastTrackedY1 = trackBox1.y + trackBox1.h / 2;
            templateData1 = hiddenCtx.getImageData(trackBox1.x, trackBox1.y, trackBox1.w, trackBox1.h);
        } else {
            trackBox2.x = pos.x - dragOffset.x; trackBox2.y = pos.y - dragOffset.y;
            lastTrackedY2 = trackBox2.y + trackBox2.h / 2;
            templateData2 = hiddenCtx.getImageData(trackBox2.x, trackBox2.y, trackBox2.w, trackBox2.h);
            initialDistanceY = Math.abs(lastTrackedY2 - lastTrackedY1); // Recalibrar distancia relativa
        }
        drawConfirmedBoxes(); return;
    }

    // Lógica C: Dibujar cuadro guía
    if (!isDrawingBox) return;
    clearTrackCanvas();
    drawConfirmedBoxes();
    
    trackCtx.strokeStyle = !trackBox1 ? '#38bdf8' : '#f43f5e';
    trackCtx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    trackCtx.strokeRect(boxStart.x, boxStart.y, pos.x - boxStart.x, pos.y - boxStart.y);
    ctx.setLineDash([]);
});

trackCanvas.addEventListener('mouseup', (e) => {
    isDraggingSlider = null; isDraggingBox = null;
    if (!isDrawingBox) return;
    isDrawingBox = false;
    
    const pos = getMouseCoordinates(e);
    const x = Math.min(boxStart.x, pos.x); const y = Math.min(boxStart.y, pos.y);
    const w = Math.abs(pos.x - boxStart.x); const h = Math.abs(pos.y - boxStart.y);

    if (w > 8 && h > 8) {
        hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        if (!trackBox1) {
            trackBox1 = { x, y, w, h }; lastTrackedY1 = y + h / 2;
            templateData1 = hiddenCtx.getImageData(x, y, w, h);
        } else if (!trackBox2) {
            trackBox2 = { x, y, w, h }; lastTrackedY2 = y + h / 2;
            templateData2 = hiddenCtx.getImageData(x, y, w, h);
            initialDistanceY = Math.abs(lastTrackedY2 - lastTrackedY1);
            toggleAiBtn.innerText = "🤖 IA ACTIVA: DOBLE NÚCLEO";
            toggleAiBtn.style.background = "#059669";
        }
        drawConfirmedBoxes();
    }
});

function drawConfirmedBoxes() {
    clearTrackCanvas();
    if (trackBox1) {
        trackCtx.strokeStyle = '#38bdf8'; trackCtx.lineWidth = 2; // HOMBRE = AZUL ELÉCTRICO
        trackCtx.strokeRect(trackBox1.x, trackBox1.y, trackBox1.w, trackBox1.h);
    }
    if (trackBox2) {
        trackCtx.strokeStyle = '#f43f5e'; trackCtx.lineWidth = 2; // MUJER = ROSA MAGENTA
        trackCtx.strokeRect(trackBox2.x, trackBox2.y, trackBox2.w, trackBox2.h);

        const barX = trackBox2.x + trackBox2.w + 8;
        const barY = trackBox2.y + (trackBox2.h / 2) - (aiTrackingRange / 2);
        
        const hBase = aiTrackingRange * (window.aiSplitBase / 100);
        const hCabeza = aiTrackingRange * ((100 - window.aiSplitCabeza) / 100);
        const hTronco = aiTrackingRange - hBase - hCabeza;

        trackCtx.fillStyle = 'rgba(16, 185, 129, 0.35)'; trackCtx.fillRect(barX, barY, 14, hCabeza); // Cabeza
        trackCtx.fillStyle = 'rgba(139, 92, 246, 0.35)'; trackCtx.fillRect(barX, barY + hCabeza, 14, hTronco); // Tronco
        trackCtx.fillStyle = 'rgba(239, 68, 68, 0.35)'; trackCtx.fillRect(barX, barY + hCabeza + hTronco, 14, hBase); // Base

        trackCtx.strokeStyle = '#94a3b8'; trackCtx.lineWidth = 1; trackCtx.strokeRect(barX, barY, 14, aiTrackingRange);
        
        // Pintar manillas horizontales interactivas para que el usuario sepa que puede arrastrarlas
        trackCtx.strokeStyle = '#ffffff'; trackCtx.lineWidth = 2;
        trackCtx.beginPath(); trackCtx.moveTo(barX - 2, barY + hCabeza); trackCtx.lineTo(barX + 16, barY + hCabeza); trackCtx.stroke();
        trackCtx.beginPath(); trackCtx.moveTo(barX - 2, barY + hCabeza + hTronco); trackCtx.lineTo(barX + 16, barY + hCabeza + hTronco); trackCtx.stroke();
    }
}

// OPTIMIZACIÓN QUIRÚRGICA DEL ÁREA DE BÚSQUEDA (ELIMINA LA LENTITUD POR COMPLETO)
function scanTemplateSAD(box, template, searchYCenter) {
    const searchWidth = box.w;
    const searchHeight = box.h + 24; // Ventana micro-ajustada (+/- 12px de predicción local local)
    const searchX = box.x;
    const searchY = Math.max(0, searchYCenter - searchHeight / 2);
    
    let searchData;
    try { searchData = hiddenCtx.getImageData(searchX, searchY, searchWidth, searchHeight); } catch(e) { return null; }

    let bestY = 0; let minDiff = Infinity;
    const tData = template.data; const sData = searchData.data;

    for (let y = 0; y <= searchHeight - box.h; y += 2) { // Sub-muestreo a pasos dobles para acelerar la CPU
        let diff = 0;
        for (let row = 0; row < box.h; row += 3) { // Salto de 3 filas para optimización extrema de la RTX
            const tOffset = row * box.w * 4; const sOffset = (y + row) * searchWidth * 4;
            for (let col = 0; col < box.w; col += 3) {
                const tIdx = tOffset + col * 4; const sIdx = sOffset + col * 4;
                diff += Math.abs(tData[tIdx] - sData[sIdx]) + Math.abs(tData[tIdx+1] - sData[sIdx+1]);
            }
        }
        if (diff < minDiff) { minDiff = diff; bestY = y; }
    }
    return searchY + bestY;
}

function processTrackingFrame() {
    if (!trackBox1 || !templateData1) return;
    hiddenCtx.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

    const newY1 = scanTemplateSAD(trackBox1, templateData1, lastTrackedY1);
    if (newY1 !== null) { trackBox1.y = newY1; lastTrackedY1 = newY1 + trackBox1.h / 2; }

    if (trackBox2 && templateData2) {
        const newY2 = scanTemplateSAD(trackBox2, templateData2, lastTrackedY2);
        if (newY2 !== null) { trackBox2.y = newY2; lastTrackedY2 = newY2 + trackBox2.h / 2; }

        // EVITAR CRUCES Y MEZCLAS EN 0% (COLISIÓN FÍSICA BLOQUEADA)
        // Si los centros colapsan a menos de la altura mínima combinada, fijamos una distancia mínima de seguridad
        const centersDistanceY = Math.abs(lastTrackedY2 - lastTrackedY1);
        const securityGap = (trackBox1.h + trackBox2.h) * 0.45;
        const boundedDistanceY = Math.max(securityGap, centersDistanceY);

        const deltaDistance = initialDistanceY - boundedDistanceY;
        
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

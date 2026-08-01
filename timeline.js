// ==========================================================================
// TIMELINE V12.0: PURIFICACIÓN DEL INYECTOR Y EMPUJE EN EL TIEMPO
// ==========================================================================

window.funscriptActions = window.funscriptActions || [];

function getSafeActions() {
    if (!window.funscriptActions || !Array.isArray(window.funscriptActions)) window.funscriptActions = [];
    return window.funscriptActions;
}

const canvas = document.getElementById('timeline-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const actionsLog = document.getElementById('actions-log');
const pointSlider = document.getElementById('point-slider');
const sliderValueDisplay = document.getElementById('slider-value-display');
const videoNode = document.getElementById('video-player');

let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;

let zoom = 1.0; 
let basePixelsPerMs = 0.05; 
let timelineTimeOffset = 0; 
let isSelecting = false;
let hasDraggedSelection = false; 
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;

function notifyCloud() { if (typeof window.triggerHandyUpdate === 'function') window.triggerHandyUpdate(); }

canvas?.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.shiftKey) {
        if (e.deltaY < 0) zoom *= 1.15; else zoom /= 1.15; 
        zoom = Math.max(0.1, Math.min(zoom, 15.0)); 
    } else {
        if (videoNode && videoNode.paused) {
            const visibleTimeMs = canvas.width / (basePixelsPerMs * zoom);
            const panStep = visibleTimeMs * 0.15; 
            if (e.deltaY < 0) timelineTimeOffset += panStep; else timelineTimeOffset -= panStep; 
        }
    }
    drawTimeline();
}, { passive: false });

window.addEventListener('videoPlay', () => { timelineTimeOffset = 0; drawTimeline(); });

// ARRASTRE DE PRESETS CON IMÁN DE ALTURA 5%
canvas?.addEventListener('dragover', (e) => {
    if (window.isDraggingPreset && window.timelineGhostPreset) {
        e.preventDefault(); 
        const pos = getMousePos(e);
        let hoverTimeMs = xToTime(pos.x);
        let hoverPosRaw = yToPos(pos.y);
        
        const snapDistMs = 250; 
        const actions = getSafeActions();
        for (let act of actions) {
            if (Math.abs(act.at - hoverTimeMs) < snapDistMs) { hoverTimeMs = act.at; break; }
        }
        
        let hoverPos = Math.round(hoverPosRaw / 5) * 5;
        const basePos = window.timelineGhostPreset[0].pos;
        window.timelineGhostDeltaPos = hoverPos - basePos;
        window.timelineGhostTimeMs = hoverTimeMs;
        drawTimeline();
    }
});

canvas?.addEventListener('dragleave', () => {
    if (window.isDraggingPreset) { window.timelineGhostTimeMs = null; drawTimeline(); }
});

canvas?.addEventListener('drop', (e) => {
    if (window.isDraggingPreset && window.timelineGhostPreset) {
        e.preventDefault();
        const pos = getMousePos(e);
        let dropTimeMs = window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : xToTime(pos.x);
        const deltaY = window.timelineGhostDeltaPos || 0;
        
        const presetDuration = window.timelineGhostPreset[window.timelineGhostPreset.length - 1].at;
        const endTimeMs = dropTimeMs + presetDuration;

        saveHistoryState();
        
        let actions = getSafeActions();
        window.funscriptActions = actions.filter(act => act.at < dropTimeMs || act.at > endTimeMs);
        window.funscriptActions.forEach(a => a.selected = false); 

        const newActions = window.timelineGhostPreset.map(act => ({
            at: dropTimeMs + act.at,
            pos: Math.max(0, Math.min(100, act.pos + deltaY)),
            selected: true 
        }));
        
        window.funscriptActions.push(...newActions);
        window.funscriptActions.sort((a, b) => a.at - b.at);
        
        window.isDraggingPreset = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
        
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
        drawTimeline(); notifyCloud();
    }
});

const sliderA = document.getElementById('min-slider'); const sliderB = document.getElementById('max-slider');
const dualFill = document.getElementById('dual-slider-fill'); const minLabel = document.getElementById('min-label'); const maxLabel = document.getElementById('max-label');

function updateDualSlider() {
    if (!sliderA || !sliderB) return;
    const valA = parseInt(sliderA.value, 10); const valB = parseInt(sliderB.value, 10);
    const currentMin = Math.min(valA, valB); const currentMax = Math.max(valA, valB);
    if (minLabel) minLabel.innerText = `⬇️ Mínimo: ${currentMin}%`; if (maxLabel) maxLabel.innerText = `⬆️ Máximo: ${currentMax}%`;
    if (dualFill) { dualFill.style.left = `${currentMin}%`; dualFill.style.width = `${currentMax - currentMin}%`; }
}
function blurSliders() { if (sliderA) sliderA.blur(); if (sliderB) sliderB.blur(); }
sliderA?.addEventListener('input', updateDualSlider); sliderB?.addEventListener('input', updateDualSlider);
sliderA?.addEventListener('change', blurSliders); sliderB?.addEventListener('change', blurSliders);
sliderA?.addEventListener('mouseup', blurSliders); sliderB?.addEventListener('mouseup', blurSliders); updateDualSlider(); 

// 🎯 RECEPTOR 1: EL INYECTOR SUPREMO (ARRIBA Y ABAJO)
window.addEventListener('injectPoint', function(e) {
    const actions = getSafeActions();
    const timeMs = (videoNode && videoNode.currentTime) ? Math.round(videoNode.currentTime * 1000) : 0;
    
    const valA = parseInt(sliderA?.value || '15', 10); const valB = parseInt(sliderB?.value || '85', 10);
    const currentMin = Math.min(valA, valB); const currentMax = Math.max(valA, valB);

    let pos = (e.detail.dir === 'up') ? currentMax : currentMin;

    saveHistoryState();
    const isPlaying = videoNode && !videoNode.paused;
    const hasSelection = actions.some(a => a.selected);

    // Si el video está en Pausa y tienes puntos seleccionados, se ajustan a ese tope mágico instantáneamente.
    if (!isPlaying && hasSelection) {
        actions.forEach(a => { if (a.selected) a.pos = pos; });
    } 
    // Si el video Corre o no hay nada seleccionado, inyectamos a la fuerza
    else {
        actions.forEach(a => { a.selected = false; }); 
        const existingIdx = actions.findIndex(a => a.at === timeMs);
        if (existingIdx !== -1) { 
            actions[existingIdx].pos = pos; 
            actions[existingIdx].selected = false; 
        } 
        else {
            actions.push({ at: timeMs, pos: pos, selected: false });
        }
    }
    
    actions.sort((a, b) => a.at - b.at);
    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
    drawTimeline(); notifyCloud(); 
});

// 🎯 RECEPTOR 2: EMPUJE DE TIEMPO (IZQUIERDA Y DERECHA)
window.addEventListener('nudgeTime', function(e) {
    const actions = getSafeActions(); const dir = e.detail; let moved = false;
    saveHistoryState();
    
    actions.forEach(act => {
        if (act.selected) {
            if (dir === 'left') act.at = Math.max(0, act.at - 50); 
            if (dir === 'right') act.at = act.at + 50; 
            moved = true;
        }
    });

    if (moved) {
        actions.sort((a, b) => a.at - b.at);
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
        drawTimeline(); notifyCloud(); 
    }
});

window.addEventListener('magnetPoint', function() {
    const actions = getSafeActions();
    const timeMs = (videoNode && videoNode.currentTime) ? Math.round(videoNode.currentTime * 1000) : 0;
    let moved = false; saveHistoryState();
    actions.forEach(act => { if (act.selected) { act.at = timeMs; moved = true; } });
    if (moved) {
        actions.sort((a, b) => a.at - b.at);
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
        drawTimeline(); notifyCloud();
    }
});

function ensureCanvasSize() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
        canvas.width = parent.clientWidth; canvas.height = parent.clientHeight;
        if (typeof window.calculateAdaptiveZoom === 'function') window.calculateAdaptiveZoom();
    }
}
window.calculateAdaptiveZoom = function() {
    if (!canvas || !videoNode) return;
    if (videoNode.duration && videoNode.duration > 0) { const timeWindow = Math.min(videoNode.duration * 1000, 25000); basePixelsPerMs = (canvas.width - 60) / timeWindow; } 
    else { basePixelsPerMs = 0.05; }
};

function saveHistoryState() { undoStack.push(JSON.stringify(getSafeActions())); if (undoStack.length > MAX_HISTORY) undoStack.shift(); redoStack = []; }
function undo() {
    if (undoStack.length > 0) {
        redoStack.push(JSON.stringify(getSafeActions())); window.funscriptActions = JSON.parse(undoStack.pop());
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog(); notifyCloud(); 
    }
}
function redo() {
    if (redoStack.length > 0) {
        undoStack.push(JSON.stringify(getSafeActions())); window.funscriptActions = JSON.parse(redoStack.pop());
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog(); notifyCloud(); 
    }
}
function timeToX(timeMs) {
    const centerFixedX = canvas.width / 2;
    const actualVideoTimeMs = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
    const screenCenterTime = actualVideoTimeMs + timelineTimeOffset;
    return centerFixedX + (timeMs - screenCenterTime) * (basePixelsPerMs * zoom);
}
function xToTime(x) {
    const centerFixedX = canvas.width / 2;
    const actualVideoTimeMs = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
    const screenCenterTime = actualVideoTimeMs + timelineTimeOffset;
    return screenCenterTime + (x - centerFixedX) / (basePixelsPerMs * zoom);
}
function posToY(pos) { const padding = 20; const usableHeight = canvas.height - (padding * 2); return canvas.height - padding - (pos / 100) * usableHeight; }
function yToPos(y) { const padding = 20; const usableHeight = canvas.height - (padding * 2); const rawPos = ((canvas.height - padding - y) / usableHeight) * 100; return Math.max(0, Math.min(100, Math.round(rawPos))); }

function drawTimeline() {
    try {
        ensureCanvasSize();
        if (!ctx || !canvas) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#06090e'; ctx.fillRect(0, 0, canvas.width, canvas.height);

        const y100 = posToY(100); const y70 = posToY(70); const y20 = posToY(20); const y0 = posToY(0);
        ctx.fillStyle = 'rgba(236, 72, 153, 0.08)'; ctx.fillRect(0, y100, canvas.width, y70 - y100);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.05)'; ctx.fillRect(0, y70, canvas.width, y20 - y70);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.08)'; ctx.fillRect(0, y20, canvas.width, y0 - y20);

        ctx.lineWidth = 2; ctx.setLineDash([5, 5]); 
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.8)'; ctx.beginPath(); ctx.moveTo(0, y70); ctx.lineTo(canvas.width, y70); ctx.stroke();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)'; ctx.beginPath(); ctx.moveTo(0, y20); ctx.lineTo(canvas.width, y20); ctx.stroke();
        ctx.setLineDash([]); 

        ctx.lineWidth = 1;
        [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(p => {
            const y = posToY(p); ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            ctx.fillStyle = '#475569'; ctx.font = '10px monospace'; ctx.fillText(`${p}%`, 6, y - 3);
        });

        if (window.loadedFunscriptTracks && window.loadedFunscriptTracks.length > 0) {
            window.loadedFunscriptTracks.forEach(track => {
                if (track.visible && !track.isPrimary && track.actions && track.actions.length > 0) {
                    ctx.lineWidth = 2; ctx.strokeStyle = track.color + '88'; ctx.beginPath();
                    track.actions.forEach((act, index) => { const x = timeToX(act.at); const y = posToY(act.pos); if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
                    ctx.stroke();
                    track.actions.forEach(act => { const x = timeToX(act.at); if (x >= -20 && x <= canvas.width + 20) { const y = posToY(act.pos); ctx.fillStyle = track.color; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); } });
                }
            });
        }

        const actions = getSafeActions();
        if (actions.length > 0) {
            ctx.lineWidth = 3; ctx.strokeStyle = '#38bdf8'; ctx.beginPath();
            actions.forEach((act, index) => { const x = timeToX(act.at); const y = posToY(act.pos); if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
            ctx.stroke();
            actions.forEach(act => {
                const x = timeToX(act.at);
                if (x >= -20 && x <= canvas.width + 20) {
                    const y = posToY(act.pos); ctx.fillStyle = act.selected ? '#f59e0b' : '#38bdf8';
                    ctx.beginPath(); ctx.arc(x, y, act.selected ? 7 : 5, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
                }
            });
        }

        // FANTASMA DE PRESETS (CON DESPLAZAMIENTO VERTICAL)
        if (window.isDraggingPreset && window.timelineGhostPreset && window.timelineGhostTimeMs !== null) {
            const deltaY = window.timelineGhostDeltaPos || 0;
            ctx.lineWidth = 3; 
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)'; 
            ctx.beginPath();
            window.timelineGhostPreset.forEach((act, index) => {
                const x = timeToX(window.timelineGhostTimeMs + act.at);
                const y = posToY(Math.max(0, Math.min(100, act.pos + deltaY))); 
                if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();

            window.timelineGhostPreset.forEach(act => {
                const x = timeToX(window.timelineGhostTimeMs + act.at);
                const y = posToY(Math.max(0, Math.min(100, act.pos + deltaY)));
                ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
                ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
            });
        }

        if (isSelecting) {
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.fillRect(startX, startY, currentX - startX, currentY - startY); ctx.strokeRect(startX, startY, currentX - startX, currentY - startY); ctx.setLineDash([]);
        }

        const actualVideoTimeMs = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
        const playheadX = timeToX(actualVideoTimeMs);
        
        ctx.lineWidth = 2; ctx.strokeStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(playheadX, 0); ctx.lineTo(playheadX, canvas.height); ctx.stroke();
        ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(playheadX - 6, 0); ctx.lineTo(playheadX + 6, 0); ctx.lineTo(playheadX, 8); ctx.closePath(); ctx.fill();

        if (videoNode && videoNode.paused) {
            actions.forEach(act => {
                const px = timeToX(act.at);
                if (Math.abs(px - playheadX) <= 4) {
                    const py = posToY(act.pos);
                    let tooltipX = px + 8; let tooltipY = py - 18;
                    if (tooltipY < 5) tooltipY = py + 8;
                    ctx.fillStyle = 'rgba(11, 15, 23, 0.85)'; ctx.fillRect(tooltipX, tooltipY, 34, 16);
                    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1; ctx.strokeRect(tooltipX, tooltipY, 34, 16);
                    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 10px monospace'; ctx.fillText(`${act.pos}%`, tooltipX + 4, tooltipY + 12);
                }
            });
        }
    } catch (err) {}
}

window.updateActionsLog = function() {
    if (!actionsLog) return;
    const actions = getSafeActions();
    if (actions.length === 0) { actionsLog.innerHTML = '<span class="empty-log">Sin puntos registrados aún</span>'; return; }
    const latestActions = [...actions].reverse().slice(0, 8);
    actionsLog.innerHTML = latestActions.map(act => `<div style="margin-bottom: 2px;">⏱️ <strong>${(act.at / 1000).toFixed(2)}s</strong> -> Pos: <span style="color:#38bdf8">${act.pos}%</span></div>`).join('');
};

window.syncSliderWithSelection = function() {
    if (!pointSlider) return;
    const actions = getSafeActions();
    const selected = actions.filter(act => act.selected);
    if (selected.length > 0) {
        const lastSelected = selected[selected.length - 1];
        pointSlider.value = lastSelected.pos;
        if (sliderValueDisplay) sliderValueDisplay.innerText = `${lastSelected.pos}%`;
    }
};

pointSlider?.addEventListener('change', function() {
    const val = parseInt(this.value, 10);
    if (sliderValueDisplay) sliderValueDisplay.innerText = `${val}%`;
    const actions = getSafeActions();
    const selected = actions.filter(act => act.selected);
    if (selected.length > 0) {
        saveHistoryState();
        selected.forEach(act => act.pos = val); 
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog(); notifyCloud(); 
    }
});

function getMousePos(e) { const rect = canvas.getBoundingClientRect(); return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) }; }

let isDraggingNode = false; let draggedNode = null;

canvas?.addEventListener('mousedown', (e) => {
    const actions = getSafeActions();
    const pos = getMousePos(e);
    const clickX = pos.x; const clickY = pos.y;

    if (e.button === 0) { 
        let clickedNode = null;
        for (let act of actions) {
            const nx = timeToX(act.at); const ny = posToY(act.pos);
            if (Math.hypot(clickX - nx, clickY - ny) <= 8) { clickedNode = act; break; }
        }

        if (clickedNode) {
            saveHistoryState();
            if (!e.ctrlKey && !clickedNode.selected) actions.forEach(a => a.selected = false);
            clickedNode.selected = true; isDraggingNode = true; draggedNode = clickedNode;
            if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        } else {
            if (!e.ctrlKey) actions.forEach(a => a.selected = false);
            isSelecting = true; hasDraggedSelection = false; 
            startX = clickX; startY = clickY; currentX = clickX; currentY = clickY;
        }
    } else if (e.button === 2) { 
        e.preventDefault(); saveHistoryState();
        window.funscriptActions = actions.filter(act => Math.hypot(clickX - timeToX(act.at), clickY - posToY(act.pos)) > 10);
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog(); notifyCloud(); 
    }
});

canvas?.addEventListener('mousemove', (e) => {
    const actions = getSafeActions();
    const pos = getMousePos(e);
    const mouseX = pos.x; const mouseY = pos.y;

    if (isDraggingNode && draggedNode) {
        draggedNode.pos = yToPos(mouseY); 
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    } else if (isSelecting) {
        currentX = mouseX; currentY = mouseY;
        if (Math.hypot(currentX - startX, currentY - startY) > 5) hasDraggedSelection = true;
        const minX = Math.min(startX, currentX); const maxX = Math.max(startX, currentX);
        const minY = Math.min(startY, currentY); const maxY = Math.max(startY, currentY);
        actions.forEach(act => {
            const nx = timeToX(act.at); const ny = posToY(act.pos);
            act.selected = (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY);
        });
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    }
});

window.addEventListener('mouseup', (e) => {
    const actions = getSafeActions();
    if (isSelecting && !hasDraggedSelection && e.target === canvas) {
        const clickTime = Math.max(0, Math.round(xToTime(startX)));
        const clickPos = yToPos(startY);
        saveHistoryState();
        actions.push({ at: clickTime, pos: clickPos, selected: true });
        actions.sort((a, b) => a.at - b.at);
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog(); notifyCloud(); 
    } else if (isDraggingNode || hasDraggedSelection) { notifyCloud(); }
    isDraggingNode = false; draggedNode = null; isSelecting = false;
});

canvas?.addEventListener('contextmenu', e => e.preventDefault());
function animationLoop() { drawTimeline(); requestAnimationFrame(animationLoop); }
requestAnimationFrame(animationLoop);

window.addEventListener('keydown', (e) => {
    const actions = getSafeActions();
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'a') { e.preventDefault(); actions.forEach(a => a.selected = true); if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection(); }
    if (e.key === 'Delete' || e.key === 'Backspace') { 
        saveHistoryState(); window.funscriptActions = actions.filter(a => !a.selected); 
        if (typeof window.updateActionsLog === 'function') window.updateActionsLog(); notifyCloud(); 
    }
});

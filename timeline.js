// ==========================================================================
// TIMELINE V28.0: AUTO-SELECCIÓN DE AGUJA Y LÍMITES FAPTAP CORRECTOS
// ==========================================================================

window.funscriptActions = window.funscriptActions || [];

function getSafeActions() {
    if (!window.funscriptActions || !Array.isArray(window.funscriptActions)) window.funscriptActions = [];
    return window.funscriptActions;
}

const canvas = document.getElementById('timeline-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const pointSlider = document.getElementById('point-slider');
const sliderValueDisplay = document.getElementById('slider-value-display');
const videoNode = document.getElementById('video-player');

let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;

let zoom = 1.0; 
let basePixelsPerMs = 0.1; 
let scrollLeftMs = 0; 

let isSelecting = false;
let hasDraggedSelection = false; 
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;

let isDraggingNode = false; 
let draggedNodeIndex = -1; 
let dragSelectionInitialStates = [];
let dragStartXTime = 0;
let dragStartYPos = 0;
window.magneticSnapPoint = null;
window.startMagneticSnapPoint = null;
let hadSelectionBeforeMousedown = false; 

function notifyCloud() { if (typeof window.triggerHandyUpdate === 'function') window.triggerHandyUpdate(); }

function cleanDuplicates() {
    const actions = getSafeActions();
    actions.sort((a, b) => a.at - b.at);
    for (let i = actions.length - 1; i > 0; i--) {
        if (actions[i].at === actions[i-1].at) {
            actions.splice(actions[i].selected ? i-1 : i, 1);
        }
    }
}

// 🎯 RADAR DE AGUJA (Auto-Selección si el ratón no está seleccionando nada)
function getPointUnderPlayhead(actions) {
    const timeMs = (videoNode && videoNode.currentTime) ? Math.round(videoNode.currentTime * 1000) : 0;
    let closest = null; 
    let minDiff = 50; // Tolerancia de 50 milisegundos
    actions.forEach(act => {
        const diff = Math.abs(act.at - timeMs);
        if (diff <= minDiff) { minDiff = diff; closest = act; }
    });
    return closest;
}

// ==========================================================================
// 📊 MOTOR DE TELEMETRÍA CORREGIDO (LÍMITES FAPTAP EXACTOS)
// ==========================================================================
window.updateHeatmapAndStats = function() {
    const actions = getSafeActions();
    
    const statsSpan = document.getElementById('timeline-stats');
    if (statsSpan) {
        let speedText = "--";
        if (actions.length > 1) {
            let totalIntervalMs = 0;
            let validIntervals = 0;
            
            for (let i = 1; i < actions.length; i++) {
                const deltaT = actions[i].at - actions[i-1].at;
                if (deltaT > 0 && deltaT < 2500) { 
                    totalIntervalMs += deltaT;
                    validIntervals++;
                }
            }
            
            if (validIntervals > 0) {
                const avgInterval = totalIntervalMs / validIntervals;
                const spm = Math.round(60000 / avgInterval); 
                
                // 🎯 LIMITES CORREGIDOS: Slow (0-150), Medium (151-300), Fast (301-500), Very Fast (500+)
                if (spm >= 501) speedText = `Very Fast 🔴 (${spm})`;
                else if (spm >= 301) speedText = `Fast 🟠 (${spm})`;
                else if (spm >= 151) speedText = `Medium 🟡 (${spm})`; 
                else speedText = `Slow 🟢 (${spm})`;
            } else {
                speedText = `Slow 🟢 (0)`;
            }
        } else if (actions.length === 1) {
            speedText = "Slow 🟢 (0)";
        }
        
        statsSpan.innerHTML = `Puntos: <strong>${actions.length}</strong> &nbsp;|&nbsp; Velocidad: <strong>${speedText}</strong>`;
    }

    const hCanvas = document.getElementById('heatmap-canvas');
    if (!hCanvas) return;
    
    let totalDurationMs = 0;
    if (videoNode && videoNode.duration) {
        totalDurationMs = videoNode.duration * 1000;
    } else if (actions.length > 0) {
        totalDurationMs = actions[actions.length - 1].at;
    }

    if (totalDurationMs === 0 || actions.length === 0) {
        const hCtx = hCanvas.getContext('2d');
        hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);
        return;
    }

    const rect = hCanvas.getBoundingClientRect();
    if(rect.width === 0) return; 
    if (hCanvas.width !== rect.width) hCanvas.width = rect.width;
    
    const hCtx = hCanvas.getContext('2d');
    hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);

    const bucketCount = 200; 
    const bucketDuration = totalDurationMs / bucketCount;
    const buckets = new Array(bucketCount).fill(0);

    actions.forEach((act, idx) => {
        const b = Math.floor(act.at / bucketDuration);
        if (b >= 0 && b < bucketCount) {
            if (idx > 0) { buckets[b] += Math.abs(act.pos - actions[idx-1].pos); } 
            else { buckets[b] += 50; }
        }
    });

    const smoothedBuckets = new Array(bucketCount).fill(0);
    for (let i = 0; i < bucketCount; i++) {
        let sum = buckets[i]; let count = 1;
        if (i > 0) { sum += buckets[i-1]; count++; }
        if (i < bucketCount - 1) { sum += buckets[i+1]; count++; }
        smoothedBuckets[i] = sum / count; 
    }

    const sortedBuckets = [...smoothedBuckets].sort((a,b) => a-b);
    const maxDistance = sortedBuckets[Math.floor(bucketCount * 0.95)] || 1; 
    
    const bucketWidth = hCanvas.width / bucketCount;
    
    for (let i = 0; i < bucketCount; i++) {
        if (smoothedBuckets[i] > 0) {
            const intensity = Math.min(1.0, 0.2 + (0.8 * (smoothedBuckets[i] / maxDistance)));
            const hue = (1 - intensity) * 200; 
            hCtx.fillStyle = `hsla(${hue}, 100%, 50%, ${Math.max(0.4, intensity)})`;
            hCtx.fillRect(i * bucketWidth, 0, Math.ceil(bucketWidth) + 1, hCanvas.height);
        }
    }
};

const originalUpdateActionsLog = window.updateActionsLog;
window.updateActionsLog = function() {
    if (typeof originalUpdateActionsLog === 'function') originalUpdateActionsLog();
    window.updateHeatmapAndStats();
};

canvas?.addEventListener('wheel', (e) => {
    e.preventDefault();
    const mouseX = e.clientX - canvas.getBoundingClientRect().left;
    
    if (e.shiftKey) {
        const timeAtMouse = xToTime(mouseX);
        if (e.deltaY < 0) zoom *= 1.15; else zoom /= 1.15; 
        zoom = Math.max(0.1, Math.min(zoom, 15.0)); 
        
        scrollLeftMs = timeAtMouse - (mouseX - 30) / (basePixelsPerMs * zoom);
        if (scrollLeftMs < 0) scrollLeftMs = 0; 
    } else {
        if (videoNode && videoNode.paused) {
            const visibleMs = (canvas.width - 30) / (basePixelsPerMs * zoom);
            const panStep = visibleMs * 0.10; 
            
            if (e.deltaY < 0) scrollLeftMs += panStep; 
            else scrollLeftMs -= panStep; 
            
            if (scrollLeftMs < 0) scrollLeftMs = 0;
            if (videoNode.duration) {
                const maxScroll = (videoNode.duration * 1000) - visibleMs + 2000; 
                if (scrollLeftMs > maxScroll && maxScroll > 0) scrollLeftMs = maxScroll;
            }
        }
    }
    drawTimeline();
}, { passive: false });

window.addEventListener('videoPlay', () => { drawTimeline(); });

window.addEventListener('forceTimelinePan', () => {
    const actualTime = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
    const visibleMs = (canvas.width - 30) / (basePixelsPerMs * zoom);
    scrollLeftMs = actualTime - (visibleMs / 2);
    if (scrollLeftMs < 0) scrollLeftMs = 0;
    drawTimeline();
});

// ARRASTRE DE PRESETS
canvas?.addEventListener('dragover', (e) => {
    if (window.isDraggingPreset && window.timelineGhostPreset) {
        e.preventDefault(); 
        const pos = getMousePos(e);
        let hoverTimeMs = xToTime(pos.x);
        let hoverPosRaw = yToPos(pos.y);
        
        const snapDistMs = 350; 
        const actions = getSafeActions();
        const actualTimeMs = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
        
        const snapTargets = [actualTimeMs, ...actions.map(a => a.at)];
        const presetDuration = window.timelineGhostPreset[window.timelineGhostPreset.length - 1].at;
        const presetMid = presetDuration / 2; 

        let bestSnapTime = hoverTimeMs;
        let minDistance = snapDistMs;

        snapTargets.forEach(target => {
            let distStart = Math.abs(hoverTimeMs - target);
            if (distStart < minDistance) { minDistance = distStart; bestSnapTime = target; }
            let distMid = Math.abs((hoverTimeMs + presetMid) - target);
            if (distMid < minDistance) { minDistance = distMid; bestSnapTime = target - presetMid; }
            let distEnd = Math.abs((hoverTimeMs + presetDuration) - target);
            if (distEnd < minDistance) { minDistance = distEnd; bestSnapTime = target - presetDuration; }
        });

        if (bestSnapTime < 0) bestSnapTime = 0;
        hoverTimeMs = bestSnapTime;
        
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
        let dropTimeMs = window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : Math.max(0, xToTime(pos.x));
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
        cleanDuplicates(); 
        
        window.isDraggingPreset = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
        
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        drawTimeline(); notifyCloud(); window.updateHeatmapAndStats();
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

window.addEventListener('injectPoint', function(e) {
    const actions = getSafeActions();
    const timeMs = (videoNode && videoNode.currentTime) ? Math.round(videoNode.currentTime * 1000) : 0;
    
    const valA = parseInt(sliderA?.value || '15', 10); const valB = parseInt(sliderB?.value || '85', 10);
    const currentMin = Math.min(valA, valB); const currentMax = Math.max(valA, valB);
    let pos = (e.detail.dir === 'up') ? currentMax : currentMin;

    saveHistoryState();
    actions.forEach(a => { a.selected = false; }); 
    
    const existingIdx = actions.findIndex(a => a.at === timeMs);
    if (existingIdx !== -1) { 
        actions[existingIdx].pos = pos; 
        actions[existingIdx].selected = false; 
    } 
    else { 
        actions.push({ at: timeMs, pos: pos, selected: false }); 
    }
    
    cleanDuplicates();
    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    drawTimeline(); notifyCloud(); window.updateHeatmapAndStats();
});

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
        cleanDuplicates();
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        drawTimeline(); notifyCloud(); 
    }
});

// 🎯 RECEPTOR CONECTADO AL RADAR DE LA AGUJA
window.addEventListener('nudgePoints', function(e) {
    const actions = getSafeActions(); const dir = e.detail; let moved = false;
    saveHistoryState();
    
    let hasSelection = actions.some(a => a.selected);
    if (!hasSelection) {
        const closest = getPointUnderPlayhead(actions);
        if (closest) closest.selected = true; // El Radar seleccionó el punto automáticamente
    }

    actions.forEach(act => {
        if (act.selected) {
            if (dir === 'up') {
                if (act.pos % 5 !== 0) act.pos = Math.ceil(act.pos / 5) * 5;
                else act.pos = Math.min(100, act.pos + 5);
            }
            if (dir === 'down') {
                if (act.pos % 5 !== 0) act.pos = Math.floor(act.pos / 5) * 5;
                else act.pos = Math.max(0, act.pos - 5);
            }
            moved = true;
        }
    });
    
    if (moved) {
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        drawTimeline(); notifyCloud(); window.updateHeatmapAndStats(); 
    }
});

window.addEventListener('magnetPoint', function() {
    const actions = getSafeActions();
    const timeMs = (videoNode && videoNode.currentTime) ? Math.round(videoNode.currentTime * 1000) : 0;
    let moved = false; saveHistoryState();
    actions.forEach(act => { if (act.selected) { act.at = timeMs; moved = true; } });
    if (moved) {
        cleanDuplicates();
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        drawTimeline(); notifyCloud(); window.updateHeatmapAndStats();
    }
});

// 🎯 RECEPTOR CONECTADO AL RADAR DE LA AGUJA
window.addEventListener('deletePoints', () => {
    const actions = getSafeActions();
    let hasSelection = actions.some(a => a.selected);
    if (!hasSelection) {
        const closest = getPointUnderPlayhead(actions);
        if (closest) closest.selected = true; // El Radar lo selecciona para borrarlo
    }
    
    if (actions.some(a => a.selected)) {
        saveHistoryState();
        window.funscriptActions = actions.filter(a => !a.selected);
        drawTimeline(); notifyCloud(); window.updateHeatmapAndStats();
    }
});

window.addEventListener('undoAction', () => { undo(); });
window.addEventListener('redoAction', () => { redo(); });
window.addEventListener('selectAllPoints', () => {
    getSafeActions().forEach(a => a.selected = true);
    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    drawTimeline();
});

function ensureCanvasSize() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
        canvas.width = parent.clientWidth; canvas.height = parent.clientHeight;
        if (typeof window.calculateAdaptiveZoom === 'function') window.calculateAdaptiveZoom();
    }
}
window.calculateAdaptiveZoom = function() { basePixelsPerMs = 0.1; };

function saveHistoryState() { undoStack.push(JSON.stringify(getSafeActions())); if (undoStack.length > MAX_HISTORY) undoStack.shift(); redoStack = []; }
function undo() {
    if (undoStack.length > 0) {
        redoStack.push(JSON.stringify(getSafeActions())); window.funscriptActions = JSON.parse(undoStack.pop());
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        notifyCloud(); drawTimeline(); window.updateHeatmapAndStats();
    }
}
function redo() {
    if (redoStack.length > 0) {
        undoStack.push(JSON.stringify(getSafeActions())); window.funscriptActions = JSON.parse(redoStack.pop());
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        notifyCloud(); drawTimeline(); window.updateHeatmapAndStats();
    }
}
function timeToX(timeMs) { return 30 + (timeMs - scrollLeftMs) * (basePixelsPerMs * zoom); }
function xToTime(x) { return scrollLeftMs + (x - 30) / (basePixelsPerMs * zoom); }
function posToY(pos) { const padding = 20; const usableHeight = canvas.height - (padding * 2); return canvas.height - padding - (pos / 100) * usableHeight; }
function yToPos(y) { const padding = 20; const usableHeight = canvas.height - (padding * 2); const rawPos = ((canvas.height - padding - y) / usableHeight) * 100; return Math.max(0, Math.min(100, Math.round(rawPos))); }

function drawTimeline() {
    try {
        ensureCanvasSize();
        if (!ctx || !canvas) return;
        
        if (videoNode && !videoNode.paused) {
            const actualTime = videoNode.currentTime * 1000;
            const visibleMs = (canvas.width - 30) / (basePixelsPerMs * zoom);
            scrollLeftMs = actualTime - (visibleMs / 2);
            if (scrollLeftMs < 0) scrollLeftMs = 0;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#06090e'; ctx.fillRect(0, 0, canvas.width, canvas.height);

        const y100 = posToY(100); const y70 = posToY(70); const y20 = posToY(20); const y0 = posToY(0);
        ctx.fillStyle = 'rgba(236, 72, 153, 0.08)'; ctx.fillRect(30, y100, canvas.width - 30, y70 - y100);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.05)'; ctx.fillRect(30, y70, canvas.width - 30, y20 - y70);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.08)'; ctx.fillRect(30, y20, canvas.width - 30, y0 - y20);

        ctx.lineWidth = 2; ctx.setLineDash([5, 5]); 
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.8)'; ctx.beginPath(); ctx.moveTo(30, y70); ctx.lineTo(canvas.width, y70); ctx.stroke();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)'; ctx.beginPath(); ctx.moveTo(30, y20); ctx.lineTo(canvas.width, y20); ctx.stroke();
        ctx.setLineDash([]); 

        ctx.lineWidth = 1;
        [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(p => {
            const y = posToY(p); 
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)'; 
            ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        });

        const visibleMs = (canvas.width - 30) / (basePixelsPerMs * zoom);
        let stepMs = 1000;
        
        if (visibleMs < 500) stepMs = 50;
        else if (visibleMs < 1000) stepMs = 100;
        else if (visibleMs < 2000) stepMs = 250;
        else if (visibleMs < 5000) stepMs = 500;
        else if (visibleMs > 30000) stepMs = 5000;
        else if (visibleMs > 15000) stepMs = 2000;
        else stepMs = 1000; 

        const startTimeMs = Math.max(0, xToTime(30));
        const endTimeMs = xToTime(canvas.width);
        let t = Math.floor(startTimeMs / stepMs) * stepMs;

        ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace';
        while (t <= endTimeMs) {
            if (t >= 0) {
                const x = timeToX(t);
                if (x >= 30) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'; 
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
                    ctx.fillText(`${(t/1000).toFixed(2)}s`, x + 4, 12);
                }
            }
            t += stepMs;
        }

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

        if (window.magneticSnapPoint && !isSelecting && !isDraggingNode) {
            const px = timeToX(window.magneticSnapPoint.at);
            const py = posToY(window.magneticSnapPoint.pos);
            ctx.lineWidth = 2; ctx.strokeStyle = '#10b981'; 
            ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(16, 185, 129, 0.3)'; ctx.fill();
        }

        ctx.fillStyle = '#0b0f17'; ctx.fillRect(0, 0, 30, canvas.height);
        ctx.strokeStyle = '#1e293b'; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(30, canvas.height); ctx.stroke();

        [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(p => {
            const y = posToY(p); 
            ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 10px monospace'; ctx.fillText(`${p}%`, 4, y + 3);
        });

        const actualVideoTimeMs = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
        const playheadX = timeToX(actualVideoTimeMs);
        
        if (playheadX >= 30) {
            ctx.lineWidth = 2; ctx.strokeStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(playheadX, 0); ctx.lineTo(playheadX, canvas.height); ctx.stroke();
            ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(playheadX - 6, 0); ctx.lineTo(playheadX + 6, 0); ctx.lineTo(playheadX, 8); ctx.closePath(); ctx.fill();
        }

        if (videoNode && videoNode.paused) {
            actions.forEach(act => {
                const px = timeToX(act.at);
                if (px >= 30 && Math.abs(px - playheadX) <= 4) {
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

let isSliderDragging = false;
pointSlider?.addEventListener('mousedown', () => { 
    if (!isSliderDragging) { saveHistoryState(); isSliderDragging = true; }
});

pointSlider?.addEventListener('input', function() {
    const val = parseInt(this.value, 10);
    if (sliderValueDisplay) sliderValueDisplay.innerText = `${val}%`;
    const actions = getSafeActions();
    const selected = actions.filter(act => act.selected);
    if (selected.length > 0) {
        selected.forEach(act => act.pos = val); 
        drawTimeline(); 
    }
});

pointSlider?.addEventListener('change', function() {
    isSliderDragging = false;
    notifyCloud(); window.updateHeatmapAndStats();
});

function getMousePos(e) { const rect = canvas.getBoundingClientRect(); return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) }; }

canvas?.addEventListener('mousedown', (e) => {
    const actions = getSafeActions();
    const pos = getMousePos(e);
    const clickX = pos.x; const clickY = pos.y;

    if (e.button === 0) { 
        let clickedNode = null;
        let cIndex = -1;
        for (let i = 0; i < actions.length; i++) {
            const nx = timeToX(actions[i].at); const ny = posToY(actions[i].pos);
            if (Math.hypot(clickX - nx, clickY - ny) <= 8) { clickedNode = actions[i]; cIndex = i; break; }
        }

        if (clickedNode) {
            saveHistoryState();
            if (!e.ctrlKey && !clickedNode.selected) actions.forEach(a => a.selected = false);
            clickedNode.selected = true; 
            isDraggingNode = true; 
            draggedNodeIndex = cIndex; 
            
            dragSelectionInitialStates = actions.map(a => ({...a}));
            dragStartXTime = xToTime(clickX);
            dragStartYPos = yToPos(clickY);

            if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        } else {
            hadSelectionBeforeMousedown = actions.some(a => a.selected);
            if (!e.ctrlKey) actions.forEach(a => a.selected = false);
            isSelecting = true; hasDraggedSelection = false; 
            startX = clickX; startY = clickY; currentX = clickX; currentY = clickY;
            window.startMagneticSnapPoint = window.magneticSnapPoint ? { ...window.magneticSnapPoint } : null;
        }
    } else if (e.button === 2) { 
        e.preventDefault(); saveHistoryState();
        window.funscriptActions = actions.filter(act => Math.hypot(clickX - timeToX(act.at), clickY - posToY(act.pos)) > 10);
        notifyCloud(); drawTimeline(); window.updateHeatmapAndStats();
    }
});

canvas?.addEventListener('mousemove', (e) => {
    const actions = getSafeActions();
    const pos = getMousePos(e);
    const mouseX = pos.x; const mouseY = pos.y;

    window.magneticSnapPoint = null;
    if (!isSelecting) {
        let minDistance = 15; 
        if (window.loadedFunscriptTracks && window.loadedFunscriptTracks.length > 0) {
            window.loadedFunscriptTracks.forEach(track => {
                if (!track.isPrimary && track.visible && track.actions) {
                    track.actions.forEach(act => {
                        const px = timeToX(act.at); const py = posToY(act.pos);
                        const dist = Math.hypot(mouseX - px, mouseY - py);
                        if (dist < minDistance) {
                            minDistance = dist;
                            window.magneticSnapPoint = { at: act.at, pos: act.pos };
                        }
                    });
                }
            });
        }
    }

    if (isDraggingNode && dragSelectionInitialStates.length > 0) {
        let snappedTimeDelta = 0;
        let snappedPosDelta = 0;
        let useMagnet = false;

        if (window.magneticSnapPoint && draggedNodeIndex !== -1) {
            const initialDragged = dragSelectionInitialStates[draggedNodeIndex];
            snappedTimeDelta = window.magneticSnapPoint.at - initialDragged.at;
            snappedPosDelta = window.magneticSnapPoint.pos - initialDragged.pos;
            useMagnet = true;
        } else {
            const rawTimeDelta = xToTime(mouseX) - dragStartXTime;
            const rawPosDelta = yToPos(mouseY) - dragStartYPos;
            snappedTimeDelta = Math.round(rawTimeDelta / 50) * 50; 
            snappedPosDelta = Math.round(rawPosDelta / 5) * 5;
        }

        actions.forEach((act, i) => {
            if (dragSelectionInitialStates[i].selected) {
                act.at = Math.max(0, dragSelectionInitialStates[i].at + snappedTimeDelta);
                if (useMagnet) {
                    act.pos = Math.max(0, Math.min(100, dragSelectionInitialStates[i].pos + snappedPosDelta));
                } else {
                    const rawP = dragSelectionInitialStates[i].pos + snappedPosDelta;
                    act.pos = Math.max(0, Math.min(100, Math.round(rawP / 5) * 5));
                }
            }
        });
        
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
        
        if (!hadSelectionBeforeMousedown) {
            let clickTime = Math.max(0, Math.round(xToTime(startX) / 50) * 50);
            let clickPos = Math.round(yToPos(startY) / 5) * 5; 
            
            if (window.startMagneticSnapPoint) {
                clickTime = window.startMagneticSnapPoint.at;
                clickPos = window.startMagneticSnapPoint.pos;
            }

            saveHistoryState();
            
            const existingIdx = actions.findIndex(a => a.at === clickTime);
            if (existingIdx !== -1) {
                actions[existingIdx].pos = clickPos;
                actions[existingIdx].selected = true;
            } else {
                actions.push({ at: clickTime, pos: clickPos, selected: true });
            }
            
            cleanDuplicates();
            if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
            notifyCloud(); window.updateHeatmapAndStats();
        }
    } else if (isDraggingNode || hasDraggedSelection) { 
        cleanDuplicates();
        notifyCloud(); window.updateHeatmapAndStats();
    }
    isDraggingNode = false; dragSelectionInitialStates = []; isSelecting = false; draggedNodeIndex = -1; drawTimeline();
});

canvas?.addEventListener('contextmenu', e => e.preventDefault());
function animationLoop() { drawTimeline(); requestAnimationFrame(animationLoop); }
requestAnimationFrame(animationLoop);

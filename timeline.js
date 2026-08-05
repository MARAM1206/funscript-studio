// ==========================================================================
// TIMELINE V43.0: SPM FIX FAPTAP Y ARRASTRE MULTITAREA (LIBERACIÓN DE TECLADO)
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

function formatTimelineLabel(timeMs) {
    const isNeg = timeMs < 0;
    const totalSecs = Math.abs(timeMs) / 1000;
    let sign = isNeg ? "-" : "";
    if (totalSecs < 60) return `${sign}${totalSecs.toFixed(1)}s`; 
    const m = Math.floor(totalSecs / 60);
    const s = (totalSecs % 60).toFixed(1).padStart(4, '0');
    return `${sign}${m}:${s.replace('.0', '')}`;
}

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

function ensureTrackExists() {
    if (!window.loadedFunscriptTracks || window.loadedFunscriptTracks.length === 0) {
        let baseName = "Nuevo_Script";
        if (window.currentVideoName) {
            baseName = window.currentVideoName.replace(/\.[^/.]+$/, "");
        }
        if (typeof window.createEmptyTrack === 'function') {
            window.createEmptyTrack(baseName);
        }
    }
}

function getPointUnderPlayhead(actions) {
    const timeMs = (videoNode && videoNode.currentTime) ? Math.round(videoNode.currentTime * 1000) : 0;
    let closest = null; 
    let minDiff = 50; 
    actions.forEach(act => {
        const diff = Math.abs(act.at - timeMs);
        if (diff <= minDiff) { minDiff = diff; closest = act; }
    });
    return closest;
}

window.getMorphedPreset = function(preset, selectedActions) {
    if (!selectedActions || selectedActions.length < 2 || !preset || preset.length === 0) return null;
    selectedActions.sort((a, b) => a.at - b.at);
    
    const t_min = selectedActions[0].at;
    const t_max = selectedActions[selectedActions.length - 1].at;
    const targetDuration = t_max - t_min;
    
    const y_min = Math.min(...selectedActions.map(a => a.pos));
    const y_max = Math.max(...selectedActions.map(a => a.pos));
    
    const preset_t_max = preset[preset.length - 1].at;
    const preset_y_min = Math.min(...preset.map(a => a.pos));
    const preset_y_max = Math.max(...preset.map(a => a.pos));
    
    return preset.map((act, index) => {
        let newT = t_min + (preset_t_max === 0 ? 0 : (act.at / preset_t_max) * targetDuration);
        let newPos = act.pos;
        if (preset_y_max !== preset_y_min) {
            let normalizedY = (act.pos - preset_y_min) / (preset_y_max - preset_y_min);
            newPos = y_min + normalizedY * (y_max - y_min);
        }

        if (index === 0) newPos = selectedActions[0].pos;
        if (index === preset.length - 1) newPos = selectedActions[selectedActions.length - 1].pos;

        return { at: Math.round(newT), pos: Math.max(0, Math.min(100, Math.round(newPos))) };
    });
};

window.updateHeatmapAndStats = function() {
    const actions = getSafeActions();
    
    const statsSpan = document.getElementById('timeline-stats');
    if (statsSpan) {
        let speedText = "--";
        if (actions.length > 1) {
            // 🎯 FIX SPM FAPTAP: 1 stroke = 2 puntos. SPM = Strokes / Duración en Minutos del Script.
            const totalStrokes = (actions.length - 1) / 2;
            const durationMs = actions[actions.length - 1].at - actions[0].at;
            const durationMins = durationMs / 60000;

            if (durationMins > 0) {
                const spm = Math.round(totalStrokes / durationMins);
                if (spm >= 301) speedText = `Very Fast 🔴 (${spm})`;
                else if (spm >= 151) speedText = `Fast 🟠 (${spm})`;
                else if (spm >= 51) speedText = `Medium 🟡 (${spm})`; 
                else speedText = `Slow 🟢 (${spm})`;
            }
        } else if (actions.length === 1) {
            speedText = "Slow 🟢 (0)";
        }
        statsSpan.innerHTML = `Puntos: <strong>${actions.length}</strong> &nbsp;|&nbsp; Velocidad: <strong>${speedText}</strong>`;
    }

    const hCanvas = document.getElementById('heatmap-canvas');
    if (!hCanvas) return;
    
    let totalDurationMs = 0;
    if (videoNode && videoNode.duration) { totalDurationMs = videoNode.duration * 1000; } 
    else if (actions.length > 0) { totalDurationMs = actions[actions.length - 1].at; }

    if (totalDurationMs <= 0) {
        const hCtx = hCanvas.getContext('2d');
        if (hCtx) hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);
        return;
    }

    const rect = hCanvas.getBoundingClientRect();
    if(rect.width === 0) return; 
    if (hCanvas.width !== rect.width) hCanvas.width = rect.width;
    
    const hCtx = hCanvas.getContext('2d');
    hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);

    const bucketCount = 150; 
    const bucketDuration = totalDurationMs / bucketCount;
    const buckets = new Array(bucketCount).fill(0);

    actions.forEach((act, idx) => {
        if (act.at <= totalDurationMs) {
            const b = Math.floor(act.at / bucketDuration);
            if (b >= 0 && b < bucketCount) {
                if (idx > 0 && actions[idx-1].at <= totalDurationMs) { 
                    buckets[b] += Math.abs(act.pos - actions[idx-1].pos); 
                } else { 
                    buckets[b] += 50; 
                }
            }
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
            hCtx.fillRect(i * bucketWidth, 0, Math.ceil(bucketWidth) + 0.5, hCanvas.height);
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
        zoom = Math.round((zoom + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100;
        zoom = Math.max(0.1, Math.min(zoom, 15.0)); 
        
        scrollLeftMs = timeAtMouse - (mouseX - 30) / (basePixelsPerMs * zoom);
        if (scrollLeftMs < 0) scrollLeftMs = 0; 
    } else {
        if (videoNode && videoNode.paused) {
            const visibleMs = (canvas.width - 30) / (basePixelsPerMs * zoom);
            const panStep = visibleMs * 0.10; 
            if (e.deltaY < 0) scrollLeftMs += panStep; else scrollLeftMs -= panStep; 
            if (scrollLeftMs < 0) scrollLeftMs = 0;
            if (videoNode.duration) {
                const maxScroll = (videoNode.duration * 1000) - visibleMs + 2000; 
                if (scrollLeftMs > maxScroll && maxScroll > 0) scrollLeftMs = maxScroll;
            }
        }
    }
}, { passive: false });

window.addEventListener('videoPlay', () => { drawTimeline(); });

window.addEventListener('forceTimelinePan', (e) => {
    let actualTime = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
    if (e && e.detail && e.detail.timeMs !== undefined) {
        actualTime = e.detail.timeMs;
    }
    const visibleMs = (canvas.width - 30) / (basePixelsPerMs * zoom);
    scrollLeftMs = actualTime - (visibleMs / 2);
    if (scrollLeftMs < 0) scrollLeftMs = 0;
});

window.addEventListener('copyPoints', () => {
    const selected = getSafeActions().filter(a => a.selected);
    if (selected.length > 0) {
        const baseTime = selected[0].at;
        window.clipboardFunscript = selected.map(a => ({ at: a.at - baseTime, pos: a.pos }));
    }
});

window.addEventListener('pastePoints', () => {
    const modal = document.getElementById('preset-editor-modal');
    if (window.clipboardFunscript && window.clipboardFunscript.length > 0 && modal.style.display !== 'flex') {
        window.isPastingMode = true;
        window.timelineGhostPreset = window.clipboardFunscript;
    }
});

// ⚡ LÓGICA DE EVENTOS DE ARRASTRE PERSONALIZADO (CUSTOM DRAG)
window.addEventListener('presetCustomDragOver', (e) => {
    if (!canvas) return;
    if (window.isDraggingPreset && window.timelineGhostPreset) {
        const rect = canvas.getBoundingClientRect();
        const pos = {
            x: (e.detail.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.detail.clientY - rect.top) * (canvas.height / rect.height)
        };
        let hoverTimeMs = xToTime(pos.x);
        let hoverPosRaw = yToPos(pos.y);
        
        const actions = getSafeActions();
        
        // 🎯 FIX: Eliminada la barrera que impedía que el Fantasma Adaptativo se calculara.
        // Ahora el modo Adaptativo permite rastrear el ratón en todo momento.

        const snapDistMs = 350; 
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
    }
});

window.addEventListener('presetCustomDrop', (e) => {
    if (!canvas) return;
    if (window.isDraggingPreset && window.timelineGhostPreset) {
        ensureTrackExists();
        let actions = getSafeActions();
        const selected = actions.filter(a => a.selected);

        if (window.isAdaptiveModeActive && selected.length >= 2) {
            const morphed = window.getMorphedPreset(window.timelineGhostPreset, selected);
            if (morphed) {
                saveHistoryState();
                window.funscriptActions = actions.filter(a => !a.selected); 
                morphed.forEach(m => m.selected = true);
                window.funscriptActions.push(...morphed);
                cleanDuplicates();
                
                window.isDraggingPreset = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
                if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
                notifyCloud(); window.updateHeatmapAndStats();
                return;
            }
        }

        const rect = canvas.getBoundingClientRect();
        const pos = {
            x: (e.detail.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.detail.clientY - rect.top) * (canvas.height / rect.height)
        };
        let dropTimeMs = window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : Math.max(0, xToTime(pos.x));
        const deltaY = window.timelineGhostDeltaPos || 0;
        
        const presetDuration = window.timelineGhostPreset[window.timelineGhostPreset.length - 1].at;

        saveHistoryState();
        
        const newActions = window.timelineGhostPreset.map(act => ({
            at: dropTimeMs + act.at,
            pos: Math.max(0, Math.min(100, act.pos + deltaY)),
            selected: true 
        }));
        
        const newTimes = new Set(newActions.map(a => a.at));
        window.funscriptActions = actions.filter(a => !newTimes.has(a.at));
        window.funscriptActions.forEach(a => a.selected = false); 
        window.funscriptActions.push(...newActions);
        cleanDuplicates(); 
        
        window.isDraggingPreset = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
        
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        notifyCloud(); window.updateHeatmapAndStats();
    }
});

const sliderA = document.getElementById('min-slider'); const sliderB = document.getElementById('max-slider');
const dualFill = document.getElementById('dual-slider-fill'); const minLabel = document.getElementById('min-label'); const maxLabel = document.getElementById('max-label');

function updateDualSlider() {
    if (!sliderA || !sliderB) return;
    const valA = parseInt(sliderA.value, 10); const valB = parseInt(sliderB.value, 10);
    const currentMin = Math.min(valA, valB); const currentMax = Math.max(valA, valB);
    
    if (valA > valB) {
        sliderA.style.setProperty('--thumb-color', '#f97316'); 
        sliderB.style.setProperty('--thumb-color', '#38bdf8'); 
    } else {
        sliderA.style.setProperty('--thumb-color', '#38bdf8'); 
        sliderB.style.setProperty('--thumb-color', '#f97316'); 
    }

    if (minLabel) minLabel.innerText = `⬇️ Mínimo: ${currentMin}%`; if (maxLabel) maxLabel.innerText = `⬆️ Máximo: ${currentMax}%`;
    if (dualFill) { dualFill.style.left = `${currentMin}%`; dualFill.style.width = `${currentMax - currentMin}%`; }
}
function blurSliders() { if (sliderA) sliderA.blur(); if (sliderB) sliderB.blur(); }
sliderA?.addEventListener('input', updateDualSlider); sliderB?.addEventListener('input', updateDualSlider);
sliderA?.addEventListener('change', blurSliders); sliderB?.addEventListener('change', blurSliders);
sliderA?.addEventListener('mouseup', blurSliders); sliderB?.addEventListener('mouseup', blurSliders); updateDualSlider(); 

window.addEventListener('injectPoint', function(e) {
    ensureTrackExists(); 
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
        actions[existingIdx].selected = true; 
    } 
    else { 
        actions.push({ at: timeMs, pos: pos, selected: true }); 
    }
    
    cleanDuplicates();
    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    notifyCloud(); window.updateHeatmapAndStats(); 
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
        notifyCloud(); 
    }
});

window.addEventListener('nudgePoints', function(e) {
    const actions = getSafeActions(); const dir = e.detail; let moved = false;
    saveHistoryState();
    
    let hasSelection = actions.some(a => a.selected);
    if (!hasSelection) {
        const closest = getPointUnderPlayhead(actions);
        if (closest) closest.selected = true; 
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
        notifyCloud(); window.updateHeatmapAndStats(); 
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
        notifyCloud(); window.updateHeatmapAndStats();
    }
});

window.addEventListener('deletePoints', () => {
    const actions = getSafeActions();
    let hasSelection = actions.some(a => a.selected);
    if (!hasSelection) {
        const closest = getPointUnderPlayhead(actions);
        if (closest) closest.selected = true; 
    }
    
    if (actions.some(a => a.selected)) {
        saveHistoryState();
        window.funscriptActions = actions.filter(a => !a.selected);
        notifyCloud(); window.updateHeatmapAndStats();
    }
});

window.addEventListener('undoAction', () => { undo(); });
window.addEventListener('redoAction', () => { redo(); });
window.addEventListener('selectAllPoints', () => {
    getSafeActions().forEach(a => a.selected = true);
    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
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
        notifyCloud(); window.updateHeatmapAndStats();
    }
}
function redo() {
    if (redoStack.length > 0) {
        undoStack.push(JSON.stringify(getSafeActions())); window.funscriptActions = JSON.parse(redoStack.pop());
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        notifyCloud(); window.updateHeatmapAndStats();
    }
}
function timeToX(timeMs) { return 30 + (timeMs - scrollLeftMs) * (basePixelsPerMs * zoom); }
function xToTime(x) { return scrollLeftMs + (x - 30) / (basePixelsPerMs * zoom); }
function posToY(pos) { const padding = 20; const usableHeight = canvas.height - (padding * 2); return canvas.height - padding - (pos / 100) * usableHeight; }
function yToPos(y) { const padding = 20; const usableHeight = canvas.height - (padding * 2); const rawPos = ((canvas.height - padding - y) / usableHeight) * 100; return Math.max(0, Math.min(100, Math.round(rawPos))); }

window.drawTimeline = function() {
    try {
        ensureCanvasSize();
        if (!ctx || !canvas) return;
        
        let actualTime = (videoNode && videoNode.currentTime) ? videoNode.currentTime * 1000 : 0;
        if (videoNode && !videoNode.paused) {
            const visibleMs = (canvas.width - 30) / (basePixelsPerMs * zoom);
            scrollLeftMs = actualTime - (visibleMs / 2);
            if (scrollLeftMs < 0) scrollLeftMs = 0;
        }

        const isLight = document.body.classList.contains('light-theme');
        const bgColor = isLight ? '#f8fafc' : '#06090e';
        const gridColor = isLight ? 'rgba(100, 116, 139, 0.2)' : 'rgba(148, 163, 184, 0.15)';
        const timeLineColor = isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.04)';
        const colBgColor = isLight ? '#e2e8f0' : '#0b0f17';
        const colBorder = isLight ? '#cbd5e1' : '#1e293b';
        const textDimColor = isLight ? '#475569' : '#94a3b8';
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = bgColor; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (window.audioPeaks && window.audioPeaksSampleRate) {
            ctx.lineWidth = 1;
            const isMuted = videoNode && (videoNode.muted || videoNode.volume === 0);
            
            ctx.strokeStyle = isMuted ? 'rgba(239, 68, 68, 0.9)' : (isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.15)'); 
            ctx.beginPath();
            
            const startIdx = Math.max(0, Math.floor(xToTime(30) / 1000 * window.audioPeaksSampleRate));
            const endIdx = Math.min(window.audioPeaks.length - 1, Math.ceil(xToTime(canvas.width) / 1000 * window.audioPeaksSampleRate));

            const yCenter = canvas.height / 2;
            const maxAmplitude = canvas.height * 0.05; 

            for(let i = startIdx; i <= endIdx; i++) {
                const timeMs = (i / window.audioPeaksSampleRate) * 1000;
                const x = timeToX(timeMs);
                if (x >= 30) {
                    const amplitude = window.audioPeaks[i] * maxAmplitude; 
                    ctx.moveTo(x, yCenter - amplitude);
                    ctx.lineTo(x, yCenter + amplitude);
                }
            }
            ctx.stroke();
        }

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
            ctx.strokeStyle = gridColor; 
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

        ctx.fillStyle = textDimColor; ctx.font = '10px monospace';
        while (t <= endTimeMs) {
            if (t >= 0) {
                const x = timeToX(t);
                if (x >= 30) {
                    ctx.strokeStyle = timeLineColor; 
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
                    ctx.fillText(formatTimelineLabel(t), x + 4, 12);
                }
            }
            t += stepMs;
        }

        const actions = getSafeActions();

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

        if (actions.length > 0) {
            for (let i = 0; i < actions.length - 1; i++) {
                const act1 = actions[i]; const act2 = actions[i+1];
                const x1 = timeToX(act1.at); const y1 = posToY(act1.pos);
                const x2 = timeToX(act2.at); const y2 = posToY(act2.pos);

                let isMorphLine = act1.selected && act2.selected && window.isAdaptiveModeActive && (window.isDraggingPreset || window.isPastingMode);
                
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                
                if (isMorphLine) {
                    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 150));
                    ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
                    ctx.lineWidth = 4;
                } else {
                    ctx.strokeStyle = '#38bdf8';
                    ctx.lineWidth = 3;
                }
                ctx.stroke();
            }

            actions.forEach(act => {
                const x = timeToX(act.at);
                if (x >= -20 && x <= canvas.width + 20) {
                    const y = posToY(act.pos); 
                    let isTargetForMorph = act.selected && window.isAdaptiveModeActive && (window.isDraggingPreset || window.isPastingMode);
                    
                    if (isTargetForMorph) {
                        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 150));
                        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
                        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
                    } else {
                        ctx.fillStyle = act.selected ? '#f59e0b' : '#38bdf8';
                        ctx.beginPath(); ctx.arc(x, y, act.selected ? 7 : 5, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
                    }
                }
            });
        }

        if ((window.isDraggingPreset || window.isPastingMode) && window.timelineGhostPreset && window.timelineGhostTimeMs !== null) {
            const selected = actions.filter(a => a.selected);
            if (window.isAdaptiveModeActive && selected.length >= 2) {
                const morphed = window.getMorphedPreset(window.timelineGhostPreset, selected);
                if (morphed) {
                    const pulseG = 0.6 + 0.4 * Math.sin(Date.now() / 150 + Math.PI); 
                    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(16, 185, 129, ${pulseG})`; ctx.beginPath();
                    morphed.forEach((act, index) => {
                        const x = timeToX(act.at); const y = posToY(act.pos); 
                        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    });
                    ctx.stroke();
                    morphed.forEach(act => {
                        const x = timeToX(act.at); const y = posToY(act.pos);
                        ctx.fillStyle = `rgba(16, 185, 129, ${pulseG})`;
                        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
                    });
                    ctx.fillStyle = '#10b981'; ctx.font = 'bold 12px monospace';
                    ctx.fillText("⚡ MODO ADAPTATIVO", timeToX(morphed[0].at), posToY(morphed[0].pos) - 15);
                }
            } else {
                const deltaY = window.timelineGhostDeltaPos || 0;
                ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)'; ctx.beginPath();
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
                if (window.isPastingMode) {
                    ctx.fillStyle = '#10b981'; ctx.font = 'bold 12px monospace';
                    ctx.fillText("📋 PEGAR (Click para soltar)", timeToX(window.timelineGhostTimeMs), posToY(window.timelineGhostPreset[0].pos + deltaY) - 15);
                }
            }
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

        ctx.fillStyle = colBgColor; ctx.fillRect(0, 0, 30, canvas.height);
        ctx.strokeStyle = colBorder; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(30, canvas.height); ctx.stroke();

        [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(p => {
            const y = posToY(p); 
            ctx.fillStyle = textDimColor; ctx.font = 'bold 10px monospace'; ctx.fillText(`${p}%`, 4, y + 3);
        });

        const playheadX = timeToX(actualTime);
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

        if (document.fullscreenElement) {
            const fsCanvas = document.getElementById('fs-timeline-canvas');
            if (fsCanvas) {
                if (!window.fsTimelineVisible) {
                    fsCanvas.style.display = 'none';
                } else {
                    fsCanvas.style.display = 'block';
                    const rect = fsCanvas.getBoundingClientRect();
                    if (fsCanvas.width !== rect.width || fsCanvas.height !== rect.height) {
                        fsCanvas.width = rect.width; fsCanvas.height = rect.height;
                    }
                    const fCtx = fsCanvas.getContext('2d');
                    fCtx.clearRect(0,0, fsCanvas.width, fsCanvas.height);
                    
                    const fsTimeToX = (t) => 10 + (t - scrollLeftMs) * (basePixelsPerMs * zoom);
                    const fsPosToY = (p) => fsCanvas.height - 10 - (p/100)*(fsCanvas.height - 35);

                    if (actions.length > 0) {
                        fCtx.strokeStyle = '#38bdf8'; fCtx.lineWidth = 2; fCtx.beginPath();
                        actions.forEach((a, i) => {
                            if(i===0) fCtx.moveTo(fsTimeToX(a.at), fsPosToY(a.pos));
                            else fCtx.lineTo(fsTimeToX(a.at), fsPosToY(a.pos));
                        });
                        fCtx.stroke();
                        actions.forEach(a => {
                            fCtx.fillStyle = a.selected ? '#f59e0b' : '#38bdf8';
                            fCtx.beginPath(); fCtx.arc(fsTimeToX(a.at), fsPosToY(a.pos), a.selected ? 5 : 3, 0, Math.PI*2); fCtx.fill();
                        });
                    }
                    
                    const phX = fsTimeToX(actualTime);
                    fCtx.strokeStyle = '#f97316'; fCtx.lineWidth = 2;
                    fCtx.beginPath(); fCtx.moveTo(phX, 0); fCtx.lineTo(phX, fsCanvas.height); fCtx.stroke();
                    
                    fCtx.fillStyle = 'rgba(255,255,255,0.8)'; fCtx.font = '12px monospace';
                    fCtx.fillText("Tecla 'H' oculta gráfica | 'Esc' o 'F' para salir", 15, 20);
                }
            }
        } else {
            const fsCanvas = document.getElementById('fs-timeline-canvas');
            if (fsCanvas) fsCanvas.style.display = 'none';
        }

    } catch (err) {}
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
    }
});

pointSlider?.addEventListener('change', function() {
    isSliderDragging = false;
    notifyCloud(); window.updateHeatmapAndStats();
});

function getMousePos(e) { const rect = canvas.getBoundingClientRect(); return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) }; }

canvas?.addEventListener('mousedown', (e) => {
    if (window.isPastingMode && window.timelineGhostPreset) {
        if (e.button === 0) { 
            ensureTrackExists();
            saveHistoryState();
            let actions = getSafeActions();
            const pos = getMousePos(e);
            let dropTimeMs = window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : Math.max(0, xToTime(pos.x));
            const deltaY = window.timelineGhostDeltaPos || 0;
            
            const selected = actions.filter(a => a.selected);

            if (window.isAdaptiveModeActive && selected.length >= 2) {
                const morphed = window.getMorphedPreset(window.timelineGhostPreset, selected);
                if (morphed) {
                    window.funscriptActions = actions.filter(a => !a.selected); 
                    morphed.forEach(m => m.selected = true);
                    window.funscriptActions.push(...morphed);
                    cleanDuplicates();
                    window.isPastingMode = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
                    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
                    notifyCloud(); window.updateHeatmapAndStats();
                    return;
                }
            }
            
            const newActions = window.timelineGhostPreset.map(act => ({
                at: Math.max(0, dropTimeMs + act.at),
                pos: Math.max(0, Math.min(100, act.pos + deltaY)),
                selected: true 
            }));
            
            const newTimes = new Set(newActions.map(a => a.at));
            window.funscriptActions = actions.filter(a => !newTimes.has(a.at));
            window.funscriptActions.forEach(a => a.selected = false);
            window.funscriptActions.push(...newActions);
            cleanDuplicates(); 
            
            window.isPastingMode = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
            if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
            notifyCloud(); window.updateHeatmapAndStats();
            return;
        } else if (e.button === 2) { 
            window.isPastingMode = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
            return;
        }
    }

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
        notifyCloud(); window.updateHeatmapAndStats();
    }
});

canvas?.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    
    if (window.isPastingMode && window.timelineGhostPreset) {
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
        window.timelineGhostTimeMs = bestSnapTime;
        
        let hoverPos = Math.round(hoverPosRaw / 5) * 5;
        const basePos = window.timelineGhostPreset[0].pos;
        window.timelineGhostDeltaPos = hoverPos - basePos;
        return; 
    }

    const actions = getSafeActions();
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
    if (window.isPastingMode) return; 

    let actions = getSafeActions();
    if (isSelecting && !hasDraggedSelection && e.target === canvas) {
        
        if (!hadSelectionBeforeMousedown) {
            ensureTrackExists(); 
            actions = getSafeActions(); 

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
        const selectedTimes = new Set(actions.filter(a => a.selected).map(a => a.at));
        window.funscriptActions = actions.filter(a => a.selected || !selectedTimes.has(a.at));
        
        cleanDuplicates();
        notifyCloud(); window.updateHeatmapAndStats();
    }
    isDraggingNode = false; dragSelectionInitialStates = []; isSelecting = false; draggedNodeIndex = -1;
});

canvas?.addEventListener('contextmenu', e => e.preventDefault());

function animationLoop() { window.drawTimeline(); requestAnimationFrame(animationLoop); }
requestAnimationFrame(animationLoop);

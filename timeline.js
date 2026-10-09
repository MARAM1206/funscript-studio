// ==========================================================================
// TIMELINE V1.32.0 (FIX VIBRACIÓN Y MULTIPLICADOR INTELIGENTE) - PARTE 1
// ==========================================================================

window.funscriptActions = window.funscriptActions || [];
window.timelineMarkers = window.timelineMarkers || []; 
window.activeSuggestion = null; 
window.presetFillReps = 1;
window.presetFillModeState = null; 
window.lastMarkerRightClickIdx = -1;
window.lastMarkerRightClickTime = 0;
window.activeDevice = null;
window.isOverclockEnabled = false;

window.zoom = window.zoom || 1.0; 
window.basePixelsPerMs = window.basePixelsPerMs || 0.1; 
window.scrollLeftMs = window.scrollLeftMs || 0; 
window.scrollMomentum = window.scrollMomentum || 0; 

let isSelecting = false;
let hasDraggedSelection = false; 
let selStartT = 0, selStartY = 0;
let selCurrT = 0, selCurrY = 0;
let isSelectingMarkers = false;
let selStartMarkerT = 0;
let selCurrMarkerT = 0;
let markerSelectionInitialStates = [];
let isDraggingNode = false; 
let draggedNodeIndex = -1; 
let dragSelectionInitialStates = [];
let dragStartXTime = 0;
let dragStartYPos = 0;
let isDraggingMarker = false;
let draggedMarkerIndex = -1;
let lastRightClickTime = 0; 
let undoStack = [];
let redoStack = [];
let hadSelectionBeforeMousedown = false;
const MAX_HISTORY = 50;

window.hardwareDB = {
    "handy_std": { name: "Handy V1 / 2 Standar", stroke: 110, factor: 1.10, supports_overclock: false, standard: { max: 400, min: 32 } },
    "handy_pro": { name: "Handy 2 PRO", stroke: 125, factor: 1.25, supports_overclock: true, standard: { max: 500, min: 20 }, overclock: { max: 650, min: 15 } },
    "keon_1": { name: "Kiiroo Keon 1", stroke: 75, factor: 0.75, supports_overclock: false, standard: { max: 280, min: 20 } },
    "keon_2": { name: "Kiiroo Keon 2", stroke: 80, factor: 0.80, supports_overclock: false, standard: { max: 350, min: 18 } },
    "keon_sm": { name: "Kiiroo Sex Machine", stroke: 100, factor: 1.00, supports_overclock: false, standard: { max: 450, min: 20 } },
    "erojoy_x3": { name: "Erojoy X3", stroke: 115, factor: 1.15, supports_overclock: false, standard: { max: 320, min: 22 } }
};

function fakeRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function pDistance(x, y, x1, y1, x2, y2) {
    var A = x - x1; var B = y - y1; var C = x2 - x1; var D = y2 - y1;
    var dot = A * C + B * D; var len_sq = C * C + D * D; var param = -1;
    if (len_sq != 0) param = dot / len_sq;
    var xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    var dx = x - xx; var dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

function getCorrectionSuggestion(act1, act2, hwMax, hwMin, factor, act0, act3) {
    let dt = act2.at - act1.at;
    let dp = Math.abs(act2.pos - act1.pos);
    if (dt <= 0) return null;
    let speed = (dp * factor) / (dt / 1000);
    if (speed > hwMax) {
        let requiredDt = (dp * factor) / hwMax * 1000;
        return { key: 'at', val: act1.at + requiredDt, modIdx: 2 };
    }
    if (speed < hwMin && dp > 0) {
        let requiredDt = (dp * factor) / hwMin * 1000;
        return { key: 'at', val: act1.at + requiredDt, modIdx: 2 };
    }
    return null;
}

function getSafeActions() {
    if (!window.funscriptActions || !Array.isArray(window.funscriptActions)) window.funscriptActions = [];
    return window.funscriptActions;
}

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
        let baseName = "Nuevo_Script.funscript";
        if (window.currentVideoName) baseName = window.currentVideoName.replace(/\.[^/.]+$/, "") + ".funscript";
        if (typeof window.createEmptyTrack === 'function') window.createEmptyTrack(baseName);
    }
}

function getPointUnderPlayhead(actions) {
    let safeTime = 0;
    try { safeTime = typeof window.getActualTimeMs === 'function' ? window.getActualTimeMs() : 0; } catch(e){}
    const timeMs = Math.round(safeTime);
    let closest = null; let minDiff = 50; 
    actions.forEach(act => {
        const diff = Math.abs(act.at - timeMs);
        if (diff <= minDiff) { minDiff = diff; closest = act; }
    });
    return closest;
}

function timeToX(timeMs) { return 30 + (timeMs - window.scrollLeftMs) * (window.basePixelsPerMs * window.zoom); }
function xToTime(x) { return window.scrollLeftMs + (x - 30) / (window.basePixelsPerMs * window.zoom); }

function posToY(pos) { 
    const canvas = document.getElementById('timeline-canvas');
    if (!canvas) return 0;
    const topPad = 40; const botPad = 20; const usableHeight = canvas.height - topPad - botPad; 
    return canvas.height - botPad - (pos / 100) * usableHeight; 
}

function yToPos(y) { 
    const canvas = document.getElementById('timeline-canvas');
    if (!canvas) return 0;
    const topPad = 40; const botPad = 20; const usableHeight = canvas.height - topPad - botPad; 
    const rawPos = ((canvas.height - botPad - y) / usableHeight) * 100; 
    return Math.max(0, Math.min(100, Math.round(rawPos))); 
}

function saveHistoryState() { 
    undoStack.push(JSON.stringify(getSafeActions())); 
    if (undoStack.length > MAX_HISTORY) undoStack.shift(); 
    redoStack = []; 
}

function undo() {
    if (undoStack.length > 0) {
        redoStack.push(JSON.stringify(getSafeActions())); 
        const parsed = JSON.parse(undoStack.pop());
        window.funscriptActions.splice(0, window.funscriptActions.length, ...parsed);
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        notifyCloud(); window.updateHeatmapAndStats();
        window.drawTimeline();
    }
}

function redo() {
    if (redoStack.length > 0) {
        undoStack.push(JSON.stringify(getSafeActions())); 
        const parsed = JSON.parse(redoStack.pop());
        window.funscriptActions.splice(0, window.funscriptActions.length, ...parsed);
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        notifyCloud(); window.updateHeatmapAndStats();
        window.drawTimeline();
    }
}

window.addEventListener('forceTimelinePan', (e) => {
    const canvas = document.getElementById('timeline-canvas');
    if (!canvas || canvas.width === 0) return;
    const visibleMs = (canvas.width - 30) / (window.basePixelsPerMs * window.zoom);
    let targetTime = window.getActualTimeMs();
    if (e && e.detail && e.detail.timeMs !== undefined) targetTime = e.detail.timeMs;
    window.scrollLeftMs = Math.max(0, targetTime - (visibleMs / 2));
    window.drawTimeline();
});

window.addEventListener('toggleSyncPoint', () => {
    if (document.body.classList.contains('panic-mode-active')) return;
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;

    ensureTrackExists();
    const actions = getSafeActions();
    let selected = actions.filter(act => act.selected);

    if (selected.length === 0) {
        saveHistoryState();
        let safeTime = 0;
        try { safeTime = typeof window.getActualTimeMs === 'function' ? window.getActualTimeMs() : 0; } catch(e){}
        const timeMs = Math.round(safeTime);
        const existingIdx = actions.findIndex(a => Math.abs(a.at - timeMs) <= 15);
        if (existingIdx !== -1) { 
            actions[existingIdx].isSync = !actions[existingIdx].isSync; 
            actions[existingIdx].selected = false; 
        } 
        else { 
            actions.push({ at: timeMs, pos: 50, selected: false, isSync: true }); 
        }
        cleanDuplicates();
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        notifyCloud(); window.updateHeatmapAndStats(); window.drawTimeline();
    } else {
        let moved = false;
        actions.forEach(act => { 
            if (act.selected) { 
                act.isSync = !act.isSync; 
                act.selected = false; 
                moved = true; 
            } 
        });
        if (moved) { saveHistoryState(); window.drawTimeline(); notifyCloud(); }
    }
});

window.addEventListener('injectPoint', function(e) {
    if (document.body.classList.contains('panic-mode-active')) return;
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;
    
    ensureTrackExists(); 
    const actions = getSafeActions();

    let safeTime = 0;
    try { safeTime = typeof window.getActualTimeMs === 'function' ? window.getActualTimeMs() : 0; } catch(e){}
    const timeMs = Math.round(safeTime);
    
    const sliderA = document.getElementById('min-slider'); 
    const sliderB = document.getElementById('max-slider');
    const valA = parseInt(sliderA?.value || '20', 10); 
    const valB = parseInt(sliderB?.value || '70', 10);
    const currentMin = Math.min(valA, valB); 
    const currentMax = Math.max(valA, valB);
    let pos = (e.detail.dir === 'up') ? currentMax : currentMin;

    saveHistoryState();
    actions.forEach(a => { a.selected = false; }); 
    
    const existingIdx = actions.findIndex(a => Math.abs(a.at - timeMs) <= 15);
    if (existingIdx !== -1) { 
        actions[existingIdx].pos = pos; 
        actions[existingIdx].at = timeMs;
        actions[existingIdx].selected = true; 
    } 
    else { 
        actions.push({ at: timeMs, pos: pos, selected: true }); 
    }
    
    if (window.timelineMarkers) window.timelineMarkers.forEach(m => m.selected = false);

    cleanDuplicates();
    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    notifyCloud(); window.updateHeatmapAndStats(); 
    window.drawTimeline();
});

window.addEventListener('nudgeTime', function(e) {
    if (document.body.classList.contains('panic-mode-active')) return;
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;
    
    const actions = getSafeActions(); const dir = e.detail; let moved = false;
    saveHistoryState();

    let hasSelection = actions.some(a => a.selected);
    if (!hasSelection) {
        const closest = getPointUnderPlayhead(actions);
        if (closest) closest.selected = true; 
    }

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
        notifyCloud(); window.updateHeatmapAndStats();
        window.drawTimeline();
    }
});

window.addEventListener('nudgePoints', function(e) {
    if (document.body.classList.contains('panic-mode-active')) return;
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;

    const actions = getSafeActions(); const dir = e.detail; let moved = false;
    const snap = window.snapValue || 5;
    saveHistoryState();
    
    let hasSelection = actions.some(a => a.selected);
    if (!hasSelection) {
        const closest = getPointUnderPlayhead(actions);
        if (closest) closest.selected = true; 
    }

    actions.forEach(act => {
        if (act.selected) {
            if (dir === 'up') {
                if (snap > 1 && act.pos % snap !== 0) act.pos = Math.ceil(act.pos / snap) * snap;
                else act.pos = Math.min(100, act.pos + snap);
            }
            if (dir === 'down') {
                if (snap > 1 && act.pos % snap !== 0) act.pos = Math.floor(act.pos / snap) * snap;
                else act.pos = Math.max(0, act.pos - snap);
            }
            moved = true;
        }
    });
    
    if (moved) {
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        notifyCloud(); window.updateHeatmapAndStats(); 
        window.drawTimeline();
    }
});

window.addEventListener('magnetPoint', function() {
    if (document.body.classList.contains('panic-mode-active')) return;
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;
    const actions = getSafeActions();
    let safeTime = 0;
    try { safeTime = typeof window.getActualTimeMs === 'function' ? window.getActualTimeMs() : 0; } catch(e){}
    const timeMs = Math.round(safeTime);
    let moved = false; saveHistoryState();

    let hasSelection = actions.some(a => a.selected);
    if (!hasSelection) {
        const closest = getPointUnderPlayhead(actions);
        if (closest) closest.selected = true; 
    }

    actions.forEach(act => { if (act.selected) { act.at = timeMs; moved = true; } });
    if (moved) {
        cleanDuplicates();
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        notifyCloud(); window.updateHeatmapAndStats();
        window.drawTimeline();
    }
});

window.addEventListener('deletePoints', () => {
    if (document.body.classList.contains('panic-mode-active')) return; 
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;

    let deletedMarker = false;
    const initialMarkerCount = window.timelineMarkers.length;
    window.timelineMarkers = window.timelineMarkers.filter(m => !m.selected);
    if (window.timelineMarkers.length !== initialMarkerCount) {
        deletedMarker = true;
    }

    const actions = getSafeActions();
    let hasSelection = actions.some(a => a.selected);
    if (!hasSelection && !deletedMarker) {
        const closest = getPointUnderPlayhead(actions);
        if (closest) closest.selected = true; 
    }
    
    if (actions.some(a => a.selected) || deletedMarker) {
        saveHistoryState();
        actions.splice(0, actions.length, ...actions.filter(a => !a.selected));
        notifyCloud(); window.updateHeatmapAndStats();
        window.drawTimeline();
    }
});

window.addEventListener('undoAction', () => { 
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;
    undo(); 
});
window.addEventListener('redoAction', () => { 
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;
    redo(); 
});

window.addEventListener('selectAllPoints', () => {
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;
    getSafeActions().forEach(a => a.selected = true);
    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    window.drawTimeline();
});

window.addEventListener('copyPoints', () => {
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;
    const selected = getSafeActions().filter(a => a.selected);
    if (selected.length > 0) {
        const baseTime = selected[0].at;
        window.clipboardFunscript = selected.map(a => ({ at: a.at - baseTime, pos: Math.round(a.pos), isSync: a.isSync||false }));
    }
});

window.addEventListener('pastePoints', () => {
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;
    if (window.clipboardFunscript && window.clipboardFunscript.length > 0) {
        getSafeActions().forEach(a => a.selected = false); 
        window.isPastingMode = true;
        window.timelineGhostRandomSequence = [];
        window.timelineGhostRandomOffsets = []; // Limpieza total de entropía
        window.timelineGhostPreset = window.clipboardFunscript;
        window.timelineGhostTimeMs = null;
        if (window.lastMouseX !== undefined && window.lastMouseY !== undefined) {
            updateGhostPosition(window.lastMouseX, window.lastMouseY);
        }
        window.drawTimeline();
    }
});

window.updateGhostThumb = function() {
    const ghostThumb = document.getElementById('ghost-thumb');
    const videoNode = document.getElementById('video-player');
    const canvas = document.getElementById('timeline-canvas');
    
    if (!ghostThumb || !canvas) return;
    if (!videoNode || !videoNode.duration) { ghostThumb.style.display = 'none'; return; }

    const visibleMs = (canvas.width - 30) / (window.basePixelsPerMs * window.zoom);
    const centerTimeMs = window.scrollLeftMs + (visibleMs / 2);
    let safeTime = 0;
    try { safeTime = typeof window.getActualTimeMs === 'function' ? window.getActualTimeMs() : 0; } catch(e){}
    const actualTimeMs = safeTime;

    if (Math.abs(centerTimeMs - actualTimeMs) > visibleMs * 0.05) {
        ghostThumb.style.display = 'block';
        const percentage = (centerTimeMs / (videoNode.duration * 1000)) * 100;
        ghostThumb.style.left = `${Math.max(0, Math.min(100, percentage))}%`;
    } else {
        ghostThumb.style.display = 'none';
    }
};

window.updateHeatmapAndStats = function() {
    const actions = getSafeActions();
    const statsSpan = document.getElementById('timeline-stats');
    if (statsSpan) {
        let speedText = "--";
        const isLight = document.body.classList.contains('light-theme');
        let colorHtml = isLight ? "#94a3b8" : "#94a3b8"; 

        if (actions.length > 1) {
            let totalSegmentSpeed = 0; let validSegments = 0;
            for (let i = 1; i < actions.length; i++) {
                let dt = (actions[i].at - actions[i-1].at) / 1000.0;
                let dp = Math.abs(actions[i].pos - actions[i-1].pos);
                if (dt > 0) { totalSegmentSpeed += (dp / dt); validSegments++; }
            }
            if (validSegments > 0) {
                const fapTapSpeed = Math.round(totalSegmentSpeed / validSegments);
                if (fapTapSpeed >= 501) { speedText = `Muy Rápido (${fapTapSpeed})`; colorHtml = isLight ? "#dc2626" : "#ef4444"; } 
                else if (fapTapSpeed >= 301) { speedText = `Rápido (${fapTapSpeed})`; colorHtml = isLight ? "#ea580c" : "#f97316"; } 
                else if (fapTapSpeed >= 151) { speedText = `Medio (${fapTapSpeed})`; colorHtml = isLight ? "#ca8a04" : "#facc15"; } 
                else { speedText = `Lento (${fapTapSpeed})`; colorHtml = isLight ? "#059669" : "#10b981"; } 
            }
        } else if (actions.length === 1) {
            speedText = "Lento (0)"; colorHtml = document.body.classList.contains('light-theme') ? "#059669" : "#10b981";
        }
        statsSpan.innerHTML = `Puntos: <strong style="color:var(--text-main, #e2e8f0);">${actions.length}</strong> &nbsp;|&nbsp; Vel: <strong style="color: ${colorHtml};">${speedText}</strong>`;
    }

    const hCanvas = document.getElementById('heatmap-canvas');
    if (!hCanvas) return;
    
    const videoNode = document.getElementById('video-player');
    let totalDurationMs = videoNode && videoNode.duration ? videoNode.duration * 1000 : (actions.length > 0 ? actions[actions.length - 1].at : 0);
    const hCtx = hCanvas.getContext('2d');
    
    if (totalDurationMs <= 0 || hCanvas.getBoundingClientRect().width === 0) { 
        hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height); 
        return; 
    }
    
    hCanvas.width = hCanvas.getBoundingClientRect().width;
    hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);

    if (actions.length > 1) {
        const minBlockWidth = 4; 
        const bucketCount = Math.max(1, Math.floor(hCanvas.width / minBlockWidth)); 
        const bucketDuration = totalDurationMs / bucketCount;
        
        const bucketSpeeds = new Array(bucketCount).fill(-1); 
        const device = window.hardwareDB[window.activeDevice] || window.hardwareDB['handy_std'];

        for (let i = 1; i < actions.length; i++) {
            let a1 = actions[i-1]; let a2 = actions[i];
            let dt = a2.at - a1.at; let dp = Math.abs(a2.pos - a1.pos);
            if (dt > 0) {
                let speed = (dp * device.factor) / (dt / 1000); 
                let startB = Math.floor(a1.at / bucketDuration);
                let endB = Math.floor(a2.at / bucketDuration);
                startB = Math.max(0, Math.min(bucketCount - 1, startB));
                endB = Math.max(0, Math.min(bucketCount - 1, endB));

                if (dt > 2000) {
                    bucketSpeeds[startB] = Math.max(bucketSpeeds[startB] === -1 ? 0 : bucketSpeeds[startB], speed);
                    bucketSpeeds[endB] = Math.max(bucketSpeeds[endB] === -1 ? 0 : bucketSpeeds[endB], speed);
                } else {
                    for (let b = startB; b <= endB; b++) {
                        bucketSpeeds[b] = Math.max(bucketSpeeds[b] === -1 ? 0 : bucketSpeeds[b], speed);
                    }
                }
            }
        }

        const bucketWidth = hCanvas.width / bucketCount;
        for (let i = 0; i < bucketCount; i++) {
            if (bucketSpeeds[i] !== -1) { 
                let speed = bucketSpeeds[i];
                let intensity = Math.min(1.0, speed / 400); 
                let hue = 120 - (intensity * 120); 
                hCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                hCtx.fillRect(i * bucketWidth, 0, Math.ceil(bucketWidth) + 0.5, hCanvas.height);
            }
        }
    }
};

const originalUpdateActionsLog = window.updateActionsLog;
window.updateActionsLog = function() {
    if (typeof originalUpdateActionsLog === 'function') originalUpdateActionsLog();
    window.updateHeatmapAndStats();
};

function updateGhostPosition(mouseX, mouseY) {
    if (!window.timelineGhostPreset) return;
    
    let primaryPreset = Array.isArray(window.timelineGhostPreset[0]) ? window.timelineGhostPreset[0] : window.timelineGhostPreset;
    
    let hoverTimeMs = xToTime(mouseX);
    let hoverPosRaw = yToPos(mouseY);
    
    window.timelineGhostMouseX = mouseX;
    window.timelineGhostMouseY = mouseY;
    
    const selectedMarkers = window.timelineMarkers.filter(m => m.selected).sort((a,b) => a.at - b.at);
    const actions = getSafeActions();
    
    // 🎯 FIX: Lectura inteligente de Anclas Físicas (isSync)
    let pAnchors = primaryPreset.filter(a => a.isSync).sort((a,b) => a.at - b.at);
    
    // CORRECCIÓN: Filtrar solo anclas seleccionadas explícitamente para el MODO A (evitando leer todo el documento)
    let tAnchors = actions.filter(a => a.isSync && a.selected).sort((a,b) => a.at - b.at);
    
    // Si no hay anclas seleccionadas, buscamos el ancla más cercana en un radio de 300ms (MODO B - Imantado sutil)
    if (tAnchors.length === 0) {
        let closest = actions.filter(a => a.isSync).find(a => Math.abs(a.at - hoverTimeMs) < 300);
        if (closest) tAnchors.push(closest);
    }

    window.timelineGhostTargetAnchor = null;

    // MODO A: Estiramiento/Compresión (2 o más anclas detectadas en ambas partes)
    if (tAnchors.length >= 2 && pAnchors.length >= 2) {
        let tStart = tAnchors[0].at;
        let tEnd = tAnchors[tAnchors.length - 1].at;
        let pStart = pAnchors[0].at;
        let pEnd = pAnchors[pAnchors.length - 1].at;
        
        if (pEnd > pStart && tEnd > tStart) {
            let scale = (tEnd - tStart) / (pEnd - pStart);
            
            window.timelineGhostTimeMs = Math.max(0, tStart - (pStart * scale));
            
            let fullPresetDuration = primaryPreset[primaryPreset.length - 1].at;
            window.timelineGhostTargetEnd = window.timelineGhostTimeMs + (fullPresetDuration * scale);
            
            if (!window.presetFillInitialized) {
                window.presetFillReps = 1; 
                window.presetFillInitialized = true;
            }
            return; 
        }
    }
    
    // MODO B: Ajuste posicional de 1 sola ancla (Sincronización base)
    if (tAnchors.length === 1 && pAnchors.length >= 1) {
        window.timelineGhostTimeMs = Math.max(0, tAnchors[0].at - pAnchors[0].at);
        window.timelineGhostTargetEnd = null; 
        window.presetFillInitialized = false;
        return;
    }

    // MODO C: Estiramiento Clásico por Marcadores de Color
    if (selectedMarkers.length >= 2) {
        window.timelineGhostTimeMs = selectedMarkers[0].at;
        window.timelineGhostTargetEnd = selectedMarkers[selectedMarkers.length - 1].at;
        window.timelineGhostMarkers = selectedMarkers;

        if (!window.presetFillInitialized) {
            const pDur = primaryPreset[primaryPreset.length - 1].at;
            window.presetFillReps = Math.max(1, Math.round((window.timelineGhostTargetEnd - window.timelineGhostTimeMs) / pDur));
            window.presetFillInitialized = true;
        }
        return;
    } 
    
    // MODO D: Pegado Libre (Inyección con imantado por proximidad general)
    window.timelineGhostMarkers = null;
    window.timelineGhostTargetEnd = null;
    window.presetFillInitialized = false;

    let safeTime = 0;
    try { safeTime = typeof window.getActualTimeMs === 'function' ? window.getActualTimeMs() : 0; } catch(e){}
    const playheadTimeMs = Math.round(safeTime);
    const snapTargets = [playheadTimeMs, ...actions.map(a => a.at)];
    const snapDistMs = 250; 
    let bestOffset = hoverTimeMs;
    let minDistance = snapDistMs;
    let isSnapped = false;

    const pointsToCheck = [primaryPreset[0]];
    if (primaryPreset.length > 1) pointsToCheck.push(primaryPreset[primaryPreset.length - 1]);
    
    pointsToCheck.forEach(pAct => {
        let projectedTime = hoverTimeMs + pAct.at;
        for (let i = 0; i < snapTargets.length; i++) {
            let dist = Math.abs(projectedTime - snapTargets[i]);
            if (dist < minDistance) {
                minDistance = dist;
                bestOffset = snapTargets[i] - pAct.at;
                isSnapped = true;
            }
        }
    });

    window.timelineGhostTimeMs = Math.max(0, isSnapped ? bestOffset : hoverTimeMs);
    
    const snap = window.snapValue || 5;
    let hoverPos = Math.round(hoverPosRaw / snap) * snap;
    const basePos = primaryPreset[0].pos;
    window.timelineGhostDeltaPos = hoverPos - basePos;
}

// ==========================================
// GENERADOR DE PUNTOS FANTASMA (AUTO-AJUSTE)
// ==========================================
window.generateGhostPoints = function() {
    if (!window.timelineGhostPreset || window.timelineGhostTimeMs === null) return [];

    let tMaxNode = document.getElementById('multi-max');
    let tMinNode = document.getElementById('multi-min');
    let tRandNode = document.getElementById('multi-rand');

    let presetToInject = window.timelineGhostPreset;
    
    // VERIFICACIÓN INTELIGENTE: ¿Es una selección múltiple o 1 solo preset/copia?
    let isMulti = Array.isArray(presetToInject[0]) && presetToInject.length > 1;
    
    let primaryPreset = Array.isArray(presetToInject[0]) ? presetToInject[0] : presetToInject;
    if (primaryPreset.length === 0) return [];

    let pDuration = primaryPreset[primaryPreset.length - 1].at - primaryPreset[0].at;
    let pMin = Math.min(...primaryPreset.map(a => a.pos));
    let pMax = Math.max(...primaryPreset.map(a => a.pos));
    if (pMax === pMin) pMax = pMin + 1; 

    let tMax, tMin, tRand;

    if (isMulti) {
        // Múltiples presets: Aplicar el panel del Multiplicador
        tMax = tMaxNode ? Number(tMaxNode.value) : 100;
        tMin = tMinNode ? Number(tMinNode.value) : 0;
        tRand = tRandNode ? Number(tRandNode.value) : 0;

        if (isNaN(tMax)) tMax = 100;
        if (isNaN(tMin)) tMin = 0;
        if (isNaN(tRand)) tRand = 0;
        if (tMax < tMin) tMax = tMin + 1; 
    } else {
        // Solo 1 preset o pegado (Ctrl+V): Mantiene EXACTAMENTE su tamaño original
        tMax = pMax;
        tMin = pMin;
        tRand = 0;
    }

    let dropTimeMs = window.timelineGhostTimeMs;
    let targetEnd = window.timelineGhostTargetEnd;
    let reps = window.presetFillReps || 1;

    let timeScale = 1.0;
    
    if (targetEnd && reps > 0 && pDuration > 0) {
        let availableSpace = targetEnd - dropTimeMs;
        timeScale = availableSpace / (pDuration * reps);
    }

    // ARREGLO DE LA VIBRACIÓN: Memoria de entropía pura estática (0.0 a 1.0)
    if (!window.timelineGhostRandomOffsets) window.timelineGhostRandomOffsets = [];

    let ghostPoints = [];
    for (let r = 0; r < reps; r++) {
        // Solo inyectar nueva entropía si agregamos más repeticiones con la rueda
        if (window.timelineGhostRandomOffsets.length <= r) {
            window.timelineGhostRandomOffsets.push(Math.random());
        }
        
        let currentBaseOffset = Math.floor(window.timelineGhostRandomOffsets[r] * (tRand + 1));
        if (!isMulti) currentBaseOffset = 0; // Bloqueo de seguridad para copias 
        
        let currentTMin = Math.min(100, tMin + currentBaseOffset);
        let currentTMax = Math.max(currentTMin + 1, tMax); 

        let startOffset = dropTimeMs + (r * pDuration * timeScale);
        let sequence = Array.isArray(presetToInject[0])
            ? presetToInject[(window.timelineGhostRandomSequence?.[r] || 0) % presetToInject.length]
            : primaryPreset;

        sequence.forEach((act, idx) => {
            if (r > 0 && idx === 0 && act.at === 0) return; 
            
            let mappedPos = currentTMin + ((act.pos - pMin) / (pMax - pMin)) * (currentTMax - currentTMin);

            ghostPoints.push({
                at: startOffset + (act.at * timeScale),
                pos: Math.max(0, Math.min(100, mappedPos)),
                isSync: act.isSync || false
            });
        });
    }
    return ghostPoints;
};

// ==========================================
// INYECCIÓN DE PRESET
// ==========================================
window.injectGhostPreset = function(clientX, clientY) {
    if (!window.isDraggingPreset || !window.timelineGhostPreset) return;

    const generatedPoints = window.generateGhostPoints();
    if (!generatedPoints || generatedPoints.length === 0) {
        resetGhostState();
        return;
    }

    setTimeout(() => {
        ensureTrackExists();
        let actions = getSafeActions();
        const snap = window.snapValue || 5;
        saveHistoryState();

        let tStart = generatedPoints[0].at;
        let tEnd = generatedPoints[generatedPoints.length - 1].at;

        // CORRECCIÓN: Ampliación del rango de limpieza a 15ms en ambos bordes (<= en lugar de <)
        // Garantiza que la sobreescritura barra las anclas residuales que causaban colisiones microscópicas
        actions.splice(0, actions.length, ...actions.filter(a => a.at <= (tStart - 15) || a.at >= (tEnd + 15)));
        actions.forEach(a => a.selected = false);

        let newActions = generatedPoints.map(p => ({
            at: Math.round(p.at),
            pos: Math.round(p.pos / snap) * snap,
            selected: true,
            isSync: p.isSync
        }));

        actions.push(...newActions);
        cleanDuplicates(); 
        resetGhostState();
    }, 10);
};

function resetGhostState() {
    window.isDraggingPreset = false;
    window.timelineGhostPreset = null;
    window.presetFillInitialized = false;
    window.timelineGhostTargetEnd = null;
    window.timelineGhostMarkers = null;
    window.timelineGhostTargetAnchor = null;
    window.timelineGhostTimeMs = null;
    window.timelineGhostDeltaPos = 0;
    window.timelineGhostRandomSequence = [];
    window.timelineGhostRandomOffsets = []; // Limpieza de entropía estática
    window.presetFillReps = 1; 
    if (window.timelineMarkers) window.timelineMarkers.forEach(m => m.selected = false);
    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    notifyCloud();
    window.updateHeatmapAndStats();
    window.drawTimeline();
}

// ==========================================
// NÚCLEO DEL CANVAS Y DIBUJADO
// ==========================================
window.calculateAdaptiveZoom = function() { window.basePixelsPerMs = 0.1; };

function ensureCanvasSize() {
    const cvs = document.getElementById('timeline-canvas');
    if (!cvs) return false;
    const parent = cvs.parentElement;
    if (parent && (cvs.width !== parent.clientWidth || cvs.height !== parent.clientHeight)) {
        cvs.width = parent.clientWidth; cvs.height = parent.clientHeight;
        if (typeof window.calculateAdaptiveZoom === 'function') window.calculateAdaptiveZoom();
    }
    return true;
}

window.drawTimeline = function() {
    try {
        if (!ensureCanvasSize()) return;
        const canvas = document.getElementById('timeline-canvas');
        if (!canvas || canvas.width === 0 || canvas.height === 0) return; 
        
        if (isNaN(window.scrollLeftMs)) window.scrollLeftMs = 0;
        if (isNaN(window.zoom) || window.zoom <= 0) window.zoom = 1.0;
        if (isNaN(window.basePixelsPerMs) || window.basePixelsPerMs <= 0) window.basePixelsPerMs = 0.1;

        const ctx = canvas.getContext('2d');
        
        let safeTime = 0;
        try { safeTime = typeof window.getActualTimeMs === 'function' ? window.getActualTimeMs() : 0; } catch(e){}
        let actualTime = isNaN(safeTime) ? 0 : safeTime;
        
        const videoNode = document.getElementById('video-player');
        if ((videoNode && !videoNode.paused) || window.isPlayingVirtual) {
            const visibleMs = (canvas.width - 30) / (window.basePixelsPerMs * window.zoom);
            window.scrollLeftMs = actualTime - (visibleMs / 2);
            if (window.scrollLeftMs < 0) window.scrollLeftMs = 0;
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

        if (document.body.classList.contains('panic-mode-active')) {
            const visibleStartMs = window.scrollLeftMs;
            const visibleEndMs = window.scrollLeftMs + (canvas.width - 30) / (window.basePixelsPerMs * window.zoom);
            let stepMs = 1000;
            const startTimeMs = Math.max(0, xToTime(30));
            const endTimeMs = xToTime(canvas.width);
            
            if (!isFinite(endTimeMs) || stepMs <= 0) return;
            
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

            const trackY1 = 40;  
            const trackY2 = 90;  
            const trackH = 40;
            const clipMs = 25000; 
            const gapMs = 500;    
            const startIdx = Math.floor(visibleStartMs / (clipMs + gapMs));
            const endIdx = Math.ceil(visibleEndMs / (clipMs + gapMs));

            ctx.lineWidth = 1;
            for (let i = startIdx; i <= endIdx; i++) {
                const cStartMs = i * (clipMs + gapMs);
                const cEndMs = cStartMs + clipMs;
                const startX = Math.max(30, timeToX(cStartMs));
                const endX = timeToX(cEndMs);
                const w = endX - startX;

                if (w > 0) {
                    ctx.fillStyle = isLight ? '#bae6fd' : '#0ea5e9';
                    ctx.strokeStyle = isLight ? '#38bdf8' : '#0284c7';
                    ctx.beginPath(); ctx.rect(startX, trackY1, w, trackH); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = isLight ? '#0c4a6e' : '#f0f9ff'; ctx.font = 'bold 11px sans-serif';
                    ctx.fillText(`Cam_0${(i%3)+1}_final.mp4`, startX + 8, trackY1 + 16);

                    ctx.fillStyle = isLight ? '#bbf7d0' : '#10b981';
                    ctx.strokeStyle = isLight ? '#34d399' : '#059669';
                    ctx.beginPath(); ctx.rect(startX, trackY2, w, trackH); ctx.fill(); ctx.stroke();
                    
                    ctx.strokeStyle = isLight ? '#064e3b' : '#a7f3d0';
                    ctx.beginPath();
                    for (let px = startX + 2; px < endX - 2; px += 4) {
                        const waveH = fakeRandom(px + i) * (trackH - 12) + 6;
                        ctx.moveTo(px, trackY2 + trackH/2 - waveH/2);
                        ctx.lineTo(px, trackY2 + trackH/2 + waveH/2);
                    }
                    ctx.stroke();
                }
            }

            ctx.fillStyle = colBgColor; ctx.fillRect(0, 0, 30, canvas.height);
            ctx.strokeStyle = colBorder; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(30, canvas.height); ctx.stroke();

            const playheadX = timeToX(actualTime);
            if (playheadX >= 30) {
                ctx.lineWidth = 2; ctx.strokeStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(playheadX, 0); ctx.lineTo(playheadX, canvas.height); ctx.stroke();
                ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(playheadX - 6, 0); ctx.lineTo(playheadX + 6, 0); ctx.lineTo(playheadX, 8); ctx.closePath(); ctx.fill();
            }
            return; 
        }

        if (window.audioPeaks && window.audioPeaksSampleRate && window.audioMaxPeak) {
            const isMuted = videoNode && (videoNode.muted || videoNode.volume === 0);
            ctx.fillStyle = isMuted ? 'rgba(239, 68, 68, 0.4)' : (isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(255, 255, 255, 0.25)'); 
            ctx.beginPath();
            const startIdx = Math.max(0, Math.floor(xToTime(30) / 1000 * window.audioPeaksSampleRate));
            const endIdx = Math.min(window.audioPeaks.length - 1, Math.ceil(xToTime(canvas.width) / 1000 * window.audioPeaksSampleRate));
            const yCenter = canvas.height / 2;
            const boostHeight = canvas.height * 0.40; 
            
            let started = false;
            for(let i = startIdx; i <= endIdx; i++) {
                const timeMs = (i / window.audioPeaksSampleRate) * 1000;
                const x = timeToX(timeMs);
                if (x >= 30) {
                    const amplitude = (window.audioPeaks[i].max / window.audioMaxPeak) * boostHeight; 
                    if (!started) { ctx.moveTo(x, yCenter - amplitude); started = true; }
                    else { ctx.lineTo(x, yCenter - amplitude); }
                }
            }
            for(let i = endIdx; i >= startIdx; i--) {
                const timeMs = (i / window.audioPeaksSampleRate) * 1000;
                const x = timeToX(timeMs);
                if (x >= 30) {
                    const amplitude = (Math.abs(window.audioPeaks[i].min) / window.audioMaxPeak) * boostHeight; 
                    ctx.lineTo(x, yCenter + amplitude);
                }
            }
            ctx.closePath();
            ctx.fill();
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

        const visibleMs = (canvas.width - 30) / (window.basePixelsPerMs * window.zoom);
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
        
        if (!isFinite(endTimeMs) || stepMs <= 0) return; 

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

        ctx.fillStyle = colBgColor; ctx.fillRect(0, 0, 30, canvas.height);
        ctx.strokeStyle = colBorder; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(30, canvas.height); ctx.stroke();

        [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(p => {
            const y = posToY(p); 
            ctx.fillStyle = textDimColor; ctx.font = 'bold 10px monospace'; ctx.fillText(`${p}%`, 4, y + 3);
        });

        const actions = getSafeActions();

        ctx.save();
        let clipX = window.scrollLeftMs <= 0 ? 15 : 30; 
        ctx.beginPath();
        ctx.rect(clipX, 0, canvas.width - clipX, canvas.height);
        ctx.clip();

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

        if (isSelectingMarkers) {
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(217, 70, 239, 0.8)'; ctx.fillStyle = 'rgba(217, 70, 239, 0.15)';
            ctx.setLineDash([2, 2]); ctx.beginPath(); 
            const sX_m = timeToX(selStartMarkerT);
            const cX_m = timeToX(selCurrMarkerT);
            const xLeft = Math.min(sX_m, cX_m);
            const xRight = Math.max(sX_m, cX_m);
            ctx.fillRect(xLeft, 0, xRight - xLeft, 40); 
            ctx.strokeRect(xLeft, 0, xRight - xLeft, 40); 
            ctx.setLineDash([]);
        }

        if (window.timelineMarkers && window.timelineMarkers.length > 0) {
            let mCount = 1;
            let bCount = 1;
            window.timelineMarkers.forEach(m => { m.labelStr = m.isBPM ? `B${bCount++}` : `M${mCount++}`; });

            window.timelineMarkers.forEach((m) => {
                const mx = timeToX(m.at);
                if (mx >= 15) { 
                    let alpha = m.selected ? (0.5 + 0.5 * Math.abs(Math.sin(performance.now() / 150))) : 1.0;
                    let baseColor = m.isBPM ? '#0ea5e9' : '#d946ef';
                    let selColor = '#facc15';
                    let color = m.selected ? selColor : baseColor;

                    ctx.globalAlpha = alpha;
                    ctx.strokeStyle = color; 
                    ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
                    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, canvas.height); ctx.stroke();
                    ctx.setLineDash([]);

                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.rect(mx - 15, 0, 30, 25);
                    ctx.fill();

                    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
                    ctx.fillText(m.labelStr, mx, 16); 
                    ctx.textAlign = 'left';
                    ctx.globalAlpha = 1.0;
                }
            });
        }

        if (actions.length > 0) {
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            const device = window.hardwareDB[window.activeDevice] || window.hardwareDB['handy_std'];
            let hwMax = device.standard.max;
            let hwMin = device.standard.min;
            
            for (let i = 0; i < actions.length - 1; i++) {
                const act1 = actions[i]; const act2 = actions[i+1];
                const x1 = timeToX(act1.at); const y1 = posToY(act1.pos);
                const x2 = timeToX(act2.at); const y2 = posToY(act2.pos);

                let dt_ms = act2.at - act1.at;
                let dp = Math.abs(act2.pos - act1.pos);
                let speed_mms = 0;
                if (dt_ms > 0) speed_mms = (dp * device.factor) / (dt_ms / 1000);

                let colorNormal = isLight ? '#0284c7' : '#38bdf8'; 
                let lineColor = colorNormal; 
                
                const tPulse = performance.now() / 150;
                const pulseFactor = 0.5 + 0.5 * Math.sin(tPulse); 
                
                if (speed_mms > hwMax) {
                    lineColor = isLight ? `rgba(220, 38, 38, ${0.6 + 0.4 * pulseFactor})` : `rgba(239, 68, 68, ${0.4 + 0.6 * pulseFactor})`; 
                } else if (speed_mms < hwMin && dp > 0) {
                    lineColor = isLight ? `rgba(217, 119, 6, ${0.7 + 0.3 * pulseFactor})` : `rgba(250, 204, 21, ${0.4 + 0.6 * pulseFactor})`; 
                }
                
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            actions.forEach((act, i) => {
                const x = timeToX(act.at);
                if (x >= 20 && x <= canvas.width + 20) {
                    const y = posToY(act.pos); 

                    if (act.isSync) {
                        ctx.fillStyle = '#facc15'; 
                        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
                        
                        ctx.fillStyle = '#0f172a'; 
                        ctx.font = '12px monospace'; 
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText('⚓', x, y+1); 
                        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
                    } else {
                        let dotColor = isLight ? '#0284c7' : '#38bdf8';
                        if (i > 0) {
                            let prevAct = actions[i-1];
                            let dt_ms = act.at - prevAct.at;
                            let dp = Math.abs(act.pos - prevAct.pos);
                            let speed_mms = dt_ms > 0 ? (dp * device.factor) / (dt_ms / 1000) : 0;
                            const tPulse = performance.now() / 150;
                            const pulseFactor = 0.5 + 0.5 * Math.sin(tPulse); 
                            
                            if (speed_mms > hwMax) dotColor = isLight ? `rgba(220, 38, 38, ${0.6 + 0.4 * pulseFactor})` : `rgba(239, 68, 68, ${0.5 + 0.5 * pulseFactor})`; 
                            else if (speed_mms < hwMin && dp > 0) dotColor = isLight ? `rgba(217, 119, 6, ${0.7 + 0.3 * pulseFactor})` : `rgba(250, 204, 21, ${0.5 + 0.5 * pulseFactor})`; 
                        }
                        if (act.selected) dotColor = isLight ? '#d97706' : '#f59e0b'; 

                        ctx.fillStyle = dotColor;
                        ctx.beginPath(); ctx.arc(x, y, act.selected ? 7 : 5, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
                    }
                    
                    if ((videoNode && videoNode.paused && !window.isPlayingVirtual) && !document.body.classList.contains('panic-mode-active')) {
                        ctx.textAlign = 'center';
                        ctx.font = 'bold 9px monospace';
                        ctx.fillStyle = isLight ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.75)';
                        ctx.beginPath(); ctx.roundRect(x - 12, y - 18, 24, 11, 3); ctx.fill();
                        ctx.fillStyle = isLight ? '#0f172a' : '#e2e8f0';
                        ctx.fillText(`${act.pos}%`, x, y - 10);
                        ctx.textAlign = 'left';
                    }
                }
            });
        }

        // ==========================================
        // DIBUJO DEL FANTASMA (CON AUTO-AJUSTE Y LECTURA DEL MULTIPLICADOR)
        // ==========================================
        if ((window.isDraggingPreset || window.isPastingMode) && window.timelineGhostTimeMs !== null) {
            const ghostPoints = window.generateGhostPoints(); // ← Solicita la matemática del motor nuevo
            
            if (ghostPoints && ghostPoints.length > 0) {
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                
                ghostPoints.forEach((p, i) => {
                    const px = timeToX(p.at);
                    const py = posToY(p.pos); // ← Refleja perfectamente tu panel multiplicador
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                ctx.stroke();
                ctx.setLineDash([]);

                ghostPoints.forEach(p => {
                    const px = timeToX(p.at);
                    const py = posToY(p.pos);
                    if (px >= 20 && px <= canvas.width) {
                        if (p.isSync) {
                            ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
                            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
                            ctx.fillStyle = '#0f172a'; ctx.font = '10px monospace'; 
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚓', px, py+1); 
                            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
                        } else {
                            ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
                            ctx.beginPath();
                            ctx.arc(px, py, 4, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                });

                const pasteX = window.timelineGhostMouseX !== undefined ? window.timelineGhostMouseX : timeToX(window.timelineGhostTimeMs);
                const pasteY = window.timelineGhostMouseY !== undefined ? window.timelineGhostMouseY : posToY(50);
                
                ctx.fillStyle = '#38bdf8';
                ctx.font = 'bold 12px monospace';
                if (window.isPastingMode) {
                    ctx.fillText(`📋 PEGAR MÚLTIPLE (${window.presetFillReps || 1}x) (Rueda Ratón) (ESC cancelar)`, pasteX + 15, pasteY + 30);
                } else if (window.isDraggingPreset) {
                    ctx.fillText(`✋ SOLTAR AQUÍ (${window.presetFillReps || 1}x) (Rueda Ratón)`, pasteX + 15, pasteY + 30);
                }
            }
        }

        if (isSelecting) {
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.setLineDash([2, 2]); ctx.beginPath(); 
            const sX = timeToX(selStartT);
            const cX = timeToX(selCurrT);
            const topLimit = posToY(100);
            const sY = Math.max(topLimit, selStartY);
            const cY = Math.max(topLimit, selCurrY);
            const xLeft = Math.min(sX, cX);
            const yTop = Math.min(sY, cY);
            ctx.fillRect(xLeft, yTop, Math.abs(cX - sX), Math.abs(cY - sY)); 
            ctx.strokeRect(xLeft, yTop, Math.abs(cX - sX), Math.abs(cY - sY)); 
            ctx.setLineDash([]);
        }

        ctx.restore(); 

        const playheadX = timeToX(actualTime);
        if (playheadX >= 30) {
            ctx.lineWidth = 2; ctx.strokeStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(playheadX, 0); ctx.lineTo(playheadX, canvas.height); ctx.stroke();
            ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(playheadX - 6, 0); ctx.lineTo(playheadX + 6, 0); ctx.lineTo(playheadX, 8); ctx.closePath(); ctx.fill();
        }

        if (Math.abs(window.scrollMomentum) > 0.5) {
            const alpha = Math.min(0.5, Math.abs(window.scrollMomentum) / 20);
            if (window.scrollMomentum > 0) {
                const grad = ctx.createLinearGradient(canvas.width - 100, 0, canvas.width, 0);
                grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
                grad.addColorStop(1, `rgba(56, 189, 248, ${alpha})`);
                ctx.fillStyle = grad;
                ctx.fillRect(canvas.width - 100, 0, 100, canvas.height);
            } else {
                const grad = ctx.createLinearGradient(30, 0, 130, 0);
                grad.addColorStop(0, `rgba(56, 189, 248, ${alpha})`);
                grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
                ctx.fillStyle = grad;
                ctx.fillRect(30, 0, 100, canvas.height);
            }
            
            window.scrollMomentum *= 0.9;
            if (Math.abs(window.scrollMomentum) < 0.5) window.scrollMomentum = 0;
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
                    
                    const fsTimeToX = (t) => 10 + (t - window.scrollLeftMs) * (window.basePixelsPerMs * window.zoom);
                    const fsPosToY = (p) => fsCanvas.height - 12 - (p/100)*(fsCanvas.height - 30);

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
    } catch (err) { 
        console.error("🔥 ERROR CRÍTICO AL DIBUJAR TIMELINE:", err);
    }
};

// ==========================================
// INICIALIZACIÓN DE EVENTOS DEL CANVAS
// ==========================================
function initTimelineEvents() {
    const c = document.getElementById('timeline-canvas');
    if (!c) return;

    function getMousePos(e) { 
        const rect = c.getBoundingClientRect(); 
        return { x: (e.clientX - rect.left) * (c.width / rect.width), y: (e.clientY - rect.top) * (c.height / rect.height) }; 
    }

    c.addEventListener('wheel', (e) => {
        if (window.isDraggingPreset || window.isPastingMode) {
            e.preventDefault();
            
            let maxReps = 999;
            if (window.timelineGhostPreset && window.timelineGhostTimeMs !== null) {
                let primary = Array.isArray(window.timelineGhostPreset[0]) ? window.timelineGhostPreset[0] : window.timelineGhostPreset;
                let pDuration = primary[primary.length - 1].at - primary[0].at;
                
                let availableSpace = 0;
                let actions = typeof getSafeActions === 'function' ? getSafeActions() : (window.funscriptActions || []);
                let nextAct = actions.find(a => a.at > window.timelineGhostTimeMs);
                
                if (nextAct) {
                    availableSpace = nextAct.at - window.timelineGhostTimeMs;
                } else {
                    const vNode = document.getElementById('video-player');
                    if (vNode && vNode.duration && !isNaN(vNode.duration)) {
                        availableSpace = (vNode.duration * 1000) - window.timelineGhostTimeMs;
                    } else {
                        availableSpace = 999999;
                    }
                }

                if (availableSpace > 0 && pDuration > 0) {
                    let minGap = 9999;
                    for(let i=1; i<primary.length; i++) {
                        let gap = primary[i].at - primary[i-1].at;
                        if (gap > 0 && gap < minGap) minGap = gap;
                    }
                    if(minGap === 9999) minGap = 50;

                    let absoluteMaxReps = Math.floor((minGap * availableSpace) / (15 * pDuration));
                    maxReps = Math.max(1, absoluteMaxReps);
                }
            }

            if (e.deltaY < 0) {
                window.presetFillReps = Math.min((window.presetFillReps || 1) + 1, maxReps);
            } else {
                window.presetFillReps = Math.max(1, (window.presetFillReps || 1) - 1);
            }
            
            if (!window.timelineGhostRandomSequence) window.timelineGhostRandomSequence = [];
            window.timelineGhostRandomSequence.push(Math.floor(Math.random() * 10)); 
            
            window.drawTimeline();
            return;
        }
        
        if (document.body.classList.contains('panic-mode-active')) return;
        e.preventDefault();
        
        let z = window.zoom || 1.0;
        let bpm = window.basePixelsPerMs || 0.1;
        let w = (c.width > 30) ? c.width - 30 : 800;

        if (e.shiftKey) {
            const mouseX = e.clientX - c.getBoundingClientRect().left;
            const timeAtMouse = window.scrollLeftMs + (mouseX - 30) / (bpm * z);
            
            z = Math.round((z + (e.deltaY < 0 ? 0.08 : -0.08)) * 100) / 100;
            z = Math.max(0.1, Math.min(z, 15.0)); 
            window.zoom = z;
            
            window.scrollLeftMs = timeAtMouse - (mouseX - 30) / (bpm * z);
            if (window.scrollLeftMs < 0) window.scrollLeftMs = 0; 
        } else {
            const panStep = (w / (bpm * z)) * 0.10; 
            if (e.deltaY < 0) {
                window.scrollLeftMs += panStep; 
                window.scrollMomentum = Math.min((window.scrollMomentum || 0) + 3, 10);
            } else {
                window.scrollLeftMs -= panStep; 
                window.scrollMomentum = Math.max((window.scrollMomentum || 0) - 3, -10);
            }
            if (window.scrollLeftMs < 0) window.scrollLeftMs = 0;

            const vNode = document.getElementById('video-player');
            if (vNode && vNode.duration && !isNaN(vNode.duration)) {
                const visibleMs = w / (bpm * z);
                const maxScroll = (vNode.duration * 1000) - visibleMs + 2000; 
                if (window.scrollLeftMs > maxScroll && maxScroll > 0) window.scrollLeftMs = maxScroll;
            }
        }
        
        if (isSelecting) {
            const mouseX = e.clientX - c.getBoundingClientRect().left;
            const mouseY = e.clientY - c.getBoundingClientRect().top;
            selCurrT = xToTime(mouseX);
            selCurrY = mouseY;
            const startX_px = timeToX(selStartT);
            if (Math.hypot(mouseX - startX_px, mouseY - selStartY) > 5) hasDraggedSelection = true;
            
            const minT = Math.min(selStartT, selCurrT); const maxT = Math.max(selStartT, selCurrT);
            const topLimit = posToY(100);
            const minY = Math.max(topLimit, Math.min(selStartY, selCurrY)); 
            const maxY = Math.max(topLimit, Math.max(selStartY, selCurrY));
            
            const actions = getSafeActions();
            actions.forEach(act => {
                const ny = posToY(act.pos);
                act.selected = (act.at >= minT && act.at <= maxT && ny >= minY && ny <= maxY);
            });
            if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        }

        window.drawTimeline();
    }, { passive: false });

    c.addEventListener('mousedown', (e) => {
        if (document.body.classList.contains('panic-mode-active')) return; 
        if (window.isPastingMode || window.isDraggingPreset) return; 

        const snap = window.snapValue || 5;
        const actions = getSafeActions();
        const pos = getMousePos(e);
        const clickX = pos.x; const clickY = pos.y;

        if (e.button === 0) { 
            let clickedMarker = false;
            if (window.timelineMarkers && window.timelineMarkers.length > 0) {
                for (let i = 0; i < window.timelineMarkers.length; i++) {
                    const m = window.timelineMarkers[i];
                    const mx = timeToX(m.at);
                    if (Math.abs(clickX - mx) <= 15 && clickY <= 40) { 
                        clickedMarker = true;
                        if (!e.ctrlKey) window.timelineMarkers.forEach(mk => mx !== m ? mk.selected = false : null);
                        m.selected = e.ctrlKey ? !m.selected : true;
                        if (m.selected && !e.ctrlKey) {
                            isDraggingMarker = true;
                            draggedMarkerIndex = i;
                        }
                        window.drawTimeline();
                        return; 
                    }
                }
            }

            if (!e.ctrlKey && clickY > 40) {
                window.timelineMarkers.forEach(m => m.selected = false);
            }

            if (clickY <= 40 && !clickedMarker) {
                isSelectingMarkers = true;
                selStartMarkerT = xToTime(clickX);
                selCurrMarkerT = selStartMarkerT;
                markerSelectionInitialStates = window.timelineMarkers.map(m => m.selected);
                if (!e.ctrlKey) window.timelineMarkers.forEach(m => m.selected = false);
                return; 
            }

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
                
                selStartT = xToTime(clickX);
                selStartY = clickY;
                selCurrT = selStartT;
                selCurrY = clickY;
            }
        } else if (e.button === 2) { 
            if (window.timelineMarkers && window.timelineMarkers.length > 0) {
                for (let i = 0; i < window.timelineMarkers.length; i++) {
                    const m = window.timelineMarkers[i];
                    const mx = timeToX(m.at);
                    if (Math.abs(clickX - mx) <= 15 && clickY <= 40) {
                        const now = performance.now();
                        if (window.lastMarkerRightClickIdx === i && (now - window.lastMarkerRightClickTime < 350)) {
                            window.setActualTimeMs(m.at);
                            window.dispatchEvent(new CustomEvent('forceTimelinePan', { detail: { timeMs: m.at } }));
                            window.drawTimeline();
                            if (typeof window.drawProgressMarkers === 'function') window.drawProgressMarkers();
                            window.lastMarkerRightClickIdx = -1;
                        } else {
                            window.lastMarkerRightClickIdx = i;
                            window.lastMarkerRightClickTime = now;
                        }
                        return; 
                    }
                }
            }

            let selectedCount = actions.filter(a => a.selected).length;
            if (selectedCount > 1 || window.activeSuggestion) {
                e.preventDefault();
                saveHistoryState();
                let wasFixed = false;
                if (selectedCount > 1) {
                    const device = window.hardwareDB[window.activeDevice] || window.hardwareDB['handy_std'];
                    let hwMax = device.standard.max;
                    let hwMin = device.standard.min;
                    if (device.supports_overclock && window.isOverclockEnabled && device.overclock) {
                        hwMax = device.overclock.max;
                        hwMin = device.overclock.min;
                    }
                    wasFixed = massCorrectSelection(actions, hwMax, hwMin, device.factor);
                } else if (window.activeSuggestion) {
                    if (window.activeSuggestion.modIdx === 1) {
                        actions[window.activeSuggestion.idx1][window.activeSuggestion.key] = window.activeSuggestion.val;
                    } else {
                        actions[window.activeSuggestion.idx2][window.activeSuggestion.key] = window.activeSuggestion.val;
                    }
                    wasFixed = true;
                }

                if (wasFixed) {
                    window.activeSuggestion = null;
                    cleanDuplicates();
                    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
                    notifyCloud(); window.updateHeatmapAndStats();
                    window.drawTimeline();
                    return;
                }
            }

            e.preventDefault();
            const now = performance.now();
            if (now - lastRightClickTime < 350) {
                let clickedTimeMs = xToTime(clickX);
                window.setActualTimeMs(clickedTimeMs);
                window.dispatchEvent(new CustomEvent('forceTimelinePan', { detail: { timeMs: clickedTimeMs } }));
                lastRightClickTime = 0;
                window.drawTimeline();
                return;
            }
            lastRightClickTime = now;
            
            saveHistoryState();
            actions.splice(0, actions.length, ...actions.filter(act => Math.hypot(clickX - timeToX(act.at), clickY - posToY(act.pos)) > 10));
            notifyCloud(); window.updateHeatmapAndStats();
        }
    });

    c.addEventListener('mousemove', (e) => {
        if (document.body.classList.contains('panic-mode-active')) return; 

        const pos = getMousePos(e);
        const mouseX = pos.x; const mouseY = pos.y;
        window.lastMouseX = mouseX;
        window.lastMouseY = mouseY;

        if (window.isPastingMode && window.timelineGhostPreset) {
            updateGhostPosition(mouseX, mouseY);
            window.drawTimeline();
        }
        
        if (isSelectingMarkers) {
            selCurrMarkerT = xToTime(mouseX);
            const minT = Math.min(selStartMarkerT, selCurrMarkerT);
            const maxT = Math.max(selStartMarkerT, selCurrMarkerT);
            
            window.timelineMarkers.forEach((m, i) => {
                if (m.at >= minT && m.at <= maxT) {
                    m.selected = true;
                } else {
                    m.selected = e.ctrlKey ? markerSelectionInitialStates[i] : false;
                }
            });
            window.drawTimeline();
            return;
        }

        if (isDraggingMarker && draggedMarkerIndex !== -1) {
            const m = window.timelineMarkers[draggedMarkerIndex];
            let newAt = Math.round(xToTime(mouseX) / 50) * 50; 

            let safeTime = 0;
            try { safeTime = typeof window.getActualTimeMs === 'function' ? window.getActualTimeMs() : 0; } catch(err){}
            const actualTimeMs = safeTime;

            if (Math.abs(timeToX(newAt) - timeToX(actualTimeMs)) < 15) newAt = Math.round(actualTimeMs);

            m.at = Math.max(0, newAt);
            window.timelineMarkers.sort((a, b) => a.at - b.at);
            draggedMarkerIndex = window.timelineMarkers.indexOf(m); 
            
            window.drawTimeline();
            if (typeof window.drawProgressMarkers === 'function') window.drawProgressMarkers();
            return;
        }

        const actions = getSafeActions();
        window.activeSuggestion = null;
        const device = window.hardwareDB[window.activeDevice] || window.hardwareDB['handy_std'];
        let hwMax = device.standard.max;
        let hwMin = device.standard.min;
        if (device.supports_overclock && window.isOverclockEnabled && device.overclock) {
            hwMax = device.overclock.max;
            hwMin = device.overclock.min;
        }

        if (!isDraggingNode && !isSelecting && !isDraggingMarker && !isSelectingMarkers && !window.isDraggingPreset && !window.isPastingMode) {
            for (let i = 0; i < actions.length - 1; i++) {
                let act1 = actions[i]; let act2 = actions[i+1];
                let px1 = timeToX(act1.at); let py1 = posToY(act1.pos);
                let px2 = timeToX(act2.at); let py2 = posToY(act2.pos);
                
                if (mouseX >= Math.min(px1, px2) - 20 && mouseX <= Math.max(px1, px2) + 20) {
                    let dist = pDistance(mouseX, mouseY, px1, py1, px2, py2);
                    if (dist <= 15) { 
                        let act0 = i > 0 ? actions[i-1] : null;
                        let act3 = i < actions.length - 2 ? actions[i+2] : null;
                        let suggestion = getCorrectionSuggestion(act1, act2, hwMax, hwMin, device.factor, act0, act3);
                        if (suggestion) {
                            window.activeSuggestion = { ...suggestion, idx1: i, idx2: i+1 };
                            break;
                        }
                    }
                }
            }
        }

        if (isDraggingNode && dragSelectionInitialStates.length > 0) {
            let snappedTimeDelta = 0;
            let snappedPosDelta = 0;
            const snap = window.snapValue || 5;

            const rawTimeDelta = xToTime(mouseX) - dragStartXTime;
            const rawPosDelta = yToPos(mouseY) - dragStartYPos;
            snappedTimeDelta = Math.round(rawTimeDelta / 50) * 50; 
            snappedPosDelta = Math.round(rawPosDelta / snap) * snap;

            let safeTime = 0;
            try { safeTime = typeof window.getActualTimeMs === 'function' ? window.getActualTimeMs() : 0; } catch(err){}
            const playhead = Math.round(safeTime);

            dragSelectionInitialStates.forEach((initialAct) => {
                if (initialAct.selected) {
                    let proposedTime = initialAct.at + snappedTimeDelta;
                    if (Math.abs(proposedTime - playhead) <= 30) {
                        snappedTimeDelta = playhead - initialAct.at;
                    }
                }
            });

            actions.forEach((act, i) => {
                if (dragSelectionInitialStates[i].selected) {
                    act.at = Math.max(0, dragSelectionInitialStates[i].at + snappedTimeDelta);
                    const rawP = dragSelectionInitialStates[i].pos + snappedPosDelta;
                    act.pos = Math.max(0, Math.min(100, Math.round(rawP / snap) * snap));
                }
            });
            
            if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        } else if (isSelecting) {
            selCurrT = xToTime(mouseX);
            selCurrY = mouseY;
            
            const startX_px = timeToX(selStartT);
            if (Math.hypot(mouseX - startX_px, mouseY - selStartY) > 5) hasDraggedSelection = true;
            
            const minT = Math.min(selStartT, selCurrT); const maxT = Math.max(selStartT, selCurrT);
            const topLimit = posToY(100);
            const minY = Math.max(topLimit, Math.min(selStartY, selCurrY)); 
            const maxY = Math.max(topLimit, Math.max(selStartY, selCurrY));
            
            actions.forEach(act => {
                const ny = posToY(act.pos);
                act.selected = (act.at >= minT && act.at <= maxT && ny >= minY && ny <= maxY);
            });
            if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        }
    });

    c.addEventListener('mouseup', (e) => {
        if (window.isPastingMode && window.timelineGhostPreset) {
            window.injectGhostPreset(e.clientX, e.clientY);
            window.isPastingMode = false;
            return;
        }

        if (window.isDraggingPreset) return; 

        if (isSelectingMarkers) {
            isSelectingMarkers = false;
            markerSelectionInitialStates = [];
            return;
        }

        if (isDraggingMarker) {
            isDraggingMarker = false;
            draggedMarkerIndex = -1;
            return;
        }

        const snap = window.snapValue || 5;
        let actions = getSafeActions();
        if (isSelecting && !hasDraggedSelection && e.target === c) {
            if (!hadSelectionBeforeMousedown) {
                ensureTrackExists(); 
                actions = getSafeActions(); 

                let clickTime = Math.max(0, Math.round(selStartT / 50) * 50);
                let clickPos = Math.round(yToPos(selStartY) / snap) * snap; 

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
            actions.splice(0, actions.length, ...actions.filter(a => a.selected || !selectedTimes.has(a.at)));
            
            cleanDuplicates();
            notifyCloud(); window.updateHeatmapAndStats();
        }
        isDraggingNode = false; dragSelectionInitialStates = []; isSelecting = false; draggedNodeIndex = -1;
    });

    c.addEventListener('dragleave', () => {
        if(window.isDraggingPreset) {
            window.timelineGhostTimeMs = null;
            window.drawTimeline();
        }
    });

    c.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('keydown', (e) => {
        if (document.body.classList.contains('panic-mode-active')) return;
        
        if (e.key === '.') {
            const actions = getSafeActions();
            let moved = false;
            actions.forEach(act => {
                if (act.selected && !document.getElementById('preset-editor-modal')?.style.display) {
                    act.selected = false; 
                    moved = true;
                }
            });
            if (moved) window.drawTimeline();
        }

        if (window.isPastingMode && e.key === 'Escape') {
            e.preventDefault();
            window.isPastingMode = false;
            window.timelineGhostPreset = null;
            window.timelineGhostRandomSequence = [];
            window.timelineGhostRandomOffsets = [];
            window.drawTimeline();
            return;
        }
    });
}

// ==========================================
// INICIALIZACIÓN Y BUCLE PRINCIPAL
// ==========================================
function bootTimelineEngine() {
    const c = document.getElementById('timeline-canvas');
    if (!c) {
        requestAnimationFrame(bootTimelineEngine);
        return;
    }
    if (c.parentElement && c.parentElement.clientWidth === 0) {
        console.warn("⚠️ El contenedor del timeline tiene ancho 0px. Revisa tu CSS o si está en un tab oculto.");
    }
    initTimelineEvents();
    requestAnimationFrame(animationLoop);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootTimelineEngine);
} else {
    bootTimelineEngine();
}

function animationLoop() {
    window.drawTimeline();
    requestAnimationFrame(animationLoop);
}

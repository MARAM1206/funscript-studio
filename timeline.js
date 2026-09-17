// ==========================================================================
// TIMELINE V1.26.2 (CENTRADOS Q/W CORREGIDOS Y MOMENTUM RESTAURADO)
// ==========================================================================

window.funscriptActions = window.funscriptActions || [];
window.timelineMarkers = window.timelineMarkers || []; 
window.activeSuggestion = null; 
window.presetFillMode = 'stretch'; 
window.presetFillReps = 1;
window.presetFillInitialized = false;
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

function getCorrectionSuggestion(act1, act2, hwMax, hwMin, factor) {
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

// ==========================================
// INTELIGENCIA ARTIFICIAL DE ESCALA (ANCLAS)
// ==========================================
function getSmartMappedPos(presetVal, pSyncVal, tSyncVal, pMin, pMax, oMin, oMax, hasExisting) {
    if (pSyncVal !== null && tSyncVal !== null) {
        if (presetVal === pSyncVal) return tSyncVal; 
        
        if (presetVal > pSyncVal) {
            let distUpP = 100 - pSyncVal;
            let distUpT = 100 - tSyncVal;
            let scale = distUpP > 0 ? (distUpT / distUpP) : 1;
            return Math.max(0, Math.min(100, Math.round(tSyncVal + (presetVal - pSyncVal) * scale)));
        } else {
            let distDownP = pSyncVal; 
            let distDownT = tSyncVal; 
            let scale = distDownP > 0 ? (distDownT / distDownP) : 1;
            return Math.max(0, Math.min(100, Math.round(tSyncVal - (pSyncVal - presetVal) * scale)));
        }
    } else if (hasExisting && (oMax - oMin) > 10) {
        let pRange = pMax - pMin || 1;
        let norm = (presetVal - pMin) / pRange;
        return Math.max(0, Math.min(100, Math.round(oMin + norm * (oMax - oMin))));
    }
    return presetVal;
}

window.getMorphedPreset = function(preset, startOrMarkers, end) {
    if (!preset || preset.length === 0) return null;
    let result = [];
    const p_dur = preset[preset.length - 1].at;
    if (p_dur <= 0) return null;

    let presetMin = Math.min(...preset.map(a => a.pos));
    let presetMax = Math.max(...preset.map(a => a.pos));
    let presetSync = preset.find(a => a.isSync);
    let pSyncVal = presetSync ? presetSync.pos : null;

    if (Array.isArray(startOrMarkers) && startOrMarkers.length > 2) {
        for (let i = 0; i < startOrMarkers.length - 1; i++) {
            let t1 = startOrMarkers[i].at;
            let t2 = startOrMarkers[i+1].at;
            let targetDuration = t2 - t1;
            if (targetDuration <= 0) continue;

            let existing = (window.funscriptActions || []).filter(a => a.at >= t1 && a.at <= t2);
            let targetSync = existing.find(a => a.isSync);
            let tSyncVal = targetSync ? targetSync.pos : null;
            
            let oMin = 0, oMax = 100;
            let hasExisting = existing.length > 0;
            if (hasExisting) {
                oMin = Math.min(...existing.map(a => a.pos));
                oMax = Math.max(...existing.map(a => a.pos));
            }

            for (let j = 0; j < preset.length; j++) {
                if (i > 0 && j === 0 && preset[0].pos === preset[preset.length - 1].pos) continue; 
                
                let mappedPos = getSmartMappedPos(preset[j].pos, pSyncVal, tSyncVal, presetMin, presetMax, oMin, oMax, hasExisting);
                let newAt = 0;
                
                if (presetSync && targetSync) {
                    if (preset[j].at <= presetSync.at) {
                        let ratio = presetSync.at > 0 ? (preset[j].at / presetSync.at) : 0;
                        newAt = t1 + ratio * (targetSync.at - t1);
                    } else {
                        let remP = p_dur - presetSync.at;
                        let remT = t2 - targetSync.at;
                        let ratio = remP > 0 ? ((preset[j].at - presetSync.at) / remP) : 0;
                        newAt = targetSync.at + ratio * remT;
                    }
                } else {
                    newAt = t1 + (preset[j].at / p_dur) * targetDuration;
                }

                result.push({
                    at: Math.round(newAt),
                    pos: mappedPos,
                    isSync: preset[j].isSync || false
                });
            }
        }
    } else {
        let t_start = Array.isArray(startOrMarkers) ? startOrMarkers[0].at : startOrMarkers;
        let t_end = Array.isArray(startOrMarkers) ? startOrMarkers[startOrMarkers.length - 1].at : end;
        let targetDuration = t_end - t_start;
        if (targetDuration <= 0) return null;

        let existing = (window.funscriptActions || []).filter(a => a.at >= t_start && a.at <= t_end);
        let targetSync = existing.find(a => a.isSync);
        let tSyncVal = targetSync ? targetSync.pos : null;
        let oMin = 0, oMax = 100;
        let hasExisting = existing.length > 0;
        if (hasExisting) {
            oMin = Math.min(...existing.map(a => a.pos));
            oMax = Math.max(...existing.map(a => a.pos));
        }

        if (window.presetFillMode === 'stretch') {
            for (let j = 0; j < preset.length; j++) {
                let mappedPos = getSmartMappedPos(preset[j].pos, pSyncVal, tSyncVal, presetMin, presetMax, oMin, oMax, hasExisting);
                let newAt = 0;
                
                if (presetSync && targetSync) {
                    if (preset[j].at <= presetSync.at) {
                        let ratio = presetSync.at > 0 ? (preset[j].at / presetSync.at) : 0;
                        newAt = t_start + ratio * (targetSync.at - t_start);
                    } else {
                        let remP = p_dur - presetSync.at;
                        let remT = t_end - targetSync.at;
                        let ratio = remP > 0 ? ((preset[j].at - presetSync.at) / remP) : 0;
                        newAt = targetSync.at + ratio * remT;
                    }
                } else {
                    newAt = t_start + (preset[j].at / p_dur) * targetDuration;
                }

                result.push({
                    at: Math.round(newAt),
                    pos: mappedPos,
                    isSync: preset[j].isSync || false
                });
            }
        } else {
            const reps = window.presetFillReps || 1;
            const repDuration = targetDuration / reps;
            for (let r = 0; r < reps; r++) {
                const offset = t_start + (r * repDuration);
                for (let i = 0; i < preset.length; i++) {
                    if (r > 0 && i === 0 && preset[0].pos === preset[preset.length - 1].pos) continue;
                    
                    let mappedPos = getSmartMappedPos(preset[i].pos, pSyncVal, tSyncVal, presetMin, presetMax, oMin, oMax, hasExisting);
                    
                    result.push({
                        at: Math.round(offset + (preset[i].at / p_dur) * repDuration),
                        pos: mappedPos,
                        isSync: preset[i].isSync || false
                    });
                }
            }
        }
    }
    return result;
};

// ==========================================
// HISTORIAL (UNDO/REDO) Y SCROLL PAN
// ==========================================
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

// 🎯 FIX 1: Lógica para forzar el encuadre (Pan) desde atajos como Q y W
window.addEventListener('forceTimelinePan', (e) => {
    const canvas = document.getElementById('timeline-canvas');
    if (!canvas || canvas.width === 0) return;
    const visibleMs = (canvas.width - 30) / (window.basePixelsPerMs * window.zoom);
    
    let targetTime = window.getActualTimeMs();
    if (e && e.detail && e.detail.timeMs !== undefined) {
        targetTime = e.detail.timeMs;
    }
    
    window.scrollLeftMs = Math.max(0, targetTime - (visibleMs / 2));
    window.drawTimeline();
});

// ==========================================
// EVENTOS PERSONALIZADOS (ATAJOS Y BOTONES)
// ==========================================
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
            actions[existingIdx].selected = true; 
        } else {
            actions.push({ at: timeMs, pos: 50, selected: true, isSync: true });
        }
        
        cleanDuplicates();
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        notifyCloud();
        window.updateHeatmapAndStats();
        window.drawTimeline();
    } else {
        let moved = false;
        actions.forEach(act => {
            if (act.selected) { act.isSync = !act.isSync; moved = true; }
        });
        if (moved) {
            saveHistoryState();
            window.drawTimeline();
            notifyCloud();
        }
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

window.addEventListener('cutPoints', () => {
    if (document.body.classList.contains('panic-mode-active')) return;
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;
    const actions = getSafeActions();
    const selected = actions.filter(a => a.selected);
    if (selected.length > 0) {
        const baseTime = selected[0].at;
        window.clipboardFunscript = selected.map(a => ({ at: a.at - baseTime, pos: Math.round(a.pos), isSync: a.isSync||false }));
        saveHistoryState();
        actions.splice(0, actions.length, ...actions.filter(a => !a.selected));
        cleanDuplicates();
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        notifyCloud(); window.updateHeatmapAndStats();
        window.drawTimeline();
    }
});

window.addEventListener('pastePoints', () => {
    if (document.getElementById('preset-editor-modal')?.style.display === 'flex') return;
    if (window.clipboardFunscript && window.clipboardFunscript.length > 0) {
        getSafeActions().forEach(a => a.selected = false); 
        window.isPastingMode = true;
        window.timelineGhostPreset = window.clipboardFunscript;
        window.timelineGhostTimeMs = null;
        if (window.lastMouseX !== undefined && window.lastMouseY !== undefined) {
            updateGhostPosition(window.lastMouseX, window.lastMouseY);
        }
        window.drawTimeline();
    }
});

// ==========================================
// VISTAS Y HEATMAP
// ==========================================
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
    let hoverTimeMs = xToTime(mouseX);
    let hoverPosRaw = yToPos(mouseY);
    
    window.timelineGhostMouseX = mouseX;
    window.timelineGhostMouseY = mouseY;
    
    const selectedMarkers = window.timelineMarkers.filter(m => m.selected).sort((a,b) => a.at - b.at);
    
    if (selectedMarkers.length >= 2) {
        window.timelineGhostTimeMs = selectedMarkers[0].at;
        window.timelineGhostTargetEnd = selectedMarkers[selectedMarkers.length - 1].at;
        window.timelineGhostMarkers = selectedMarkers;

        if (!window.presetFillInitialized) {
            const pDur = window.timelineGhostPreset[window.timelineGhostPreset.length - 1].at;
            window.presetFillMode = 'stretch';
            window.presetFillReps = Math.max(1, Math.round((window.timelineGhostTargetEnd - window.timelineGhostTimeMs) / pDur));
            window.presetFillInitialized = true;
        }
    } else {
        window.timelineGhostMarkers = null;
        window.timelineGhostTargetEnd = null;
        window.presetFillInitialized = false;

        const actions = getSafeActions();
        let safeTime = 0;
        try { safeTime = typeof window.getActualTimeMs === 'function' ? window.getActualTimeMs() : 0; } catch(e){}
        const playheadTimeMs = Math.round(safeTime);
        const snapTargets = [playheadTimeMs, ...actions.map(a => a.at)];
        const snapDistMs = 250; 
        let bestOffset = hoverTimeMs;
        let minDistance = snapDistMs;
        let isSnapped = false;

        let pAnchor = window.timelineGhostPreset.find(a => a.isSync);
        let tAnchors = actions.filter(a => a.isSync);
        window.timelineGhostTargetAnchor = null;

        if (pAnchor && tAnchors.length > 0) {
            tAnchors.forEach(tA => {
                let projectedAnchorTime = hoverTimeMs + pAnchor.at;
                let dist = Math.abs(projectedAnchorTime - tA.at);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestOffset = tA.at - pAnchor.at;
                    isSnapped = true;
                    window.timelineGhostTargetAnchor = tA;
                }
            });
        } else {
            const pointsToCheck = [window.timelineGhostPreset[0]];
            if (window.timelineGhostPreset.length > 1) pointsToCheck.push(window.timelineGhostPreset[window.timelineGhostPreset.length - 1]);
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
        }

        window.timelineGhostTimeMs = Math.max(0, isSnapped ? bestOffset : hoverTimeMs);
        
        const snap = window.snapValue || 5;
        let hoverPos = Math.round(hoverPosRaw / snap) * snap;
        const basePos = window.timelineGhostPreset[0].pos;
        window.timelineGhostDeltaPos = hoverPos - basePos;
    }
}

// ==========================================
// NÚCLEO DEL CANVAS Y DIBUJADO (DRAW TIMELINE)
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
        
        const ctx = canvas.getContext('2d');
        
        let safeTime = 0;
        try { safeTime = typeof window.getActualTimeMs === 'function' ? window.getActualTimeMs() : 0; } catch(e){}
        let actualTime = safeTime;
        
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
            ctx.lineWidth = 1;
            const isMuted = videoNode && (videoNode.muted || videoNode.volume === 0);
            ctx.strokeStyle = isMuted ? 'rgba(239, 68, 68, 0.9)' : (isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.15)'); 
            ctx.beginPath();
            const startIdx = Math.max(0, Math.floor(xToTime(30) / 1000 * window.audioPeaksSampleRate));
            const endIdx = Math.min(window.audioPeaks.length - 1, Math.ceil(xToTime(canvas.width) / 1000 * window.audioPeaksSampleRate));
            const yCenter = canvas.height / 2;
            const boostHeight = canvas.height * 0.30; 

            for(let i = startIdx; i <= endIdx; i++) {
                const timeMs = (i / window.audioPeaksSampleRate) * 1000;
                const x = timeToX(timeMs);
                if (x >= 30) {
                    const amplitude = (window.audioPeaks[i] / window.audioMaxPeak) * boostHeight; 
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

        if ((window.isDraggingPreset || window.isPastingMode) && window.timelineGhostPreset && window.timelineGhostTimeMs !== null) {
            if (window.timelineGhostTargetEnd) {
                const morphed = window.getMorphedPreset(window.timelineGhostPreset, window.timelineGhostMarkers || window.timelineGhostTimeMs, window.timelineGhostTargetEnd);
                if (morphed) {
                    const pulseG = 0.5 + 0.5 * (Math.sin(performance.now() / 250) * 0.5 + 0.5); 
                    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(16, 185, 129, ${pulseG})`; ctx.beginPath();
                    morphed.forEach((act, index) => {
                        const x = timeToX(act.at); const y = posToY(act.pos); 
                        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    });
                    ctx.stroke();
                    morphed.forEach(act => {
                        const x = timeToX(act.at); const y = posToY(act.pos);
                        if (act.isSync) {
                            ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
                            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
                            ctx.fillStyle = '#0f172a'; ctx.font = '10px monospace'; 
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚓', x, y+1); 
                            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
                        } else {
                            ctx.fillStyle = `rgba(16, 185, 129, ${pulseG})`;
                            ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
                        }
                    });
                    
                    const cursorX = timeToX(window.timelineGhostTimeMs);
                    const cursorY = posToY(50);
                    if (window.timelineGhostMarkers && window.timelineGhostMarkers.length > 2) {
                        ctx.fillStyle = '#10b981'; ctx.font = 'bold 12px monospace';
                        ctx.fillText("Modo: Adaptación Múltiple", cursorX + 15, cursorY + 30);
                    } else {
                        ctx.fillStyle = '#10b981'; ctx.font = 'bold 12px monospace';
                        let modeText = window.presetFillMode === 'stretch' ? "Modo: Auto-Ajuste Cuántico" : `Modo: Repetir (${window.presetFillReps || 1}x)`;
                        ctx.fillText(modeText, cursorX + 15, cursorY + 30);
                    }
                }
            } else if (window.timelineGhostTargetAnchor) {
                let pAnchor = window.timelineGhostPreset.find(a => a.isSync);
                let pMin = Math.min(...window.timelineGhostPreset.map(a => a.pos));
                let pMax = Math.max(...window.timelineGhostPreset.map(a => a.pos));

                const pulseG = 0.5 + 0.5 * (Math.sin(performance.now() / 250) * 0.5 + 0.5); 
                ctx.lineWidth = 3; ctx.strokeStyle = `rgba(16, 185, 129, ${pulseG})`; ctx.beginPath();
                window.timelineGhostPreset.forEach((act, index) => {
                    const x = timeToX(window.timelineGhostTimeMs + act.at);
                    const scaledPos = getSmartMappedPos(act.pos, pAnchor.pos, window.timelineGhostTargetAnchor.pos, pMin, pMax, 0, 100, false);
                    const y = posToY(scaledPos); 
                    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                });
                ctx.stroke();

                window.timelineGhostPreset.forEach(act => {
                    const x = timeToX(window.timelineGhostTimeMs + act.at);
                    const scaledPos = getSmartMappedPos(act.pos, pAnchor.pos, window.timelineGhostTargetAnchor.pos, pMin, pMax, 0, 100, false);
                    const y = posToY(scaledPos);
                    if (act.isSync) {
                        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
                        ctx.fillStyle = '#0f172a'; ctx.font = '10px monospace'; 
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚓', x, y+1); 
                        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
                    } else {
                        ctx.fillStyle = `rgba(16, 185, 129, ${pulseG})`;
                        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
                    }
                });

                const cursorX = timeToX(window.timelineGhostTimeMs);
                const cursorY = posToY(window.timelineGhostTargetAnchor.pos);
                ctx.fillStyle = '#10b981'; ctx.font = 'bold 12px monospace';
                ctx.fillText("✨ IA: Escala Geométrica", cursorX + 15, cursorY - 15);

            } else {
                const snap = window.snapValue || 5;
                const deltaY = window.timelineGhostDeltaPos || 0;
                ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)'; ctx.beginPath();
                window.timelineGhostPreset.forEach((act, index) => {
                    const x = timeToX(window.timelineGhostTimeMs + act.at);
                    const y = posToY(Math.max(0, Math.min(100, Math.round((act.pos + deltaY)/snap)*snap))); 
                    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                });
                ctx.stroke();
                window.timelineGhostPreset.forEach(act => {
                    const x = timeToX(window.timelineGhostTimeMs + act.at);
                    const y = posToY(Math.max(0, Math.min(100, Math.round((act.pos + deltaY)/snap)*snap)));
                    if (act.isSync) {
                        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
                        ctx.fillStyle = '#0f172a'; ctx.font = '10px monospace'; 
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚓', x, y+1); 
                        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
                    } else {
                        ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
                        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
                    }
                });
                
                const pasteX = window.timelineGhostMouseX !== undefined ? window.timelineGhostMouseX : timeToX(window.timelineGhostTimeMs);
                const pasteY = window.timelineGhostMouseY !== undefined ? window.timelineGhostMouseY : posToY(window.timelineGhostPreset[0].pos + deltaY);
                
                ctx.fillStyle = '#10b981'; ctx.font = 'bold 12px monospace';
                if (window.isPastingMode) {
                    ctx.fillText("📋 PEGAR LIBRE (Click para soltar)", pasteX + 15, pasteY + 30);
                } else if (window.isDraggingPreset) {
                    ctx.fillText("✋ SOLTAR AQUÍ", pasteX + 15, pasteY + 30);
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

        // 🎯 FIX 2: Animación y Decaimiento del Momentum del Scroll (⏩ / ⏪)
        if (Math.abs(window.scrollMomentum) > 0.5) {
            ctx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.6)';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(window.scrollMomentum > 0 ? '⏩' : '⏪', canvas.width - 20, 30);
            ctx.textAlign = 'left';
            
            // Fricción (decay) para ir frenando la animación
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
    } catch (err) { }
};

// ==========================================
// INICIALIZACIÓN DE EVENTOS DEL CANVAS (BLINDADOS)
// ==========================================
function initTimelineEvents() {
    const c = document.getElementById('timeline-canvas');
    if (!c) return;

    function getMousePos(e) { 
        const rect = c.getBoundingClientRect(); 
        return { x: (e.clientX - rect.left) * (c.width / rect.width), y: (e.clientY - rect.top) * (c.height / rect.height) }; 
    }

    c.addEventListener('wheel', (e) => {
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

        if (!isDraggingNode && !isSelecting && !isDraggingMarker && !isSelectingMarkers && !window.isDraggingPreset) {
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
        if (window.isPastingMode || window.isDraggingPreset) return; 

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

    c.addEventListener('dragenter', (e) => { e.preventDefault(); });
    
    c.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        try {
            if (!window.isDraggingPreset || !window.timelineGhostPreset) return;
            e.dataTransfer.dropEffect = 'copy';
            const rect = c.getBoundingClientRect();
            updateGhostPosition((e.clientX - rect.left) * (c.width / rect.width), (e.clientY - rect.top) * (c.height / rect.height));
            window.drawTimeline();
        } catch(err) {}
    });

    c.addEventListener('drop', (e) => {
        e.preventDefault();
        try {
            if (!window.isDraggingPreset || !window.timelineGhostPreset) return;
            
            const rect = c.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * (c.width / rect.width);
            
            let dropTimeMs = window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : Math.max(0, xToTime(mouseX));
            const deltaY = window.timelineGhostDeltaPos || 0;
            const snap = window.snapValue || 5;
            
            const presetToInject = JSON.parse(JSON.stringify(window.timelineGhostPreset));
            const targetEnd = window.timelineGhostTargetEnd;
            const targetMarkers = window.timelineGhostMarkers;
            const targetAnchor = window.timelineGhostTargetAnchor; 

            setTimeout(() => {
                ensureTrackExists();
                let actions = getSafeActions();

                if (targetEnd) {
                    const morphed = window.getMorphedPreset(presetToInject, targetMarkers || dropTimeMs, targetEnd);
                    if (morphed) {
                        saveHistoryState();
                        let tStart = dropTimeMs;
                        let tEnd = targetEnd;
                        actions.splice(0, actions.length, ...actions.filter(a => a.at < tStart || a.at > tEnd));
                        actions.forEach(a => a.selected = false);
                        morphed.forEach(m => m.selected = true);
                        actions.push(...morphed);
                        
                        cleanDuplicates();
                        window.isDraggingPreset = false; window.timelineGhostPreset = null;
                        window.presetFillInitialized = false; window.timelineGhostTargetEnd = null; 
                        window.timelineGhostMarkers = null; window.timelineGhostTargetAnchor = null;
                        
                        if (window.timelineMarkers) window.timelineMarkers.forEach(m => m.selected = false);
                        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
                        notifyCloud(); window.updateHeatmapAndStats();
                        window.drawTimeline();
                        return;
                    }
                }
                
                saveHistoryState();
                let newActions = [];
                
                if (targetAnchor) {
                    let pAnchor = presetToInject.find(a => a.isSync);
                    let pMin = Math.min(...presetToInject.map(a => a.pos));
                    let pMax = Math.max(...presetToInject.map(a => a.pos));
                    
                    newActions = presetToInject.map(act => ({
                        at: Math.round(dropTimeMs + act.at),
                        pos: getSmartMappedPos(act.pos, pAnchor.pos, targetAnchor.pos, pMin, pMax, 0, 100, false),
                        selected: true,
                        isSync: act.isSync || false
                    }));
                } else {
                    newActions = presetToInject.map(act => ({
                        at: Math.round(dropTimeMs + act.at),
                        pos: Math.max(0, Math.min(100, Math.round((act.pos + deltaY)/snap)*snap)),
                        selected: true,
                        isSync: act.isSync || false
                    }));
                }
                
                let tStart = newActions[0].at;
                let tEnd = newActions[newActions.length - 1].at;
                
                actions.splice(0, actions.length, ...actions.filter(a => a.at < tStart || a.at > tEnd));
                actions.forEach(a => a.selected = false); 
                actions.push(...newActions);
                
                cleanDuplicates(); 
                window.isDraggingPreset = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; 
                window.timelineGhostDeltaPos = 0; window.timelineGhostTargetAnchor = null;
                
                if (window.timelineMarkers) window.timelineMarkers.forEach(m => m.selected = false);
                if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
                notifyCloud(); window.updateHeatmapAndStats();
                window.drawTimeline();
            }, 10);
        } catch (err) {}
    });

    c.addEventListener('dragleave', () => {
        if(window.isDraggingPreset) {
            window.timelineGhostTimeMs = null;
            window.drawTimeline();
        }
    });

    c.addEventListener('contextmenu', e => e.preventDefault());
}

// ==========================================
// INICIALIZACIÓN Y BUCLE PRINCIPAL (BLINDADOS)
// ==========================================
function bootTimelineEngine() {
    const c = document.getElementById('timeline-canvas');
    if (!c || c.parentElement.clientWidth === 0) {
        requestAnimationFrame(bootTimelineEngine);
        return;
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

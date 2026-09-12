// ==========================================================================
// TIMELINE V1.16.0 (FIX: AUTO-CORRECCIÓN LIMPIA Y ANCLA MORADO OSCURO)
// ==========================================================================

window.funscriptActions = window.funscriptActions || [];
window.timelineMarkers = window.timelineMarkers || []; 
window.activeSuggestion = null; 

window.presetFillMode = 'stretch'; 
window.presetFillReps = 1;
window.presetFillInitialized = false;

window.lastMarkerRightClickIdx = -1;
window.lastMarkerRightClickTime = 0;

window.hardwareDB = {
    "handy_std": { name: "Handy V1 / 2 Standar", stroke: 110, factor: 1.10, supports_overclock: false, standard: { max: 400, min: 32 } },
    "handy_pro": { name: "Handy 2 PRO", stroke: 125, factor: 1.25, supports_overclock: true, standard: { max: 500, min: 20 }, overclock: { max: 650, min: 15 } },
    "keon_1": { name: "Kiiroo Keon 1", stroke: 75, factor: 0.75, supports_overclock: false, standard: { max: 280, min: 20 } },
    "keon_2": { name: "Kiiroo Keon 2", stroke: 80, factor: 0.80, supports_overclock: false, standard: { max: 350, min: 18 } },
    "keon_sm": { name: "Kiiroo Sex Machine", stroke: 100, factor: 1.00, supports_overclock: false, standard: { max: 450, min: 20 } },
    "erojoy_x3": { name: "Erojoy X3", stroke: 115, factor: 1.15, supports_overclock: false, standard: { max: 320, min: 22 } }
};

window.activeDevice = null;
window.isOverclockEnabled = false;

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
window.scrollMomentum = 0; 

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

let hadSelectionBeforeMousedown = false; 
let lastRightClickTime = 0; 

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
    const timeMs = Math.round(window.getActualTimeMs());
    let closest = null; let minDiff = 50; 
    actions.forEach(act => {
        const diff = Math.abs(act.at - timeMs);
        if (diff <= minDiff) { minDiff = diff; closest = act; }
    });
    return closest;
}

window.addEventListener('toggleSyncPoint', () => {
    if (document.body.classList.contains('panic-mode-active')) return;
    
    const modal = document.getElementById('preset-editor-modal');
    if (modal && modal.style.display === 'flex') {
        if (window.presetEditorActions) {
            let moved = false;
            window.presetEditorActions.forEach(a => {
                if (a.selected) { a.isSync = !a.isSync; moved = true; }
            });
            if (moved && typeof window.drawPresetEditor === 'function') window.drawPresetEditor();
        }
        return;
    }

    const actions = getSafeActions();
    let moved = false;
    actions.forEach(act => {
        if (act.selected) { act.isSync = !act.isSync; moved = true; }
    });
    
    if (moved) {
        saveHistoryState();
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
        notifyCloud();
    }
});

// 🎯 FIX: Corrector Masivo sin destrozar la estructura (Mínimo toque necesario)
function massCorrectSelection(actions, hwMax, hwMin, factor) {
    let changed = false;
    let snap = window.snapValue || 5;
    for(let pass = 0; pass < 5; pass++) { 
        let passChanged = false;
        for(let i = 0; i < actions.length - 1; i++) {
            if (!actions[i].selected && !actions[i+1].selected) continue;

            let act1 = actions[i]; let act2 = actions[i+1];
            let dt_ms = act2.at - act1.at;
            if(dt_ms < 15) continue;
            let dt_s = dt_ms / 1000.0;
            let dp = Math.abs(act2.pos - act1.pos);
            let speed = (dp * factor) / dt_s;

            if (speed > hwMax) {
                let req_dt_ms = Math.round(((dp * factor) / (hwMax * 0.95)) * 1000);
                let diff = req_dt_ms - dt_ms;
                
                if (act2.selected && (!actions[i+2] || act2.at + diff < actions[i+2].at - 15)) {
                    act2.at += diff;
                    passChanged = true; changed = true;
                } else if (act1.selected && (!actions[i-1] || act1.at - diff > actions[i-1].at + 15)) {
                    act1.at -= diff;
                    passChanged = true; changed = true;
                } else {
                    let req_dp = (hwMax * 0.95 * dt_s) / factor;
                    let dir = act2.pos >= act1.pos ? 1 : -1;
                    if (act2.selected) {
                        act2.pos = Math.max(0, Math.min(100, Math.round((act1.pos + dir * req_dp)/snap)*snap));
                        passChanged = true; changed = true;
                    }
                }
            } else if (speed < hwMin && dp > 0) {
                if (dp <= 10 && act2.selected) {
                    act2.pos = act1.pos;
                    passChanged = true; changed = true;
                } else if (act2.selected) {
                    let req_dt_ms = Math.round(((dp * factor) / (hwMin * 1.05)) * 1000);
                    if (req_dt_ms >= 15) {
                        let diff = dt_ms - req_dt_ms;
                        if (!actions[i-1] || act2.at - diff > act1.at + 15) {
                            act2.at -= diff;
                            passChanged = true; changed = true;
                        }
                    }
                }
            }
        }
        if (!passChanged) break; 
    }
    return changed;
}

window.getMorphedPreset = function(preset, startOrMarkers, end) {
    if (!preset || preset.length === 0) return null;
    let result = [];
    const p_dur = preset[preset.length - 1].at;
    if (p_dur <= 0) return null;

    let presetMin = Math.min(...preset.map(a => a.pos));
    let presetMax = Math.max(...preset.map(a => a.pos));
    let pRange = presetMax - presetMin;
    if (pRange === 0) pRange = 1;

    let presetSync = preset.find(a => a.isSync);

    if (Array.isArray(startOrMarkers) && startOrMarkers.length > 2) {
        for (let i = 0; i < startOrMarkers.length - 1; i++) {
            let t1 = startOrMarkers[i].at;
            let t2 = startOrMarkers[i+1].at;
            let targetDuration = t2 - t1;
            if (targetDuration <= 0) continue;

            let existing = (window.funscriptActions || []).filter(a => a.at >= t1 && a.at <= t2);
            let targetSync = existing.find(a => a.isSync);
            
            let oMin = 0, oMax = 100;
            let hasExisting = existing.length > 0;
            if (hasExisting) {
                oMin = Math.min(...existing.map(a => a.pos));
                oMax = Math.max(...existing.map(a => a.pos));
            }

            for (let j = 0; j < preset.length; j++) {
                if (i > 0 && j === 0 && preset[0].pos === preset[preset.length - 1].pos) continue; 
                
                let mappedPos = preset[j].pos;
                if (hasExisting && (oMax - oMin) > 10) { 
                    let norm = (preset[j].pos - presetMin) / pRange;
                    mappedPos = Math.max(0, Math.min(100, Math.round(oMin + norm * (oMax - oMin))));
                }

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
                    if (preset[j].isSync) mappedPos = targetSync.pos; 
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
        let oMin = 0, oMax = 100;
        let hasExisting = existing.length > 0;
        if (hasExisting) {
            oMin = Math.min(...existing.map(a => a.pos));
            oMax = Math.max(...existing.map(a => a.pos));
        }

        if (window.presetFillMode === 'stretch') {
            for (let j = 0; j < preset.length; j++) {
                let mappedPos = preset[j].pos;
                if (hasExisting && (oMax - oMin) > 10) {
                    let norm = (preset[j].pos - presetMin) / pRange;
                    mappedPos = Math.max(0, Math.min(100, Math.round(oMin + norm * (oMax - oMin))));
                }

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
                    if (preset[j].isSync) mappedPos = targetSync.pos; 
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
                    
                    let mappedPos = preset[i].pos;
                    if (hasExisting && (oMax - oMin) > 10) {
                        let norm = (preset[i].pos - presetMin) / pRange;
                        mappedPos = Math.max(0, Math.min(100, Math.round(oMin + norm * (oMax - oMin))));
                    }
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

window.updateHeatmapAndStats = function() {
    const actions = getSafeActions();
    const statsSpan = document.getElementById('timeline-stats');
    if (statsSpan) {
        let speedText = "--";
        const isLight = document.body.classList.contains('light-theme');
        let colorHtml = isLight ? "#94a3b8" : "#94a3b8"; 

        if (actions.length > 1) {
            let totalSegmentSpeed = 0;
            let validSegments = 0;
            for (let i = 1; i < actions.length; i++) {
                let dt = (actions[i].at - actions[i-1].at) / 1000.0;
                let dp = Math.abs(actions[i].pos - actions[i-1].pos);
                if (dt > 0) { totalSegmentSpeed += (dp / dt); validSegments++; }
            }
            if (validSegments > 0) {
                const fapTapSpeed = Math.round(totalSegmentSpeed / validSegments);
                if (fapTapSpeed >= 501) { speedText = `Very Fast (${fapTapSpeed})`; colorHtml = isLight ? "#dc2626" : "#ef4444"; } 
                else if (fapTapSpeed >= 301) { speedText = `Fast (${fapTapSpeed})`; colorHtml = isLight ? "#ea580c" : "#f97316"; } 
                else if (fapTapSpeed >= 151) { speedText = `Medium (${fapTapSpeed})`; colorHtml = isLight ? "#ca8a04" : "#facc15"; } 
                else { speedText = `Slow (${fapTapSpeed})`; colorHtml = isLight ? "#059669" : "#10b981"; } 
            }
        } else if (actions.length === 1) {
            speedText = "Slow (0)"; colorHtml = document.body.classList.contains('light-theme') ? "#059669" : "#10b981";
        }
        statsSpan.innerHTML = `Puntos: <strong style="color:var(--text-main, #e2e8f0);">${actions.length}</strong> &nbsp;|&nbsp; Vel: <strong style="color: ${colorHtml};">${speedText}</strong>`;
    }

    const hCanvas = document.getElementById('heatmap-canvas');
    if (!hCanvas) return;
    
    let totalDurationMs = videoNode && videoNode.duration ? videoNode.duration * 1000 : (actions.length > 0 ? actions[actions.length - 1].at : 0);
    const hCtx = hCanvas.getContext('2d');
    if (totalDurationMs <= 0 || hCanvas.getBoundingClientRect().width === 0) { hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height); return; }
    hCanvas.width = hCanvas.getBoundingClientRect().width;
    hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);

    const bucketCount = 150; 
    const bucketDuration = totalDurationMs / bucketCount;
    const buckets = new Array(bucketCount).fill(0);

    actions.forEach((act, idx) => {
        if (act.at <= totalDurationMs) {
            const b = Math.floor(act.at / bucketDuration);
            if (b >= 0 && b < bucketCount) {
                if (idx > 0 && actions[idx-1].at <= totalDurationMs) buckets[b] += Math.abs(act.pos - actions[idx-1].pos); 
                else buckets[b] += 50; 
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
    if (document.body.classList.contains('panic-mode-active')) return;
    e.preventDefault();
    const mouseX = e.clientX - canvas.getBoundingClientRect().left;
    
    if (e.shiftKey) {
        const timeAtMouse = xToTime(mouseX);
        zoom = Math.round((zoom + (e.deltaY < 0 ? 0.08 : -0.08)) * 100) / 100;
        zoom = Math.max(0.1, Math.min(zoom, 15.0)); 
        scrollLeftMs = timeAtMouse - (mouseX - 30) / (basePixelsPerMs * zoom);
        if (scrollLeftMs < 0) scrollLeftMs = 0; 
    } else {
        if ((videoNode && videoNode.paused) || window.isPlayingVirtual) {
            const visibleMs = (canvas.width - 30) / (basePixelsPerMs * zoom);
            const panStep = visibleMs * 0.10; 
            
            if (e.deltaY < 0) {
                scrollLeftMs += panStep; 
                window.scrollMomentum = Math.min((window.scrollMomentum || 0) + 3, 10);
            } else {
                scrollLeftMs -= panStep; 
                window.scrollMomentum = Math.max((window.scrollMomentum || 0) - 3, -10);
            }
            if (scrollLeftMs < 0) scrollLeftMs = 0;
            if (videoNode && videoNode.duration) {
                const maxScroll = (videoNode.duration * 1000) - visibleMs + 2000; 
                if (scrollLeftMs > maxScroll && maxScroll > 0) scrollLeftMs = maxScroll;
            }
        }
    }
    
    if (isSelecting) {
        selCurrT = xToTime(mouseX);
        selCurrY = e.clientY - canvas.getBoundingClientRect().top;
        const startX_px = timeToX(selStartT);
        if (Math.hypot(mouseX - startX_px, selCurrY - selStartY) > 5) hasDraggedSelection = true;
        
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
}, { passive: false });

window.addEventListener('videoPlay', () => { drawTimeline(); });
window.addEventListener('forceTimelinePan', (e) => {
    let actualTime = window.getActualTimeMs();
    if (e && e.detail && e.detail.timeMs !== undefined) actualTime = e.detail.timeMs;
    const visibleMs = (canvas.width - 30) / (basePixelsPerMs * zoom);
    scrollLeftMs = actualTime - (visibleMs / 2);
    if (scrollLeftMs < 0) scrollLeftMs = 0;
});

window.addEventListener('copyPoints', () => {
    const selected = getSafeActions().filter(a => a.selected);
    if (selected.length > 0) {
        const baseTime = selected[0].at;
        window.clipboardFunscript = selected.map(a => ({ at: a.at - baseTime, pos: Math.round(a.pos), isSync: a.isSync||false }));
    }
});

window.addEventListener('cutPoints', () => {
    if (document.body.classList.contains('panic-mode-active')) return;
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
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
    }
});

window.addEventListener('pastePoints', () => {
    const modal = document.getElementById('preset-editor-modal');
    if (window.clipboardFunscript && window.clipboardFunscript.length > 0 && (!modal || modal.style.display !== 'flex')) {
        getSafeActions().forEach(a => a.selected = false); 
        window.isPastingMode = true;
        window.timelineGhostPreset = window.clipboardFunscript;
        window.timelineGhostTimeMs = null;
        window.drawTimeline();
    }
});

canvas?.addEventListener('dragover', (e) => {
    if (!window.isDraggingPreset || !window.timelineGhostPreset) return;
    e.preventDefault();
    if(e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
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
        const snapDistMs = 350; 
        const actualTimeMs = window.getActualTimeMs();
        
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
        
        const snap = window.snapValue || 5;
        let hoverPos = Math.round(hoverPosRaw / snap) * snap;
        const basePos = window.timelineGhostPreset[0].pos;
        window.timelineGhostDeltaPos = hoverPos - basePos;
    }
});

canvas?.addEventListener('drop', (e) => {
    if (!window.isDraggingPreset || !window.timelineGhostPreset) return;
    e.preventDefault();
    ensureTrackExists();
    let actions = getSafeActions();

    if (window.timelineGhostTargetEnd) {
        const morphed = window.getMorphedPreset(window.timelineGhostPreset, window.timelineGhostMarkers || window.timelineGhostTimeMs, window.timelineGhostTargetEnd);
        if (morphed) {
            saveHistoryState();
            
            let tStart = window.timelineGhostTimeMs;
            let tEnd = window.timelineGhostTargetEnd;
            
            actions.splice(0, actions.length, ...actions.filter(a => a.at < tStart || a.at > tEnd));

            actions.forEach(a => a.selected = false);
            morphed.forEach(m => m.selected = true);
            actions.push(...morphed);
            
            cleanDuplicates();
            window.isDraggingPreset = false; window.timelineGhostPreset = null;
            window.presetFillInitialized = false; window.timelineGhostTargetEnd = null; window.timelineGhostMarkers = null;
            
            if (window.timelineMarkers) window.timelineMarkers.forEach(m => m.selected = false);

            if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
            notifyCloud(); window.updateHeatmapAndStats();
            return;
        }
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    let dropTimeMs = Math.round(window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : Math.max(0, xToTime(mouseX)));
    const deltaY = window.timelineGhostDeltaPos || 0;
    const snap = window.snapValue || 5;
    
    saveHistoryState();
    
    const newActions = window.timelineGhostPreset.map(act => ({
        at: Math.round(dropTimeMs + act.at),
        pos: Math.max(0, Math.min(100, Math.round((act.pos + deltaY)/snap)*snap)),
        selected: true,
        isSync: act.isSync || false
    }));
    
    let tStart = newActions[0].at;
    let tEnd = newActions[newActions.length - 1].at;
    
    actions.splice(0, actions.length, ...actions.filter(a => a.at < tStart || a.at > tEnd));

    actions.forEach(a => a.selected = false); 
    actions.push(...newActions);
    
    cleanDuplicates(); 
    window.isDraggingPreset = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
    
    if (window.timelineMarkers) window.timelineMarkers.forEach(m => m.selected = false);

    if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    notifyCloud(); window.updateHeatmapAndStats();
});

window.drawTimeline = function() {
    try {
        ensureCanvasSize();
        if (!ctx || !canvas) return;
        
        let actualTime = window.getActualTimeMs();
        
        if ((videoNode && !videoNode.paused) || window.isPlayingVirtual) {
            const visibleMs = (canvas.width - 30) / (basePixelsPerMs * zoom);
            scrollLeftMs = actualTime - (visibleMs / 2);
            if (scrollLeftMs < 0) scrollLeftMs = 0;
        }

        const isLight = document.body.classList.contains('light-theme');
        const bgColor = isLight ? '#f8fafc' : '#06090e';
        const gridColor = isLight ? 'rgba(100, 116, 139, 0.2)' : 'rgba(148, 163, 184, 0.15)';
        const timeLineColor = isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.04)';
        const colBgColor = isLight ? '#ffffff' : '#0b0f17';
        const colBorder = isLight ? '#cbd5e1' : '#1e293b';
        const textDimColor = isLight ? '#475569' : '#94a3b8';
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = bgColor; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (document.body.classList.contains('panic-mode-active')) {
            const visibleStartMs = scrollLeftMs;
            const visibleEndMs = scrollLeftMs + (canvas.width - 30) / (basePixelsPerMs * zoom);
            let stepMs = 1000;
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
                    ctx.beginPath(); ctx.roundRect(startX, trackY1, w, trackH, 4); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = isLight ? '#0c4a6e' : '#f0f9ff'; ctx.font = 'bold 11px sans-serif';
                    ctx.fillText(`Cam_0${(i%3)+1}_final.mp4`, startX + 8, trackY1 + 16);

                    ctx.fillStyle = isLight ? '#bbf7d0' : '#10b981';
                    ctx.strokeStyle = isLight ? '#34d399' : '#059669';
                    ctx.beginPath(); ctx.roundRect(startX, trackY2, w, trackH, 4); ctx.fill(); ctx.stroke();
                    
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

        ctx.fillStyle = colBgColor; ctx.fillRect(0, 0, 30, canvas.height);
        ctx.strokeStyle = colBorder; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(30, canvas.height); ctx.stroke();

        [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(p => {
            const y = posToY(p); 
            ctx.fillStyle = textDimColor; ctx.font = 'bold 10px monospace'; ctx.fillText(`${p}%`, 4, y + 3);
        });

        const actions = getSafeActions();

        ctx.save();
        let clipX = scrollLeftMs <= 0 ? 15 : 30; 
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
            
            window.timelineMarkers.forEach(m => {
                m.labelStr = m.isBPM ? `B${bCount++}` : `M${mCount++}`;
            });

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
                    ctx.roundRect(mx - 15, 0, 30, 25, [0, 0, 4, 4]);
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

                    // 🎯 FIX: Ancla de color Morado Oscuro (#581c87)
                    if (act.isSync) {
                        ctx.fillStyle = act.selected ? '#ffffff' : '#581c87'; 
                        ctx.beginPath(); 
                        let size = act.selected ? 9 : 7;
                        ctx.moveTo(x, y - size);
                        ctx.lineTo(x + size, y);
                        ctx.lineTo(x, y + size);
                        ctx.lineTo(x - size, y);
                        ctx.closePath();
                        ctx.fill();
                        ctx.strokeStyle = act.selected ? '#581c87' : '#ffffff';
                        ctx.lineWidth = 2; ctx.stroke();
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
                            ctx.fillStyle = '#581c87'; ctx.beginPath();
                            let size = 7;
                            ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y);
                            ctx.closePath(); ctx.fill();
                            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
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
                        ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 10px monospace';
                        ctx.fillText("(Ajustado por cada marcador)", cursorX + 15, cursorY + 45);
                    } else {
                        ctx.fillStyle = '#10b981'; ctx.font = 'bold 12px monospace';
                        let modeText = window.presetFillMode === 'stretch' ? "Modo: Auto-Ajuste Cuántico" : `Modo: Repetir (${window.presetFillReps || 1}x)`;
                        ctx.fillText(modeText, cursorX + 15, cursorY + 30);
                        ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 10px monospace';
                        ctx.fillText("(Espacio = Cambiar | Flechas ⬅ ➡ = Ajustar)", cursorX + 15, cursorY + 45);
                    }
                }
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
                        ctx.fillStyle = '#581c87'; ctx.beginPath();
                        let size = 6;
                        ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y);
                        ctx.closePath(); ctx.fill();
                        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
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

        if (window.scrollMomentum) {
            if (Math.abs(window.scrollMomentum) > 0.1) {
                window.scrollMomentum *= 0.92;
            } else {
                window.scrollMomentum = 0;
            }

            if (window.scrollMomentum !== 0) {
                const intensity = Math.min(1, Math.abs(window.scrollMomentum) / 10);
                const isForward = window.scrollMomentum > 0;
                
                ctx.save();
                ctx.globalAlpha = intensity * 0.6; 

                const gradWidth = 200;
                const centerY = canvas.height / 2;

                if (isForward) {
                    let grad = ctx.createLinearGradient(canvas.width - gradWidth, 0, canvas.width, 0);
                    grad.addColorStop(0, 'rgba(14, 165, 233, 0)'); 
                    grad.addColorStop(1, isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(14, 165, 233, 0.6)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(canvas.width - gradWidth, 0, gradWidth, canvas.height);

                    let offset = (performance.now() / 15) % 30;
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    
                    for(let i = 0; i < 3; i++) {
                        let cx = canvas.width - 60 + offset - (i * 20);
                        let alpha = 1 - (i * 0.2) - (offset / 30);
                        ctx.globalAlpha = Math.max(0, intensity * alpha);
                        ctx.beginPath(); ctx.moveTo(cx - 10, centerY - 15); ctx.lineTo(cx, centerY); ctx.lineTo(cx - 10, centerY + 15); ctx.stroke();
                    }

                    ctx.globalAlpha = intensity * 0.9;
                    ctx.fillStyle = isLight ? '#0369a1' : '#ffffff';
                    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'right';
                    ctx.fillText("AVANZANDO", canvas.width - 20, canvas.height - 20);

                } else {
                    let grad = ctx.createLinearGradient(30, 0, 30 + gradWidth, 0);
                    grad.addColorStop(0, isLight ? 'rgba(234, 88, 12, 0.35)' : 'rgba(249, 115, 22, 0.6)'); 
                    grad.addColorStop(1, 'rgba(249, 115, 22, 0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(30, 0, gradWidth, canvas.height);

                    let offset = (performance.now() / 15) % 30;
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

                    for(let i = 0; i < 3; i++) {
                        let cx = 80 - offset + (i * 20);
                        let alpha = 1 - (i * 0.2) - (offset / 30);
                        ctx.globalAlpha = Math.max(0, intensity * alpha);
                        ctx.beginPath(); ctx.moveTo(cx + 10, centerY - 15); ctx.lineTo(cx, centerY); ctx.lineTo(cx + 10, centerY + 15); ctx.stroke();
                    }

                    ctx.globalAlpha = intensity * 0.9;
                    ctx.fillStyle = isLight ? '#c2410c' : '#ffffff';
                    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
                    ctx.fillText("REBOBINANDO", 45, canvas.height - 20);
                }
                ctx.restore();
            }
        }

        window.updateGhostThumb();

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
    if (document.body.classList.contains('panic-mode-active')) return; 

    const snap = window.snapValue || 5;

    if (window.isPastingMode && window.timelineGhostPreset) {
        if (e.button === 0) { 
            ensureTrackExists();
            saveHistoryState();
            let actions = getSafeActions();
            const pos = getMousePos(e);
            let dropTimeMs = Math.round(window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : Math.max(0, xToTime(pos.x)));
            const deltaY = window.timelineGhostDeltaPos || 0;
            
            const newActions = window.timelineGhostPreset.map(act => ({
                at: Math.max(0, Math.round(dropTimeMs + act.at)),
                pos: Math.max(0, Math.min(100, Math.round((act.pos + deltaY)/snap)*snap)),
                selected: true,
                isSync: act.isSync || false
            }));
            
            const newTimes = new Set(newActions.map(a => a.at));
            actions.splice(0, actions.length, ...actions.filter(a => !newTimes.has(a.at)));
            actions.forEach(a => a.selected = false);
            actions.push(...newActions);
            cleanDuplicates(); 
            
            window.isPastingMode = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
            
            if (window.timelineMarkers) window.timelineMarkers.forEach(m => m.selected = false);

            if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
            notifyCloud(); window.updateHeatmapAndStats();
            return;
        } else if (e.button === 2) { 
            window.isPastingMode = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
            return;
        }
    }

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
                    if (typeof window.drawTimeline === 'function') window.drawTimeline();
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
                        if (typeof window.drawTimeline === 'function') window.drawTimeline();
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
                if (typeof window.drawTimeline === 'function') window.drawTimeline();
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
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
            return;
        }
        lastRightClickTime = now;
        
        saveHistoryState();
        actions.splice(0, actions.length, ...actions.filter(act => Math.hypot(clickX - timeToX(act.at), clickY - posToY(act.pos)) > 10));
        notifyCloud(); window.updateHeatmapAndStats();
    }
});

canvas?.addEventListener('mousemove', (e) => {
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
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
        return;
    }

    if (isDraggingMarker && draggedMarkerIndex !== -1) {
        const m = window.timelineMarkers[draggedMarkerIndex];
        let newAt = Math.round(xToTime(mouseX) / 50) * 50; 

        const actualTimeMs = window.getActualTimeMs();
        if (Math.abs(timeToX(newAt) - timeToX(actualTimeMs)) < 15) newAt = Math.round(actualTimeMs);

        m.at = Math.max(0, newAt);
        window.timelineMarkers.sort((a, b) => a.at - b.at);
        draggedMarkerIndex = window.timelineMarkers.indexOf(m); 
        
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
        if (typeof window.drawProgressMarkers === 'function') window.drawProgressMarkers();
        return;
    }

    if (window.isPastingMode && window.timelineGhostPreset) {
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
            const snapDistMs = 350; 
            const actualTimeMs = window.getActualTimeMs();
            
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
            
            const snap = window.snapValue || 5;
            let hoverPos = Math.round(hoverPosRaw / snap) * snap;
            const basePos = window.timelineGhostPreset[0].pos;
            window.timelineGhostDeltaPos = hoverPos - basePos;
        }
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

    if (!isDraggingNode && !isSelecting && !isDraggingMarker && !isSelectingMarkers) {
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

window.addEventListener('mouseup', (e) => {
    if (window.isPastingMode) return; 

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
    if (isSelecting && !hasDraggedSelection && e.target === canvas) {
        
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

canvas?.addEventListener('contextmenu', e => e.preventDefault());

function animationLoop() { window.drawTimeline(); requestAnimationFrame(animationLoop); }
requestAnimationFrame(animationLoop);

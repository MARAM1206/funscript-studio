// ==========================================================================
// TIMELINE V76.0: AUTO-CORRECTOR MASIVO SWARM-FIX & MARCADORES SEGUROS
// ==========================================================================

window.funscriptActions = window.funscriptActions || [];
window.timelineMarkers = window.timelineMarkers || []; 
window.activeSuggestion = null; 

window.presetMorphMode = 'stretch'; 

window.hardwareDB = {
    "handy_std": {
        name: "Handy V1 / 2 Standar",
        stroke: 110, factor: 1.10, supports_overclock: false,
        standard: { max: 400, min: 32 }
    },
    "handy_pro": {
        name: "Handy 2 PRO",
        stroke: 125, factor: 1.25, supports_overclock: true,
        standard: { max: 500, min: 20 }, overclock: { max: 650, min: 15 }
    },
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

let isDraggingNode = false; 
let draggedNodeIndex = -1; 
let dragSelectionInitialStates = [];
let dragStartXTime = 0;
let dragStartYPos = 0;

let isDraggingMarker = false;
let draggedMarkerIndex = -1;

window.magneticSnapPoint = null;
window.startMagneticSnapPoint = null;
let hadSelectionBeforeMousedown = false; 
let lastRightClickTime = 0; 

const fpsInput = document.getElementById('fps-jump-input');
const fpsUp = document.getElementById('fps-btn-up');
const fpsDown = document.getElementById('fps-btn-down');

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

// ALGORITMO AUTO-CORRECTOR INDIVIDUAL (Puro)
function getCorrectionSuggestion(act1, act2, hwMax, hwMin, factor) {
    let dt_s = (act2.at - act1.at) / 1000.0;
    if (dt_s <= 0) return null;
    let dp = Math.abs(act2.pos - act1.pos);
    let speed = (dp * factor) / dt_s;

    if (speed <= hwMax && (speed >= hwMin || dp === 0)) return null;

    let isTooFast = speed > hwMax;
    let safe_speed = isTooFast ? hwMax - 1 : hwMin + 1;
    let target_dp = (safe_speed * dt_s) / factor;

    let dir = act2.pos >= act1.pos ? 1 : -1;
    if (dp === 0) dir = act1.pos > 50 ? -1 : 1;

    let raw2 = act1.pos + dir * target_dp;
    let exact2 = Math.max(0, Math.min(100, Math.round(raw2)));

    let new_dp2 = Math.abs(exact2 - act1.pos);
    let new_speed2 = (new_dp2 * factor) / dt_s;
    let valid2 = (new_speed2 <= hwMax) && (new_speed2 >= hwMin || new_dp2 === 0);

    if (valid2 && exact2 !== act2.pos) return { modIdx: 2, newPos: exact2 };

    let raw1 = act2.pos - dir * target_dp;
    let exact1 = Math.max(0, Math.min(100, Math.round(raw1)));

    let new_dp1 = Math.abs(act2.pos - exact1);
    let new_speed1 = (new_dp1 * factor) / dt_s;
    let valid1 = (new_speed1 <= hwMax) && (new_speed1 >= hwMin || new_dp1 === 0);

    if (valid1 && exact1 !== act1.pos) return { modIdx: 1, newPos: exact1 };

    if (exact2 !== act2.pos) return { modIdx: 2, newPos: exact2 };
    return null;
}

// 🎯 FIX: ALGORITMO DE CORRECCIÓN MASIVA (Swarm Fix Constraint Solver)
function massCorrectSelection(actions, hwMax, hwMin, factor) {
    let selectedIdxs = [];
    actions.forEach((a, i) => { if(a.selected) selectedIdxs.push(i); });
    if (selectedIdxs.length <= 1) return false;

    let changed = false;
    // 10 pasadas a velocidad luz para asentar el resorte matemático
    for(let pass = 0; pass < 10; pass++) {
        let passChanged = false;
        for(let i = 0; i < actions.length - 1; i++) {
            if (!actions[i].selected && !actions[i+1].selected) continue;

            let act1 = actions[i]; let act2 = actions[i+1];
            let dt_s = (act2.at - act1.at) / 1000.0;
            if(dt_s <= 0) continue;

            let dp = Math.abs(act2.pos - act1.pos);
            let speed = (dp * factor) / dt_s;

            if (speed > hwMax || (speed < hwMin && dp > 0)) {
                let isTooFast = speed > hwMax;
                let safe_speed = isTooFast ? hwMax - 1 : hwMin + 1;
                let target_dp = (safe_speed * dt_s) / factor;

                let dir = act2.pos >= act1.pos ? 1 : -1;
                if (dp === 0) dir = act1.pos > 50 ? -1 : 1;

                let ideal1 = act2.pos - dir * target_dp;
                let ideal2 = act1.pos + dir * target_dp;

                if (act1.selected && act2.selected) {
                    let mid = (act1.pos + act2.pos) / 2;
                    let new_dp_half = target_dp / 2;
                    let new1 = Math.max(0, Math.min(100, Math.round(mid - dir * new_dp_half)));
                    let new2 = Math.max(0, Math.min(100, Math.round(mid + dir * new_dp_half)));
                    if(act1.pos !== new1 || act2.pos !== new2) {
                        act1.pos = new1; act2.pos = new2;
                        passChanged = true; changed = true;
                    }
                } else if (act1.selected) {
                    let new1 = Math.max(0, Math.min(100, Math.round(ideal1)));
                    if(act1.pos !== new1) { act1.pos = new1; passChanged = true; changed = true; }
                } else if (act2.selected) {
                    let new2 = Math.max(0, Math.min(100, Math.round(ideal2)));
                    if(act2.pos !== new2) { act2.pos = new2; passChanged = true; changed = true; }
                }
            }
        }
        if (!passChanged) break; 
    }
    return changed;
}

function updateFpsInput(change) {
    if (!fpsInput) return;
    let val = parseInt(fpsInput.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    val += change;
    if (val < 1) val = 1;
    if (window.videoFPS && val > window.videoFPS) val = window.videoFPS;
    fpsInput.value = val;
}

if (fpsInput) {
    fpsInput.addEventListener('change', function() { updateFpsInput(0); });
}
if (fpsUp) fpsUp.addEventListener('click', () => updateFpsInput(1));
if (fpsDown) fpsDown.addEventListener('click', () => updateFpsInput(-1));

window.addEventListener('keydown', (e) => {
    // 🎯 FIX: LA TECLA T HA VUELTO (Protegida 100%)
    if ((e.target.tagName === 'INPUT' && e.target.type === 'text') || e.target.tagName === 'TEXTAREA' || e.target.type === 'number') return;
    
    if (e.key.toLowerCase() === 't' && !e.ctrlKey) {
        e.preventDefault();
        window.timelineMarkers = window.timelineMarkers || [];
        const timeMs = (videoNode && videoNode.currentTime) ? Math.round(videoNode.currentTime * 1000) : 0;
        
        let foundIdx = -1;
        for (let i=0; i<window.timelineMarkers.length; i++) {
            if (Math.abs(window.timelineMarkers[i].at - timeMs) <= 50) { foundIdx = i; break; }
        }
        
        if (foundIdx !== -1) window.timelineMarkers.splice(foundIdx, 1);
        else window.timelineMarkers.push({at: timeMs, pos: 80}); 
        
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
        return;
    }

    if (e.code === 'Space' && (window.isDraggingPreset || window.isPastingMode)) {
        e.preventDefault();
        if (window.presetMorphMode === 'stretch') window.presetMorphMode = 'anchor';
        else if (window.presetMorphMode === 'anchor') window.presetMorphMode = 'repeat';
        else if (window.presetMorphMode === 'repeat') window.presetMorphMode = 'raw';
        else window.presetMorphMode = 'stretch';
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
    }
});

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
    if (!selectedActions || selectedActions.length === 0 || !preset || preset.length === 0) return null;
    selectedActions.sort((a, b) => a.at - b.at);
    
    let useAnchorModifier = window.isRightClickDrag === true;
    
    if (window.presetMorphMode === 'raw') {
        const t_min = selectedActions[0].at;
        return preset.map(act => ({
            at: Math.round(t_min + act.at),
            pos: act.pos
        }));
    }
    
    if (selectedActions.length < 2) return null; 
    
    if (window.presetMorphMode === 'repeat' && selectedActions.length >= 3) {
        let results = [];
        let anchors = [0];
        
        const y_min = Math.min(...selectedActions.map(a => a.pos));
        const y_max = Math.max(...selectedActions.map(a => a.pos));
        const amplitude = y_max - y_min;
        
        if (amplitude > 5) {
            const startsAtBottom = Math.abs(selectedActions[0].pos - y_min) <= Math.abs(selectedActions[0].pos - y_max);
            let maxDeviation = 0;

            for (let i = 1; i < selectedActions.length - 1; i++) {
                let curr = selectedActions[i].pos;
                if (startsAtBottom) {
                    let deviation = curr - y_min;
                    if (deviation > maxDeviation) maxDeviation = deviation;
                    let isValley = curr <= (y_min + amplitude * 0.35);
                    if (isValley && maxDeviation >= amplitude * 0.50) { anchors.push(i); maxDeviation = 0; }
                } else {
                    let deviation = y_max - curr;
                    if (deviation > maxDeviation) maxDeviation = deviation;
                    let isPeak = curr >= (y_max - amplitude * 0.35);
                    if (isPeak && maxDeviation >= amplitude * 0.50) { anchors.push(i); maxDeviation = 0; }
                }
            }
        }

        if (anchors[anchors.length - 1] !== selectedActions.length - 1) anchors.push(selectedActions.length - 1);
        if (anchors.length < 2) return window.getMorphedPresetChunk(preset, selectedActions, useAnchorModifier);

        for (let k = 0; k < anchors.length - 1; k++) {
            const chunk = selectedActions.slice(anchors[k], anchors[k+1] + 1);
            if (chunk.length < 2) continue; 
            const subPreset = window.getMorphedPresetChunk(preset, chunk, useAnchorModifier);
            if (k > 0) subPreset.shift(); 
            results.push(...subPreset);
        }
        return results;
    } else {
        return window.getMorphedPresetChunk(preset, selectedActions, useAnchorModifier);
    }
};

window.getMorphedPresetChunk = function(preset, selectedActions, useAnchor) {
    const t_min = selectedActions[0].at;
    const t_max = selectedActions[selectedActions.length - 1].at;
    const targetDuration = t_max - t_min;
    
    const origStartPos = selectedActions[0].pos;
    const origEndPos = selectedActions[selectedActions.length - 1].pos;
    
    const y_min = Math.min(...selectedActions.map(a => a.pos));
    const y_max = Math.max(...selectedActions.map(a => a.pos));
    
    const preset_t_max = preset[preset.length - 1].at;
    const preset_y_min = Math.min(...preset.map(a => a.pos));
    const preset_y_max = Math.max(...preset.map(a => a.pos));

    let origPeakT = t_min + targetDuration / 2;
    let presetPeakT = preset_t_max / 2;

    if (useAnchor) {
        let maxDevOrig = -1;
        for (let i = 0; i < selectedActions.length; i++) {
            let dev = Math.max(Math.abs(selectedActions[i].pos - origStartPos), Math.abs(selectedActions[i].pos - origEndPos));
            if (dev > maxDevOrig) { maxDevOrig = dev; origPeakT = selectedActions[i].at; }
        }
        let maxDevPreset = -1;
        for (let i = 0; i < preset.length; i++) {
            let dev = Math.max(Math.abs(preset[i].pos - preset[0].pos), Math.abs(preset[i].pos - preset[preset.length-1].pos));
            if (dev > maxDevPreset) { maxDevPreset = dev; presetPeakT = preset[i].at; }
        }
    }
    
    return preset.map((act, index) => {
        let newT;

        if (useAnchor && presetPeakT > 0 && presetPeakT < preset_t_max && origPeakT > t_min && origPeakT < t_max) {
            if (act.at <= presetPeakT) {
                let progress = presetPeakT === 0 ? 0 : act.at / presetPeakT;
                newT = t_min + progress * (origPeakT - t_min);
            } else {
                let progress = (act.at - presetPeakT) / (preset_t_max - presetPeakT);
                newT = origPeakT + progress * (t_max - origPeakT);
            }
        } else {
            let progress = preset_t_max === 0 ? 0 : (act.at / preset_t_max);
            newT = t_min + progress * targetDuration;
        }
        
        let newPos;
        
        if (index === 0) {
            newPos = origStartPos;
        } 
        else if (index === preset.length - 1) {
            newPos = origEndPos;
        } 
        else {
            if (preset_y_max !== preset_y_min) {
                let normalizedY = (act.pos - preset_y_min) / (preset_y_max - preset_y_min);
                newPos = y_min + (normalizedY * (y_max - y_min));
            } else {
                newPos = y_min + (y_max - y_min) / 2;
            }
        }
        
        let snappedPos = Math.round(newPos / 5) * 5;
        
        return { 
            at: Math.round(newT), 
            pos: Math.max(0, Math.min(100, snappedPos)) 
        };
    });
};

window.updateHeatmapAndStats = function() {
    const actions = getSafeActions();
    
    const statsSpan = document.getElementById('timeline-stats');
    if (statsSpan) {
        let speedText = "--";
        let colorHtml = "#94a3b8"; 

        if (actions.length > 1) {
            let totalSegmentSpeed = 0;
            let validSegments = 0;
            
            for (let i = 1; i < actions.length; i++) {
                let dt = (actions[i].at - actions[i-1].at) / 1000.0;
                let dp = Math.abs(actions[i].pos - actions[i-1].pos);
                if (dt > 0) { 
                    totalSegmentSpeed += (dp / dt);
                    validSegments++;
                }
            }

            if (validSegments > 0) {
                const fapTapSpeed = Math.round(totalSegmentSpeed / validSegments);
                if (fapTapSpeed >= 250) { speedText = `Very Fast (${fapTapSpeed})`; colorHtml = "#ef4444"; } 
                else if (fapTapSpeed >= 150) { speedText = `Fast (${fapTapSpeed})`; colorHtml = "#f97316"; } 
                else if (fapTapSpeed >= 80) { speedText = `Medium (${fapTapSpeed})`; colorHtml = "#facc15"; } 
                else { speedText = `Slow (${fapTapSpeed})`; colorHtml = "#10b981"; } 
            }
        } else if (actions.length === 1) {
            speedText = "Slow (0)"; colorHtml = "#10b981";
        }
        statsSpan.innerHTML = `Puntos: <strong style="color:var(--text-main, #e2e8f0);">${actions.length}</strong> &nbsp;|&nbsp; Velocidad: <strong style="color: ${colorHtml}; text-shadow: 0 0 5px ${colorHtml}88; white-space: nowrap;">${speedText}</strong>`;
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
    const mouseY = e.clientY - canvas.getBoundingClientRect().top;
    
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
            
            if (e.deltaY < 0) {
                scrollLeftMs += panStep; 
                window.scrollMomentum = Math.min((window.scrollMomentum || 0) + 3, 10);
            } else {
                scrollLeftMs -= panStep; 
                window.scrollMomentum = Math.max((window.scrollMomentum || 0) - 3, -10);
            }
            
            if (scrollLeftMs < 0) scrollLeftMs = 0;
            if (videoNode.duration) {
                const maxScroll = (videoNode.duration * 1000) - visibleMs + 2000; 
                if (scrollLeftMs > maxScroll && maxScroll > 0) scrollLeftMs = maxScroll;
            }
        }
    }
    
    if (isSelecting) {
        selCurrT = xToTime(mouseX);
        selCurrY = mouseY;
        const startX_px = timeToX(selStartT);
        if (Math.hypot(mouseX - startX_px, mouseY - selStartY) > 5) hasDraggedSelection = true;
        
        const minT = Math.min(selStartT, selCurrT); const maxT = Math.max(selStartT, selCurrT);
        const minY = Math.min(selStartY, selCurrY); const maxY = Math.max(selStartY, selCurrY);
        
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
    if (window.clipboardFunscript && window.clipboardFunscript.length > 0 && (!modal || modal.style.display !== 'flex')) {
        getSafeActions().forEach(a => a.selected = false); 
        window.isPastingMode = true;
        window.timelineGhostPreset = window.clipboardFunscript;
        window.timelineGhostTimeMs = null;
        window.drawTimeline();
    }
});

window.addEventListener('presetCustomDragOver', (e) => {
    if (!canvas) return;
    if (window.isDraggingPreset && window.timelineGhostPreset) {
        const rect = canvas.getBoundingClientRect();
        const pos = { x: (e.detail.clientX - rect.left) * (canvas.width / rect.width), y: (e.detail.clientY - rect.top) * (canvas.height / rect.height) };
        let hoverTimeMs = xToTime(pos.x);
        let hoverPosRaw = yToPos(pos.y);
        
        window.timelineGhostMouseX = pos.x;
        window.timelineGhostMouseY = pos.y;
        
        const actions = getSafeActions();
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
        window.timelineGhostTimeMs = bestSnapTime;
        
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

        if (window.presetMorphMode === 'raw' || (window.isAdaptiveModeActive && selected.length >= 2)) {
            const morphed = window.getMorphedPreset(window.timelineGhostPreset, window.presetMorphMode === 'raw' ? [{at: window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : Math.max(0, xToTime(pos.x))}] : selected);
            if (morphed) {
                saveHistoryState();
                
                if (window.presetMorphMode === 'raw') {
                    const newTimes = new Set(morphed.map(a => a.at));
                    window.funscriptActions = actions.filter(a => !newTimes.has(a.at));
                    window.funscriptActions.forEach(a => a.selected = false);
                    window.funscriptActions.push(...morphed);
                } else {
                    window.funscriptActions = actions.filter(a => !newTimes.has(a.at)); 
                    morphed.forEach(m => m.selected = true);
                    window.funscriptActions.push(...morphed);
                }
                
                cleanDuplicates();
                window.isDraggingPreset = false; window.timelineGhostPreset = null; window.timelineGhostTimeMs = null; window.timelineGhostDeltaPos = 0;
                if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
                notifyCloud(); window.updateHeatmapAndStats();
                return;
            }
        }

        const rect = canvas.getBoundingClientRect();
        const pos = { x: (e.detail.clientX - rect.left) * (canvas.width / rect.width), y: (e.detail.clientY - rect.top) * (canvas.height / rect.height) };
        let dropTimeMs = window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : Math.max(0, xToTime(pos.x));
        const deltaY = window.timelineGhostDeltaPos || 0;
        
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
    
    if (isDraggingMarker && draggedMarkerIndex !== -1) {
        window.timelineMarkers.splice(draggedMarkerIndex, 1);
        isDraggingMarker = false;
        draggedMarkerIndex = -1;
        window.drawTimeline();
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

window.updateGhostThumb = function() {
    const ghostThumb = document.getElementById('ghost-thumb');
    if (!ghostThumb || !videoNode || !videoNode.duration) return;

    const visibleMs = (canvas.width - 30) / (basePixelsPerMs * zoom);
    const centerTimeMs = scrollLeftMs + (visibleMs / 2);
    const actualTimeMs = videoNode.currentTime * 1000;

    if (Math.abs(centerTimeMs - actualTimeMs) > visibleMs * 0.05) {
        ghostThumb.style.display = 'block';
        const percentage = (centerTimeMs / (videoNode.duration * 1000)) * 100;
        ghostThumb.style.left = `${Math.max(0, Math.min(100, percentage))}%`;
    } else {
        ghostThumb.style.display = 'none';
    }
};

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
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            const device = window.hardwareDB[window.activeDevice] || window.hardwareDB['handy_std'];
            let hwMax = device.standard.max;
            let hwMin = device.standard.min;
            if (device.supports_overclock && window.isOverclockEnabled && device.overclock) {
                hwMax = device.overclock.max;
                hwMin = device.overclock.min;
            }

            for (let i = 0; i < actions.length - 1; i++) {
                const act1 = actions[i]; const act2 = actions[i+1];
                const x1 = timeToX(act1.at); const y1 = posToY(act1.pos);
                const x2 = timeToX(act2.at); const y2 = posToY(act2.pos);

                let dt_ms = act2.at - act1.at;
                let dp = Math.abs(act2.pos - act1.pos);
                let speed_mms = 0;
                if (dt_ms > 0) {
                    speed_mms = (dp * device.factor) / (dt_ms / 1000);
                }

                let colorNormal = '#38bdf8'; 
                let lineColor = colorNormal; 
                
                const tPulse = performance.now() / 150;
                const pulseFactor = 0.5 + 0.5 * Math.sin(tPulse); 
                
                if (speed_mms > hwMax) {
                    lineColor = isLight ? `rgba(220, 38, 38, ${0.6 + 0.4 * pulseFactor})` : `rgba(239, 68, 68, ${0.4 + 0.6 * pulseFactor})`; 
                } else if (speed_mms < hwMin && dp > 0) {
                    lineColor = isLight ? `rgba(245, 158, 11, ${0.7 + 0.3 * pulseFactor})` : `rgba(250, 204, 21, ${0.4 + 0.6 * pulseFactor})`; 
                }

                let isMorphLine = act1.selected && act2.selected && window.isAdaptiveModeActive && window.isDraggingPreset && window.presetMorphMode !== 'raw';
                
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                
                if (isMorphLine) {
                    const pulse = 0.3 + 0.7 * (Math.sin(performance.now() / 250) * 0.5 + 0.5);
                    ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
                    ctx.lineWidth = 4;
                } else {
                    ctx.strokeStyle = lineColor;
                    ctx.lineWidth = 3;
                }
                ctx.stroke();
            }

            actions.forEach((act, i) => {
                const x = timeToX(act.at);
                if (x >= -20 && x <= canvas.width + 20) {
                    const y = posToY(act.pos); 

                    let dotColor = '#38bdf8';
                    if (i > 0) {
                        let prevAct = actions[i-1];
                        let dt_ms = act.at - prevAct.at;
                        let dp = Math.abs(act.pos - prevAct.pos);
                        let speed_mms = dt_ms > 0 ? (dp * device.factor) / (dt_ms / 1000) : 0;
                        const tPulse = performance.now() / 150;
                        const pulseFactor = 0.5 + 0.5 * Math.sin(tPulse); 
                        
                        if (speed_mms > hwMax) dotColor = isLight ? `rgba(220, 38, 38, ${0.6 + 0.4 * pulseFactor})` : `rgba(239, 68, 68, ${0.5 + 0.5 * pulseFactor})`; 
                        else if (speed_mms < hwMin && dp > 0) dotColor = isLight ? `rgba(245, 158, 11, ${0.8 + 0.2 * pulseFactor})` : `rgba(250, 204, 21, ${0.5 + 0.5 * pulseFactor})`; 
                    }
                    if (act.selected) dotColor = isLight ? '#d97706' : '#f59e0b'; 

                    let isTargetForMorph = act.selected && window.isAdaptiveModeActive && window.isDraggingPreset && window.presetMorphMode !== 'raw';
                    
                    if (isTargetForMorph) {
                        const pulse = 0.3 + 0.7 * (Math.sin(performance.now() / 250) * 0.5 + 0.5);
                        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
                        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
                    } else {
                        ctx.fillStyle = dotColor;
                        ctx.beginPath(); ctx.arc(x, y, act.selected ? 7 : 5, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
                    }
                }
            });
        }

        // 🎯 FIX: TEXTO DINÁMICO PARA AUTO-CORRECCIÓN MASIVA (Swarm Fix)
        if (window.activeSuggestion && !window.isDraggingNode && !window.isDraggingPreset) {
            const act1 = actions[window.activeSuggestion.idx1];
            const act2 = actions[window.activeSuggestion.idx2];
            const sx1 = timeToX(act1.at);
            const sx2 = timeToX(act2.at);
            
            let drawY1 = posToY(act1.pos);
            let drawY2 = posToY(act2.pos);
            let targetX, targetY;

            if (window.activeSuggestion.modIdx === 1) {
                drawY1 = posToY(window.activeSuggestion.newPos);
                targetX = sx1; targetY = drawY1;
            } else {
                drawY2 = posToY(window.activeSuggestion.newPos);
                targetX = sx2; targetY = drawY2;
            }
            
            ctx.beginPath(); ctx.moveTo(sx1, drawY1); ctx.lineTo(sx2, drawY2);
            ctx.lineWidth = 3; ctx.strokeStyle = '#10b981'; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
            
            ctx.beginPath(); ctx.arc(targetX, targetY, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#10b981'; ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
            
            const mx = window.lastMouseX || targetX; const my = window.lastMouseY || targetY;
            
            let hasMultiselect = actions.filter(a => a.selected).length > 1;
            let tooltipText = hasMultiselect ? "Clic Der: Auto-Corregir Masivo" : "Clic Derecho para Auto-Corregir";
            let boxWidth = hasMultiselect ? 245 : 240;

            ctx.fillStyle = isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(16, 185, 129, 0.95)';
            ctx.fillRect(mx + 15, my + 15, boxWidth, 25);
            ctx.fillStyle = isLight ? '#0f172a' : '#ffffff'; 
            ctx.font = 'bold 11px monospace';
            ctx.fillText(tooltipText, mx + 25, my + 32);
        }

        if ((window.isDraggingPreset || window.isPastingMode) && window.timelineGhostPreset && window.timelineGhostTimeMs !== null) {
            const selected = actions.filter(a => a.selected);
            if (window.isDraggingPreset && window.isAdaptiveModeActive && selected.length >= 2 && window.presetMorphMode !== 'raw') {
                const morphed = window.getMorphedPreset(window.timelineGhostPreset, selected);
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
                        ctx.fillStyle = `rgba(16, 185, 129, ${pulseG})`;
                        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
                    });
                    
                    const cursorX = window.timelineGhostMouseX !== undefined ? window.timelineGhostMouseX : timeToX(morphed[0].at);
                    const cursorY = window.timelineGhostMouseY !== undefined ? window.timelineGhostMouseY : posToY(morphed[0].pos);
                    
                    if (window.isRightClickDrag) {
                        ctx.fillStyle = '#f43f5e'; 
                        ctx.font = 'bold 12px monospace';
                        let modeText = window.presetMorphMode === 'stretch' ? "Estirar" : "Repetir";
                        ctx.fillText(`Modo: ${modeText} + ANCLAR PICO`, cursorX + 15, cursorY + 30);
                        ctx.fillStyle = '#fda4af'; 
                        ctx.font = 'bold 10px monospace';
                        ctx.fillText("(Arrastre Especial Activado)", cursorX + 15, cursorY + 45);
                    } else {
                        ctx.fillStyle = '#10b981'; 
                        ctx.font = 'bold 12px monospace';
                        let modeText = window.presetMorphMode === 'stretch' ? "Estirar (Lineal)" : "Repetir (Ciclos)";
                        ctx.fillText(`Modo Adaptativo: ${modeText}`, cursorX + 15, cursorY + 30);
                        ctx.fillStyle = '#f59e0b'; 
                        ctx.font = 'bold 10px monospace';
                        ctx.fillText("(Presiona ESPACIO para alternar)", cursorX + 15, cursorY + 45);
                    }
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
                
                const pasteX = window.timelineGhostMouseX !== undefined ? window.timelineGhostMouseX : timeToX(window.timelineGhostTimeMs);
                const pasteY = window.timelineGhostMouseY !== undefined ? window.timelineGhostMouseY : posToY(window.timelineGhostPreset[0].pos + deltaY);
                
                ctx.fillStyle = '#10b981'; ctx.font = 'bold 12px monospace';
                
                if (window.presetMorphMode === 'raw' && window.isDraggingPreset) {
                    ctx.fillText("Modo Adaptativo: ESCALA PURA (Clon)", pasteX + 15, pasteY + 30);
                    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 10px monospace';
                    ctx.fillText("(Presiona ESPACIO para alternar)", pasteX + 15, pasteY + 45);
                } else if (window.isPastingMode) {
                    ctx.fillText("📋 PEGAR (Click para soltar o ESC para cancelar)", pasteX + 15, pasteY + 30);
                }
            }
        }

        if (isSelecting) {
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.setLineDash([2, 2]); ctx.beginPath(); 
            const sX = timeToX(selStartT);
            const cX = timeToX(selCurrT);
            ctx.fillRect(sX, selStartY, cX - sX, selCurrY - selStartY); 
            ctx.strokeRect(sX, selStartY, cX - sX, selCurrY - selStartY); 
            ctx.setLineDash([]);
        }

        if (window.timelineMarkers && window.timelineMarkers.length > 0) {
            window.timelineMarkers.forEach((m, index) => {
                const mx = timeToX(m.at);
                const my = posToY(m.pos);
                if (mx >= 30) {
                    ctx.strokeStyle = '#d946ef'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
                    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, canvas.height); ctx.stroke();
                    ctx.setLineDash([]);
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI*2); ctx.fill();
                    ctx.strokeStyle = '#d946ef'; ctx.lineWidth = 2; ctx.stroke();

                    ctx.fillStyle = (isDraggingMarker && draggedMarkerIndex === index) ? '#ffffff' : '#d946ef';
                    ctx.beginPath();
                    ctx.moveTo(mx - 15, 0);
                    ctx.lineTo(mx + 15, 0);
                    ctx.lineTo(mx + 15, 14);
                    ctx.lineTo(mx, 22);
                    ctx.lineTo(mx - 15, 14);
                    ctx.closePath();
                    ctx.fill();
                    
                    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
                    ctx.fillText("TAG", mx, 10);
                    ctx.textAlign = 'left';
                }
            });
        }

        if (window.magneticSnapPoint && !isSelecting && !isDraggingNode && !isDraggingMarker) {
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
    if (window.isPastingMode && window.timelineGhostPreset) {
        if (e.button === 0) { 
            ensureTrackExists();
            saveHistoryState();
            let actions = getSafeActions();
            const pos = getMousePos(e);
            let dropTimeMs = window.timelineGhostTimeMs !== null ? window.timelineGhostTimeMs : Math.max(0, xToTime(pos.x));
            const deltaY = window.timelineGhostDeltaPos || 0;
            
            getSafeActions().forEach(a => a.selected = false); 
            
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
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
            return;
        }
    }

    const actions = getSafeActions();
    const pos = getMousePos(e);
    const clickX = pos.x; const clickY = pos.y;

    if (e.button === 0) { 
        if (window.timelineMarkers && window.timelineMarkers.length > 0) {
            for (let i = 0; i < window.timelineMarkers.length; i++) {
                const m = window.timelineMarkers[i];
                const mx = timeToX(m.at);
                if (Math.abs(clickX - mx) <= 15) { 
                    isDraggingMarker = true;
                    draggedMarkerIndex = i;
                    saveHistoryState();
                    return; 
                }
            }
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
            
            window.startMagneticSnapPoint = window.magneticSnapPoint ? { ...window.magneticSnapPoint } : null;
        }
    } else if (e.button === 2) { 
        
        let selectedCount = actions.filter(a => a.selected).length;
        
        // 🎯 FIX: AUTO-CORRECTOR MASIVO O INDIVIDUAL EN CLIC DERECHO
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
                    actions[window.activeSuggestion.idx1].pos = window.activeSuggestion.newPos;
                } else {
                    actions[window.activeSuggestion.idx2].pos = window.activeSuggestion.newPos;
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
            if (videoNode) {
                let clickedTimeMs = xToTime(clickX);
                videoNode.currentTime = Math.max(0, clickedTimeMs / 1000);
                
                window.dispatchEvent(new CustomEvent('forceTimelinePan', { detail: { timeMs: clickedTimeMs } }));
            }
            lastRightClickTime = 0;
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
            return;
        }
        lastRightClickTime = now;
        
        saveHistoryState();
        window.funscriptActions = actions.filter(act => Math.hypot(clickX - timeToX(act.at), clickY - posToY(act.pos)) > 10);
        notifyCloud(); window.updateHeatmapAndStats();
    }
});

canvas?.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    const mouseX = pos.x; const mouseY = pos.y;
    window.lastMouseX = mouseX;
    window.lastMouseY = mouseY;
    
    if (isDraggingMarker && draggedMarkerIndex !== -1) {
        const m = window.timelineMarkers[draggedMarkerIndex];
        m.at = Math.max(0, Math.round(xToTime(mouseX) / 50) * 50); 
        m.pos = Math.max(0, Math.min(100, Math.round(yToPos(mouseY) / 5) * 5)); 
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
        return;
    }

    if (window.isPastingMode && window.timelineGhostPreset) {
        let hoverTimeMs = xToTime(mouseX);
        let hoverPosRaw = yToPos(mouseY);
        
        window.timelineGhostMouseX = mouseX;
        window.timelineGhostMouseY = mouseY;
        
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

    window.activeSuggestion = null;
    const device = window.hardwareDB[window.activeDevice] || window.hardwareDB['handy_std'];
    let hwMax = device.standard.max;
    let hwMin = device.standard.min;
    if (device.supports_overclock && window.isOverclockEnabled && device.overclock) {
        hwMax = device.overclock.max;
        hwMin = device.overclock.min;
    }

    if (!isDraggingNode && !isSelecting && !isDraggingMarker) {
        for (let i = 0; i < actions.length - 1; i++) {
            let act1 = actions[i]; let act2 = actions[i+1];
            let px1 = timeToX(act1.at); let py1 = posToY(act1.pos);
            let px2 = timeToX(act2.at); let py2 = posToY(act2.pos);
            
            if (mouseX >= Math.min(px1, px2) - 20 && mouseX <= Math.max(px1, px2) + 20) {
                let dist = pDistance(mouseX, mouseY, px1, py1, px2, py2);
                if (dist <= 15) { 
                    let suggestion = getCorrectionSuggestion(act1, act2, hwMax, hwMin, device.factor);
                    if (suggestion) {
                        window.activeSuggestion = { ...suggestion, idx1: i, idx2: i+1 };
                        break;
                    }
                }
            }
        }
    }

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
        selCurrT = xToTime(mouseX);
        selCurrY = mouseY;
        
        const startX_px = timeToX(selStartT);
        if (Math.hypot(mouseX - startX_px, mouseY - selStartY) > 5) hasDraggedSelection = true;
        
        const minT = Math.min(selStartT, selCurrT); const maxT = Math.max(selStartT, selCurrT);
        const minY = Math.min(selStartY, selCurrY); const maxY = Math.max(selStartY, selCurrY);
        
        actions.forEach(act => {
            const ny = posToY(act.pos);
            act.selected = (act.at >= minT && act.at <= maxT && ny >= minY && ny <= maxY);
        });
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
    }
});

window.addEventListener('mouseup', (e) => {
    if (window.isPastingMode) return; 

    if (isDraggingMarker) {
        isDraggingMarker = false;
        draggedMarkerIndex = -1;
        return;
    }

    let actions = getSafeActions();
    if (isSelecting && !hasDraggedSelection && e.target === canvas) {
        
        if (!hadSelectionBeforeMousedown) {
            ensureTrackExists(); 
            actions = getSafeActions(); 

            let clickTime = Math.max(0, Math.round(selStartT / 50) * 50);
            let clickPos = Math.round(yToPos(selStartY) / 5) * 5; 
            
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

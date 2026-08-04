// ==========================================================================
// TIMELINE V28.0: LAZY INITIALIZATION (CREA SCRIPT AL TOCAR)
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

// 🎯 NUEVO: Creador Inteligente Bajo Demanda
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

const originalUpdateActions

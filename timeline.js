// ==========================================================================
// TIMELINE V1.8: MOTOR CONTINUO A 60 FPS Y DESELECCIÓN INTELIGENTE
// ==========================================================================

const canvas = document.getElementById('timeline-canvas');
const ctx = canvas.getContext('2d');
const actionsLog = document.getElementById('actions-log');

let funscriptActions = [];
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;
let clipboard = [];

window.timelineGhostPreset = null;
window.timelineGhostMouseX = -1;

let zoom = 1.0; 
let basePixelsPerMs = 0.05; 
let panX = 0; 

let isSelecting = false;
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;
let isNavigatingBN = false;

function resizeCanvas() {
    const parent = canvas.parentElement;
    if (parent && parent.clientWidth > 0) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        calculateAdaptiveZoom();
    }
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 500);

function calculateAdaptiveZoom() {
    if (videoPlayer && videoPlayer.duration) {
        const timeWindow = Math.min(videoPlayer.duration * 1000, 25000);
        basePixelsPerMs = (canvas.width - 60) / timeWindow;
    } else {
        basePixelsPerMs = (canvas.width - 60) / 25000;
    }
}

// NUEVO MOTOR DE REDIBUJADO CONTINUO (60 FPS fluidos estilo DaVinci Resolve)
function startSmoothTimelineLoop() {
    if (videoPlayer && !videoPlayer.paused) {
        panX = 0; 
        // Deselección automática global activa si el video corre libremente
        if (!isNavigatingBN && funscriptActions.some(act => act.selected)) {
            funscriptActions.forEach(act => act.selected = false);
            updateActionsLog();
        }
    }
    drawTimeline();
    requestAnimationFrame(startSmoothTimelineLoop); // Llama al siguiente refresco de pantalla nativo
}
requestAnimationFrame(startSmoothTimelineLoop);

if (videoPlayer) {
    videoPlayer.addEventListener('seeking', () => {
        if (!isNavigatingBN) funscriptActions.forEach(act => act.selected = false);
    });
    videoPlayer.addEventListener('loadedmetadata', () => {
        calculateAdaptiveZoom(); zoom = 1.0; panX = 0;
    });
}

function timeToX(timeMs) {
    const center = canvas.width / 2;
    const currentTimeMs = (videoPlayer && videoPlayer.src) ? videoPlayer.currentTime * 1000 : 0;
    const deltaMs = timeMs - currentTimeMs;
    return center + panX + (deltaMs * basePixelsPerMs * zoom);
}

function xToTime(xPos) {
    const center = canvas.width / 2;
    const currentTimeMs = (videoPlayer && videoPlayer.src) ? videoPlayer.currentTime * 1000 : 0;
    const deltaX = xPos - center - panX;
    return (deltaX / (basePixelsPerMs * zoom)) + currentTimeMs;
}

function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
}

function saveHistoryState() {
    undoStack.push(funscriptActions.map(act => ({ ...act })));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
}

function executeUndo() {
    if (undoStack.length === 0) return;
    redoStack.push(funscriptActions.map(act => ({ ...act })));
    funscriptActions = undoStack.pop();
    updateActionsLog();
}

function executeRedo() {
    if (redoStack.length === 0) return;
    undoStack.push(funscriptActions.map(act => ({ ...act })));
    funscriptActions = redoStack.pop();
    updateActionsLog();
}
window.saveHistoryState = saveHistoryState;

window.addEventListener('keydown', function(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;
    const key = event.key.toLowerCase();

    if (event.ctrlKey && key === 'z') { event.preventDefault(); executeUndo(); return; }
    if (event.ctrlKey && key === 'y') { event.preventDefault(); executeRedo(); return; }

    if (key === 'b') {
        event.preventDefault();
        if (funscriptActions.length === 0 || !videoPlayer.src) return;
        const currentTimeMs = Math.floor(videoPlayer.currentTime * 1000);
        const prevAct = [...funscriptActions].reverse().find(act => act.at < currentTimeMs - 6);
        if (prevAct) {
            isNavigatingBN = true;
            funscriptActions.forEach(act => act.selected = false);
            prevAct.selected = true; 
            videoPlayer.currentTime = prevAct.at / 1000;
            updateActionsLog();
            setTimeout(() => { isNavigatingBN = false; }, 80);
        }
        return;
    }
    if (key === 'n') {
        event.preventDefault();
        if (funscriptActions.length === 0 || !videoPlayer.src) return;
        const currentTimeMs = Math.floor(videoPlayer.currentTime * 1000);
        const nextAct = funscriptActions.find(act => act.at > currentTimeMs + 6);
        if (nextAct) {
            isNavigatingBN = true;
            funscriptActions.forEach(act => act.selected = false);
            nextAct.selected = true; 
            videoPlayer.currentTime = nextAct.at / 1000;
            updateActionsLog();
            setTimeout(() => { isNavigatingBN = false; }, 80);
        }
        return;
    }

    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        const selected = funscriptActions.filter(act => act.selected);
        if (selected.length > 0) {
            event.preventDefault();
            saveHistoryState();
            selected.forEach(act => {
                if (key === 'arrowup') act.pos = Math.min(100, act.pos + 5);
                if (key === 'arrowdown') act.pos = Math.max(0, act.pos - 5);
                if (key === 'arrowleft') act.at = Math.max(0, act.at - 100);
                if (key === 'arrowright') act.at = act.at + 100;
            });
            funscriptActions.sort((a, b) => a.at - b.at);
            updateActionsLog();
        }
        return;
    }

    if (event.ctrlKey && key === 'c') {
        event.preventDefault();
        const selected = funscriptActions.filter(act => act.selected);
        if (selected.length > 0) {
            const baseTime = selected[0].at;
            clipboard = selected.map(act => ({ relAt: act.at - baseTime, pos: act.pos }));
        }
        return;
    }

    if (event.ctrlKey && key === 'v') {
        event.preventDefault();
        if (clipboard.length > 0 && videoPlayer.src) {
            saveHistoryState();
            const currentTimeMs = Math.floor(videoPlayer.currentTime * 1000);
            clipboard.forEach(item => {
                const targetTime = currentTimeMs + item.relAt;
                funscriptActions = funscriptActions.filter(act => act.at !== targetTime);
                funscriptActions.push({ at: targetTime, pos: item.pos, selected: false });
            });
            funscriptActions.sort((a, b) => a.at - b.at);
            updateActionsLog();
        }
        return;
    }

    let position = null;
    if (key >= '1' && key <= '9') position = parseInt(key) * 10;
    else if (key === '0') position = 0;
    else if (event.code === 'NumpadEnter' || event.key === 'Enter') {
        event.preventDefault(); position = 100;
    }

    if (position !== null && videoPlayer.src) {
        event.preventDefault();
        saveHistoryState();
        const timeMs = Math.floor(videoPlayer.currentTime * 1000);
        addAction(timeMs, position);
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (funscriptActions.some(act => act.selected)) {
            saveHistoryState();
            funscriptActions = funscriptActions.filter(act => !act.selected);
            updateActionsLog();
        }
    }
});

function addAction(timeMs, position) {
    funscriptActions = funscriptActions.filter(act => act.at !== timeMs);
    funscriptActions.push({ at: timeMs, pos: position, selected: false });
    funscriptActions.sort((a, b) => a.at - b.at);
    updateActionsLog();
}

canvas.addEventListener('dragover', function(event) {
    event.preventDefault();
    if (!window.timelineGhostPreset) return;
    const pos = getMousePos(event);
    const centerFixedX = canvas.width / 2 + panX;
    if (Math.abs(pos.x - centerFixedX) < 25) window.timelineGhostMouseX = centerFixedX;
    else window.timelineGhostMouseX = pos.x;
});

canvas.addEventListener('dragleave', function() { window.timelineGhostMouseX = -1; });

canvas.addEventListener('drop', function(event) {
    event.preventDefault();
    if (!window.timelineGhostPreset || !videoPlayer.src) return;
    const dropX = (window.timelineGhostMouseX !== -1) ? window.timelineGhostMouseX : getMousePos(event).x;
    const targetTimeMs = Math.floor(xToTime(dropX));
    
    saveHistoryState();
    window.timelineGhostPreset.forEach(presetAct => {
        const finalTime = targetTimeMs + presetAct.at;
        if (finalTime >= 0) {
            funscriptActions = funscriptActions.filter(act => act.at !== finalTime);
            funscriptActions.push({ at: finalTime, pos: presetAct.pos, selected: false });
        }
    });
    funscriptActions.sort((a, b) => a.at - b.at);
    window.timelineGhostPreset = null; window.timelineGhostMouseX = -1;
    updateActionsLog();
});

canvas.addEventListener('wheel', function(event) {
    event.preventDefault();
    if (event.shiftKey) panX -= event.deltaY * 0.7;
    else {
        if (event.deltaY < 0) zoom = Math.min(40.0, zoom + 0.15);
        else zoom = Math.max(0.5, zoom - 0.15);
        if (zoom === 1.0) panX = 0;
    }
});

canvas.addEventListener('mousedown', function(event) {
    if (event.shiftKey) return;
    const pos = getMousePos(event);
    startX = pos.x; startY = pos.y;
    const h = canvas.height;
    let clickedANode = false;

    funscriptActions.forEach(action => {
        const renderX = timeToX(action.at);
        const renderY = h - (action.pos / 100) * h;

        if (Math.abs(renderX - startX) <= 8 && Math.abs(renderY - startY) <= 8) {
            clickedANode = true;
            if (event.ctrlKey) action.selected = !action.selected;
            else {
                funscriptActions.forEach(act => act.selected = false);
                action.selected = true;
            }
        }
    });

    if (clickedANode) {
        isSelecting = false; updateActionsLog();
    } else {
        isSelecting = true; currentX = startX; currentY = startY;
        if (!event.ctrlKey) funscriptActions.forEach(act => act.selected = false);
    }
});

canvas.addEventListener('mousemove', function(event) {
    if (!isSelecting) return;
    const pos = getMousePos(event);
    currentX = pos.x; currentY = pos.y;
});

canvas.addEventListener('mouseup', function(event) {
    if (isSelecting) {
        isSelecting = false;
        const pos = getMousePos(event);
        currentX = pos.x; currentY = pos.y;
        const xMin = Math.min(startX, currentX); const xMax = Math.max(startX, currentX);
        const yMin = Math.min(startY, currentY); const yMax = Math.max(startY, currentY);
        const h = canvas.height;

        if (xMax - xMin > 2 || yMax - yMin > 2) {
            funscriptActions.forEach(action => {
                const renderX = timeToX(action.at);
                const renderY = h - (action.pos / 100) * h;
                if (renderX >= xMin && renderX <= xMax && renderY >= (yMin - 30) && renderY <= (yMax + 30)) {
                    action.selected = true;
                }
            });
        }
        updateActionsLog();
    }
});

function drawTimeline() {
    if (!canvas.width) return;
    const h = canvas.height; const w = canvas.width;
    ctx.clearRect(0, 0, w, h);
    
    ctx.fillStyle = 'rgba(37, 99, 235, 0.05)'; ctx.fillRect(0, 0, w, h * 0.30);
    ctx.fillStyle = 'rgba(139, 92, 246, 0.02)'; ctx.fillRect(0, h * 0.30, w, h * 0.50);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.04)'; ctx.fillRect(0, h * 0.80, w, h * 0.20);

    ctx.lineWidth = 1; ctx.font = '9px monospace';
    for (let i = 0; i <= 100; i += 10) {
        const y = h - (i / 100) * h;
        ctx.setLineDash([4, 4]); ctx.strokeStyle = (i === 20 || i === 70) ? '#475569' : '#141d2b';
        if (i === 20 || i === 70) ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = (i === 20 || i === 70 || i === 100 || i === 0) ? '#64748b' : '#2a374a';
        ctx.fillText(`${i}%`, 8, y + 3);
    }

    if (funscriptActions.length > 0) {
        ctx.lineWidth = 2; ctx.strokeStyle = '#2563eb'; ctx.beginPath();
        funscriptActions.forEach((action, index) => {
            const x = timeToX(action.at); const y = h - (action.pos / 100) * h;
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        funscriptActions.forEach((action) => {
            const x = timeToX(action.at); const y = h - (action.pos / 100) * h;
            if (x >= 0 && x <= w) {
                ctx.beginPath(); ctx.arc(x, y, action.selected ? 6 : 4, 0, 2 * Math.PI);
                if (action.selected) {
                    ctx.fillStyle = '#f97316'; 
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
                    ctx.fill(); ctx.stroke();
                } else {
                    ctx.fillStyle = '#2563eb'; 
                    ctx.fill();
                }
            }
        });
    }

    if (window.timelineGhostPreset && window.timelineGhostMouseX !== -1) {
        const targetTimeMs = xToTime(window.timelineGhostMouseX);
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
        ctx.setLineDash([3, 3]); ctx.beginPath();
        
        window.timelineGhostPreset.forEach((action, index) => {
            const x = timeToX(targetTimeMs + action.at); const y = h - (action.pos / 100) * h;
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke(); ctx.setLineDash([]);
    }

    if (isSelecting) {
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.setLineDash([2, 2]); ctx.beginPath();
        ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
        ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        ctx.setLineDash([]);
    }

    const centerFixedX = w / 2 + panX;
    ctx.lineWidth = 2; ctx.strokeStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(centerFixedX, 0); ctx.lineTo(centerFixedX, h); ctx.stroke();
    
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(centerFixedX - 6, 0); ctx.lineTo(centerFixedX + 6, 0);
    ctx.lineTo(centerFixedX, 8); ctx.closePath(); ctx.fill();
}

function updateActionsLog() {
    if (funscriptActions.length === 0) {
        actionsLog.innerHTML = '<span class="empty-log">Sin puntos registrados aún</span>';
        return;
    }
    const latestActions = [...funscriptActions].reverse().slice(0, 5);
    actionsLog.innerHTML = latestActions.map(act => {
        const seconds = (act.at / 1000).toFixed(3);
        let isSelText = act.selected ? '<strong style="color:#f97316;">[Sel]</strong> ' : '';
        return `<div style="margin-bottom: 4px;">
            ${isSelText}<span style="color: #64748b;">[${seconds}s]</span> 
            <span style="color: #2563eb; font-weight:bold;">POS: ${act.pos}%</span> 
        </div>`;
    }).join('');
}

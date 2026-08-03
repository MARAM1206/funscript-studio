// ==========================================================================
// REPRODUCTOR Y MOTOR DE ATAJOS V14.0 (RECUPERACIÓN TECLADO + ARRASTRE FIX)
// ==========================================================================

const videoInput = document.getElementById('video-input');
const videoPlayer = document.getElementById('video-player');
const videoProgress = document.getElementById('video-progress');

window.videoPlayer = videoPlayer;
window.currentVideoName = null; 

const vName = document.getElementById('v-name');
const vRes = document.getElementById('v-res');
const vFps = document.getElementById('v-fps');
const vSpeed = document.getElementById('v-speed');
const vMute = document.getElementById('v-mute');

const vTimeCurrent = document.getElementById('v-time-current');
const vTimeTotal = document.getElementById('v-time-total');

let currentSpeed = 1.0; 
window.videoFPS = 30; 

function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

videoInput?.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) loadVideoFile(file);
});

function loadVideoFile(file) {
    const videoURL = URL.createObjectURL(file);
    videoPlayer.src = videoURL;
    videoPlayer.load();
    videoPlayer.playbackRate = currentSpeed;
    window.currentVideoName = file.name;
    if (vName) vName.innerText = `📄 ${file.name}`;
    if (typeof window.updateFileManagerUI === 'function') window.updateFileManagerUI();
}

let isSeeking = false;
videoProgress?.addEventListener('mousedown', () => isSeeking = true);
videoProgress?.addEventListener('mouseup', () => isSeeking = false);

videoProgress?.addEventListener('input', () => {
    if (videoPlayer.duration) {
        const targetTime = (videoProgress.value / 100) * videoPlayer.duration;
        videoPlayer.currentTime = targetTime;
        window.dispatchEvent(new Event('forceTimelinePan')); 
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
    }
});

videoPlayer?.addEventListener('timeupdate', () => {
    if (!isSeeking && videoPlayer.duration && videoProgress) {
        videoProgress.value = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    }
    if (vTimeCurrent) vTimeCurrent.innerText = formatTime(videoPlayer.currentTime);
});

videoPlayer?.addEventListener('play', () => {
    window.dispatchEvent(new Event('videoPlay'));
    if (typeof window.playHandy === 'function') window.playHandy(videoPlayer.currentTime * 1000);
});

videoPlayer?.addEventListener('pause', () => {
    if (typeof window.stopHandy === 'function') window.stopHandy();
});

videoPlayer?.addEventListener('seeked', () => {
    if (!videoPlayer.paused && typeof window.playHandy === 'function') window.playHandy(videoPlayer.currentTime * 1000);
});

videoPlayer?.addEventListener('loadedmetadata', () => {
    if (vRes) vRes.innerText = `📏 ${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`;
    if (vFps) vFps.innerText = `⏱️ ~30 fps`; 
    if (vTimeTotal) vTimeTotal.innerText = formatTime(videoPlayer.duration);
    if (vTimeCurrent) vTimeCurrent.innerText = formatTime(videoPlayer.currentTime);
    if (typeof window.calculateAdaptiveZoom === 'function') window.calculateAdaptiveZoom();
});

videoPlayer?.addEventListener('volumechange', () => {
    if (vMute) {
        vMute.innerText = videoPlayer.muted || videoPlayer.volume === 0 ? "🔇 Muteado" : "🔊 Sonido On";
        vMute.style.color = videoPlayer.muted || videoPlayer.volume === 0 ? "#ef4444" : "#38bdf8";
    }
});

// 🛡️ REPARACIÓN DEL DRAG AND DROP (NO SALTAR CON TEXTO)
const dragOverlay = document.getElementById('drag-drop-overlay');
let dragCounter = 0;

window.addEventListener('dragenter', (e) => { 
    if (window.isDraggingPreset) return; 
    // Verifica estricitamente que lo que llevas en el mouse sean Archivos (Files), no texto
    if (!e.dataTransfer.types.includes('Files')) return; 
    e.preventDefault(); dragCounter++; dragOverlay?.classList.add('active'); 
});
window.addEventListener('dragleave', (e) => { 
    if (window.isDraggingPreset) return; 
    if (!e.dataTransfer.types.includes('Files')) return; 
    e.preventDefault(); dragCounter--; if (dragCounter === 0) dragOverlay?.classList.remove('active'); 
});
window.addEventListener('dragover', (e) => { 
    if (window.isDraggingPreset) return; 
    if (!e.dataTransfer.types.includes('Files')) return; 
    e.preventDefault(); 
});

window.addEventListener('drop', (e) => {
    if (window.isDraggingPreset) return; 
    if (!e.dataTransfer.types.includes('Files')) return; 
    e.preventDefault(); dragCounter = 0; dragOverlay?.classList.remove('active');
    
    const files = Array.from(e.dataTransfer.files);
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    const funscriptFiles = files.filter(f => f.name.toLowerCase().endsWith('.funscript') || f.name.toLowerCase().endsWith('.json'));

    if (videoFiles.length > 0) loadVideoFile(videoFiles[0]);
    if (funscriptFiles.length > 0 && typeof window.loadFunscriptFiles === 'function') window.loadFunscriptFiles(funscriptFiles);
});

// 🛡️ MODO CAPTURA EN TECLADO (RECUPERADO Y BLINDADO)
window.addEventListener('keydown', (event) => {
    if ((event.target.tagName === 'INPUT' && event.target.type === 'text') || event.target.tagName === 'TEXTAREA') return;

    const key = event.key.toLowerCase();
    const fps = window.videoFPS;
    const stepTime = 3 / fps; 
    const syncSlider = () => { if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection(); };
    const hasSelection = window.funscriptActions && window.funscriptActions.some(a => a.selected);
    const isPlaying = !videoPlayer.paused;

    // 🎯 EVENTOS CON LA TECLA CTRL PRESIONADA
    if (event.ctrlKey) {
        if (key === 'z') { event.preventDefault(); window.dispatchEvent(new Event('undoAction')); return; }
        if (key === 'y') { event.preventDefault(); window.dispatchEvent(new Event('redoAction')); return; }
        if (key === 'a') { event.preventDefault(); window.dispatchEvent(new Event('selectAllPoints')); return; }
        
        // Empuje vertical (Múltiplos de 5%)
        if (key === 'arrowup' || key === 'arrowdown') {
            event.preventDefault(); event.stopPropagation();
            const dir = (key === 'arrowup') ? 'up' : 'down';
            window.dispatchEvent(new CustomEvent('nudgePoints', { detail: dir }));
        }
        return; // Ignoramos el resto si se oprime Ctrl
    }

    // 🎯 BORRAR PUNTOS
    if (key === 'delete' || key === 'backspace') {
        event.preventDefault(); window.dispatchEvent(new Event('deletePoints')); return;
    }

    // 🎯 REGLAS DE FLECHAS NORMALES (Sin Ctrl)
    if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
        event.preventDefault(); 
        event.stopPropagation();
        
        if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur(); 

        if (isPlaying && (key === 'arrowup' || key === 'arrowdown')) {
            const dir = (key === 'arrowup') ? 'up' : 'down';
            window.dispatchEvent(new CustomEvent('injectPoint', { detail: { dir: dir } }));
        } 
        else if (!isPlaying && hasSelection && (key === 'arrowleft' || key === 'arrowright')) {
            const dir = (key === 'arrowleft') ? 'left' : 'right';
            window.dispatchEvent(new CustomEvent('nudgeTime', { detail: dir }));
        } 
        else if (!isPlaying && (key === 'arrowup' || key === 'arrowdown')) {
            const dir = (key === 'arrowup') ? 'up' : 'down';
            window.dispatchEvent(new CustomEvent('injectPoint', { detail: { dir: dir } }));
        }
        return; 
    }

    // DEMÁS ATAJOS CLÁSICOS
    if (key === 'c' && hasSelection) { event.preventDefault(); window.dispatchEvent(new CustomEvent('magnetPoint')); }
    if (event.code === 'Space') { event.preventDefault(); if (videoPlayer.paused) videoPlayer.play(); else videoPlayer.pause(); }
    if (key === 'm') { event.preventDefault(); videoPlayer.muted = !videoPlayer.muted; }
    if (key === 'e') { event.preventDefault(); currentSpeed = Math.max(0.1, currentSpeed - 0.1); videoPlayer.playbackRate = currentSpeed; if(vSpeed) vSpeed.innerText = `Vel: ${currentSpeed.toFixed(1)}x`; }
    if (key === 'r') { event.preventDefault(); currentSpeed = Math.min(5.0, currentSpeed + 0.1); videoPlayer.playbackRate = currentSpeed; if(vSpeed) vSpeed.innerText = `Vel: ${currentSpeed.toFixed(1)}x`; }
    
    const forcePan = () => window.dispatchEvent(new Event('forceTimelinePan'));

    if (key === 'q') { event.preventDefault(); videoPlayer.pause(); videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - stepTime); forcePan(); if (typeof window.drawTimeline === 'function') window.drawTimeline(); }
    if (key === 'w') { event.preventDefault(); videoPlayer.pause(); videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + stepTime); forcePan(); if (typeof window.drawTimeline === 'function') window.drawTimeline(); }
    
    if (key === 'a') { event.preventDefault(); videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5); forcePan(); }
    if (key === 's') { event.preventDefault(); videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + 5); forcePan(); }

    if (key === 'b') {
        event.preventDefault();
        if (window.funscriptActions && window.funscriptActions.length > 0) {
            const currentTimeMs = videoPlayer.currentTime * 1000;
            const prevPoints = window.funscriptActions.filter(act => act.at < currentTimeMs - 15);
            if (prevPoints.length > 0) {
                const target = prevPoints[prevPoints.length - 1];
                videoPlayer.currentTime = target.at / 1000;
                window.funscriptActions.forEach(a => a.selected = false);
                target.selected = true; syncSlider(); forcePan();
            }
        }
    }
    if (key === 'n') {
        event.preventDefault();
        if (window.funscriptActions && window.funscriptActions.length > 0) {
            const currentTimeMs = videoPlayer.currentTime * 1000;
            const nextPoints = window.funscriptActions.filter(act => act.at > currentTimeMs + 15);
            if (nextPoints.length > 0) {
                const target = nextPoints[0];
                videoPlayer.currentTime = target.at / 1000;
                window.funscriptActions.forEach(a => a.selected = false);
                target.selected = true; syncSlider(); forcePan();
            }
        }
    }
}, true);

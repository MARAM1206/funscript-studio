// ==========================================================================
// REPRODUCTOR Y MOTOR DE ATAJOS V20.0 (WAVEFORM RED Y N-RETURN)
// ==========================================================================

const videoInput = document.getElementById('video-input');
const videoPlayer = document.getElementById('video-player');
const videoProgress = document.getElementById('video-progress');

window.videoPlayer = videoPlayer;
window.currentVideoName = null; 
window.audioPeaks = null; 

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
    if (file) loadVideoFile(file, false);
});

async function loadVideoFile(file, hasFunscripts = false) {
    const videoURL = URL.createObjectURL(file);
    videoPlayer.src = videoURL;
    videoPlayer.load();
    videoPlayer.playbackRate = currentSpeed;
    window.currentVideoName = file.name;
    if (vName) vName.innerText = `📄 ${file.name}`;
    if (typeof window.updateFileManagerUI === 'function') window.updateFileManagerUI();

    if (!hasFunscripts && window.loadedFunscriptTracks && window.loadedFunscriptTracks.length === 0) {
        const baseName = file.name.replace(/\.[^/.]+$/, ""); 
        if (typeof window.createEmptyTrack === 'function') {
            window.createEmptyTrack(baseName);
        }
    }

    if (vMute) { vMute.innerText = "⏳ Audio..."; vMute.style.color = "#f59e0b"; }
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 }); 
        const audioData = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioData.getChannelData(0); 
        
        const samplesPerSec = 100; 
        const step = Math.floor(audioData.sampleRate / samplesPerSec);
        const peaks = new Float32Array(Math.floor(channelData.length / step));
        
        for(let i = 0; i < peaks.length; i++) {
            let max = 0;
            for(let j = 0; j < step; j++) {
                let val = Math.abs(channelData[i*step + j]);
                if(val > max) max = val;
            }
            peaks[i] = max;
        }
        window.audioPeaks = peaks;
        window.audioPeaksSampleRate = samplesPerSec;
        
        if (vMute) { vMute.innerText = videoPlayer.muted ? "🔇 Sonido Off" : "🔊 Sonido On"; vMute.style.color = videoPlayer.muted ? "#ef4444" : "#38bdf8"; }
        if (typeof window.drawTimeline === 'function') window.drawTimeline();

    } catch (err) {
        if (vMute) { vMute.innerText = "🔇 Sin Pista"; vMute.style.color = "#94a3b8"; }
    }
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
    if (vRes) vRes.innerText = `${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`;
    if (vFps) vFps.innerText = `~30 fps`; 
    if (vTimeTotal) vTimeTotal.innerText = formatTime(videoPlayer.duration);
    if (vTimeCurrent) vTimeCurrent.innerText = formatTime(videoPlayer.currentTime);
    
    if (typeof window.updateHeatmapAndStats === 'function') window.updateHeatmapAndStats();
    if (typeof window.calculateAdaptiveZoom === 'function') window.calculateAdaptiveZoom();
});

videoPlayer?.addEventListener('volumechange', () => {
    if (vMute) {
        vMute.innerText = videoPlayer.muted || videoPlayer.volume === 0 ? "🔇 Sonido Off" : "🔊 Sonido On";
        vMute.style.color = videoPlayer.muted || videoPlayer.volume === 0 ? "#ef4444" : "#38bdf8";
    }
    // 🛡️ RE-DIBUJAR PARA CAMBIAR COLOR DE LA ONDA A ROJO
    if (typeof window.drawTimeline === 'function') window.drawTimeline();
});

const dragOverlay = document.getElementById('drag-drop-overlay');
let dragCounter = 0;

window.addEventListener('dragenter', (e) => { 
    if (window.isDraggingPreset) return; 
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

    const hasFunscripts = funscriptFiles.length > 0;
    if (videoFiles.length > 0) loadVideoFile(videoFiles[0], hasFunscripts);
    if (hasFunscripts && typeof window.loadFunscriptFiles === 'function') window.loadFunscriptFiles(funscriptFiles);
});

window.addEventListener('keydown', (event) => {
    if ((event.target.tagName === 'INPUT' && event.target.type === 'text') || event.target.tagName === 'TEXTAREA') return;

    const key = event.key.toLowerCase();
    const fps = window.videoFPS;
    const stepTime = 3 / fps; 
    const syncSlider = () => { if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection(); };
    const hasSelection = window.funscriptActions && window.funscriptActions.some(a => a.selected);
    const isPlaying = !videoPlayer.paused;

    if (event.ctrlKey) {
        if (key === 'z') { event.preventDefault(); window.dispatchEvent(new Event('undoAction')); return; }
        if (key === 'y') { event.preventDefault(); window.dispatchEvent(new Event('redoAction')); return; }
        if (key === 'a') { event.preventDefault(); window.dispatchEvent(new Event('selectAllPoints')); return; }
        
        if (key === 'arrowup' || key === 'arrowdown') {
            event.preventDefault(); event.stopPropagation();
            const dir = (key === 'arrowup') ? 'up' : 'down';
            window.dispatchEvent(new CustomEvent('nudgePoints', { detail: dir }));
        }
        return; 
    }

    if (key === 'delete' || key === 'backspace') {
        event.preventDefault(); window.dispatchEvent(new Event('deletePoints')); return;
    }

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

    if (key === 'c' && hasSelection) { event.preventDefault(); window.dispatchEvent(new CustomEvent('magnetPoint')); }
    if (event.code === 'Space') { event.preventDefault(); if (videoPlayer.paused) videoPlayer.play(); else videoPlayer.pause(); }
    if (key === 'm' && !event.ctrlKey) { event.preventDefault(); videoPlayer.muted = !videoPlayer.muted; }
    if (key === 'e' && !event.ctrlKey) { event.preventDefault(); currentSpeed = Math.max(0.1, currentSpeed - 0.1); videoPlayer.playbackRate = currentSpeed; if(vSpeed) vSpeed.innerText = `⚡ Vel: ${currentSpeed.toFixed(1)}x`; }
    if (key === 'r' && !event.ctrlKey) { event.preventDefault(); currentSpeed = Math.min(5.0, currentSpeed + 0.1); videoPlayer.playbackRate = currentSpeed; if(vSpeed) vSpeed.innerText = `⚡ Vel: ${currentSpeed.toFixed(1)}x`; }
    
    const forcePan = () => window.dispatchEvent(new Event('forceTimelinePan'));

    if (key === 'q' && !event.ctrlKey) { event.preventDefault(); videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - stepTime); forcePan(); if (typeof window.drawTimeline === 'function') window.drawTimeline(); }
    if (key === 'w' && !event.ctrlKey) { event.preventDefault(); videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + stepTime); forcePan(); if (typeof window.drawTimeline === 'function') window.drawTimeline(); }
    
    if (key === 'a' && !event.ctrlKey) { event.preventDefault(); videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5); forcePan(); }
    if (key === 's' && !event.ctrlKey) { event.preventDefault(); videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + 5); forcePan(); }

    if (key === 'b' && !event.ctrlKey) {
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
    if (key === 'n' && !event.ctrlKey) {
        event.preventDefault();
        if (window.funscriptActions && window.funscriptActions.length > 0) {
            const currentTimeMs = videoPlayer.currentTime * 1000;
            const nextPoints = window.funscriptActions.filter(act => act.at > currentTimeMs + 15);
            if (nextPoints.length > 0) {
                const target = nextPoints[0];
                videoPlayer.currentTime = target.at / 1000;
                window.funscriptActions.forEach(a => a.selected = false);
                target.selected = true; syncSlider(); forcePan();
            } else {
                // 🛡️ REGLA: Si no hay puntos adelante, saltar al ÚLTIMO punto.
                const lastTarget = window.funscriptActions[window.funscriptActions.length - 1];
                if (currentTimeMs >= lastTarget.at + 15) {
                    videoPlayer.currentTime = lastTarget.at / 1000;
                    window.funscriptActions.forEach(a => a.selected = false);
                    lastTarget.selected = true; syncSlider(); forcePan();
                }
            }
        }
    }
}, true);

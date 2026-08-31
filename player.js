// ==========================================================================
// REPRODUCTOR Y MOTOR DE ATAJOS V1.1.2 (PÁNICO SÓLIDO, TEMA VIVO)
// ==========================================================================

const videoPlayer = document.getElementById('video-player');
const videoProgress = document.getElementById('video-progress');
const universalInput = document.getElementById('universal-file-input');

window.videoPlayer = videoPlayer;
window.currentVideoName = null; 
window.audioPeaks = null; 
window.clipboardFunscript = null; 
window.isPastingMode = false; 

window.isAdaptiveModeActive = false;
window.fsTimelineVisible = true; 

const vName = document.getElementById('v-name');
const vRes = document.getElementById('v-res');
const vFps = document.getElementById('v-fps');
const vSpeed = document.getElementById('v-speed');
const vMute = document.getElementById('v-mute');
const vTimeCurrent = document.getElementById('v-time-current');
const vTimeTotal = document.getElementById('v-time-total');

// 🎯 FIX 1: TEMA OSCURO REPARADO. 
// Usamos un Observador que espera a que la animación de workspace.js cambie la clase, y entonces guarda el dato.
if (localStorage.getItem('funscript_theme') === 'light') {
    document.body.classList.add('light-theme');
    const tBtn = document.getElementById('menu-theme-btn');
    if(tBtn) tBtn.innerText = '🌙 Modo oscuro';
}

const themeObserver = new MutationObserver(() => {
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('funscript_theme', isLight ? 'light' : 'dark');
    const tBtn = document.getElementById('menu-theme-btn');
    if(tBtn) tBtn.innerText = isLight ? '🌙 Modo oscuro' : '☀️ Modo claro';
});
themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

// 🎯 FIX 2: PÁNICO INTELIGENTE
let isPanicMode = false;
const panicOverlay = document.getElementById('panic-overlay');
let preloadedPanicUrl = "";
const fakeAudio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3');
fakeAudio.loop = true;
let wasMutedBeforePanic = false;

function preloadPanicImage() {
    const randomId = Math.floor(Math.random() * 100000);
    preloadedPanicUrl = `https://picsum.photos/1280/720?random=${randomId}`;
    const img = new Image();
    img.onload = () => { preloadedPanicUrl = img.src; };
    img.onerror = () => { preloadedPanicUrl = ""; }; 
    img.src = preloadedPanicUrl; 
}
preloadPanicImage(); 

const controlsModal = document.getElementById('controls-modal');
document.getElementById('menu-controls-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (controlsModal) controlsModal.style.display = 'flex';
});
document.getElementById('close-controls-btn')?.addEventListener('click', () => {
    if (controlsModal) controlsModal.style.display = 'none';
});

const videoVolume = document.getElementById('video-volume');
const volumeTooltip = document.getElementById('volume-tooltip');

let currentSpeed = 1.0; 
window.videoFPS = 30; 

function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

window.checkEmptyState = function() {
    const emptyState = document.getElementById('video-empty-state');
    if (emptyState) {
        if (window.currentVideoName || (window.loadedFunscriptTracks && window.loadedFunscriptTracks.length > 0)) {
            emptyState.style.display = 'none';
        } else {
            emptyState.style.display = 'block';
        }
    }
};

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'add-file-btn') {
        universalInput?.click();
    }
});

document.getElementById('v-mute-container')?.addEventListener('click', () => {
    if(videoPlayer) {
        videoPlayer.muted = !videoPlayer.muted;
    }
});

videoPlayer?.addEventListener('click', () => {
    if (videoPlayer.paused) videoPlayer.play();
    else videoPlayer.pause();
});

function parseSRTtoVTT(srtText) {
    return "WEBVTT\n\n" + srtText.replace(/\r\n|\r|\n/g, '\n').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

universalInput?.addEventListener('change', function(event) {
    const files = Array.from(event.target.files);
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    const funscriptFiles = files.filter(f => f.name.toLowerCase().endsWith('.funscript') || f.name.toLowerCase().endsWith('.json'));

    const hasFunscripts = funscriptFiles.length > 0;
    if (videoFiles.length > 0) loadVideoFile(videoFiles[0], hasFunscripts);
    if (hasFunscripts && typeof window.loadFunscriptFiles === 'function') window.loadFunscriptFiles(funscriptFiles);
    
    event.target.value = '';
    window.checkEmptyState();
});

window.addEventListener('drop', (e) => {
    if (window.isDraggingPreset) return; 
    if (!e.dataTransfer.types.includes('Files')) return; 
    e.preventDefault(); 
    
    const files = Array.from(e.dataTransfer.files);
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    const funscriptFiles = files.filter(f => f.name.toLowerCase().endsWith('.funscript') || f.name.toLowerCase().endsWith('.json'));

    const hasFunscripts = funscriptFiles.length > 0;
    if (videoFiles.length > 0) loadVideoFile(videoFiles[0], hasFunscripts);
    if (hasFunscripts && typeof window.loadFunscriptFiles === 'function') window.loadFunscriptFiles(funscriptFiles);
});

window.addEventListener('dragover', (e) => { 
    if (window.isDraggingPreset) return; 
    if (!e.dataTransfer.types.includes('Files')) return; 
    e.preventDefault(); 
});

async function loadVideoFile(file, hasFunscripts = false) {
    const videoURL = URL.createObjectURL(file);
    videoPlayer.src = videoURL;
    videoPlayer.load();
    videoPlayer.playbackRate = currentSpeed;
    if (videoVolume) videoPlayer.volume = videoVolume.value;
    window.currentVideoName = file.name;
    
    if (vName) {
        let displayName = file.name;
        if (displayName.length > 60) displayName = displayName.substring(0, 57) + "..."; 
        vName.innerText = `📄 ${displayName}`;
        vName.title = file.name; 
    }
    
    if (typeof window.updateFileManagerUI === 'function') window.updateFileManagerUI();
    window.checkEmptyState();

    updateVolumeUI(videoPlayer.volume);
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 }); 
        const audioData = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioData.getChannelData(0); 
        
        const samplesPerSec = 100; 
        const step = Math.floor(audioData.sampleRate / samplesPerSec);
        const peaks = new Float32Array(Math.floor(channelData.length / step));
        
        let absoluteMaxPeak = 0;

        for(let i = 0; i < peaks.length; i++) {
            let max = 0;
            for(let j = 0; j < step; j++) {
                let val = Math.abs(channelData[i*step + j]);
                if(val > max) max = val;
            }
            peaks[i] = max;
            if (max > absoluteMaxPeak) absoluteMaxPeak = max;
        }
        
        window.audioPeaks = peaks;
        window.audioPeaksSampleRate = samplesPerSec;
        window.audioMaxPeak = absoluteMaxPeak > 0 ? absoluteMaxPeak : 1.0; 
        
        updateVolumeUI(videoPlayer.muted ? 0 : videoPlayer.volume);
        if (typeof window.drawTimeline === 'function') window.drawTimeline();

    } catch (err) {}
}

const fsMiniBtn = document.getElementById('fs-mini-btn');
const videoContainer = document.getElementById('video-container-wrapper');

fsMiniBtn?.addEventListener('click', () => {
    if (!document.fullscreenElement) videoContainer.requestFullscreen().catch(err => console.error(err));
});

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
    if (isPanicMode) {
        fakeAudio.play();
    }
    window.dispatchEvent(new Event('videoPlay'));
    if (typeof window.playHandy === 'function') window.playHandy(videoPlayer.currentTime * 1000);
});

videoPlayer?.addEventListener('pause', () => {
    fakeAudio.pause();
    if (typeof window.stopHandy === 'function') window.stopHandy();
});

videoPlayer?.addEventListener('seeked', () => {
    if (!videoPlayer.paused && typeof window.playHandy === 'function') window.playHandy(videoPlayer.currentTime * 1000);
});

videoPlayer?.addEventListener('loadedmetadata', () => {
    window.videoFPS = 30; 
    if (vRes) vRes.innerText = `${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`;
    if (vFps) vFps.innerText = `🎞️ ${window.videoFPS} fps`; 
    if (vTimeTotal) vTimeTotal.innerText = formatTime(videoPlayer.duration);
    if (vTimeCurrent) vTimeCurrent.innerText = formatTime(videoPlayer.currentTime);
    if (typeof window.updateHeatmapAndStats === 'function') window.updateHeatmapAndStats();
    if (typeof window.calculateAdaptiveZoom === 'function') window.calculateAdaptiveZoom();
    
    const fpsInput = document.getElementById('fps-jump-input');
    if (fpsInput) {
        let val = parseInt(fpsInput.value, 10);
        if (val > window.videoFPS) fpsInput.value = window.videoFPS;
    }
});

// 🎯 FIX 3: Sistema de Volumen de Pánico
function updateVolumeUI(vol) {
    let volPercent = Math.round(vol * 100);
    
    if (volumeTooltip && videoVolume) {
        volumeTooltip.innerText = volPercent + '%';
        volumeTooltip.style.opacity = '1';
        
        const sliderWidth = videoVolume.offsetWidth || 70;
        const thumbWidth = 10;
        const usableWidth = sliderWidth - thumbWidth;
        const sliderLeft = videoVolume.offsetLeft;
        const posPx = sliderLeft + (vol * usableWidth) + (thumbWidth / 2);
        
        volumeTooltip.style.left = `${posPx}px`;

        clearTimeout(window.volTooltipTimeout);
        window.volTooltipTimeout = setTimeout(() => {
            volumeTooltip.style.opacity = '0';
        }, 1000);
    }

    if (vMute) {
        let isMuted = isPanicMode ? fakeAudio.muted : videoPlayer?.muted;
        if (vol === 0 || isMuted) vMute.innerText = "🔇";
        else if (vol < 0.3) vMute.innerText = "🔈";
        else if (vol < 0.7) vMute.innerText = "🔉";
        else vMute.innerText = "🔊";
    }
    
    const vMuteContainer = document.getElementById('v-mute-container');
    if (vMuteContainer) {
        let isMuted = isPanicMode ? fakeAudio.muted : videoPlayer?.muted;
        if (vol === 0 || isMuted) vMuteContainer.classList.add('mute-flash');
        else vMuteContainer.classList.remove('mute-flash');
    }
}

videoVolume?.addEventListener('input', (e) => {
    let vol = parseFloat(e.target.value);
    if (isPanicMode) {
        fakeAudio.volume = vol;
        fakeAudio.muted = (vol === 0);
    } else {
        if(videoPlayer) {
            videoPlayer.volume = vol;
            videoPlayer.muted = (vol === 0);
        }
    }
    updateVolumeUI(vol);
});

videoPlayer?.addEventListener('volumechange', () => {
    if (isPanicMode) return; // Si estamos en pánico, el video de atrás no controla la UI
    let vol = videoPlayer.muted ? 0 : videoPlayer.volume;
    if (videoVolume) videoVolume.value = vol;
    updateVolumeUI(vol);
});

// 🎯 FIX 4: El Camuflaje de Textos definitivo (Destrucción y Reconstrucción)
function togglePanicCamouflage(enable) {
    if (enable) {
        document.querySelectorAll('.file-manager-video').forEach(el => {
            el.dataset.realHtml = el.innerHTML;
            el.innerHTML = `🎬 Cam_03_final.mp4`;
            el.style.color = '#38bdf8'; 
        });
        document.querySelectorAll('.file-manager-script').forEach((el, i) => {
            el.dataset.realHtml = el.innerHTML;
            el.innerHTML = `💬 Audio_Sync_Trk_${i+1}.wav`;
            el.style.color = '#10b981'; 
        });
        document.querySelectorAll('.preset-card-title').forEach((el, i) => {
            const fakes = ["Vocal Compressor", "De-Esser Base", "EQ Parametric", "Reverb Hall", "Limiter Pro"];
            el.dataset.orig = el.innerText; el.innerText = fakes[i % fakes.length];
        });
        if (vName) { vName.dataset.orig = vName.innerText; vName.innerText = "📄 Cam_03_final.mp4"; }
    } else {
        document.querySelectorAll('.file-manager-video, .file-manager-script').forEach(el => {
            if (el.dataset.realHtml) {
                el.innerHTML = el.dataset.realHtml;
                el.style.color = '';
            }
        });
        document.querySelectorAll('.preset-card-title, #v-name').forEach(el => {
            if (el.dataset.orig) el.innerText = el.dataset.orig;
        });
    }
}

window.addEventListener('keydown', (event) => {
    if ((event.target.tagName === 'INPUT' && event.target.type === 'text') || event.target.tagName === 'TEXTAREA' || event.target.type === 'number') return;

    if (event.key === 'Escape' || event.key === 'Esc') {
        
        if (controlsModal && controlsModal.style.display === 'flex') {
            controlsModal.style.display = 'none';
            return;
        }

        if (window.isPastingMode || window.isDraggingPreset) {
            window.isPastingMode = false;
            window.isDraggingPreset = false;
            window.timelineGhostPreset = null;
            window.timelineGhostTimeMs = null;
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
            return;
        }

        if (document.fullscreenElement) {
            document.exitFullscreen();
            return;
        }

        isPanicMode = !isPanicMode;
        if (isPanicMode) {
            wasMutedBeforePanic = videoPlayer ? videoPlayer.muted : false;
            let currentVol = videoVolume ? parseFloat(videoVolume.value) : 1;
            
            if (videoPlayer) videoPlayer.muted = true; // Callamos lo indebido
            
            // Pasamos el mando al audio ambiental
            fakeAudio.volume = currentVol;
            fakeAudio.muted = (currentVol === 0);
            updateVolumeUI(currentVol); 
            
            if (videoPlayer && !videoPlayer.paused) fakeAudio.play();
            
            if (panicOverlay) {
                panicOverlay.innerHTML = `
                    <img src="${preloadedPanicUrl}" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; z-index:1;" onerror="this.style.display='none'" />
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: rgba(148, 163, 184, 0.2); font-family: monospace; font-size: 2rem; font-weight: bold; pointer-events: none; user-select: none; text-align: center; z-index: 0;">
                        PREVIEW OFFLINE<br><span style="font-size:1rem; opacity:0.5;">No network connection for media streaming</span>
                    </div>
                `;
                panicOverlay.style.display = 'block';
            }
            document.body.classList.add('panic-mode-active');
            
            const expBtn = document.getElementById('export-btn');
            if (expBtn) expBtn.innerText = "💾 Exportar";

            togglePanicCamouflage(true);
            
            if (typeof window.drawTimeline === 'function') window.drawTimeline(); 
            
        } else {
            fakeAudio.pause();
            if (videoPlayer) videoPlayer.muted = wasMutedBeforePanic;
            
            let realVol = videoPlayer ? (videoPlayer.muted ? 0 : videoPlayer.volume) : 1;
            if (videoVolume) videoVolume.value = realVol;
            updateVolumeUI(realVol);

            if (panicOverlay) panicOverlay.style.display = 'none';
            document.body.classList.remove('panic-mode-active');
            
            const expBtn = document.getElementById('export-btn');
            if (expBtn) expBtn.innerText = "💾 Exportar FunScript";
            
            togglePanicCamouflage(false);

            preloadPanicImage(); 
            if (typeof window.drawTimeline === 'function') window.drawTimeline(); 
        }
        return;
    }

    if (isPanicMode && event.code !== 'Space') {
        return; 
    }

    if (document.fullscreenElement && event.key.toLowerCase() === 'h') {
        window.fsTimelineVisible = !window.fsTimelineVisible;
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
        return;
    }

    if (event.code === 'Space') {
        if (document.activeElement && (document.activeElement.tagName === 'BUTTON' || document.activeElement.type === 'range')) {
            document.activeElement.blur(); 
        }
        if (!window.isDraggingPreset && !window.isPastingMode) {
            event.preventDefault();
            if (videoPlayer.paused) videoPlayer.play(); else videoPlayer.pause();
            return;
        }
    }

    const key = event.key.toLowerCase();
    const hasSelection = window.funscriptActions && window.funscriptActions.some(a => a.selected);
    const isPlaying = !videoPlayer.paused;

    if (key === 's' && event.ctrlKey) {
        event.preventDefault();
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) exportBtn.click();
        return;
    }

    if (key === 'f' && !event.ctrlKey) {
        event.preventDefault();
        if (!document.fullscreenElement) videoContainer.requestFullscreen().catch(err => console.error(err));
        else document.exitFullscreen();
        return;
    }

    if (key === 'p' && !event.ctrlKey) {
        event.preventDefault(); 
        window.isAdaptiveModeActive = !window.isAdaptiveModeActive; 
        if (typeof window.syncAdaptiveButtons === 'function') window.syncAdaptiveButtons(window.isAdaptiveModeActive);
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
        if (typeof window.drawModalCanvas === 'function') window.drawModalCanvas();
        return;
    }

    if (event.ctrlKey) {
        if (key === 'z') { event.preventDefault(); window.dispatchEvent(new Event('undoAction')); return; }
        if (key === 'y') { event.preventDefault(); window.dispatchEvent(new Event('redoAction')); return; }
        if (key === 'a') { event.preventDefault(); window.dispatchEvent(new Event('selectAllPoints')); return; }
        if (key === 'c') { event.preventDefault(); window.dispatchEvent(new Event('copyPoints')); return; }
        if (key === 'v') { event.preventDefault(); window.dispatchEvent(new Event('pastePoints')); return; }
        if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
            event.preventDefault(); event.stopPropagation();
            window.dispatchEvent(new CustomEvent('nudgePoints', { detail: key.replace('arrow','') }));
        }
        return; 
    }

    if (key === 'delete' || key === 'backspace') {
        event.preventDefault(); window.dispatchEvent(new Event('deletePoints')); return;
    }

    if (key === 'arrowup' || key === 'arrowdown') {
        event.preventDefault(); event.stopPropagation();
        if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur(); 
        const dir = (key === 'arrowup') ? 'up' : 'down';
        window.dispatchEvent(new CustomEvent('injectPoint', { detail: { dir: dir } }));
        return; 
    }

    if (key === 'c' && hasSelection) { event.preventDefault(); window.dispatchEvent(new CustomEvent('magnetPoint')); }
    
    if (key === 'm' && !event.ctrlKey) { 
        event.preventDefault(); 
        if(videoPlayer) videoPlayer.muted = !videoPlayer.muted; 
    }
    if (key === 'e' && !event.ctrlKey) { event.preventDefault(); currentSpeed = Math.max(0.1, currentSpeed - 0.1); videoPlayer.playbackRate = currentSpeed; if(vSpeed) vSpeed.innerText = `⚡ Vel: ${currentSpeed.toFixed(1)}x`; }
    if (key === 'r' && !event.ctrlKey) { event.preventDefault(); currentSpeed = Math.min(5.0, currentSpeed + 0.1); videoPlayer.playbackRate = currentSpeed; if(vSpeed) vSpeed.innerText = `⚡ Vel: ${currentSpeed.toFixed(1)}x`; }
    
    const forcePan = (exactTimeMs) => {
        if (exactTimeMs !== undefined) window.dispatchEvent(new CustomEvent('forceTimelinePan', { detail: { timeMs: exactTimeMs } }));
        else window.dispatchEvent(new Event('forceTimelinePan'));
    };

    const fpsInput = document.getElementById('fps-jump-input');
    const framesToJump = fpsInput ? (parseInt(fpsInput.value, 10) || 1) : 1;
    const msPerFrame = 1000 / window.videoFPS;
    const stepTimePrecision = (framesToJump * msPerFrame) / 1000; 

    if (key === 'q' && !event.ctrlKey) { 
        event.preventDefault(); 
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - stepTimePrecision); 
        forcePan(); 
    }
    if (key === 'w' && !event.ctrlKey) { 
        event.preventDefault(); 
        videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + stepTimePrecision); 
        forcePan(); 
    }
    
    if (key === 'a' && !event.ctrlKey) { event.preventDefault(); videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5); forcePan(); }
    if (key === 's' && !event.ctrlKey) { event.preventDefault(); videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + 5); forcePan(); }

    const syncSlider = () => { if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection(); };

    if (key === 'b' && !event.ctrlKey) {
        event.preventDefault();
        if (window.funscriptActions && window.funscriptActions.length > 0) {
            const currentTimeMs = videoPlayer.currentTime * 1000;
            const prevPoints = window.funscriptActions.filter(act => act.at < currentTimeMs - 15);
            if (prevPoints.length > 0) {
                const target = prevPoints[prevPoints.length - 1];
                videoPlayer.currentTime = target.at / 1000;
                window.funscriptActions.forEach(a => a.selected = false);
                target.selected = true; syncSlider(); forcePan(target.at);
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
                target.selected = true; syncSlider(); forcePan(target.at);
            } else {
                const lastTarget = window.funscriptActions[window.funscriptActions.length - 1];
                if (currentTimeMs >= lastTarget.at + 15) {
                    videoPlayer.currentTime = lastTarget.at / 1000;
                    window.funscriptActions.forEach(a => a.selected = false);
                    lastTarget.selected = true; syncSlider(); forcePan(lastTarget.at);
                }
            }
        }
    }
}, true);

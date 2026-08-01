// ==========================================================================
// REPRODUCTOR Y MOTOR DE ATAJOS (COMUNICACIÓN SEGURA POR EVENTOS)
// ==========================================================================

const videoInput = document.getElementById('video-input');
const videoPlayer = document.getElementById('video-player');
const videoProgress = document.getElementById('video-progress');

window.videoPlayer = videoPlayer;

const vName = document.getElementById('v-name');
const vRes = document.getElementById('v-res');
const vFps = document.getElementById('v-fps');
const vSpeed = document.getElementById('v-speed');
const vMute = document.getElementById('v-mute');

let currentSpeed = 1.0; 
window.videoFPS = 30; 

videoInput?.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) loadVideoFile(file);
});

function loadVideoFile(file) {
    const videoURL = URL.createObjectURL(file);
    videoPlayer.src = videoURL;
    videoPlayer.load();
    videoPlayer.playbackRate = currentSpeed;
    if (vName) vName.innerText = `📄 ${file.name}`;
}

let isSeeking = false;
videoProgress?.addEventListener('mousedown', () => isSeeking = true);
videoProgress?.addEventListener('mouseup', () => isSeeking = false);

videoProgress?.addEventListener('input', () => {
    if (videoPlayer.duration) {
        const targetTime = (videoProgress.value / 100) * videoPlayer.duration;
        videoPlayer.currentTime = targetTime;
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
    }
});

videoPlayer?.addEventListener('timeupdate', () => {
    if (!isSeeking && videoPlayer.duration && videoProgress) {
        videoProgress.value = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    }
});

videoPlayer?.addEventListener('loadedmetadata', () => {
    if (vRes) vRes.innerText = `📏 ${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`;
    if (vFps) vFps.innerText = `⏱️ ~30 fps`; 
    if (typeof window.calculateAdaptiveZoom === 'function') window.calculateAdaptiveZoom();
});

videoPlayer?.addEventListener('volumechange', () => {
    if (vMute) {
        vMute.innerText = videoPlayer.muted || videoPlayer.volume === 0 ? "🔇 Muteado" : "🔊 Sonido On";
        vMute.style.color = videoPlayer.muted || videoPlayer.volume === 0 ? "#ef4444" : "#38bdf8";
    }
});

const dragOverlay = document.getElementById('drag-drop-overlay');
let dragCounter = 0;

window.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; dragOverlay?.classList.add('active'); });
window.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter === 0) dragOverlay?.classList.remove('active'); });
window.addEventListener('dragover', (e) => { e.preventDefault(); });

window.addEventListener('drop', (e) => {
    e.preventDefault(); dragCounter = 0; dragOverlay?.classList.remove('active');
    const files = Array.from(e.dataTransfer.files);
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    const funscriptFiles = files.filter(f => f.name.toLowerCase().endsWith('.funscript') || f.name.toLowerCase().endsWith('.json'));

    if (videoFiles.length > 0) loadVideoFile(videoFiles[0]);
    if (funscriptFiles.length > 0 && typeof window.loadFunscriptFiles === 'function') window.loadFunscriptFiles(funscriptFiles);
});

// ATAJOS DE TECLADO
window.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    if (event.ctrlKey) return; 

    const key = event.key.toLowerCase();
    const fps = window.videoFPS;
    const stepTime = 3 / fps; 
    const syncSlider = () => { if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection(); };

    // 🛡️ NUEVO: DISPARADOR DESACOPLADO (Imposible que cause error "is not a function")
    if (key === 'arrowup') {
        event.preventDefault();
        const maxVal = document.getElementById('max-slider')?.value || 100;
        window.dispatchEvent(new CustomEvent('injectPoint', { detail: maxVal }));
    }
    if (key === 'arrowdown') {
        event.preventDefault();
        const minVal = document.getElementById('min-slider')?.value || 0;
        window.dispatchEvent(new CustomEvent('injectPoint', { detail: minVal }));
    }

    if (event.code === 'Space') {
        event.preventDefault();
        if (videoPlayer.paused) videoPlayer.play(); else videoPlayer.pause();
    }
    if (key === 'm') { event.preventDefault(); videoPlayer.muted = !videoPlayer.muted; }

    if (key === 'e') {
        event.preventDefault(); currentSpeed = Math.max(0.1, currentSpeed - 0.1);
        videoPlayer.playbackRate = currentSpeed; if(vSpeed) vSpeed.innerText = `Vel: ${currentSpeed.toFixed(1)}x`;
    }
    if (key === 'r') {
        event.preventDefault(); currentSpeed = Math.min(5.0, currentSpeed + 0.1);
        videoPlayer.playbackRate = currentSpeed; if(vSpeed) vSpeed.innerText = `Vel: ${currentSpeed.toFixed(1)}x`;
    }
    
    if (key === 'q') { event.preventDefault(); videoPlayer.pause(); videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - stepTime); }
    if (key === 'w') { event.preventDefault(); videoPlayer.pause(); videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + stepTime); }
    if (key === 'a') { event.preventDefault(); videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5); }
    if (key === 's') { event.preventDefault(); videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + 5); }

    if (key === 'b') {
        event.preventDefault();
        if (window.funscriptActions && window.funscriptActions.length > 0) {
            const currentTimeMs = videoPlayer.currentTime * 1000;
            const prevPoints = window.funscriptActions.filter(act => act.at < currentTimeMs - 15);
            if (prevPoints.length > 0) {
                const target = prevPoints[prevPoints.length - 1];
                videoPlayer.currentTime = target.at / 1000;
                window.funscriptActions.forEach(a => a.selected = false);
                target.selected = true; syncSlider();
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
                target.selected = true; syncSlider();
            }
        }
    }
});

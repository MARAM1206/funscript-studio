// ==========================================================================
// CONTROL DEL REPRODUCTOR V1.9: CORRECCIÓN COMPLETA DE INTERCEPCIÓN CTRL
// ==========================================================================

const videoInput = document.getElementById('video-input');
const videoPlayer = document.getElementById('video-player');
const speedDisplay = document.getElementById('speed-display');
const videoFilename = document.getElementById('video-filename');
const videoSpecs = document.getElementById('video-specs');
const videoProgress = document.getElementById('video-progress');

let currentSpeed = 1.0; 
window.videoFPS = 30; 

videoInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const videoURL = URL.createObjectURL(file);
        videoPlayer.src = videoURL;
        videoPlayer.load();
        videoPlayer.playbackRate = currentSpeed;
        if (videoFilename) videoFilename.innerText = `📄 ${file.name}`;
        if (videoSpecs) videoSpecs.innerText = "Calculando...";
    }
});

videoPlayer.addEventListener('timeupdate', () => {
    if (videoPlayer.duration && videoProgress) {
        const percentage = (videoPlayer.currentTime / videoPlayer.duration) * 100;
        videoProgress.value = percentage;
    }
});

videoProgress?.addEventListener('input', () => {
    if (videoPlayer.duration) {
        const targetTime = (videoProgress.value / 100) * videoPlayer.duration;
        videoPlayer.currentTime = targetTime;
    }
});

videoPlayer.addEventListener('loadedmetadata', function() {
    const w = videoPlayer.videoWidth; const h = videoPlayer.videoHeight;
    let resLabel = `${h}p`;
    if (w >= 3840 || h >= 2160) resLabel = "4K";
    else if (w >= 1920 || h >= 1080) resLabel = "1080p";
    
    let frameTimes = [];
    function detectFPS(now, metadata) {
        if (frameTimes.length < 12) {
            frameTimes.push(metadata.mediaTime);
            videoPlayer.requestVideoFrameCallback(detectFPS);
        } else {
            let deltas = [];
            for (let i = 1; i < frameTimes.length; i++) deltas.push(frameTimes[i] - frameTimes[i - 1]);
            let avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
            let calculatedFps = Math.round(1 / avgDelta);
            if (calculatedFps > 28 && calculatedFps < 32) calculatedFps = 30;
            else if (calculatedFps > 58 && calculatedFps < 62) calculatedFps = 60;
            window.videoFPS = calculatedFps; 
            if (videoSpecs) videoSpecs.innerText = `${resLabel} @ ${calculatedFps} FPS`;
        }
    }
    if (videoPlayer.requestVideoFrameCallback) videoPlayer.requestVideoFrameCallback(detectFPS);
});

window.addEventListener('keydown', function(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;
    
    // FIJACIÓN DE SEGURIDAD CRÍTICA: Si se presiona Ctrl, el reproductor cede el control por completo
    if (event.ctrlKey) return; 

    const key = event.key.toLowerCase();

    if (event.code === 'Space') {
        event.preventDefault();
        if (videoPlayer.paused) videoPlayer.play(); else videoPlayer.pause();
    }
    if (key === 'e') {
        event.preventDefault(); currentSpeed = Math.max(0.1, currentSpeed - 0.1);
        videoPlayer.playbackRate = currentSpeed; speedDisplay.innerText = `${currentSpeed.toFixed(1)}x`;
    }
    if (key === 'r') {
        event.preventDefault(); currentSpeed = Math.min(5.0, currentSpeed + 0.1);
        videoPlayer.playbackRate = currentSpeed; speedDisplay.innerText = `${currentSpeed.toFixed(1)}x`;
    }
    
    const fps = window.videoFPS || 30;
    const stepTime = 3 / fps; 

    if (key === 'q') {
        event.preventDefault(); videoPlayer.pause();
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - stepTime);
    }
    if (key === 'w') {
        event.preventDefault(); videoPlayer.pause();
        videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + stepTime);
    }
    if (key === 'a') {
        event.preventDefault(); videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
    }
    if (key === 's') {
        event.preventDefault(); videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + 5);
    }
    if (key === 'm') { event.preventDefault(); videoPlayer.muted = !videoPlayer.muted; }
});

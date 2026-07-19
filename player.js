// ==========================================================================
// CONTROL DEL REPRODUCTOR (FOTOGRAMAS, VELOCIDAD, SALTOS Y MUTE)
// ==========================================================================

const videoInput = document.getElementById('video-input');
const videoPlayer = document.getElementById('video-player');
const speedDisplay = document.getElementById('speed-display');

let currentSpeed = 1.0; 

videoInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const videoURL = URL.createObjectURL(file);
        videoPlayer.src = videoURL;
        videoPlayer.load();
        videoPlayer.playbackRate = currentSpeed;
    }
});

window.addEventListener('keydown', function(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

    const key = event.key.toLowerCase();

    if (event.code === 'Space') {
        event.preventDefault();
        if (videoPlayer.paused) videoPlayer.play();
        else videoPlayer.pause();
    }

    if (key === 'e') {
        event.preventDefault();
        currentSpeed = Math.max(0.1, currentSpeed - 0.1);
        videoPlayer.playbackRate = currentSpeed;
        speedDisplay.innerText = `${currentSpeed.toFixed(1)}x`;
    }
    if (key === 'r') {
        event.preventDefault();
        currentSpeed = Math.min(5.0, currentSpeed + 0.1);
        videoPlayer.playbackRate = currentSpeed;
        speedDisplay.innerText = `${currentSpeed.toFixed(1)}x`;
    }

    const frameTime = 1 / 30;
    if (key === 'q') {
        event.preventDefault();
        videoPlayer.pause(); 
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - frameTime);
    }
    if (key === 'w') {
        event.preventDefault();
        videoPlayer.pause();
        videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + frameTime);
    }

    if (key === 'a') {
        event.preventDefault();
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
    }
    if (key === 's') {
        event.preventDefault();
        videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + 5);
    }

    // NUEVO ATRAJO: MUTE / UNMUTE (Tecla M)
    if (key === 'm') {
        event.preventDefault();
        videoPlayer.muted = !videoPlayer.muted;
    }
});

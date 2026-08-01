// ==========================================================================
// REPRODUCTOR Y MOTOR DE DRAG & DROP GLOBAL
// ==========================================================================

const videoInput = document.getElementById('video-input');
const videoPlayer = document.getElementById('video-player');

// Etiquetas de información flotante en el panel de video
const vName = document.getElementById('v-name');
const vRes = document.getElementById('v-res');
const vFps = document.getElementById('v-fps');
const vSpeed = document.getElementById('v-speed');
const vMute = document.getElementById('v-mute');

let currentSpeed = 1.0; 
window.videoFPS = 30; 

// 1. CARGA DE VIDEO TRADICIONAL (POR BOTÓN)
videoInput.addEventListener('change', function(event) {
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

// 2. ACTUALIZAR INFO CUANDO EL VIDEO CARGA SUS METADATOS
videoPlayer.addEventListener('loadedmetadata', () => {
    if (vRes) vRes.innerText = `📏 ${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`;
    // Asumimos 30 o 60 fps base, en web nativo no hay API para leer FPS exactos
    if (vFps) vFps.innerText = `⏱️ ~30 fps`; 
});

videoPlayer.addEventListener('volumechange', () => {
    if (vMute) {
        vMute.innerText = videoPlayer.muted || videoPlayer.volume === 0 ? "🔇 Muteado" : "🔊 Sonido On";
        vMute.style.color = videoPlayer.muted || videoPlayer.volume === 0 ? "#ef4444" : "#38bdf8";
    }
});

// 3. MOTOR GLOBAL DE DRAG AND DROP (ARRASTRAR Y SOLTAR)
const dragOverlay = document.getElementById('drag-drop-overlay');
let dragCounter = 0;

window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dragOverlay.classList.add('active');
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) dragOverlay.classList.remove('active');
});

window.addEventListener('dragover', (e) => { e.preventDefault(); });

window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragOverlay.classList.remove('active');

    const files = Array.from(e.dataTransfer.files);
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    const funscriptFiles = files.filter(f => f.name.toLowerCase().endsWith('.funscript') || f.name.toLowerCase().endsWith('.json'));

    // Si soltaron un video, cargamos el primero
    if (videoFiles.length > 0) {
        loadVideoFile(videoFiles[0]);
    }

    // Si soltaron FunScripts, los mandamos a funscript.js
    if (funscriptFiles.length > 0 && typeof window.loadFunscriptFiles === 'function') {
        window.loadFunscriptFiles(funscriptFiles);
    }
});

// 4. ATAJOS DE TECLADO GLOBALES DEL REPRODUCTOR
window.addEventListener('keydown', (event) => {
    // Evita interferir con atajos si el usuario escribe en un input
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    if (event.ctrlKey) return; 

    const key = event.key.toLowerCase();

    // Play / Pausa
    if (event.code === 'Space') {
        event.preventDefault();
        if (videoPlayer.paused) videoPlayer.play(); else videoPlayer.pause();
    }
    
    // Mutear / Desmutear (NUEVO)
    if (key === 'm') {
        event.preventDefault();
        videoPlayer.muted = !videoPlayer.muted;
    }

    // Velocidad
    if (key === 'e') {
        event.preventDefault(); currentSpeed = Math.max(0.1, currentSpeed - 0.1);
        videoPlayer.playbackRate = currentSpeed; if(vSpeed) vSpeed.innerText = `Vel: ${currentSpeed.toFixed(1)}x`;
    }
    if (key === 'r') {
        event.preventDefault(); currentSpeed = Math.min(5.0, currentSpeed + 0.1);
        videoPlayer.playbackRate = currentSpeed; if(vSpeed) vSpeed.innerText = `Vel: ${currentSpeed.toFixed(1)}x`;
    }
    
    // Navegación de tiempo
    const stepTime = 3 / window.videoFPS; 
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
});

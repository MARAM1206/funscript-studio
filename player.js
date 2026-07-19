// ==========================================================================
// CONTROL DEL REPRODUCTOR (FOTOGRAMAS Y VELOCIDAD POR TECLADO)
// ==========================================================================

const videoInput = document.getElementById('video-input');
const videoPlayer = document.getElementById('video-player');
const speedDisplay = document.getElementById('speed-display');

let currentSpeed = 1.0; // Cambiado a 1.0x de manera predeterminada

videoInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const videoURL = URL.createObjectURL(file);
        videoPlayer.src = videoURL;
        videoPlayer.load();
        videoPlayer.playbackRate = currentSpeed;
    }
});

/**
 * Gestiona los atajos de teclado para la reproducción, fotogramas y velocidad
 */
window.addEventListener('keydown', function(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

    const key = event.key.toLowerCase();

    // 1. BARRA ESPACIADORA: Play / Pausa
    if (event.code === 'Space') {
        event.preventDefault();
        if (videoPlayer.paused) videoPlayer.play();
        else videoPlayer.pause();
    }

    // 2. CONTROLES DE VELOCIDAD (E = Bajar, R = Subir) de 0.1 en 0.1
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

    // 3. MOVIMIENTO FOTOGRAMA A FOTOGRAMA (Q = Atrás, W = Adelante)
    // Asumimos un estándar de 30 FPS (1 fotograma ≈ 33.3 milisegundos)
    const frameTime = 1 / 30;
    if (key === 'q') {
        event.preventDefault();
        videoPlayer.pause(); // Pausamos para edición precisa
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - frameTime);
    }
    if (key === 'w') {
        event.preventDefault();
        videoPlayer.pause();
        videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + frameTime);
    }
});

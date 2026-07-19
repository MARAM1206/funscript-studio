// ==========================================================================
// CONTROL DEL REPRODUCTOR DE VIDEO LOCAL
// ==========================================================================

// Capturamos los elementos del HTML
const videoInput = document.getElementById('video-input');
const videoPlayer = document.getElementById('video-player');
const speedControl = document.getElementById('speed-control');

/**
 * Carga instantánea del video local desde el disco.
 * Usa una API del navegador para leer el archivo directamente de tu SSD
 * sin subir un solo byte a servidores externos.
 */
videoInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    
    if (file) {
        // Creamos una URL local en memoria que apunta directo a tu archivo
        const videoURL = URL.createObjectURL(file);
        
        // Asignamos el video al reproductor e iniciamos
        videoPlayer.src = videoURL;
        videoPlayer.load();
        
        // Forzamos a que mantenga la velocidad seleccionada al cargar un nuevo video
        adjustPlaybackSpeed();
        
        console.log("Video local cargado con éxito:", file.name);
    }
});

/**
 * Ajusta la velocidad del video según la opción del menú desplegable.
 */
function adjustPlaybackSpeed() {
    const speed = parseFloat(speedControl.value);
    videoPlayer.playbackRate = speed;
}

// Escuchamos cuando cambias la velocidad en el menú
speedControl.addEventListener('change', adjustPlaybackSpeed);

// Atajo global: Barra espaciadora para Play/Pausa
window.addEventListener('keydown', function(event) {
    // Si el usuario presiona la barra espaciadora y no está escribiendo en ningún input
    if (event.code === 'Space' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'SELECT') {
        event.preventDefault(); // Evitamos que la página salte hacia abajo
        
        if (videoPlayer.paused) {
            videoPlayer.play();
        } else {
            videoPlayer.pause();
        }
    }
});

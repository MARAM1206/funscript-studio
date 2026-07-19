// ==========================================================================
// SISTEMA DE PRESETS Y MACROS DE RITMO (MODULO INDEPENDIENTE)
// ==========================================================================

// Almacén de presets guardados en la memoria interna de la página
let savedPresets = {};

// Inyectamos dinámicamente los botones y la lista dentro del panel pre-diseñado
const presetsContent = document.querySelector('#panel-presets .panel-content');

if (presetsContent) {
    presetsContent.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <button id="btn-record-preset" class="btn" style="background-color: #8b5cf6; font-size: 0.9rem;">
                💾 Guardar Últimos 5s como Preset
            </button>
        </div>
        <div id="presets-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 150px; overflow-y: auto;">
            <span style="color: #475569; font-style: italic;">No hay presets guardados aún</span>
        </div>
    `;
}

// ==========================================================================
// CAPTURA Y NORMALIZACIÓN DEL RITMO
// ==========================================================================
document.getElementById('btn-record-preset')?.addEventListener('click', function() {
    if (!videoPlayer.src || funscriptActions.length === 0) {
        alert("Primero debes cargar un video y registrar algunos puntos para poder guardarlos.");
        return;
    }

    // Pedimos un nombre al usuario para organizar sus macros
    const presetName = prompt("Introduce un nombre para este patrón de ritmo:", `Ritmo Rápido ${Object.keys(savedPresets).length + 1}`);
    if (!presetName) return;

    // Obtenemos el punto de tiempo actual del video en milisegundos
    const currentTimeMs = videoPlayer.currentTime * 1000;
    // Definimos la ventana de captura (los últimos 5000 milisegundos de trabajo)
    const startTimeMs = Math.max(0, currentTimeMs - 5000);

    // Filtramos únicamente las acciones que creaste dentro de esa ventana de tiempo
    const actionsToSave = funscriptActions.filter(act => act.at >= startTimeMs && act.at <= currentTimeMs);

    if (actionsToSave.length === 0) {
        alert("No se encontraron puntos en los últimos 5 segundos de la línea de tiempo. Avanza el video y marca un ritmo antes de guardar.");
        return;
    }

    // MATEMÁTICAS DE RELATIVIDAD: Restamos el tiempo del primer punto para que el preset 
    // comience internamente en el milisegundo 0, permitiendo estamparlo en cualquier otro lado.
    const baseTime = actionsToSave[0].at;
    const normalizedActions = actionsToSave.map(act => ({
        at: act.at - baseTime,
        pos: act.pos
    }));

    // Guardamos la macro en memoria y refrescamos la lista visual
    savedPresets[presetName] = normalizedActions;
    updatePresetsList();
});

/**
 * Renderiza la lista de macros disponibles con su botón de acción.
 */
function updatePresetsList() {
    const listContainer = document.getElementById('presets-list');
    if (!listContainer) return;

    if (Object.keys(savedPresets).length === 0) {
        listContainer.innerHTML = '<span class="empty-log">No hay presets guardados aún</span>';
        return;
    }

    listContainer.innerHTML = Object.keys(savedPresets).map(name => {
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #020617; padding: 10px; border-radius: 6px; border: 1px solid #334155;">
                <span style="font-weight: 600; color: #f1f5f9; font-size: 0.9rem;">${name} <small style="color:#64748b; font-weight:normal;">(${savedPresets[name].length} pts)</small></span>
                <button class="btn btn-stamp" data-preset="${name}" style="padding: 4px 10px; font-size: 0.8rem; background-color: #10b981;">
                    ⚡ Estampar Aquí
                </button>
            </div>
        `;
    }).join('');

    // Escuchamos los clics en los botones generados dinámicamente
    document.querySelectorAll('.btn-stamp').forEach(btn => {
        btn.addEventListener('click', function() {
            const name = this.getAttribute('data-preset');
            stampPreset(name);
        });
    });
}

// ==========================================================================
// ESTAMPADO CRONOLÓGICO
// ==========================================================================
/**
 * Toma los puntos relativos de la macro y los clona en la línea de tiempo global
 * adaptándolos al segundo exacto donde está pausado el video.
 */
function stampPreset(presetName) {
    const preset = savedPresets[presetName];
    if (!preset || !videoPlayer.src) return;

    // Capturamos el milisegundo exacto de la línea roja vertical
    const currentTimeMs = Math.floor(videoPlayer.currentTime * 1000);

    // Iteramos sobre los puntos guardados en la macro
    preset.forEach(presetAct => {
        // El nuevo tiempo absoluto será: Tiempo del video + Tiempo relativo del punto
        const targetTime = currentTimeMs + presetAct.at;
        
        // Usamos la función global segura del timeline para añadirlo ordenadamente
        if (typeof addAction === 'function') {
            addAction(targetTime, presetAct.pos);
        }
    });

    console.log(`Macro "${presetName}" estampada con éxito a partir del milisegundo ${currentTimeMs}.`);
}

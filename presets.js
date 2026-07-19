// ==========================================================================
// SISTEMA DE PRESETS BASADO EN SELECCIÓN VECTORIAL
// ==========================================================================

let savedPresets = {};
const presetsBtn = document.getElementById('save-preset-btn');

if (presetsBtn) {
    // Cambiamos el texto del botón del HTML original para reflejar la función exacta
    presetsBtn.innerText = "💾 Guardar Nodos Seleccionados como Preset";
}

presetsBtn?.addEventListener('click', function() {
    if (!videoPlayer.src || funscriptActions.length === 0) {
        alert("Primero carga un video y pon puntos en la línea de tiempo.");
        return;
    }

    // Filtramos ÚNICAMENTE los puntos que el usuario tiene seleccionados (en azul)
    const actionsToSave = funscriptActions.filter(act => act.selected);

    if (actionsToSave.length === 0) {
        alert("No tienes ningún punto seleccionado. Haz clic izquierdo y arrastra un cuadro sobre los puntos del Canvas que quieras guardar como preset.");
        return;
    }

    const presetName = prompt("Introduce un nombre para guardar esta selección exacta:", `Patrón Custom ${Object.keys(savedPresets).length + 1}`);
    if (!presetName) return;

    // Normalización matemática para que empiece en el milisegundo 0 relativo
    const baseTime = actionsToSave[0].at;
    const normalizedActions = actionsToSave.map(act => ({
        at: act.at - baseTime,
        pos: act.pos
    }));

    savedPresets[presetName] = normalizedActions;
    updatePresetsList();
    
    // Quitamos la selección para dar feedback visual de que ya se guardó
    funscriptActions.forEach(act => act.selected = false);
    drawTimeline();
    alert(`¡Preset "${presetName}" guardado con éxito!`);
});

function updatePresetsList() {
    const listContainer = document.getElementById('presets-list');
    if (!listContainer) return;

    if (Object.keys(savedPresets).length === 0) {
        listContainer.innerHTML = '<span class="empty-log">No hay presets guardados aún</span>';
        return;
    }

    listContainer.innerHTML = Object.keys(savedPresets).map(name => {
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #020617; padding: 8px; border-radius: 6px; border: 1px solid #334155; margin-bottom: 6px;">
                <span style="font-weight: 600; color: #f1f5f9; font-size: 0.85rem;">${name} <small style="color:#64748b;">(${savedPresets[name].length} pts)</small></span>
                <button class="btn btn-stamp" data-preset="${name}" style="padding: 3px 8px; font-size: 0.75rem; background-color: #10b981;">
                    ⚡ Estampar Aquí
                </button>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.btn-stamp').forEach(btn => {
        btn.addEventListener('click', function() {
            const name = this.getAttribute('data-preset');
            if (typeof stampPreset === 'function') stampPreset(name);
        });
    });
}

function stampPreset(presetName) {
    const preset = savedPresets[presetName];
    if (!preset || !videoPlayer.src) return;

    const currentTimeMs = Math.floor(videoPlayer.currentTime * 1000);

    preset.forEach(presetAct => {
        const targetTime = currentTimeMs + presetAct.at;
        if (typeof addAction === 'function') {
            addAction(targetTime, presetAct.pos);
        }
    });
    drawTimeline();
}

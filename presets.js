// ==========================================================================
// SISTEMA DE PRESETS VECTORIAL ADAPTADO AL HISTORIAL
// ==========================================================================

let savedPresets = {};
const presetsBtn = document.getElementById('save-preset-btn');

if (presetsBtn) {
    presetsBtn.innerText = "💾 Guardar Nodos Seleccionados como Preset";
}

presetsBtn?.addEventListener('click', function() {
    if (!videoPlayer.src || funscriptActions.length === 0) {
        alert("Primero carga un video y pon puntos en la línea de tiempo.");
        return;
    }

    const actionsToSave = funscriptActions.filter(act => act.selected);

    if (actionsToSave.length === 0) {
        alert("No tienes ningún punto seleccionado. Haz clic izquierdo y arrastra un cuadro sobre los puntos del Canvas que quieras guardar.");
        return;
    }

    const presetName = prompt("Introduce un nombre para guardar esta selección exacta:", `Patrón Custom ${Object.keys(savedPresets).length + 1}`);
    if (!presetName) return;

    const baseTime = actionsToSave[0].at;
    const normalizedActions = actionsToSave.map(act => ({
        at: act.at - baseTime,
        pos: act.pos
    }));

    savedPresets[presetName] = normalizedActions;
    updatePresetsList();
    
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

    // CAPTURA DE HISTORIAL: Tomamos una sola foto antes del volcado masivo
    if (typeof window.saveHistoryState === 'function') {
        window.saveHistoryState();
    }

    const currentTimeMs = Math.floor(videoPlayer.currentTime * 1000);

    preset.forEach(presetAct => {
        const targetTime = currentTimeMs + presetAct.at;
        if (typeof addAction === 'function') {
            // Inserta el nodo de forma nativa
            funscriptActions = funscriptActions.filter(act => act.at !== targetTime);
            funscriptActions.push({ at: targetTime, pos: presetAct.pos, selected: false });
        }
    });

    // Ordenamos y redibujamos una sola vez al terminar el ciclo
    funscriptActions.sort((a, b) => a.at - b.at);
    if (typeof updateActionsLog === 'function') updateActionsLog();
    if (typeof drawTimeline === 'function') drawTimeline();
}

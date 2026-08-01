// ==========================================================================
// PRESETS V2.0: INTEGRACIÓN SEGURA CON MEMORIA GLOBAL V5
// ==========================================================================

// Carga inicial desde la memoria local persistente
let savedPresets = {};
try {
    savedPresets = JSON.parse(localStorage.getItem('funscript_saved_presets')) || {};
} catch(e) { savedPresets = {}; }

const presetsBtn = document.getElementById('save-preset-btn');
const videoPlayerPresetNode = document.getElementById('video-player');

// Cargar la lista visual al arrancar la app
document.addEventListener("DOMContentLoaded", () => {
    updatePresetsList();
});

presetsBtn?.addEventListener('click', function() {
    // Usamos el Pilar Cero de memoria global
    const actions = window.funscriptActions || [];

    if (!videoPlayerPresetNode || !videoPlayerPresetNode.src || actions.length === 0) {
        alert("Primero carga un video y coloca puntos en la línea de tiempo.");
        return;
    }

    const actionsToSave = actions.filter(act => act.selected);

    if (actionsToSave.length === 0) {
        alert("Selecciona primero los puntos que deseas guardar arrastrando un cuadro sobre el Canvas.");
        return;
    }

    const presetName = prompt("Introduce un nombre para guardar este Preset:", `Patrón Custom ${Object.keys(savedPresets).length + 1}`);
    if (!presetName) return;

    const baseTime = actionsToSave[0].at;
    const normalizedActions = actionsToSave.map(act => ({
        at: act.at - baseTime,
        pos: act.pos
    }));

    savedPresets[presetName] = normalizedActions;
    
    // Guardar en almacenamiento permanente del navegador
    localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
    updatePresetsList();
});

function updatePresetsList() {
    const listContainer = document.getElementById('presets-list');
    if (!listContainer) return;

    const presetNames = Object.keys(savedPresets);
    if (presetNames.length === 0) {
        listContainer.innerHTML = '<span class="empty-log">No hay presets guardados aún.</span>';
        return;
    }

    listContainer.innerHTML = presetNames.map(name => {
        return `
            <div class="preset-card" draggable="true" data-preset="${name}" style="background: #070a0f; border: 1px solid #1e293b; padding: 6px 10px; margin-bottom: 6px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; cursor: grab; transition: border-color 0.2s;">
                <span style="font-weight: 600; font-size: 0.85rem; color: #e2e8f0;">📌 ${name}</span>
                <div style="display: flex; gap: 4px;">
                    <button class="delete-preset-btn" data-preset="${name}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.9rem; padding: 2px 4px; transition: color 0.2s;" title="Eliminar Preset">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // VINCULAR ACCIÓN DEL BOTÓN ELIMINAR 
    document.querySelectorAll('.delete-preset-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); 
            const name = this.getAttribute('data-preset');
            if (confirm(`¿Estás seguro de que deseas eliminar el preset "${name}"?`)) {
                delete savedPresets[name];
                localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
                updatePresetsList();
            }
        });
    });
}

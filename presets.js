// ==========================================================================
// PRESETS V1.4: PERSISTENCIA TOTAL Y BOTÓN DE ELIMINACIÓN (🗑️)
// ==========================================================================

// Carga inicial desde la memoria local persistente
let savedPresets = {};
try {
    savedPresets = JSON.parse(localStorage.getItem('funscript_saved_presets')) || {};
} catch(e) { savedPresets = {}; }

const presetsBtn = document.getElementById('save-preset-btn');

// Cargar la lista visual al arrancar la app
document.addEventListener("DOMContentLoaded", () => {
    updatePresetsList();
});

presetsBtn?.addEventListener('click', function() {
    if (!videoPlayer.src || funscriptActions.length === 0) {
        alert("Primero carga un video y coloca nodos en la línea de tiempo.");
        return;
    }

    const actionsToSave = funscriptActions.filter(act => act.selected);

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
    
    funscriptActions.forEach(act => act.selected = false);
    if (typeof drawTimeline === 'function') drawTimeline();
});

function updatePresetsList() {
    const listContainer = document.getElementById('presets-list');
    if (!listContainer) return;

    if (Object.keys(savedPresets).length === 0) {
        listContainer.innerHTML = '<span class="empty-log">No hay presets guardados aún</span>';
        return;
    }

    listContainer.innerHTML = Object.keys(savedPresets).map(name => {
        const preset = savedPresets[name];
        
        let maxAt = Math.max(...preset.map(p => p.at)) || 1;
        let svgPoints = preset.map(p => {
            let x = 4 + (p.at / maxAt) * 62;
            let y = 21 - (p.pos / 100) * 18;
            return `${x},${y}`;
        }).join(' ');

        return `
            <div class="preset-card" draggable="true" data-preset="${name}" style="display: flex; align-items: center; justify-content: space-between; background: #070a0f; padding: 6px 10px; border-radius: 10px; border: 1px solid #1c2330; margin-bottom: 6px; cursor: grab; user-select: none; transition: background 0.2s; position: relative;">
                <div style="display:flex; flex-direction:column; gap:1px; max-width: 110px;">
                    <span style="font-weight: 600; color: #f1f5f9; font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</span>
                    <small style="color:#475569; font-size:0.6rem;">${preset.length} nodos</small>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg width="70" height="24" style="background:#020617; border-radius:6px; border: 1px solid #141b25;">
                        <polyline points="${svgPoints}" stroke="#38bdf8" stroke-width="1.2" fill="none"/>
                    </svg>
                    <!-- NUEVO: Botón de Basura para eliminar presets -->
                    <button class="delete-preset-btn" data-preset="${name}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.9rem; padding: 2px 4px; transition: color 0.2s;">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // VINCULAR EVENTO DE ARRASTRE
    document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('dragstart', function() {
            const name = this.getAttribute('data-preset');
            window.timelineGhostPreset = savedPresets[name];
            this.style.background = '#1e293b';
        });
        card.addEventListener('dragend', function() {
            this.style.background = '#070a0f';
            window.timelineGhostPreset = null;
            if (typeof drawTimeline === 'function') drawTimeline();
        });
    });

    // VINCULAR ACCIÓN DEL BOTÓN ELIMINAR 
    document.querySelectorAll('.delete-preset-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Evita conflictos con el drag
            const name = this.getAttribute('data-preset');
            if (confirm(`¿Estás seguro de que deseas eliminar permanentemente el preset "${name}"?`)) {
                delete savedPresets[name];
                localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
                updatePresetsList();
            }
        });
    });
}

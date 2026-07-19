// ==========================================================================
// MÓDULO DE PRESETS ADV: DIBUJO DE MINI-SVG Y ENLACE DE ARRASTRE NATIVO
// ==========================================================================

let savedPresets = {};
const presetsBtn = document.getElementById('save-preset-btn');

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
        
        // CÁLCULO VECTORIAL PARA MINIATURA SVG (Ancho 70, Alto 24)
        let maxAt = Math.max(...preset.map(p => p.at)) || 1;
        let svgPoints = preset.map(p => {
            let x = 4 + (p.at / maxAt) * 62;
            let y = 21 - (p.pos / 100) * 18; // Invertido vertical
            return `${x},${y}`;
        }).join(' ');

        return `
            <div class="preset-card" draggable="true" data-preset="${name}" style="display: flex; align-items: center; justify-content: space-between; background: #070a0f; padding: 6px 10px; border-radius: 10px; border: 1px solid #1c2330; margin-bottom: 6px; cursor: grab; user-select: none; transition: background 0.2s;">
                <div style="display:flex; flex-direction:column; gap:1px;">
                    <span style="font-weight: 600; color: #f1f5f9; font-size: 0.75rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</span>
                    <small style="color:#475569; font-size:0.6rem;">${preset.length} nodos</small>
                </div>
                <!-- Mini-gráfico de previsualización -->
                <svg width="70" height="24" style="background:#020617; border-radius:6px; border: 1px solid #141b25;">
                    <polyline points="${svgPoints}" stroke="#38bdf8" stroke-width="1.2" fill="none"/>
                </svg>
            </div>
        `;
    }).join('');

    // VINCULAR EVENTOS DRAG NATIVOS A LAS TARJETAS
    document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('dragstart', function(e) {
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
}

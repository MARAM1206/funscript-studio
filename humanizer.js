// ==========================================================================
// HUMANIZATION FILTER V1.3.0 (MODO AUTOMÁTICO Y SEMI-MANUAL)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const timeSlider = document.getElementById('hum-time-slider');
    const posSlider = document.getElementById('hum-pos-slider');
    const timeValDisplay = document.getElementById('hum-time-val');
    const posValDisplay = document.getElementById('hum-pos-val');
    const applyBtn = document.getElementById('apply-humanizer-btn');
    
    // 🎯 FIX: Componentes del Toggle Automático
    const autoToggle = document.getElementById('hum-auto-toggle');
    const manualControls = document.getElementById('hum-manual-controls');

    if (!timeSlider || !posSlider || !applyBtn || !autoToggle) return;

    autoToggle.addEventListener('change', (e) => {
        if(e.target.checked) {
            manualControls.style.opacity = '0';
            setTimeout(() => { manualControls.style.display = 'none'; }, 200);
        } else {
            manualControls.style.display = 'block';
            setTimeout(() => { manualControls.style.opacity = '1'; }, 10);
        }
    });

    timeSlider.addEventListener('input', (e) => { timeValDisplay.innerText = `±${e.target.value} ms`; });
    posSlider.addEventListener('input', (e) => { posValDisplay.innerText = `±${e.target.value}%`; });

    applyBtn.addEventListener('click', () => {
        if (document.body.classList.contains('panic-mode-active')) return;

        let actions = window.funscriptActions;
        if (!actions || !Array.isArray(actions)) return;

        const selectedCount = actions.filter(a => a.selected).length;

        if (selectedCount < 2) {
            alert("Selecciona al menos 2 puntos en la línea de tiempo con la caja de arrastre para aplicar la humanización.");
            return;
        }

        if (typeof window.saveHistoryState === 'function') window.saveHistoryState();

        let maxTimeOffset, maxPosOffset;
        
        // 🎯 FIX: Lógica de Límites dependiendo del Toggle
        if (autoToggle.checked) {
            // Genera límites seguros y óptimos al azar (El rango dulce que te sugerí)
            maxTimeOffset = Math.floor(Math.random() * (15 - 8 + 1)) + 8; // Entre 8 y 15ms
            maxPosOffset = Math.floor(Math.random() * (4 - 1 + 1)) + 1; // Entre 1 y 4%
        } else {
            // Respeta estrictamente los límites del slider del usuario
            maxTimeOffset = parseInt(timeSlider.value, 10);
            maxPosOffset = parseInt(posSlider.value, 10);
        }

        const snap = window.snapValue || 5;

        for (let i = 0; i < actions.length; i++) {
            if (!actions[i].selected) continue;

            if (maxPosOffset > 0) {
                let pOffset = (Math.random() * 2 - 1) * maxPosOffset;
                let newPos = actions[i].pos + pOffset;
                actions[i].pos = Math.max(0, Math.min(100, Math.round(newPos / snap) * snap));
            }

            if (maxTimeOffset > 0) {
                // Escudo cronológico: Evita matemáticamente que el punto humano invada el ms de sus vecinos
                let minTime = (i > 0) ? actions[i-1].at + 15 : 0; 
                let maxTime = (i < actions.length - 1) ? actions[i+1].at - 15 : actions[i].at + maxTimeOffset;

                let tOffset = (Math.random() * 2 - 1) * maxTimeOffset;
                let newTime = Math.round(actions[i].at + tOffset);

                newTime = Math.max(minTime, Math.min(maxTime, newTime));
                actions[i].at = newTime;
            }
        }

        if (typeof window.cleanDuplicates === 'function') window.cleanDuplicates();
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.notifyCloud === 'function') window.notifyCloud();
        if (typeof window.updateHeatmapAndStats === 'function') window.updateHeatmapAndStats();
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
    });
});

// ==========================================================================
// HUMANIZATION FILTER V1.3.3 (LIMITES AUTOMÁTICOS Y MANUALES ESTRICTOS)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const timeSlider = document.getElementById('hum-time-slider');
    const posSlider = document.getElementById('hum-pos-slider');
    const timeValDisplay = document.getElementById('hum-time-val');
    const posValDisplay = document.getElementById('hum-pos-val');
    const applyBtn = document.getElementById('apply-humanizer-btn');
    
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
        
        // 🎯 FIX: Modo Inteligente vs Manual Estricto
        if (autoToggle.checked) {
            maxTimeOffset = 15; // Límite seguro óptimo
            maxPosOffset = 3;   // Límite seguro óptimo
        } else {
            maxTimeOffset = parseInt(timeSlider.value, 10);
            maxPosOffset = parseInt(posSlider.value, 10);
        }

        const snap = window.snapValue || 5;

        for (let i = 0; i < actions.length; i++) {
            if (!actions[i].selected) continue;

            if (maxPosOffset > 0) {
                // Selecciona una magnitud entre el 20% y el 100% de tu límite (nunca 0)
                let pMag = maxPosOffset * (0.2 + Math.random() * 0.8);
                let pSign = Math.random() < 0.5 ? -1 : 1;
                let newPos = actions[i].pos + (pMag * pSign);
                actions[i].pos = Math.max(0, Math.min(100, Math.round(newPos / snap) * snap));
            }

            if (maxTimeOffset > 0) {
                let minTime = (i > 0) ? actions[i-1].at + 15 : 0; 
                let maxTime = (i < actions.length - 1) ? actions[i+1].at - 15 : actions[i].at + maxTimeOffset;

                let tMag = maxTimeOffset * (0.2 + Math.random() * 0.8);
                let tSign = Math.random() < 0.5 ? -1 : 1;
                let newTime = Math.round(actions[i].at + (tMag * tSign));

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

// ==========================================================================
// HUMANIZATION FILTER V1.4.2 (SMART DYNAMIC AUTONOMY)
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
            alert("Selecciona al menos 2 puntos en la línea de tiempo para aplicar la humanización.");
            return;
        }

        if (typeof window.saveHistoryState === 'function') window.saveHistoryState();

        let maxTimeOffset = 0;
        let maxPosOffset = 0;
        
        if (!autoToggle.checked) {
            maxTimeOffset = parseInt(timeSlider.value, 10);
            maxPosOffset = parseInt(posSlider.value, 10);
        }

        const snap = window.snapValue || 5;

        for (let i = 0; i < actions.length; i++) {
            if (!actions[i].selected) continue;

            let currentMaxT = maxTimeOffset;
            let currentMaxP = maxPosOffset;

            // 🎯 FIX: Inteligencia Autónoma (Calcula límites basados en velocidad y distancia)
            if (autoToggle.checked) {
                let dt1 = i > 0 ? actions[i].at - actions[i-1].at : 500;
                let dt2 = i < actions.length - 1 ? actions[i+1].at - actions[i].at : 500;
                let minDt = Math.min(dt1, dt2);
                
                // Tiempo: 15% del espacio disponible, con tope de seguridad de 30ms.
                currentMaxT = Math.min(30, Math.max(5, minDt * 0.15));

                let dp1 = i > 0 ? Math.abs(actions[i].pos - actions[i-1].pos) : 50;
                let dp2 = i < actions.length - 1 ? Math.abs(actions[i+1].pos - actions[i].pos) : 50;
                let maxDp = Math.max(dp1, dp2);
                
                // Posición: 10% de la distancia de carrera, con tope de 8%.
                currentMaxP = Math.min(8, Math.max(1, maxDp * 0.10));
            }

            if (currentMaxP > 0) {
                let pMag = currentMaxP * (0.2 + Math.random() * 0.8);
                let pSign = Math.random() < 0.5 ? -1 : 1;
                let newPos = actions[i].pos + (pMag * pSign);
                actions[i].pos = Math.max(0, Math.min(100, Math.round(newPos / snap) * snap));
            }

            if (currentMaxT > 0) {
                let minTime = (i > 0) ? actions[i-1].at + 15 : 0; 
                let maxTime = (i < actions.length - 1) ? actions[i+1].at - 15 : actions[i].at + currentMaxT;

                let tMag = currentMaxT * (0.2 + Math.random() * 0.8);
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

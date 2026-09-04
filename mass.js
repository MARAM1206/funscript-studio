// ==========================================================================
// MASS MODIFIER V1.2.3 (ESCALA DE INTENSIDAD, OFFSET E INVERSIÓN)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const scaleSlider = document.getElementById('mass-scale-slider');
    const offsetSlider = document.getElementById('mass-offset-slider');
    const scaleVal = document.getElementById('mass-scale-val');
    const offsetVal = document.getElementById('mass-offset-val');
    
    const applyScaleBtn = document.getElementById('apply-scale-btn');
    const applyOffsetBtn = document.getElementById('apply-offset-btn');
    const invertBtn = document.getElementById('invert-btn');

    if (!scaleSlider || !offsetSlider) return;

    // Actualización visual de los sliders
    scaleSlider.addEventListener('input', (e) => {
        scaleVal.innerText = `${e.target.value}%`;
    });

    offsetSlider.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        offsetVal.innerText = (val > 0 ? '+' : '') + `${val}%`;
    });

    function getSelectedActions() {
        if (!window.funscriptActions || !Array.isArray(window.funscriptActions)) return [];
        return window.funscriptActions.filter(a => a.selected);
    }

    function pushUpdate() {
        if (typeof window.cleanDuplicates === 'function') window.cleanDuplicates();
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.notifyCloud === 'function') window.notifyCloud();
        if (typeof window.updateHeatmapAndStats === 'function') window.updateHeatmapAndStats();
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
    }

    // 1. Motor de Amplitud (Escala de Intensidad centrada en el 50%)
    applyScaleBtn.addEventListener('click', () => {
        if (document.body.classList.contains('panic-mode-active')) return;
        const selected = getSelectedActions();
        if (selected.length === 0) return alert("Selecciona puntos en la línea de tiempo para escalar.");

        if (typeof window.saveHistoryState === 'function') window.saveHistoryState();
        
        const factor = parseInt(scaleSlider.value, 10) / 100; // Ej. 80% = 0.8
        const snap = window.snapValue || 5;

        selected.forEach(act => {
            // Pivoteamos la compresión desde el centro del juguete (50%)
            let distanceFromCenter = act.pos - 50; 
            let newPos = 50 + (distanceFromCenter * factor);
            act.pos = Math.max(0, Math.min(100, Math.round(newPos / snap) * snap));
        });

        pushUpdate();
    });

    // 2. Motor de Desplazamiento Vertical (Offset)
    applyOffsetBtn.addEventListener('click', () => {
        if (document.body.classList.contains('panic-mode-active')) return;
        const selected = getSelectedActions();
        if (selected.length === 0) return alert("Selecciona puntos en la línea de tiempo para desplazar.");

        if (typeof window.saveHistoryState === 'function') window.saveHistoryState();
        
        const offset = parseInt(offsetSlider.value, 10);
        const snap = window.snapValue || 5;

        selected.forEach(act => {
            let newPos = act.pos + offset;
            act.pos = Math.max(0, Math.min(100, Math.round(newPos / snap) * snap));
        });

        pushUpdate();
    });

    // 3. Motor de Inversión Absoluta
    invertBtn.addEventListener('click', () => {
        if (document.body.classList.contains('panic-mode-active')) return;
        const selected = getSelectedActions();
        if (selected.length === 0) return alert("Selecciona puntos en la línea de tiempo para invertir.");

        if (typeof window.saveHistoryState === 'function') window.saveHistoryState();
        
        const snap = window.snapValue || 5;

        selected.forEach(act => {
            let newPos = 100 - act.pos;
            act.pos = Math.max(0, Math.min(100, Math.round(newPos / snap) * snap));
        });

        pushUpdate();
    });
});

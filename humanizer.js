// ==========================================================================
// HUMANIZATION FILTER V1.2.1 (MOTOR MATEMÁTICO DE VARIACIÓN ORGÁNICA)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const timeSlider = document.getElementById('hum-time-slider');
    const posSlider = document.getElementById('hum-pos-slider');
    const timeValDisplay = document.getElementById('hum-time-val');
    const posValDisplay = document.getElementById('hum-pos-val');
    const applyBtn = document.getElementById('apply-humanizer-btn');

    if (!timeSlider || !posSlider || !applyBtn) return;

    // Actualización de etiquetas en vivo
    timeSlider.addEventListener('input', (e) => {
        timeValDisplay.innerText = `±${e.target.value} ms`;
    });

    posSlider.addEventListener('input', (e) => {
        posValDisplay.innerText = `±${e.target.value}%`;
    });

    applyBtn.addEventListener('click', () => {
        if (document.body.classList.contains('panic-mode-active')) return;

        // Recuperar acciones desde el motor maestro
        let actions = window.funscriptActions;
        if (!actions || !Array.isArray(actions)) return;

        const selectedCount = actions.filter(a => a.selected).length;

        if (selectedCount < 2) {
            alert("Selecciona al menos 2 puntos en la línea de tiempo con la caja de arrastre para aplicar la humanización.");
            return;
        }

        if (typeof window.saveHistoryState === 'function') window.saveHistoryState();

        const maxTimeOffset = parseInt(timeSlider.value, 10);
        const maxPosOffset = parseInt(posSlider.value, 10);
        const snap = window.snapValue || 5;

        // Iterar y aplicar matemáticas de Caos Controlado
        for (let i = 0; i < actions.length; i++) {
            if (!actions[i].selected) continue;

            // 1. Variación de Posición (Eje Y)
            if (maxPosOffset > 0) {
                // Genera un número aleatorio entre -maxPosOffset y +maxPosOffset
                let pOffset = (Math.random() * 2 - 1) * maxPosOffset;
                let newPos = actions[i].pos + pOffset;
                // Bloquea matemáticamente para no pasar de 0 ni de 100, y respeta el Snap global
                actions[i].pos = Math.max(0, Math.min(100, Math.round(newPos / snap) * snap));
            }

            // 2. Variación de Tiempo (Eje X) -> Protegido cronológicamente
            if (maxTimeOffset > 0) {
                // Establecemos límites invisibles para que un punto NUNCA pase al punto que tiene al lado
                let minTime = (i > 0) ? actions[i-1].at + 15 : 0; // Se mantiene 15ms lejos del vecino izquierdo
                let maxTime = (i < actions.length - 1) ? actions[i+1].at - 15 : actions[i].at + maxTimeOffset;

                let tOffset = (Math.random() * 2 - 1) * maxTimeOffset;
                let newTime = Math.round(actions[i].at + tOffset);

                // Aplica escudo de choque
                newTime = Math.max(minTime, Math.min(maxTime, newTime));
                actions[i].at = newTime;
            }
        }

        // Forzar actualización total del sistema tras la mutación
        if (typeof window.cleanDuplicates === 'function') window.cleanDuplicates();
        if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection();
        if (typeof window.notifyCloud === 'function') window.notifyCloud();
        if (typeof window.updateHeatmapAndStats === 'function') window.updateHeatmapAndStats();
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
    });
});

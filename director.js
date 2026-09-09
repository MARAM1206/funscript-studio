// ==========================================================================
// IA DIRECTOR V1.5.0 (GENERADOR PROCEDURAL CON HUMANIZACIÓN Y TRANSICIONES)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const durSlider = document.getElementById('director-dur-slider');
    const durValDisplay = document.getElementById('director-dur-val');
    const speedSelect = document.getElementById('director-speed-select');
    const generateBtn = document.getElementById('director-generate-btn');

    if (!durSlider || !generateBtn) return;

    durSlider.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        if (val === 0) {
            durValDisplay.innerText = "Todo el Video";
        } else {
            durValDisplay.innerText = `${val} Minutos`;
        }
    });

    // Analiza un preset guardado y calcula su velocidad FapTap
    function calculatePresetSpeed(preset) {
        if (!preset || preset.length < 2) return 0;
        let totalSpeed = 0;
        let validSegments = 0;
        const factor = window.hardwareDB[window.activeDevice || 'handy_std'].factor;
        
        for (let i = 1; i < preset.length; i++) {
            let dt = (preset[i].at - preset[i-1].at) / 1000.0;
            let dp = Math.abs(preset[i].pos - preset[i-1].pos);
            if (dt > 0) { 
                totalSpeed += (dp * factor) / dt;
                validSegments++;
            }
        }
        return validSegments > 0 ? (totalSpeed / validSegments) : 0;
    }

    // Clasifica todos los presets de la librería
    function getCategorizedPresets() {
        let categories = { slow: [], medium: [], fast: [], very_fast: [] };
        if (!window.presetsLibrary || window.presetsLibrary.length === 0) return categories;

        window.presetsLibrary.forEach(p => {
            let speed = calculatePresetSpeed(p.actions);
            if (speed >= 501) categories.very_fast.push(p);
            else if (speed >= 301) categories.fast.push(p);
            else if (speed >= 151) categories.medium.push(p);
            else categories.slow.push(p);
        });
        return categories;
    }

    // Si no hay presets de la velocidad requerida, la IA "imagina" uno proceduralmente
    function imaginePreset(category) {
        let actions = [];
        let durationMs = 2000 + Math.random() * 3000; // Bloques de 2 a 5 segundos
        let reps;
        let pMin = 10 + Math.random() * 20; 
        let pMax = 90 - Math.random() * 20;

        if (category === 'slow') reps = Math.floor(durationMs / 800);
        else if (category === 'medium') reps = Math.floor(durationMs / 400);
        else if (category === 'fast') reps = Math.floor(durationMs / 200);
        else reps = Math.floor(durationMs / 100);

        if (reps < 2) reps = 2;
        let stepMs = durationMs / reps;

        for (let i = 0; i <= reps; i++) {
            let isPeak = (i % 2 === 0);
            // Variación orgánica
            let y = isPeak ? (pMax - Math.random()*5) : (pMin + Math.random()*5);
            actions.push({ at: Math.round(i * stepMs), pos: Math.round(y) });
        }
        return actions;
    }

    generateBtn.addEventListener('click', () => {
        if (document.body.classList.contains('panic-mode-active')) return;
        
        let targetDurationMs = parseInt(durSlider.value, 10) * 60 * 1000;
        
        if (targetDurationMs === 0) {
            if (window.videoPlayer && window.videoPlayer.duration) {
                targetDurationMs = window.videoPlayer.duration * 1000;
            } else {
                alert("No hay video cargado para calcular la duración total. Asignando 3 minutos por defecto.");
                targetDurationMs = 3 * 60 * 1000;
            }
        }

        const originalText = generateBtn.innerText;
        generateBtn.innerText = "🧠 Pensando y Generando...";
        generateBtn.disabled = true;

        setTimeout(() => {
            if (typeof window.saveHistoryState === 'function') window.saveHistoryState();
            
            let newActions = [];
            let currentTimeMs = 0;
            const userChoice = speedSelect.value;
            const categories = getCategorizedPresets();
            
            // La IA genera una "Curva de Guion" si está en aleatorio (Dynamic)
            // Ej: Empieza lento, sube, baja, clímax.
            let scriptCurve = [];
            if (userChoice === 'random') {
                const phases = ['slow', 'medium', 'fast', 'very_fast', 'medium', 'slow', 'fast', 'very_fast'];
                let timeAccumulator = 0;
                while(timeAccumulator < targetDurationMs) {
                    let phase = phases[Math.floor(Math.random() * phases.length)];
                    let blockDuration = 5000 + Math.random() * 15000; // 5 a 20 segundos por fase
                    scriptCurve.push({ speed: phase, duration: blockDuration });
                    timeAccumulator += blockDuration;
                }
            } else {
                scriptCurve.push({ speed: userChoice, duration: targetDurationMs });
            }

            for (let block of scriptCurve) {
                let blockEndMs = currentTimeMs + block.duration;
                
                while (currentTimeMs < blockEndMs && currentTimeMs < targetDurationMs) {
                    let pool = categories[block.speed];
                    let chosenPresetActions;
                    
                    if (pool && pool.length > 0) {
                        // Elige un preset al azar del pool correcto
                        let randIndex = Math.floor(Math.random() * pool.length);
                        chosenPresetActions = pool[randIndex].actions;
                    } else {
                        // Si no hay presets guardados en esa categoría, imagina uno
                        chosenPresetActions = imaginePreset(block.speed);
                    }

                    // 🎯 FIX: Transiciones Suaves (Puentes)
                    // Si ya hay puntos, inyectamos un movimiento suave hacia el inicio del nuevo preset
                    if (newActions.length > 0) {
                        let lastPos = newActions[newActions.length - 1].pos;
                        let firstNewPos = chosenPresetActions[0].pos;
                        
                        // Si la diferencia es abrupta, creamos un puente de 400ms
                        if (Math.abs(lastPos - firstNewPos) > 10) {
                            currentTimeMs += 400; 
                            // Agregamos un punto intermedio (Bezier lineal simulado)
                            newActions.push({ at: Math.round(currentTimeMs), pos: firstNewPos });
                        }
                    }

                    // Inyectar el Preset adaptado al tiempo actual
                    let pDuration = chosenPresetActions[chosenPresetActions.length - 1].at;
                    
                    for (let act of chosenPresetActions) {
                        // Humanizador IA intrínseco (Micro errores de 3ms a 12ms y 1% a 3%)
                        let humanTime = (Math.random() * 2 - 1) * 8; 
                        let humanPos = (Math.random() * 2 - 1) * 2;
                        
                        let injPos = Math.max(0, Math.min(100, Math.round((act.pos + humanPos) / 5) * 5));
                        let injAt = Math.round(currentTimeMs + act.at + humanTime);
                        
                        // Evitamos empalmes de tiempo
                        if (newActions.length > 0 && injAt <= newActions[newActions.length-1].at) {
                            injAt = newActions[newActions.length-1].at + 20;
                        }

                        if (injAt <= targetDurationMs) {
                            newActions.push({ at: injAt, pos: injPos, selected: false });
                        }
                    }
                    currentTimeMs += pDuration;
                }
            }

            // Inyectar al canvas general
            if (newActions.length > 0) {
                if (!window.funscriptActions) window.funscriptActions = [];
                // Reemplazamos si el usuario decidió crear de cero, o podríamos concatenar. 
                // Para "Generar Guion", limpiaremos la pista para darle el control a la IA.
                window.funscriptActions.splice(0, window.funscriptActions.length, ...newActions);
                
                if (typeof window.cleanDuplicates === 'function') window.cleanDuplicates();
                if (typeof window.notifyCloud === 'function') window.notifyCloud();
                if (typeof window.updateHeatmapAndStats === 'function') window.updateHeatmapAndStats();
                if (typeof window.drawTimeline === 'function') window.drawTimeline();
            }

            generateBtn.innerText = originalText;
            generateBtn.disabled = false;

            // Pan visual hacia el inicio
            if (typeof window.setActualTimeMs === 'function') {
                window.setActualTimeMs(0);
                window.dispatchEvent(new Event('forceTimelinePan'));
            }

        }, 500); 
    });
});

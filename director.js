// ==========================================================================
// IA DIRECTOR V1.6.0 (PROMPT NPL, STAMINA Y MUTACIÓN PROCEDURAL DE PRESETS)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const durSlider = document.getElementById('director-dur-slider');
    const durValDisplay = document.getElementById('director-dur-val');
    const speedSelect = document.getElementById('director-speed-select');
    const staminaSelect = document.getElementById('director-stamina');
    const promptInput = document.getElementById('director-prompt');
    const generateBtn = document.getElementById('director-generate-btn');

    if (!durSlider || !generateBtn) return;

    durSlider.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        if (val === 0) durValDisplay.innerText = "Todo el Video";
        else durValDisplay.innerText = `${val} Minutos`;
    });

    // 1. EXTRAE PALABRAS CLAVE DEL PROMPT
    function parsePromptTags(text) {
        let tags = [];
        if (!text) return ['mix'];
        const lower = text.toLowerCase();
        
        if (lower.includes('blowjob') || lower.includes('oral') || lower.includes('garganta') || lower.includes('boca')) tags.push('oral');
        if (lower.includes('senton') || lower.includes('cowgirl') || lower.includes('cabalgar') || lower.includes('duro')) tags.push('ride');
        if (lower.includes('edging') || lower.includes('borde') || lower.includes('paron') || lower.includes('stop')) tags.push('edging');
        if (lower.includes('tease') || lower.includes('roce') || lower.includes('suave') || lower.includes('lento')) tags.push('tease');
        
        if (tags.length === 0) tags = ['mix'];
        return tags;
    }

    // 2. MOTOR DE MUTACIÓN (Agarra un preset y le cambia la forma orgánicamente)
    function mutatePreset(presetActions, mode) {
        if (!presetActions || presetActions.length === 0) return [];
        let mutated = [];
        
        // Determinar factores de mutación según el modo
        let scale = 1.0; 
        let offset = 0;

        if (mode === 'oral') {
            scale = 0.4 + Math.random() * 0.3; // Rango corto (40% - 70% de recorrido)
            offset = Math.random() > 0.5 ? (100 - scale*100) : 0; // O muy arriba (garganta) o muy abajo (punta)
        } else if (mode === 'ride') {
            scale = 0.9 + Math.random() * 0.1; // Recorrido casi completo (90% - 100%)
            offset = 0; // Base 0
        } else if (mode === 'tease') {
            scale = 0.15 + Math.random() * 0.2; // Rango levísimo (15% - 35%)
            offset = Math.random() * 60; // Puede estar en cualquier parte
        }

        // Aplicamos la mutación geométrica al patrón
        for (let i = 0; i < presetActions.length; i++) {
            let act = presetActions[i];
            
            // Micro-humanización matemática
            let humanPos = (Math.random() * 2 - 1) * 3; 
            let humanTime = (Math.random() * 2 - 1) * 8; 
            
            let rawPos = (act.pos * scale) + offset + humanPos;
            let finalPos = Math.max(0, Math.min(100, Math.round(rawPos / 5) * 5));
            let finalTime = Math.max(0, Math.round(act.at + humanTime));

            // Simulación de "Rebote" ocasional en sentones profundos
            if (mode === 'ride' && finalPos <= 10 && Math.random() > 0.7 && i > 0) {
                let midTime = mutated[mutated.length-1].at + (finalTime - mutated[mutated.length-1].at) / 2;
                mutated.push({ at: Math.round(midTime), pos: 25 }); // Micro rebote antes de tocar fondo
            }

            mutated.push({ at: finalTime, pos: finalPos });
        }
        return mutated;
    }

    // 3. GENERADOR DE ESCENAS PROCEDURAL (Si no hay presets)
    function generateProceduralBlock(mode, durationMs, speedCat) {
        let actions = [];
        let reps;
        
        // Frecuencia basada en categoría de velocidad
        if (speedCat === 'slow') reps = Math.max(2, Math.floor(durationMs / 900));
        else if (speedCat === 'medium') reps = Math.max(2, Math.floor(durationMs / 450));
        else if (speedCat === 'fast') reps = Math.max(2, Math.floor(durationMs / 220));
        else reps = Math.max(2, Math.floor(durationMs / 120)); // very fast

        let stepMs = durationMs / reps;

        for (let i = 0; i <= reps; i++) {
            let isPeak = (i % 2 === 0);
            let y = 0;
            
            if (mode === 'oral') y = isPeak ? 100 : (70 + Math.random()*15);
            else if (mode === 'ride') y = isPeak ? (90 + Math.random()*10) : (0 + Math.random()*10);
            else if (mode === 'tease') y = isPeak ? (40 + Math.random()*20) : (20 + Math.random()*15);
            else y = isPeak ? (80 + Math.random()*20) : (0 + Math.random()*20); // Mix default

            // Patrón Edging: Sube la velocidad exponencialmente y frena abruptamente
            if (mode === 'edging') {
                let progress = i / reps;
                let currentStep = stepMs * (1 - (progress * 0.8)); // Cada vez más rápido
                let t = actions.length > 0 ? actions[actions.length-1].at + currentStep : 0;
                
                if (i === reps) {
                    actions.push({ at: Math.round(t), pos: 100 });
                    actions.push({ at: Math.round(t + 200), pos: 0 }); // Frenazo
                } else {
                    actions.push({ at: Math.round(t), pos: Math.round(y) });
                }
            } else {
                actions.push({ at: Math.round(i * stepMs), pos: Math.round(y) });
            }
        }
        return actions;
    }

    // EL CEREBRO PRINCIPAL
    generateBtn.addEventListener('click', () => {
        if (document.body.classList.contains('panic-mode-active')) return;
        
        let targetDurationMs = parseInt(durSlider.value, 10) * 60 * 1000;
        if (targetDurationMs === 0) {
            if (window.videoPlayer && window.videoPlayer.duration) targetDurationMs = window.videoPlayer.duration * 1000;
            else { alert("No hay video. Asignando 3 minutos."); targetDurationMs = 3 * 60 * 1000; }
        }

        const originalText = generateBtn.innerText;
        generateBtn.innerText = "🧠 Pensando y Generando...";
        generateBtn.disabled = true;

        setTimeout(() => {
            try {
                if (typeof window.saveHistoryState === 'function') window.saveHistoryState();
                
                let newActions = [];
                let currentTimeMs = 0;
                
                const speedPref = speedSelect.value;
                const staminaPref = staminaSelect.value;
                const promptTags = parsePromptTags(promptInput.value);
                
                let failSafe = 0; // Escudo anti-bucles infinitos
                
                // Métrica de Aguante (Determina qué porcentaje de tiempo es intenso vs descanso)
                let intenseRatio = staminaPref === 'high' ? 0.8 : (staminaPref === 'low' ? 0.3 : 0.6);

                while (currentTimeMs < targetDurationMs && failSafe < 1000) {
                    failSafe++;
                    
                    // 1. Determinar el "Estado" de este bloque (Intenso, Descanso o Edging)
                    let isIntensePhase = Math.random() < intenseRatio;
                    
                    // 2. Asignar Velocidad
                    let blockSpeed = speedPref;
                    if (speedPref === 'random') {
                        const speeds = ['slow', 'medium', 'fast', 'very_fast'];
                        blockSpeed = isIntensePhase ? speeds[Math.floor(Math.random()*2) + 2] : speeds[Math.floor(Math.random()*2)];
                    }

                    // 3. Asignar Acción según el Prompt
                    let blockAction = promptTags[Math.floor(Math.random() * promptTags.length)];
                    
                    // Si el stamina es bajo y toca descanso, forzamos un 'tease' o pausa
                    if (!isIntensePhase && staminaPref === 'low') blockAction = 'tease';
                    
                    // 4. Duración del Bloque (10 a 25 segundos)
                    let blockDurationMs = 10000 + Math.random() * 15000;
                    if (blockAction === 'edging') blockDurationMs = 8000; // El edging es explosivo y corto
                    
                    // 5. Generar o Mutar Presets
                    let blockActions = [];
                    // Si tenemos presets guardados (Simularemos si hay array global)
                    if (window.presetsLibrary && window.presetsLibrary.length > 0 && Math.random() > 0.4) {
                        let randPreset = window.presetsLibrary[Math.floor(Math.random() * window.presetsLibrary.length)].actions;
                        blockActions = mutatePreset(randPreset, blockAction);
                    } else {
                        blockActions = generateProceduralBlock(blockAction, blockDurationMs, blockSpeed);
                    }

                    // 6. Inyectar el bloque calculado en la línea de tiempo principal
                    let pDur = blockActions[blockActions.length - 1].at;
                    if (pDur <= 0) pDur = 1000; // Escudo anti-división por cero
                    
                    let timeMultiplier = blockDurationMs / pDur; // Ajustar el preset a la duración que la IA quiere

                    // Puente de Transición Suave (Humanización de empalmes)
                    if (newActions.length > 0) {
                        let lastPos = newActions[newActions.length - 1].pos;
                        let firstNewPos = blockActions[0].pos;
                        if (Math.abs(lastPos - firstNewPos) > 15) {
                            currentTimeMs += 500; // Medio segundo para moverse a la nueva posición natural
                            newActions.push({ at: Math.round(currentTimeMs), pos: firstNewPos });
                        }
                    }

                    for (let act of blockActions) {
                        let injAt = Math.round(currentTimeMs + (act.at * timeMultiplier));
                        if (newActions.length > 0 && injAt <= newActions[newActions.length-1].at) continue; // Evita traslapes temporales
                        
                        if (injAt <= targetDurationMs) {
                            newActions.push({ at: injAt, pos: act.pos, selected: false });
                        }
                    }
                    
                    currentTimeMs += blockDurationMs;

                    // Si hubo edging, forzar una pausa dramática de 4 segundos
                    if (blockAction === 'edging') {
                        currentTimeMs += 4000;
                        newActions.push({ at: Math.round(currentTimeMs), pos: 0 }); 
                    }
                }

                // Escribir en la memoria principal
                if (newActions.length > 0) {
                    if (!window.funscriptActions) window.funscriptActions = [];
                    window.funscriptActions.splice(0, window.funscriptActions.length, ...newActions);
                    
                    if (typeof window.cleanDuplicates === 'function') window.cleanDuplicates();
                    if (typeof window.notifyCloud === 'function') window.notifyCloud();
                    if (typeof window.updateHeatmapAndStats === 'function') window.updateHeatmapAndStats();
                    if (typeof window.drawTimeline === 'function') window.drawTimeline();
                }

            } catch (error) {
                console.error("Error en la IA:", error);
                alert("La IA encontró un problema matemático al generar la ruta. Inténtalo de nuevo.");
            } finally {
                // Siempre restaurar el botón, pase lo que pase
                generateBtn.innerText = originalText;
                generateBtn.disabled = false;
                if (typeof window.setActualTimeMs === 'function') {
                    window.setActualTimeMs(0);
                    window.dispatchEvent(new Event('forceTimelinePan'));
                }
            }
        }, 300); // Pequeño retraso para permitir que la UI actualice el botón a "Pensando..."
    });
});

// ==========================================================================
// IA DIRECTOR V1.6.3 (HARDWARE ENFORCEMENT & GROOVE ORGÁNICO HUMANO)
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

    // 🎯 FIX: Filtro de Física. Elimina ROJOS y AMARILLOS según el hardware activo
    function enforceHardwareLimits(actions, hwMax, hwMin, factor) {
        let snap = window.snapValue || 5;
        for (let pass = 0; pass < 3; pass++) {
            let shifted = 0;
            let modifications = 0;
            for (let i = 1; i < actions.length; i++) {
                actions[i].at += shifted; // Arrastramos los cambios de tiempo de los puntos anteriores
                
                let act1 = actions[i-1];
                let act2 = actions[i];
                let dt_ms = act2.at - act1.at;
                
                // Límite de colisión de tiempo (Mínimo 15ms entre puntos)
                if (dt_ms < 15) { 
                    let fix = 15 - dt_ms;
                    act2.at += fix;
                    shifted += fix;
                    dt_ms = 15;
                    modifications++;
                }
                
                let dt_s = dt_ms / 1000.0;
                let dp = Math.abs(act2.pos - act1.pos);
                let speed = (dp * factor) / dt_s;
                
                // ROJO: Muy rápido -> Alargamos el tiempo para salvar la máquina
                if (speed > hwMax) {
                    let required_dt_s = (dp * factor) / (hwMax * 0.95); 
                    let addedTime = Math.round((required_dt_s - dt_s) * 1000);
                    act2.at += addedTime;
                    shifted += addedTime;
                    modifications++;
                } 
                // AMARILLO: Muy lento -> Aplanamos a pausa o robamos tiempo para acelerar
                else if (speed < hwMin && dp > 0) {
                    if (dp < 15) {
                        act2.pos = act1.pos; // Lo convertimos en una pausa limpia
                        modifications++;
                    } else {
                        let required_dt_s = (dp * factor) / (hwMin * 1.05);
                        let subtractedTime = Math.round((dt_s - required_dt_s) * 1000);
                        if (act2.at - subtractedTime > act1.at + 15) {
                            act2.at -= subtractedTime;
                            shifted -= subtractedTime;
                            modifications++;
                        }
                    }
                }
                // Ajustamos a la grilla
                act2.pos = Math.max(0, Math.min(100, Math.round(act2.pos / snap) * snap));
            }
            if (modifications === 0) break;
        }
        return actions;
    }

    // 🎯 FIX: Mutación Orgánica ("Groove" y Oscilación Perlin simulada)
    function mutatePreset(presetActions, mode) {
        if (!presetActions || !Array.isArray(presetActions) || presetActions.length < 2) return [];
        let mutated = [];
        
        let baseScale = 1.0; 
        let offset = 0;

        if (mode === 'oral') { baseScale = 0.5; offset = Math.random() > 0.5 ? 40 : 0; }
        else if (mode === 'ride') { baseScale = 0.95; offset = 0; }
        else if (mode === 'tease') { baseScale = 0.2; offset = Math.random() * 50; }

        for (let i = 0; i < presetActions.length; i++) {
            let act = presetActions[i];
            
            // Variación fluida en lugar de caos estático
            let scaleWander = Math.sin(i * 0.7) * 0.15; // Respira +/- 15%
            let humanPos = (Math.random() * 2 - 1) * 4; 
            let humanTime = (Math.random() * 2 - 1) * 10; 
            
            let currentScale = Math.max(0.1, baseScale + scaleWander);
            let rawPos = (act.pos * currentScale) + offset + humanPos;
            
            let finalPos = Math.max(0, Math.min(100, Math.round(rawPos / 5) * 5));
            let finalTime = Math.max(0, Math.round(act.at + humanTime));

            // Micro-rebotes naturales
            if (mode === 'ride' && finalPos <= 10 && Math.random() > 0.6 && i > 0 && mutated.length > 0) {
                let midTime = mutated[mutated.length-1].at + (finalTime - mutated[mutated.length-1].at) / 2;
                mutated.push({ at: Math.round(midTime), pos: 20 + Math.random()*10 }); 
            }

            mutated.push({ at: finalTime, pos: finalPos });
        }
        return mutated;
    }

    function generateProceduralBlock(mode, durationMs, speedCat) {
        let actions = [];
        let reps;
        
        if (speedCat === 'slow') reps = Math.max(2, Math.floor(durationMs / 900));
        else if (speedCat === 'medium') reps = Math.max(2, Math.floor(durationMs / 450));
        else if (speedCat === 'fast') reps = Math.max(2, Math.floor(durationMs / 220));
        else reps = Math.max(2, Math.floor(durationMs / 120)); 

        let baseStepMs = Math.max(50, durationMs / reps); 
        let t = 0;

        for (let i = 0; i <= reps; i++) {
            let isPeak = (i % 2 === 0);
            
            // 🎯 FIX: El ritmo humano nunca es matemático, tiene "Swing"
            let rhythmJitter = 0.75 + Math.random() * 0.5; // +/- 25% de variación rítmica
            let currentStepMs = baseStepMs * rhythmJitter;
            t += currentStepMs;

            // Profundidad de penetración fluida
            let strokeDepth = 0.6 + Math.random() * 0.4; // 60% al 100% de la fuerza
            let y = 0;
            
            if (mode === 'oral') y = isPeak ? 100 : (100 - (35 * strokeDepth));
            else if (mode === 'ride') y = isPeak ? (100 * strokeDepth) : (100 * (1 - strokeDepth));
            else if (mode === 'tease') y = isPeak ? (40 + 20 * strokeDepth) : (20 + 15 * strokeDepth);
            else y = isPeak ? (80 * strokeDepth + 20) : (20 * (1 - strokeDepth)); 

            if (mode === 'edging') {
                let progress = i / reps;
                let edgeStep = Math.max(50, baseStepMs * (1 - (progress * 0.85))); // Acelera
                t = actions.length > 0 ? actions[actions.length-1].at + edgeStep : currentStepMs;
                
                if (i === reps) {
                    actions.push({ at: Math.round(t), pos: 100 });
                    actions.push({ at: Math.round(t + 250), pos: 0 }); // Frenazo en seco
                } else {
                    actions.push({ at: Math.round(t), pos: Math.round(y) });
                }
            } else {
                actions.push({ at: Math.round(t), pos: Math.round(y) });
            }
        }
        return actions;
    }

    generateBtn.addEventListener('click', () => {
        if (document.body.classList.contains('panic-mode-active')) return;
        
        let targetDurationMs = parseInt(durSlider.value, 10) * 60 * 1000;
        if (isNaN(targetDurationMs) || targetDurationMs <= 0) {
            if (window.videoPlayer && window.videoPlayer.duration && !isNaN(window.videoPlayer.duration)) {
                targetDurationMs = window.videoPlayer.duration * 1000;
            } else {
                targetDurationMs = 3 * 60 * 1000; 
            }
        }

        const originalText = generateBtn.innerText;
        generateBtn.innerText = "🧠 Pensando y Generando...";
        generateBtn.disabled = true;

        setTimeout(() => {
            try {
                if (typeof window.saveHistoryState === 'function') window.saveHistoryState();
                
                // Extraer base de hardware para el filtro de seguridad
                const device = window.hardwareDB[window.activeDevice || 'handy_std'];
                let hwMax = device.standard.max;
                let hwMin = device.standard.min;
                if (device.supports_overclock && window.isOverclockEnabled && device.overclock) {
                    hwMax = device.overclock.max;
                    hwMin = device.overclock.min;
                }

                let newActions = [];
                let currentTimeMs = 0;
                
                const speedPref = speedSelect.value;
                const staminaPref = staminaSelect.value;
                const promptTags = parsePromptTags(promptInput.value);
                
                let failSafe = 0; 
                let intenseRatio = staminaPref === 'high' ? 0.8 : (staminaPref === 'low' ? 0.3 : 0.6);

                while (currentTimeMs < targetDurationMs && failSafe < 1000) {
                    failSafe++;
                    
                    let isIntensePhase = Math.random() < intenseRatio;
                    let blockSpeed = speedPref;
                    if (speedPref === 'random') {
                        const speeds = ['slow', 'medium', 'fast', 'very_fast'];
                        blockSpeed = isIntensePhase ? speeds[Math.floor(Math.random()*2) + 2] : speeds[Math.floor(Math.random()*2)];
                    }

                    let blockAction = promptTags[Math.floor(Math.random() * promptTags.length)];
                    if (!isIntensePhase && staminaPref === 'low') blockAction = 'tease';
                    
                    let blockDurationMs = 10000 + Math.random() * 15000;
                    if (blockAction === 'edging') blockDurationMs = 8000; 
                    
                    let blockActions = [];
                    
                    try {
                        let presetList = window.presetsLibrary || window.customPresets || [];
                        if (presetList.length > 0 && Math.random() > 0.4) {
                            let randPreset = presetList[Math.floor(Math.random() * presetList.length)];
                            let pActions = randPreset.actions || randPreset.points || randPreset.data || randPreset;
                            if (Array.isArray(pActions) && pActions.length > 1) {
                                blockActions = mutatePreset(pActions, blockAction);
                            }
                        }
                    } catch (e) {
                        console.warn("Fallo procedural, generando desde cero.");
                    }

                    if (!blockActions || blockActions.length < 2) {
                        blockActions = generateProceduralBlock(blockAction, blockDurationMs, blockSpeed);
                    }

                    let pDur = blockActions[blockActions.length - 1].at;
                    if (isNaN(pDur) || pDur <= 0) pDur = 1000; 
                    
                    let timeMultiplier = blockDurationMs / pDur; 

                    if (newActions.length > 0) {
                        let lastPos = newActions[newActions.length - 1].pos;
                        let firstNewPos = blockActions[0].pos;
                        if (Math.abs(lastPos - firstNewPos) > 15) {
                            currentTimeMs += 400 + Math.random() * 300; // Transición orgánica de pausa
                            newActions.push({ at: Math.round(currentTimeMs), pos: firstNewPos });
                        }
                    }

                    for (let act of blockActions) {
                        let injPos = Math.max(0, Math.min(100, Math.round(act.pos / 5) * 5));
                        let injAt = Math.round(currentTimeMs + (act.at * timeMultiplier));
                        
                        if (newActions.length > 0 && injAt <= newActions[newActions.length-1].at) continue; 
                        
                        if (injAt <= targetDurationMs) {
                            newActions.push({ at: injAt, pos: injPos, selected: false });
                        }
                    }
                    
                    currentTimeMs += blockDurationMs;

                    if (blockAction === 'edging') {
                        currentTimeMs += 3500 + Math.random() * 2000; // Descanso post-edging aleatorio
                        newActions.push({ at: Math.round(currentTimeMs), pos: 0 }); 
                    }
                }

                if (newActions.length > 0) {
                    // 🎯 FIX: Pasar el guion por el Escudo de Hardware antes de inyectarlo
                    newActions = enforceHardwareLimits(newActions, hwMax, hwMin, device.factor);

                    if (!window.funscriptActions) window.funscriptActions = [];
                    window.funscriptActions.splice(0, window.funscriptActions.length, ...newActions);
                    
                    if (typeof window.cleanDuplicates === 'function') window.cleanDuplicates();
                    if (typeof window.notifyCloud === 'function') window.notifyCloud();
                    if (typeof window.updateHeatmapAndStats === 'function') window.updateHeatmapAndStats();
                    if (typeof window.drawTimeline === 'function') window.drawTimeline();
                }

            } catch (error) {
                console.error("Error fatal en el núcleo de la IA:", error);
                alert("La IA encontró un script corrupto. Limpia tu línea de tiempo e inténtalo de nuevo.");
            } finally {
                generateBtn.innerText = originalText;
                generateBtn.disabled = false;
                if (typeof window.setActualTimeMs === 'function') {
                    window.setActualTimeMs(0);
                    window.dispatchEvent(new Event('forceTimelinePan'));
                }
            }
        }, 300); 
    });
});

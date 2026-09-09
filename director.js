// ==========================================================================
// IA DIRECTOR V1.7.0 (MOTOR BIOMECÁNICO, CERO ROJOS Y SWING HUMANO)
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

    // 🎯 ESCUDO ABSOLUTO DE HARDWARE: Fuerza el patrón a los límites matemáticos del dispositivo
    function enforceHardwareLimits(actions, hwMax, hwMin, factor) {
        let snap = window.snapValue || 5;
        let shiftAccumulator = 0;
        
        for (let i = 1; i < actions.length; i++) {
            actions[i].at += shiftAccumulator;
            
            let act1 = actions[i-1];
            let act2 = actions[i];
            
            let dt_ms = act2.at - act1.at;
            if (dt_ms < 15) { 
                let fix = 15 - dt_ms;
                act2.at += fix;
                shiftAccumulator += fix;
                dt_ms = 15; 
            }
            
            let dp = Math.abs(act2.pos - act1.pos);
            let speed = dt_ms > 0 ? ((dp * factor) / (dt_ms / 1000.0)) : 9999;
            
            // Si es ROJO (Excede capacidad) -> Retrasa el tiempo forzosamente
            if (speed > hwMax) {
                let required_dt_s = (dp * factor) / (hwMax * 0.92); // 92% para dejar un margen verde seguro
                let needed_dt_ms = Math.round(required_dt_s * 1000);
                let fix = needed_dt_ms - dt_ms;
                act2.at += fix;
                shiftAccumulator += fix;
            } 
            // Si es AMARILLO (Muy lento para el motor) -> Aplana el movimiento o roba tiempo
            else if (speed < hwMin && dp > 0) {
                if (dp <= 10) {
                    act2.pos = act1.pos; // Se aplana a un "Hold" natural
                } else {
                    let required_dt_s = (dp * factor) / (hwMin * 1.05);
                    let needed_dt_ms = Math.round(required_dt_s * 1000);
                    if (needed_dt_ms >= 15) {
                        let fix = dt_ms - needed_dt_ms;
                        act2.at -= fix; // Acelera el punto tirando hacia atrás
                        shiftAccumulator -= fix;
                    } else {
                        act2.pos = act1.pos;
                    }
                }
            }
            act2.pos = Math.max(0, Math.min(100, Math.round(act2.pos / snap) * snap));
        }
        return actions;
    }

    function calculatePresetSpeed(actions) {
        if (!actions || actions.length < 2) return 0;
        let totalSpeed = 0; let validSegments = 0;
        for (let i = 1; i < actions.length; i++) {
            let dt = (actions[i].at - actions[i-1].at) / 1000.0;
            let dp = Math.abs(actions[i].pos - actions[i-1].pos);
            if (dt > 0) { totalSpeed += (dp / dt); validSegments++; }
        }
        return validSegments > 0 ? (totalSpeed / validSegments) : 0;
    }

    // 🎯 MOTOR PROCEDURAL "GROOVE": Simula coreografías humanas
    function generateOrganicBlock(mode, durationMs, targetFapTap, hwMaxFapTap, hwMinFapTap) {
        let actions = [];
        let t = 0;
        let isPeak = true;
        let lastPos = 0;
        
        actions.push({ at: 0, pos: 0 });

        let strokeCount = 0;
        const subPatterns = ['steady', 'stutter', 'wave'];
        let currentPattern = subPatterns[0];
        let patternStrokesLeft = 0;

        while (t < durationMs) {
            strokeCount++;
            
            // Cambiar de estilo de movimiento cada ciertos trazos
            if (patternStrokesLeft <= 0) {
                currentPattern = subPatterns[Math.floor(Math.random() * subPatterns.length)];
                patternStrokesLeft = 3 + Math.floor(Math.random() * 5); // Dura entre 3 y 7 trazos
            }
            patternStrokesLeft--;

            // Ajuste de velocidad según la intensidad elegida y el hardware
            let currentFapTap = targetFapTap;
            let speedMod = 1.0;
            let depthMod = 1.0;

            if (currentPattern === 'wave') {
                // Oscila arriba y abajo como el mar
                speedMod = 0.7 + Math.sin(strokeCount * 0.8) * 0.4;
                depthMod = 0.5 + Math.abs(Math.sin(strokeCount * 0.8)) * 0.5;
            } else if (currentPattern === 'stutter') {
                // Combos de 2 cortos rápidos y 1 profundo
                if (strokeCount % 3 === 0) { speedMod = 0.7; depthMod = 1.0; } // Profundo
                else { speedMod = 1.3; depthMod = 0.3; } // Cortos
            } else {
                // Movimiento firme con micro-variaciones
                speedMod = 0.9 + Math.random() * 0.2;
                depthMod = 0.8 + Math.random() * 0.2;
            }

            currentFapTap *= speedMod;
            // ¡Clave! Bloquea la velocidad al límite del hardware para evitar ROJOS
            currentFapTap = Math.max(hwMinFapTap * 1.2, Math.min(currentFapTap, hwMaxFapTap * 0.90));

            // Profundidad según el estilo del prompt
            if (mode === 'tease') depthMod *= 0.3;
            else if (mode === 'oral') depthMod = Math.max(0.4, depthMod * 0.8);
            
            let y = 0;
            if (mode === 'oral') y = isPeak ? 100 : (100 - (100 * depthMod)); 
            else if (mode === 'ride') y = isPeak ? (100 * depthMod) : 0; 
            else if (mode === 'tease') y = isPeak ? (30 + 30 * depthMod) : (30 - 20 * depthMod);
            else y = isPeak ? (80 * depthMod + 20) : (20 * (1 - depthMod)); 

            // Patrón Edging: Sube la velocidad drásticamente y luego pausa
            if (mode === 'edging') {
                let progress = t / durationMs;
                currentFapTap = targetFapTap * (1 + progress * 1.5); 
                currentFapTap = Math.max(hwMinFapTap * 1.2, Math.min(currentFapTap, hwMaxFapTap * 0.95));
                y = isPeak ? 100 : 0;
            }

            let dp = Math.abs(y - lastPos);
            
            // Convertir la distancia y la velocidad FapTap en Milisegundos reales
            let dt_ms = 250; 
            if (currentFapTap > 0 && dp > 0) {
                dt_ms = (dp / currentFapTap) * 1000;
            }

            t += dt_ms;
            
            if (mode === 'edging' && t >= durationMs - 1500) {
                actions.push({ at: Math.round(t), pos: 100 });
                actions.push({ at: Math.round(t + 2500), pos: 0 }); // Frenazo dramático
                break;
            } else if (t < durationMs) {
                actions.push({ at: Math.round(t), pos: Math.round(y) });
            }

            lastPos = y;
            isPeak = !isPeak;
        }

        return actions;
    }

    // Mutador orgánico para presets guardados (Ajusta el tiempo al FapTap objetivo)
    function mutatePreset(presetActions, mode, targetFapTap, hwMaxFapTap, hwMinFapTap) {
        if (!presetActions || !Array.isArray(presetActions) || presetActions.length < 2) return [];
        let mutated = [];
        
        let originalFapTap = calculatePresetSpeed(presetActions);
        let timeRatio = 1.0;
        if (originalFapTap > 0 && targetFapTap > 0) {
            timeRatio = originalFapTap / targetFapTap; 
        }

        let scale = 1.0; let offset = 0;
        if (mode === 'oral') { scale = 0.5 + Math.random() * 0.3; offset = Math.random() > 0.5 ? (100 - scale*100) : 0; } 
        else if (mode === 'ride') { scale = 0.9 + Math.random() * 0.1; offset = 0; } 
        else if (mode === 'tease') { scale = 0.2 + Math.random() * 0.1; offset = Math.random() * 60; }

        for (let i = 0; i < presetActions.length; i++) {
            let act = presetActions[i];
            
            let humanPos = (Math.random() * 2 - 1) * 3; 
            let rawPos = (act.pos * scale) + offset + humanPos;
            let finalPos = Math.max(0, Math.min(100, Math.round(rawPos / 5) * 5));
            
            let finalTime = Math.max(0, Math.round(act.at * timeRatio));
            mutated.push({ at: finalTime, pos: finalPos });
        }
        return mutated;
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
                
                // Mapeo de Hardware
                const device = window.hardwareDB[window.activeDevice || 'handy_std'];
                let hwMax = device.standard.max;
                let hwMin = device.standard.min;
                if (device.supports_overclock && window.isOverclockEnabled && device.overclock) {
                    hwMax = device.overclock.max;
                    hwMin = device.overclock.min;
                }
                
                let hwMaxFapTap = hwMax / device.factor;
                let hwMinFapTap = hwMin / device.factor;

                let newActions = [];
                let currentTimeMs = 0;
                
                const speedPref = speedSelect.value;
                const staminaPref = staminaSelect.value;
                const promptTags = parsePromptTags(promptInput.value);
                
                let failSafe = 0; 
                let intenseRatio = staminaPref === 'high' ? 0.8 : (staminaPref === 'low' ? 0.35 : 0.6);

                while (currentTimeMs < targetDurationMs && failSafe < 1000) {
                    failSafe++;
                    
                    let isIntensePhase = Math.random() < intenseRatio;
                    let blockSpeed = speedPref;
                    if (speedPref === 'random') {
                        const speeds = ['slow', 'medium', 'fast', 'very_fast'];
                        blockSpeed = isIntensePhase ? speeds[Math.floor(Math.random()*2) + 2] : speeds[Math.floor(Math.random()*2)];
                    }

                    // Definimos el Target FapTap Matemático (Clave para conectar intensidad y hardware)
                    let targetFapTap = 100;
                    if (blockSpeed === 'slow') targetFapTap = 80 + Math.random() * 40;
                    else if (blockSpeed === 'medium') targetFapTap = 170 + Math.random() * 80;
                    else if (blockSpeed === 'fast') targetFapTap = 320 + Math.random() * 80;
                    else targetFapTap = 500 + Math.random() * 150; 
                    
                    // Bloqueamos la petición humana a la realidad de la máquina
                    targetFapTap = Math.max(hwMinFapTap * 1.15, Math.min(targetFapTap, hwMaxFapTap * 0.90));

                    let blockAction = promptTags[Math.floor(Math.random() * promptTags.length)];
                    if (!isIntensePhase && staminaPref === 'low') blockAction = 'tease';
                    
                    let blockDurationMs = 12000 + Math.random() * 20000;
                    if (blockAction === 'edging') blockDurationMs = 9000; 
                    
                    let blockActions = [];
                    
                    try {
                        let presetList = window.presetsLibrary || window.customPresets || [];
                        if (presetList.length > 0 && Math.random() > 0.4) {
                            let randPreset = presetList[Math.floor(Math.random() * presetList.length)];
                            let pActions = randPreset.actions || randPreset.points || randPreset.data || randPreset;
                            if (Array.isArray(pActions) && pActions.length > 1) {
                                blockActions = mutatePreset(pActions, blockAction, targetFapTap, hwMaxFapTap, hwMinFapTap);
                            }
                        }
                    } catch (e) {
                        console.warn("Fallo procedural, generando desde cero.");
                    }

                    if (!blockActions || blockActions.length < 2) {
                        blockActions = generateOrganicBlock(blockAction, blockDurationMs, targetFapTap, hwMaxFapTap, hwMinFapTap);
                    }

                    let pDur = blockActions[blockActions.length - 1].at;
                    if (isNaN(pDur) || pDur <= 0) pDur = 1000; 
                    
                    // Solo multiplicamos si usamos un preset mutado, los orgánicos ya vienen con duración correcta
                    let timeMultiplier = (blockActions === arguments[0] /*si es preset*/) ? (blockDurationMs / pDur) : 1.0; 

                    if (newActions.length > 0) {
                        let lastPos = newActions[newActions.length - 1].pos;
                        let firstNewPos = blockActions[0].pos;
                        if (Math.abs(lastPos - firstNewPos) > 10) {
                            currentTimeMs += 600 + Math.random() * 400; // Transición humana entre posturas
                            newActions.push({ at: Math.round(currentTimeMs), pos: firstNewPos });
                        }
                    }

                    for (let act of blockActions) {
                        let injAt = Math.round(currentTimeMs + (act.at * timeMultiplier));
                        if (newActions.length > 0 && injAt <= newActions[newActions.length-1].at) continue; 
                        if (injAt <= targetDurationMs) {
                            newActions.push({ at: injAt, pos: act.pos, selected: false });
                        }
                    }
                    
                    currentTimeMs += (blockActions === arguments[0]) ? blockDurationMs : pDur;

                    if (blockAction === 'edging') {
                        currentTimeMs += 4000 + Math.random() * 3000; // Descanso de aguante
                        newActions.push({ at: Math.round(currentTimeMs), pos: 0 }); 
                    }
                }

                if (newActions.length > 0) {
                    // 🎯 FILTRO FINAL ABSOLUTO
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

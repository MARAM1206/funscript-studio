// ==========================================================================
// IA DIRECTOR V1.9.0 (MOTOR DE MICRO-GESTOS, STUTTERS, GRINDS Y VIBRACIONES)
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

    function getHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) / 2147483647; 
    }

    function parsePromptTags(text) {
        let tags = [];
        if (!text) return ['mix'];
        
        const lower = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
        
        if (lower.match(/(blowjob|oral|garganta|boca|mamada|deepthroat|bj|chupada|head|throat)/)) tags.push('oral');
        if (lower.match(/(senton|sentones|cowgirl|cabalgar|ride|riding|bounc|rebot|aplastar|squat)/)) tags.push('ride');
        if (lower.match(/(edging|borde|paron|stop|frenar|pausa|hold|negar|denial|ruin)/)) tags.push('edging');
        if (lower.match(/(tease|roce|suave|lento|frot|rub|estimular|caricia)/)) tags.push('tease');
        if (lower.match(/(duro|jackhammer|pound|martillo|destrozar|romper|fuerte|hard|destroy)/)) tags.push('pound');
        if (lower.match(/(misionero|missionary|normal|vanilla|empuje|thrust)/)) tags.push('missionary');

        const words = lower.split(/\s+/);
        const stopWords = ['y','con','el','la','de','a','en','un','una','the','with','and','in','on','to','for','is','at','my','luego','despues','termina'];
        
        words.forEach(w => {
            if (w.length > 3 && !stopWords.includes(w)) {
                let isKnown = /(blowjob|oral|garganta|boca|mamada|deepthroat|bj|chupada|head|throat|senton|sentones|cowgirl|cabalgar|ride|riding|bounc|rebot|aplastar|squat|edging|borde|paron|stop|frenar|pausa|hold|negar|denial|ruin|tease|roce|suave|lento|frot|rub|estimular|caricia|duro|jackhammer|pound|martillo|destrozar|romper|fuerte|hard|destroy|misionero|missionary|normal|vanilla|empuje|thrust)/.test(w);
                if(!isKnown) tags.push('custom_' + w);
            }
        });

        if (tags.length === 0) tags = ['mix'];
        return tags;
    }

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
            
            if (speed > hwMax) {
                let required_dt_s = (dp * factor) / (hwMax * 0.92); 
                let needed_dt_ms = Math.round(required_dt_s * 1000);
                let fix = needed_dt_ms - dt_ms;
                act2.at += fix;
                shiftAccumulator += fix;
            } 
            else if (speed < hwMin && dp > 0) {
                // 🎯 FIX: Cambiamos 10 por 4. Esto permite que las micro-vibraciones sobrevivan sin ser borradas.
                if (dp <= 4) {
                    act2.pos = act1.pos; 
                } else {
                    let required_dt_s = (dp * factor) / (hwMin * 1.05);
                    let needed_dt_ms = Math.round(required_dt_s * 1000);
                    if (needed_dt_ms >= 15) {
                        let fix = dt_ms - needed_dt_ms;
                        act2.at -= fix; 
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

    // 🎯 FIX: Inyección de Micro-Gestos a los presets que ya tienes guardados
    function mutatePreset(presetActions, mode, targetFapTap, hwMaxFapTap, hwMinFapTap) {
        if (!presetActions || !Array.isArray(presetActions) || presetActions.length < 2) return [];
        let mutated = [];
        
        let originalFapTap = calculatePresetSpeed(presetActions);
        let timeRatio = 1.0;
        if (originalFapTap > 0 && targetFapTap > 0) timeRatio = originalFapTap / targetFapTap; 

        let scale = 1.0; let offset = 0;
        
        if (mode === 'oral') { scale = 0.4 + Math.random() * 0.4; offset = Math.random() > 0.5 ? (100 - scale*100) : 0; } 
        else if (mode === 'ride') { scale = 0.9 + Math.random() * 0.1; offset = 0; } 
        else if (mode === 'tease') { scale = 0.15 + Math.random() * 0.15; offset = Math.random() * 70; }
        else if (mode === 'pound') { scale = 0.8 + Math.random() * 0.2; offset = 0; }
        else if (mode === 'missionary') { scale = 0.6 + Math.random() * 0.3; offset = Math.random() * 20; }
        else if (mode.startsWith('custom_')) {
            let hash = getHash(mode);
            scale = 0.3 + (hash * 0.6); 
            offset = (hash > 0.5) ? (100 - scale*100) * hash : 0; 
        }

        for (let i = 0; i < presetActions.length; i++) {
            let act = presetActions[i];
            let humanPos = (Math.random() * 2 - 1) * 4; 
            let rawPos = (act.pos * scale) + offset + humanPos;
            let finalPos = Math.max(0, Math.min(100, Math.round(rawPos / 5) * 5));
            let finalTime = Math.max(0, Math.round(act.at * timeRatio));

            // Si el trazo es lo suficientemente largo, inyectamos un tartamudeo natural
            if (i > 0 && Math.random() > 0.65) {
                let prevT = mutated[mutated.length - 1].at;
                let prevP = mutated[mutated.length - 1].pos;
                let dt = finalTime - prevT;
                let dp = Math.abs(finalPos - prevP);
                if (dt > 160 && dp > 25) {
                    let dir = finalPos >= prevP ? 1 : -1;
                    mutated.push({ at: Math.round(prevT + dt * 0.6), pos: Math.round(prevP + dir * dp * 0.7) });
                    mutated.push({ at: Math.round(prevT + dt * 0.8), pos: Math.round(prevP + dir * dp * 0.5) });
                }
            }

            mutated.push({ at: finalTime, pos: finalPos });
        }
        return mutated;
    }

    // 🎯 FIX: GENERADOR PROCEDURAL BASADO EN GESTOS COMPLEJOS, NO EN TRIÁNGULOS
    function generateOrganicBlock(mode, durationMs, targetFapTap, hwMaxFapTap, hwMinFapTap) {
        let actions = [];
        let t = 0;
        let isPeak = true;
        let lastPos = 0;
        
        actions.push({ at: 0, pos: 0 });

        let strokeCount = 0;
        
        // Seleccionamos los estilos permitidos según la acción pedida
        let subPatterns = ['steady', 'stutter', 'wave', 'vibrate', 'grind'];
        if (mode === 'oral') subPatterns = ['steady', 'vibrate', 'vibrate', 'grind', 'stutter'];
        else if (mode === 'tease') subPatterns = ['vibrate', 'grind', 'steady'];
        else if (mode === 'pound' || mode === 'ride') subPatterns = ['steady', 'steady', 'grind', 'stutter'];

        let currentPattern = subPatterns[0];
        let patternStrokesLeft = 0;

        let customHash = 0.5;
        if (mode.startsWith('custom_')) customHash = getHash(mode);

        while (t < durationMs) {
            strokeCount++;
            
            if (patternStrokesLeft <= 0) {
                currentPattern = subPatterns[Math.floor(Math.random() * subPatterns.length)];
                patternStrokesLeft = 2 + Math.floor(Math.random() * 4); 
            }
            patternStrokesLeft--;

            let currentFapTap = targetFapTap;
            let speedMod = 1.0; let depthMod = 1.0;

            if (currentPattern === 'wave') {
                speedMod = 0.7 + Math.sin(strokeCount * 0.8) * 0.4;
                depthMod = 0.5 + Math.abs(Math.sin(strokeCount * 0.8)) * 0.5;
            } else if (currentPattern === 'stutter' || currentPattern === 'vibrate') {
                speedMod = 0.8; depthMod = 1.0; 
            } else {
                speedMod = 0.9 + Math.random() * 0.2;
                depthMod = 0.8 + Math.random() * 0.2;
            }

            currentFapTap *= speedMod;
            currentFapTap = Math.max(hwMinFapTap * 1.2, Math.min(currentFapTap, hwMaxFapTap * 0.90));

            let y = 0;
            if (mode === 'tease') depthMod *= 0.25;
            else if (mode === 'oral') depthMod = Math.max(0.4, depthMod * 0.8);
            else if (mode === 'pound') depthMod = Math.max(0.8, depthMod);

            if (mode === 'oral') y = isPeak ? 100 : (100 - (100 * depthMod)); 
            else if (mode === 'ride' || mode === 'pound') y = isPeak ? (100 * depthMod) : 0; 
            else if (mode === 'tease') y = isPeak ? (30 + 30 * depthMod) : (30 - 20 * depthMod);
            else if (mode === 'missionary') y = isPeak ? (80 * depthMod + 10) : (10 * (1 - depthMod)); 
            else if (mode.startsWith('custom_')) {
                depthMod = 0.4 + (customHash * 0.6);
                if (customHash > 0.6) y = isPeak ? 100 : (100 - (100 * depthMod)); 
                else if (customHash < 0.3) y = isPeak ? (100 * depthMod) : 0;
                else y = isPeak ? (50 + 50 * depthMod) : (50 - 50 * depthMod); 
            }
            else y = isPeak ? (80 * depthMod + 20) : (20 * (1 - depthMod)); 

            let dp = Math.abs(y - lastPos);
            let dt_ms = 250; 
            if (currentFapTap > 0 && dp > 0) dt_ms = (dp / currentFapTap) * 1000;

            // 🎯 INYECCIÓN DE GESTOS COMPLEJOS EN LUGAR DE TRIÁNGULOS
            let lastTime = t;
            t += dt_ms;
            let strokeDur = t - lastTime;
            let dir = y >= lastPos ? 1 : -1;

            if (mode === 'edging' && t >= durationMs - 1500) {
                actions.push({ at: Math.round(t), pos: 100 });
                actions.push({ at: Math.round(t + 2500), pos: 0 }); 
                break;
            } 
            else if (t < durationMs) {
                // Gesto: Tartamudeo (Doble Empuje)
                if (currentPattern === 'stutter' && dp > 25 && strokeDur > 150) {
                    actions.push({ at: Math.round(lastTime + strokeDur * 0.4), pos: Math.round(lastPos + dir * dp * 0.7) });
                    actions.push({ at: Math.round(lastTime + strokeDur * 0.6), pos: Math.round(lastPos + dir * dp * 0.5) });
                    actions.push({ at: Math.round(t), pos: Math.round(y) });
                } 
                // Gesto: Vibración Rápida
                else if (currentPattern === 'vibrate' && dp > 15 && strokeDur > 200) {
                    actions.push({ at: Math.round(lastTime + strokeDur * 0.3), pos: Math.round(lastPos + dir * dp * 0.8) });
                    actions.push({ at: Math.round(lastTime + strokeDur * 0.5), pos: Math.round(lastPos + dir * dp * 0.6) });
                    actions.push({ at: Math.round(lastTime + strokeDur * 0.75), pos: Math.round(y + dir * 5) });
                    actions.push({ at: Math.round(t), pos: Math.round(y) });
                } 
                // Gesto: Frote / Grind
                else if (currentPattern === 'grind' && strokeDur > 120) {
                    actions.push({ at: Math.round(lastTime + strokeDur * 0.6), pos: Math.round(lastPos + dir * dp * 0.9) });
                    actions.push({ at: Math.round(lastTime + strokeDur * 0.8), pos: Math.round(lastPos + dir * dp * 0.8) });
                    actions.push({ at: Math.round(t), pos: Math.round(y) });
                } 
                // Gesto: Trazo normal / Ola
                else {
                    actions.push({ at: Math.round(t), pos: Math.round(y) });
                }
            }

            lastPos = y;
            isPeak = !isPeak;
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

                    let targetFapTap = 100;
                    if (blockSpeed === 'slow') targetFapTap = 80 + Math.random() * 40;
                    else if (blockSpeed === 'medium') targetFapTap = 170 + Math.random() * 80;
                    else if (blockSpeed === 'fast') targetFapTap = 320 + Math.random() * 80;
                    else targetFapTap = 500 + Math.random() * 150; 
                    
                    targetFapTap = Math.max(hwMinFapTap * 1.15, Math.min(targetFapTap, hwMaxFapTap * 0.90));

                    let blockAction = promptTags[Math.floor(Math.random() * promptTags.length)];
                    if (!isIntensePhase && staminaPref === 'low') blockAction = 'tease';
                    
                    let blockDurationMs = 12000 + Math.random() * 20000;
                    if (blockAction === 'edging') blockDurationMs = 9000; 
                    
                    let blockActions = [];
                    let isPreset = false; 
                    
                    try {
                        let presetList = window.presetsLibrary || window.customPresets || [];
                        if (presetList.length > 0 && Math.random() > 0.4) {
                            let randPreset = presetList[Math.floor(Math.random() * presetList.length)];
                            let pActions = randPreset.actions || randPreset.points || randPreset.data || randPreset;
                            if (Array.isArray(pActions) && pActions.length > 1) {
                                blockActions = mutatePreset(pActions, blockAction, targetFapTap, hwMaxFapTap, hwMinFapTap);
                                isPreset = true; 
                            }
                        }
                    } catch (e) {
                        console.warn("Fallo procedural, generando desde cero.");
                    }

                    if (!blockActions || blockActions.length < 2) {
                        blockActions = generateOrganicBlock(blockAction, blockDurationMs, targetFapTap, hwMaxFapTap, hwMinFapTap);
                        isPreset = false;
                    }

                    let pDur = blockActions[blockActions.length - 1].at;
                    if (isNaN(pDur) || pDur <= 0) pDur = 1000; 
                    
                    let timeMultiplier = isPreset ? (blockDurationMs / pDur) : 1.0; 

                    if (newActions.length > 0) {
                        let lastPos = newActions[newActions.length - 1].pos;
                        let firstNewPos = blockActions[0].pos;
                        if (Math.abs(lastPos - firstNewPos) > 10) {
                            currentTimeMs += 600 + Math.random() * 400; 
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
                    
                    currentTimeMs += isPreset ? blockDurationMs : pDur;

                    if (blockAction === 'edging') {
                        currentTimeMs += 4000 + Math.random() * 3000; 
                        newActions.push({ at: Math.round(currentTimeMs), pos: 0 }); 
                    }
                }

                if (newActions.length > 0) {
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

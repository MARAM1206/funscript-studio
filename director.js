// ==========================================================================
// IA DIRECTOR V1.6.2 (ESCUDOS ANTI-CRASH MATEMÁTICO)
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

    // 🎯 FIX: Blindaje Matemático contra Arrays vacíos
    function mutatePreset(presetActions, mode) {
        if (!presetActions || !Array.isArray(presetActions) || presetActions.length < 2) return [];
        let mutated = [];
        
        let scale = 1.0; 
        let offset = 0;

        if (mode === 'oral') {
            scale = 0.4 + Math.random() * 0.3; 
            offset = Math.random() > 0.5 ? (100 - scale*100) : 0; 
        } else if (mode === 'ride') {
            scale = 0.9 + Math.random() * 0.1; 
            offset = 0; 
        } else if (mode === 'tease') {
            scale = 0.15 + Math.random() * 0.2; 
            offset = Math.random() * 60; 
        }

        for (let i = 0; i < presetActions.length; i++) {
            let act = presetActions[i];
            let humanPos = (Math.random() * 2 - 1) * 3; 
            let humanTime = (Math.random() * 2 - 1) * 8; 
            
            let rawPos = (act.pos * scale) + offset + humanPos;
            let finalPos = Math.max(0, Math.min(100, Math.round(rawPos / 5) * 5));
            let finalTime = Math.max(0, Math.round(act.at + humanTime));

            if (mode === 'ride' && finalPos <= 10 && Math.random() > 0.7 && i > 0 && mutated.length > 0) {
                let midTime = mutated[mutated.length-1].at + (finalTime - mutated[mutated.length-1].at) / 2;
                mutated.push({ at: Math.round(midTime), pos: 25 }); 
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

        let stepMs = Math.max(50, durationMs / reps); // Seguro contra división por cero

        for (let i = 0; i <= reps; i++) {
            let isPeak = (i % 2 === 0);
            let y = 0;
            
            if (mode === 'oral') y = isPeak ? 100 : (70 + Math.random()*15);
            else if (mode === 'ride') y = isPeak ? (90 + Math.random()*10) : (0 + Math.random()*10);
            else if (mode === 'tease') y = isPeak ? (40 + Math.random()*20) : (20 + Math.random()*15);
            else y = isPeak ? (80 + Math.random()*20) : (0 + Math.random()*20); 

            if (mode === 'edging') {
                let progress = i / reps;
                let currentStep = Math.max(50, stepMs * (1 - (progress * 0.8))); 
                let t = actions.length > 0 ? actions[actions.length-1].at + currentStep : 0;
                
                if (i === reps) {
                    actions.push({ at: Math.round(t), pos: 100 });
                    actions.push({ at: Math.round(t + 200), pos: 0 }); 
                } else {
                    actions.push({ at: Math.round(t), pos: Math.round(y) });
                }
            } else {
                actions.push({ at: Math.round(i * stepMs), pos: Math.round(y) });
            }
        }
        return actions;
    }

    generateBtn.addEventListener('click', () => {
        if (document.body.classList.contains('panic-mode-active')) return;
        
        let targetDurationMs = parseInt(durSlider.value, 10) * 60 * 1000;
        
        // 🎯 FIX: Rescate Matemático de la duración
        if (isNaN(targetDurationMs) || targetDurationMs <= 0) {
            if (window.videoPlayer && window.videoPlayer.duration && !isNaN(window.videoPlayer.duration)) {
                targetDurationMs = window.videoPlayer.duration * 1000;
            } else {
                targetDurationMs = 3 * 60 * 1000; // 3 Minutos por defecto si falla todo
            }
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
                    
                    // 🎯 FIX: Extracción Super Segura de Presets (Evita Arrays vacíos o corruptos)
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
                        console.warn("Fallo al mutar el preset guardado, usando generación procedural.", e);
                    }

                    // Si el preset falló o estaba vacío, entra el motor procedural al rescate
                    if (!blockActions || blockActions.length < 2) {
                        blockActions = generateProceduralBlock(blockAction, blockDurationMs, blockSpeed);
                    }

                    let pDur = blockActions[blockActions.length - 1].at;
                    if (isNaN(pDur) || pDur <= 0) pDur = 1000; // 🎯 FIX: Anti-división por cero
                    
                    let timeMultiplier = blockDurationMs / pDur; 

                    if (newActions.length > 0) {
                        let lastPos = newActions[newActions.length - 1].pos;
                        let firstNewPos = blockActions[0].pos;
                        if (Math.abs(lastPos - firstNewPos) > 15) {
                            currentTimeMs += 500; 
                            newActions.push({ at: Math.round(currentTimeMs), pos: firstNewPos });
                        }
                    }

                    for (let act of blockActions) {
                        let humanTime = (Math.random() * 2 - 1) * 8; 
                        let injPos = Math.max(0, Math.min(100, Math.round(act.pos / 5) * 5));
                        let injAt = Math.round(currentTimeMs + (act.at * timeMultiplier) + humanTime);
                        
                        if (newActions.length > 0 && injAt <= newActions[newActions.length-1].at) continue; 
                        
                        if (injAt <= targetDurationMs) {
                            newActions.push({ at: injAt, pos: injPos, selected: false });
                        }
                    }
                    
                    currentTimeMs += blockDurationMs;

                    if (blockAction === 'edging') {
                        currentTimeMs += 4000;
                        newActions.push({ at: Math.round(currentTimeMs), pos: 0 }); 
                    }
                }

                if (newActions.length > 0) {
                    if (!window.funscriptActions) window.funscriptActions = [];
                    window.funscriptActions.splice(0, window.funscriptActions.length, ...newActions);
                    
                    if (typeof window.cleanDuplicates === 'function') window.cleanDuplicates();
                    if (typeof window.notifyCloud === 'function') window.notifyCloud();
                    if (typeof window.updateHeatmapAndStats === 'function') window.updateHeatmapAndStats();
                    if (typeof window.drawTimeline === 'function') window.drawTimeline();
                }

            } catch (error) {
                console.error("Error fatal en el núcleo de la IA:", error);
                alert("La IA encontró un script corrupto y activó el protocolo de emergencia. Limpia tu línea de tiempo e inténtalo de nuevo.");
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

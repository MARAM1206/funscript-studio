// ==========================================
// MOTOR ADAPTATIVO V40.0: SUSTITUCIÓN PURA
// ==========================================
function applyPresetToSelection(presetPoints, selectedPoints) {
    if (!selectedPoints || selectedPoints.length < 2) return;
    
    // 1. Identificar el rango exacto de la selección original (Ej. la "M")
    let startTime = selectedPoints[0].time;
    let endTime = selectedPoints[selectedPoints.length - 1].time;
    let targetDuration = endTime - startTime;
    
    // 2. Destrucción Inteligente: Eliminar TODOS los puntos en este bloque de tiempo
    window.funscriptActions = window.funscriptActions.filter(
        p => p.time < startTime || p.time > endTime
    );
    
    // 3. Mapear los puntos del Preset (Ej. la "V") al nuevo tamaño de tiempo
    let presetStart = presetPoints[0].time;
    let presetEnd = presetPoints[presetPoints.length - 1].time;
    let presetDuration = presetEnd - presetStart;
    
    let newPoints = presetPoints.map(p => {
        let normalizedTime = (p.time - presetStart) / presetDuration;
        return {
            // Se calcula el nuevo tiempo exacto proporcional
            time: Math.round((startTime + (normalizedTime * targetDuration)) * 100) / 100,
            // La altura del preset se respeta al 100%
            pos: p.pos 
        };
    });
    
    // 4. Inyectar la figura pura y fusionar
    window.funscriptActions.push(...newPoints);
    
    // 5. Ordenar cronológicamente y limpiar memoria
    window.funscriptActions.sort((a, b) => a.time - b.time);
    window.saveHistoryState();
    window.renderTimeline();
}

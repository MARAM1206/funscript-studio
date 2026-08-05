// ==========================================
// ARCHIVO COMPLETO: timeline.js (V40.0)
// ==========================================

// Variables Globales de la Línea de Tiempo Principal
window.funscriptActions = window.funscriptActions || [];
window.timelineHistory = [];
window.timelineMaxTime = 100; // Segundos (ajustable según tu video)
window.currentTime = 0; // Posición de la línea naranja (Playhead)

// Guardar estado para Ctrl+Z
window.saveHistoryState = function() {
    // Guardamos una copia profunda del estado actual
    window.timelineHistory.push(JSON.parse(JSON.stringify(window.funscriptActions)));
    if (window.timelineHistory.length > 50) {
        window.timelineHistory.shift(); // Limitar a 50 pasos
    }
}

// Función Deshacer (Ctrl+Z)
window.undoTimeline = function() {
    if (window.timelineHistory.length > 1) {
        window.timelineHistory.pop(); // Eliminar estado actual
        window.funscriptActions = JSON.parse(JSON.stringify(window.timelineHistory[window.timelineHistory.length - 1]));
        window.renderTimeline();
    }
}

// ==========================================
// MOTOR ADAPTATIVO: SUSTITUCIÓN PURA
// ==========================================
window.applyPresetToSelection = function(presetPoints, selectedPoints) {
    if (!selectedPoints || selectedPoints.length < 2 || !presetPoints || presetPoints.length === 0) {
        console.warn("Script IA: Selección inválida para aplicar el preset.");
        return;
    }
    
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
        let normalizedTime = presetDuration === 0 ? 0 : (p.time - presetStart) / presetDuration;
        return {
            time: Math.round((startTime + (normalizedTime * targetDuration)) * 100) / 100,
            pos: p.pos 
        };
    });
    
    // 4. Inyectar la figura pura, ordenar y renderizar
    window.funscriptActions.push(...newPoints);
    window.funscriptActions.sort((a, b) => a.time - b.time);
    
    window.saveHistoryState();
    window.renderTimeline();
}

// ==========================================
// MOTOR GRÁFICO: LÍNEA DE TIEMPO PRINCIPAL
// ==========================================
window.renderTimeline = function() {
    const canvas = document.getElementById('timelineCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Limpiar Lienzo
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Dibujar Cuadrícula Horizontal (10% a 100%)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for(let i = 0; i <= 100; i += 10) {
        let y = canvas.height - (i / 100) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    // 2. Dibujar Líneas Conectoras
    ctx.strokeStyle = '#10b981'; // Verde para la línea principal
    ctx.lineWidth = 3;
    ctx.beginPath();
    window.funscriptActions.forEach((p, index) => {
        let x = (p.time / window.timelineMaxTime) * canvas.width;
        let y = canvas.height - (p.pos / 100) * canvas.height;
        if(index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // 3. Dibujar Nodos (Puntos)
    window.funscriptActions.forEach(p => {
        let x = (p.time / window.timelineMaxTime) * canvas.width;
        let y = canvas.height - (p.pos / 100) * canvas.height;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // 4. LÍNEA NARANJA VERTICAL (Playhead exclusivo del Timeline)
    let playheadX = (window.currentTime / window.timelineMaxTime) * canvas.width;
    ctx.strokeStyle = '#f97316'; // Naranja brillante
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, canvas.height);
    ctx.stroke();
}

// Inicialización básica
document.addEventListener('DOMContentLoaded', () => {
    window.renderTimeline();
    window.saveHistoryState();
});

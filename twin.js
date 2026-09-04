// ==========================================================================
// DIGITAL TWIN 3D V1.2.0 (RENDERIZADOR ISOMÉTRICO SIN LIBRERÍAS EXTERNAS)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('twin-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const deviceColors = {
        baseFill: '#1e293b', 
        baseStroke: '#334155',
        sleeveFill: 'rgba(56, 189, 248, 0.8)',
        sleeveStroke: '#0284c7',
        highlight: 'rgba(255, 255, 255, 0.1)'
    };

    function resize() {
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Calcula la posición interpolada exacta en el milisegundo actual
    function getInterpolatedPosition() {
        if (!window.videoPlayer || !window.funscriptActions || window.funscriptActions.length === 0) return 50;
        
        const timeMs = window.videoPlayer.currentTime * 1000;
        const actions = window.funscriptActions;

        if (timeMs <= actions[0].at) return actions[0].pos;
        if (timeMs >= actions[actions.length - 1].at) return actions[actions.length - 1].pos;

        // Búsqueda binaria para velocidad
        let low = 0, high = actions.length - 1;
        while (low <= high) {
            let mid = Math.floor((low + high) / 2);
            if (actions[mid].at === timeMs) return actions[mid].pos;
            if (actions[mid].at < timeMs) low = mid + 1;
            else high = mid - 1;
        }

        const a1 = actions[high];
        const a2 = actions[low];
        
        const progress = (timeMs - a1.at) / (a2.at - a1.at);
        return a1.pos + (a2.pos - a1.pos) * progress;
    }

    // Dibujador de cilindro 2.5D Isométrico
    function drawCylinder(x, y, w, h, fill, stroke) {
        const ovalH = w * 0.25; 
        
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;

        // Base inferior
        ctx.beginPath();
        ctx.ellipse(x, y + h, w / 2, ovalH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cuerpo principal
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y);
        ctx.lineTo(x - w / 2, y + h);
        ctx.lineTo(x + w / 2, y + h);
        ctx.lineTo(x + w / 2, y);
        ctx.fill();

        // Bordes laterales
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y);
        ctx.lineTo(x - w / 2, y + h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w / 2, y + h);
        ctx.stroke();

        // Tapa superior
        ctx.beginPath();
        ctx.ellipse(x, y, w / 2, ovalH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Reflejo cilíndrico (Holograma 3D)
        ctx.fillStyle = deviceColors.highlight;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.2, y + ovalH/4);
        ctx.lineTo(x - w * 0.2, y + h + ovalH/4);
        ctx.lineTo(x, y + h + ovalH/4);
        ctx.lineTo(x, y + ovalH/4);
        ctx.fill();
    }

    function renderLoop() {
        requestAnimationFrame(renderLoop);
        
        // El Pánico detiene el renderizado
        if (document.body.classList.contains('panic-mode-active')) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Variables de escala y perspectiva
        const baseW = Math.min(60, canvas.width * 0.3);
        const baseH = canvas.height * 0.6;
        const baseY = cy - (baseH / 2);

        // 1. Dibujar el aparato (Eje fijo)
        drawCylinder(cx, baseY, baseW, baseH, deviceColors.baseFill, deviceColors.baseStroke);

        // 2. Calcular la posición de la manga (0% a 100%)
        let targetPos = getInterpolatedPosition();
        
        // 3. Dibujar la manga deslizante (Sleeve)
        const sleeveW = baseW * 1.3;
        const sleeveH = baseH * 0.2;
        
        // El 0% es abajo, el 100% es arriba
        const slideRange = baseH - sleeveH;
        const sleeveY = baseY + slideRange - (targetPos / 100) * slideRange;

        // Color reactivo: Pasa a Naranja/Rojo si es muy rápido
        let sFill = deviceColors.sleeveFill;
        let sStroke = deviceColors.sleeveStroke;
        if (targetPos > 90 || targetPos < 10) {
            sFill = 'rgba(249, 115, 22, 0.8)';
            sStroke = '#ea580c';
        }

        drawCylinder(cx, sleeveY, sleeveW, sleeveH, sFill, sStroke);

        // Texto informativo
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Posición: ${Math.round(targetPos)}%`, cx, canvas.height - 15);
    }

    renderLoop();
});

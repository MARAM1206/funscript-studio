// ==========================================================================
// DIGITAL TWIN 3D V1.3.0 (RENDERIZADOR DEL DISPOSITIVO FÍSICO "HANDY")
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('twin-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function getInterpolatedPosition() {
        if (!window.videoPlayer || !window.funscriptActions || window.funscriptActions.length === 0) return 50;
        
        const timeMs = window.videoPlayer.currentTime * 1000;
        const actions = window.funscriptActions;

        if (timeMs <= actions[0].at) return actions[0].pos;
        if (timeMs >= actions[actions.length - 1].at) return actions[actions.length - 1].pos;

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

    function drawCylinder(x, y, w, h, fill, stroke) {
        const ovalH = w * 0.25; 
        
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.ellipse(x, y + h, w / 2, ovalH / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x - w / 2, y);
        ctx.lineTo(x - w / 2, y + h);
        ctx.lineTo(x + w / 2, y + h);
        ctx.lineTo(x + w / 2, y);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y + h); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(x, y, w / 2, ovalH / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        
        // Reflejo
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(x - w * 0.2, y + ovalH/4);
        ctx.lineTo(x - w * 0.2, y + h + ovalH/4);
        ctx.lineTo(x + w * 0.05, y + h + ovalH/4);
        ctx.lineTo(x + w * 0.05, y + ovalH/4);
        ctx.fill();
    }

    function renderLoop() {
        requestAnimationFrame(renderLoop);
        if (document.body.classList.contains('panic-mode-active')) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Eje fijo (El motor del Handy atrás)
        const baseW = 55;
        const baseH = canvas.height * 0.65;
        const baseY = cy - (baseH / 2);

        // Handy Motor Housing (Columna oscura ergonómica)
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cx - baseW/2, baseY, baseW, baseH, 12);
        ctx.fill(); ctx.stroke();
        
        // Riel del Slider (El canal central por donde corre la banda)
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.roundRect(cx - 6, baseY + 15, 12, baseH - 30, 4);
        ctx.fill();

        let targetPos = getInterpolatedPosition();
        
        // The Stroker (Manga principal simulada en rosa/traslúcido)
        const sleeveW = 75;
        const sleeveH = baseH * 0.35;
        const slideRange = baseH - sleeveH - 20; 
        const sleeveY = baseY + 10 + slideRange - (targetPos / 100) * slideRange;

        drawCylinder(cx, sleeveY, sleeveW, sleeveH, 'rgba(244, 114, 182, 0.85)', '#db2777');

        // La Banda tensora del Handy (Azul/Negro que abraza a la manga)
        const strapH = 22;
        const strapY = sleeveY + sleeveH/2 - strapH/2;
        drawCylinder(cx, strapY, sleeveW + 8, strapH, '#0284c7', '#0369a1');

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Pos: ${Math.round(targetPos)}%`, cx, canvas.height - 10);
    }

    renderLoop();
});

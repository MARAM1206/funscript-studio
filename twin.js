// ==========================================================================
// DIGITAL TWIN 3D V1.3.1 (VISTA LATERAL 90° Y SOPORTE DE TEMA CLARO)
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

    function renderLoop() {
        requestAnimationFrame(renderLoop);
        if (document.body.classList.contains('panic-mode-active')) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        const isLight = document.body.classList.contains('light-theme');
        
        // 🎯 FIX: Paleta de colores adaptable al Modo Claro/Oscuro
        const colors = {
            housingBase: isLight ? '#cbd5e1' : '#0f172a',
            rail: isLight ? '#94a3b8' : '#020617',
            sleeve: 'rgba(244, 114, 182, 0.85)',
            sleeveStroke: '#db2777',
            sleeveHighlight: 'rgba(255,255,255,0.4)',
            arm: isLight ? '#0ea5e9' : '#0284c7',
            armDark: isLight ? '#0284c7' : '#0369a1',
            text: isLight ? '#334155' : '#94a3b8'
        };

        const baseH = canvas.height * 0.65;
        const baseY = cy - (baseH / 2);

        // 🎯 FIX: Dibujado en Vista Lateral (90 Grados)
        const hw = 40; 
        const hh = baseH; 
        const hx = cx + 15; 
        
        // Columna principal
        ctx.fillStyle = colors.housingBase;
        ctx.beginPath();
        ctx.roundRect(hx, baseY, hw, hh, 8);
        ctx.fill();

        // Riel mecánico
        const rw = 12;
        const rh = hh - 20;
        const rx = hx - rw - 5;
        const ry = baseY + 10;
        
        ctx.fillStyle = colors.rail;
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, 4);
        ctx.fill();

        let targetPos = getInterpolatedPosition();
        const slideRange = rh - 40; 
        const armY = ry + slideRange - (targetPos / 100) * slideRange;

        // Brazo conector
        ctx.fillStyle = colors.arm;
        ctx.beginPath();
        ctx.roundRect(rx - 10, armY, rw + 20, 30, 4);
        ctx.fill();
        
        // Manga Translúcida
        const sw = 50;
        const sh = 100;
        const sx = rx - sw - 15;
        const sy = armY + 15 - sh/2;

        let sFill = colors.sleeve;
        let sStroke = colors.sleeveStroke;

        if (targetPos > 90 || targetPos < 10) {
            sFill = 'rgba(249, 115, 22, 0.85)';
            sStroke = '#ea580c';
        }

        ctx.fillStyle = sFill;
        ctx.strokeStyle = sStroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 15);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = colors.sleeveHighlight;
        ctx.beginPath();
        ctx.roundRect(sx + 5, sy + 5, 10, sh - 10, 5);
        ctx.fill();

        // Remache del brazo
        ctx.fillStyle = colors.armDark;
        ctx.beginPath();
        ctx.fillRect(rx - 15, armY + 5, 20, 20);

        // Texto informativo
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Pos: ${Math.round(targetPos)}%`, cx, canvas.height - 10);
    }

    renderLoop();
});

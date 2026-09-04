// ==========================================================================
// DIGITAL TWIN 3D V1.3.2 (MANGA TRANSLÚCIDA Y REFERENCIA ANATÓMICA TÉCNICA)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('twin-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 🎯 FIX: Sistema de Toggle para la anatomía
    let showAnatomy = false;
    const anatomyBtn = document.getElementById('twin-anatomy-btn');
    if(anatomyBtn) {
        anatomyBtn.addEventListener('click', () => {
            showAnatomy = !showAnatomy;
            anatomyBtn.style.color = showAnatomy ? '#38bdf8' : '#94a3b8';
        });
    }

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
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(x - w * 0.2, y + ovalH/4);
        ctx.lineTo(x - w * 0.2, y + h + ovalH/4);
        ctx.lineTo(x + w * 0.05, y + h + ovalH/4);
        ctx.lineTo(x + w * 0.05, y + ovalH/4);
        ctx.fill();
    }

    // 🎯 FIX: Dibujado Técnico Anatómico Vectorial (0-20% Base, 20-70% Cuerpo, 70-100% Glande)
    function drawAnatomyBlueprint(cx, cy, topY, bottomY, width) {
        const totalH = bottomY - topY;
        const mark70 = topY + totalH * 0.3; // El 70% está al 30% bajando desde el tope (100%)
        const mark20 = topY + totalH * 0.8; // El 20% está al 80% bajando desde el tope
        
        const isLight = document.body.classList.contains('light-theme');
        ctx.fillStyle = isLight ? '#e2e8f0' : '#1e293b'; // Color neutro interfaz
        ctx.strokeStyle = isLight ? '#94a3b8' : '#475569';
        ctx.lineWidth = 2;

        // Base (0% al 20%)
        ctx.beginPath();
        ctx.moveTo(cx - width/2, mark20);
        ctx.quadraticCurveTo(cx - width*0.8, bottomY, cx, bottomY + 10);
        ctx.quadraticCurveTo(cx + width*0.8, bottomY, cx + width/2, mark20);
        ctx.fill(); ctx.stroke();

        // Cuerpo/Shaft (20% al 70%)
        ctx.beginPath();
        ctx.fillRect(cx - width/2, mark70, width, mark20 - mark70);
        ctx.strokeRect(cx - width/2, mark70, width, mark20 - mark70);

        // Glande (70% al 100%)
        ctx.beginPath();
        ctx.moveTo(cx - width/2 - 3, mark70);
        ctx.bezierCurveTo(cx - width*0.6, topY - 10, cx + width*0.6, topY - 10, cx + width/2 + 3, mark70);
        ctx.quadraticCurveTo(cx, mark70 + 8, cx - width/2 - 3, mark70);
        ctx.fill(); ctx.stroke();
        
        // Líneas punteadas delimitadoras técnicas
        ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.5)' : 'rgba(71, 85, 105, 0.5)';
        ctx.setLineDash([3, 3]);
        
        ctx.beginPath(); ctx.moveTo(cx - width, mark70); ctx.lineTo(cx + width, mark70); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = '9px monospace'; ctx.fillText('70%', cx + width + 12, mark70 + 3);
        
        ctx.beginPath(); ctx.moveTo(cx - width, mark20); ctx.lineTo(cx + width, mark20); ctx.stroke();
        ctx.fillText('20%', cx + width + 12, mark20 + 3);
        
        ctx.setLineDash([]);
    }

    function renderLoop() {
        requestAnimationFrame(renderLoop);
        if (document.body.classList.contains('panic-mode-active')) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        const isLight = document.body.classList.contains('light-theme');
        
        const colors = {
            housingBase: isLight ? '#cbd5e1' : '#0f172a',
            rail: isLight ? '#94a3b8' : '#020617',
            arm: isLight ? '#0ea5e9' : '#0284c7',
            armDark: isLight ? '#0284c7' : '#0369a1',
            text: isLight ? '#334155' : '#94a3b8'
        };

        const baseH = canvas.height * 0.65;
        const baseY = cy - (baseH / 2);

        const hw = 40; 
        const hh = baseH; 
        const hx = cx + 15; 
        
        // Columna de Base (Handy)
        ctx.fillStyle = colors.housingBase;
        ctx.beginPath();
        ctx.roundRect(hx, baseY, hw, hh, 8);
        ctx.fill();

        // Riel
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

        // Limites fijos en Y para el trazo de la anatomía
        const strokeTopY = ry + 15;
        const strokeBotY = ry + slideRange + 15;

        const sw = 50;
        const sh = 100;
        const sx = rx - sw - 15;
        const sy = armY + 15 - sh/2;

        // 1. DIBUJAR ANATOMÍA DE FONDO (SI ESTÁ ACTIVA)
        if (showAnatomy) {
            drawAnatomyBlueprint(sx + sw/2, cy, strokeTopY, strokeBotY, sw * 0.7);
        }

        // 2. BRAZO MECÁNICO ATRÁS
        ctx.fillStyle = colors.arm;
        ctx.beginPath();
        ctx.roundRect(rx - 10, armY, rw + 20, 30, 4);
        ctx.fill();
        
        // 3. MANGA TRANSLÚCIDA BLANCO/GRIS AL FRENTE (Efecto Cristal)
        let sFill = isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(203, 213, 225, 0.45)';
        let sStroke = isLight ? '#94a3b8' : '#cbd5e1';

        ctx.fillStyle = sFill;
        ctx.strokeStyle = sStroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 15);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isLight ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.roundRect(sx + 5, sy + 5, 10, sh - 10, 5);
        ctx.fill();

        // 4. REMACHE FINAL
        ctx.fillStyle = colors.armDark;
        ctx.beginPath();
        ctx.fillRect(rx - 15, armY + 5, 20, 20);

        ctx.fillStyle = colors.text;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Pos: ${Math.round(targetPos)}%`, cx, canvas.height - 10);
    }

    renderLoop();
});

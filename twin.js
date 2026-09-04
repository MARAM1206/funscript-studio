// ==========================================================================
// DIGITAL TWIN 3D V1.3.3 (ORIENTACIÓN DERECHA, MANGA CRISTAL Y ANATOMÍA EXPLÍCITA)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('twin-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
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

    // Renderizador Anatómico Vectorial Explícito
    function drawExplicitAnatomy(penisCx, topY, bottomY, pWidth) {
        const totalH = bottomY - topY;
        const y100 = topY;
        const y70 = topY + totalH * 0.3;  // Glande (70% - 100%)
        const y20 = topY + totalH * 0.8;  // Cuerpo (20% - 70%)
        const y0 = bottomY;               // Base (0% - 20%)

        const isLight = document.body.classList.contains('light-theme');
        
        const outlineColor = isLight ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.6)';
        const scrotumColor = isLight ? '#d49a94' : '#b77b74';
        const glansColor = isLight ? '#e59a95' : '#d48a85';

        // 1. ESCROTO (Debajo del 0%)
        ctx.fillStyle = scrotumColor;
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Testículo Izquierdo
        ctx.arc(penisCx - pWidth * 0.4, y0 + 35, pWidth * 0.55, 0, Math.PI * 2);
        // Testículo Derecho
        ctx.arc(penisCx + pWidth * 0.4, y0 + 35, pWidth * 0.55, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        
        // Detalle central del escroto (Rafe)
        ctx.beginPath();
        ctx.moveTo(penisCx, y0 + 15);
        ctx.quadraticCurveTo(penisCx + 4, y0 + 40, penisCx, y0 + 65);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.stroke();

        // 2. CUERPO / EJE (0% a 70%)
        let shaftGrad = ctx.createLinearGradient(penisCx - pWidth/2, 0, penisCx + pWidth/2, 0);
        if (isLight) {
            shaftGrad.addColorStop(0, '#dcb2a9');
            shaftGrad.addColorStop(0.3, '#f5d6cf');
            shaftGrad.addColorStop(0.7, '#f5d6cf');
            shaftGrad.addColorStop(1, '#c9968d');
        } else {
            shaftGrad.addColorStop(0, '#b87c74');
            shaftGrad.addColorStop(0.3, '#ebb6ae');
            shaftGrad.addColorStop(0.7, '#ebb6ae');
            shaftGrad.addColorStop(1, '#a3665e');
        }

        ctx.fillStyle = shaftGrad;
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(penisCx - pWidth/2, y0 + 15);
        ctx.quadraticCurveTo(penisCx - pWidth/2 + 2, (y0+y70)/2, penisCx - pWidth/2, y70);
        ctx.lineTo(penisCx + pWidth/2, y70);
        ctx.quadraticCurveTo(penisCx + pWidth/2 - 2, (y0+y70)/2, penisCx + pWidth/2, y0 + 15);
        ctx.fill(); ctx.stroke();

        // Vena sutil en el cuerpo
        ctx.beginPath();
        ctx.moveTo(penisCx - 6, y0 + 5);
        ctx.quadraticCurveTo(penisCx + 12, y20, penisCx - 4, y70 - 15);
        ctx.strokeStyle = isLight ? 'rgba(100, 150, 200, 0.2)' : 'rgba(100, 150, 200, 0.15)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 3. GLANDE (70% a 100%)
        const flare = pWidth * 0.28; // Ensanchamiento de la corona
        let glansGrad = ctx.createLinearGradient(penisCx - pWidth/2 - flare, 0, penisCx + pWidth/2 + flare, 0);
        if (isLight) {
            glansGrad.addColorStop(0, '#cc7a74');
            glansGrad.addColorStop(0.4, '#eaa9a4');
            glansGrad.addColorStop(0.8, '#eaa9a4');
            glansGrad.addColorStop(1, '#b55a55');
        } else {
            glansGrad.addColorStop(0, '#b86963');
            glansGrad.addColorStop(0.4, '#d68e88');
            glansGrad.addColorStop(0.8, '#d68e88');
            glansGrad.addColorStop(1, '#9e524d');
        }

        ctx.fillStyle = glansGrad;
        ctx.strokeStyle = outlineColor;

        ctx.beginPath();
        ctx.moveTo(penisCx - pWidth/2, y70);
        ctx.quadraticCurveTo(penisCx - pWidth/2 - flare, y70 - 4, penisCx - pWidth/2 - flare + 2, y70 - 18);
        ctx.bezierCurveTo(penisCx - pWidth*0.4, y100 + 12, penisCx, y100, penisCx, y100);
        ctx.bezierCurveTo(penisCx, y100, penisCx + pWidth*0.4, y100 + 12, penisCx + pWidth/2 + flare - 2, y70 - 18);
        ctx.quadraticCurveTo(penisCx + pWidth/2 + flare, y70 - 4, penisCx + pWidth/2, y70);
        ctx.quadraticCurveTo(penisCx, y70 + 8, penisCx - pWidth/2, y70);
        ctx.fill(); ctx.stroke();

        // Brillo 3D de la corona
        ctx.beginPath();
        ctx.moveTo(penisCx - pWidth/2 - flare + 4, y70 - 16);
        ctx.quadraticCurveTo(penisCx, y70 + 4, penisCx + pWidth/2 + flare - 4, y70 - 16);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Meato (Abertura)
        ctx.beginPath();
        ctx.moveTo(penisCx, y100 + 3);
        ctx.lineTo(penisCx, y100 + 16);
        ctx.strokeStyle = isLight ? 'rgba(100, 30, 30, 0.3)' : 'rgba(100, 30, 30, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 4. LÍNEAS TOPOGRÁFICAS (100%, 70%, 20%, 0%)
        ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.9)' : 'rgba(148, 163, 184, 0.5)';
        ctx.fillStyle = isLight ? '#334155' : '#94a3b8';
        ctx.font = 'bold 10px monospace';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;

        const drawLine = (y, label) => {
            ctx.beginPath(); 
            ctx.moveTo(penisCx - pWidth - 35, y); 
            ctx.lineTo(penisCx + pWidth + 35, y); 
            ctx.stroke();
            ctx.fillText(label, penisCx + pWidth + 40, y + 4);
        };

        drawLine(y100, '100%');
        drawLine(y70, '70%');
        drawLine(y20, '20%');
        drawLine(y0, '0%');
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
            text: isLight ? '#334155' : '#94a3b8'
        };

        // Geometría del renderizado
        const baseH = canvas.height * 0.68;
        const baseY = cy - (baseH / 2);

        // 1. LA MÁQUINA (Izquierda)
        const hw = 50; 
        const hx = cx - 55; // Desplazado a la izquierda
        
        // Carcasa del motor
        let bodyGrad = ctx.createLinearGradient(hx - hw/2, 0, hx + hw/2, 0);
        bodyGrad.addColorStop(0, isLight ? '#e2e8f0' : '#1e293b');
        bodyGrad.addColorStop(0.5, isLight ? '#f8fafc' : '#475569');
        bodyGrad.addColorStop(1, isLight ? '#cbd5e1' : '#0f172a');
        
        ctx.fillStyle = bodyGrad;
        ctx.strokeStyle = isLight ? '#94a3b8' : '#020617';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(hx - hw/2, baseY, hw, baseH, 12);
        ctx.fill(); ctx.stroke();

        // Riel mecánico
        const rw = 14;
        const rh = baseH - 20;
        const rx = hx + hw/2 - rw/2 - 4; // Incrustado en el lado derecho de la máquina
        const ry = baseY + 10;
        
        ctx.fillStyle = colors.rail;
        ctx.beginPath();
        ctx.roundRect(rx - rw/2, ry, rw, rh, 5);
        ctx.fill();

        let targetPos = getInterpolatedPosition();
        
        const strokeTopY = ry + 15;
        const strokeBotY = ry + rh - 15;
        const slideRange = strokeBotY - strokeTopY;
        const armY = strokeBotY - (targetPos / 100) * slideRange;

        // Eje anatómico (Derecha)
        const sw = 65; // Manga ancha
        const sx = hx + hw/2 + 45; // Centro de la anatomía
        const sh = 110; 
        const sy = armY - sh/2;

        // 2. DIBUJAR ANATOMÍA DE FONDO (Derecha)
        if (showAnatomy) {
            drawExplicitAnatomy(sx, strokeTopY, strokeBotY, sw * 0.85); // 0.85 = Gran grosor
        }

        // 3. BRAZO MECÁNICO (Conecta Izquierda con Derecha)
        ctx.fillStyle = colors.arm;
        ctx.beginPath();
        ctx.roundRect(rx, armY - 12, (sx - rx), 24, 4);
        ctx.fill();
        
        // 4. MANGA TRANSLÚCIDA (Efecto Cristal Claro)
        let sFill = isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(226, 232, 240, 0.35)';
        let sStroke = isLight ? 'rgba(148, 163, 184, 0.8)' : 'rgba(255, 255, 255, 0.6)';

        ctx.fillStyle = sFill;
        ctx.strokeStyle = sStroke;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(sx - sw/2, sy, sw, sh, 20);
        ctx.fill();
        ctx.stroke();

        // Reflejo curvo del cristal
        ctx.fillStyle = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.roundRect(sx - sw/2 + 6, sy + 6, 12, sh - 12, 6);
        ctx.fill();

        // 5. TEXTO INFERIOR
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Posición Actual: ${Math.round(targetPos)}%`, cx, canvas.height - 10);
    }

    renderLoop();
});

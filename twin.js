// ==========================================================================
// DIGITAL TWIN 3D V1.3.4 (HANDY REALISTA, MANGA CRISTAL Y ANATOMÍA BRONCEADA)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('twin-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Sistema del Botón Toggle para el modelo anatómico con emojis interactivos
    let showAnatomy = false;
    const anatomyBtn = document.getElementById('twin-anatomy-btn');
    if(anatomyBtn) {
        anatomyBtn.innerText = '🙈';
        anatomyBtn.addEventListener('click', () => {
            showAnatomy = !showAnatomy;
            anatomyBtn.innerText = showAnatomy ? '👁️' : '🙈';
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

    // Renderizador Anatómico Realista y Bronceado
    function drawExplicitAnatomy(penisCx, topY, bottomY, pWidth) {
        const totalH = bottomY - topY;
        const y100 = topY;
        const y70 = topY + totalH * 0.3;  
        const y20 = topY + totalH * 0.8;  
        const y0 = bottomY;               

        const isLight = document.body.classList.contains('light-theme');
        const strokeColor = isLight ? 'rgba(90, 45, 30, 0.4)' : 'rgba(40, 20, 10, 0.6)';
        
        // 1. ESCROTO (Debajo de 0%)
        let scrotGrad = ctx.createRadialGradient(penisCx, y0 + 30, 5, penisCx, y0 + 30, pWidth);
        scrotGrad.addColorStop(0, '#c48b6b');
        scrotGrad.addColorStop(1, '#8c593f');

        ctx.fillStyle = scrotGrad;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.moveTo(penisCx - pWidth * 0.4, y20);
        // Saco redondeado y continuo (sin líneas extrañas)
        ctx.bezierCurveTo(penisCx - pWidth * 1.1, y20 + 10, penisCx - pWidth * 0.2, y0 + 50, penisCx, y0 + 35);
        ctx.bezierCurveTo(penisCx + pWidth * 0.2, y0 + 50, penisCx + pWidth * 1.1, y20 + 10, penisCx + pWidth * 0.4, y20);
        ctx.fill(); ctx.stroke();
        
        // Marca sutil divisoria
        ctx.beginPath();
        ctx.moveTo(penisCx, y0 + 10);
        ctx.quadraticCurveTo(penisCx + 2, y0 + 25, penisCx, y0 + 35);
        ctx.strokeStyle = 'rgba(70, 40, 20, 0.15)';
        ctx.stroke();

        // 2. CUERPO (EJE) (20% al 70%)
        let shaftGrad = ctx.createLinearGradient(penisCx - pWidth/2, 0, penisCx + pWidth/2, 0);
        shaftGrad.addColorStop(0, '#a66d4c');   // Sombra izquierda
        shaftGrad.addColorStop(0.2, '#d6a385'); // Brillo
        shaftGrad.addColorStop(0.5, '#e3b599'); // Centro iluminado
        shaftGrad.addColorStop(0.8, '#b88160'); // Sombra derecha
        shaftGrad.addColorStop(1, '#7a4b31');   // Borde oscuro

        ctx.fillStyle = shaftGrad;
        ctx.beginPath();
        ctx.moveTo(penisCx - pWidth * 0.38, y20 + 5);
        ctx.bezierCurveTo(penisCx - pWidth * 0.35, (y20+y70)/2, penisCx - pWidth * 0.35, y70, penisCx - pWidth * 0.35, y70);
        ctx.lineTo(penisCx + pWidth * 0.35, y70);
        ctx.bezierCurveTo(penisCx + pWidth * 0.35, (y20+y70)/2, penisCx + pWidth * 0.38, y20 + 5, penisCx + pWidth * 0.38, y20 + 5);
        ctx.fill();
        
        ctx.strokeStyle = strokeColor;
        ctx.beginPath(); ctx.moveTo(penisCx - pWidth * 0.38, y20 + 5); ctx.bezierCurveTo(penisCx - pWidth * 0.35, (y20+y70)/2, penisCx - pWidth * 0.35, y70, penisCx - pWidth * 0.35, y70); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(penisCx + pWidth * 0.38, y20 + 5); ctx.bezierCurveTo(penisCx + pWidth * 0.35, (y20+y70)/2, penisCx + pWidth * 0.35, y70, penisCx + pWidth * 0.35, y70); ctx.stroke();

        // 3. GLANDE (70% al 100%)
        const flare = pWidth * 0.15; 
        let glansGrad = ctx.createLinearGradient(penisCx - pWidth/2, 0, penisCx + pWidth/2, 0);
        glansGrad.addColorStop(0, '#c77873');
        glansGrad.addColorStop(0.3, '#eba7a2');
        glansGrad.addColorStop(0.7, '#d68b85');
        glansGrad.addColorStop(1, '#a8504a');

        ctx.fillStyle = glansGrad;
        ctx.beginPath();
        ctx.moveTo(penisCx - pWidth * 0.35, y70);
        ctx.quadraticCurveTo(penisCx - pWidth * 0.35 - flare, y70 - 2, penisCx - pWidth * 0.35 - flare, y70 - 10);
        ctx.bezierCurveTo(penisCx - pWidth * 0.35 - flare, y100 - 5, penisCx - pWidth * 0.1, y100, penisCx, y100);
        ctx.bezierCurveTo(penisCx + pWidth * 0.1, y100, penisCx + pWidth * 0.35 + flare, y100 - 5, penisCx + pWidth * 0.35 + flare, y70 - 10);
        ctx.quadraticCurveTo(penisCx + pWidth * 0.35 + flare, y70 - 2, penisCx + pWidth * 0.35, y70);
        ctx.quadraticCurveTo(penisCx, y70 + 8, penisCx - pWidth * 0.35, y70);
        ctx.fill(); 
        
        ctx.strokeStyle = 'rgba(100, 30, 30, 0.4)';
        ctx.stroke();

        // Meato (Abertura superior)
        ctx.beginPath();
        ctx.ellipse(penisCx, y100 + 4, 1.5, 5, 0, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(100, 30, 30, 0.5)';
        ctx.fill();

        // 4. LÍNEAS TOPOGRÁFICAS (100%, 70%, 20%, 0%)
        ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.9)' : 'rgba(148, 163, 184, 0.5)';
        ctx.fillStyle = isLight ? '#334155' : '#94a3b8';
        ctx.font = 'bold 10px monospace';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;

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

        // Geometría del Renderizado
        const baseH = canvas.height * 0.75;
        const baseY = cy - (baseH / 2);
        
        const hw = 75; 
        const hx = cx - 70; // Handy posicionado a la Izquierda
        
        // ==========================================
        // 1. RECREACIÓN REALISTA DEL HANDY (CHASIS)
        // ==========================================
        
        // Cuerpo Negro Mate con Tapa Superior
        ctx.fillStyle = isLight ? '#cbd5e1' : '#141414'; 
        ctx.beginPath();
        ctx.moveTo(hx - hw/2 + 5, baseY); 
        ctx.lineTo(hx + hw/2 - 5, baseY);
        ctx.quadraticCurveTo(hx + hw/2, baseY, hx + hw/2, baseY + 10);
        // Cara Frontal Recta
        ctx.lineTo(hx + hw/2, baseY + baseH - 15);
        ctx.quadraticCurveTo(hx + hw/2, baseY + baseH, hx + hw/2 - 10, baseY + baseH);
        ctx.lineTo(hx - hw/2 + 10, baseY + baseH);
        // Espalda Ergonómica Curva
        ctx.quadraticCurveTo(hx - hw/2, baseY + baseH, hx - hw/2, baseY + baseH - 20);
        ctx.bezierCurveTo(hx - hw/2 - 10, baseY + baseH * 0.6, hx - hw/2 + 10, baseY + baseH * 0.3, hx - hw/2, baseY + 10);
        ctx.quadraticCurveTo(hx - hw/2, baseY, hx - hw/2 + 5, baseY);
        ctx.fill();

        // Línea divisoria de la Tapa Superior
        ctx.beginPath();
        ctx.moveTo(hx - hw/2 + 4, baseY + 35);
        ctx.quadraticCurveTo(hx, baseY + 42, hx + hw/2, baseY + 35);
        ctx.strokeStyle = isLight ? '#94a3b8' : '#080808';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Panel de Control Frontal (Grip)
        ctx.fillStyle = isLight ? '#94a3b8' : '#1f1f1f';
        ctx.beginPath();
        ctx.moveTo(hx + hw/2, baseY + 45);
        ctx.bezierCurveTo(hx - 5, baseY + 45, hx - 15, baseY + 100, hx - 5, baseY + 170);
        ctx.bezierCurveTo(hx + 10, baseY + 200, hx + hw/2, baseY + 200, hx + hw/2, baseY + 200);
        ctx.fill();

        // D-Pad (Botones de control en cruz)
        ctx.fillStyle = isLight ? '#475569' : '#0a0a0a';
        const dpx = hx + 10;
        const dpy = baseY + 110;
        ctx.fillRect(dpx - 9, dpy - 3, 18, 6);
        ctx.fillRect(dpx - 3, dpy - 9, 6, 18);

        // LED indicador
        ctx.fillStyle = '#38bdf8'; 
        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(hx + 10, baseY + 155, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0; 
        
        // ==========================================
        // 2. SISTEMA MECÁNICO Y ANATOMÍA
        // ==========================================

        const strokeTopY = baseY + 40;
        const strokeBotY = baseY + baseH - 40;
        const sh = 130; 
        
        // Riel Metálico / Canal
        const rx = hx + hw/2 - 6; 
        ctx.fillStyle = isLight ? '#475569' : '#050505';
        ctx.beginPath();
        ctx.roundRect(rx - 6, strokeTopY - 20, 10, (strokeBotY - strokeTopY) + 40, 5);
        ctx.fill();

        const y100 = strokeTopY + 20; 
        const y0 = strokeBotY - sh + 20; 

        let targetPos = getInterpolatedPosition();
        
        // Movimiento Invertido: 100% (Abajo, manga sube), 0% (Arriba, manga baja)
        const armY = strokeBotY - (targetPos / 100) * (strokeBotY - strokeTopY);
        
        const sx = hx + hw/2 + 60; // Separación del chasis a la anatomía
        const pWidth = 55; // Grosor del modelo
        
        if (showAnatomy) {
            drawExplicitAnatomy(sx, y100, y0, pWidth); 
        }

        // Brazo de conexión del riel a la manga
        ctx.fillStyle = isLight ? '#0ea5e9' : '#0284c7';
        ctx.beginPath();
        ctx.roundRect(rx, armY - 12, (sx - rx - 20), 24, 4);
        ctx.fill();
        
        // ==========================================
        // 3. MANGA DE CRISTAL TRANSLÚCIDA
        // ==========================================
        
        const sw = 65; 
        const sleeveY = armY + 20 - sh; // Anclaje inferior
        
        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(240, 245, 255, 0.25)';
        ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.9)' : 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(sx - sw/2, sleeveY, sw, sh, 10);
        ctx.fill(); ctx.stroke();

        ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        for(let i=15; i<sh-15; i+=15) {
            ctx.moveTo(sx - sw/2 + 5, sleeveY + i);
            ctx.lineTo(sx, sleeveY + i + 5);
            ctx.lineTo(sx + sw/2 - 5, sleeveY + i);
        }
        ctx.stroke();
        
        // ==========================================
        // 4. BANDA TRUEGRIP (VELCRO) NEGRA
        // ==========================================
        
        const strapH = 28;
        const strapY = armY - 14;
        
        // Tela del velcro
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.roundRect(sx - sw/2 - 2, strapY, sw + 4, strapH, 3);
        ctx.fill();
        
        // Textura corrugada del velcro
        ctx.strokeStyle = '#222';
        ctx.beginPath();
        for(let i = sx - sw/2 + 2; i < sx + sw/2; i += 4) {
            ctx.moveTo(i, strapY + 2); 
            ctx.lineTo(i, strapY + strapH - 2);
        }
        ctx.stroke();
        
        // Remache / Seguro central de plástico
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath(); 
        ctx.roundRect(sx - 10, strapY - 2, 20, strapH + 4, 3); 
        ctx.fill();

        // 5. TEXTO INFERIOR
        ctx.fillStyle = isLight ? '#334155' : '#94a3b8';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Posición Actual: ${Math.round(targetPos)}%`, cx, canvas.height - 10);
    }

    renderLoop();
});

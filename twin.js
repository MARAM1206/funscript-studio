// ==========================================================================
// DIGITAL TWIN 3D V1.3.4 (ANATOMÍA CORREGIDA Y PROPORCIONAL)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('twin-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
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

    // 🎯 FIX: Función reconstruida para recibir solo los 4 parámetros correctos y no mutar
    function drawExplicitAnatomy(penisCx, topY, bottomY, pWidth) {
        const totalH = bottomY - topY;
        const y100 = topY;
        const y70 = topY + totalH * 0.3;  
        const y20 = topY + totalH * 0.8;  
        const y0 = bottomY;               

        const isLight = document.body.classList.contains('light-theme');
        
        const outlineColor = isLight ? '#8c5c56' : '#2a1a18';
        const scrotumColor = isLight ? '#d49a94' : '#6b433e';

        // 1. ESCROTO (Proporcional al ancho, debajo del 0%)
        ctx.fillStyle = scrotumColor;
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const testisR = pWidth * 0.6; // Radio calculado matemáticamente
        ctx.arc(penisCx - pWidth * 0.45, y0 + testisR, testisR, 0, Math.PI * 2);
        ctx.arc(penisCx + pWidth * 0.45, y0 + testisR, testisR, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(penisCx, y0 + 5);
        ctx.quadraticCurveTo(penisCx + 3, y0 + 30, penisCx, y0 + testisR * 1.5);
        ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.4)';
        ctx.stroke();

        // 2. EJE CORPORAL (0% a 70%)
        let shaftGrad = ctx.createLinearGradient(penisCx - pWidth/2, 0, penisCx + pWidth/2, 0);
        if (isLight) {
            shaftGrad.addColorStop(0, '#dcb2a9');
            shaftGrad.addColorStop(0.3, '#f9e0da');
            shaftGrad.addColorStop(0.7, '#f9e0da');
            shaftGrad.addColorStop(1, '#c9968d');
        } else {
            shaftGrad.addColorStop(0, '#5e3833');
            shaftGrad.addColorStop(0.3, '#8f5750');
            shaftGrad.addColorStop(0.7, '#8f5750');
            shaftGrad.addColorStop(1, '#4a2c28');
        }

        ctx.fillStyle = shaftGrad;
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(penisCx - pWidth/2, y0);
        ctx.bezierCurveTo(penisCx - pWidth/2 + 2, y20, penisCx - pWidth/2, y70, penisCx - pWidth/2, y70);
        ctx.lineTo(penisCx + pWidth/2, y70);
        ctx.bezierCurveTo(penisCx + pWidth/2, y70, penisCx + pWidth/2 - 2, y20, penisCx + pWidth/2, y0);
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(penisCx - 4, y0 - 10);
        ctx.quadraticCurveTo(penisCx + 8, (y0+y70)/2, penisCx - 2, y70 - 10);
        ctx.strokeStyle = isLight ? 'rgba(100, 150, 200, 0.2)' : 'rgba(100, 150, 200, 0.15)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 3. GLANDE (70% a 100%)
        const flare = pWidth * 0.22; 
        let glansGrad = ctx.createLinearGradient(penisCx - pWidth/2 - flare, 0, penisCx + pWidth/2 + flare, 0);
        if (isLight) {
            glansGrad.addColorStop(0, '#cc7a74');
            glansGrad.addColorStop(0.3, '#f2b6b1');
            glansGrad.addColorStop(0.7, '#f2b6b1');
            glansGrad.addColorStop(1, '#b55a55');
        } else {
            glansGrad.addColorStop(0, '#82453e');
            glansGrad.addColorStop(0.3, '#b8665c');
            glansGrad.addColorStop(0.7, '#b8665c');
            glansGrad.addColorStop(1, '#66342e');
        }

        ctx.fillStyle = glansGrad;
        ctx.strokeStyle = outlineColor;

        ctx.beginPath();
        ctx.moveTo(penisCx - pWidth/2, y70);
        ctx.quadraticCurveTo(penisCx - pWidth/2 - flare, y70 - 2, penisCx - pWidth/2 - flare + 2, y70 - 12);
        ctx.bezierCurveTo(penisCx - pWidth*0.4, y100 + 8, penisCx - pWidth*0.1, y100, penisCx, y100);
        ctx.bezierCurveTo(penisCx + pWidth*0.1, y100, penisCx + pWidth*0.4, y100 + 8, penisCx + pWidth/2 + flare - 2, y70 - 12);
        ctx.quadraticCurveTo(penisCx + pWidth/2 + flare, y70 - 2, penisCx + pWidth/2, y70);
        ctx.quadraticCurveTo(penisCx, y70 + 6, penisCx - pWidth/2, y70);
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(penisCx, y100 + 2);
        ctx.lineTo(penisCx, y100 + 12);
        ctx.strokeStyle = isLight ? 'rgba(100, 30, 30, 0.25)' : 'rgba(40, 10, 10, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(penisCx - pWidth/2 - flare + 6, y70 - 10);
        ctx.quadraticCurveTo(penisCx, y70 - 2, penisCx + pWidth/2 + flare - 6, y70 - 10);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 4. LÍNEAS TOPOGRÁFICAS
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
        
        const colors = {
            housingBase: isLight ? '#cbd5e1' : '#0f172a',
            rail: isLight ? '#94a3b8' : '#020617',
            arm: isLight ? '#0ea5e9' : '#0284c7',
            text: isLight ? '#334155' : '#94a3b8'
        };

        const baseH = canvas.height * 0.75;
        const baseY = cy - (baseH / 2);
        
        const hw = 75; 
        const hx = cx - 60; 
        
        let bodyGrad = ctx.createLinearGradient(hx - hw/2, 0, hx + hw/2, 0);
        bodyGrad.addColorStop(0, isLight ? '#cbd5e1' : '#111');
        bodyGrad.addColorStop(0.3, isLight ? '#f1f5f9' : '#333');
        bodyGrad.addColorStop(0.7, isLight ? '#e2e8f0' : '#222');
        bodyGrad.addColorStop(1, isLight ? '#94a3b8' : '#0a0a0a');
        
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.roundRect(hx - hw/2, baseY, hw, baseH, 20);
        ctx.fill();

        ctx.fillStyle = isLight ? '#64748b' : '#1f2224'; 
        ctx.beginPath();
        ctx.moveTo(hx - hw/2, baseY + 30);
        ctx.quadraticCurveTo(hx, baseY + 80, hx + 10, baseY + 150);
        ctx.quadraticCurveTo(hx + 15, baseY + baseH/2, hx, baseY + baseH - 50);
        ctx.lineTo(hx - hw/2, baseY + baseH - 20);
        ctx.fill();

        ctx.fillStyle = isLight ? '#334155' : '#111';
        const bx = hx - 5;
        const by = baseY + 120;
        ctx.beginPath(); ctx.roundRect(bx - 12, by - 4, 24, 8, 3); ctx.fill(); 
        ctx.beginPath(); ctx.roundRect(bx - 4, by - 12, 8, 24, 3); ctx.fill(); 
        
        ctx.fillStyle = '#38bdf8'; 
        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(bx, by + 60, 3, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0; 
        
        const strokeTopY = baseY + 40;
        const strokeBotY = baseY + baseH - 40;
        const sh = 130; 
        
        const y100 = strokeTopY + 20; 
        const y0 = strokeBotY - sh + 20; 

        const rx = hx + hw/2 - 6; 
        ctx.fillStyle = isLight ? '#475569' : '#020617';
        ctx.beginPath();
        ctx.roundRect(rx - 6, strokeTopY - 20, 12, (strokeBotY - strokeTopY) + 40, 5);
        ctx.fill();

        let targetPos = getInterpolatedPosition();
        
        const armY = strokeBotY - (targetPos / 100) * (strokeBotY - strokeTopY);
        const sx = hx + hw/2 + 55; 
        const sw = 50; // Ancho anatómico fijo
        
        if (showAnatomy) {
            // 🎯 FIX: Llamada a la función con sus 4 parámetros intactos (Centro, Arriba, Abajo, Ancho)
            drawExplicitAnatomy(sx, y100, y0, sw); 
        }

        ctx.fillStyle = colors.arm;
        ctx.beginPath();
        ctx.roundRect(rx, armY - 12, (sx - rx), 24, 4);
        ctx.fill();
        
        const sleeveW = 60; 
        const sleeveY = armY + 20 - sh; 
        
        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.65)' : 'rgba(230, 240, 255, 0.35)';
        ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.9)' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(sx - sleeveW/2, sleeveY, sleeveW, sh, 10);
        ctx.fill(); ctx.stroke();

        ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        for(let i=15; i<sh-15; i+=15) {
            ctx.moveTo(sx - sleeveW/2 + 5, sleeveY + i);
            ctx.lineTo(sx, sleeveY + i + 5);
            ctx.lineTo(sx + sleeveW/2 - 5, sleeveY + i);
        }
        ctx.stroke();
        
        ctx.fillStyle = isLight ? '#334155' : '#111';
        ctx.fillRect(sx - sleeveW/2 - 2, armY - 15, sleeveW + 4, 30);
        ctx.fillStyle = isLight ? '#1e293b' : '#222';
        ctx.beginPath(); ctx.arc(sx, armY, 10, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = colors.text;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Posición Actual: ${Math.round(targetPos)}%`, cx, canvas.height - 10);
    }

    renderLoop();
});

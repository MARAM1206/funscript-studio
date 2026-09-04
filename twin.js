// ==========================================================================
// DIGITAL TWIN 3D V1.4.1 (ESCALA CORREGIDA Y TOPOGRAFÍA PERMANENTE)
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

    function drawExplicitAnatomy(penisCx, y100, y0, pWidth) {
        const totalH = y0 - y100;
        const y70 = y100 + totalH * 0.3;  
        const y20 = y100 + totalH * 0.8;  

        const isLight = document.body.classList.contains('light-theme');
        const outlineColor = isLight ? 'rgba(90, 45, 30, 0.4)' : 'rgba(40, 20, 10, 0.6)';

        // CUERPO / EJE (y0 a y70)
        let shaftGrad = ctx.createLinearGradient(penisCx - pWidth/2, 0, penisCx + pWidth/2, 0);
        shaftGrad.addColorStop(0, '#a66d4c');   
        shaftGrad.addColorStop(0.2, '#d6a385'); 
        shaftGrad.addColorStop(0.5, '#e3b599'); 
        shaftGrad.addColorStop(0.8, '#b88160'); 
        shaftGrad.addColorStop(1, '#7a4b31');   

        ctx.fillStyle = shaftGrad;
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.moveTo(penisCx - pWidth/2, y70);
        ctx.lineTo(penisCx - pWidth/2, y0);
        ctx.quadraticCurveTo(penisCx, y0 + 10, penisCx + pWidth/2, y0); 
        ctx.lineTo(penisCx + pWidth/2, y70);
        ctx.fill(); ctx.stroke();

        // GLANDE (y70 a y100)
        const flare = pWidth * 0.18; 
        let glansGrad = ctx.createLinearGradient(penisCx - pWidth/2 - flare, 0, penisCx + pWidth/2 + flare, 0);
        glansGrad.addColorStop(0, '#c77873');
        glansGrad.addColorStop(0.3, '#eba7a2');
        glansGrad.addColorStop(0.7, '#d68b85');
        glansGrad.addColorStop(1, '#a8504a');

        ctx.fillStyle = glansGrad;

        ctx.beginPath();
        ctx.moveTo(penisCx - pWidth/2, y70);
        ctx.quadraticCurveTo(penisCx - pWidth/2 - flare, y70 - 2, penisCx - pWidth/2 - flare, y70 - 10);
        
        ctx.bezierCurveTo(
            penisCx - pWidth/2 - flare, y100 + 15, 
            penisCx - pWidth*0.25, y100, 
            penisCx, y100
        );
        ctx.bezierCurveTo(
            penisCx + pWidth*0.25, y100, 
            penisCx + pWidth/2 + flare, y100 + 15, 
            penisCx + pWidth/2 + flare, y70 - 10
        );
        
        ctx.quadraticCurveTo(penisCx + pWidth/2 + flare, y70 - 2, penisCx + pWidth/2, y70);
        ctx.quadraticCurveTo(penisCx, y70 + 8, penisCx - pWidth/2, y70);
        ctx.fill(); ctx.stroke();

        // Meato
        ctx.beginPath();
        ctx.moveTo(penisCx, y100 + 4);
        ctx.lineTo(penisCx, y100 + 14);
        ctx.strokeStyle = isLight ? 'rgba(100, 30, 30, 0.3)' : 'rgba(100, 30, 30, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function renderLoop() {
        requestAnimationFrame(renderLoop);
        if (document.body.classList.contains('panic-mode-active')) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const isLight = document.body.classList.contains('light-theme');

        const baseH = canvas.height * 0.85; 
        const baseY = cy - (baseH / 2);
        
        const hw = 105; 
        const hx = cx - 80; 
        
        // Carcasa de la máquina
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
        ctx.moveTo(hx - hw/2, baseY + 40);
        ctx.quadraticCurveTo(hx - 15, baseY + 80, hx - 5, baseY + 150);
        ctx.lineTo(hx - 5, baseY + baseH - 60);
        ctx.quadraticCurveTo(hx - 15, baseY + baseH - 20, hx - hw/2, baseY + baseH - 20);
        ctx.fill();

        ctx.fillStyle = isLight ? '#334155' : '#111';
        const bx = hx - 15;
        const by = baseY + 140;
        ctx.beginPath(); ctx.roundRect(bx - 12, by - 4, 24, 8, 3); ctx.fill(); 
        ctx.beginPath(); ctx.roundRect(bx - 4, by - 12, 8, 24, 3); ctx.fill(); 
        
        ctx.fillStyle = '#38bdf8'; 
        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(bx, by + 45, 3, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0; 
        
        // Riel mecánico
        const strokeTopY = baseY + 50;
        const strokeBotY = baseY + baseH - 40;

        const rx = hx + hw/2 - 6; 
        ctx.fillStyle = isLight ? '#475569' : '#050505';
        ctx.beginPath();
        ctx.roundRect(rx - 6, strokeTopY - 15, 12, (strokeBotY - strokeTopY) + 30, 5);
        ctx.fill();

        let targetPos = getInterpolatedPosition();
        const armY = strokeBotY - (targetPos / 100) * (strokeBotY - strokeTopY);
        
        const sx = hx + hw/2 + 80; 
        const pWidth = 65; 
        const sh = 145; 
        const sleeveBottomOffset = 30; 
        
        const sleeveBottomY = armY + sleeveBottomOffset; 
        const sleeveTopY = sleeveBottomY - sh;

        // Anclaje Matemático de las Referencias (CORREGIDO)
        const y0 = strokeBotY + sleeveBottomOffset; 
        const y100 = strokeTopY + sleeveBottomOffset; 
        
        if (showAnatomy) {
            drawExplicitAnatomy(sx, y100, y0, pWidth); 
        }

        // LÍNEAS TOPOGRÁFICAS (Siempre Visibles)
        const totalH_anat = y0 - y100;
        const y70 = y100 + totalH_anat * 0.3;  
        const y20 = y100 + totalH_anat * 0.8;  

        ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.9)' : 'rgba(148, 163, 184, 0.5)';
        ctx.fillStyle = isLight ? '#334155' : '#94a3b8';
        ctx.font = 'bold 10px monospace';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;

        const drawLine = (y, label) => {
            ctx.beginPath(); 
            ctx.moveTo(rx + 15, y); 
            ctx.lineTo(sx + pWidth + 25, y); 
            ctx.stroke();
            ctx.fillText(label, sx + pWidth + 30, y + 4);
        };

        drawLine(y100, '100%');
        drawLine(y70, '70%');
        drawLine(y20, '20%');
        drawLine(y0, '0%');
        ctx.setLineDash([]);

        // Brazo conector
        ctx.fillStyle = isLight ? '#0ea5e9' : '#0284c7';
        ctx.beginPath();
        ctx.roundRect(rx, armY - 10, (sx - rx - 35), 20, 4);
        ctx.fill();
        
        // Manga Translúcida (Cristal)
        const sw = 95; 
        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.5)' : 'rgba(230, 240, 255, 0.2)';
        ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.9)' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(sx - sw/2, sleeveTopY, sw, sh, 12);
        ctx.fill(); ctx.stroke();

        ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.1)';
        for(let i=15; i<sh-15; i+=15) {
            ctx.beginPath();
            ctx.moveTo(sx - sw/2, sleeveTopY + i);
            ctx.quadraticCurveTo(sx, sleeveTopY + i + 10, sx + sw/2, sleeveTopY + i);
            ctx.stroke();
        }
        
        // Banda TrueGrip (Velcro)
        const strapH = 26;
        const strapY = armY - strapH/2;
        
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.roundRect(sx - sw/2 - 2, strapY, sw + 4, strapH, 3);
        ctx.fill();
        
        ctx.strokeStyle = '#222';
        ctx.beginPath();
        for(let i = sx - sw/2 + 2; i < sx + sw/2; i += 4) {
            ctx.moveTo(i, strapY + 2); 
            ctx.lineTo(i, strapY + strapH - 2);
        }
        ctx.stroke();
        
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath(); 
        ctx.roundRect(sx - 8, strapY - 2, 16, strapH + 4, 3); 
        ctx.fill();

        ctx.fillStyle = isLight ? '#334155' : '#94a3b8';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Posición Actual: ${Math.round(targetPos)}%`, cx, canvas.height - 10);
    }

    renderLoop();
});

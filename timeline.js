function drawTimeline() {
    if (!canvas.width) return;
    const h = canvas.height; const w = canvas.width;
    ctx.clearRect(0, 0, w, h);
    
    // CAPTURA PROPORCIONAL GLOBAL: Lee los contornos corporales fijados por el calibrador IA
    const splitB = window.aiSplitBase !== undefined ? window.aiSplitBase : 20;
    const splitC = window.aiSplitCabeza !== undefined ? window.aiSplitCabeza : 70;

    // Convertir porcentajes a coordenadas Y de pixeles reales dentro de la ventana
    const yCabezaLimite = h * ((100 - splitC) / 100);
    const yBaseLimite = h * ((100 - splitB) / 100);

    ctx.fillStyle = 'rgba(37, 99, 235, 0.05)'; // Cabeza (Zona Superior Personalizada)
    ctx.fillRect(0, 0, w, yCabezaLimite);
    
    ctx.fillStyle = 'rgba(139, 92, 246, 0.02)'; // Tronco (Zona Central Personalizada)
    ctx.fillRect(0, yCabezaLimite, w, yBaseLimite - yCabezaLimite);
    
    ctx.fillStyle = 'rgba(239, 68, 68, 0.04)'; // Base (Zona Inferior Personalizada)
    ctx.fillRect(0, yBaseLimite, w, h - yBaseLimite);

    ctx.lineWidth = 1; ctx.font = '9px monospace';
    for (let i = 0; i <= 100; i += 10) {
        const y = h - (i / 100) * h;
        ctx.setLineDash([4, 4]); 
        // Resaltar visualmente en la rejilla las líneas exactas donde cortan tus splits custom
        ctx.strokeStyle = (i === splitB || i === splitC) ? '#4b5563' : '#141d2b';
        if (i === splitB || i === splitC) ctx.setLineDash([]);
        
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = (i === splitB || i === splitC || i === 100 || i === 0) ? '#94a3b8' : '#2a374a';
        ctx.fillText(`${i}%`, 8, y + 3);
    }

    if (funscriptActions.length > 0) {
        ctx.lineWidth = 2; ctx.strokeStyle = '#2563eb'; ctx.beginPath();
        funscriptActions.forEach((action, index) => {
            const x = timeToX(action.at); const y = h - (action.pos / 100) * h;
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        funscriptActions.forEach((action) => {
            const x = timeToX(action.at); const y = h - (action.pos / 100) * h;
            if (x >= 0 && x <= w) {
                ctx.beginPath(); ctx.arc(x, y, action.selected ? 6 : 4, 0, 2 * Math.PI);
                if (action.selected) {
                    ctx.fillStyle = '#f97316'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
                    ctx.fill(); ctx.stroke();
                } else {
                    ctx.fillStyle = '#2563eb'; ctx.fill();
                }
            }
        });
    }

    if (window.timelineGhostPreset && window.timelineGhostMouseX !== -1) {
        const targetTimeMs = xToTime(window.timelineGhostMouseX);
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
        ctx.setLineDash([3, 3]); ctx.beginPath();
        window.timelineGhostPreset.forEach((action, index) => {
            const x = timeToX(targetTimeMs + action.at); const y = h - (action.pos / 100) * h;
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke(); ctx.setLineDash([]);
    }

    if (isSelecting) {
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.setLineDash([2, 2]); ctx.beginPath();
        ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
        ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        ctx.setLineDash([]);
    }

    const centerFixedX = w / 2 + panX;
    ctx.lineWidth = 2; ctx.strokeStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(centerFixedX, 0); ctx.lineTo(centerFixedX, h); ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(centerFixedX - 6, 0); ctx.lineTo(centerFixedX + 6, 0);
    ctx.lineTo(centerFixedX, 8); ctx.closePath(); ctx.fill();
}

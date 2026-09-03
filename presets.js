// ==========================================================================
// PRESETS MANAGER V1.1.9 (AUTO-ESCALA NATIVA Y SOPORTE DRAG & DROP)
// ==========================================================================

window.renderPresetMiniCanvas = function(canvas, presetData) {
    if (!canvas || !presetData || presetData.length === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;
    
    ctx.clearRect(0, 0, w, h);
    
    const duration = presetData[presetData.length - 1].at;
    const maxTime = duration > 0 ? duration : 1;
    
    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    
    presetData.forEach((pt, i) => {
        const x = (pt.at / maxTime) * w;
        const y = h - (pt.pos / 100) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    presetData.forEach(pt => {
        const x = (pt.at / maxTime) * w;
        const y = h - (pt.pos / 100) * h;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI*2);
        ctx.fillStyle = '#f97316';
        ctx.fill();
    });
};

// Como los presets son externos en tu código, 
// puedes llamar a "window.renderPresetMiniCanvas(canvasElement, arrayDePuntos)"
// justo después de cargar tu lista de presets para que se dibujen impecables.

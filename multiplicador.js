// ==========================================================================
// MULTIPLICADOR DE PRESETS - Actualización Visual en Tiempo Real
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Si cambias un valor numérico mientras sostienes el preset, el fantasma se actualiza al instante
    const inputs = ['multi-max', 'multi-min', 'multi-rand'];
    
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                if (window.isDraggingPreset && typeof window.drawTimeline === 'function') {
                    window.drawTimeline();
                }
            });
        }
    });
});

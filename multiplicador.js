// ==========================================================================
// GESTOR DEL MULTIPLICADOR Y MODIFICADORES DINÁMICOS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const btnMultiplicador = document.getElementById('btn-multiplicador');
    const panelMultiplicador = document.getElementById('panel-multiplicador');

    // Lógica para mostrar/ocultar el panel
    if (btnMultiplicador && panelMultiplicador) {
        btnMultiplicador.addEventListener('click', () => {
            const isVisible = panelMultiplicador.style.display !== 'none';
            panelMultiplicador.style.display = isVisible ? 'none' : 'block';
            
            // Efecto visual de activado (si usas clases para ello)
            if (!isVisible) {
                btnMultiplicador.style.backgroundColor = '#4f46e5'; 
            } else {
                btnMultiplicador.style.backgroundColor = ''; 
            }
        });
    }

    // Actualización en Tiempo Real: Si cambias un valor mientras arrastras, se actualiza el fantasma
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

// ==========================================================================
// WORKSPACE MANAGER V1.1.13 (SNAP GLOBAL EQUITATIVO Y RESIZE BLINDADO)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const panels = document.querySelectorAll('.workspace-panel');
    let highestZIndex = 100;
    
    // 🎯 FIX: Separación equitativa para TODOS los lados
    const SNAP_DIST = 15; 
    const GAP = 10; 

    panels.forEach(panel => {
        panel.addEventListener('mousedown', () => {
            panel.style.zIndex = ++highestZIndex;
        });

        // --------------------------------------------------------
        // LÓGICA DE ARRASTRE DE PESTAÑA
        // --------------------------------------------------------
        const header = panel.querySelector('.panel-header');
        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                e.preventDefault();
                let startX = e.clientX;
                let startY = e.clientY;
                let startLeft = panel.offsetLeft;
                let startTop = panel.offsetTop;
                
                document.body.style.userSelect = 'none';

                const onMouseMove = (ev) => {
                    let newL = startLeft + (ev.clientX - startX);
                    let newT = startTop + (ev.clientY - startY);

                    const container = panel.parentElement;
                    
                    // Snap a los bordes del monitor
                    if (newL < SNAP_DIST) newL = GAP;
                    if (newT < SNAP_DIST) newT = GAP;
                    if (newL + panel.offsetWidth > container.clientWidth - SNAP_DIST) {
                        newL = container.clientWidth - panel.offsetWidth - GAP;
                    }
                    if (newT + panel.offsetHeight > container.clientHeight - SNAP_DIST) {
                        newT = container.clientHeight - panel.offsetHeight - GAP;
                    }

                    // 🎯 FIX: Snap magnético entre paneles (Ahora con margen Y)
                    panels.forEach(other => {
                        if (other === panel) return;

                        // Colisiones en X
                        if (Math.abs(newL + panel.offsetWidth - (other.offsetLeft - GAP)) < SNAP_DIST) 
                            newL = other.offsetLeft - panel.offsetWidth - GAP;
                        if (Math.abs(newL - (other.offsetLeft + other.offsetWidth + GAP)) < SNAP_DIST) 
                            newL = other.offsetLeft + other.offsetWidth + GAP;
                        
                        // Colisiones en Y (Separación Superior e Inferior)
                        if (Math.abs(newT + panel.offsetHeight - (other.offsetTop - GAP)) < SNAP_DIST) 
                            newT = other.offsetTop - panel.offsetHeight - GAP;
                        if (Math.abs(newT - (other.offsetTop + other.offsetHeight + GAP)) < SNAP_DIST) 
                            newT = other.offsetTop + other.offsetHeight + GAP;
                        
                        // Alineación de bordes paralelos
                        if (Math.abs(newL - other.offsetLeft) < SNAP_DIST) newL = other.offsetLeft;
                        if (Math.abs(newT - other.offsetTop) < SNAP_DIST) newT = other.offsetTop;
                    });

                    panel.style.left = newL + 'px';
                    panel.style.top = newT + 'px';
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.userSelect = '';
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }

        // --------------------------------------------------------
        // LÓGICA DE REDIMENSIONAMIENTO BLINDADA
        // --------------------------------------------------------
        const handles = panel.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation(); // 🎯 FIX: Bloquea el evento para no arrastrar la pestaña por error
                document.body.style.userSelect = 'none';

                const type = handle.className.split(' ').find(c => c.startsWith('resize-handle-')).replace('resize-handle-', '');
                const startX = e.clientX;
                const startY = e.clientY;
                const startW = panel.offsetWidth;
                const startH = panel.offsetHeight;
                const startL = panel.offsetLeft;
                const startT = panel.offsetTop;

                const minW = parseInt(window.getComputedStyle(panel).minWidth) || 200;
                const minH = parseInt(window.getComputedStyle(panel).minHeight) || 150;

                const onMouseMove = (ev) => {
                    let nw = startW, nh = startH, nl = startL, nt = startT;

                    if (type.includes('e')) nw = startW + (ev.clientX - startX);
                    if (type.includes('s')) nh = startH + (ev.clientY - startY);
                    if (type.includes('w')) {
                        nw = startW - (ev.clientX - startX);
                        if (nw >= minW) nl = startL + (ev.clientX - startX);
                    }
                    if (type.includes('n')) {
                        nh = startH - (ev.clientY - startY);
                        if (nh >= minH) nt = startT + (ev.clientY - startY);
                    }

                    // 🎯 FIX: Respeta rigurosamente el ancho mínimo CSS
                    if (nw >= minW) { panel.style.width = nw + 'px'; panel.style.left = nl + 'px'; }
                    if (nh >= minH) { panel.style.height = nh + 'px'; panel.style.top = nt + 'px'; }

                    window.dispatchEvent(new Event('resize'));
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.userSelect = '';
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    });
});

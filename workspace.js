// ==========================================================================
// WORKSPACE MANAGER V1.1.14 (MOTOR RESTAURADO: UI, MEMORIA Y FÍSICA)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const panels = document.querySelectorAll('.workspace-panel');
    const togglesContainer = document.getElementById('top-center-toggles');
    let highestZIndex = 100;
    
    const SNAP_DIST = 15; 
    const GAP = 10; 

    // 1. Coordenadas base por si es la primera vez que se abre el programa
    const defaultLayout = {
        'panel-video': { left: 10, top: 10, width: 600, height: 400, visible: true },
        'panel-tracks': { left: 620, top: 10, width: 320, height: 250, visible: true },
        'panel-slider': { left: 620, top: 270, width: 80, height: 300, visible: true },
        'panel-quick': { left: 710, top: 270, width: 250, height: 140, visible: true },
        'panel-presets': { left: 710, top: 420, width: 250, height: 200, visible: true },
        'panel-timeline': { left: 10, top: 420, width: 600, height: 200, visible: true }
    };

    // 2. Recuperar memoria del navegador
    let layoutState = JSON.parse(localStorage.getItem('funscript_workspace_v2'));
    if (!layoutState) layoutState = defaultLayout;

    function saveLayout() {
        panels.forEach(panel => {
            layoutState[panel.id] = {
                left: panel.offsetLeft,
                top: panel.offsetTop,
                width: panel.offsetWidth,
                height: panel.offsetHeight,
                visible: panel.style.display !== 'none'
            };
        });
        localStorage.setItem('funscript_workspace_v2', JSON.stringify(layoutState));
    }

    panels.forEach(panel => {
        const id = panel.id;
        const title = panel.getAttribute('data-title');

        // 3. Crear los botones del menú superior automáticamente
        const btn = document.createElement('button');
        btn.className = 'toggle-panel-btn';
        btn.innerText = title;
        
        const state = layoutState[id] || defaultLayout[id] || { left: 10, top: 10, width: 300, height: 200, visible: true };
        
        if (state.visible) {
            btn.classList.add('active');
            panel.style.display = 'flex';
        } else {
            panel.style.display = 'none';
        }

        togglesContainer.appendChild(btn);

        btn.addEventListener('click', () => {
            const isVisible = panel.style.display !== 'none';
            if (isVisible) {
                panel.style.display = 'none';
                btn.classList.remove('active');
            } else {
                panel.style.display = 'flex';
                btn.classList.add('active');
                panel.style.zIndex = ++highestZIndex;
            }
            saveLayout();
            if (id === 'panel-timeline' || id === 'panel-video') {
                setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
            }
        });

        // 4. Inyectar bordes invisibles para redimensionar
        const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        directions.forEach(dir => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-handle-${dir}`;
            panel.appendChild(handle);
        });

        // 5. Aplicar tamaño y posición guardada
        panel.style.left = state.left + 'px';
        panel.style.top = state.top + 'px';
        panel.style.width = state.width + 'px';
        panel.style.height = state.height + 'px';

        // Poner la pestaña al frente si le das clic
        panel.addEventListener('mousedown', () => {
            panel.style.zIndex = ++highestZIndex;
        });

        // --------------------------------------------------------
        // LÓGICA DE ARRASTRE DE PESTAÑA (Física Restaurada)
        // --------------------------------------------------------
        const header = panel.querySelector('.panel-header');
        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                e.preventDefault();
                panel.style.zIndex = ++highestZIndex;

                let startX = e.clientX;
                let startY = e.clientY;
                let startLeft = panel.offsetLeft;
                let startTop = panel.offsetTop;
                
                document.body.style.userSelect = 'none';

                const onMouseMove = (ev) => {
                    let newL = startLeft + (ev.clientX - startX);
                    let newT = startTop + (ev.clientY - startY);

                    const container = panel.parentElement;
                    
                    // Snap a los bordes de la pantalla
                    if (newL < SNAP_DIST) newL = GAP;
                    if (newT < SNAP_DIST) newT = GAP;
                    if (newL + panel.offsetWidth > container.clientWidth - SNAP_DIST) {
                        newL = container.clientWidth - panel.offsetWidth - GAP;
                    }
                    if (newT + panel.offsetHeight > container.clientHeight - SNAP_DIST) {
                        newT = container.clientHeight - panel.offsetHeight - GAP;
                    }

                    // Snap equitativo entre paneles (Ejes X y Y con 10px de GAP)
                    panels.forEach(other => {
                        if (other === panel || other.style.display === 'none') return;

                        if (Math.abs(newL + panel.offsetWidth - (other.offsetLeft - GAP)) < SNAP_DIST) 
                            newL = other.offsetLeft - panel.offsetWidth - GAP;
                        if (Math.abs(newL - (other.offsetLeft + other.offsetWidth + GAP)) < SNAP_DIST) 
                            newL = other.offsetLeft + other.offsetWidth + GAP;
                        
                        if (Math.abs(newT + panel.offsetHeight - (other.offsetTop - GAP)) < SNAP_DIST) 
                            newT = other.offsetTop - panel.offsetHeight - GAP;
                        if (Math.abs(newT - (other.offsetTop + other.offsetHeight + GAP)) < SNAP_DIST) 
                            newT = other.offsetTop + other.offsetHeight + GAP;
                        
                        // Alineación paralela
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
                    saveLayout(); // Guardar nueva posición
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }

        // --------------------------------------------------------
        // LÓGICA DE REDIMENSIONAMIENTO (Blindada contra Bugs)
        // --------------------------------------------------------
        const handles = panel.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Evita que se dispare el arrastre del panel
                panel.style.zIndex = ++highestZIndex;
                document.body.style.userSelect = 'none';

                const type = handle.className.split(' ').find(c => c.startsWith('resize-handle-')).replace('resize-handle-', '');
                const startX = e.clientX;
                const startY = e.clientY;
                const startW = panel.offsetWidth;
                const startH = panel.offsetHeight;
                const startL = panel.offsetLeft;
                const startT = panel.offsetTop;

                // Límites mínimos de CSS (Panel Ajuste = 70px)
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

                    if (nw >= minW) { panel.style.width = nw + 'px'; panel.style.left = nl + 'px'; }
                    if (nh >= minH) { panel.style.height = nh + 'px'; panel.style.top = nt + 'px'; }

                    window.dispatchEvent(new Event('resize'));
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.userSelect = '';
                    saveLayout(); // Guardar nuevo tamaño
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    });

    // 6. Botón de Borrar Caché
    const cacheBtn = document.getElementById('menu-cache-btn');
    if (cacheBtn) {
        cacheBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('¿Restablecer paneles a sus posiciones de fábrica? (Esto no borra tus presets)')) {
                localStorage.removeItem('funscript_workspace_v2');
                location.reload();
            }
        });
    }
});

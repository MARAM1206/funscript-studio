// ==========================================================================
// WORKSPACE MANAGER V1.14.0 (100% RESPONSIVO, BARRERAS FÍSICAS Y MEMORIA)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const panels = document.querySelectorAll('.workspace-panel');
    const togglesContainer = document.getElementById('top-center-toggles');
    const saveLayoutBtn = document.getElementById('menu-save-layout-btn');
    const restoreLayoutBtn = document.getElementById('menu-restore-layout-btn');
    const fullscreenLayoutBtn = document.getElementById('menu-fullscreen-layout-btn');
    let highestZIndex = 100;
    
    const SNAP_DIST = 12; 
    const GAP = 10;       
    const VERSION = 'funscript_workspace_layout_v14'; 

    // 🎯 FIX: Fórmula Matemática para abarcar el 100% de la pantalla del usuario
    function getDefaultLayout() {
        const W = window.innerWidth;
        const topBarH = document.querySelector('.top-bar-menu')?.offsetHeight || 45;
        const H = window.innerHeight - topBarH;

        // Proporciones fluidas (18% Izq | 57% Centro | 25% Der)
        const L_W = Math.max(260, Math.min(320, W * 0.18));
        const R_W = Math.max(340, Math.min(420, W * 0.25));
        const C_W = Math.max(400, W - L_W - R_W - (4 * GAP));

        const L_H1 = (H - 4 * GAP) * 0.38; 
        const L_H2 = (H - 4 * GAP) * 0.27; 
        const L_H3 = (H - 4 * GAP) * 0.35; 

        const C_H1 = (H - 3 * GAP) * 0.68; 
        const C_H2 = (H - 3 * GAP) * 0.32; 

        const R_H1 = (H - 3 * GAP) * 0.55; 
        const R_H2 = (H - 3 * GAP) * 0.45; 

        const Slider_W = 80;
        const Presets_W = R_W - Slider_W - GAP;

        const cX = GAP + L_W + GAP;
        const rX = cX + C_W + GAP;

        return {
            'panel-tracks': { left: GAP, top: GAP, width: L_W, height: L_H1, visible: true },
            'panel-quick': { left: GAP, top: GAP + L_H1 + GAP, width: L_W, height: L_H2, visible: true },
            'panel-humanizer': { left: GAP, top: GAP + L_H1 + GAP + L_H2 + GAP, width: L_W, height: L_H3, visible: true },

            'panel-video': { left: cX, top: GAP, width: C_W, height: C_H1, visible: true },
            'panel-timeline': { left: cX, top: GAP + C_H1 + GAP, width: C_W, height: C_H2, visible: true },

            'panel-slider': { left: rX, top: GAP, width: Slider_W, height: R_H1, visible: true },
            'panel-presets': { left: rX + Slider_W + GAP, top: GAP, width: Presets_W, height: R_H1, visible: true },
            'panel-twin': { left: rX, top: GAP + R_H1 + GAP, width: R_W, height: R_H2, visible: true },

            'panel-bpm': { left: cX, top: GAP, width: 250, height: 260, visible: false },
            'panel-mass': { left: cX, top: GAP + 270, width: 250, height: 320, visible: false }
        };
    }

    let layoutState = JSON.parse(localStorage.getItem(VERSION));
    if (!layoutState) layoutState = getDefaultLayout();

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
        localStorage.setItem(VERSION, JSON.stringify(layoutState));
    }

    // 🎯 FIX: Sistema de Guardado y Restauración de Interfaz
    if (saveLayoutBtn) {
        saveLayoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveLayout();
            localStorage.setItem('funscript_layout_user_custom', JSON.stringify(layoutState));
            alert("✅ Acomodo de pestañas guardado correctamente. Si se desacomodan, usa 'Restaurar Acomodo'.");
        });
    }

    if (restoreLayoutBtn) {
        restoreLayoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            let custom = JSON.parse(localStorage.getItem('funscript_layout_user_custom'));
            if (custom) {
                localStorage.setItem(VERSION, JSON.stringify(custom));
            } else {
                alert("Aún no has guardado un acomodo personalizado. Se restaurará al valor por defecto.");
                localStorage.setItem(VERSION, JSON.stringify(getDefaultLayout()));
            }
            location.reload(); 
        });
    }

    if (fullscreenLayoutBtn) {
        fullscreenLayoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.setItem(VERSION, JSON.stringify(getDefaultLayout()));
            location.reload(); 
        });
    }

    // El borrado de caché salva los presets y el layout custom
    const cacheBtn = document.getElementById('menu-cache-btn');
    if (cacheBtn) {
        cacheBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('¿Borrar caché temporal y recargar? (Tus Presets y Acomodo NO se perderán)')) {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key !== 'funscript_presets' && key !== 'funscript_layout_user_custom') {
                        localStorage.removeItem(key);
                    }
                }
                location.reload(true);
            }
        });
    }

    const permanentPanels = ['panel-video', 'panel-timeline', 'panel-tracks', 'panel-presets'];

    panels.forEach(panel => {
        const id = panel.id;
        const title = panel.getAttribute('data-title');

        if (permanentPanels.includes(id)) {
            if (layoutState[id]) layoutState[id].visible = true;
        }

        const state = layoutState[id] || getDefaultLayout()[id];
        
        if (state.visible) panel.style.display = 'flex';
        else panel.style.display = 'none';

        if (!permanentPanels.includes(id)) {
            const btn = document.createElement('button');
            btn.className = 'toggle-panel-btn';
            btn.innerText = title;
            if (state.visible) btn.classList.add('active');
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
            });
        }

        const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        directions.forEach(dir => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-handle-${dir}`;
            panel.appendChild(handle);
        });

        // 🎯 FIX: Aplicación estricta de barreras físicas al cargar la página
        const W = window.innerWidth;
        const topBarH = document.querySelector('.top-bar-menu')?.offsetHeight || 45;
        const H = window.innerHeight - topBarH;

        let safeL = Math.max(GAP, Math.min(state.left, W - state.width - GAP));
        let safeT = Math.max(GAP, Math.min(state.top, H - state.height - GAP));

        panel.style.left = safeL + 'px';
        panel.style.top = safeT + 'px';
        panel.style.width = state.width + 'px';
        panel.style.height = state.height + 'px';

        panel.addEventListener('mousedown', () => {
            panel.style.zIndex = ++highestZIndex;
        });

        const header = panel.querySelector('.panel-header');
        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('.video-info-right') || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
                
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
                    
                    const WW = window.innerWidth;
                    const HH = window.innerHeight - topBarH;

                    // 🎯 FIX: Barreras de Cristal. Imposible salirse del monitor.
                    newL = Math.max(GAP, Math.min(newL, WW - panel.offsetWidth - GAP));
                    newT = Math.max(GAP, Math.min(newT, HH - panel.offsetHeight - GAP));

                    let newR = newL + panel.offsetWidth;
                    let newB = newT + panel.offsetHeight;

                    panels.forEach(other => {
                        if (other === panel || other.style.display === 'none') return;
                        let oL = other.offsetLeft, oT = other.offsetTop;
                        let oR = oL + other.offsetWidth, oB = oT + other.offsetHeight;

                        if (Math.abs(newR - (oL - GAP)) < SNAP_DIST) newL = oL - panel.offsetWidth - GAP; 
                        else if (Math.abs(newL - (oR + GAP)) < SNAP_DIST) newL = oR + GAP;                
                        else if (Math.abs(newL - oL) < SNAP_DIST) newL = oL;                              
                        else if (Math.abs(newR - oR) < SNAP_DIST) newL = oR - panel.offsetWidth;          

                        if (Math.abs(newB - (oT - GAP)) < SNAP_DIST) newT = oT - panel.offsetHeight - GAP; 
                        else if (Math.abs(newT - (oB + GAP)) < SNAP_DIST) newT = oB + GAP;                 
                        else if (Math.abs(newT - oT) < SNAP_DIST) newT = oT;                               
                        else if (Math.abs(newB - oB) < SNAP_DIST) newT = oB - panel.offsetHeight;          
                    });

                    // Re-verificar barreras tras imanes
                    newL = Math.max(GAP, Math.min(newL, WW - panel.offsetWidth - GAP));
                    newT = Math.max(GAP, Math.min(newT, HH - panel.offsetHeight - GAP));

                    panel.style.left = newL + 'px';
                    panel.style.top = newT + 'px';
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.userSelect = '';
                    saveLayout(); 
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }

        const handles = panel.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation(); 
                panel.style.zIndex = ++highestZIndex;
                document.body.style.userSelect = 'none';

                const type = handle.className.split(' ').find(c => c.startsWith('resize-handle-')).replace('resize-handle-', '');
                const startX = e.clientX;
                const startY = e.clientY;
                const startW = panel.offsetWidth;
                const startH = panel.offsetHeight;
                const startL = panel.offsetLeft;
                const startT = panel.offsetTop;

                const minW = parseInt(window.getComputedStyle(panel).minWidth) || 150;
                const minH = parseInt(window.getComputedStyle(panel).minHeight) || 150;
                const WW = window.innerWidth;
                const HH = window.innerHeight - topBarH;

                const onMouseMove = (ev) => {
                    let nw = startW, nh = startH, nl = startL, nt = startT;

                    if (type.includes('e')) {
                        let proposedR = startL + startW + (ev.clientX - startX);
                        let snappedR = Math.min(proposedR, WW - GAP);
                        
                        panels.forEach(other => {
                            if (other === panel || other.style.display === 'none') return;
                            let oL = other.offsetLeft, oR = oL + other.offsetWidth;
                            if (Math.abs(proposedR - (oL - GAP)) < SNAP_DIST) snappedR = oL - GAP; 
                            if (Math.abs(proposedR - oR) < SNAP_DIST) snappedR = oR;               
                        });
                        
                        let proposedW = snappedR - startL;
                        if (proposedW >= minW) nw = proposedW;
                    }
                    
                    if (type.includes('s')) {
                        let proposedB = startT + startH + (ev.clientY - startY);
                        let snappedB = Math.min(proposedB, HH - GAP);
                        
                        panels.forEach(other => {
                            if (other === panel || other.style.display === 'none') return;
                            let oT = other.offsetTop, oB = oT + other.offsetHeight;
                            if (Math.abs(proposedB - (oT - GAP)) < SNAP_DIST) snappedB = oT - GAP; 
                            if (Math.abs(proposedB - oB) < SNAP_DIST) snappedB = oB;               
                        });
                        
                        let proposedH = snappedB - startT;
                        if (proposedH >= minH) nh = proposedH;
                    }
                    
                    if (type.includes('w')) {
                        let proposedL = startL + (ev.clientX - startX);
                        let snappedL = Math.max(proposedL, GAP);
                        
                        panels.forEach(other => {
                            if (other === panel || other.style.display === 'none') return;
                            let oL = other.offsetLeft, oR = oL + other.offsetWidth;
                            if (Math.abs(proposedL - (oR + GAP)) < SNAP_DIST) snappedL = oR + GAP; 
                            if (Math.abs(proposedL - oL) < SNAP_DIST) snappedL = oL;               
                        });
                        
                        let proposedW = startW + (startL - snappedL);
                        if (proposedW >= minW) { nw = proposedW; nl = snappedL; }
                    }
                    
                    if (type.includes('n')) {
                        let proposedT = startT + (ev.clientY - startY);
                        let snappedT = Math.max(proposedT, GAP);
                        
                        panels.forEach(other => {
                            if (other === panel || other.style.display === 'none') return;
                            let oT = other.offsetTop, oB = oT + other.offsetHeight;
                            if (Math.abs(proposedT - (oB + GAP)) < SNAP_DIST) snappedT = oB + GAP; 
                            if (Math.abs(proposedT - oT) < SNAP_DIST) snappedT = oT;               
                        });
                        
                        let proposedH = startH + (startT - snappedT);
                        if (proposedH >= minH) { nh = proposedH; nt = snappedT; }
                    }

                    if (nw >= minW) { panel.style.width = nw + 'px'; panel.style.left = nl + 'px'; }
                    if (nh >= minH) { panel.style.height = nh + 'px'; panel.style.top = nt + 'px'; }

                    window.dispatchEvent(new Event('resize'));
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.userSelect = '';
                    saveLayout(); 
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    });
});

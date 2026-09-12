// ==========================================================================
// WORKSPACE MANAGER V1.12.0 (LIMPIEZA DE IA DIRECTOR)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const panels = document.querySelectorAll('.workspace-panel');
    const togglesContainer = document.getElementById('top-center-toggles');
    const resetBtn = document.getElementById('menu-reset-layout-btn');
    let highestZIndex = 100;
    
    const SNAP_DIST = 12; 
    const GAP = 10;       
    const VERSION = 'funscript_workspace_v11'; 

    const defaultLayout = {
        'panel-video': { left: 10, top: 10, width: 600, height: 400, visible: true },
        'panel-tracks': { left: 620, top: 10, width: 320, height: 250, visible: true },
        'panel-slider': { left: 620, top: 270, width: 80, height: 300, visible: true },
        'panel-quick': { left: 710, top: 270, width: 250, height: 140, visible: true },
        'panel-presets': { left: 710, top: 420, width: 250, height: 200, visible: true },
        'panel-twin': { left: 970, top: 270, width: 200, height: 350, visible: true },
        'panel-humanizer': { left: 970, top: 10, width: 250, height: 240, visible: true },
        'panel-bpm': { left: 350, top: 10, width: 250, height: 260, visible: false }, 
        'panel-mass': { left: 350, top: 220, width: 250, height: 320, visible: false }, 
        'panel-timeline': { left: 10, top: 420, width: 600, height: 200, visible: true }
    };

    let layoutState = JSON.parse(localStorage.getItem(VERSION));
    if (!layoutState) layoutState = JSON.parse(JSON.stringify(defaultLayout));

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

    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            layoutState = JSON.parse(JSON.stringify(defaultLayout));
            localStorage.setItem(VERSION, JSON.stringify(layoutState));
            location.reload(); 
        });
    }

    const permanentPanels = ['panel-video', 'panel-timeline', 'panel-tracks', 'panel-presets'];

    panels.forEach(panel => {
        const id = panel.id;
        const title = panel.getAttribute('data-title');

        if (permanentPanels.includes(id)) {
            if (layoutState[id]) layoutState[id].visible = true;
        }

        const state = layoutState[id] || defaultLayout[id] || { left: 10, top: 10, width: 300, height: 200, visible: true };
        
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

        panel.style.left = state.left + 'px';
        panel.style.top = state.top + 'px';
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
                let container = panel.parentElement;
                
                document.body.style.userSelect = 'none';

                const onMouseMove = (ev) => {
                    let newL = startLeft + (ev.clientX - startX);
                    let newT = startTop + (ev.clientY - startY);
                    let newR = newL + panel.offsetWidth;
                    let newB = newT + panel.offsetHeight;

                    if (Math.abs(newL) < SNAP_DIST) newL = GAP;
                    if (Math.abs(newT) < SNAP_DIST) newT = GAP;
                    if (Math.abs(container.clientWidth - newR) < SNAP_DIST) newL = container.clientWidth - panel.offsetWidth - GAP;
                    if (Math.abs(container.clientHeight - newB) < SNAP_DIST) newT = container.clientHeight - panel.offsetHeight - GAP;

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
                const container = panel.parentElement;

                const onMouseMove = (ev) => {
                    let nw = startW, nh = startH, nl = startL, nt = startT;

                    if (type.includes('e')) {
                        let proposedR = startL + startW + (ev.clientX - startX);
                        let snappedR = proposedR;
                        
                        if (Math.abs(container.clientWidth - proposedR) < SNAP_DIST) snappedR = container.clientWidth - GAP;
                        
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
                        let snappedB = proposedB;
                        
                        if (Math.abs(container.clientHeight - proposedB) < SNAP_DIST) snappedB = container.clientHeight - GAP;
                        
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
                        let snappedL = proposedL;
                        
                        if (Math.abs(proposedL) < SNAP_DIST) snappedL = GAP;
                        
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
                        let snappedT = proposedT;
                        
                        if (Math.abs(proposedT) < SNAP_DIST) snappedT = GAP;
                        
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

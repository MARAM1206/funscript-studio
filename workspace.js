// ==========================================================================
// WORKSPACE V3.0: SEPARACIÓN DE PANELES, TOGGLES OCULTABLES Y GAP AUTOMÁTICO
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector(".workspace-container");
    const toggleContainer = document.getElementById("top-center-toggles");
    if (!container || !toggleContainer) return;

    const panels = Array.from(document.querySelectorAll(".workspace-panel"));
    const GAP = 8; // Separación en píxeles entre paneles
    const SNAP_DIST = 15; // Fuerza del imán
    let topZIndex = 100;

    // Estado de visibilidad de paneles
    let panelVisibility = JSON.parse(localStorage.getItem("funscript_panel_visibility")) || {};

    // 1. GENERAR BOTONES PARA MOSTRAR/OCULTAR
    panels.forEach(panel => {
        const title = panel.getAttribute("data-title") || panel.id;
        
        // Si no existe en memoria, por defecto está visible
        if (panelVisibility[panel.id] === undefined) {
            panelVisibility[panel.id] = true;
        }

        const btn = document.createElement("button");
        btn.className = `toggle-panel-btn ${panelVisibility[panel.id] ? 'active' : ''}`;
        btn.innerText = title;
        btn.onclick = () => {
            panelVisibility[panel.id] = !panelVisibility[panel.id];
            btn.classList.toggle('active', panelVisibility[panel.id]);
            panel.style.display = panelVisibility[panel.id] ? 'flex' : 'none';
            localStorage.setItem("funscript_panel_visibility", JSON.stringify(panelVisibility));
        };
        toggleContainer.appendChild(btn);

        // Aplicar visibilidad inicial
        panel.style.display = panelVisibility[panel.id] ? 'flex' : 'none';
    });

    // 2. DISPOSICIÓN INICIAL (Calculada para incluir los GAPS)
    const w = container.clientWidth;
    const h = container.clientHeight;
    
    const defaultLayout = {
        "panel-video":    { left: GAP, top: GAP, width: (w * 0.42) - GAP*1.5, height: (h * 0.5) - GAP*1.5 },
        "panel-slider":   { left: (w * 0.42) + GAP/2, top: GAP, width: (w * 0.12) - GAP, height: (h * 0.5) - GAP*1.5 },
        "panel-presets":  { left: (w * 0.54) + GAP/2, top: GAP, width: (w * 0.23) - GAP, height: (h * 0.5) - GAP*1.5 },
        "panel-actions":  { left: (w * 0.77) + GAP/2, top: GAP, width: (w * 0.23) - GAP*1.5, height: (h * 0.5) - GAP*1.5 },
        "panel-controls": { left: GAP, top: (h * 0.5) + GAP/2, width: (w * 0.22) - GAP*1.5, height: (h * 0.5) - GAP*1.5 },
        "panel-tracks":   { left: (w * 0.22) + GAP/2, top: (h * 0.5) + GAP/2, width: (w * 0.20) - GAP, height: (h * 0.5) - GAP*1.5 },
        "panel-timeline": { left: (w * 0.42) + GAP/2, top: (h * 0.5) + GAP/2, width: (w * 0.58) - GAP*1.5, height: (h * 0.5) - GAP*1.5 }
    };

    let savedLayout = null;
    try { savedLayout = JSON.parse(localStorage.getItem("funscript_workspace_layout_v3")); } catch (e) {}

    if (!savedLayout || Object.keys(savedLayout).length < 7) {
        savedLayout = defaultLayout;
        // Transformar números a px
        for (let id in savedLayout) {
            savedLayout[id] = {
                left: `${savedLayout[id].left}px`, top: `${savedLayout[id].top}px`,
                width: `${savedLayout[id].width}px`, height: `${savedLayout[id].height}px`
            };
        }
        localStorage.setItem("funscript_workspace_layout_v3", JSON.stringify(savedLayout));
    }

    // 3. APLICAR POSICIONES Y LÓGICA DE ARRASTRE
    panels.forEach(panel => {
        const pos = savedLayout[panel.id];
        if (pos) {
            panel.style.left = pos.left; panel.style.top = pos.top;
            panel.style.width = pos.width; panel.style.height = pos.height;
        }

        panel.addEventListener("mousedown", () => {
            topZIndex++; panel.style.zIndex = topZIndex;
        });

        // Crear encabezado de arrastre
        if (!panel.querySelector(".panel-header")) {
            const title = panel.getAttribute("data-title") || "Panel";
            const header = document.createElement("div");
            header.className = "panel-header";
            header.innerHTML = `<span>${title}</span>`;
            panel.insertBefore(header, panel.firstChild);

            let isDragging = false;
            let startX, startY, startLeft, startTop;

            header.addEventListener("mousedown", (e) => {
                isDragging = true; topZIndex++; panel.style.zIndex = topZIndex;
                startX = e.clientX; startY = e.clientY;
                startLeft = panel.offsetLeft; startTop = panel.offsetTop;

                const onMouseMove = (moveEvent) => {
                    if (!isDragging) return;
                    let newLeft = startLeft + (moveEvent.clientX - startX);
                    let newTop = startTop + (moveEvent.clientY - startY);

                    // Ajuste Magnético (Snapping) respetando el GAP
                    panels.forEach(other => {
                        if (other === panel || other.style.display === 'none') return;
                        const oL = other.offsetLeft; const oR = oL + other.offsetWidth;
                        const oT = other.offsetTop; const oB = oT + other.offsetHeight;

                        // Imán Eje X
                        if (Math.abs(newLeft - (oR + GAP)) < SNAP_DIST) newLeft = oR + GAP;
                        if (Math.abs((newLeft + panel.offsetWidth + GAP) - oL) < SNAP_DIST) newLeft = oL - panel.offsetWidth - GAP;
                        // Imán Eje Y
                        if (Math.abs(newTop - (oB + GAP)) < SNAP_DIST) newTop = oB + GAP;
                        if (Math.abs((newTop + panel.offsetHeight + GAP) - oT) < SNAP_DIST) newTop = oT - panel.offsetHeight - GAP;
                    });

                    // Límites de pantalla (también con GAP)
                    newLeft = Math.max(GAP, Math.min(container.clientWidth - panel.offsetWidth - GAP, newLeft));
                    newTop = Math.max(GAP, Math.min(container.clientHeight - panel.offsetHeight - GAP, newTop));

                    panel.style.left = `${newLeft}px`; panel.style.top = `${newTop}px`;
                };

                const onMouseUp = () => {
                    if (isDragging) {
                        isDragging = false;
                        document.removeEventListener("mousemove", onMouseMove);
                        document.removeEventListener("mouseup", onMouseUp);
                        saveCurrentLayout(); window.dispatchEvent(new Event('resize'));
                    }
                };

                document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onMouseUp);
            });
        }

        // Crear manijas de redimensionado (8 lados)
        const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        directions.forEach(dir => {
            if (!panel.querySelector(`.resize-handle-${dir}`)) {
                const handle = document.createElement("div");
                handle.className = `resize-handle resize-handle-${dir}`;
                panel.appendChild(handle);

                handle.addEventListener("mousedown", (e) => {
                    e.stopPropagation(); topZIndex++; panel.style.zIndex = topZIndex;
                    const sX = e.clientX; const sY = e.clientY;
                    const sW = panel.offsetWidth; const sH = panel.offsetHeight;
                    const sL = panel.offsetLeft; const sT = panel.offsetTop;

                    const onResizeMove = (moveEvent) => {
                        const dx = moveEvent.clientX - sX; const dy = moveEvent.clientY - sY;
                        let nw = sW; let nh = sH; let nl = sL; let nt = sT;

                        if (dir.includes('e')) nw = Math.max(120, sW + dx);
                        if (dir.includes('s')) nh = Math.max(100, sH + dy);
                        if (dir.includes('w')) { const possW = sW - dx; if (possW > 120) { nw = possW; nl = sL + dx; } }
                        if (dir.includes('n')) { const possH = sH - dy; if (possH > 100) { nh = possH; nt = sT + dy; } }

                        panel.style.width = `${nw}px`; panel.style.height = `${nh}px`;
                        panel.style.left = `${nl}px`; panel.style.top = `${nt}px`;
                    };

                    const onResizeUp = () => {
                        document.removeEventListener("mousemove", onResizeMove);
                        document.removeEventListener("mouseup", onResizeUp);
                        saveCurrentLayout(); window.dispatchEvent(new Event('resize'));
                    };

                    document.addEventListener("mousemove", onResizeMove); document.addEventListener("mouseup", onResizeUp);
                });
            }
        });
    });

    function saveCurrentLayout() {
        const layoutToSave = {};
        panels.forEach(panel => {
            layoutToSave[panel.id] = {
                left: panel.style.left, top: panel.style.top,
                width: panel.style.width, height: panel.style.height
            };
        });
        localStorage.setItem("funscript_workspace_layout_v3", JSON.stringify(layoutToSave));
    }
});

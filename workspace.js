// ==========================================================================
// WORKSPACE V2.1: MOTOR COMPLETO DE ARRASTRE, REDIMENSIONADO 8D Y MAGNETISMO
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector(".workspace-container");
    if (!container) return;

    const panels = document.querySelectorAll(".workspace-panel");
    const SNAP_DIST = 10; // Distancia en píxeles para el ajuste magnético
    let topZIndex = 100;

    // Disposición inicial óptima para los 7 paneles cubriendo la pantalla
    const defaultLayout = {
        "panel-video":    { left: "0%",  top: "0%",  width: "42%", height: "50%" },
        "panel-slider":   { left: "42%", top: "0%",  width: "12%", height: "50%" },
        "panel-presets":  { left: "54%", top: "0%",  width: "23%", height: "50%" },
        "panel-actions":  { left: "77%", top: "0%",  width: "23%", height: "50%" },
        "panel-controls": { left: "0%",  top: "50%", width: "22%", height: "50%" },
        "panel-tracks":   { left: "22%", top: "50%", width: "20%", height: "50%" },
        "panel-timeline": { left: "42%", top: "50%", width: "58%", height: "50%" }
    };

    // Verificar si la memoria guardada tiene los 7 paneles; si no, resetear a por defecto
    let savedLayout = null;
    try {
        savedLayout = JSON.parse(localStorage.getItem("funscript_workspace_layout_v21"));
    } catch (e) { savedLayout = null; }

    if (!savedLayout || Object.keys(savedLayout).length < 7) {
        savedLayout = defaultLayout;
        localStorage.setItem("funscript_workspace_layout_v21", JSON.stringify(defaultLayout));
    }

    // Aplicar posiciones a cada panel
    panels.forEach(panel => {
        const id = panel.id;
        const pos = savedLayout[id] || defaultLayout[id];

        if (pos) {
            panel.style.left = pos.left;
            panel.style.top = pos.top;
            panel.style.width = pos.width;
            panel.style.height = pos.height;
        }

        // Elevar panel al hacer clic sobre él
        panel.addEventListener("mousedown", () => {
            topZIndex++;
            panel.style.zIndex = topZIndex;
        });

        // 1. CREAR ENCABEZADO DE ARRASTRE SI NO EXISTE
        if (!panel.querySelector(".panel-header")) {
            const title = panel.getAttribute("data-title") || "Panel";
            const header = document.createElement("div");
            header.className = "panel-header";
            header.innerHTML = `<span>${title}</span>`;
            panel.insertBefore(header, panel.firstChild);

            let isDragging = false;
            let startX, startY, startLeft, startTop;

            header.addEventListener("mousedown", (e) => {
                isDragging = true;
                topZIndex++;
                panel.style.zIndex = topZIndex;

                startX = e.clientX;
                startY = e.clientY;
                startLeft = panel.offsetLeft;
                startTop = panel.offsetTop;

                const onMouseMove = (moveEvent) => {
                    if (!isDragging) return;
                    let newLeft = startLeft + (moveEvent.clientX - startX);
                    let newTop = startTop + (moveEvent.clientY - startY);

                    const maxLeft = container.clientWidth - panel.offsetWidth;
                    const maxTop = container.clientHeight - panel.offsetHeight;

                    newLeft = Math.max(0, Math.min(maxLeft, newLeft));
                    newTop = Math.max(0, Math.min(maxTop, newTop));

                    // Ajuste Magnético (Snapping) con otros paneles y bordes
                    panels.forEach(other => {
                        if (other === panel) return;
                        const oL = other.offsetLeft;
                        const oR = oL + other.offsetWidth;
                        const oT = other.offsetTop;
                        const oB = oT + other.offsetHeight;

                        if (Math.abs(newLeft - oR) < SNAP_DIST) newLeft = oR;
                        if (Math.abs((newLeft + panel.offsetWidth) - oL) < SNAP_DIST) newLeft = oL - panel.offsetWidth;
                        if (Math.abs(newTop - oB) < SNAP_DIST) newTop = oB;
                        if (Math.abs((newTop + panel.offsetHeight) - oT) < SNAP_DIST) newTop = oT - panel.offsetHeight;
                    });

                    panel.style.left = `${newLeft}px`;
                    panel.style.top = `${newTop}px`;
                };

                const onMouseUp = () => {
                    if (isDragging) {
                        isDragging = false;
                        document.removeEventListener("mousemove", onMouseMove);
                        document.removeEventListener("mouseup", onMouseUp);
                        saveCurrentLayout();
                        window.dispatchEvent(new Event('resize'));
                    }
                };

                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
            });
        }

        // 2. CREAR MANIJAS DE REDIMENSIONADO EN LOS 8 BORDES Y ESQUINAS
        const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        directions.forEach(dir => {
            if (!panel.querySelector(`.resize-handle-${dir}`)) {
                const handle = document.createElement("div");
                handle.className = `resize-handle resize-handle-${dir}`;
                panel.appendChild(handle);

                handle.addEventListener("mousedown", (e) => {
                    e.stopPropagation();
                    topZIndex++;
                    panel.style.zIndex = topZIndex;

                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startWidth = panel.offsetWidth;
                    const startHeight = panel.offsetHeight;
                    const startLeft = panel.offsetLeft;
                    const startTop = panel.offsetTop;

                    const onResizeMove = (moveEvent) => {
                        const dx = moveEvent.clientX - startX;
                        const dy = moveEvent.clientY - startY;

                        let nw = startWidth;
                        let nh = startHeight;
                        let nl = startLeft;
                        let nt = startTop;

                        if (dir.includes('e')) nw = Math.max(120, startWidth + dx);
                        if (dir.includes('s')) nh = Math.max(100, startHeight + dy);
                        if (dir.includes('w')) {
                            const possibleW = startWidth - dx;
                            if (possibleW > 120) {
                                nw = possibleW;
                                nl = startLeft + dx;
                            }
                        }
                        if (dir.includes('n')) {
                            const possibleH = startHeight - dy;
                            if (possibleH > 100) {
                                nh = possibleH;
                                nt = startTop + dy;
                            }
                        }

                        panel.style.width = `${nw}px`;
                        panel.style.height = `${nh}px`;
                        panel.style.left = `${nl}px`;
                        panel.style.top = `${nt}px`;

                        window.dispatchEvent(new Event('resize'));
                    };

                    const onResizeUp = () => {
                        document.removeEventListener("mousemove", onResizeMove);
                        document.removeEventListener("mouseup", onResizeUp);
                        saveCurrentLayout();
                        window.dispatchEvent(new Event('resize'));
                    };

                    document.addEventListener("mousemove", onResizeMove);
                    document.addEventListener("mouseup", onResizeUp);
                });
            }
        });
    });

    // Guardar posicionado en memoria
    function saveCurrentLayout() {
        const layoutToSave = {};
        panels.forEach(panel => {
            layoutToSave[panel.id] = {
                left: panel.style.left,
                top: panel.style.top,
                width: panel.style.width,
                height: panel.style.height
            };
        });
        localStorage.setItem("funscript_workspace_layout_v21", JSON.stringify(layoutToSave));
    }
});

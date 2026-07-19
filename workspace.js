// ==========================================================================
// CEREBRO DE WORKSPACE: IMÁN MAGNÉTICO, REDIMENSIONADO PERIMETRAL Y MODULAR
// ==========================================================================

const styleSheet = document.createElement("style");
styleSheet.innerText = `
    body {
        margin: 0; padding: 0;
        background-color: #080b11;
        overflow: hidden; height: 100vh;
    }
    .top-bar-menu {
        height: 38px; background: #0f131a;
        border-bottom: 1px solid #1e2430;
        display: flex; align-items: center; padding: 0 15px; gap: 8px; z-index: 9999; position: relative;
    }
    .top-bar-title { color: #4b5563; font-weight: 700; font-size: 0.8rem; margin-right: 15px; font-family: monospace; }
    .toggle-panel-btn {
        background: #1e2430; color: #94a3b8; border: 1px solid #2e3748;
        padding: 3px 9px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: 600;
    }
    .toggle-panel-btn.active { background: #2563eb; color: white; border-color: #3b82f6; }
    .workspace-container { position: relative; width: 100vw; height: calc(100vh - 38px); overflow: hidden; }
    
    /* Panel Rediseñado: Sin título visual, cabecera ultra delgada */
    .workspace-panel {
        position: absolute; background: #0f131a; border: 1px solid #222b3c;
        border-radius: 4px; display: flex; flex-direction: column; overflow: visible; z-index: 10;
        box-shadow: 0 15px 25px -5px rgba(0,0,0,0.6);
    }
    .panel-header {
        height: 8px; background: #1a202c; cursor: move; user-select: none;
        position: relative; border-bottom: 1px solid #222b3c; width: 100%;
    }
    .panel-content { padding: 10px; flex-grow: 1; overflow: hidden; display: flex; flex-direction: column; gap: 6px; height: calc(100% - 8px); }
    
    /* CAPAS INVISIBLES PERIMETRALES PARA REDIMENSIONAR DESDE CUALQUIER BORDE */
    .edge-resizer { position: absolute; background: transparent; z-index: 999; }
    .edge-resizer.t  { top: -4px; left: 4px; right: 4px; height: 6px; cursor: n-resize; }
    .edge-resizer.b  { bottom: -4px; left: 4px; right: 4px; height: 6px; cursor: s-resize; }
    .edge-resizer.l  { left: -4px; top: 4px; bottom: 4px; width: 6px; cursor: w-resize; }
    .edge-resizer.r  { right: -4px; top: 4px; bottom: 4px; width: 6px; cursor: e-resize; }
    .edge-resizer.tl { top: -4px; left: -4px; width: 8px; height: 8px; cursor: nw-resize; }
    .edge-resizer.tr { top: -4px; right: -4px; width: 8px; height: 8px; cursor: ne-resize; }
    .edge-resizer.bl { bottom: -4px; left: -4px; width: 8px; height: 8px; cursor: sw-resize; }
    .edge-resizer.br { bottom: -4px; right: -4px; width: 8px; height: 8px; cursor: se-resize; }

    video, canvas { width: 100% !important; height: 100% !important; background: #000; }
`;
document.head.appendChild(styleSheet);

const initialLayout = {
    "panel-video":    { top: 15,  left: 15,  w: 520, h: 380 },
    "panel-keyboard": { top: 15,  left: 550, w: 340, h: 200 },
    "panel-actions":  { top: 230, left: 550, w: 340, h: 165 },
    "panel-presets":  { top: 15,  left: 905, w: 340, h: 380 },
    "panel-timeline": { top: 410, left: 15,  w: 1230, h: 240 }
};

let highestZIndex = 10;
const SNAP_THRESHOLD = 12; // Imán de acoplamiento a menos de 12 píxeles

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("workspace");
    
    const topBar = document.createElement("div");
    topBar.className = "top-bar-menu";
    topBar.innerHTML = `<div class="top-bar-title">FUNSCRIPT STUDIO</div>`;
    document.body.insertBefore(topBar, container);

    const panels = document.querySelectorAll(".workspace-panel");

    // Lógica del Imán Magnético (Compara bordes con los otros paneles visibles)
    function applyMagneticSnapping(panel, newLeft, newTop, width, height) {
        let snappedLeft = newLeft;
        let snappedTop = newTop;

        panels.forEach(other => {
            if (other === panel || other.style.display === "none") return;

            const oL = other.offsetLeft;
            const oT = other.offsetTop;
            const oR = oL + other.offsetWidth;
            const oB = oT + other.offsetHeight;

            // Alineación Eje Horizontal (Izquierda / Derecha)
            if (Math.abs(newLeft - oL) < SNAP_THRESHOLD) snappedLeft = oL;
            else if (Math.abs(newLeft - oR) < SNAP_THRESHOLD) snappedLeft = oR;
            else if (Math.abs((newLeft + width) - oL) < SNAP_THRESHOLD) snappedLeft = oL - width;
            else if (Math.abs((newLeft + width) - oR) < SNAP_THRESHOLD) snappedLeft = oR - width;

            // Alineación Eje Vertical (Superior / Inferior)
            if (Math.abs(newTop - oT) < SNAP_THRESHOLD) snappedTop = oT;
            else if (Math.abs(newTop - oB) < SNAP_THRESHOLD) snappedTop = oB;
            else if (Math.abs((newTop + height) - oT) < SNAP_THRESHOLD) snappedTop = oT - height;
            else if (Math.abs((newTop + height) - oB) < SNAP_THRESHOLD) snappedTop = oB - height;
        });

        return { x: snappedLeft, y: snappedTop };
    }

    panels.forEach(panel => {
        const id = panel.id;
        const config = initialLayout[id] || { top: 40, left: 40, w: 300, h: 200 };
        const title = panel.getAttribute("data-title") || "Módulo";

        panel.style.top = `${config.top}px`;
        panel.style.left = `${config.left}px`;
        panel.style.width = `${config.w}px`;
        panel.style.height = `${config.h}px`;

        const header = panel.querySelector(".panel-header");

        // Generar botones en barra superior usando la metadata
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "toggle-panel-btn active";
        toggleBtn.innerText = title;
        topBar.appendChild(toggleBtn);

        const toggleVisibility = () => {
            if (panel.style.display === "none") {
                panel.style.display = "flex";
                toggleBtn.classList.add("active");
                panel.style.zIndex = ++highestZIndex;
                window.dispatchEvent(new Event('resize'));
            } else {
                panel.style.display = "none";
                toggleBtn.classList.remove("active");
            }
        };
        toggleBtn.addEventListener("click", toggleVisibility);
        panel.addEventListener("mousedown", () => { panel.style.zIndex = ++highestZIndex; });

        // ARRASTRE CON IMÁN INCORPORADO
        header.addEventListener("mousedown", (e) => {
            e.preventDefault();
            panel.style.zIndex = ++highestZIndex;
            let startX = e.clientX;
            let startY = e.clientY;

            const mouseMoveHandler = (moveEvent) => {
                let dx = moveEvent.clientX - startX;
                let dy = moveEvent.clientY - startY;

                let targetLeft = panel.offsetLeft + dx;
                let targetTop = panel.offsetTop + dy;

                // Ejecutar cálculo del imán
                let snapped = applyMagneticSnapping(panel, targetLeft, targetTop, panel.offsetWidth, panel.offsetHeight);

                panel.style.left = `${Math.max(0, snapped.x)}px`;
                panel.style.top = `${Math.max(0, snapped.y)}px`;

                startX = moveEvent.clientX;
                startY = moveEvent.clientY;
                window.dispatchEvent(new Event('resize'));
            };

            const mouseUpHandler = () => {
                document.removeEventListener("mousemove", mouseMoveHandler);
                document.removeEventListener("mouseup", mouseUpHandler);
                window.dispatchEvent(new Event('resize'));
            };

            document.addEventListener("mousemove", mouseMoveHandler);
            document.addEventListener("mouseup", mouseUpHandler);
        });

        // INYECCIÓN DE 8 MANILLAS DE REDIMENSIONAMIENTO PERIMETRAL
        const directions = ['t', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br'];
        directions.forEach(dir => {
            const resizer = document.createElement("div");
            resizer.className = `edge-resizer ${dir}`;
            panel.appendChild(resizer);

            resizer.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();
                panel.style.zIndex = ++highestZIndex;

                let startW = panel.offsetWidth;
                let startH = panel.offsetHeight;
                let startX = e.clientX;
                let startY = e.clientY;
                let startLeft = panel.offsetLeft;
                let startTop = panel.offsetTop;

                const resizeMoveHandler = (moveEvent) => {
                    let dw = moveEvent.clientX - startX;
                    let dh = moveEvent.clientY - startY;
                    
                    let nw = startW, nh = startH, nl = startLeft, nt = startTop;

                    if (dir.includes('r')) nw = Math.max(220, startW + dw);
                    if (dir.includes('b')) nh = Math.max(120, startH + dh);
                    
                    if (dir.includes('l')) {
                        let potentialW = startW - dw;
                        if (potentialW >= 220) { nw = potentialW; nl = startLeft + dw; }
                    }
                    if (dir.includes('t')) {
                        let potentialH = startH - dh;
                        if (potentialH >= 120) { nh = potentialH; nt = startTop + dh; }
                    }

                    // El imán también asiste al cambiar el tamaño de los extremos libres
                    let snapped = applyMagneticSnapping(panel, nl, nt, nw, nh);
                    
                    panel.style.width = `${nw}px`;
                    panel.style.height = `${nh}px`;
                    panel.style.left = `${snapped.x}px`;
                    panel.style.top = `${snapped.y}px`;

                    window.dispatchEvent(new Event('resize'));
                };

                const resizeUpHandler = () => {
                    document.removeEventListener("mousemove", resizeMoveHandler);
                    document.removeEventListener("mouseup", resizeUpHandler);
                    window.dispatchEvent(new Event('resize'));
                };

                document.addEventListener("mousemove", resizeMoveHandler);
                document.addEventListener("mouseup", resizeUpHandler);
            });
        });
    });
});

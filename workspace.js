// ==========================================================================
// CEREBRO WORKSPACE V1.3: IMÁN PERIMETRAL DE REDIMENSIONADO Y COBERTURA DE PANTALLA
// ==========================================================================

const styleSheet = document.createElement("style");
styleSheet.innerText = `
    html, body {
        margin: 0; padding: 0; width: 100vw; height: 100vh;
        background-color: #06090e; overflow: hidden;
        font-family: system-ui, -apple-system, sans-serif;
    }
    .top-bar-menu {
        height: 44px; background: #0b0f17; border-bottom: 1px solid #141b29;
        display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 9999; position: relative;
    }
    .top-center-toggles { display: flex; gap: 6px; }
    
    .menu-btn {
        color: white; border: none; padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: background 0.2s;
    }
    .success-btn { background: #059669; } .success-btn:hover { background: #047857; }
    .select-btn { background: #2563eb; display: inline-block; text-align: center; } .select-btn:hover { background: #1d4ed8; }
    
    .toggle-panel-btn {
        background: #141b29; color: #94a3b8; border: 1px solid #1e293b;
        padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; font-weight: 600;
    }
    .toggle-panel-btn.active { background: #2563eb; color: white; border-color: #3b82f6; }
    
    .workspace-container { position: relative; width: 100vw; height: calc(100vh - 44px); margin: 0; padding: 0; overflow: hidden; }
    
    /* MODULOS GOOGLE MODERNOS: Cero marcos superiores vacíos, esquinas pulidas */
    .workspace-panel {
        position: absolute; background: #0f131a; border: none !important;
        border-radius: 14px; display: flex; flex-direction: column; overflow: visible; z-index: 10;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
    }
    
    /* Todo el cuerpo interior se vuelve sensible al arrastre si no clickeas controles */
    .panel-content { padding: 14px; flex-grow: 1; overflow: hidden; display: flex; flex-direction: column; gap: 6px; height: 100%; border-radius: 14px; }
    
    .edge-resizer { position: absolute; background: transparent; z-index: 999; }
    .edge-resizer.t  { top: -4px; left: 8px; right: 8px; height: 8px; cursor: n-resize; }
    .edge-resizer.b  { bottom: -4px; left: 8px; right: 8px; height: 8px; cursor: s-resize; }
    .edge-resizer.l  { left: -4px; top: 8px; bottom: 8px; width: 8px; cursor: w-resize; }
    .edge-resizer.r  { right: -4px; top: 8px; bottom: 8px; width: 8px; cursor: e-resize; }
    .edge-resizer.tl { top: -4px; left: -4px; width: 10px; height: 10px; cursor: nw-resize; }
    .edge-resizer.tr { top: -4px; right: -4px; width: 10px; height: 10px; cursor: ne-resize; }
    .edge-resizer.bl { bottom: -4px; left: -4px; width: 10px; height: 10px; cursor: sw-resize; }
    .edge-resizer.br { bottom: -4px; right: -4px; width: 10px; height: 10px; cursor: se-resize; }

    video, canvas { width: 100% !important; height: 100% !important; background: #000; border-radius: 8px; }
`;
document.head.appendChild(styleSheet);

const initialLayout = {
    "panel-video":    { top: 12,  left: 12,  w: 540, h: 390 },
    "panel-keyboard": { top: 12,  left: 562, w: 350, h: 200 },
    "panel-actions":  { top: 222, left: 562, w: 350, h: 180 },
    "panel-presets":  { top: 12,  left: 922, w: 340, h: 390 },
    "panel-timeline": { top: 412, left: 12,  w: 1250, h: 250 }
};

let highestZIndex = 10;
const SNAP_DIST = 12;
const TRACK_GAP = 10;

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("workspace");
    const topCenter = document.getElementById("top-center-toggles");
    const panels = document.querySelectorAll(".workspace-panel");

    function calculateSnap(panel, idealX, idealY, w, h) {
        let finalX = idealX;
        let finalY = idealY;

        panels.forEach(other => {
            if (other === panel || other.style.display === "none") return;

            const oL = other.offsetLeft;
            const oT = other.offsetTop;
            const oR = oL + other.offsetWidth;
            const oB = oT + other.offsetHeight;

            if (Math.abs(idealX - oL) < SNAP_DIST) finalX = oL;
            else if (Math.abs(idealX - oR) < SNAP_DIST) finalX = oR;
            else if (Math.abs(idealX - (oR + TRACK_GAP)) < SNAP_DIST) finalX = oR + TRACK_GAP;
            else if (Math.abs((idealX + w) - oL) < SNAP_DIST) finalX = oL - w;
            else if (Math.abs((idealX + w) - (oL - TRACK_GAP)) < SNAP_DIST) finalX = oL - w - TRACK_GAP;

            if (Math.abs(idealY - oT) < SNAP_DIST) finalY = oT;
            else if (Math.abs(idealY - oB) < SNAP_DIST) finalY = oB;
            else if (Math.abs(idealY - (oB + TRACK_GAP)) < SNAP_DIST) finalY = oB + TRACK_GAP;
            else if (Math.abs((idealY + h) - oT) < SNAP_DIST) finalY = oT - h;
            else if (Math.abs((idealY + h) - (oT - TRACK_GAP)) < SNAP_DIST) finalY = oT - h - TRACK_GAP;
        });

        return { x: finalX, y: finalY };
    }

    panels.forEach(panel => {
        const id = panel.id;
        const config = initialLayout[id] || { top: 20, left: 20, w: 400, h: 300 };
        const title = panel.getAttribute("data-title") || "Módulo";

        panel.style.top = `${config.top}px`;
        panel.style.left = `${config.left}px`;
        panel.style.width = `${config.w}px`;
        panel.style.height = `${config.h}px`;

        const toggleBtn = document.createElement("button");
        toggleBtn.className = "toggle-panel-btn active";
        toggleBtn.innerText = title;
        if (topCenter) topCenter.appendChild(toggleBtn);

        toggleBtn.addEventListener("click", () => {
            if (panel.style.display === "none") {
                panel.style.display = "flex";
                toggleBtn.classList.add("active");
                panel.style.zIndex = ++highestZIndex;
                window.dispatchEvent(new Event('resize'));
            } else {
                panel.style.display = "none";
                toggleBtn.classList.remove("active");
            }
        });

        // CONTROL DE ARRASTRE DIRECTO POR CUERPO DEL PANEL INTERIOR
        panel.addEventListener("mousedown", (e) => {
            panel.style.zIndex = ++highestZIndex;
            
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || 
                e.target.tagName === 'BUTTON' || e.target.tagName === 'VIDEO' || 
                e.target.tagName === 'CANVAS' || e.target.classList.contains('edge-resizer') ||
                e.target.classList.contains('btn') || e.target.classList.contains('key') ||
                e.target.closest('.log-container') || e.target.closest('.presets-grid')) return;

            e.preventDefault();
            
            let mouseStartX = e.clientX;
            let mouseStartY = e.clientY;
            let panelStartX = panel.offsetLeft;
            let panelStartY = panel.offsetTop;

            const mouseMoveHandler = (moveEvent) => {
                let idealLeft = panelStartX + (moveEvent.clientX - mouseStartX);
                let idealTop = panelStartY + (moveEvent.clientY - mouseStartY);

                // CONTROL CORREGIDO PARA 27 PULGADAS: Límites exactos contra los bordes del contenedor
                const maxLeft = container.clientWidth - panel.offsetWidth;
                const maxTop = container.clientHeight - panel.offsetHeight;

                if (idealLeft < 0) idealLeft = 0;
                if (idealTop < 0) idealTop = 0;
                if (idealLeft > maxLeft) idealLeft = maxLeft;
                if (idealTop > maxTop) idealTop = maxTop;

                let snapped = calculateSnap(panel, idealLeft, idealTop, panel.offsetWidth, panel.offsetHeight);
                
                // Si el ratón supera el rango de atracción del imán, se desliza libremente de inmediato
                if (Math.abs(idealLeft - snapped.x) > SNAP_DIST) snapped.x = idealLeft;
                if (Math.abs(idealTop - snapped.y) > SNAP_DIST) snapped.y = idealTop;

                panel.style.left = `${snapped.x}px`;
                panel.style.top = `${snapped.y}px`;
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

        // REDIMENSIONADO PERIMETRAL INTEGRADO CON SISTEMA DE IMÁN
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

                    if (dir.includes('r')) nw = Math.max(200, startW + dw);
                    if (dir.includes('b')) nh = Math.max(100, startH + dh);
                    
                    if (dir.includes('l')) {
                        let potentialW = startW - dw;
                        if (potentialW >= 200) { nw = potentialW; nl = startLeft + dw; }
                    }
                    if (dir.includes('t')) {
                        let potentialH = startH - dh;
                        if (potentialH >= 100) { nh = potentialH; nt = startTop + dh; }
                    }

                    // Topes perimetrales en redimensionamiento
                    if (nl < 0) { nw += nl; nl = 0; }
                    if (nt < 0) { nh += nt; nt = 0; }
                    if (nl + nw > container.clientWidth) nw = container.clientWidth - nl;
                    if (nt + nh > container.clientHeight) nh = container.clientHeight - nt;

                    // El imán asiste al tamaño aplicando física de acoplamiento simétrico
                    let snapped = calculateSnap(panel, nl, nt, nw, nh);
                    
                    if (Math.abs(nl - snapped.x) <= SNAP_DIST) { nw += (nl - snapped.x); nl = snapped.x; }
                    if (Math.abs(nt - snapped.y) <= SNAP_DIST) { nh += (nt - snapped.y); nt = snapped.y; }

                    panel.style.width = `${nw}px`;
                    panel.style.height = `${nh}px`;
                    panel.style.left = `${nl}px`;
                    panel.style.top = `${nt}px`;

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

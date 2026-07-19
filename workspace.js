// ==========================================================================
// CEREBRO DE WORKSPACE V1.2: DISEÑO GOOGLE, IMÁN DESPEGABLE Y TOPE 100% REAL
// ==========================================================================

const styleSheet = document.createElement("style");
styleSheet.innerText = `
    body {
        margin: 0; padding: 0;
        background-color: #06090e;
        overflow: hidden; height: 100vh;
        font-family: system-ui, -apple-system, sans-serif;
    }
    .top-bar-menu {
        height: 44px; background: #0b0f17;
        border-bottom: 1px solid #161f30;
        display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 9999; position: relative;
    }
    .top-center-toggles { display: flex; gap: 6px; }
    .top-bar-title { color: #475569; font-weight: 700; font-size: 0.8rem; font-family: monospace; letter-spacing: 1px; }
    
    /* BOTONES ESTILO MENÚ PREMIUM */
    .menu-btn {
        color: white; border: none; padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: background 0.2s;
    }
    .success-btn { background: #059669; } .success-btn:hover { background: #047857; }
    .select-btn { background: #2563eb; display: inline-block; } .select-btn:hover { background: #1d4ed8; }
    
    .toggle-panel-btn {
        background: #161f30; color: #94a3b8; border: 1px solid #222f47;
        padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; font-weight: 600;
    }
    .toggle-panel-btn.active { background: #2563eb; color: white; border-color: #3b82f6; }
    
    .workspace-container { position: relative; width: 100vw; height: calc(100vh - 44px); overflow: hidden; }
    
    /* DISEÑO GOOGLE: Sin marcos, esquinas redondeadas y sombras suaves */
    .workspace-panel {
        position: absolute; background: #0f131a; border: none !important;
        border-radius: 14px; display: flex; flex-direction: column; overflow: visible; z-index: 10;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5);
    }
    
    /* Tirador de arrastre integrado invisible en la parte superior */
    .panel-header {
        height: 12px; cursor: move; user-select: none; width: 100%;
        border-top-left-radius: 14px; border-top-right-radius: 14px; background: transparent;
    }
    .panel-content { padding: 14px; flex-grow: 1; overflow: hidden; display: flex; flex-direction: column; gap: 6px; height: calc(100% - 12px); }
    
    /* PERÍMETRO COMPLETO INVISIBLE PARA REDIMENSIONADO */
    .edge-resizer { position: absolute; background: transparent; z-index: 999; }
    .edge-resizer.t  { top: -3px; left: 6px; right: 6px; height: 6px; cursor: n-resize; }
    .edge-resizer.b  { bottom: -3px; left: 6px; right: 6px; height: 6px; cursor: s-resize; }
    .edge-resizer.l  { left: -3px; top: 6px; bottom: 6px; width: 6px; cursor: w-resize; }
    .edge-resizer.r  { right: -3px; top: 6px; bottom: 6px; width: 6px; cursor: e-resize; }
    .edge-resizer.tl { top: -3px; left: -3px; width: 8px; height: 8px; cursor: nw-resize; }
    .edge-resizer.tr { top: -3px; right: -3px; width: 8px; height: 8px; cursor: ne-resize; }
    .edge-resizer.bl { bottom: -3px; left: -3px; width: 8px; height: 8px; cursor: sw-resize; }
    .edge-resizer.br { bottom: -3px; right: -3px; width: 8px; height: 8px; cursor: se-resize; }

    video, canvas { width: 100% !important; height: 100% !important; background: #000; border-radius: 8px; }
`;
document.body.appendChild(styleSheet);

const initialLayout = {
    "panel-video":    { top: 12,  left: 12,  w: 540, h: 390 },
    "panel-keyboard": { top: 12,  left: 562, w: 350, h: 200 },
    "panel-actions":  { top: 222, left: 562, w: 350, h: 180 },
    "panel-presets":  { top: 12,  left: 922, w: 340, h: 390 },
    "panel-timeline": { top: 412, left: 12,  w: 1250, h: 250 }
};

let highestZIndex = 10;
const SNAP_DIST = 12; // Rango de atracción del imán
const TRACK_GAP = 10; // Riel con separación limpia de 10px

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("workspace");
    const topCenter = document.getElementById("top-center-toggles");
    const panels = document.querySelectorAll(".workspace-panel");

    // LÓGICA DEL IMÁN DESPEGABLE Y RIELES
    function calculateSnap(panel, idealX, idealY, w, h) {
        let finalX = idealX;
        let finalY = idealY;

        panels.forEach(other => {
            if (other === panel || other.style.display === "none") return;

            const oL = other.offsetLeft;
            const oT = other.offsetTop;
            const oR = oL + other.offsetWidth;
            const oB = oT + other.offsetHeight;

            // Rieles en X (Pegado a ras o separación de 10px)
            if (Math.abs(idealX - oL) < SNAP_DIST) finalX = oL;
            else if (Math.abs(idealX - oR) < SNAP_THRESHOLD_FIX(idealX, oR)) finalX = oR;
            else if (Math.abs(idealX - (oR + TRACK_GAP)) < SNAP_DIST) finalX = oR + TRACK_GAP;
            else if (Math.abs((idealX + w) - oL) < SNAP_DIST) finalX = oL - w;
            else if (Math.abs((idealX + w) - (oL - TRACK_GAP)) < SNAP_DIST) finalX = oL - w - TRACK_GAP;

            // Rieles en Y (Pegado a ras o separación de 10px)
            if (Math.abs(idealY - oT) < SNAP_DIST) finalY = oT;
            else if (Math.abs(idealY - oB) < SNAP_DIST) finalY = oB;
            else if (Math.abs(idealY - (oB + TRACK_GAP)) < SNAP_DIST) finalY = oB + TRACK_GAP;
            else if (Math.abs((idealY + h) - oT) < SNAP_DIST) finalY = oT - h;
            else if (Math.abs((idealY + h) - (oT - TRACK_GAP)) < SNAP_DIST) finalY = oT - h - TRACK_GAP;
        });

        function SNAP_THRESHOLD_FIX(v1, v2) { return Math.abs(v1 - v2) < SNAP_DIST; }

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

        panel.addEventListener("mousedown", () => { panel.style.zIndex = ++highestZIndex; });

        // ARRASTRE FLUIDO CON TOPE FÍSICO REAL EN EXTREMOS
        const header = panel.querySelector(".panel-header");
        header.addEventListener("mousedown", (e) => {
            e.preventDefault();
            panel.style.zIndex = ++highestZIndex;
            
            let mouseStartX = e.clientX;
            let mouseStartY = e.clientY;
            let panelStartX = panel.offsetLeft;
            let panelStartY = panel.offsetTop;

            const mouseMoveHandler = (moveEvent) => {
                // Mantenemos la ruta ideal del ratón para que se despegue al instante del imán
                let idealLeft = panelStartX + (moveEvent.clientX - mouseStartX);
                let idealTop = panelStartY + (moveEvent.clientY - mouseStartY);

                // TOPE FÍSICO ABSOLUTO EN LAS 4 DIRECCIONES DE TU PANTALLA
                const maxLeft = window.innerWidth - panel.offsetWidth;
                const maxTop = window.innerHeight - 44 - panel.offsetHeight;

                if (idealLeft < 0) idealLeft = 0;
                if (idealTop < 0) idealTop = 0;
                if (idealLeft > maxLeft) idealLeft = maxLeft;
                if (idealTop > maxTop) idealTop = maxTop;

                // Aplicar imán despegable a la renderización gráfica
                let snapped = calculateSnap(panel, idealLeft, idealTop, panel.offsetWidth, panel.offsetHeight);

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

        // REDIMENSIONADO PERIMETRAL ULTRA-PRECISO
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

                    // Topes en redimensionado perimetral externo
                    if (nl < 0) { nw += nl; nl = 0; }
                    if (nt < 0) { nh += nt; nt = 0; }
                    if (nl + nw > window.innerWidth) nw = window.innerWidth - nl;
                    if (nt + nh > window.innerHeight - 44) nh = window.innerHeight - 44 - nt;

                    let snapped = calculateSnap(panel, nl, nt, nw, nh);
                    
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

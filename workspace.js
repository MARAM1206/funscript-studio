// ==========================================================================
// WORKSPACE V2.0: GESTOR LÍQUIDO DE PANELES CON MEMORIA Y AJUSTE MAGNÉTICO
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    const panels = document.querySelectorAll(".workspace-panel");
    const container = document.querySelector(".workspace-container");

    if (!container) return;

    // Disposición inicial por defecto de los paneles
    const defaultLayout = {
        "panel-video": { left: "1%", top: "1%", width: "48%", height: "50%" },
        "panel-controls": { left: "1%", top: "52%", width: "24%", height: "46%" },
        "panel-tracks": { left: "26%", top: "52%", width: "23%", height: "46%" },
        "panel-slider": { left: "50%", top: "1%", width: "12%", height: "50%" },
        "panel-presets": { left: "63%", top: "1%", width: "18%", height: "50%" },
        "panel-actions": { left: "82%", top: "1%", width: "17%", height: "50%" },
        "panel-timeline": { left: "50%", top: "52%", width: "49%", height: "46%" }
    };

    // Aplicar estilos y cabeceras
    panels.forEach(panel => {
        const id = panel.id;
        const layout = defaultLayout[id];

        if (layout) {
            panel.style.left = layout.left;
            panel.style.top = layout.top;
            panel.style.width = layout.width;
            panel.style.height = layout.height;
        }

        // Crear la barra de título si no existe
        if (!panel.querySelector(".panel-header")) {
            const title = panel.getAttribute("data-title") || "Panel";
            const header = document.createElement("div");
            header.className = "panel-header";
            header.style.cssText = `
                background: #141b26;
                color: #94a3b8;
                padding: 6px 12px;
                font-size: 0.8rem;
                font-weight: bold;
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
                cursor: move;
                user-select: none;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid #1e293b;
            `;
            header.innerHTML = `<span>${title}</span>`;
            panel.insertBefore(header, panel.firstChild);

            // Funcionalidad de arrastre
            let isDragging = false;
            let startX, startY, initialLeft, initialTop;

            header.addEventListener("mousedown", (e) => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                initialLeft = panel.offsetLeft;
                initialTop = panel.offsetTop;

                const moveHandler = (moveEvent) => {
                    if (!isDragging) return;
                    const dx = moveEvent.clientX - startX;
                    const dy = moveEvent.clientY - startY;

                    panel.style.left = `${initialLeft + dx}px`;
                    panel.style.top = `${initialTop + dy}px`;
                };

                const upHandler = () => {
                    isDragging = false;
                    document.removeEventListener("mousemove", moveHandler);
                    document.removeEventListener("mouseup", upHandler);
                    window.dispatchEvent(new Event('resize'));
                };

                document.addEventListener("mousemove", moveHandler);
                document.addEventListener("mouseup", upHandler);
            });
        }
    });

    window.dispatchEvent(new Event('resize'));
});

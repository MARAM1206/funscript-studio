// ==========================================================================
// GESTOR DE WORKSPACE FLOTANTE, REDIMENSIONABLE Y MODULAR (PC PRO)
// ==========================================================================

// Inyección automática de Estilos CSS para el control de ventanas y barra superior
const styleSheet = document.createElement("style");
styleSheet.innerText = `
    body {
        margin: 0;
        padding: 0;
        background-color: #0b0f19;
        font-family: system-ui, -apple-system, sans-serif;
        overflow: hidden;
        height: 100vh;
    }
    .top-bar-menu {
        height: 40px;
        background: #111827;
        border-bottom: 1px solid #1f2937;
        display: flex;
        align-items: center;
        padding: 0 15px;
        gap: 10px;
        z-index: 9999;
        position: relative;
    }
    .top-bar-title {
        color: #f3f4f6;
        font-weight: 700;
        font-size: 0.9rem;
        margin-right: 15px;
    }
    .toggle-panel-btn {
        background: #374151;
        color: #d1d5db;
        border: 1px solid #4b5563;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s;
    }
    .toggle-panel-btn.active {
        background: #2563eb;
        color: white;
        border-color: #3b82f6;
    }
    .workspace-container {
        position: relative;
        width: 100vw;
        height: calc(100vh - 40px);
        overflow: hidden;
    }
    .workspace-panel {
        position: absolute;
        background: #111827;
        border: 1px solid #374151;
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 10;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
    }
    .panel-header {
        background: #1f2937;
        padding: 8px 12px;
        color: #f3f4f6;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: move;
        user-select: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #374151;
    }
    .panel-controls-btn {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        font-size: 1rem;
        font-weight: bold;
        padding: 0 4px;
    }
    .panel-controls-btn:hover {
        color: #f3f4f6;
    }
    .panel-content {
        padding: 12px;
        flex-grow: 1;
        overflow-y: auto;
        color: #9ca3af;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    /* Tirador inferior derecho para redimensionar */
    .resize-handle {
        position: absolute;
        width: 12px;
        height: 12px;
        background: transparent;
        right: 0;
        bottom: 0;
        cursor: se-resize;
        z-index: 999;
    }
    /* Adaptación interna de elementos al tamaño de ventana */
    video, canvas {
        width: 100% !important;
        height: 100% !important;
        flex-grow: 1;
        background: #000;
        border-radius: 4px;
    }
    .file-selector { width: 100%; color: #d1d5db; }
    .btn { cursor: pointer; padding: 8px; border-radius: 4px; border: none; font-weight: bold; }
    .success-btn { background: #10b981; color: white; width: 100%; }
`;
document.head.appendChild(styleSheet);

// Coordenadas y tamaños iniciales por defecto en PC para evitar encimamientos
const initialLayout = {
    "panel-video":    { top: 20,  left: 20,  w: 480, h: 360 },
    "panel-keyboard": { top: 20,  left: 520, w: 320, h: 180 },
    "panel-actions":  { top: 220, left: 520, w: 320, h: 160 },
    "panel-presets":  { top: 20,  left: 860, w: 320, h: 360 },
    "panel-timeline": { top: 400, left: 20,  w: 1160, h: 220 }
};

let highestZIndex = 10;

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("workspace");
    
    // 1. Crear la Barra de Herramientas Superior
    const topBar = document.createElement("div");
    topBar.className = "top-bar-menu";
    topBar.innerHTML = `<div class="top-bar-title">🛠️ FunScript Studio v1.1</div>`;
    document.body.insertBefore(topBar, container);

    const panels = document.querySelectorAll(".workspace-panel");

    panels.forEach(panel => {
        const id = panel.id;
        const config = initialLayout[id] || { top: 50, left: 50, w: 300, h: 200 };

        // Aplicar posiciones iniciales estructuradas
        panel.style.top = `${config.top}px`;
        panel.style.left = `${config.left}px`;
        panel.style.width = `${config.w}px`;
        panel.style.height = `${config.h}px`;

        // Añadir botón de minimizar individual en la cabecera
        const header = panel.querySelector(".panel-header");
        const minBtn = document.createElement("button");
        minBtn.className = "panel-controls-btn";
        minBtn.innerText = "─";
        minBtn.title = "Minimizar módulo";
        header.appendChild(minBtn);

        // Añadir tirador de cambio de tamaño (Resize Handle)
        const resizeHandle = document.createElement("div");
        resizeHandle.className = "resize-handle";
        panel.appendChild(resizeHandle);

        // 2. Crear botones de control en la Barra Superior
        const cleanName = header.firstChild.textContent.trim();
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "toggle-panel-btn active";
        toggleBtn.innerText = cleanName;
        topBar.appendChild(toggleBtn);

        // Funciones de visibilidad vinculadas
        const toggleVisibility = () => {
            if (panel.style.display === "none") {
                panel.style.display = "flex";
                toggleBtn.classList.add("active");
                panel.style.zIndex = ++highestZIndex;
                triggerResizeEvents();
            } else {
                panel.style.display = "none";
                toggleBtn.classList.remove("active");
            }
        };

        minBtn.addEventListener("click", toggleVisibility);
        toggleBtn.addEventListener("click", toggleVisibility);

        // Focus al hacer clic (traer al frente)
        panel.addEventListener("mousedown", () => {
            panel.style.zIndex = ++highestZIndex;
        });

        // 3. Lógica de Arrastre (Drag)
        header.addEventListener("mousedown", (e) => {
            if (e.target.classList.contains("panel-controls-btn")) return;
            e.preventDefault();
            
            panel.style.zIndex = ++highestZIndex;
            let startX = e.clientX;
            let startY = e.clientY;

            const mouseMoveHandler = (moveEvent) => {
                let dx = moveEvent.clientX - startX;
                let dy = moveEvent.clientY - startY;
                
                let newLeft = panel.offsetLeft + dx;
                let newTop = panel.offsetTop + dy;

                // Límites de pantalla para no perder la ventana
                panel.style.left = `${Math.max(0, newLeft)}px`;
                panel.style.top = `${Math.max(0, newTop)}px`;

                startX = moveEvent.clientX;
                startY = moveEvent.clientY;
            };

            const mouseUpHandler = () => {
                document.removeEventListener("mousemove", mouseMoveHandler);
                document.removeEventListener("mouseup", mouseUpHandler);
            };

            document.addEventListener("mousemove", mouseMoveHandler);
            document.addEventListener("mouseup", mouseUpHandler);
        });

        // 4. Lógica de Redimensionamiento (Resize)
        resizeHandle.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();

            let startWidth = panel.offsetWidth;
            let startHeight = panel.offsetHeight;
            let startX = e.clientX;
            let startY = e.clientY;

            const mouseMoveResizeHandler = (moveEvent) => {
                let newWidth = startWidth + (moveEvent.clientX - startX);
                let newHeight = startHeight + (moveEvent.clientY - startY);

                // Dimensiones mínimas para que no colapse el contenido
                panel.style.width = `${Math.max(220, newWidth)}px`;
                panel.style.height = `${Math.max(120, newHeight)}px`;
                
                // Forzar al Canvas y al Video a redibujarse y reajustarse al vuelo
                triggerResizeEvents();
            };

            const mouseUpResizeHandler = () => {
                document.removeEventListener("mousemove", mouseMoveResizeHandler);
                document.removeEventListener("mouseup", mouseUpResizeHandler);
                triggerResizeEvents();
            };

            document.addEventListener("mousemove", mouseMoveResizeHandler);
            document.addEventListener("mouseup", mouseUpResizeHandler);
        });
    });
});

/**
 * Notifica de forma global al navegador que hubo un cambio de tamaño
 * para que el Canvas recalcule la cuadrícula y la línea roja al instante.
 */
function triggerResizeEvents() {
    window.dispatchEvent(new Event('resize'));
}

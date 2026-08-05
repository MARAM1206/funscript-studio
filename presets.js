/**
 * ============================================================================
 * PRESETS.JS - VERSIÓN 39.0
 * Módulo: ANIMACIÓN CARMESÍ EN EL MODAL DE EDICIÓN Y SOPORTE DEL MODO PEGAR
 * ============================================================================
 */

class PresetsManager {
    constructor(editorInstance) {
        this.editor = editorInstance;
        this.isModalActive = false;
        this.animationFrameId = null;
        
        // Parámetros de Animación Carmesí
        this.crimsonIntensity = 0;
        this.wavePhase = 0;
        
        // Estado del Modo Pegar
        this.pasteModeActive = false;
        this.clipboardBuffer = [];
        
        this.initListeners();
    }

    initListeners() {
        // Escuchar eventos globales para abrir el modal o activar Modo Pegar
        window.addEventListener('openPresetModal', (e) => this.openEditModal(e.detail));
        window.addEventListener('pasteFunscriptActions', (e) => this.enablePasteMode(e.detail));
    }

    /* ========================================================================
       1. GESTIÓN DEL MODAL DE EDICIÓN
       ======================================================================== */
    
    openEditModal(presetData) {
        this.isModalActive = true;
        const modalEl = document.getElementById('preset-edit-modal');
        const canvasEl = document.getElementById('modal-animation-canvas');

        if (modalEl) {
            // Añadir clases para el tema carmesí y mostrar el modal
            modalEl.classList.add('modal-visible', 'crimson-glow-theme');
        }

        if (canvasEl) {
            this.startCrimsonAnimation(canvasEl);
        }

        // Cargar datos del preset en la UI (Configurable según tu HTML)
        this.renderPresetOptions(presetData);
    }

    closeEditModal() {
        this.isModalActive = false;
        
        // Detener animación para ahorrar memoria
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        const modalEl = document.getElementById('preset-edit-modal');
        if (modalEl) {
            modalEl.classList.remove('modal-visible', 'crimson-glow-theme');
        }
    }

    /* ========================================================================
       2. RENDERIZADO DE LA ANIMACIÓN CARMESÍ
       ======================================================================== */
    
    startCrimsonAnimation(canvas) {
        const ctx = canvas.getContext('2d');
        
        // Ajustar resolución del canvas
        canvas.width = canvas.parentElement.clientWidth || 400;
        canvas.height = canvas.parentElement.clientHeight || 150;

        const renderLoop = () => {
            if (!this.isModalActive) return;

            // Limpiar frame con fondo translúcido para efecto de estela
            ctx.fillStyle = 'rgba(15, 10, 12, 0.3)'; // Fondo oscuro base
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Calcular pulso Carmesí (Oscilación suave)
            this.crimsonIntensity = Math.abs(Math.sin(Date.now() / 600)) * 0.4 + 0.6;
            this.wavePhase += 0.05;

            // Trazado de la onda
            ctx.beginPath();
            ctx.moveTo(0, canvas.height / 2);

            for (let x = 0; x < canvas.width; x += 5) {
                // Matemática de la onda combinada para fluidez
                const wave1 = Math.sin((x * 0.02) + this.wavePhase) * 15;
                const wave2 = Math.cos((x * 0.04) + (this.wavePhase * 0.8)) * 10;
                
                ctx.lineTo(x, (canvas.height / 2) + wave1 + wave2);
            }

            // Estilos de línea (Rojo Carmesí)
            ctx.strokeStyle = `rgba(220, 20, 60, ${this.crimsonIntensity})`; // #DC143C
            ctx.lineWidth = 3;
            
            // Sombra/Resplandor (Glow)
            ctx.shadowColor = '#DC143C';
            ctx.shadowBlur = 20 * this.crimsonIntensity;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            ctx.stroke();
            
            // Resetear sombras para no afectar otros renders
            ctx.shadowBlur = 0;

            this.animationFrameId = requestAnimationFrame(renderLoop);
        };

        renderLoop();
    }

    /* ========================================================================
       3. SOPORTE DEL MODO PEGAR (PASTE MODE) Y ADAPTACIÓN DE ACCIONES
       ======================================================================== */
    
    enablePasteMode(clipboardData) {
        if (!clipboardData || !clipboardData.actions || clipboardData.actions.length === 0) {
            console.warn("[Script IA] El portapapeles de acciones está vacío.");
            return;
        }

        this.pasteModeActive = true;
        this.clipboardBuffer = clipboardData.actions;
        
        // Activar indicador visual en la UI
        const pasteIndicator = document.getElementById('paste-mode-indicator');
        if (pasteIndicator) {
            pasteIndicator.style.display = 'block';
            pasteIndicator.classList.add('crimson-pulse');
        }
    }

    executePaste(targetTimeMs) {
        if (!this.pasteModeActive || this.clipboardBuffer.length === 0) return;

        console.log(`[Script IA] Ejecutando Modo Pegar en T: ${targetTimeMs}ms`);

        // 1. Calcular el desplazamiento de tiempo (Offset)
        const firstActionTime = this.clipboardBuffer[0].at;
        const timeOffset = targetTimeMs - firstActionTime;

        // 2. Adaptar las acciones pegadas al nuevo tiempo
        const adaptedActions = this.clipboardBuffer.map(action => {
            return {
                at: Math.round(action.at + timeOffset),
                pos: action.pos
            };
        });

        // 3. Mezclar con el Funscript actual (Llamada al módulo de Workspace/Timeline)
        if (this.editor && this.editor.workspace) {
            this.editor.workspace.mergeActions(adaptedActions);
            this.editor.timeline.render(); // Forzar actualización visual
        }

        // 4. Limpiar estado
        this.exitPasteMode();
    }

    exitPasteMode() {
        this.pasteModeActive = false;
        this.clipboardBuffer = [];
        
        const pasteIndicator = document.getElementById('paste-mode-indicator');
        if (pasteIndicator) {
            pasteIndicator.style.display = 'none';
            pasteIndicator.classList.remove('crimson-pulse');
        }
    }

    /* ========================================================================
       4. UTILIDADES GENERALES DE PRESETS
       ======================================================================== */
       
    renderPresetOptions(presetData) {
        // Aquí puedes inyectar lógica para mostrar sliders o inputs numéricos
        // dependiendo del preset (Ej. Suavizado, Inversión, Limitador)
        const titleEl = document.getElementById('modal-preset-title');
        if(titleEl && presetData.name) {
            titleEl.innerText = `Editando: ${presetData.name}`;
        }
    }
}

// Exponer la instancia al entorno global (o exportar según tu bundler)
window.PresetsModule = PresetsManager;

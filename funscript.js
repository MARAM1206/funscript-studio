// ==========================================================================
// GESTOR Y EXPORTADOR MULTI-PISTA DE ARCHIVOS FUNSCRIPT
// ==========================================================================

// Paleta de colores vibrantes para diferenciar cada pista en la línea de tiempo
const TRACK_COLORS = [
    '#38bdf8', // Azul cielo (Principal por defecto)
    '#ec4899', // Rosa Intenso
    '#10b981', // Verde Esmeralda
    '#f59e0b', // Ámbar / Naranja
    '#a855f7', // Púrpura
    '#06b6d4', // Cian
    '#ef4444', // Rojo
    '#84cc16'  // Verde Lima
];

// Estado global de pistas
window.loadedFunscriptTracks = [];
const funscriptInput = document.getElementById('funscript-input');
const exportBtn = document.getElementById('export-btn');
const tracksListContainer = document.getElementById('tracks-list');

// Escuchamos la carga de uno o múltiples archivos .funscript
funscriptInput?.addEventListener('change', function(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    let loadedCount = 0;

    files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (data && Array.isArray(data.actions)) {
                    // Normalizar puntos
                    const actions = data.actions.map(act => ({
                        at: Math.round(act.at),
                        pos: Math.max(0, Math.min(100, Math.round(act.pos))),
                        selected: false
                    })).sort((a, b) => a.at - b.at);

                    const colorIndex = window.loadedFunscriptTracks.length % TRACK_COLORS.length;
                    const isFirst = window.loadedFunscriptTracks.length === 0;

                    const newTrack = {
                        id: 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        name: file.name.replace(/\.(funscript|json)$/i, ''),
                        color: TRACK_COLORS[colorIndex],
                        actions: actions,
                        visible: true,
                        isPrimary: isFirst
                    };

                    window.loadedFunscriptTracks.push(newTrack);

                    // Si es la primera pista, la asignamos como la pista de trabajo activa
                    if (isFirst) {
                        window.funscriptActions = JSON.parse(JSON.stringify(actions));
                    }
                }
            } catch (err) {
                console.error("Error al leer el archivo " + file.name, err);
            }

            loadedCount++;
            if (loadedCount === files.length) {
                updateTracksListUI();
                if (typeof window.drawTimeline === 'function') {
                    window.drawTimeline();
                }
                if (typeof window.updateActionsLog === 'function') {
                    window.updateActionsLog();
                }
            }
        };
        reader.readAsText(file);
    });

    // Limpiar input para permitir cargar el mismo archivo de nuevo si se desea
    event.target.value = '';
});

/**
 * Dibuja la lista visual de pistas en el panel "📑 Pistas FunScript"
 */
function updateTracksListUI() {
    if (!tracksListContainer) return;

    if (!window.loadedFunscriptTracks || window.loadedFunscriptTracks.length === 0) {
        tracksListContainer.innerHTML = `<span class="empty-tracks-msg">No hay pistas cargadas. Haz clic en "📂 Importar FunScripts" para agregar pistas.</span>`;
        return;
    }

    tracksListContainer.innerHTML = window.loadedFunscriptTracks.map(track => {
        return `
            <div class="track-item ${track.isPrimary ? 'is-primary' : ''}">
                <div class="track-info">
                    <span class="track-color-badge" style="background-color: ${track.color};"></span>
                    <span class="track-name" title="${track.name}">${track.name}</span>
                </div>
                <div class="track-actions">
                    ${track.isPrimary 
                        ? `<span class="primary-badge">Principal</span>` 
                        : `<button class="track-btn set-primary-btn" data-id="${track.id}" title="Establecer como Pista Principal para Editar y Exportar">⭐ Activar</button>`
                    }
                    <button class="track-btn toggle-vis-btn" data-id="${track.id}" title="Mostrar / Ocultar en Línea de Tiempo">
                        ${track.visible ? '👁️' : '🙈'}
                    </button>
                    <button class="track-btn delete-track-btn" data-id="${track.id}" title="Eliminar Pista" style="color: #ef4444;">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Eventos: Establecer Pista Principal
    document.querySelectorAll('.set-primary-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const trackId = this.getAttribute('data-id');
            setPrimaryTrack(trackId);
        });
    });

    // Eventos: Ocultar / Mostrar Pista
    document.querySelectorAll('.toggle-vis-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const trackId = this.getAttribute('data-id');
            const track = window.loadedFunscriptTracks.find(t => t.id === trackId);
            if (track) {
                track.visible = !track.visible;
                updateTracksListUI();
                if (typeof window.drawTimeline === 'function') window.drawTimeline();
            }
        });
    });

    // Eventos: Eliminar Pista
    document.querySelectorAll('.delete-track-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const trackId = this.getAttribute('data-id');
            deleteTrack(trackId);
        });
    });
}

/**
 * Define una pista como la activa/principal
 */
function setPrimaryTrack(trackId) {
    // Sincronizar cambios actuales de la pista activa a su objeto correspondiente
    const currentPrimary = window.loadedFunscriptTracks.find(t => t.isPrimary);
    if (currentPrimary && window.funscriptActions) {
        currentPrimary.actions = JSON.parse(JSON.stringify(window.funscriptActions));
    }

    window.loadedFunscriptTracks.forEach(t => {
        t.isPrimary = (t.id === trackId);
    });

    const newPrimary = window.loadedFunscriptTracks.find(t => t.isPrimary);
    if (newPrimary) {
        window.funscriptActions = JSON.parse(JSON.stringify(newPrimary.actions));
    }

    updateTracksListUI();
    if (typeof window.drawTimeline === 'function') window.drawTimeline();
    if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
}

/**
 * Elimina una pista cargada
 */
function deleteTrack(trackId) {
    const index = window.loadedFunscriptTracks.findIndex(t => t.id === trackId);
    if (index === -1) return;

    const wasPrimary = window.loadedFunscriptTracks[index].isPrimary;
    window.loadedFunscriptTracks.splice(index, 1);

    if (wasPrimary && window.loadedFunscriptTracks.length > 0) {
        window.loadedFunscriptTracks[0].isPrimary = true;
        window.funscriptActions = JSON.parse(JSON.stringify(window.loadedFunscriptTracks[0].actions));
    } else if (window.loadedFunscriptTracks.length === 0) {
        window.funscriptActions = [];
    }

    updateTracksListUI();
    if (typeof window.drawTimeline === 'function') window.drawTimeline();
    if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
}

/**
 * Transforma los datos de la PISTA PRINCIPAL a un archivo .funscript y lo descarga
 */
function exportToFunscript() {
    // Aseguramos sincronizar los puntos actuales
    const currentPrimary = window.loadedFunscriptTracks.find(t => t.isPrimary);
    if (currentPrimary && window.funscriptActions) {
        currentPrimary.actions = JSON.parse(JSON.stringify(window.funscriptActions));
    }

    if (!window.funscriptActions || window.funscriptActions.length === 0) {
        alert("¡Espera! No hay puntos en la pista principal para exportar.");
        return;
    }

    // Estructura oficial del estándar FunScript
    const funscriptData = {
        version: "1.0",
        inverted: false,
        range: 90,
        actions: window.funscriptActions.map(act => ({ at: act.at, pos: act.pos }))
    };

    const jsonString = JSON.stringify(funscriptData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    
    const fileName = currentPrimary ? `${currentPrimary.name}_editado.funscript` : "script.funscript";
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log("Archivo .funscript exportado con éxito:", fileName);
}

// Escuchar clic en el botón de exportación
if (exportBtn) {
    exportBtn.addEventListener('click', exportToFunscript);
}

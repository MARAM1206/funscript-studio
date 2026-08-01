// ==========================================================================
// GESTOR DE ARCHIVOS Y MULTI-PISTA V4.0
// ==========================================================================

const TRACK_COLORS = ['#38bdf8', '#ec4899', '#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#ef4444', '#84cc16'];
window.loadedFunscriptTracks = [];
const funscriptInput = document.getElementById('funscript-input');
const exportBtn = document.getElementById('export-btn');
const tracksListContainer = document.getElementById('tracks-list');

window.loadFunscriptFiles = function(filesArray) {
    if (filesArray.length === 0) return;
    let loadedCount = 0;

    filesArray.forEach((file) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (data && Array.isArray(data.actions)) {
                    const actions = data.actions.map(act => ({
                        at: Math.round(Number(act.at)),
                        pos: Math.max(0, Math.min(100, Math.round(Number(act.pos)))),
                        selected: false
                    })).filter(act => !isNaN(act.at) && !isNaN(act.pos)).sort((a, b) => a.at - b.at);

                    const colorIndex = window.loadedFunscriptTracks.length % TRACK_COLORS.length;
                    const isFirst = window.loadedFunscriptTracks.length === 0;

                    window.loadedFunscriptTracks.push({
                        id: 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        name: file.name.replace(/\.(funscript|json)$/i, ''),
                        color: TRACK_COLORS[colorIndex],
                        actions: actions,
                        visible: true,
                        isPrimary: isFirst
                    });

                    if (isFirst) window.funscriptActions = JSON.parse(JSON.stringify(actions));
                }
            } catch (err) { console.error("Error al leer: " + file.name, err); }

            loadedCount++;
            if (loadedCount === filesArray.length) {
                window.updateFileManagerUI();
                if (typeof window.drawTimeline === 'function') window.drawTimeline();
                if (typeof window.updateActionsLog === 'function') window.updateActionsLog();
            }
        };
        reader.readAsText(file);
    });
};

funscriptInput?.addEventListener('change', function(event) {
    window.loadFunscriptFiles(Array.from(event.target.files || []));
    event.target.value = '';
});

// NUEVO: GESTOR DE ARCHIVOS GLOBAL (MUESTRA VIDEO Y PISTAS)
window.updateFileManagerUI = function() {
    if (!tracksListContainer) return;
    
    let htmlContent = '';

    // 1. Mostrar Video si existe
    if (window.currentVideoName) {
        htmlContent += `
            <div class="track-item" style="border-color: #f59e0b; background: #1e293b;">
                <div class="track-info">
                    <span class="track-color-badge" style="background-color: #f59e0b;"></span>
                    <span class="track-name" title="${window.currentVideoName}">🎬 ${window.currentVideoName}</span>
                </div>
                <div class="track-actions">
                    <button class="track-btn delete-video-btn" style="color: #ef4444;" title="Quitar Video">🗑️</button>
                </div>
            </div>
            <hr style="border-color: #1e293b; margin: 4px 0;">
        `;
    }

    // 2. Mostrar Pistas FunScript
    if (window.loadedFunscriptTracks.length === 0) {
        if (!window.currentVideoName) {
            htmlContent += `<span class="empty-tracks-msg">No hay archivos cargados aún. Importa un Video o FunScript.</span>`;
        }
    } else {
        htmlContent += window.loadedFunscriptTracks.map(track => `
            <div class="track-item ${track.isPrimary ? 'is-primary' : ''}">
                <div class="track-info">
                    <span class="track-color-badge" style="background-color: ${track.color};"></span>
                    <span class="track-name" title="${track.name}">${track.name}</span>
                </div>
                <div class="track-actions">
                    ${track.isPrimary ? `<span class="primary-badge">Principal</span>` : `<button class="track-btn set-primary-btn" data-id="${track.id}">⭐</button>`}
                    <button class="track-btn toggle-vis-btn" data-id="${track.id}">${track.visible ? '👁️' : '🙈'}</button>
                    <button class="track-btn delete-track-btn" data-id="${track.id}" style="color: #ef4444;">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    tracksListContainer.innerHTML = htmlContent;

    // EVENTOS DEL GESTOR
    document.querySelectorAll('.delete-video-btn').forEach(btn => btn.addEventListener('click', function() {
        if (window.videoPlayer) {
            window.videoPlayer.src = "";
            window.currentVideoName = null;
            const vName = document.getElementById('v-name');
            if (vName) vName.innerText = "Sin video";
            window.updateFileManagerUI();
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
        }
    }));

    document.querySelectorAll('.set-primary-btn').forEach(btn => btn.addEventListener('click', function() {
        const tid = this.getAttribute('data-id');
        const current = window.loadedFunscriptTracks.find(t => t.isPrimary);
        if (current && window.funscriptActions) current.actions = JSON.parse(JSON.stringify(window.funscriptActions));
        
        window.loadedFunscriptTracks.forEach(t => t.isPrimary = (t.id === tid));
        const newPrimary = window.loadedFunscriptTracks.find(t => t.isPrimary);
        if (newPrimary) window.funscriptActions = JSON.parse(JSON.stringify(newPrimary.actions));
        
        window.updateFileManagerUI(); if (typeof window.drawTimeline === 'function') window.drawTimeline();
    }));

    document.querySelectorAll('.toggle-vis-btn').forEach(btn => btn.addEventListener('click', function() {
        const track = window.loadedFunscriptTracks.find(t => t.id === this.getAttribute('data-id'));
        if (track) { track.visible = !track.visible; window.updateFileManagerUI(); if (typeof window.drawTimeline === 'function') window.drawTimeline(); }
    }));

    document.querySelectorAll('.delete-track-btn').forEach(btn => btn.addEventListener('click', function() {
        const idx = window.loadedFunscriptTracks.findIndex(t => t.id === this.getAttribute('data-id'));
        if (idx === -1) return;
        const wasPrimary = window.loadedFunscriptTracks[idx].isPrimary;
        window.loadedFunscriptTracks.splice(idx, 1);
        
        if (wasPrimary && window.loadedFunscriptTracks.length > 0) {
            window.loadedFunscriptTracks[0].isPrimary = true;
            window.funscriptActions = JSON.parse(JSON.stringify(window.loadedFunscriptTracks[0].actions));
        } else if (window.loadedFunscriptTracks.length === 0) { 
            window.funscriptActions = []; 
        }
        window.updateFileManagerUI(); if (typeof window.drawTimeline === 'function') window.drawTimeline();
    }));
};

exportBtn?.addEventListener('click', () => {
    const currentPrimary = window.loadedFunscriptTracks.find(t => t.isPrimary);
    if (currentPrimary && window.funscriptActions) currentPrimary.actions = JSON.parse(JSON.stringify(window.funscriptActions));
    if (!window.funscriptActions || window.funscriptActions.length === 0) { alert("No hay puntos para exportar."); return; }

    const data = { version: "1.0", inverted: false, range: 90, actions: window.funscriptActions.map(act => ({ at: act.at, pos: act.pos })) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = currentPrimary ? `${currentPrimary.name}_editado.funscript` : "script.funscript";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
});

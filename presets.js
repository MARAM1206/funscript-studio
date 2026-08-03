// ==========================================================================
// PRESETS V4.0: EDICIÓN COMPLETA (RENOMBRAR Y ACTUALIZAR PATRÓN)
// ==========================================================================

let savedPresets = {};
try { savedPresets = JSON.parse(localStorage.getItem('funscript_saved_presets')) || {}; } catch(e) { savedPresets = {}; }

const presetsBtn = document.getElementById('save-preset-btn');
const videoPlayerPresetNode = document.getElementById('video-player');

window.isDraggingPreset = false;
window.timelineGhostPreset = null;
window.timelineGhostTimeMs = null;
window.timelineGhostDeltaPos = 0; 

document.addEventListener("DOMContentLoaded", () => {
    updatePresetsList();
});

presetsBtn?.addEventListener('click', function() {
    const actions = window.funscriptActions || [];
    if (!videoPlayerPresetNode || !videoPlayerPresetNode.src || actions.length === 0) {
        alert("Primero carga un video y coloca puntos en la línea de tiempo."); return;
    }
    const actionsToSave = actions.filter(act => act.selected);
    if (actionsToSave.length === 0) {
        alert("Selecciona primero los puntos que deseas guardar arrastrando un cuadro azul sobre ellos."); return;
    }

    const presetName = prompt("Introduce un nombre para guardar este Preset:", `Patrón Custom ${Object.keys(savedPresets).length + 1}`);
    if (!presetName) return;

    const baseTime = actionsToSave[0].at;
    const normalizedActions = actionsToSave.map(act => ({
        at: act.at - baseTime,
        pos: act.pos
    }));

    savedPresets[presetName] = normalizedActions;
    localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
    updatePresetsList();
});

function updatePresetsList() {
    const listContainer = document.getElementById('presets-list');
    if (!listContainer) return;

    const presetNames = Object.keys(savedPresets);
    if (presetNames.length === 0) {
        listContainer.innerHTML = '<span class="empty-log">No hay presets aún.</span>';
        return;
    }

    listContainer.innerHTML = presetNames.map((name, index) => {
        return `
            <div class="preset-card" draggable="true" data-preset="${name}">
                <div class="preset-card-header">
                    <span style="font-weight: 600; font-size: 0.85rem; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50%;">📌 ${name}</span>
                    <div style="display: flex; gap: 4px;">
                        <button class="track-btn edit-preset-pattern-btn" data-preset="${name}" title="Sobrescribir con selección actual">🔄</button>
                        <button class="track-btn edit-preset-name-btn" data-preset="${name}" title="Renombrar">✏️</button>
                        <button class="track-btn delete-preset-btn" data-preset="${name}" style="color: #ef4444;" title="Eliminar">🗑️</button>
                    </div>
                </div>
                <canvas id="mini-canvas-${index}" class="preset-mini-canvas" width="200" height="36"></canvas>
            </div>
        `;
    }).join('');

    setTimeout(() => {
        presetNames.forEach((name, index) => {
            drawMiniCanvas(`mini-canvas-${index}`, savedPresets[name]);
        });
    }, 50);

    document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('dragstart', function(e) {
            window.isDraggingPreset = true; 
            const name = this.getAttribute('data-preset');
            window.timelineGhostPreset = savedPresets[name];
        });
        card.addEventListener('dragend', function() {
            window.isDraggingPreset = false;
            window.timelineGhostPreset = null;
            window.timelineGhostTimeMs = null;
            window.timelineGhostDeltaPos = 0; 
            if (typeof drawTimeline === 'function') drawTimeline();
        });
    });

    // ✏️ RENOMBRAR PRESET
    document.querySelectorAll('.edit-preset-name-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); 
            const oldName = this.getAttribute('data-preset');
            const newName = prompt("Introduce el nuevo nombre para este Preset:", oldName);
            if (newName && newName !== oldName) {
                savedPresets[newName] = savedPresets[oldName];
                delete savedPresets[oldName];
                localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
                updatePresetsList();
            }
        });
    });

    // 🔄 ACTUALIZAR/SOBRESCRIBIR PATRÓN DE PRESET
    document.querySelectorAll('.edit-preset-pattern-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); 
            const name = this.getAttribute('data-preset');
            
            const actions = window.funscriptActions || [];
            const actionsToSave = actions.filter(act => act.selected);

            if (actionsToSave.length === 0) {
                alert("Selecciona primero los puntos nuevos en la línea del tiempo (arrastrando un cuadro azul) para sobrescribir este Preset."); 
                return;
            }

            if (confirm(`¿Seguro que deseas sobrescribir el patrón de "${name}" con tu selección actual?`)) {
                const baseTime = actionsToSave[0].at;
                const normalizedActions = actionsToSave.map(act => ({
                    at: act.at - baseTime,
                    pos: act.pos
                }));

                savedPresets[name] = normalizedActions;
                localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
                updatePresetsList();
            }
        });
    });

    // 🗑️ ELIMINAR PRESET
    document.querySelectorAll('.delete-preset-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); 
            const name = this.getAttribute('data-preset');
            if (confirm(`¿Eliminar el preset "${name}"?`)) {
                delete savedPresets[name];
                localStorage.setItem('funscript_saved_presets', JSON.stringify(savedPresets));
                updatePresetsList();
            }
        });
    });
}

function drawMiniCanvas(canvasId, actions) {
    const c = document.getElementById(canvasId);
    if (!c || !actions || actions.length === 0) return;
    const ctx = c.getContext('2d');
    const w = c.width; const h = c.height;
    ctx.clearRect(0,0,w,h);
    
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
    ctx.beginPath();
    const duration = actions[actions.length-1].at;
    
    actions.forEach((act, i) => {
        const x = duration === 0 ? 0 : (act.at / duration) * w;
        const y = h - (act.pos / 100) * h;
        if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    ctx.fillStyle = '#f59e0b';
    actions.forEach((act) => {
        const x = duration === 0 ? 0 : (act.at / duration) * w;
        const y = h - (act.pos / 100) * h;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
    });
}

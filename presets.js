// ==========================================================================
// PRESETS MANAGER V1.22.0 (DRAG & DROP NATIVO UNIFICADO Y BLINDADO)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-preset-btn');
    const presetsList = document.getElementById('presets-list');
    const modal = document.getElementById('preset-editor-modal');
    
    const modalCancel = document.getElementById('preset-editor-cancel');
    const modalSave = document.getElementById('preset-editor-save'); 
    const modalSaveNew = document.getElementById('preset-editor-save-new'); 
    
    const pCanvas = document.getElementById('preset-editor-canvas');
    const pNameInput = document.getElementById('preset-editor-name');
    const modalPresetsList = document.getElementById('modal-presets-library-list');

    try {
        let stored = JSON.parse(localStorage.getItem('funscript_presets'));
        if (Array.isArray(stored)) {
            window.presetsLibrary = stored.filter(p => p && typeof p === 'object' && p.id && p.name !== undefined && p.actions);
        } else {
            window.presetsLibrary = [];
        }
    } catch (e) {
        window.presetsLibrary = [];
    }

    window.presetEditorActions = [];
    let editingPresetId = null; 
    let pCtx = pCanvas ? pCanvas.getContext('2d') : null;

    let pScrollX = 0; let pZoom = 1.0; let pBasePixelsPerMs = 0.2;
    let isDraggingPNode = false; let draggedPNodeIndex = -1;
    let pDragSelectionInitial = []; let pDragStartX = 0; let pDragStartY = 0;
    let isSelectingP = false; let pSelStartT = 0; let pSelStartY = 0; let pSelCurrT = 0; let pSelCurrY = 0;
    let hasDraggedPSelection = false; let hadSelectionBeforePMousedown = false;

    let pUndoStack = [];
    let pRedoStack = [];
    const MAX_P_HISTORY = 50;

    function savePresetHistoryState() {
        pUndoStack.push(JSON.stringify(window.presetEditorActions));
        if (pUndoStack.length > MAX_P_HISTORY) pUndoStack.shift();
        pRedoStack = [];
    }

    function pUndo() {
        if (pUndoStack.length > 0) {
            pRedoStack.push(JSON.stringify(window.presetEditorActions));
            window.presetEditorActions = JSON.parse(pUndoStack.pop());
            drawPresetEditor();
        }
    }

    function pRedo() {
        if (pRedoStack.length > 0) {
            pUndoStack.push(JSON.stringify(window.presetEditorActions));
            window.presetEditorActions = JSON.parse(pRedoStack.pop());
            drawPresetEditor();
        }
    }

    const resizeObserver = new ResizeObserver(() => {
        if (modal && modal.style.display === 'flex' && pCanvas) {
            const container = pCanvas.parentElement;
            if (pCanvas.width !== container.clientWidth || pCanvas.height !== container.clientHeight) {
                pCanvas.width = container.clientWidth;
                pCanvas.height = container.clientHeight;
                drawPresetEditor();
            }
        }
    });
    if (pCanvas && pCanvas.parentElement) resizeObserver.observe(pCanvas.parentElement);

    function getUniqueName(desiredName, excludeId = null) {
        let name = (desiredName || '').trim() || 'Nuevo Preset';
        let counter = 1;
        let finalName = name;
        while (window.presetsLibrary.some(p => p.name === finalName && p.id !== excludeId)) {
            finalName = `${name} (${counter})`;
            counter++;
        }
        return finalName;
    }

    function renderPresetsLibrary() {
        const renderList = (container, isModal = false) => {
            if (!container) return;
            container.innerHTML = '';
            if (window.presetsLibrary.length === 0) {
                container.innerHTML = '<span class="empty-log">No hay presets aún.</span>';
                return;
            }

            window.presetsLibrary.forEach((preset, index) => {
                const card = document.createElement('div');
                card.className = 'preset-card';
                card.dataset.id = preset.id;
                card.title = "Arrastra a la Línea de Tiempo o Reordena";
                
                // 🎯 FIX: Restauramos el Drag & Drop HTML5 para TODO (Ordenar e Inyectar)
                card.draggable = true;
                
                card.addEventListener('dragstart', (e) => {
                    window.isDraggingPreset = true;
                    window.draggedPresetIndex = index; 
                    window.timelineGhostPreset = JSON.parse(JSON.stringify(preset.actions));
                    window.presetFillInitialized = false; 
                    
                    if (e.dataTransfer) {
                        e.dataTransfer.effectAllowed = 'copyMove';
                        // Imagen invisible para evitar crashes de memoria en Chrome/Brave
                        const img = new Image();
                        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                        e.dataTransfer.setDragImage(img, 0, 0);
                        e.dataTransfer.setData('text/plain', preset.id); 
                    }
                    setTimeout(() => card.style.opacity = '0.4', 0);
                });
                
                card.addEventListener('dragover', (e) => {
                    if (!window.isDraggingPreset) return;
                    e.preventDefault(); 
                    e.dataTransfer.dropEffect = 'move';
                    if (window.draggedPresetIndex !== undefined && window.draggedPresetIndex !== index) {
                        const rect = card.getBoundingClientRect();
                        const relY = e.clientY - rect.top;
                        if (relY < rect.height / 2) card.style.boxShadow = "0 -2px 0 0 #38bdf8"; 
                        else card.style.boxShadow = "0 2px 0 0 #38bdf8"; 
                    }
                });

                card.addEventListener('dragleave', () => { card.style.boxShadow = ""; });

                card.addEventListener('drop', (e) => {
                    if (!window.isDraggingPreset) return;
                    e.preventDefault();
                    card.style.boxShadow = "";
                    
                    if (window.draggedPresetIndex !== undefined && window.draggedPresetIndex !== index) {
                        const rect = card.getBoundingClientRect();
                        const relY = e.clientY - rect.top;
                        let insertIndex = index;
                        if (relY >= rect.height / 2) insertIndex++;
                        
                        const movedItem = window.presetsLibrary.splice(window.draggedPresetIndex, 1)[0];
                        if (insertIndex > window.draggedPresetIndex) insertIndex--;
                        window.presetsLibrary.splice(insertIndex, 0, movedItem);
                        
                        localStorage.setItem('funscript_presets', JSON.stringify(window.presetsLibrary));
                        window.needsPresetReRender = true; 
                    }
                });

                card.addEventListener('dragend', () => {
                    window.isDraggingPreset = false;
                    window.draggedPresetIndex = undefined;
                    card.style.opacity = '1';
                    card.style.boxShadow = "";
                    
                    window.timelineGhostPreset = null;
                    window.timelineGhostTimeMs = null;
                    window.timelineGhostTargetEnd = null;
                    window.timelineGhostMarkers = null;
                    
                    if (window.needsPresetReRender) {
                        window.needsPresetReRender = false;
                        renderPresetsLibrary();
                    }
                    if(typeof window.drawTimeline === 'function') window.drawTimeline();
                });

                if (isModal) {
                    card.addEventListener('dblclick', () => {
                        window.presetEditorActions = JSON.parse(JSON.stringify(preset.actions));
                        pScrollX = 0; drawPresetEditor();
                    });
                } else {
                    card.addEventListener('dblclick', () => { openPresetEditor(preset.id); });
                }

                const canvasId = `preset-thumb-${isModal ? 'm-' : ''}${preset.id}`;
                
                card.innerHTML = `
                    <div style="flex-grow: 1; min-width: 0; pointer-events: none;">
                        <div class="preset-card-title">${preset.name}</div>
                        <div class="preset-card-meta">${preset.actions.length} ptos | ${Math.round(preset.actions[preset.actions.length-1].at / 1000)}s</div>
                    </div>
                    <canvas id="${canvasId}" width="60" height="30" style="background:#0f172a; border-radius:4px; margin:0 10px; pointer-events: none;"></canvas>
                    ${!isModal ? `
                    <div style="display:flex; flex-direction:column; gap:4px; align-items: center; z-index: 2;">
                        <button class="edit-preset-btn" title="Editar Preset" style="background:none; border:none; cursor:pointer; font-size:0.9rem; opacity:0.7;">✏️</button>
                        <button class="delete-preset-btn" title="Eliminar Preset" style="background:none; border:none; cursor:pointer; font-size:0.9rem; opacity:0.7;">🗑️</button>
                    </div>` : ''}
                `;
                
                container.appendChild(card);

                if (!isModal) {
                    const editBtn = card.querySelector('.edit-preset-btn');
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openPresetEditor(preset.id);
                    });
                    editBtn.addEventListener('mouseenter', e => e.target.style.opacity = '1');
                    editBtn.addEventListener('mouseleave', e => e.target.style.opacity = '0.7');

                    const delBtn = card.querySelector('.delete-preset-btn');
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`¿Eliminar el preset "${preset.name}"?`)) {
                            window.presetsLibrary.splice(index, 1);
                            localStorage.setItem('funscript_presets', JSON.stringify(window.presetsLibrary));
                            renderPresetsLibrary();
                        }
                    });
                    delBtn.addEventListener('mouseenter', e => e.target.style.opacity = '1');
                    delBtn.addEventListener('mouseleave', e => e.target.style.opacity = '0.7');
                }

                setTimeout(() => {
                    const cNode = document.getElementById(canvasId);
                    if (cNode && preset.actions.length > 0) {
                        const tCtx = cNode.getContext('2d');
                        tCtx.clearRect(0, 0, cNode.width, cNode.height);
                        const dur = preset.actions[preset.actions.length-1].at;
                        if (dur > 0) {
                            tCtx.strokeStyle = '#38bdf8'; tCtx.lineWidth = 1.5; tCtx.beginPath();
                            preset.actions.forEach((a, i) => {
                                const x = (a.at / dur) * cNode.width;
                                const y = cNode.height - (a.pos / 100) * cNode.height;
                                if (i===0) tCtx.moveTo(x, y); else tCtx.lineTo(x, y);
                            });
                            tCtx.stroke();
                        }
                    }
                }, 10);
            });
        };

        renderList(presetsList, false);
        renderList(modalPresetsList, true);
    }

    if (saveBtn) {
        saveBtn.onclick = (e) => {
            e.preventDefault();
            try {
                if (!window.funscriptActions || window.funscriptActions.length === 0) {
                    alert('No hay puntos en la línea de tiempo.'); return;
                }
                const selected = window.funscriptActions.filter(a => a.selected);
                if (selected.length < 2) {
                    alert('Selecciona al menos 2 puntos para crear un preset.'); return;
                }
                
                const baseTime = selected[0].at;
                const newPresetActions = selected.map(a => ({ at: a.at - baseTime, pos: a.pos, isSync: a.isSync || false }));
                
                window.presetEditorActions = newPresetActions;
                openPresetEditor(); 
            } catch(err) {
                alert("Error al extraer puntos: " + err.message);
            }
        };
    }

    function generateId() { return Math.random().toString(36).substr(2, 9); }

    function openPresetEditor(presetId = null) {
        if (!modal) return;
        editingPresetId = presetId;
        pScrollX = 0; pZoom = 1.0;
        pUndoStack = []; pRedoStack = [];
        
        if (presetId) {
            const p = window.presetsLibrary.find(x => x.id === presetId);
            if (p) { 
                pNameInput.value = p.name; 
                window.presetEditorActions = JSON.parse(JSON.stringify(p.actions)); 
            }
            modalSave.innerText = "Sobrescribir";
            modalSave.className = "menu-btn orange-btn"; 
            modalSaveNew.style.display = "block";
        } else {
            pNameInput.value = "Nuevo Preset"; 
            modalSave.innerText = "Crear Preset";
            modalSave.className = "menu-btn success-btn"; 
            modalSaveNew.style.display = "none";
        }
        
        modal.style.display = 'flex';
        renderPresetsLibrary(); 
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!pCanvas) return;
                const container = pCanvas.parentElement;
                pCanvas.width = container.clientWidth; 
                pCanvas.height = container.clientHeight;
                
                if (window.presetEditorActions.length > 0) {
                    const totalDurationMs = window.presetEditorActions[window.presetEditorActions.length - 1].at;
                    if (totalDurationMs > 0) {
                        const targetPixels = pCanvas.width * 0.8; 
                        pZoom = targetPixels / (totalDurationMs * pBasePixelsPerMs);
                        pZoom = Math.max(0.1, Math.min(15.0, pZoom)); 
                    } else {
                        pZoom = 1.0;
                    }
                }
                drawPresetEditor(); 
            });
        });
    }

    function closePresetEditor() { if (modal) modal.style.display = 'none'; editingPresetId = null; window.presetEditorActions = []; }

    if (modalCancel) {
        modalCancel.onclick = (e) => {
            e.preventDefault();
            closePresetEditor();
        };
    }

    if (modalSaveNew) {
        modalSaveNew.onclick = (e) => {
            e.preventDefault();
            try {
                if (!window.presetEditorActions || window.presetEditorActions.length < 2) { alert('El preset necesita al menos 2 puntos.'); return; }
                
                window.presetEditorActions.sort((a,b) => a.at - b.at);
                const base = window.presetEditorActions[0].at;
                window.presetEditorActions.forEach(a => a.at -= base);

                const finalName = getUniqueName(pNameInput.value);
                const newPreset = { id: generateId(), name: finalName, actions: JSON.parse(JSON.stringify(window.presetEditorActions)) };
                window.presetsLibrary.push(newPreset);
                localStorage.setItem('funscript_presets', JSON.stringify(window.presetsLibrary));
                renderPresetsLibrary(); closePresetEditor();
            } catch (err) {
                alert("Error crítico al guardar como nuevo: " + err.message);
            }
        };
    }

    if (modalSave) {
        modalSave.onclick = (e) => {
            e.preventDefault();
            try {
                if (!window.presetEditorActions || window.presetEditorActions.length < 2) { alert('El preset necesita al menos 2 puntos.'); return; }
                
                window.presetEditorActions.sort((a,b) => a.at - b.at);
                const base = window.presetEditorActions[0].at;
                window.presetEditorActions.forEach(a => a.at -= base);

                if (editingPresetId) {
                    const p = window.presetsLibrary.find(x => x.id === editingPresetId);
                    if (p) { 
                        p.name = getUniqueName(pNameInput.value, p.id); 
                        p.actions = JSON.parse(JSON.stringify(window.presetEditorActions)); 
                    }
                } else {
                    const finalName = getUniqueName(pNameInput.value);
                    const newPreset = { id: generateId(), name: finalName, actions: JSON.parse(JSON.stringify(window.presetEditorActions)) };
                    window.presetsLibrary.push(newPreset);
                }
                
                localStorage.setItem('funscript_presets', JSON.stringify(window.presetsLibrary));
                renderPresetsLibrary(); closePresetEditor();
            } catch (err) {
                alert("Error crítico al crear preset: " + err.message);
            }
        };
    }

    function drawPresetEditor() {
        if (!pCtx || !pCanvas || modal.style.display !== 'flex') return;
        
        const parent = pCanvas.parentElement;
        if(pCanvas.width !== parent.clientWidth) pCanvas.width = parent.clientWidth;
        if(pCanvas.height !== parent.clientHeight) pCanvas.height = parent.clientHeight;

        pCtx.clearRect(0,0, pCanvas.width, pCanvas.height);

        const timeToX = (t) => 30 + (t - pScrollX) * (pBasePixelsPerMs * pZoom);
        const xToTime = (x) => pScrollX + (x - 30) / (pBasePixelsPerMs * pZoom);
        const posToY = (p) => { const pad = 30; return pCanvas.height - pad - (p/100)*(pCanvas.height - 2*pad); };

        pCtx.fillStyle = '#06090e'; pCtx.fillRect(0,0,pCanvas.width,pCanvas.height);

        pCtx.strokeStyle = 'rgba(255,255,255,0.05)'; pCtx.lineWidth = 1;
        [0, 25, 50, 75, 100].forEach(p => { const y = posToY(p); pCtx.beginPath(); pCtx.moveTo(30, y); pCtx.lineTo(pCanvas.width, y); pCtx.stroke(); });

        pCtx.fillStyle = '#1e293b'; pCtx.fillRect(0,0, 30, pCanvas.height);
        pCtx.fillStyle = '#94a3b8'; pCtx.font = '10px monospace';
        [0, 25, 50, 75, 100].forEach(p => { pCtx.fillText(`${p}%`, 2, posToY(p) + 4); });

        const visibleMs = (pCanvas.width - 30) / (pBasePixelsPerMs * pZoom);
        let stepMs = visibleMs < 1000 ? 100 : (visibleMs < 5000 ? 500 : 1000);
        let t = Math.floor(Math.max(0, xToTime(30)) / stepMs) * stepMs;
        while(t <= xToTime(pCanvas.width)) {
            if (t >= 0) {
                const x = timeToX(t);
                if (x >= 30) { pCtx.strokeStyle='rgba(255,255,255,0.05)'; pCtx.beginPath(); pCtx.moveTo(x,0); pCtx.lineTo(x,pCanvas.height); pCtx.stroke(); pCtx.fillText(`${t/1000}s`, x+2, 10); }
            }
            t += stepMs;
        }

        if (isSelectingP) {
            pCtx.fillStyle = 'rgba(56, 189, 248, 0.15)'; pCtx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; pCtx.setLineDash([2,2]);
            const sx = timeToX(pSelStartT); const cx = timeToX(pSelCurrT);
            const xl = Math.min(sx, cx); const yt = Math.min(pSelStartY, pSelCurrY);
            pCtx.fillRect(xl, yt, Math.abs(cx-sx), Math.abs(pSelCurrY-pSelStartY));
            pCtx.strokeRect(xl, yt, Math.abs(cx-sx), Math.abs(pSelCurrY-pSelStartY));
            pCtx.setLineDash([]);
        }

        if (window.presetEditorActions.length > 0) {
            pCtx.strokeStyle = '#38bdf8'; pCtx.lineWidth = 2; pCtx.beginPath();
            window.presetEditorActions.forEach((a, i) => { const x=timeToX(a.at); const y=posToY(a.pos); if(i===0) pCtx.moveTo(x,y); else pCtx.lineTo(x,y); });
            pCtx.stroke();

            window.presetEditorActions.forEach(a => {
                const x = timeToX(a.at); const y = posToY(a.pos);
                if (x >= 20 && x <= pCanvas.width + 20) {
                    if (a.isSync) {
                        pCtx.fillStyle = '#facc15'; 
                        pCtx.beginPath(); pCtx.arc(x, y, 10, 0, Math.PI * 2); pCtx.fill();
                        pCtx.strokeStyle = '#ffffff'; pCtx.lineWidth = 2; pCtx.stroke();
                        pCtx.fillStyle = '#0f172a'; 
                        pCtx.font = '12px monospace'; 
                        pCtx.textAlign = 'center'; pCtx.textBaseline = 'middle';
                        pCtx.fillText('⚓', x, y+1); 
                        pCtx.textAlign = 'left'; pCtx.textBaseline = 'alphabetic';
                    } else {
                        pCtx.fillStyle = a.selected ? '#f59e0b' : '#0284c7';
                        pCtx.beginPath(); pCtx.arc(x, y, a.selected ? 6 : 4, 0, Math.PI * 2); pCtx.fill();
                        pCtx.strokeStyle = '#ffffff'; pCtx.lineWidth = 1; pCtx.stroke();
                    }
                }
            });
        }
    }

    const pXToTime = (x) => pScrollX + (x - 30) / (pBasePixelsPerMs * pZoom);
    const pYToPos = (y) => { const pad=30; return Math.max(0, Math.min(100, Math.round(((pCanvas.height - pad - y) / (pCanvas.height - 2*pad)) * 100))); };

    pCanvas?.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = pCanvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left;
        if (e.shiftKey) {
            const tMouse = pXToTime(mouseX);
            pZoom = Math.max(0.1, Math.min(15.0, pZoom + (e.deltaY < 0 ? 0.1 : -0.1)));
            pScrollX = Math.max(0, tMouse - (mouseX - 30)/(pBasePixelsPerMs*pZoom));
        } else {
            const pan = ((pCanvas.width-30)/(pBasePixelsPerMs*pZoom)) * 0.1;
            pScrollX = Math.max(0, pScrollX + (e.deltaY < 0 ? pan : -pan));
        }
        drawPresetEditor();
    }, {passive:false});

    pCanvas?.addEventListener('mousedown', (e) => {
        const rect = pCanvas.getBoundingClientRect(); const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
        const clickT = pXToTime(mx); const clickP = pYToPos(my);
        const timeToX = (t) => 30 + (t - pScrollX) * (pBasePixelsPerMs * pZoom);
        const posToY = (p) => { const pad = 30; return pCanvas.height - pad - (p/100)*(pCanvas.height - 2*pad); };

        if (e.button === 0) {
            savePresetHistoryState();
            let clicked = null; let cIdx = -1;
            for(let i=0; i<window.presetEditorActions.length; i++) {
                if(Math.hypot(mx - timeToX(window.presetEditorActions[i].at), my - posToY(window.presetEditorActions[i].pos)) <= 8) { clicked = window.presetEditorActions[i]; cIdx = i; break; }
            }
            if (clicked) {
                if(!e.ctrlKey && !clicked.selected) window.presetEditorActions.forEach(a=>a.selected=false);
                clicked.selected = true; isDraggingPNode = true; draggedPNodeIndex = cIdx;
                pDragSelectionInitial = window.presetEditorActions.map(a=>({...a}));
                pDragStartX = clickT; pDragStartY = clickP;
            } else {
                hadSelectionBeforePMousedown = window.presetEditorActions.some(a=>a.selected);
                if(!e.ctrlKey) window.presetEditorActions.forEach(a=>a.selected=false);
                isSelectingP = true; hasDraggedPSelection = false;
                pSelStartT = clickT; pSelStartY = my; pSelCurrT = clickT; pSelCurrY = my;
            }
        } else if (e.button === 2) {
            savePresetHistoryState();
            window.presetEditorActions = window.presetEditorActions.filter(a => Math.hypot(mx - timeToX(a.at), my - posToY(a.pos)) > 10);
        }
        drawPresetEditor();
    });

    pCanvas?.addEventListener('mousemove', (e) => {
        const rect = pCanvas.getBoundingClientRect(); const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
        window.pLastMouseX = mx; window.pLastMouseY = my;
        
        if (isDraggingPNode && pDragSelectionInitial.length > 0) {
            const snap = window.snapValue || 5;
            const dT = Math.round((pXToTime(mx) - pDragStartX)/50)*50;
            const dP = Math.round((pYToPos(my) - pDragStartY)/snap)*snap;
            window.presetEditorActions.forEach((a,i) => {
                if(pDragSelectionInitial[i].selected) {
                    a.at = Math.max(0, pDragSelectionInitial[i].at + dT);
                    a.pos = Math.max(0, Math.min(100, Math.round((pDragSelectionInitial[i].pos + dP)/snap)*snap));
                }
            });
        } else if (isSelectingP) {
            pSelCurrT = pXToTime(mx); pSelCurrY = my;
            if (Math.hypot(mx - (30+(pSelStartT-pScrollX)*(pBasePixelsPerMs*pZoom)), my - pSelStartY) > 5) hasDraggedPSelection = true;
            const minT = Math.min(pSelStartT, pSelCurrT); const maxT = Math.max(pSelStartT, pSelCurrT);
            const pad=30; const minY = Math.max(pad, Math.min(pSelStartY, pSelCurrY)); const maxY = Math.max(pad, Math.max(pSelStartY, pSelCurrY));
            const posToY = (p) => pCanvas.height - pad - (p/100)*(pCanvas.height - 2*pad);
            window.presetEditorActions.forEach(a => {
                const ay = posToY(a.pos);
                a.selected = (a.at >= minT && a.at <= maxT && ay >= minY && ay <= maxY);
            });
        }
        if(isDraggingPNode || isSelectingP) drawPresetEditor();
    });

    pCanvas?.addEventListener('mouseup', (e) => {
        const snap = window.snapValue || 5;
        if (isSelectingP && !hasDraggedPSelection && e.target === pCanvas) {
            if (!hadSelectionBeforePMousedown) {
                const rect = pCanvas.getBoundingClientRect(); const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
                let cTime = Math.max(0, Math.round(pXToTime(mx)/50)*50);
                let cPos = Math.round(pYToPos(my)/snap)*snap;
                const eIdx = window.presetEditorActions.findIndex(a=>a.at === cTime);
                if(eIdx !== -1) { window.presetEditorActions[eIdx].pos = cPos; window.presetEditorActions[eIdx].selected = true; }
                else { window.presetEditorActions.push({at:cTime, pos:cPos, selected:true}); }
            }
        }
        window.presetEditorActions.sort((a,b)=>a.at-b.at);
        for(let i=window.presetEditorActions.length-1; i>0; i--) { if(window.presetEditorActions[i].at === window.presetEditorActions[i-1].at) window.presetEditorActions.splice(window.presetEditorActions[i].selected?i-1:i, 1); }
        isDraggingPNode = false; pDragSelectionInitial = []; isSelectingP = false; draggedPNodeIndex = -1;
        drawPresetEditor();
    });

    pCanvas?.addEventListener('contextmenu', e=>e.preventDefault());

    window.addEventListener('undoAction', () => { if (modal && modal.style.display === 'flex') pUndo(); });
    window.addEventListener('redoAction', () => { if (modal && modal.style.display === 'flex') pRedo(); });
    
    window.addEventListener('deletePoints', () => {
        if (modal && modal.style.display === 'flex') {
            if(window.presetEditorActions.some(a=>a.selected)){
                savePresetHistoryState();
                window.presetEditorActions = window.presetEditorActions.filter(a => !a.selected);
                drawPresetEditor();
            }
        }
    });

    window.addEventListener('selectAllPoints', () => {
        if (modal && modal.style.display === 'flex') {
            window.presetEditorActions.forEach(a => a.selected = true);
            drawPresetEditor();
        }
    });

    window.addEventListener('copyPoints', () => {
        if (modal && modal.style.display === 'flex') {
            const sel = window.presetEditorActions.filter(a => a.selected);
            if(sel.length > 0) {
                const baseTime = sel[0].at;
                window.clipboardFunscript = sel.map(a => ({...a, at: a.at - baseTime}));
            }
        }
    });

    window.addEventListener('cutPoints', () => {
        if (modal && modal.style.display === 'flex') {
            const sel = window.presetEditorActions.filter(a => a.selected);
            if(sel.length > 0) {
                const baseTime = sel[0].at;
                window.clipboardFunscript = sel.map(a => ({...a, at: a.at - baseTime}));
                savePresetHistoryState();
                window.presetEditorActions = window.presetEditorActions.filter(a => !a.selected);
                drawPresetEditor();
            }
        }
    });

    window.addEventListener('pastePoints', () => {
        if (modal && modal.style.display === 'flex' && window.clipboardFunscript) {
            savePresetHistoryState();
            window.presetEditorActions.forEach(a => a.selected = false);
            const baseT = Math.max(0, Math.round(pXToTime(window.pLastMouseX || 30) / 50) * 50);
            const snap = window.snapValue || 5;
            const deltaP = Math.round(pYToPos(window.pLastMouseY || 150) / snap) * snap - window.clipboardFunscript[0].pos;

            const newPts = window.clipboardFunscript.map(a => ({
                at: baseT + a.at,
                pos: Math.max(0, Math.min(100, Math.round((a.pos + deltaP)/snap)*snap)),
                selected: true,
                isSync: a.isSync || false
            }));
            window.presetEditorActions.push(...newPts);
            window.presetEditorActions.sort((a,b)=>a.at-b.at);
            drawPresetEditor();
        }
    });

    window.addEventListener('nudgePoints', (e) => {
        if (modal && modal.style.display === 'flex') {
            savePresetHistoryState();
            const snap = window.snapValue || 5;
            window.presetEditorActions.forEach(act => {
                if (act.selected) {
                    if (e.detail === 'up') act.pos = Math.min(100, act.pos + snap);
                    if (e.detail === 'down') act.pos = Math.max(0, act.pos - snap);
                }
            });
            drawPresetEditor();
        }
    });

    window.addEventListener('nudgeTime', (e) => {
        if (modal && modal.style.display === 'flex') {
            savePresetHistoryState();
            window.presetEditorActions.forEach(act => {
                if (act.selected) {
                    if (e.detail === 'left') act.at = Math.max(0, act.at - 50);
                    if (e.detail === 'right') act.at = act.at + 50;
                }
            });
            window.presetEditorActions.sort((a,b)=>a.at-b.at);
            drawPresetEditor();
        }
    });

    // 🎯 FIX: Permite poner un ancla flotante incluso dentro del editor de presets
    window.addEventListener('toggleSyncPoint', () => {
        if (modal && modal.style.display === 'flex') {
            let selected = window.presetEditorActions.filter(a => a.selected);
            savePresetHistoryState();
            if (selected.length === 0) {
                let timeMs = Math.max(0, Math.round(pXToTime(pCanvas ? pCanvas.width / 2 : 100) / 50) * 50);
                window.presetEditorActions.push({ at: timeMs, pos: 50, selected: true, isSync: true });
                window.presetEditorActions.sort((a,b)=>a.at-b.at);
            } else {
                selected.forEach(a => a.isSync = !a.isSync);
            }
            drawPresetEditor();
        }
    });

    renderPresetsLibrary();
});

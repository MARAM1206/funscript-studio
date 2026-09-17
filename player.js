// ==========================================================================
// REPRODUCTOR Y MOTOR DE ATAJOS V1.26.3 (AUDIO HD Y ONBOARDING ANIMADO)
// ==========================================================================

const videoPlayer = document.getElementById('video-player');
const videoProgress = document.getElementById('video-progress');
const universalInput = document.getElementById('universal-file-input');

window.videoPlayer = videoPlayer;
window.currentVideoName = null; 
window.audioPeaks = null; 
window.clipboardFunscript = null; 
window.isPastingMode = false; 
window.currentAudioBuffer = null;
window.fsTimelineVisible = true; 

// Rastreador Global de Ratón para poder pegar (Ctrl+V) sin arrastrar
window.globalMouseX = 0;
window.globalMouseY = 0;
document.addEventListener('mousemove', (e) => {
    window.globalMouseX = e.clientX;
    window.globalMouseY = e.clientY;
});

// Listeners Globales Anti-Navegador para Drag & Drop
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});
document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
});
document.addEventListener('drop', (e) => {
    if (window.isDraggingPreset) return; 
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        window.handleUniversalFiles(e.dataTransfer.files);
    }
});

universalInput?.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        window.handleUniversalFiles(e.target.files);
    }
    e.target.value = '';
});

// Motor Universal de Importación (Videos + Funscripts)
window.handleUniversalFiles = function(filesArray) {
    let funscripts = [];
    for(let i=0; i<filesArray.length; i++) {
        let file = filesArray[i];
        let ext = file.name.split('.').pop().toLowerCase();
        
        if (file.type.startsWith('video/') || ['mp4','webm','mov','mkv'].includes(ext)) {
            if (videoPlayer) {
                videoPlayer.src = URL.createObjectURL(file);
                window.currentVideoName = file.name;
                const vName = document.getElementById('v-name');
                if(vName) vName.innerText = file.name;
                
                window.audioPeaks = null;
                if(typeof window.updateFileManagerUI === 'function') window.updateFileManagerUI();
                if(typeof window.checkEmptyState === 'function') window.checkEmptyState();
                
                // 🎯 FIX: Extracción de audio en Alta Definición (8000 muestras con envolvente)
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const reader = new FileReader();
                reader.onload = function(e) {
                    audioCtx.decodeAudioData(e.target.result, function(buffer) {
                        window.currentAudioBuffer = buffer;
                        const data = buffer.getChannelData(0);
                        const step = Math.ceil(data.length / 8000); 
                        window.audioPeaks = [];
                        let maxPeak = 0;
                        for(let j=0; j<data.length; j+=step) {
                            let min = 1.0, max = -1.0;
                            for(let k=0; k<step && (j+k)<data.length; k++) {
                                let val = data[j+k];
                                if(val < min) min = val;
                                if(val > max) max = val;
                            }
                            window.audioPeaks.push({min: min, max: max}); 
                            if(Math.abs(min) > maxPeak) maxPeak = Math.abs(min);
                            if(Math.abs(max) > maxPeak) maxPeak = Math.abs(max);
                        }
                        window.audioMaxPeak = maxPeak;
                        window.audioPeaksSampleRate = buffer.sampleRate / step;
                        if (typeof window.drawTimeline === 'function') window.drawTimeline();
                    });
                };
                reader.readAsArrayBuffer(file);
            }
        } else if (['funscript','json'].includes(ext)) {
            funscripts.push(file);
        }
    }
    
    if (funscripts.length > 0 && typeof window.loadFunscriptFiles === 'function') {
        window.loadFunscriptFiles(funscripts);
    }
};

const vName = document.getElementById('v-name');
const vRes = document.getElementById('v-res');
const vFps = document.getElementById('v-fps');
const vSpeed = document.getElementById('v-speed');
const vMute = document.getElementById('v-mute');
const vTimeCurrent = document.getElementById('v-time-current');
const vTimeTotal = document.getElementById('v-time-total');

let isPanicMode = false;
const panicOverlay = document.getElementById('panic-overlay');
let preloadedPanicUrl = "";
const fakeAudio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3');
fakeAudio.loop = true;
let wasMutedBeforePanic = false;

function preloadPanicImage() {
    const randomId = Math.floor(Math.random() * 100000);
    preloadedPanicUrl = `https://picsum.photos/1280/720?random=${randomId}`;
    const img = new Image();
    img.onload = () => { preloadedPanicUrl = img.src; };
    img.onerror = () => { preloadedPanicUrl = ""; }; 
    img.src = preloadedPanicUrl; 
}
preloadPanicImage(); 

window.virtualTimeMs = 0;
window.isPlayingVirtual = false;
let virtualLastTime = 0;

window.getActualTimeMs = function() {
    return window.currentVideoName ? (videoPlayer.currentTime * 1000) : window.virtualTimeMs;
};

window.setActualTimeMs = function(ms) {
    if (window.currentVideoName) {
        if(videoPlayer.duration) videoPlayer.currentTime = Math.min(videoPlayer.duration, Math.max(0, ms / 1000));
    } else {
        window.virtualTimeMs = Math.max(0, ms);
        if (vTimeCurrent) vTimeCurrent.innerText = formatTime(window.virtualTimeMs / 1000);
    }
};

function togglePlayback() {
    if (window.currentVideoName) {
        if (videoPlayer.paused) videoPlayer.play();
        else videoPlayer.pause();
    } else {
        window.isPlayingVirtual = !window.isPlayingVirtual;
        if (window.isPlayingVirtual) {
            virtualLastTime = performance.now();
            requestAnimationFrame(virtualPlayLoop);
            window.dispatchEvent(new Event('videoPlay'));
            if (typeof window.playHandy === 'function') window.playHandy(window.virtualTimeMs);
        } else {
            if (typeof window.stopHandy === 'function') window.stopHandy();
        }
    }
}

function virtualPlayLoop() {
    if (!window.isPlayingVirtual || window.currentVideoName) return;
    let now = performance.now();
    let dt = now - virtualLastTime;
    virtualLastTime = now;
    window.virtualTimeMs += dt * currentSpeed;
    
    if (vTimeCurrent) vTimeCurrent.innerText = formatTime(window.virtualTimeMs / 1000);
    
    if (window.timelineMarkers) {
        let changed = false;
        window.timelineMarkers.forEach(m => {
            if (m.selected && Math.abs(m.at - window.virtualTimeMs) > 25) {
                m.selected = false; changed = true;
            }
        });
        if (changed && typeof window.drawTimeline === 'function') window.drawTimeline();
    }
    
    if (typeof window.drawTimeline === 'function') window.drawTimeline();
    requestAnimationFrame(virtualPlayLoop);
}

document.addEventListener('DOMContentLoaded', () => {
    
    // 🎯 FIX: Lógica de Bienvenida (Onboarding) y Animación de Vuelo
    const onboardingModal = document.getElementById('device-onboarding-modal');
    const hasOnboarded = localStorage.getItem('funscript_has_onboarded');
    
    if (!hasOnboarded && onboardingModal) {
        onboardingModal.style.display = 'flex';
        
        document.querySelectorAll('.onboarding-device-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dev = btn.getAttribute('data-device');
                window.activeDevice = dev;
                localStorage.setItem('funscript_has_onboarded', 'true');
                
                // Actualiza el texto en el menú principal
                const menuBtn = document.getElementById('device-menu-btn');
                if (menuBtn) {
                    menuBtn.innerText = `📱 ${btn.innerText}`;
                    menuBtn.classList.remove('device-alert-pulse');
                }
                
                // Marca como seleccionado en la lista desplegable interna
                document.querySelectorAll('#device-dropdown-list a').forEach(el => el.classList.remove('selected-device'));
                const targetLink = document.querySelector(`#device-dropdown-list a[data-device="${dev}"]`);
                if (targetLink) targetLink.classList.add('selected-device');

                // Calcula la trayectoria de vuelo hacia el botón de dispositivos
                const rectBtn = btn.getBoundingClientRect();
                const rectTarget = menuBtn ? menuBtn.getBoundingClientRect() : {left: window.innerWidth/2, top: 0, width: 0, height: 0};
                const tgtCx = rectTarget.left + rectTarget.width/2;
                const tgtCy = rectTarget.top + rectTarget.height/2;
                
                const card = document.querySelector('.onboarding-card');
                if (card) {
                    card.style.setProperty('--fly-x', `${tgtCx - (window.innerWidth/2)}px`);
                    card.style.setProperty('--fly-y', `${tgtCy - (window.innerHeight/2)}px`);
                    card.classList.add('fly-away');
                    
                    setTimeout(() => {
                        onboardingModal.style.display = 'none';
                        if (typeof window.drawTimeline === 'function') window.drawTimeline();
                    }, 600);
                } else {
                    onboardingModal.style.display = 'none';
                    if (typeof window.drawTimeline === 'function') window.drawTimeline();
                }
            });
        });
    }

    const savedTheme = localStorage.getItem('funscript_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        const tBtn = document.getElementById('menu-theme-btn');
        if(tBtn) tBtn.innerText = '🌙 Modo oscuro';
    }

    document.getElementById('menu-theme-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        const toggleTheme = () => {
            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem('funscript_theme', isLight ? 'light' : 'dark');
            const tBtn = document.getElementById('menu-theme-btn');
            if(tBtn) tBtn.innerText = isLight ? '🌙 Modo oscuro' : '☀️ Modo claro';
        };
        if (document.startViewTransition) {
            document.documentElement.style.setProperty('--ripple-x', e.clientX + 'px');
            document.documentElement.style.setProperty('--ripple-y', e.clientY + 'px');
            document.startViewTransition(toggleTheme);
        } else { toggleTheme(); }
    });

    document.querySelectorAll('#device-dropdown-list a[data-device]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('#device-dropdown-list a').forEach(el => el.classList.remove('selected-device'));
            link.classList.add('selected-device');
            window.activeDevice = link.dataset.device;
            
            const btn = document.getElementById('device-menu-btn');
            if (btn) {
                btn.innerText = `📱 ${link.innerText}`;
                btn.classList.remove('device-alert-pulse'); 
            }
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
        });
    });

    const ocToggle = document.querySelector('.oc-toggle');
    if (ocToggle) {
        ocToggle.addEventListener('change', (e) => {
            window.isOverclockEnabled = e.target.checked;
            const ocText = document.querySelector('.oc-text');
            if (ocText) ocText.innerText = e.target.checked ? "Overclock On" : "Overclock Off";
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
        });
    }

    const subDropdownContent = document.querySelector('.sub-dropdown-content');
    if (subDropdownContent) subDropdownContent.addEventListener('click', (e) => { e.stopPropagation(); });

    const snapToggle = document.getElementById('menu-snap-toggle');
    const snapText = document.getElementById('snap-text-display');
    
    let savedSnap = localStorage.getItem('funscript_snap');
    if(savedSnap !== null) { snapToggle.checked = (savedSnap === 'true'); }
    window.snapValue = snapToggle.checked ? 5 : 1;
    if (snapText) snapText.innerText = snapToggle.checked ? "🔒 Bloqueo de 5%" : "🔓 Desbloqueado";

    snapToggle.addEventListener('change', (e) => {
        window.snapValue = e.target.checked ? 5 : 1;
        localStorage.setItem('funscript_snap', e.target.checked);
        if (snapText) snapText.innerText = e.target.checked ? "🔒 Bloqueo de 5%" : "🔓 Desbloqueado";

        if (document.getElementById('point-slider')) document.getElementById('point-slider').step = window.snapValue;
        if (document.getElementById('min-slider')) document.getElementById('min-slider').step = window.snapValue;
        if (document.getElementById('max-slider')) document.getElementById('max-slider').step = window.snapValue;
    });
    
    if (document.getElementById('point-slider')) document.getElementById('point-slider').step = window.snapValue;
    if (document.getElementById('min-slider')) document.getElementById('min-slider').step = window.snapValue;
    if (document.getElementById('max-slider')) document.getElementById('max-slider').step = window.snapValue;

    const fpsInput = document.getElementById('fps-jump-input');
    const btnUp = document.getElementById('fps-btn-up');
    const btnDown = document.getElementById('fps-btn-down');

    function enforceFPSLimits() {
        if (!fpsInput) return;
        let val = parseInt(fpsInput.value, 10);
        if (isNaN(val) || val <= 0) val = 1;
        if (val > window.videoFPS) val = window.videoFPS;
        fpsInput.value = val;
    }

    fpsInput?.addEventListener('change', enforceFPSLimits);
    fpsInput?.addEventListener('blur', enforceFPSLimits);

    btnUp?.addEventListener('click', () => {
        if (!fpsInput) return;
        let val = parseInt(fpsInput.value, 10) || 1;
        fpsInput.value = val + 1;
        enforceFPSLimits();
    });

    btnDown?.addEventListener('click', () => {
        if (!fpsInput) return;
        let val = parseInt(fpsInput.value, 10) || 1;
        fpsInput.value = val - 1;
        enforceFPSLimits();
    });

    const controlsModal = document.getElementById('controls-modal');
    document.getElementById('menu-controls-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (controlsModal) controlsModal.style.display = 'flex';
    });
    document.getElementById('close-controls-btn')?.addEventListener('click', () => {
        if (controlsModal) controlsModal.style.display = 'none';
    });

    let showRemainingTime = false;
    vTimeCurrent?.addEventListener('click', () => {
        showRemainingTime = !showRemainingTime;
        window.updateTimeDisplays();
    });

    vTimeTotal?.addEventListener('click', () => {
        showRemainingTime = !showRemainingTime;
        window.updateTimeDisplays();
    });

    window.updateTimeDisplays = function() {
        if (!videoPlayer || isNaN(videoPlayer.duration)) return;
        if (vTimeCurrent) {
            if (showRemainingTime) {
                vTimeCurrent.innerText = "-" + formatTime(videoPlayer.duration - videoPlayer.currentTime);
            } else {
                vTimeCurrent.innerText = formatTime(videoPlayer.currentTime);
            }
        }
    }
});

let currentSpeed = 1.0; 
window.videoFPS = 30; 

function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

window.checkEmptyState = function() {
    const emptyState = document.getElementById('video-empty-state');
    if (emptyState) {
        if (window.currentVideoName || (window.loadedFunscriptTracks && window.loadedFunscriptTracks.length > 0)) {
            emptyState.style.display = 'none';
        } else {
            emptyState.style.display = 'block';
        }
    }
};

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'add-file-btn') {
        universalInput?.click();
    }
});

document.getElementById('v-mute-container')?.addEventListener('click', () => {
    if(videoPlayer) {
        videoPlayer.muted = !videoPlayer.muted;
    }
});

videoPlayer?.addEventListener('click', () => {
    togglePlayback();
});

const fsMiniBtn = document.getElementById('fs-mini-btn');
const videoContainer = document.getElementById('video-container-wrapper');

fsMiniBtn?.addEventListener('click', () => {
    if (!document.fullscreenElement) videoContainer.requestFullscreen().catch(err => console.error(err));
});

let isSeeking = false;
videoProgress?.addEventListener('mousedown', () => isSeeking = true);
videoProgress?.addEventListener('mouseup', () => isSeeking = false);

videoProgress?.addEventListener('input', () => {
    if (videoPlayer.duration) {
        const targetTime = (videoProgress.value / 100) * videoPlayer.duration;
        videoPlayer.currentTime = targetTime;
        window.dispatchEvent(new Event('forceTimelinePan')); 
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
    }
});

videoPlayer?.addEventListener('timeupdate', () => {
    if (!isSeeking && videoPlayer.duration && videoProgress) {
        videoProgress.value = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    }
    
    if (typeof window.updateTimeDisplays === 'function') window.updateTimeDisplays();
    
    if (window.timelineMarkers) {
        let currentMs = videoPlayer.currentTime * 1000;
        let changed = false;
        window.timelineMarkers.forEach(m => {
            if (m.selected && Math.abs(m.at - currentMs) > 25) {
                m.selected = false;
                changed = true;
            }
        });
        if(changed && typeof window.drawTimeline === 'function') window.drawTimeline();
    }
});

videoPlayer?.addEventListener('play', () => {
    if (isPanicMode) fakeAudio.play();
    window.dispatchEvent(new Event('videoPlay'));
    if (typeof window.playHandy === 'function') window.playHandy(videoPlayer.currentTime * 1000);
});

videoPlayer?.addEventListener('pause', () => {
    fakeAudio.pause();
    if (typeof window.stopHandy === 'function') window.stopHandy();
});

videoPlayer?.addEventListener('seeked', () => {
    if (!videoPlayer.paused && typeof window.playHandy === 'function') window.playHandy(videoPlayer.currentTime * 1000);
});

window.drawProgressMarkers = function() {
    const c = document.getElementById('progress-markers-canvas');
    if(!c || !videoPlayer || !videoPlayer.duration || !window.timelineMarkers) return;
    
    const rect = c.parentElement.getBoundingClientRect();
    if (rect.width === 0) return;
    c.width = rect.width; 
    c.height = 4; 

    const ctx = c.getContext('2d');
    ctx.clearRect(0,0, c.width, c.height);
    
    const totalMs = videoPlayer.duration * 1000;
    if(totalMs <= 0) return;
    
    const thumbW = 12; 
    const usableWidth = c.width - thumbW;
    
    window.timelineMarkers.forEach(m => {
        ctx.fillStyle = m.isBPM ? '#0ea5e9' : '#facc15'; 
        const px = (thumbW / 2) + (m.at / totalMs) * usableWidth;
        ctx.fillRect(px - 1, 0, 2, c.height);
    });
};

videoPlayer?.addEventListener('loadedmetadata', () => {
    window.videoFPS = 30; 
    if (vRes) vRes.innerText = `${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`;
    if (vFps) vFps.innerText = `${window.videoFPS} fps`; 
    if (vTimeTotal) vTimeTotal.innerText = formatTime(videoPlayer.duration);
    
    if (typeof window.updateTimeDisplays === 'function') window.updateTimeDisplays();
    if (typeof window.updateHeatmapAndStats === 'function') window.updateHeatmapAndStats();
    if (typeof window.calculateAdaptiveZoom === 'function') window.calculateAdaptiveZoom();
    
    const fpsInput = document.getElementById('fps-jump-input');
    if (fpsInput) {
        let val = parseInt(fpsInput.value, 10);
        if (isNaN(val) || val <= 0) val = 1;
        if (val > window.videoFPS) fpsInput.value = window.videoFPS;
    }
    window.drawProgressMarkers();
});

function updateVolumeUI(vol) {
    const videoVolume = document.getElementById('video-volume');
    const volumeTooltip = document.getElementById('volume-tooltip');

    let volPercent = Math.round(vol * 100);
    
    if (volumeTooltip && videoVolume) {
        volumeTooltip.innerText = volPercent + '%';
        volumeTooltip.style.opacity = '1';
        
        const sliderWidth = videoVolume.offsetWidth || 70;
        const thumbWidth = 10;
        const usableWidth = sliderWidth - thumbWidth;
        const sliderLeft = videoVolume.offsetLeft;
        const posPx = sliderLeft + (vol * usableWidth) + (thumbWidth / 2);
        
        volumeTooltip.style.left = `${posPx}px`;

        clearTimeout(window.volTooltipTimeout);
        window.volTooltipTimeout = setTimeout(() => {
            volumeTooltip.style.opacity = '0';
        }, 1000);
    }

    if (vMute) {
        let isMuted = isPanicMode ? fakeAudio.muted : videoPlayer?.muted;
        if (vol === 0 || isMuted) vMute.innerText = "🔇";
        else if (vol < 0.3) vMute.innerText = "🔈";
        else if (vol < 0.7) vMute.innerText = "🔉";
        else vMute.innerText = "🔊";
    }
    
    const vMuteContainer = document.getElementById('v-mute-container');
    if (vMuteContainer) {
        let isMuted = isPanicMode ? fakeAudio.muted : videoPlayer?.muted;
        if (vol === 0 || isMuted) vMuteContainer.classList.add('mute-flash');
        else vMuteContainer.classList.remove('mute-flash');
    }
}

document.getElementById('video-volume')?.addEventListener('input', (e) => {
    let vol = parseFloat(e.target.value);
    if (isPanicMode) {
        fakeAudio.volume = vol;
        fakeAudio.muted = (vol === 0);
    } else {
        if(videoPlayer) {
            videoPlayer.volume = vol;
            videoPlayer.muted = (vol === 0);
        }
    }
    updateVolumeUI(vol);
});

videoPlayer?.addEventListener('volumechange', () => {
    if (isPanicMode) return; 
    let vol = videoPlayer.muted ? 0 : videoPlayer.volume;
    const videoVolume = document.getElementById('video-volume');
    if (videoVolume) videoVolume.value = vol;
    updateVolumeUI(vol);
    if (typeof window.drawTimeline === 'function') window.drawTimeline();
});

function showSpeedOverlay(speed) {
    const overlay = document.getElementById('speed-overlay');
    if(!overlay) return;
    overlay.innerText = speed.toFixed(1) + 'x';
    overlay.style.opacity = '1';
    clearTimeout(window.speedOverlayTimeout);
    window.speedOverlayTimeout = setTimeout(() => { overlay.style.opacity = '0'; }, 800);
}

window.addEventListener('keydown', (event) => {
    if ((event.target.tagName === 'INPUT' && event.target.type === 'text') || event.target.tagName === 'TEXTAREA' || event.target.type === 'number') return;

    if (event.key === 'Escape' || event.key === 'Esc') {
        
        const controlsModal = document.getElementById('controls-modal');
        if (controlsModal && controlsModal.style.display === 'flex') {
            controlsModal.style.display = 'none';
            return;
        }

        if (window.isPastingMode || window.isDraggingPreset) {
            window.isPastingMode = false;
            window.isDraggingPreset = false;
            window.timelineGhostPreset = null;
            window.timelineGhostTimeMs = null;
            window.presetFillInitialized = false; 
            window.timelineGhostTargetEnd = null;
            document.body.classList.remove('is-dragging-global');
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
            return;
        }

        if (document.fullscreenElement) {
            document.exitFullscreen();
            return;
        }

        isPanicMode = !isPanicMode;
        const videoVolume = document.getElementById('video-volume');

        if (isPanicMode) {
            wasMutedBeforePanic = videoPlayer ? videoPlayer.muted : false;
            let currentVol = videoVolume ? parseFloat(videoVolume.value) : 1;
            
            if (videoPlayer) videoPlayer.muted = true; 
            fakeAudio.volume = currentVol;
            fakeAudio.muted = (currentVol === 0);
            updateVolumeUI(currentVol); 
            
            if (videoPlayer && !videoPlayer.paused) fakeAudio.play();
            
            if (panicOverlay) {
                panicOverlay.innerHTML = `
                    <img src="${preloadedPanicUrl}" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; z-index:1;" onerror="this.style.display='none'" />
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: rgba(148, 163, 184, 0.2); font-family: monospace; font-size: 2rem; font-weight: bold; pointer-events: none; user-select: none; text-align: center; z-index: 0;">
                        PREVIEW OFFLINE<br><span style="font-size:1rem; opacity:0.5;">No network connection for media streaming</span>
                    </div>
                `;
                panicOverlay.style.display = 'block';
            }
            document.body.classList.add('panic-mode-active');
            const expBtn = document.getElementById('export-btn');
            if (expBtn) expBtn.innerText = "💾 Exportar";
            if (typeof window.drawTimeline === 'function') window.drawTimeline(); 
            
        } else {
            fakeAudio.pause();
            if (videoPlayer) videoPlayer.muted = wasMutedBeforePanic;
            
            let realVol = videoPlayer ? (videoPlayer.muted ? 0 : videoPlayer.volume) : 1;
            if (videoVolume) videoVolume.value = realVol;
            updateVolumeUI(realVol);

            if (panicOverlay) panicOverlay.style.display = 'none';
            document.body.classList.remove('panic-mode-active');
            const expBtn = document.getElementById('export-btn');
            if (expBtn) expBtn.innerText = "💾 Exportar FunScript";
            preloadPanicImage(); 
            if (typeof window.drawTimeline === 'function') window.drawTimeline(); 
        }
        return;
    }

    if (isPanicMode && event.code !== 'Space') return; 

    if (document.fullscreenElement && event.key.toLowerCase() === 'h') {
        window.fsTimelineVisible = !window.fsTimelineVisible;
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
        return;
    }

    const key = event.key.toLowerCase();

    if (key === '.') {
        event.preventDefault();
        window.dispatchEvent(new Event('toggleSyncPoint'));
        return;
    }

    if (window.isDraggingPreset || window.isPastingMode) {
        if (event.code === 'Space') {
            event.preventDefault();
            window.presetFillMode = window.presetFillMode === 'stretch' ? 'repeat' : 'stretch';
            if (typeof window.drawTimeline === 'function') window.drawTimeline();
            return;
        }
        if (key === 'arrowleft' || key === 'arrowright') {
            event.preventDefault();
            if (window.presetFillMode === 'repeat') {
                if (key === 'arrowleft') window.presetFillReps = Math.max(1, (window.presetFillReps || 1) - 1);
                if (key === 'arrowright') window.presetFillReps = (window.presetFillReps || 1) + 1;
                if (typeof window.drawTimeline === 'function') window.drawTimeline();
            }
            return;
        }
    }

    if (event.code === 'Space') {
        if (document.activeElement && (document.activeElement.tagName === 'BUTTON' || document.activeElement.type === 'range')) {
            document.activeElement.blur(); 
        }
        if (!window.isDraggingPreset && !window.isPastingMode) {
            event.preventDefault();
            togglePlayback();
            return;
        }
    }

    if (key === 't' && !event.ctrlKey) {
        event.preventDefault();
        const timeMs = Math.round(window.getActualTimeMs());
        window.timelineMarkers.push({ at: timeMs, selected: false, isBPM: false });
        window.timelineMarkers.sort((a, b) => a.at - b.at);
        if (typeof window.drawTimeline === 'function') window.drawTimeline();
        window.drawProgressMarkers();
        return;
    }

    if (key === 'y' && !event.ctrlKey) {
        event.preventDefault();
        const currentTimeMs = window.getActualTimeMs();
        if (window.timelineMarkers && window.timelineMarkers.length > 0) {
            const prevMarkers = window.timelineMarkers.filter(m => m.at < currentTimeMs - 15);
            if (prevMarkers.length > 0) {
                const targetMarker = prevMarkers[prevMarkers.length - 1];
                window.setActualTimeMs(targetMarker.at);
                window.dispatchEvent(new CustomEvent('forceTimelinePan', { detail: { timeMs: targetMarker.at } }));
                window.timelineMarkers.forEach(m => m.selected = false);
                targetMarker.selected = true;
                if (typeof window.drawTimeline === 'function') window.drawTimeline();
            }
        }
        return;
    }

    if (key === 'u' && !event.ctrlKey) {
        event.preventDefault();
        const currentTimeMs = window.getActualTimeMs();
        if (window.timelineMarkers && window.timelineMarkers.length > 0) {
            const nextMarkers = window.timelineMarkers.filter(m => m.at > currentTimeMs + 15);
            if (nextMarkers.length > 0) {
                const targetMarker = nextMarkers[0];
                window.setActualTimeMs(targetMarker.at);
                window.dispatchEvent(new CustomEvent('forceTimelinePan', { detail: { timeMs: nextMarkers[0].at } }));
                window.timelineMarkers.forEach(m => m.selected = false);
                targetMarker.selected = true;
                if (typeof window.drawTimeline === 'function') window.drawTimeline();
            }
        }
        return;
    }

    const hasSelection = window.funscriptActions && window.funscriptActions.some(a => a.selected);
    const isPlaying = window.currentVideoName ? !videoPlayer.paused : window.isPlayingVirtual;

    if (key === 'f' && !event.ctrlKey) {
        event.preventDefault();
        if (!document.fullscreenElement) videoContainer.requestFullscreen().catch(err => console.error(err));
        else document.exitFullscreen();
        return;
    }

    const forcePan = (exactTimeMs) => {
        if (exactTimeMs !== undefined) window.dispatchEvent(new CustomEvent('forceTimelinePan', { detail: { timeMs: exactTimeMs } }));
        else window.dispatchEvent(new Event('forceTimelinePan'));
    };

    if (event.ctrlKey) {
        if (key === 'z') { event.preventDefault(); window.dispatchEvent(new Event('undoAction')); return; }
        if (key === 'y') { event.preventDefault(); window.dispatchEvent(new Event('redoAction')); return; }
        if (key === 's') { event.preventDefault(); const exportBtn = document.getElementById('export-btn'); if (exportBtn) exportBtn.click(); return; }
        
        if (key === 'a') { 
            event.preventDefault(); 
            const hasMarkerSelected = window.timelineMarkers && window.timelineMarkers.some(m => m.selected);
            if (hasMarkerSelected) {
                window.timelineMarkers.forEach(m => m.selected = true);
                if (window.funscriptActions) window.funscriptActions.forEach(p => p.selected = false);
                if (typeof window.drawTimeline === 'function') window.drawTimeline();
                if (typeof window.drawProgressMarkers === 'function') window.drawProgressMarkers();
            } else {
                window.dispatchEvent(new Event('selectAllPoints')); 
            }
            return; 
        }
        
        if (key === 'c') { event.preventDefault(); window.dispatchEvent(new Event('copyPoints')); return; }
        if (key === 'x') { event.preventDefault(); window.dispatchEvent(new Event('cutPoints')); return; }
        
        if (key === 'v') { 
            event.preventDefault(); 
            const c = document.getElementById('timeline-canvas');
            if (c) {
                const rect = c.getBoundingClientRect();
                window.lastMouseX = (window.globalMouseX - rect.left) * (c.width / rect.width);
                window.lastMouseY = (window.globalMouseY - rect.top) * (c.height / rect.height);
            }
            window.dispatchEvent(new Event('pastePoints')); 
            return; 
        }
        
        if (key === 'arrowup' || key === 'arrowdown') {
            event.preventDefault(); event.stopPropagation();
            window.dispatchEvent(new CustomEvent('injectPoint', { detail: { dir: key === 'arrowup' ? 'up' : 'down' } }));
            return;
        }

        if (key === 'arrowleft' || key === 'arrowright') {
            event.preventDefault(); event.stopPropagation();
            window.dispatchEvent(new CustomEvent('nudgeTime', { detail: key.replace('arrow','') }));
            return;
        }
        return; 
    }

    if (key === 'delete' || key === 'backspace') {
        event.preventDefault(); window.dispatchEvent(new Event('deletePoints')); return;
    }

    if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
        event.preventDefault(); event.stopPropagation();
        if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur(); 
        
        if (key === 'arrowup' || key === 'arrowdown') {
            window.dispatchEvent(new CustomEvent('nudgePoints', { detail: key.replace('arrow','') }));
        } 
        else if (key === 'arrowleft' || key === 'arrowright') {
            if (!isPlaying && !hasSelection) {
                const fpsInput = document.getElementById('fps-jump-input');
                const framesToJump = fpsInput ? (parseInt(fpsInput.value, 10) || 1) : 1;
                const msPerFrame = 1000 / window.videoFPS;
                const jumpMs = framesToJump * msPerFrame;
                let newTime = window.getActualTimeMs() + (key === 'arrowright' ? jumpMs : -jumpMs);
                window.setActualTimeMs(newTime);
                forcePan(newTime);
            } else if (hasSelection) {
                window.dispatchEvent(new CustomEvent('nudgeTime', { detail: key.replace('arrow','') }));
            }
        }
        return; 
    }

    if (key === 'c' && hasSelection) { event.preventDefault(); window.dispatchEvent(new CustomEvent('magnetPoint')); }
    
    if (key === 'm' && !event.ctrlKey) { 
        event.preventDefault(); 
        if(videoPlayer) videoPlayer.muted = !videoPlayer.muted; 
    }
    
    if (key === 'e' && !event.ctrlKey) { 
        event.preventDefault(); 
        currentSpeed = Math.max(0.1, currentSpeed - 0.1); 
        videoPlayer.playbackRate = currentSpeed; 
        if(vSpeed) vSpeed.innerText = `⚡ Vel: ${currentSpeed.toFixed(1)}x`; 
        showSpeedOverlay(currentSpeed);
    }
    if (key === 'r' && !event.ctrlKey) { 
        event.preventDefault(); 
        currentSpeed = Math.min(5.0, currentSpeed + 0.1); 
        videoPlayer.playbackRate = currentSpeed; 
        if(vSpeed) vSpeed.innerText = `⚡ Vel: ${currentSpeed.toFixed(1)}x`; 
        showSpeedOverlay(currentSpeed);
    }

    const fpsInput = document.getElementById('fps-jump-input');
    const framesToJump = fpsInput ? (parseInt(fpsInput.value, 10) || 1) : 1;
    const msPerFrame = 1000 / window.videoFPS;
    const stepTimePrecision = (framesToJump * msPerFrame) / 1000; 

    // 🎯 FIX: Momentum inyectado a los saltos manuales con Q/W y A/S
    if (key === 'q' && !event.ctrlKey) { 
        event.preventDefault(); 
        window.setActualTimeMs(window.getActualTimeMs() - stepTimePrecision * 1000); 
        window.scrollMomentum = -5;
        forcePan(); 
    }
    if (key === 'w' && !event.ctrlKey) { 
        event.preventDefault(); 
        window.setActualTimeMs(window.getActualTimeMs() + stepTimePrecision * 1000); 
        window.scrollMomentum = 5;
        forcePan(); 
    }
    
    if (key === 'a' && !event.ctrlKey) { event.preventDefault(); window.setActualTimeMs(window.getActualTimeMs() - 5000); window.scrollMomentum = -10; forcePan(); }
    if (key === 's' && !event.ctrlKey) { event.preventDefault(); window.setActualTimeMs(window.getActualTimeMs() + 5000); window.scrollMomentum = 10; forcePan(); }

    const syncSlider = () => { if (typeof window.syncSliderWithSelection === 'function') window.syncSliderWithSelection(); };

    if (key === 'b' && !event.ctrlKey) {
        event.preventDefault();
        if (window.funscriptActions && window.funscriptActions.length > 0) {
            const currentTimeMs = window.getActualTimeMs();
            const prevPoints = window.funscriptActions.filter(act => act.at < currentTimeMs - 15);
            if (prevPoints.length > 0) {
                const target = prevPoints[prevPoints.length - 1];
                window.setActualTimeMs(target.at);
                window.funscriptActions.forEach(a => a.selected = false);
                target.selected = true; syncSlider(); forcePan(target.at);
            }
        }
    }
    if (key === 'n' && !event.ctrlKey) {
        event.preventDefault();
        if (window.funscriptActions && window.funscriptActions.length > 0) {
            const currentTimeMs = window.getActualTimeMs();
            const nextPoints = window.funscriptActions.filter(act => act.at > currentTimeMs + 15);
            if (nextPoints.length > 0) {
                const target = nextPoints[0];
                window.setActualTimeMs(target.at);
                window.funscriptActions.forEach(a => a.selected = false);
                target.selected = true; syncSlider(); forcePan(target.at);
            } else {
                const lastTarget = window.funscriptActions[window.funscriptActions.length - 1];
                if (currentTimeMs >= lastTarget.at + 15) {
                    window.setActualTimeMs(lastTarget.at);
                    window.funscriptActions.forEach(a => a.selected = false);
                    lastTarget.selected = true; syncSlider(); forcePan(lastTarget.at);
                }
            }
        }
    }
}, true);

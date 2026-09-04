// ==========================================================================
// BPM EXTRACTOR V1.2.4 (MOTOR DE ANÁLISIS DE GRAVES Y KICKS DE AUDIO)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const sensSlider = document.getElementById('bpm-sens-slider');
    const freqSlider = document.getElementById('bpm-freq-slider');
    const sensValDisplay = document.getElementById('bpm-sens-val');
    const freqValDisplay = document.getElementById('bpm-freq-val');
    const analyzeBtn = document.getElementById('analyze-bpm-btn');
    const clearBtn = document.getElementById('clear-bpm-btn');

    if (!sensSlider || !freqSlider || !analyzeBtn) return;

    sensSlider.addEventListener('input', (e) => {
        sensValDisplay.innerText = `${e.target.value}%`;
    });

    freqSlider.addEventListener('input', (e) => {
        freqValDisplay.innerText = `${e.target.value} Hz`;
    });

    clearBtn.addEventListener('click', () => {
        if (!window.timelineMarkers || window.timelineMarkers.length === 0) return;
        if(confirm("¿Eliminar todos los marcadores BPM (Azules)? Los marcadores manuales (Magentas) no se borrarán.")) {
            window.timelineMarkers = window.timelineMarkers.filter(m => !m.isBPM);
            if(typeof window.drawTimeline === 'function') window.drawTimeline();
            if(typeof window.drawProgressMarkers === 'function') window.drawProgressMarkers();
        }
    });

    analyzeBtn.addEventListener('click', async () => {
        if (document.body.classList.contains('panic-mode-active')) return;
        
        if (!window.currentAudioBuffer) {
            alert("Primero arrastra un video al reproductor para poder analizar su audio.");
            return;
        }

        const originalText = analyzeBtn.innerText;
        analyzeBtn.innerText = "⏳ Analizando graves...";
        analyzeBtn.disabled = true;

        try {
            const threshold = parseInt(sensSlider.value, 10) / 100;
            const cutoffFreq = parseInt(freqSlider.value, 10);
            
            const minDistanceMs = 300; 

            const offlineCtx = new OfflineAudioContext(1, window.currentAudioBuffer.length, window.currentAudioBuffer.sampleRate);
            const source = offlineCtx.createBufferSource();
            source.buffer = window.currentAudioBuffer;

            const filter = offlineCtx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.value = cutoffFreq;

            source.connect(filter);
            filter.connect(offlineCtx.destination);
            source.start(0);

            const renderedBuffer = await offlineCtx.startRendering();
            const data = renderedBuffer.getChannelData(0);

            let peaks = [];
            let lastPeakTime = 0;
            const sampleRate = renderedBuffer.sampleRate;

            let maxAmp = 0;
            for(let i=0; i<data.length; i+=100) {
                if(Math.abs(data[i]) > maxAmp) maxAmp = Math.abs(data[i]);
            }

            for(let i=0; i<data.length; i++) {
                let amp = Math.abs(data[i]) / maxAmp;
                if(amp >= threshold) {
                    let timeMs = (i / sampleRate) * 1000;
                    if(timeMs - lastPeakTime > minDistanceMs) {
                        peaks.push(timeMs);
                        lastPeakTime = timeMs;
                    }
                }
            }

            if (peaks.length === 0) {
                alert("No se encontraron golpes graves con esta sensibilidad. Intenta bajar la sensibilidad o subir los Hz.");
            } else {
                peaks.forEach(p => {
                    window.timelineMarkers.push({ at: Math.round(p), selected: false, isBPM: true });
                });
                
                window.timelineMarkers.sort((a,b) => a.at - b.at);
                
                if(typeof window.drawTimeline === 'function') window.drawTimeline();
                if(typeof window.drawProgressMarkers === 'function') window.drawProgressMarkers();
                alert(`¡Análisis completo! Se inyectaron ${peaks.length} marcadores BPM.`);
            }

        } catch (error) {
            alert("Error al analizar el audio: " + error.message);
        }

        analyzeBtn.innerText = originalText;
        analyzeBtn.disabled = false;
    });
});

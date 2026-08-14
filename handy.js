// ==========================================================================
// THE HANDY API V80.0: SUBIDA INTELIGENTE (CERO SUBIDAS FANTASMA)
// ==========================================================================

const HANDY_API_BASE = "https://www.handyfeeling.com/api/handy/v2";
const HANDY_UPLOAD_URL = "https://www.handyfeeling.com/api/sync/upload";

let handyKey = localStorage.getItem('funscript_handy_key') || "";
let isHandyConnected = false;
let serverTimeOffset = 0;
let autoUpdateTimeout = null;

// 🎯 FIX: Memoria estricta del último script subido para evitar envíos basura
let lastUploadedScriptStr = "";

const handyKeyInput = document.getElementById('handy-key');
const handyConnectBtn = document.getElementById('handy-connect-btn');
const handyStatus = document.getElementById('handy-status');

const handyOffsetInput = document.getElementById('handy-offset'); 
const handyOffsetDisplay = document.getElementById('handy-offset-display');

if (handyOffsetInput && handyOffsetDisplay) {
    handyOffsetInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        
        if (Math.abs(val) <= 15) {
            val = 0; 
        } else {
            let remainder = val % 50;
            if (remainder >= -5 && remainder <= 5) {
                val = Math.round(val / 50) * 50;
            }
        }
        
        e.target.value = val;
        handyOffsetDisplay.innerText = val;
    });
}

if (handyKeyInput) handyKeyInput.value = handyKey;

handyConnectBtn?.addEventListener('click', async () => {
    const key = handyKeyInput.value.trim();
    if (!key) { alert("Ingresa tu Connection Key en el recuadro."); return; }
    
    handyKey = key;
    localStorage.setItem('funscript_handy_key', handyKey);
    handyStatus.innerText = "⏳";
    handyStatus.title = "Conectando...";

    try {
        const res = await fetch(`${HANDY_API_BASE}/connected`, { headers: { 'X-Connection-Key': handyKey } });
        const data = await res.json();
        
        if (data.connected) {
            isHandyConnected = true;
            handyStatus.innerText = "🟢";
            handyStatus.title = "Conectado";
            await syncServerTime();
            
            // Forzamos la subida inicial vaciando la memoria temporal
            lastUploadedScriptStr = "";
            if (window.funscriptActions && window.funscriptActions.length > 0) triggerHandyUpdate();
        } else {
            throw new Error("Juguete apagado o desconectado.");
        }
    } catch (err) {
        isHandyConnected = false;
        handyStatus.innerText = "❌";
        handyStatus.title = "Error de conexión";
    }
});

async function syncServerTime() {
    let sumOffset = 0;
    for (let i = 0; i < 3; i++) {
        const sendTime = Date.now();
        const res = await fetch(`${HANDY_API_BASE}/servertime`, { headers: { 'X-Connection-Key': handyKey } });
        const data = await res.json();
        const receiveTime = Date.now();
        const rtt = receiveTime - sendTime;
        const estimatedServerTime = data.serverTime + (rtt / 2);
        sumOffset += (estimatedServerTime - receiveTime);
    }
    serverTimeOffset = Math.round(sumOffset / 3);
}

async function uploadScriptToHandyCloud() {
    if (!window.funscriptActions || window.funscriptActions.length === 0) return null;
    let csvString = window.funscriptActions.map(act => `${act.at},${act.pos}`).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('syncFile', blob, 'script.csv');

    handyStatus.innerText = "☁️";
    handyStatus.title = "Subiendo a la nube...";

    try {
        const res = await fetch(HANDY_UPLOAD_URL, { method: 'POST', body: formData });
        const data = await res.json();
        return data.url;
    } catch (err) { return null; }
}

async function setupHandyScript(url) {
    try {
        await fetch(`${HANDY_API_BASE}/hssp/setup`, {
            method: 'PUT',
            headers: { 'X-Connection-Key': handyKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });
        handyStatus.innerText = "🟢";
        handyStatus.title = "Sincronizado";
    } catch (err) {}
}

window.playHandy = async function(videoCurrentTimeMs) {
    if (!isHandyConnected) return;
    try {
        const serverTime = Date.now() + serverTimeOffset;
        const userOffset = handyOffsetInput ? (parseInt(handyOffsetInput.value, 10) || 0) : 0;
        const adjustedVideoTime = Math.max(0, Math.round(videoCurrentTimeMs) + userOffset);

        await fetch(`${HANDY_API_BASE}/hssp/play`, {
            method: 'PUT',
            headers: { 'X-Connection-Key': handyKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ estimatedServerTime: serverTime, startTime: adjustedVideoTime })
        });
    } catch (err) {}
};

window.stopHandy = async function() {
    if (!isHandyConnected) return;
    try {
        await fetch(`${HANDY_API_BASE}/hssp/stop`, { method: 'PUT', headers: { 'X-Connection-Key': handyKey } });
    } catch (err) {}
};

window.triggerHandyUpdate = function() {
    if (!isHandyConnected) return;
    
    // 🎯 FIX: Filtro Maestro. Construimos un mapa de coordenadas puras (ignorando si están seleccionadas o no).
    const currentScriptStr = window.funscriptActions ? window.funscriptActions.map(a => `${a.at},${a.pos}`).join('|') : "";
    
    // Si la rítmica y los puntos son exactamente iguales a la última vez, abortamos la subida.
    if (currentScriptStr === lastUploadedScriptStr) return; 
    
    // Si pasó el filtro, guardamos esta nueva configuración como la más reciente
    lastUploadedScriptStr = currentScriptStr;

    clearTimeout(autoUpdateTimeout);
    
    handyStatus.innerText = "⌛";
    handyStatus.title = "Esperando inactividad para subir...";
    
    autoUpdateTimeout = setTimeout(async () => {
        const scriptUrl = await uploadScriptToHandyCloud();
        if (scriptUrl) {
            await setupHandyScript(scriptUrl);
            const videoNode = document.getElementById('video-player');
            if (videoNode && !videoNode.paused) {
                window.playHandy(videoNode.currentTime * 1000);
            }
        } else {
            handyStatus.innerText = "🟢";
            handyStatus.title = "Conectado";
        }
    }, 1000);
};

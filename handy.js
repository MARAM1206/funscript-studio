// ==========================================================================
// THE HANDY API V81.0: HARDWARE OFFSET Y SUBIDA INSTANTANEA
// ==========================================================================

const HANDY_API_BASE = "https://www.handyfeeling.com/api/handy/v2";
const HANDY_UPLOAD_URL = "https://www.handyfeeling.com/api/sync/upload";

let handyKey = localStorage.getItem('funscript_handy_key') || "";
let isHandyConnected = false;
let serverTimeOffset = 0;

let autoUpdateTimeout = null;
let lastUploadedScriptStr = "";
let isUpdatePending = false; 

const handyKeyInput = document.getElementById('handy-key');
const handyConnectBtn = document.getElementById('handy-connect-btn');
const handyStatus = document.getElementById('handy-status');

const handyOffsetInput = document.getElementById('handy-offset'); 
const handyOffsetDisplay = document.getElementById('handy-offset-display');

if (handyOffsetInput && handyOffsetDisplay) {
    handyOffsetInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        handyOffsetDisplay.innerText = val;
    });

    // 🎯 FIX: El Slider ahora altera el Offset interno físico del Handy
    handyOffsetInput.addEventListener('change', async (e) => {
        if (!isHandyConnected) return;
        let val = parseInt(e.target.value, 10);
        handyStatus.innerText = "⏳";
        try {
            await fetch(`${HANDY_API_BASE}/offset`, {
                method: 'PUT',
                headers: { 'X-Connection-Key': handyKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ offset: val })
            });
            handyStatus.innerText = "🟢";
        } catch(err) {
            handyStatus.innerText = "❌";
        }
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
            
            // 🎯 FIX: Rescatar el Offset actual que tenga guardado la máquina
            try {
                const offRes = await fetch(`${HANDY_API_BASE}/offset`, { headers: { 'X-Connection-Key': handyKey } });
                const offData = await offRes.json();
                if (offData && typeof offData.offset === 'number') {
                    if (handyOffsetInput) handyOffsetInput.value = offData.offset;
                    if (handyOffsetDisplay) handyOffsetDisplay.innerText = offData.offset;
                }
            } catch(e) {}

            await syncServerTime();
            lastUploadedScriptStr = "";
            if (window.funscriptActions && window.funscriptActions.length > 0) window.triggerHandyUpdate();
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

// 🎯 FIX: Función para forzar subida si quedó algo en cola
async function forceUploadPending() {
    if (!isUpdatePending) return;
    const scriptUrl = await uploadScriptToHandyCloud();
    if (scriptUrl) {
        await setupHandyScript(scriptUrl);
    }
    isUpdatePending = false;
}

window.playHandy = async function(videoCurrentTimeMs) {
    if (!isHandyConnected) return;
    try {
        // Si hay una actualización esperando el timer, cancélalo y súbela de inmediato antes de arrancar.
        if (isUpdatePending) {
            clearTimeout(autoUpdateTimeout);
            await forceUploadPending();
            handyStatus.innerText = "🟢";
        }

        const serverTime = Date.now() + serverTimeOffset;
        
        // Ya no sumamos el offset aquí. La máquina lo hace sola gracias a la API /offset.
        const adjustedVideoTime = Math.max(0, Math.round(videoCurrentTimeMs)); 

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
    
    const currentScriptStr = window.funscriptActions ? window.funscriptActions.map(a => `${a.at},${a.pos}`).join('|') : "";
    if (currentScriptStr === lastUploadedScriptStr) return; 
    lastUploadedScriptStr = currentScriptStr;

    clearTimeout(autoUpdateTimeout);
    
    isUpdatePending = true;
    handyStatus.innerText = "⌛";
    handyStatus.title = "Esperando inactividad para subir...";
    
    autoUpdateTimeout = setTimeout(async () => {
        await forceUploadPending();
        const videoNode = document.getElementById('video-player');
        if (videoNode && !videoNode.paused) {
            window.playHandy(videoNode.currentTime * 1000);
        }
    }, 1000);
};

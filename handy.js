// ==========================================================================
// THE HANDY API V1.1.6: ESCUDO ANTI-DECIMALES Y LIMPIEZA DE GHOST SCRIPTS
// ==========================================================================

const HANDY_API_BASE = "https://www.handyfeeling.com/api/handy/v2";
const HANDY_UPLOAD_URL = "https://www.handyfeeling.com/api/sync/upload";

let handyKey = localStorage.getItem('funscript_handy_key') || "";
let isHandyConnected = false;
let serverTimeOffset = 0;
let pingInterval = null; 

let autoUpdateTimeout = null;
let isUpdatePending = false; 

const handyKeyInput = document.getElementById('handy-key');
const handyConnectBtn = document.getElementById('handy-connect-btn');
const handyStatus = document.getElementById('handy-status');

const handyOffsetInput = document.getElementById('handy-offset'); 
const handyOffsetDisplay = document.getElementById('handy-offset-display');

const handyLatencyDisplay = document.getElementById('handy-latency-display');
const handyAutoSyncBtn = document.getElementById('handy-autosync-btn');
const handyDisconnectBtn = document.getElementById('handy-disconnect-btn');
const handyConnectionStatus = document.getElementById('handy-connection-status');

let savedOffset = parseInt(localStorage.getItem('funscript_handy_offset')) || 0;
if (handyOffsetInput) handyOffsetInput.value = savedOffset;
if (handyOffsetDisplay) handyOffsetDisplay.innerText = savedOffset;

if (handyOffsetInput && handyOffsetDisplay) {
    handyOffsetInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        if (Math.abs(val) <= 12) val = 0;
        e.target.value = val;
        handyOffsetDisplay.innerText = val;
    });

    handyOffsetInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        localStorage.setItem('funscript_handy_offset', val);
        const videoNode = document.getElementById('video-player');
        if (videoNode && !videoNode.paused && isHandyConnected) {
            window.playHandy(videoNode.currentTime * 1000);
        }
    });
}

handyDisconnectBtn?.addEventListener('click', () => {
    isHandyConnected = false;
    if(pingInterval) clearInterval(pingInterval);
    handyStatus.innerText = "🔴";
    handyStatus.title = "Desconectado";
    handyConnectionStatus.innerText = "Desconectado";
    handyConnectionStatus.style.color = "#94a3b8";
    handyDisconnectBtn.style.display = 'none';
    if (handyLatencyDisplay) handyLatencyDisplay.innerHTML = `Red: --`;
});

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
            
            handyConnectionStatus.innerText = "Conectado a la Nube";
            handyConnectionStatus.style.color = "#10b981";
            handyDisconnectBtn.style.display = 'block';

            await syncServerTime();
            if (pingInterval) clearInterval(pingInterval);
            pingInterval = setInterval(syncServerTime, 60000);

            window.triggerHandyUpdate(); 
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
    if (!isHandyConnected) return;

    if (handyAutoSyncBtn) {
        handyAutoSyncBtn.innerText = "⏳ Midiendo...";
        handyAutoSyncBtn.disabled = true;
    }

    let sumOffset = 0;
    let sumRtt = 0;
    let validPings = 0;

    for (let i = 0; i < 3; i++) {
        try {
            const sendTime = Date.now();
            const res = await fetch(`${HANDY_API_BASE}/servertime`, { headers: { 'X-Connection-Key': handyKey } });
            const data = await res.json();
            const receiveTime = Date.now();
            
            const rtt = receiveTime - sendTime;
            const estimatedServerTime = data.serverTime + (rtt / 2);
            
            sumOffset += (estimatedServerTime - receiveTime);
            sumRtt += rtt;
            validPings++;
        } catch(e) {}
    }
    
    if (validPings > 0) {
        serverTimeOffset = Math.round(sumOffset / validPings);
        const avgRtt = Math.round(sumRtt / validPings);
        
        if (handyLatencyDisplay) {
            let color = "#10b981"; 
            let status = "Excelente";
            if (avgRtt > 150) { color = "#facc15"; status = "Buena"; }
            if (avgRtt > 350) { color = "#ef4444"; status = "Inestable"; }
            
            handyLatencyDisplay.innerHTML = `Red: <span style="color: ${color}; font-weight: bold;">📶 ${status} (${avgRtt}ms)</span>`;
        }

        if (handyAutoSyncBtn) {
            handyAutoSyncBtn.innerText = "✅ ¡Relojes Sincronizados!";
            handyAutoSyncBtn.style.background = "#10b981"; 
            handyAutoSyncBtn.style.color = "white";

            setTimeout(() => {
                handyAutoSyncBtn.innerText = "🔄 Reparar Sincronía";
                handyAutoSyncBtn.style.background = ""; 
                handyAutoSyncBtn.style.color = "";
                handyAutoSyncBtn.disabled = false;
            }, 2500);
        }
    } else {
        if (handyAutoSyncBtn) {
            handyAutoSyncBtn.innerText = "❌ Falló";
            setTimeout(() => {
                handyAutoSyncBtn.innerText = "🔄 Reparar Sincronía";
                handyAutoSyncBtn.disabled = false;
            }, 2500);
        }
    }
}

handyAutoSyncBtn?.addEventListener('click', syncServerTime);

// 🎯 FIX: Escudo Anti-Decimales. Todo tiempo enviado al Handy DEBE ser número entero.
async function uploadScriptToHandyCloud() {
    let csvString = "0,0\n"; 
    if (window.funscriptActions && window.funscriptActions.length > 0) {
        csvString = window.funscriptActions.map(act => `${Math.round(act.at)},${Math.round(act.pos)}`).join('\n');
    }

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

async function forceUploadPending() {
    if (!isUpdatePending) return;
    const scriptUrl = await uploadScriptToHandyCloud();
    if (scriptUrl) {
        await setupHandyScript(scriptUrl);
        const videoNode = document.getElementById('video-player');
        if (videoNode && !videoNode.paused && isHandyConnected) {
            const serverTime = Date.now() + serverTimeOffset;
            const userOffset = handyOffsetInput ? (parseInt(handyOffsetInput.value, 10) || 0) : 0;
            const adjustedVideoTime = Math.max(0, Math.round(videoNode.currentTime * 1000) + userOffset);
            fetch(`${HANDY_API_BASE}/hssp/play`, {
                method: 'PUT',
                headers: { 'X-Connection-Key': handyKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ estimatedServerTime: serverTime, startTime: adjustedVideoTime })
            });
        }
    }
    isUpdatePending = false;
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
    
    clearTimeout(autoUpdateTimeout);
    
    isUpdatePending = true;
    handyStatus.innerText = "⌛";
    handyStatus.title = "Esperando inactividad para subir...";
    
    autoUpdateTimeout = setTimeout(forceUploadPending, 1000);
};

// ==========================================================================
// THE HANDY API V2: CONEXIÓN WI-FI, SINCRONIZACIÓN Y AUTO-SUBIDA A LA NUBE
// ==========================================================================

const HANDY_API_BASE = "https://www.handyfeeling.com/api/handy/v2";
const HANDY_UPLOAD_URL = "https://www.handyfeeling.com/api/sync/upload";

let handyKey = localStorage.getItem('funscript_handy_key') || "";
let isHandyConnected = false;
let serverTimeOffset = 0;
let autoUpdateTimeout = null;

// Referencias UI
const handyKeyInput = document.getElementById('handy-key');
const handyConnectBtn = document.getElementById('handy-connect-btn');
const handyStatus = document.getElementById('handy-status');

if (handyKeyInput) handyKeyInput.value = handyKey;

// 1. CONECTAR Y CALCULAR TIEMPO
handyConnectBtn?.addEventListener('click', async () => {
    const key = handyKeyInput.value.trim();
    if (!key) { alert("Por favor ingresa tu Connection Key."); return; }
    
    handyKey = key;
    localStorage.setItem('funscript_handy_key', handyKey);
    handyStatus.innerText = "⏳ Conectando...";
    handyStatus.style.color = "#f59e0b";

    try {
        // Verificar conexión
        const res = await fetch(`${HANDY_API_BASE}/connected`, { headers: { 'X-Connection-Key': handyKey } });
        const data = await res.json();
        
        if (data.connected) {
            isHandyConnected = true;
            handyStatus.innerText = "✅ Conectado";
            handyStatus.style.color = "#10b981";
            await syncServerTime();
            // Subir script inicial si hay puntos
            if (window.funscriptActions && window.funscriptActions.length > 0) {
                triggerHandyUpdate();
            }
        } else {
            throw new Error("El juguete está apagado o desconectado del Wi-Fi.");
        }
    } catch (err) {
        isHandyConnected = false;
        handyStatus.innerText = "❌ Error de conexión";
        handyStatus.style.color = "#ef4444";
        console.error(err);
    }
});

// Calcula la diferencia de tiempo entre tu computadora y los servidores de The Handy
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

// 2. CONVERTIR A FORMATO LIGERO (CSV) Y SUBIR
async function uploadScriptToHandyCloud() {
    if (!window.funscriptActions || window.funscriptActions.length === 0) return null;
    
    // Traducir a CSV ligero
    let csvString = window.funscriptActions.map(act => `${act.at},${act.pos}`).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('syncFile', blob, 'script.csv');

    handyStatus.innerText = "☁️ Subiendo a la nube...";
    handyStatus.style.color = "#38bdf8";

    try {
        const res = await fetch(HANDY_UPLOAD_URL, { method: 'POST', body: formData });
        const data = await res.json();
        return data.url;
    } catch (err) {
        console.error("Error al subir a HandyFeeling:", err);
        return null;
    }
}

// 3. ENVIAR A THE HANDY Y SINCRONIZAR
async function setupHandyScript(url) {
    try {
        await fetch(`${HANDY_API_BASE}/hssp/setup`, {
            method: 'PUT',
            headers: { 'X-Connection-Key': handyKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });
        handyStatus.innerText = "✅ Sincronizado";
        handyStatus.style.color = "#10b981";
    } catch (err) {
        console.error("Error en Setup de The Handy:", err);
    }
}

// 4. FUNCIONES DE PLAY / PAUSA
window.playHandy = async function(videoCurrentTimeMs) {
    if (!isHandyConnected) return;
    try {
        const serverTime = Date.now() + serverTimeOffset;
        await fetch(`${HANDY_API_BASE}/hssp/play`, {
            method: 'PUT',
            headers: { 'X-Connection-Key': handyKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ estimatedServerTime: serverTime, startTime: Math.round(videoCurrentTimeMs) })
        });
    } catch (err) {}
};

window.stopHandy = async function() {
    if (!isHandyConnected) return;
    try {
        await fetch(`${HANDY_API_BASE}/hssp/stop`, { method: 'PUT', headers: { 'X-Connection-Key': handyKey } });
    } catch (err) {}
};

// 5. DISPARADOR INTELIGENTE (Se llama cada que cambias un punto)
window.triggerHandyUpdate = function() {
    if (!isHandyConnected) return;
    
    // Si modificas puntos muy rápido, cancela el contador y empieza de nuevo
    clearTimeout(autoUpdateTimeout);
    
    // Espera 1 segundo de inactividad antes de subir a la nube
    autoUpdateTimeout = setTimeout(async () => {
        const scriptUrl = await uploadScriptToHandyCloud();
        if (scriptUrl) {
            await setupHandyScript(scriptUrl);
            
            // Si el video está reproduciéndose, arranca el juguete en automático en ese punto exacto
            const videoNode = document.getElementById('video-player');

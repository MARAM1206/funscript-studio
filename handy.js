// ==========================================================================
// MOTOR THE HANDY V1.0: CONEXIÓN WI-FI Y SINCRONIZACIÓN EN LA NUBE
// ==========================================================================

window.Handy = {
    isConnected: false,
    key: '',
    serverOffset: 0,
    apiUrl: 'https://www.handyfeeling.com/api/handy/v2',

    // Referencias UI
    statusDot: null,
    statusText: null,

    init() {
        this.statusDot = document.getElementById('handy-dot');
        this.statusText = document.getElementById('handy-status-text');
        const keyInput = document.getElementById('handy-key-input');
        const connectBtn = document.getElementById('handy-connect-btn');
        const syncBtn = document.getElementById('handy-sync-btn');

        // Cargar llave guardada en memoria
        const savedKey = localStorage.getItem('funscript_handy_key');
        if (savedKey && keyInput) keyInput.value = savedKey;

        connectBtn?.addEventListener('click', async () => {
            const key = keyInput.value.trim();
            if (!key) { alert("Por favor ingresa tu Llave de Conexión de The Handy."); return; }
            localStorage.setItem('funscript_handy_key', key);
            this.key = key;
            await this.connect();
        });

        syncBtn?.addEventListener('click', async () => {
            await this.uploadAndSetup();
        });
    },

    updateUI(state, message) {
        if (!this.statusDot || !this.statusText) return;
        this.statusText.innerText = message;
        if (state === 'error') this.statusDot.style.background = '#ef4444'; // Rojo
        else if (state === 'wait') this.statusDot.style.background = '#f59e0b'; // Amarillo
        else if (state === 'ok') this.statusDot.style.background = '#10b981'; // Verde
    },

    async fetchAPI(endpoint, options = {}) {
        const headers = {
            'X-Connection-Key': this.key,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
        };
        const res = await fetch(`${this.apiUrl}${endpoint}`, { ...options, headers });
        if (!res.ok) throw new Error(`Error API: ${res.status}`);
        return res.json();
    },

    async connect() {
        try {
            this.updateUI('wait', 'Conectando...');
            
            // 1. Verificar si el dispositivo está en línea
            const status = await this.fetchAPI('/connected');
            if (!status.connected) throw new Error("The Handy está apagado o sin Wi-Fi.");

            // 2. Sincronizar Relojes (Para que no haya lag)
            let offsets = [];
            for (let i = 0; i < 3; i++) {
                const start = Date.now();
                const timeData = await this.fetchAPI('/servertime');
                const end = Date.now();
                const rtt = end - start;
                offsets.push(timeData.serverTime + rtt / 2 - end);
            }
            this.serverOffset = Math.round(offsets.reduce((a, b) => a + b) / offsets.length);

            // 3. Poner en Modo Sync
            await this.fetchAPI('/mode/sync', { method: 'PUT' });

            this.isConnected = true;
            this.updateUI('ok', '¡Conectado y Listo!');
        } catch (error) {
            console.error(error);
            this.isConnected = false;
            this.updateUI('error', 'Fallo al conectar');
            alert("No se pudo conectar a The Handy. Revisa tu llave y que el dispositivo esté en modo Wi-Fi.");
        }
    },

    async uploadAndSetup() {
        if (!this.isConnected) { alert("Primero conecta The Handy."); return; }
        const actions = window.funscriptActions || [];
        if (actions.length === 0) { alert("No hay puntos en la línea de tiempo para subir."); return; }

        try {
            this.updateUI('wait', 'Subiendo Script...');

            // 1. Convertir Puntos a Formato CSV de The Handy
            const csvText = actions.map(act => `${act.at},${act.pos}`).join('\\n');
            const blob = new Blob([csvText], { type: 'text/csv' });
            const formData = new FormData();
            formData.append('syncFile', blob, 'script.csv');

            // 2. Subir archivo a la nube temporal de Handyfeeling
            const uploadRes = await fetch(`https://www.handyfeeling.com/api/sync/upload?connectionKey=${this.key}`, {
                method: 'POST', body: formData
            });
            const uploadData = await uploadRes.json();
            
            if (!uploadData.url) throw new Error("No se generó URL de descarga");

            // 3. Enviar la orden al juguete de que descargue el script
            await this.fetchAPI('/mode/sync/setup', {
                method: 'PUT',
                body: JSON.stringify({ url: uploadData.url })
            });

            this.updateUI('ok', '¡Script Cargado!');
            alert("¡Script subido exitosamente a The Handy! Ya puedes darle Play al video.");
        } catch (error) {
            console.error(error);
            this.updateUI('error', 'Error al subir');
            alert("Hubo un error al enviar el script al juguete.");
        }
    },

    async play(videoTimeMs) {
        if (!this.isConnected) return;
        try {
            const serverTime = Date.now() + this.serverOffset;
            await this.fetchAPI('/mode/sync/play', {
                method: 'PUT',
                body: JSON.stringify({
                    estimatedServerTime: serverTime,
                    startTime: Math.round(videoTimeMs)
                })
            });
            this.updateUI('ok', 'Jugando...');
        } catch (e) { console.error("Error Play Handy", e); }
    },

    async pause() {
        if (!this.isConnected) return;
        try {
            await this.fetchAPI('/mode/sync/pause', { method: 'PUT' });
            this.updateUI('ok', 'En pausa');
        } catch (e) { console.error("Error Pause Handy", e); }
    }
};

// Iniciar módulo al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    window.Handy.init();
});

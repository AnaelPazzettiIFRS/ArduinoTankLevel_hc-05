/* ============================================================
   ChocoTank™ Confectionery Systems — app.js (Português pt-BR)
   Utiliza a Web Serial API para ler os dados do HC-05
   (pareado via Bluetooth do Windows → porta COM virtual).
   ============================================================ */

// ────────────────────────────────────────────────────────────
// Configuração & Estado
// ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
    tankHeight: 100,       // cm — altura interna útil do silo de chocolate
    sensorOffset: 5,       // cm — distância do sensor até o chocolate a 100%
    lowThreshold: 20,      // %  — alerta de nível baixo
    criticalThreshold: 10, // %  — alerta de esgotamento crítico
    soundEnabled: true
};

let config = { ...DEFAULT_CONFIG };

// Serial
let port = null;
let reader = null;
let readableStreamClosed = null;
let buffer = '';
let isConnected = false;

// Dados
let readings = [];       // { timestamp, distance, waterLevel, percentage }
let sessionMin = Infinity;
let sessionMax = -Infinity;
let lastAlertLevel = null; // 'normal' | 'warning' | 'critical'

// Gráfico
let chartCanvas, chartCtx;

// ────────────────────────────────────────────────────────────
// Inicialização
// ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    bindSettingsListeners();
    checkBrowserSupport();
    setupChart();
});

function checkBrowserSupport() {
    if (!('serial' in navigator)) {
        document.getElementById('browser-warning').classList.remove('hidden');
        document.getElementById('connect-btn').disabled = true;
    }
}

// ────────────────────────────────────────────────────────────
// Configurações (salvas no localStorage)
// ────────────────────────────────────────────────────────────

function loadSettings() {
    try {
        const saved = localStorage.getItem('chocoTankConfig_pt');
        if (saved) config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (_) { /* ignora dados corrompidos */ }

    document.getElementById('tank-height').value        = config.tankHeight;
    document.getElementById('sensor-offset').value      = config.sensorOffset;
    document.getElementById('low-threshold').value      = config.lowThreshold;
    document.getElementById('critical-threshold').value = config.criticalThreshold;
    document.getElementById('sound-enabled').checked    = config.soundEnabled;
}

function bindSettingsListeners() {
    const ids = ['tank-height', 'sensor-offset', 'low-threshold',
                 'critical-threshold', 'sound-enabled'];
    ids.forEach(id => {
        document.getElementById(id).addEventListener('change', updateSettings);
    });
}

function updateSettings() {
    config.tankHeight        = Math.max(1, parseInt(document.getElementById('tank-height').value) || 100);
    config.sensorOffset      = Math.max(0, parseInt(document.getElementById('sensor-offset').value) || 0);
    config.lowThreshold      = Math.max(1, parseInt(document.getElementById('low-threshold').value) || 20);
    config.criticalThreshold = Math.max(1, parseInt(document.getElementById('critical-threshold').value) || 10);
    config.soundEnabled      = document.getElementById('sound-enabled').checked;

    // Crítico deve ser menor que o nível baixo
    if (config.criticalThreshold >= config.lowThreshold) {
        config.criticalThreshold = config.lowThreshold - 1;
        document.getElementById('critical-threshold').value = config.criticalThreshold;
    }

    localStorage.setItem('chocoTankConfig_pt', JSON.stringify(config));

    // Reprocessa a última leitura visualmente com as novas configurações
    if (readings.length > 0) {
        const last = readings[readings.length - 1];
        const waterLevel  = config.tankHeight - (last.distance - config.sensorOffset);
        const clamped     = Math.max(0, Math.min(config.tankHeight, waterLevel));
        const percentage  = (clamped / config.tankHeight) * 100;
        last.waterLevel   = clamped;
        last.percentage   = Math.round(percentage * 10) / 10;
        updateDashboard(last);
        updateChart();
    }
}

// ────────────────────────────────────────────────────────────
// Conexão Serial (Bluetooth HC-05)
// ────────────────────────────────────────────────────────────

async function toggleConnection() {
    if (isConnected) {
        await disconnect();
    } else {
        await connect();
    }
}

async function connect() {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });

        isConnected   = true;
        buffer        = '';
        readings      = [];
        sessionMin    = Infinity;
        sessionMax    = -Infinity;
        lastAlertLevel = null;

        updateConnectionUI(true);
        readLoop();

    } catch (err) {
        console.error('Falha na conexão:', err);
        if (err.name !== 'NotFoundError') {
            showNotification('Falha ao conectar: ' + err.message, 'error');
        }
    }
}

async function disconnect() {
    try {
        if (reader) {
            await reader.cancel();
            await readableStreamClosed.catch(() => {});
            reader = null;
            readableStreamClosed = null;
        }
        if (port) {
            await port.close();
            port = null;
        }
    } catch (err) {
        console.error('Erro ao desconectar:', err);
    }

    isConnected = false;
    updateConnectionUI(false);
}

async function readLoop() {
    while (port && port.readable && isConnected) {
        try {
            const decoder = new TextDecoderStream();
            readableStreamClosed = port.readable.pipeTo(decoder.writable);
            reader = decoder.readable.getReader();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += value;
                processBuffer();
            }
        } catch (err) {
            console.error('Erro de leitura:', err);
            if (isConnected) {
                showNotification('Conexão perdida com o sensor HC-05. Reconecte o silo.', 'error');
            }
        } finally {
            if (reader) { reader.releaseLock(); reader = null; }
        }
    }

    if (isConnected) {
        isConnected = false;
        updateConnectionUI(false);
    }
}

// ────────────────────────────────────────────────────────────
// Processamento de Dados
// ────────────────────────────────────────────────────────────

function processBuffer() {
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(/^(\d+)\s*cm$/i);
        if (match) {
            const distance = parseInt(match[1], 10);
            if (distance > 0) {
                processReading(distance);
            }
        }
    }
}

function processReading(distance) {
    const waterLevel  = config.tankHeight - (distance - config.sensorOffset);
    const clamped     = Math.max(0, Math.min(config.tankHeight, waterLevel));
    const percentage  = (clamped / config.tankHeight) * 100;

    const reading = {
        timestamp:  Date.now(),
        distance,
        waterLevel: Math.round(clamped * 10) / 10,
        percentage: Math.round(percentage * 10) / 10
    };

    readings.push(reading);
    if (readings.length > 240) readings.shift(); // ~2 minutos de dados

    sessionMin = Math.min(sessionMin, reading.percentage);
    sessionMax = Math.max(sessionMax, reading.percentage);

    updateDashboard(reading);
    checkAlerts(reading);
    updateChart();
}

// ────────────────────────────────────────────────────────────
// Atualização do Painel
// ────────────────────────────────────────────────────────────

function updateDashboard(reading) {
    // Barra de chocolate líquido no silo
    const waterEl = document.getElementById('water');
    waterEl.style.height = reading.percentage + '%';

    if (reading.percentage <= config.criticalThreshold)      waterEl.className = 'water chocolate critical';
    else if (reading.percentage <= config.lowThreshold)      waterEl.className = 'water chocolate warning';
    else                                                     waterEl.className = 'water chocolate healthy';

    // Cartões de métricas
    document.getElementById('tank-percentage').textContent  = reading.percentage.toFixed(1) + '%';
    document.getElementById('stat-distance').textContent    = reading.distance + ' cm';
    document.getElementById('stat-level').textContent       = reading.waterLevel.toFixed(1) + ' cm';
    document.getElementById('stat-percentage').textContent  = reading.percentage.toFixed(1) + '%';

    // Status do lote na produção
    let status, statusClass, emoji;
    if (reading.percentage <= config.criticalThreshold) {
        status = 'ESGOTAMENTO CRÍTICO'; statusClass = 'critical'; emoji = '🚨';
    } else if (reading.percentage <= config.lowThreshold) {
        status = 'NÍVEL BAIXO'; statusClass = 'low'; emoji = '⚠️';
    } else if (reading.percentage >= 90) {
        status = 'Silo Cheio'; statusClass = 'full'; emoji = '🍫';
    } else {
        status = 'Ponto Ideal'; statusClass = 'normal'; emoji = '🍯';
    }

    const statStatusEl = document.getElementById('stat-status');
    statStatusEl.textContent = status;
    statStatusEl.className   = 'stat-value ' + statusClass;
    document.getElementById('status-emoji').textContent = emoji;

    // Mínimo, Máximo e Contagem
    if (sessionMin !== Infinity) {
        document.getElementById('stat-min').textContent = sessionMin.toFixed(1) + '%';
        document.getElementById('stat-max').textContent = sessionMax.toFixed(1) + '%';
    }
    document.getElementById('stat-count').textContent = readings.length;
}

function updateConnectionUI(connected) {
    document.getElementById('status-dot').className =
        'status-dot ' + (connected ? 'connected' : 'disconnected');
    document.getElementById('status-text').textContent =
        connected ? 'Telemetria Ativa' : 'Desconectado';

    const btn = document.getElementById('connect-btn');
    document.getElementById('connect-text').textContent =
        connected ? 'Desconectar Silo' : 'Conectar Silo';
    btn.classList.toggle('connected', connected);
}

// ────────────────────────────────────────────────────────────
// Sistema de Alertas
// ────────────────────────────────────────────────────────────

function checkAlerts(reading) {
    const timeStr = new Date().toLocaleTimeString('pt-BR');

    if (reading.percentage <= config.criticalThreshold) {
        if (lastAlertLevel !== 'critical') {
            lastAlertLevel = 'critical';
            const msg = `🚨 ESGOTAMENTO CRÍTICO — Chocolate em ${reading.percentage.toFixed(1)}% (${reading.waterLevel.toFixed(1)} cm)! Desligue a bomba para evitar entupimento.`;
            showNotification(msg, 'critical');
            addAlertLog(timeStr, msg, 'critical');
            sendBrowserNotification('🚨 Esgotamento Crítico de Chocolate!', msg);
            if (config.soundEnabled) playAlertSound('critical');
        }
    } else if (reading.percentage <= config.lowThreshold) {
        if (lastAlertLevel !== 'warning') {
            lastAlertLevel = 'warning';
            const msg = `⚠️ NÍVEL BAIXO — Chocolate derretido em ${reading.percentage.toFixed(1)}% (${reading.waterLevel.toFixed(1)} cm). Prepare novo lote para reabastecimento.`;
            showNotification(msg, 'warning');
            addAlertLog(timeStr, msg, 'warning');
            sendBrowserNotification('⚠️ Nível Baixo de Chocolate', msg);
            if (config.soundEnabled) playAlertSound('warning');
        }
    } else {
        if (lastAlertLevel === 'critical' || lastAlertLevel === 'warning') {
            const msg = `🍫 Lote reabastecido! Nível de chocolate normalizado em ${reading.percentage.toFixed(1)}%.`;
            showNotification(msg, 'success');
            addAlertLog(timeStr, msg, 'success');
        }
        lastAlertLevel = 'normal';
    }
}

// ── Notificação no topo da página ──

function showNotification(message, type) {
    const banner = document.getElementById('notification-banner');
    document.getElementById('notification-text').textContent = message;
    document.getElementById('notification-icon').textContent =
        { critical: '🚨', warning: '⚠️', success: '🍫', error: '❌' }[type] || '🍫';

    banner.className = 'notification-banner ' + type;

    if (type !== 'critical') {
        setTimeout(dismissNotification, 5000);
    }
}

function dismissNotification() {
    document.getElementById('notification-banner').className = 'notification-banner hidden';
}

// ── Registro de alertas ──

function addAlertLog(time, message, type) {
    const log   = document.getElementById('alert-log');
    const empty = log.querySelector('.alert-empty');
    if (empty) empty.remove();

    const entry = document.createElement('div');
    entry.className = 'alert-entry ' + type;
    entry.innerHTML =
        `<span class="alert-time">${time}</span>` +
        `<span class="alert-message">${message}</span>`;
    log.insertBefore(entry, log.firstChild);

    while (log.children.length > 50) log.removeChild(log.lastChild);
}

function clearAlertLog() {
    document.getElementById('alert-log').innerHTML =
        '<p class="alert-empty">Registro limpo. Monitoramento do silo ativo.</p>';
}

// ── Notificações do Navegador ──

function requestNotificationPermission() {
    if (!('Notification' in window)) {
        showNotification('Notificações não são suportadas neste navegador.', 'error');
        return;
    }
    Notification.requestPermission().then(perm => {
        if (perm === 'granted') showNotification('Notificações do navegador ativadas com sucesso!', 'success');
        else showNotification('Permissão de notificação recusada.', 'warning');
    });
}

function sendBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '🍫', tag: 'choco-level' });
    }
}

// ── Alertas Sonoros (Web Audio API) ──

function playAlertSound(type) {
    try {
        const ctx  = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'critical') {
            osc.type = 'sawtooth';
            osc.frequency.value = 750;
            gain.gain.value = 0.22;
            osc.start();
            gain.gain.setValueAtTime(0.22, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0,    ctx.currentTime + 0.20);
            gain.gain.setValueAtTime(0.22, ctx.currentTime + 0.30);
            gain.gain.setValueAtTime(0,    ctx.currentTime + 0.45);
            gain.gain.setValueAtTime(0.22, ctx.currentTime + 0.55);
            gain.gain.setValueAtTime(0,    ctx.currentTime + 0.70);
            osc.stop(ctx.currentTime + 0.75);
        } else {
            osc.type = 'sine';
            osc.frequency.value = 520;
            gain.gain.value = 0.16;
            osc.start();
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
            osc.stop(ctx.currentTime + 0.4);
        }
    } catch (_) { /* áudio não disponível */ }
}

// ────────────────────────────────────────────────────────────
// Gráfico em Tempo Real (Canvas)
// ────────────────────────────────────────────────────────────

function setupChart() {
    chartCanvas = document.getElementById('chart');
    chartCtx    = chartCanvas.getContext('2d');
    resizeChart();
    window.addEventListener('resize', resizeChart);
    drawEmptyChart();
}

function resizeChart() {
    const container = chartCanvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w   = container.clientWidth;
    const h   = 220;
    chartCanvas.width  = w * dpr;
    chartCanvas.height = h * dpr;
    chartCanvas.style.width  = w + 'px';
    chartCanvas.style.height = h + 'px';
    chartCtx.scale(dpr, dpr);

    if (readings.length > 0) updateChart();
    else drawEmptyChart();
}

const PAD = { top: 16, right: 16, bottom: 28, left: 46 };

function logicalSize() {
    return {
        w: chartCanvas.clientWidth,
        h: chartCanvas.clientHeight,
        cw: chartCanvas.clientWidth  - PAD.left - PAD.right,
        ch: chartCanvas.clientHeight - PAD.top  - PAD.bottom
    };
}

function drawGrid(ctx, s) {
    ctx.save();
    ctx.strokeStyle = '#382015';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 0; i <= 4; i++) {
        const y = PAD.top + (s.ch * i) / 4;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(s.w - PAD.right, y);
        ctx.stroke();

        ctx.fillStyle  = '#a57e65';
        ctx.font       = '11px system-ui, sans-serif';
        ctx.textAlign  = 'right';
        ctx.fillText((100 - i * 25) + '%', PAD.left - 6, y + 4);
    }
    ctx.setLineDash([]);
    ctx.restore();
}

function drawThresholdLine(ctx, s, pct, color, label) {
    const y = PAD.top + s.ch * (1 - pct / 100);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(s.w - PAD.right, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.font      = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, PAD.left + 6, y - 5);
    ctx.restore();
}

function drawEmptyChart() {
    const s = logicalSize();
    chartCtx.clearRect(0, 0, s.w, s.h);
    chartCtx.fillStyle = '#1e120b';
    chartCtx.fillRect(0, 0, s.w, s.h);
    drawGrid(chartCtx, s);

    chartCtx.fillStyle = '#8e7362';
    chartCtx.font      = '14px system-ui, sans-serif';
    chartCtx.textAlign = 'center';
    chartCtx.fillText('Aguardando telemetria do nível de chocolate…', s.w / 2, s.h / 2);
}

function updateChart() {
    if (!chartCtx || readings.length === 0) return;

    const ctx = chartCtx;
    const s   = logicalSize();

    ctx.clearRect(0, 0, s.w, s.h);
    ctx.fillStyle = '#1e120b';
    chartCtx.fillRect(0, 0, s.w, s.h);

    drawGrid(ctx, s);
    drawThresholdLine(ctx, s, config.lowThreshold,      '#f59e0b', 'Nível Baixo ' + config.lowThreshold + '%');
    drawThresholdLine(ctx, s, config.criticalThreshold,  '#ef4444', 'Esgotamento Crítico ' + config.criticalThreshold + '%');

    if (readings.length < 2) return;

    const points = readings.map((r, i) => ({
        x: PAD.left + (i / (readings.length - 1)) * s.cw,
        y: PAD.top  + s.ch * (1 - r.percentage / 100)
    }));

    // Preenchimento gradiente: Caramelo Dourado ao Cacau
    ctx.beginPath();
    ctx.moveTo(points[0].x, PAD.top + s.ch);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, PAD.top + s.ch);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + s.ch);
    grad.addColorStop(0, 'rgba(229, 169, 60, 0.40)');
    grad.addColorStop(1, 'rgba(116, 52, 25, 0.05)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Linha de dados: Dourado Caramelo
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = '#e5a93c';
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    // Ponto atual
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
    ctx.fillStyle   = '#f5c469';
    ctx.fill();
    ctx.strokeStyle = '#150d0a';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Rótulos de tempo no eixo X
    ctx.fillStyle = '#a57e65';
    ctx.font      = '10px system-ui, sans-serif';

    ctx.textAlign = 'left';
    ctx.fillText(new Date(readings[0].timestamp).toLocaleTimeString('pt-BR'),
                 PAD.left, s.h - 4);

    ctx.textAlign = 'right';
    ctx.fillText(new Date(readings[readings.length - 1].timestamp).toLocaleTimeString('pt-BR'),
                 s.w - PAD.right, s.h - 4);

    const dur = ((readings[readings.length - 1].timestamp - readings[0].timestamp) / 1000).toFixed(0);
    document.getElementById('chart-info').textContent =
        `${readings.length} leituras · ${dur}s de monitoramento`;
}

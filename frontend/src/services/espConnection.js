/**
 * ESP32 Connection Service
 * Connected directly to Production Render Backend (https://esp32-1-5ssj.onrender.com / wss://esp32-1-5ssj.onrender.com)
 */

export class ESPConnectionService {
  constructor() {
    this.socket = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
    this.mode = localStorage.getItem('esp_connection_mode') || 'relay';
    this.config = {
      directIp: localStorage.getItem('esp_direct_ip') || '192.168.1.100',
      directWsPath: localStorage.getItem('esp_direct_ws_path') || '/ws',
      relayUrl: localStorage.getItem('esp_relay_url') || 'https://esp32-1-5ssj.onrender.com',
      deviceId: localStorage.getItem('esp_device_id') || 'esp32-1',
    };

    this.listeners = new Set();
    this.pingInterval = null;
    this.latency = 0;
    this.lastPingTime = 0;

    // Default telemetry state
    this.state = {
      deviceId: this.config.deviceId,
      status: 'offline',
      temperature: 28.4,
      humidity: undefined,
      pH: 6.82,
      voltage: 1.73,
      raw: 2150,
      tempConnected: true,
      phConnected: true,
      led: true,
      tempEnabled: true,
      lastSeen: new Date().toISOString(),
      latency: 0,
      connectionMode: this.mode
    };
  }

  // Subscribe to state updates
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.state, this.status);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const listener of this.listeners) {
      listener({ ...this.state, latency: this.latency, connectionMode: this.mode }, this.status);
    }
  }

  updateConfig(newMode, newConfig) {
    this.mode = newMode;
    this.config = { ...this.config, ...newConfig };
    
    localStorage.setItem('esp_connection_mode', this.mode);
    localStorage.setItem('esp_direct_ip', this.config.directIp);
    localStorage.setItem('esp_direct_ws_path', this.config.directWsPath);
    localStorage.setItem('esp_relay_url', this.config.relayUrl);
    localStorage.setItem('esp_device_id', this.config.deviceId);

    this.connect();
  }

  connect() {
    this.disconnect();
    this.status = 'connecting';
    this.notify();

    if (this.mode === 'direct') {
      this.connectDirectESP32();
    } else {
      this.connectRelayBackend();
      this.fetchActiveBatchFromBackend();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.status = 'disconnected';
    this.state.status = 'offline';
    this.notify();
  }

  // --- DIRECT ESP32 CONNECTION MODE ---
  connectDirectESP32() {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ip = this.config.directIp.trim();
    ip = ip.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProto}//${ip}${this.config.directWsPath}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.status = 'connected';
        this.state.status = 'online';
        this.startPingLoop();
        this.notify();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            this.latency = Date.now() - this.lastPingTime;
          } else {
            this.handleIncomingData(data);
          }
        } catch (e) {
          console.warn('[ESP Connection Direct] Payload received:', event.data);
        }
      };

      this.socket.onerror = (err) => {
        console.error('[ESP Connection Direct] WebSocket Error:', err);
        this.status = 'error';
        this.notify();
      };

      this.socket.onclose = () => {
        this.status = 'disconnected';
        this.state.status = 'offline';
        this.notify();
      };
    } catch (e) {
      console.error('[ESP Connection Direct] Setup exception:', e);
      this.status = 'error';
      this.notify();
    }
  }

  // --- RELAY BACKEND SERVER MODE (PRODUCTION RENDER SERVER) ---
  connectRelayBackend() {
    try {
      let baseUrl = this.config.relayUrl.trim();
      baseUrl = baseUrl.replace(/\/$/, '');
      
      const wsProto = baseUrl.startsWith('https') ? 'wss:' : 'ws:';
      const cleanHost = baseUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProto}//${cleanHost}?clientType=dashboard&deviceId=${encodeURIComponent(this.config.deviceId)}`;

      console.log(`[ESP Connection Relay] Opening WSS session to: ${wsUrl}`);
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.status = 'connected';
        this.startPingLoop();
        this.notify();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            this.latency = Date.now() - this.lastPingTime;
            this.notify();
          } else if (data.type === 'deviceUpdate') {
            if (data.activeBatch !== undefined) {
              this.state.activeBatch = data.activeBatch;
            }
            this.handleIncomingData(data.data || {});
          } else if (data.type === 'fermentationStart') {
            this.state.activeBatch = data.activeBatch || data.batch;
            this.notify();
          } else if (data.type === 'fermentationStop') {
            this.state.activeBatch = null;
            this.notify();
          } else {
            this.handleIncomingData(data);
          }
        } catch (e) {
          console.warn('[ESP Connection Relay] WS payload:', event.data);
        }
      };

      this.socket.onerror = (err) => {
        console.error('[ESP Connection Relay] WS Error:', err);
        this.status = 'error';
        this.notify();
      };

      this.socket.onclose = () => {
        this.status = 'disconnected';
        this.state.status = 'offline';
        this.notify();
      };
    } catch (e) {
      console.error('[ESP Connection Relay] Setup exception:', e);
      this.status = 'error';
      this.notify();
    }
  }

  startPingLoop() {
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        this.socket.send(JSON.stringify({ type: 'ping', timestamp: this.lastPingTime }));
      }
    }, 5000);
  }

  handleIncomingData(data) {
    if (data.temperature !== undefined) this.state.temperature = data.temperature;
    if (data.pH !== undefined) this.state.pH = data.pH;
    if (data.voltage !== undefined) this.state.voltage = data.voltage;
    if (data.raw !== undefined) this.state.raw = data.raw;
    if (data.phConnected !== undefined) this.state.phConnected = data.phConnected;
    if (data.tempConnected !== undefined) this.state.tempConnected = data.tempConnected;
    if (data.led !== undefined) this.state.led = data.led;
    if (data.tempEnabled !== undefined) this.state.tempEnabled = data.tempEnabled;
    if (data.status !== undefined) this.state.status = data.status;
    if (data.deviceId !== undefined) this.state.deviceId = data.deviceId;

    this.state.lastSeen = new Date().toISOString();
    this.notify();
  }

  // --- ACTUATOR CONTROL COMMANDS ---
  sendControl(controlPayload) {
    if (controlPayload.led !== undefined) this.state.led = controlPayload.led;
    if (controlPayload.tempEnabled !== undefined) this.state.tempEnabled = controlPayload.tempEnabled;
    this.notify();

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const msg = {
        type: 'control',
        deviceId: this.config.deviceId,
        ...controlPayload
      };
      this.socket.send(JSON.stringify(msg));
    }
  }

  async fetchActiveBatchFromBackend() {
    try {
      const baseUrl = this.config.relayUrl.trim().replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/api/batches/active?deviceId=${encodeURIComponent(this.config.deviceId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.activeBatch !== undefined) {
          this.state.activeBatch = json.activeBatch;
          this.notify();
        }
      }
    } catch (e) {
      console.warn('[ESP Connection Relay] Failed to fetch active batch from backend:', e);
    }
  }
}

export const espService = new ESPConnectionService();

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import axios from "axios";

// Import custom components
import { Navbar } from "./components/Navbar";
import { DeviceCard } from "./components/DeviceCard";
import { LedCard } from "./components/LedCard";
import { TemperatureCard } from "./components/TemperatureCard";
import { TemperatureStats } from "./components/TemperatureStats";
import { DetailedChart } from "./components/DetailedChart";
import { HistoricalTable } from "./components/HistoricalTable";
import { StatsCard } from "./components/StatsCard";
import { ActivityLogs } from "./components/ActivityLogs";
import { SettingsModal } from "./components/SettingsModal";
import { Toast } from "./components/Toast";
import { CameraCard } from "./components/CameraCard";
import { PhCard } from "./components/PhCard";


function App() {
  // --- States with Caching ---
  const [backendUrl, setBackendUrl] = useState(() => {
    const saved = localStorage.getItem("backendUrl");
    const isProduction = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
    if (saved) {
      if (isProduction && (saved.includes("localhost") || saved.includes("127.0.0.1"))) {
        localStorage.removeItem("backendUrl");
      } else {
        return saved;
      }
    }
    return "https://esp32-1-5ssj.onrender.com";
  });

  const [deviceData, setDeviceData] = useState(() => {
    const cached = localStorage.getItem("cached_deviceData");
    return cached ? JSON.parse(cached) : null;
  });

  const [logs, setLogs] = useState(() => {
    const cached = localStorage.getItem("cached_logs");
    return cached ? JSON.parse(cached).map(log => ({ ...log, timestamp: new Date(log.timestamp) })) : [];
  });

  const [totalHeartbeats, setTotalHeartbeats] = useState(() => {
    return Number(localStorage.getItem("cached_totalHeartbeats")) || 0;
  });

  const [commandsSent, setCommandsSent] = useState(() => {
    return Number(localStorage.getItem("cached_commandsSent")) || 0;
  });

  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [lastSeenSecondsAgo, setLastSeenSecondsAgo] = useState(null);
  
  const [ledState, setLedState] = useState(false);
  const [isLedLoading, setIsLedLoading] = useState(false);
  const [tempEnabled, setTempEnabled] = useState(false);
  const [temperature, setTemperature] = useState(null);
  const [pH, setPh] = useState(null);
  const [voltage, setVoltage] = useState(null);
  const [raw, setRaw] = useState(null);
  const [phConnected, setPhConnected] = useState(true);
  const [tempHistory, setTempHistory] = useState(() => {
    const cached = localStorage.getItem("cached_tempHistory");
    return cached ? JSON.parse(cached) : [];
  });
  const [isTempLoading, setIsTempLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isApiLoading, setIsApiLoading] = useState(false);

  // Operational stats
  const [activeSessionSeconds, setActiveSessionSeconds] = useState(0);
  const [latency, setLatency] = useState(0);

  // WebSocket Connection States
  const [wsStatus, setWsStatus] = useState("disconnected"); // "connected", "connecting", "disconnected"
  const wsRef = useRef(null);
  const chartCacheRef = useRef({}); // Caches: { "1h": { data, timestamp }, ... }

  // Tab State
  const [activeTab, setActiveTab] = useState("operations"); // "operations", "analytics"
  const [chartRange, setChartRange] = useState("live"); // "live", "1h", "3h", "6h", "12h"
  const [historicalData, setHistoricalData] = useState([]);
  const [isChartLoading, setIsChartLoading] = useState(false);

  // Modal / Toasts
  const [toasts, setToasts] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Track previous online status
  const prevDeviceOnlineRef = useRef(false);

  // --- Caching Sync Effects ---
  useEffect(() => {
    if (deviceData) {
      localStorage.setItem("cached_deviceData", JSON.stringify(deviceData));
    }
  }, [deviceData]);

  useEffect(() => {
    localStorage.setItem("cached_logs", JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem("cached_totalHeartbeats", totalHeartbeats.toString());
  }, [totalHeartbeats]);

  useEffect(() => {
    localStorage.setItem("cached_commandsSent", commandsSent.toString());
  }, [commandsSent]);

  useEffect(() => {
    if (tempHistory && tempHistory.length > 0) {
      localStorage.setItem("cached_tempHistory", JSON.stringify(tempHistory));
    }
  }, [tempHistory]);

  // Fetch temperature history on load/backendUrl change
  useEffect(() => {
    const fetchTempHistory = async () => {
      try {
        const res = await axios.get(`${backendUrl}/temp/history?limit=20`);
        setTempHistory(res.data || []);
      } catch (err) {
        console.error("Failed to fetch temperature history:", err);
      }
    };
    fetchTempHistory();
  }, [backendUrl]);

  // --- Helper Functions (Memoized) ---
  const addToast = useCallback((type, message) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addLog = useCallback((message, type = "info") => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    setLogs((prev) => {
      const newLogs = [...prev, { id, timestamp: new Date(), message, type }];
      return newLogs.slice(-25); // Limit logs to latest 25 items
    });
  }, []);

  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  // --- API Integrations ---

  // 1. Fetch latest device status (HTTP Fallback)
  const fetchStatus = useCallback(async (isPolled = true) => {
    if (!isPolled) setIsApiLoading(true);
    
    const startTime = Date.now();
    try {
      const res = await axios.get(`${backendUrl}/status`, { timeout: 4000 });
      const currentLatency = Date.now() - startTime;
      
      setLatency(currentLatency);
      setIsBackendOnline(true);

      const data = res.data;
      
      // Calculate last seen
      if (data) {
        const onlineStatus = data.status && data.status.toLowerCase() === "online";
        const deviceActive = onlineStatus;
        
        if (data.lastSeen) {
          const lastSeenTime = new Date(data.lastSeen);
          const diffSecs = Math.floor((Date.now() - lastSeenTime) / 1000);
          setLastSeenSecondsAgo(diffSecs >= 0 ? diffSecs : 0);
        } else {
          setLastSeenSecondsAgo(null);
        }
        
        setIsDeviceOnline(deviceActive);
        
        // ONLY set real data directly fetched from server
        setDeviceData(data);
        setLedState(!!data.led);
        setTempEnabled(!!data.tempEnabled);
        setTemperature(data.temperature);
        if (data.pH !== undefined) setPh(data.pH);
        if (data.voltage !== undefined) setVoltage(data.voltage);
        if (data.raw !== undefined) setRaw(data.raw);
        if (data.phConnected !== undefined) setPhConnected(data.phConnected);

        if (deviceActive) {
          setTotalHeartbeats((prev) => prev + 1);
          addLog("Heartbeat Received from ESP32 (HTTP)", "heartbeat");
        }
      } else {
        setIsDeviceOnline(false);
        setDeviceData(null);
      }
    } catch (err) {
      console.error("API error:", err);
      setIsBackendOnline(false);
      setIsDeviceOnline(false);
      setLatency(0);
      
      // Set logs for disconnected server
      if (isBackendOnline) {
        addToast("error", "Lost connection to backend server");
        addLog("Backend server connection lost", "disconnect");
      }
    } finally {
      if (!isPolled) setIsApiLoading(false);
      setIsInitialLoading(false);
    }
  }, [backendUrl, isBackendOnline, addLog, addToast]);

  // 2. Control LED (ON / OFF)
  const handleToggleLed = useCallback(async (turnOn) => {
    setIsLedLoading(true);
    addLog(`Sending command: Turn LED ${turnOn ? "ON" : "OFF"}`, "info");
    
    // Check if WebSocket is connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: "control",
          deviceId: deviceData?.deviceId || "esp32-1",
          led: turnOn
        }));
        // Optimistic UI updates
        setLedState(turnOn);
        setCommandsSent((prev) => prev + 1);
        addToast("success", `Sent LED command: ${turnOn ? "ON" : "OFF"} (WS)`);
        addLog(`LED turned ${turnOn ? "ON" : "OFF"} via WebSocket`, "command");
      } catch (err) {
        console.error("WS send error:", err);
        addToast("error", "Failed to send command over WebSocket");
      } finally {
        setIsLedLoading(false);
      }
    } else {
      // Fallback to HTTP POST
      try {
        const endpoint = turnOn ? "/led/on" : "/led/off";
        const res = await axios.post(`${backendUrl}${endpoint}`, {}, { timeout: 4000 });
        
        if (res.data && res.data.success) {
          setLedState(turnOn);
          setCommandsSent((prev) => prev + 1);
          addToast("success", `LED successfully turned ${turnOn ? "ON" : "OFF"} (HTTP)`);
          addLog(`LED turned ${turnOn ? "ON" : "OFF"} via HTTP`, "command");
        } else {
          throw new Error("Command failed");
        }
      } catch (err) {
        console.error(err);
        addToast("error", `Failed to turn LED ${turnOn ? "ON" : "OFF"}`);
        addLog(`Failed command: Turn LED ${turnOn ? "ON" : "OFF"}`, "disconnect");
      } finally {
        setIsLedLoading(false);
      }
    }
  }, [backendUrl, deviceData, addLog, addToast]);

  // 3. Control Temperature Sensor (ON / OFF)
  const handleToggleTemp = useCallback(async (turnOn) => {
    setIsTempLoading(true);
    addLog(`Sending command: Turn Temperature Sensor ${turnOn ? "ON" : "OFF"}`, "info");
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: "control",
          deviceId: deviceData?.deviceId || "esp32-1",
          tempEnabled: turnOn
        }));
        setTempEnabled(turnOn);
        setCommandsSent((prev) => prev + 1);
        addToast("success", `Sent temp sensor command: ${turnOn ? "ON" : "OFF"} (WS)`);
        addLog(`Temp sensor turned ${turnOn ? "ON" : "OFF"} via WebSocket`, "command");
      } catch (err) {
        console.error("WS send error:", err);
        addToast("error", "Failed to send command over WebSocket");
      } finally {
        setIsTempLoading(false);
      }
    } else {
      // Fallback to HTTP POST
      try {
        const endpoint = turnOn ? "/temp/on" : "/temp/off";
        const res = await axios.post(`${backendUrl}${endpoint}`, {}, { timeout: 4000 });
        
        if (res.data && res.data.success) {
          setTempEnabled(turnOn);
          setCommandsSent((prev) => prev + 1);
          addToast("success", `Temp sensor successfully turned ${turnOn ? "ON" : "OFF"} (HTTP)`);
          addLog(`Temp sensor turned ${turnOn ? "ON" : "OFF"} via HTTP`, "command");
        } else {
          throw new Error("Command failed");
        }
      } catch (err) {
        console.error(err);
        addToast("error", `Failed to turn temp sensor ${turnOn ? "ON" : "OFF"}`);
        addLog(`Failed command: Turn temp sensor ${turnOn ? "ON" : "OFF"}`, "disconnect");
      } finally {
        setIsTempLoading(false);
      }
    }
  }, [backendUrl, deviceData, addLog, addToast]);

  // 4. Handle time-range change for temperature chart
  const handleRangeChange = useCallback(async (range) => {
    setChartRange(range);
    if (range === "live") {
      return; // Fallback to websocket history
    }

    const cached = chartCacheRef.current[range];
    const cacheExpiry = 15000; // 15 seconds cache lifetime

    if (cached && (Date.now() - cached.timestamp < cacheExpiry)) {
      setHistoricalData(cached.data);
      return;
    }

    setIsChartLoading(true);
    try {
      let queryParam = "";
      if (range === "1h") queryParam = "hours=1";
      else if (range === "3h") queryParam = "hours=3";
      else if (range === "6h") queryParam = "hours=6";
      else if (range === "12h") queryParam = "hours=12";

      const res = await axios.get(`${backendUrl}/temp/history?${queryParam}`);
      const data = res.data || [];

      // Cache data
      chartCacheRef.current[range] = {
        data: data,
        timestamp: Date.now()
      };

      setHistoricalData(data);
      addToast("info", `Loaded temperature logs for the last ${range}`);
    } catch (err) {
      console.error("Failed to load historical chart range:", err);
      addToast("error", `Failed to load logs for timeframe ${range}`);
    } finally {
      setIsChartLoading(false);
    }
  }, [backendUrl, addToast]);

  // --- WebSocket Connection Lifecycle ---
  useEffect(() => {
    let socket;
    let reconnectTimeout;
    let pingInterval;
    
    const connect = () => {
      setWsStatus("connecting");
      // Calculate ws/wss URL from HTTP backend URL
      const wsUrl = backendUrl.replace(/^http/, "ws") + "/?clientType=dashboard";
      
      console.log(`Connecting WebSocket to: ${wsUrl}`);
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;
      
      socket.onopen = () => {
        setWsStatus("connected");
        setIsBackendOnline(true);
        setIsInitialLoading(false);
        addToast("success", "Connected to WebSocket Gateway");
        addLog("WebSocket link established", "info");
        
        // Measure real-time latency via ping-pong every 5s
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
          }
        }, 5000);
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === "deviceUpdate") {
            const data = message.data;
            setIsInitialLoading(false);
            if (data) {
              const onlineStatus = data.status && data.status.toLowerCase() === "online";
              const deviceActive = onlineStatus;
              
              if (data.lastSeen) {
                const lastSeenTime = new Date(data.lastSeen);
                const diffSecs = Math.floor((Date.now() - lastSeenTime) / 1000);
                setLastSeenSecondsAgo(diffSecs >= 0 ? diffSecs : 0);
              } else {
                setLastSeenSecondsAgo(null);
              }
              
              setIsDeviceOnline(deviceActive);
              setDeviceData(data);
              setLedState(!!data.led);
              setTempEnabled(!!data.tempEnabled);
              setTemperature(data.temperature);
              if (data.pH !== undefined) setPh(data.pH);
              if (data.voltage !== undefined) setVoltage(data.voltage);
              if (data.raw !== undefined) setRaw(data.raw);
              if (data.phConnected !== undefined) setPhConnected(data.phConnected);
              
              if ((data.temperature !== undefined || data.pH !== undefined) && data.tempEnabled) {
                const newReading = { 
                  temperature: data.temperature, 
                  pH: data.pH, 
                  voltage: data.voltage, 
                  raw: data.raw, 
                  timestamp: new Date() 
                };
                
                setTempHistory((prev) => {
                  const updated = [...prev, newReading];
                  return updated.slice(-20);
                });

                setHistoricalData((prev) => {
                  if (prev && prev.length > 0) {
                    const lastItem = prev[prev.length - 1];
                    const lastTime = new Date(lastItem.timestamp || lastItem.createdAt).getTime();
                    const currTime = newReading.timestamp.getTime();
                    if (currTime - lastTime >= 10000) {
                      return [...prev, newReading];
                    }
                  }
                  return prev;
                });
              }
              
              if (deviceActive) {
                setTotalHeartbeats((prev) => prev + 1);
                addLog("Real-time state update synced", "heartbeat");
              }
            } else {
              setIsDeviceOnline(false);
              setDeviceData(null);
            }
          } else if (message.type === "pong") {
            const elapsed = Date.now() - message.timestamp;
            setLatency(elapsed);
          }
        } catch (err) {
          console.error("Error parsing WS message:", err);
        }
      };
      
      socket.onclose = () => {
        setWsStatus("disconnected");
        clearInterval(pingInterval);
        console.log("WebSocket disconnected. Reconnecting in 5s...");
        reconnectTimeout = setTimeout(() => {
          connect();
        }, 5000);
      };
      
      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
        socket.close();
      };
    };
    
    connect();
    
    return () => {
      if (socket) {
        socket.onclose = null; // Prevent reconnect on cleanup
        socket.close();
      }
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
    };
  }, [backendUrl, addLog, addToast]);

  // --- Fallback Polling (only active when WS is disconnected) ---
  useEffect(() => {
    if (wsStatus === "connected") return;

    setIsInitialLoading(true);
    fetchStatus(false);

    const pollTimer = setInterval(() => {
      fetchStatus(true);
    }, 3000);

    return () => clearInterval(pollTimer);
  }, [fetchStatus, wsStatus]);

  // Session time counter and dynamic device uptime counter
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSessionSeconds((prev) => prev + 1);
      if (isDeviceOnline) {
        setUptimeSeconds((prev) => prev + 1);
      } else {
        setUptimeSeconds(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isDeviceOnline]);

  // Monitor device status transitions (connect/disconnect logs)
  useEffect(() => {
    if (isDeviceOnline !== prevDeviceOnlineRef.current) {
      if (isDeviceOnline) {
        addToast("success", "ESP32 Controller is Online!");
        addLog("ESP32 Device Connected to system", "connect");
      } else {
        addToast("warning", "ESP32 Device is Offline.");
        addLog("ESP32 Device Disconnected", "disconnect");
      }
      prevDeviceOnlineRef.current = isDeviceOnline;
    }
  }, [isDeviceOnline, addLog, addToast]);

  const handleSaveSettings = useCallback((newUrl) => {
    setBackendUrl(newUrl);
    localStorage.setItem("backendUrl", newUrl);
    addToast("info", `API Backend URL updated to: ${newUrl}`);
    setIsInitialLoading(true);
  }, [addToast]);

  // --- Render Skeleton Loader for Vanilla CSS ---
  const renderSkeletons = () => (
    <div className="dashboard-grid-main">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card" style={{ height: "320px", background: "#FFFFFF", animation: "pulse 1.5s infinite" }}>
          <div style={{ width: "35%", height: "12px", background: "#F1F5F9", borderRadius: "6px" }} />
          <div style={{ width: "60%", height: "20px", background: "#F1F5F9", borderRadius: "6px", marginTop: "8px" }} />
          <div style={{ display: "flex", justifyContent: "center", margin: "40px 0" }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#F8FAFC" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ height: "36px", background: "#F8FAFC", borderRadius: "10px" }} />
            <div style={{ height: "36px", background: "#F8FAFC", borderRadius: "10px" }} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="dashboard-wrapper">
      {/* Toast System */}
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Smooth circular loader overlay */}
      {(isInitialLoading || isLedLoading) && (
        <div className="loader-overlay">
          <div className="spinner"></div>
          <span className="loader-text">
            {isInitialLoading ? "Connecting to IoT Node..." : "Syncing LED State..."}
          </span>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        backendUrl={backendUrl}
        onSave={handleSaveSettings}
        addToast={addToast}
      />

      {/* Top Header Navbar */}
      <Navbar 
        isBackendOnline={isBackendOnline} 
        wsStatus={wsStatus} 
        onOpenSettings={handleOpenSettings} 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {isInitialLoading && !deviceData ? (
        renderSkeletons()
      ) : activeTab === "operations" ? (
        <div className="dashboard-grid-main">
          {/* Card 1: Device Telemetry Status */}
          <DeviceCard
            deviceData={deviceData}
            isOnline={isDeviceOnline}
            lastSeenSecondsAgo={lastSeenSecondsAgo}
            latency={latency}
            uptimeSeconds={uptimeSeconds}
            isLoading={isApiLoading}
          />

          {/* Card 2: LED Control Toggle */}
          <LedCard
            ledState={ledState}
            isOnline={isDeviceOnline}
            onToggle={handleToggleLed}
            isLoading={isLedLoading}
          />

          {/* Card 3: Water pH Sensor Card */}
          <PhCard
            pH={pH}
            voltage={voltage}
            raw={raw}
            phConnected={phConnected}
            isOnline={isDeviceOnline}
            history={tempHistory}
          />

          {/* Card 4: Dashboard Analytics Stats */}
          <StatsCard
            totalHeartbeats={totalHeartbeats}
            commandsSent={commandsSent}
            activeSessionSeconds={activeSessionSeconds}
            latency={latency}
          />

          {/* Card 4: Event Activity Logs */}
          <div className="span-three-columns">
            <ActivityLogs logs={logs} onClear={handleClearLogs} />
          </div>
        </div>
      ) : activeTab === "camera" ? (
        <div className="dashboard-grid-main">
          <CameraCard addToast={addToast} isDeviceOnline={isDeviceOnline} />
        </div>
      ) : (
        <div className="dashboard-grid-main">
          {/* Card 1: Large Historical Timeline Chart */}
          <div className="span-two-columns">
            <DetailedChart 
              history={chartRange === "live" ? tempHistory : historicalData} 
              activeRange={chartRange}
              onRangeChange={handleRangeChange}
              isLoading={isChartLoading}
              tempEnabled={tempEnabled}
              isOnline={isDeviceOnline}
            />
          </div>

          {/* Card 2: Temperature Sensor & Controls */}
          <TemperatureCard
            temperature={temperature}
            tempEnabled={tempEnabled}
            isOnline={isDeviceOnline}
            onToggle={handleToggleTemp}
            isLoading={isTempLoading}
            history={tempHistory}
          />

          {/* Card 3: Water pH Sensor Card */}
          <PhCard
            pH={pH}
            voltage={voltage}
            raw={raw}
            phConnected={phConnected}
            isOnline={isDeviceOnline}
            history={chartRange === "live" ? tempHistory : historicalData}
          />

          {/* Card 4: Historical table of saved database entries */}
          <div className="span-two-columns">
            <HistoricalTable history={chartRange === "live" ? tempHistory : historicalData} />
          </div>

          {/* Card 5: Temperature statistics grid */}
          <TemperatureStats history={chartRange === "live" ? tempHistory : historicalData} />
        </div>
      )}


    </div>
  );
}

export default App;

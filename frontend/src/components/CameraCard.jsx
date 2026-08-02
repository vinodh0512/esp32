import React, { useState, useEffect, useRef } from "react";
import { Camera, RefreshCw, Maximize2, Minimize2, Download, Video, Zap, Globe, AlertTriangle, CheckCircle, Wifi } from "lucide-react";

export const CameraCard = ({ addToast, isDeviceOnline }) => {
  const [cameraUrl, setCameraUrl] = useState(() => {
    return localStorage.getItem("cameraUrl") || "https://esp32-1-5ssj.onrender.com/api/camera/stream";
  });
  const [inputUrl, setInputUrl] = useState(cameraUrl);
  const [isStreaming, setIsStreaming] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const imgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("cameraUrl", cameraUrl);
    setInputUrl(cameraUrl);
  }, [cameraUrl]);

  // Auto-poll new camera frame every 1 second
  useEffect(() => {
    if (!isStreaming || streamError) return;
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming, streamError]);

  const handleSaveUrl = (e) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    setCameraUrl(inputUrl.trim());
    setStreamError(false);
    setIsStreaming(true);
    setLastUpdated(new Date());
    if (addToast) addToast("info", `Camera stream URL set to: ${inputUrl.trim()}`);
  };

  const handleRefresh = () => {
    setStreamError(false);
    setIsStreaming(false);
    setTimeout(() => {
      setIsStreaming(true);
      setLastUpdated(new Date());
      if (addToast) addToast("success", "Camera feed refreshed!");
    }, 150);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch((err) => {
        console.error("Error entering fullscreen:", err);
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch((err) => {
        console.error("Error exiting fullscreen:", err);
      });
    }
  };

  const handleToggleFlash = async () => {
    try {
      const nextFlash = !flashOn;
      await fetch("https://esp32-1-5ssj.onrender.com/api/camera/flash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flash: nextFlash })
      });
      setFlashOn(nextFlash);
      if (addToast) addToast("success", `Camera Flashlight turned ${nextFlash ? "ON" : "OFF"}!`);
    } catch (err) {
      console.error("Failed to toggle flash light:", err);
      if (addToast) addToast("warning", "Failed to communicate with Render server for flash toggle.");
    }
  };

  const handleCaptureSnapshot = () => {
    if (!imgRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = imgRef.current.naturalWidth || 640;
      canvas.height = imgRef.current.naturalHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `esp32_snapshot_${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (addToast) addToast("success", "Snapshot saved to downloads!");
    } catch (err) {
      console.error("Failed to capture snapshot:", err);
      if (addToast) addToast("warning", "Unable to capture snapshot directly (CORS limitation). Open stream URL in a new tab.");
    }
  };

  return (
    <div className="span-three-columns card camera-page-card" style={{ padding: "24px" }} ref={containerRef}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="icon-badge" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10B981", padding: "10px", borderRadius: "10px" }}>
            <Video size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "800", margin: 0, color: "var(--text-primary)" }}>
              ESP32-CAM Live Surveillance Feed
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
              Real-time MJPEG Video Streaming & Device Controls
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div className={`badge ${!streamError && isStreaming ? "badge-online" : "badge-offline"}`}>
            <span className={`dot-indicator ${!streamError && isStreaming ? "dot-online" : "dot-offline"}`} />
            {!streamError && isStreaming ? "STREAMING LIVE" : "FEED DISCONNECTED"}
          </div>

          <button 
            onClick={handleToggleFlash} 
            className="btn-secondary" 
            title="Toggle Onboard Flash LED" 
            style={{ 
              padding: "8px 12px", 
              display: "flex", 
              alignItems: "center", 
              gap: "6px",
              background: flashOn ? "rgba(250, 204, 21, 0.18)" : undefined,
              color: flashOn ? "#FACC15" : undefined,
              borderColor: flashOn ? "#FACC15" : undefined
            }}
          >
            <Zap size={14} fill={flashOn ? "#FACC15" : "none"} />
            <span>{flashOn ? "Flash ON" : "Flash OFF"}</span>
          </button>

          <button onClick={handleRefresh} className="btn-secondary" title="Refresh Stream" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          <button onClick={handleCaptureSnapshot} className="btn-secondary" title="Capture Snapshot" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Download size={14} />
            <span>Snapshot</span>
          </button>

          <button onClick={toggleFullscreen} className="btn-secondary" title="Toggle Fullscreen" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </button>
        </div>
      </div>

      {/* Main Video Stream Container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: "420px",
          maxHeight: isFullscreen ? "100vh" : "600px",
          background: "#0d1117",
          borderRadius: "14px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--border-color)",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)"
        }}
      >
        {isStreaming && !streamError ? (
          <img
            ref={imgRef}
            src={`${cameraUrl}?t=${lastUpdated.getTime()}`}
            alt="ESP32 Live Camera Stream"
            onError={() => setStreamError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              maxHeight: isFullscreen ? "90vh" : "560px",
              display: "block"
            }}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ background: "rgba(239, 68, 68, 0.15)", color: "#EF4444", width: "64px", height: "64px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
              <AlertTriangle size={32} />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#F8FAFC", marginBottom: "8px" }}>
              Camera Stream Offline or Unreachable
            </h3>
            <p style={{ fontSize: "13px", color: "#94A3B8", maxWidth: "480px", margin: "0 auto 20px auto", lineHeight: "1.5" }}>
              Unable to load live MJPEG stream from <code>{cameraUrl}</code>. Make sure your ESP32-CAM is powered on, connected to the same Wi-Fi network, and the stream URL is correct.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button onClick={handleRefresh} className="btn-primary" style={{ padding: "8px 16px" }}>
                <RefreshCw size={14} style={{ marginRight: "6px" }} />
                Retry Connection
              </button>
              <a href={cameraUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: "8px 16px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                <Globe size={14} style={{ marginRight: "6px" }} />
                Open Stream Directly
              </a>
            </div>
          </div>
        )}

        {/* Video Overlay Watermark / Live Badge */}
        {!streamError && isStreaming && (
          <div style={{ position: "absolute", top: "16px", left: "16px", background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(6px)", padding: "6px 12px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", animation: "pulse 1.5s infinite" }}></span>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#FFFFFF", letterSpacing: "0.5px", textTransform: "uppercase" }}>REC • LIVE</span>
          </div>
        )}
      </div>

      {/* Camera Configuration & URL Toolbar */}
      <div style={{ marginTop: "20px", background: "var(--bg-secondary)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <form onSubmit={handleSaveUrl} style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)" }}>
            <Globe size={16} />
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
              ESP32 Camera Stream URL:
            </span>
          </div>

          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="http://192.168.1.100/stream"
            style={{
              flex: "1",
              minWidth: "260px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              background: "var(--card-bg)",
              color: "var(--text-primary)",
              fontSize: "13px",
              outline: "none"
            }}
          />

          <button type="submit" className="btn-primary" style={{ padding: "10px 18px", fontSize: "13px", fontWeight: "600" }}>
            Save & Connect
          </button>
        </form>

        {/* Tips & Quick Info */}
        <div style={{ display: "flex", gap: "24px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-color)", flexWrap: "wrap", fontSize: "12px", color: "var(--text-muted)" }}>
          <div>
            <strong>Standard Endpoint:</strong> <code>http://&lt;ESP32_IP&gt;/stream</code>
          </div>
          <div>
            <strong>Single Frame Capture:</strong> <code>http://&lt;ESP32_IP&gt;/capture</code>
          </div>
          <div>
            <strong>Status:</strong> {isDeviceOnline ? "Controller Online" : "Controller Standby"}
          </div>
        </div>
      </div>
    </div>
  );
};

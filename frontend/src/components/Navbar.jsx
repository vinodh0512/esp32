import React, { useState, useEffect } from "react";
import { Cpu, Clock, Settings, TrendingUp, Menu, X, Camera } from "lucide-react";

const GithubIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export const Navbar = React.memo(({ isBackendOnline, wsStatus, onOpenSettings, activeTab, setActiveTab }) => {
  const [time, setTime] = useState(new Date());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const renderStatusBadge = () => {
    if (wsStatus === "connected") {
      return (
        <div className="badge badge-online">
          <span className="dot-indicator dot-online" />
          WS: Connected
        </div>
      );
    }
    if (wsStatus === "connecting") {
      return (
        <div className="badge badge-warning">
          <span className="dot-indicator dot-warning" />
          WS: Connecting...
        </div>
      );
    }
    if (isBackendOnline) {
      return (
        <div className="badge badge-warning" style={{ background: "rgba(59, 130, 246, 0.08)", borderColor: "rgba(59, 130, 246, 0.15)", color: "#3B82F6" }}>
          <span className="dot-indicator" style={{ background: "#3B82F6" }} />
          HTTP: Polling
        </div>
      );
    }
    return (
      <div className="badge badge-offline">
        <span className="dot-indicator dot-offline" />
        Server: Offline
      </div>
    );
  };

  return (
    <>
      <nav className="card navbar" style={{ padding: "16px 24px" }}>
        {/* Brand logo */}
        <div className="navbar-brand">
          <div className="navbar-icon-bg">
            <Cpu size={24} />
          </div>
          <div>
            <h1 className="navbar-logo-text">
              ESP32 <span>Controller</span>
            </h1>
            <p className="navbar-logo-sub">IoT Operations Center</p>
          </div>
        </div>

        {/* Options right */}
        <div className="navbar-actions">
          {/* Mobile menu toggle */}
          <button 
            onClick={() => setIsDrawerOpen(true)} 
            className="nav-btn menu-toggle-btn"
            title="Open Menu"
            style={{ display: "none" }}
          >
            <Menu size={18} />
          </button>

          {/* Desktop actions container */}
          <div className="navbar-actions desktop-actions" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {/* Connection status badge */}
            {renderStatusBadge()}

            {/* Navigation Tabs */}
            <button 
              onClick={() => setActiveTab("operations")} 
              className={`nav-btn nav-btn-text ${activeTab === "operations" ? "active-tab-btn" : ""}`}
            >
              <Cpu size={14} />
              <span>Operations</span>
            </button>
            <button 
              onClick={() => setActiveTab("analytics")} 
              className={`nav-btn nav-btn-text ${activeTab === "analytics" ? "active-tab-btn" : ""}`}
            >
              <TrendingUp size={14} />
              <span>Analytics</span>
            </button>
            <button 
              onClick={() => setActiveTab("camera")} 
              className={`nav-btn nav-btn-text ${activeTab === "camera" ? "active-tab-btn" : ""}`}
            >
              <Camera size={14} />
              <span>Camera</span>
            </button>
            
            {/* Live Clock */}
            <div className="nav-pill">
              <Clock size={14} style={{ color: "#3B82F6" }} />
              <span>{formatTime(time)}</span>
            </div>

            {/* GitHub link */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-btn"
              title="GitHub Repository"
            >
              <GithubIcon style={{ width: "16px", height: "16px" }} />
            </a>

            {/* Settings button */}
            <button onClick={onOpenSettings} className="nav-btn nav-btn-text">
              <Settings size={14} />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Side Drawer Menu */}
      {isDrawerOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />
          <div className="drawer-panel">
            {/* Header */}
            <div className="drawer-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "16px", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>ESP32 Control</h2>
                <span style={{ fontSize: "9px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Operations Hub</span>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="nav-btn" style={{ padding: "6px" }} title="Close Drawer">
                <X size={18} />
              </button>
            </div>

            {/* Connection status badge */}
            <div style={{ display: "flex", marginBottom: "24px" }}>
              {renderStatusBadge()}
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button 
                onClick={() => { setActiveTab("operations"); setIsDrawerOpen(false); }} 
                className={`drawer-menu-item ${activeTab === "operations" ? "active" : ""}`}
              >
                <Cpu size={16} />
                <span>Operations Center</span>
              </button>
              <button 
                onClick={() => { setActiveTab("analytics"); setIsDrawerOpen(false); }} 
                className={`drawer-menu-item ${activeTab === "analytics" ? "active" : ""}`}
              >
                <TrendingUp size={16} />
                <span>Telemetry Analytics</span>
              </button>
              <button 
                onClick={() => { setActiveTab("camera"); setIsDrawerOpen(false); }} 
                className={`drawer-menu-item ${activeTab === "camera" ? "active" : ""}`}
              >
                <Camera size={16} />
                <span>Camera Stream</span>
              </button>
            </div>

            {/* Bottom Actions Row (Pushed to bottom) */}
            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
              {/* Live Clock */}
              <div className="nav-pill" style={{ justifyContent: "center", width: "100%", padding: "10px" }}>
                <Clock size={14} style={{ color: "#3B82F6" }} />
                <span style={{ fontSize: "12px", fontWeight: "700" }}>{formatTime(time)}</span>
              </div>

              {/* Settings button */}
              <button 
                onClick={() => { onOpenSettings(); setIsDrawerOpen(false); }} 
                className="drawer-menu-item"
                style={{ background: "var(--border-muted)" }}
              >
                <Settings size={16} />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
});

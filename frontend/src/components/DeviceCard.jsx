import React from "react";
import { Radio, Calendar, Zap, Timer } from "lucide-react";

export const DeviceCard = React.memo(({ deviceData, isOnline, lastSeenSecondsAgo, latency, uptimeSeconds, isLoading }) => {
  const formatLastSeen = (seconds) => {
    if (seconds === null || seconds === undefined) return "—";
    if (seconds < 5) return "Just now";
    return `${seconds}s ago`;
  };

  const formatUptime = (totalSeconds) => {
    if (!totalSeconds) return "00:00:00";
    const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
    const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const getUptimeValue = () => {
    if (!isOnline) return "—";
    if (deviceData?.uptime !== undefined && deviceData?.uptime !== null) {
      return formatUptime(Number(deviceData.uptime));
    }
    return formatUptime(uptimeSeconds);
  };

  return (
    <div className="card card-hover">
      {/* Card Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span className="card-label">Hardware Node</span>
          <h3 className="card-title">{deviceData?.deviceId || "esp32-1"}</h3>
        </div>
        
        {/* Status Badge */}
        <div className={`badge ${isOnline ? "badge-online" : "badge-offline"}`}>
          <span className={`dot-indicator ${isOnline ? "dot-online" : "dot-offline"}`} />
          {isOnline ? "ONLINE" : "OFFLINE"}
        </div>
      </div>

      {/* Main Connection Visualizer */}
      <div className="visualizer-container">
        <div className={`visualizer-ring ${isOnline ? "online" : "offline"}`}>
          <Radio size={32} className={isOnline ? "animate-pulse" : ""} />
        </div>
      </div>

      {/* Parameters Details Grid */}
      <div className="parameter-grid">
        {/* Last Seen */}
        <div className="parameter-item">
          <div className="parameter-icon" style={{ color: "#F59E0B" }}>
            <Calendar size={18} />
          </div>
          <div>
            <span className="parameter-label">Last Seen</span>
            <span className="parameter-value">{formatLastSeen(lastSeenSecondsAgo)}</span>
          </div>
        </div>

        {/* Latency */}
        <div className="parameter-item">
          <div className="parameter-icon" style={{ color: "#F59E0B" }}>
            <Zap size={18} />
          </div>
          <div>
            <span className="parameter-label">Latency</span>
            <span className="parameter-value">
              {isLoading ? "..." : (latency ? `${latency} ms` : "—")}
            </span>
          </div>
        </div>

        {/* Uptime (repositioned here) */}
        <div className="parameter-item" style={{ gridColumn: "span 2" }}>
          <div className="parameter-icon" style={{ color: "#EF4444" }}>
            <Timer size={18} />
          </div>
          <div>
            <span className="parameter-label">Device Uptime</span>
            <span className="parameter-value">{getUptimeValue()}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

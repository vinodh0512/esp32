import React from "react";
import { Thermometer, Power, PowerOff, Loader2 } from "lucide-react";

export const TemperatureCard = React.memo(({ temperature, tempEnabled, isOnline, onToggle, isLoading, history = [] }) => {
  // Helper to format temperature
  const formatTemp = (val) => {
    if (val === null || val === undefined) return "—";
    return `${Number(val).toFixed(1)} °C`;
  };

  // Sparkline calculation
  const renderSparkline = () => {
    if (!history || history.length < 2) {
      return (
        <div style={{ height: "80px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "11px", fontWeight: "700" }}>
          Awaiting readings...
        </div>
      );
    }

    const width = 320;
    const height = 80;
    const padding = 10;

    const temps = history.map(h => h.temperature);
    const minTemp = Math.min(...temps) - 0.5;
    const maxTemp = Math.max(...temps) + 0.5;
    const tempRange = maxTemp - minTemp || 1;

    const points = history.map((h, i) => {
      const x = padding + (i / (history.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((h.temperature - minTemp) / tempRange) * (height - 2 * padding);
      return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    
    // Create area path for gradient fill under the line
    const areaPath = `
      ${linePath} 
      L ${points[points.length - 1].x} ${height - padding} 
      L ${points[0].x} ${height - padding} 
      Z
    `;

    return (
      <div style={{ position: "relative", width: "100%", height: "100px", marginTop: "8px" }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="80px" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-warning)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-warning)" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {/* Area under curve */}
          <path d={areaPath} fill="url(#tempGrad)" />
          {/* Curve line */}
          <path d={linePath} fill="none" stroke="var(--color-warning)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Pulse indicator at last node */}
          {points.length > 0 && (
            <circle 
              cx={points[points.length - 1].x} 
              cy={points[points.length - 1].y} 
              r="4" 
              fill="var(--color-warning)" 
              stroke="#FFFFFF" 
              strokeWidth="1.5" 
            />
          )}
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", fontWeight: "700", color: "var(--text-muted)", marginTop: "4px" }}>
          <span>{history.length}s ago</span>
          <span>Min: {Math.min(...temps).toFixed(1)}°C</span>
          <span>Max: {Math.max(...temps).toFixed(1)}°C</span>
          <span>Live</span>
        </div>
      </div>
    );
  };

  // Dynamic style for thermometer based on temperature value
  const getTempColor = (val) => {
    if (val === null || val === undefined || !tempEnabled || !isOnline) return "var(--text-muted)";
    if (val < 20) return "#3B82F6"; // Cold blue
    if (val < 30) return "#F59E0B"; // Warm amber
    return "#EF4444"; // Hot red
  };

  const tempColor = getTempColor(temperature);

  return (
    <div className="card card-hover">
      {/* Card Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span className="card-label">Sensor Panel</span>
          <h3 className="card-title">DS18B20 Temp</h3>
        </div>
        
        {/* State Badge */}
        <div className={`badge ${
          !isOnline 
            ? "badge-offline" 
            : tempEnabled 
              ? "badge-warning" 
              : "badge-offline"
        }`} style={(!isOnline || !tempEnabled) ? { background: "#F1F5F9", borderColor: "#E2E8F0", color: "#64748B" } : {}}>
          {isOnline ? (tempEnabled ? "ACTIVE (ON)" : "INACTIVE (OFF)") : "OFFLINE"}
        </div>
      </div>

      {/* Visual Temperature Reading */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "16px 0 8px 0" }}>
        <div 
          className={`led-glow-ring ${tempEnabled && isOnline ? "active" : ""}`} 
          style={{ 
            width: "72px", 
            height: "72px", 
            flexShrink: 0,
            borderColor: tempEnabled && isOnline ? "var(--color-warning-border)" : "var(--border-color)",
            color: tempColor,
            background: tempEnabled && isOnline ? "var(--color-warning-bg)" : "var(--bg-primary)"
          }}
        >
          <Thermometer size={32} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>
            Current Reading
          </span>
          <span style={{ fontSize: "32px", fontWeight: "800", color: tempEnabled && isOnline ? "var(--text-primary)" : "var(--text-muted)", lineHeight: 1.2 }}>
            {tempEnabled && isOnline ? formatTemp(temperature) : "00.0 °C"}
          </span>
        </div>
      </div>

      {/* Sparkline Visualization */}
      {tempEnabled && isOnline && renderSparkline()}

      {/* Actions / Buttons Footer */}
      <div className="control-buttons-grid">
        {/* Turn ON Button */}
        <button
          onClick={() => onToggle(true)}
          disabled={!isOnline || tempEnabled || isLoading}
          className={`btn ${
            !isOnline 
              ? "btn-disabled"
              : tempEnabled
                ? "btn-disabled"
                : "btn-primary"
          }`}
          style={(!isOnline || tempEnabled || isLoading) ? {} : { background: "var(--color-warning)", boxShadow: "0 4px 10px rgba(245, 158, 11, 0.15)" }}
        >
          {isLoading && !tempEnabled ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Power size={16} />
          )}
          <span>ON</span>
        </button>

        {/* Turn OFF Button */}
        <button
          onClick={() => onToggle(false)}
          disabled={!isOnline || !tempEnabled || isLoading}
          className={`btn ${
            !isOnline 
              ? "btn-disabled"
              : !tempEnabled
                ? "btn-disabled"
                : "btn-secondary"
          }`}
        >
          {isLoading && tempEnabled ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <PowerOff size={16} />
          )}
          <span>OFF</span>
        </button>
      </div>
    </div>
  );
});

import React from "react";
import { Lightbulb, Power, PowerOff, Loader2 } from "lucide-react";

export const LedCard = React.memo(({ ledState, isOnline, onToggle, isLoading }) => {
  return (
    <div className="card card-hover">
      {/* Card Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span className="card-label">Control Panel</span>
          <h3 className="card-title">LED Control</h3>
        </div>
        
        {/* State Badge */}
        <div className={`badge ${
          !isOnline 
            ? "badge-offline" 
            : ledState 
              ? "badge-online" 
              : "badge-offline"
        }`} style={(!isOnline || !ledState) ? { background: "#F1F5F9", borderColor: "#E2E8F0", color: "#64748B" } : {}}>
          {isOnline ? (ledState ? "ACTIVE (ON)" : "INACTIVE (OFF)") : "OFFLINE"}
        </div>
      </div>

      {/* Animated Lightbulb Graphic */}
      <div className="visualizer-container">
        <div className={`led-glow-ring ${ledState && isOnline ? "active" : ""}`}>
          <Lightbulb size={36} />
        </div>
      </div>

      {/* Actions / Buttons Footer */}
      <div className="control-buttons-grid">
        {/* Turn ON Button */}
        <button
          onClick={() => onToggle(true)}
          disabled={!isOnline || ledState || isLoading}
          className={`btn ${
            !isOnline 
              ? "btn-disabled"
              : ledState
                ? "btn-disabled"
                : "btn-primary"
          }`}
        >
          {isLoading && !ledState ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Power size={16} />
          )}
          <span>ON</span>
        </button>

        {/* Turn OFF Button */}
        <button
          onClick={() => onToggle(false)}
          disabled={!isOnline || !ledState || isLoading}
          className={`btn ${
            !isOnline 
              ? "btn-disabled"
              : !ledState
                ? "btn-disabled"
                : "btn-secondary"
          }`}
        >
          {isLoading && ledState ? (
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

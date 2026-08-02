import React from "react";
import { Thermometer, TrendingUp, TrendingDown, Activity } from "lucide-react";

export const TemperatureStats = React.memo(({ history = [] }) => {
  const getStats = () => {
    if (!history || history.length === 0) {
      return { avg: "—", max: "—", min: "—", total: 0 };
    }
    const temps = history.map((h) => h.temperature);
    const sum = temps.reduce((a, b) => a + b, 0);
    const avg = (sum / temps.length).toFixed(1) + " °C";
    const max = Math.max(...temps).toFixed(1) + " °C";
    const min = Math.min(...temps).toFixed(1) + " °C";
    return { avg, max, min, total: temps.length };
  };

  const { avg, max, min, total } = getStats();

  return (
    <div className="card card-hover">
      {/* Card Header */}
      <div>
        <span className="card-label">Analytics summary</span>
        <h3 className="card-title">Temperature Stats</h3>
      </div>

      {/* Grid of metrics */}
      <div className="stats-grid" style={{ flexGrow: 1, gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
        {/* Average */}
        <div className="stat-item">
          <div className="stat-header">
            <Activity size={14} style={{ color: "var(--accent-blue)" }} />
            <span className="stat-label">Average</span>
          </div>
          <span className="stat-value" style={{ marginTop: "4px" }}>{avg}</span>
          <span className="stat-desc">Mean Temperature</span>
        </div>

        {/* Maximum */}
        <div className="stat-item">
          <div className="stat-header">
            <TrendingUp size={14} style={{ color: "#EF4444" }} />
            <span className="stat-label">Maximum</span>
          </div>
          <span className="stat-value" style={{ marginTop: "4px" }}>{max}</span>
          <span className="stat-desc">Peak reading</span>
        </div>

        {/* Minimum */}
        <div className="stat-item">
          <div className="stat-header">
            <TrendingDown size={14} style={{ color: "#3B82F6" }} />
            <span className="stat-label">Minimum</span>
          </div>
          <span className="stat-value" style={{ marginTop: "4px" }}>{min}</span>
          <span className="stat-desc">Lowest reading</span>
        </div>

        {/* Total logs */}
        <div className="stat-item">
          <div className="stat-header">
            <Thermometer size={14} style={{ color: "var(--color-warning)" }} />
            <span className="stat-label">Total Readings</span>
          </div>
          <span className="stat-value" style={{ marginTop: "4px" }}>{total}</span>
          <span className="stat-desc">Active sessions</span>
        </div>
      </div>
    </div>
  );
});

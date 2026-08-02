import React from "react";
import { Activity, Zap, Cpu, AlertCircle, CheckCircle2 } from "lucide-react";

export const PhCard = React.memo(({ pH, voltage, raw, phConnected = true, isOnline = true, history = [] }) => {
  // Helper to format pH value
  const formatPh = (val) => {
    if (val === null || val === undefined) return "—";
    return Number(val).toFixed(2);
  };

  // Helper to determine pH classification and color palette
  const getPhStatus = (val) => {
    if (val === null || val === undefined || !isOnline) {
      return { label: "OFFLINE", color: "var(--text-muted)", bg: "rgba(100, 116, 139, 0.08)", border: "rgba(100, 116, 139, 0.2)" };
    }
    if (val < 6.5) {
      return { label: "ACIDIC", color: "#EF4444", bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.25)" };
    }
    if (val <= 7.5) {
      return { label: "NEUTRAL", color: "#10B981", bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.25)" };
    }
    return { label: "ALKALINE", color: "#3B82F6", bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.25)" };
  };

  const phStatus = getPhStatus(pH);

  // Calculate pH position percentage for scale bar (pH 0 - 14)
  const calculatePhPercent = (val) => {
    if (val === null || val === undefined) return 50;
    const clamped = Math.max(0, Math.min(14, val));
    return (clamped / 14) * 100;
  };

  const phPercent = calculatePhPercent(pH);

  // Sparkline calculation for pH history
  const renderSparkline = () => {
    const phHistory = history.filter(h => h.pH !== undefined && h.pH !== null);
    if (!phHistory || phHistory.length < 2) {
      return (
        <div style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "11px", fontWeight: "700" }}>
          Awaiting pH logs...
        </div>
      );
    }

    const width = 320;
    const height = 60;
    const padding = 8;

    const values = phHistory.map(h => h.pH);
    const minPh = Math.max(0, Math.min(...values) - 0.2);
    const maxPh = Math.min(14, Math.max(...values) + 0.2);
    const range = maxPh - minPh || 1;

    const points = phHistory.map((h, i) => {
      const x = padding + (i / (phHistory.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((h.pH - minPh) / range) * (height - 2 * padding);
      return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = `
      ${linePath} 
      L ${points[points.length - 1].x} ${height - padding} 
      L ${points[0].x} ${height - padding} 
      Z
    `;

    return (
      <div style={{ position: "relative", width: "100%", height: "70px", marginTop: "12px" }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="60px" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="phGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={phStatus.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={phStatus.color} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#phGrad)" />
          <path d={linePath} fill="none" stroke={phStatus.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.length > 0 && (
            <circle 
              cx={points[points.length - 1].x} 
              cy={points[points.length - 1].y} 
              r="4" 
              fill={phStatus.color} 
              stroke="#FFFFFF" 
              strokeWidth="1.5" 
            />
          )}
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", fontWeight: "700", color: "var(--text-muted)", marginTop: "2px" }}>
          <span>Min: {Math.min(...values).toFixed(2)} pH</span>
          <span>Max: {Math.max(...values).toFixed(2)} pH</span>
          <span>MongoDB Logs</span>
        </div>
      </div>
    );
  };

  return (
    <div className="card card-hover">
      {/* Card Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span className="card-label">Sensor Panel</span>
          <h3 className="card-title">Water pH Sensor</h3>
        </div>
        
        {/* Status Badge */}
        <span 
          className="badge" 
          style={{ 
            padding: "4px 10px", 
            fontSize: "10px", 
            fontWeight: "800",
            background: phStatus.bg, 
            color: phStatus.color, 
            borderColor: phStatus.border 
          }}
        >
          {phStatus.label}
        </span>
      </div>

      {/* Primary pH Metric & Ring */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "16px 0 12px 0" }}>
        <div 
          className="led-glow-ring active" 
          style={{ 
            width: "72px", 
            height: "72px", 
            flexShrink: 0,
            borderColor: phStatus.border,
            color: phStatus.color,
            background: phStatus.bg
          }}
        >
          <Activity size={32} />
        </div>
        
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>
            pH Concentration
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{ fontSize: "32px", fontWeight: "800", color: isOnline ? "var(--text-primary)" : "var(--text-muted)", lineHeight: 1.1 }}>
              {isOnline ? formatPh(pH) : "—"}
            </span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-muted)" }}>
              pH
            </span>
          </div>
        </div>
      </div>

      {/* pH 0 - 14 Visual Gradient Scale Bar */}
      <div style={{ margin: "10px 0 14px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "4px" }}>
          <span>0 (Acidic)</span>
          <span>7 (Neutral)</span>
          <span>14 (Alkaline)</span>
        </div>
        <div style={{ position: "relative", width: "100%", height: "8px", borderRadius: "4px", background: "linear-gradient(to right, #EF4444 0%, #F59E0B 35%, #10B981 50%, #3B82F6 75%, #8B5CF6 100%)" }}>
          {isOnline && pH !== null && pH !== undefined && (
            <div 
              style={{ 
                position: "absolute", 
                top: "-4px", 
                left: `${phPercent}%`, 
                transform: "translateX(-50%)", 
                width: "14px", 
                height: "16px", 
                borderRadius: "3px", 
                background: "#FFFFFF", 
                border: "2px solid #0F172A", 
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)" 
              }} 
            />
          )}
        </div>
      </div>

      {/* Secondary Sensor Metrics: Voltage & ADC Raw */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Zap size={15} style={{ color: "#F59E0B" }} />
          <div>
            <div style={{ fontSize: "9px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase" }}>Voltage</div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--text-primary)" }}>
              {voltage !== undefined && voltage !== null ? `${Number(voltage).toFixed(3)} V` : "—"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Cpu size={15} style={{ color: "#3B82F6" }} />
          <div>
            <div style={{ fontSize: "9px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase" }}>12-bit ADC Raw</div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--text-primary)" }}>
              {raw !== undefined && raw !== null ? raw : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Sparkline chart */}
      {isOnline && renderSparkline()}
    </div>
  );
});

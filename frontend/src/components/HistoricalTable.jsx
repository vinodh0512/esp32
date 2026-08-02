import React from "react";
import { Database, ArrowDown } from "lucide-react";

export const HistoricalTable = React.memo(({ history = [] }) => {
  const getTempStatus = (temp) => {
    if (temp === undefined || temp === null) return { label: "N/A", color: "#64748B", bg: "rgba(100, 116, 139, 0.08)", border: "rgba(100, 116, 139, 0.15)" };
    if (temp < 20) return { label: "Cold", color: "#3B82F6", bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.15)" };
    if (temp < 25) return { label: "Normal", color: "#10B981", bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.15)" };
    if (temp < 30) return { label: "Warm", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.15)" };
    return { label: "Hot", color: "#EF4444", bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.15)" };
  };

  const getPhStatus = (ph) => {
    if (ph === undefined || ph === null) return { label: "N/A", color: "#64748B", bg: "rgba(100, 116, 139, 0.08)", border: "rgba(100, 116, 139, 0.15)" };
    if (ph < 6.5) return { label: "Acidic", color: "#EF4444", bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.15)" };
    if (ph <= 7.5) return { label: "Neutral", color: "#10B981", bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.15)" };
    return { label: "Alkaline", color: "#3B82F6", bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.15)" };
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  // Reverse chronological order for the table
  const sortedHistory = [...history].reverse();

  return (
    <div className="card card-hover" style={{ minHeight: "280px" }}>
      {/* Card Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Database size={18} style={{ color: "var(--accent-blue)" }} />
          <h3 className="card-title" style={{ margin: 0, fontSize: "18px" }}>MongoDB Historical Logs</h3>
        </div>
        <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
          pH & Temp Records
        </span>
      </div>

      {/* Table list */}
      <div style={{ overflowY: "auto", maxHeight: "220px", marginTop: "8px", paddingRight: "4px" }}>
        {history.length === 0 ? (
          <div style={{ height: "140px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: "8px" }}>
            <Database size={24} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Awaiting logs from MongoDB...
            </span>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontWeight: "800", fontSize: "10px", textTransform: "uppercase" }}>
                <th style={{ padding: "8px 10px" }}>Time</th>
                <th style={{ padding: "8px 10px" }}>Temperature</th>
                <th style={{ padding: "8px 10px" }}>pH Level</th>
                <th style={{ padding: "8px 10px" }}>Voltage</th>
                <th style={{ padding: "8px 10px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedHistory.map((item, index) => {
                const tempStatus = getTempStatus(item.temperature);
                const phStatus = getPhStatus(item.pH);
                return (
                  <tr key={index} style={{ borderBottom: "1px solid var(--border-muted)", color: "var(--text-primary)", fontWeight: "600" }}>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "11px" }}>
                      {formatTimestamp(item.timestamp || item.createdAt)}
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: "800" }}>
                      {item.temperature !== undefined && item.temperature !== null ? `${Number(item.temperature).toFixed(1)} °C` : "—"}
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: "800", color: phStatus.color }}>
                      {item.pH !== undefined && item.pH !== null ? `${Number(item.pH).toFixed(2)} pH` : "—"}
                    </td>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)" }}>
                      {item.voltage !== undefined && item.voltage !== null ? `${Number(item.voltage).toFixed(2)} V` : "—"}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <span 
                          className="badge" 
                          style={{ 
                            padding: "2px 6px", 
                            fontSize: "9px", 
                            background: tempStatus.bg, 
                            color: tempStatus.color, 
                            borderColor: tempStatus.border 
                          }}
                        >
                          {tempStatus.label}
                        </span>
                        <span 
                          className="badge" 
                          style={{ 
                            padding: "2px 6px", 
                            fontSize: "9px", 
                            background: phStatus.bg, 
                            color: phStatus.color, 
                            borderColor: phStatus.border 
                          }}
                        >
                          {phStatus.label}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});

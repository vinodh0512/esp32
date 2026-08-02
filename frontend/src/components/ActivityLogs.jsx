import React, { useRef, useEffect } from "react";
import { ListFilter, ShieldAlert, CheckCircle2, Info, Power, Radio } from "lucide-react";

export const ActivityLogs = React.memo(({ logs, onClear }) => {
  const scrollRef = useRef(null);

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogDetails = (type) => {
    switch (type) {
      case "connect":
        return {
          icon: <CheckCircle2 size={14} />,
          className: "log-connect",
        };
      case "disconnect":
        return {
          icon: <ShieldAlert size={14} />,
          className: "log-disconnect",
        };
      case "command":
        return {
          icon: <Power size={14} />,
          className: "log-command",
        };
      case "heartbeat":
        return {
          icon: <Radio size={14} className="animate-pulse" />,
          className: "log-heartbeat",
        };
      default:
        return {
          icon: <Info size={14} />,
          className: "log-info",
        };
    }
  };

  const formatTimestamp = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <div className="card card-hover logs-card">
      {/* Card Header */}
      <div className="logs-header-container">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ListFilter size={18} style={{ color: "#3B82F6" }} />
          <h3 className="card-title" style={{ margin: 0, fontSize: "18px" }}>Activity Logs</h3>
        </div>
        {logs.length > 0 && (
          <button onClick={onClear} className="logs-clear-btn">
            Clear Logs
          </button>
        )}
      </div>

      {/* Log list */}
      <div ref={scrollRef} className="logs-scrollable">
        {logs.length === 0 ? (
          <div className="logs-empty">
            <Radio size={24} style={{ opacity: 0.3 }} />
            <span className="logs-empty-text">Awaiting activities...</span>
          </div>
        ) : (
          logs.map((log) => {
            const details = getLogDetails(log.type);
            return (
              <div key={log.id} className={`log-entry ${details.className}`}>
                <span className="log-time select-none">
                  [{formatTimestamp(log.timestamp)}]
                </span>
                <span className="log-icon">{details.icon}</span>
                <span className="log-text">{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

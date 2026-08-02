import React from "react";
import { Heart, Terminal, Clock, Activity } from "lucide-react";

export const StatsCard = React.memo(({ totalHeartbeats, commandsSent, activeSessionSeconds, latency }) => {
  const formatSessionTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const statItems = [
    {
      icon: <Heart size={16} style={{ color: "#EF4444" }} className="animate-pulse" />,
      title: "Total Heartbeats",
      value: totalHeartbeats,
      desc: "Received this session",
    },
    {
      icon: <Terminal size={16} style={{ color: "#3B82F6" }} />,
      title: "Commands Sent",
      value: commandsSent,
      desc: "LED control logs",
    },
    {
      icon: <Clock size={16} style={{ color: "#6366F1" }} />,
      title: "Session Duration",
      value: formatSessionTime(activeSessionSeconds),
      desc: "Dashboard uptime",
    },
    {
      icon: <Activity size={16} style={{ color: "#F59E0B" }} />,
      title: "Response Time",
      value: latency ? `${latency} ms` : "—",
      desc: "Roundtrip duration",
    },
  ];

  return (
    <div className="card card-hover">
      <div>
        <span className="card-label">Analytics</span>
        <h3 className="card-title">Operational Statistics</h3>
      </div>

      <div className="stats-grid">
        {statItems.map((item, idx) => (
          <div key={idx} className="stat-item">
            <div className="stat-header">
              {item.icon}
              <span className="stat-label">{item.title}</span>
            </div>
            <span className="stat-value">{item.value}</span>
            <span className="stat-desc">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

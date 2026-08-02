import React, { useState } from 'react';
import { Terminal, Download, Trash2 } from 'lucide-react';

export function ActivityLogs({ logs, onClear }) {
  const [filter, setFilter] = useState('all');

  const filteredLogs = (logs || []).filter(log => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  const format12HourTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const exportCSV = () => {
    if (!logs || logs.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Timestamp,Type,Message"].join(",") + "\n"
      + logs.map(e => `"${format12HourTime(e.timestamp)}","${e.type}","${e.message.replace(/"/g, '""')}"`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `esp32_activity_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'error': return { bg: '#ff4757', color: '#ffffff' };
      case 'warn': return { bg: '#facc15', color: '#000000' };
      default: return { bg: '#38bdf8', color: '#000000' };
    }
  };

  return (
    <div className="brutal-card" style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ padding: '4px', background: '#5ad641', border: '2px solid #000', boxShadow: '1.5px 1.5px 0 #000' }}>
            <Terminal size={16} strokeWidth={3} />
          </div>
          <h3 className="brutal-title" style={{ fontSize: '0.95rem' }}>LOGS</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          
          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '2px', background: '#f4f4f0', padding: '2px', border: '2px solid #000' }}>
            {['all', 'info', 'warn', 'error'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? '#000000' : 'transparent',
                  border: filter === f ? '1.5px solid #000' : 'none',
                  color: filter === f ? '#ffffff' : '#000000',
                  padding: '2px 6px',
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <button onClick={exportCSV} className="brutal-btn" style={{ padding: '3px 6px', fontSize: '0.65rem' }} title="Export Log CSV">
            <Download size={12} strokeWidth={3} />
            <span>CSV</span>
          </button>

          <button onClick={onClear} className="brutal-btn brutal-btn-danger" style={{ padding: '3px 6px', fontSize: '0.65rem' }} title="Clear Logs">
            <Trash2 size={12} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="font-mono" style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        background: '#ffffff',
        border: '3px solid #000000',
        boxShadow: '3px 3px 0 #000000',
        padding: '10px',
        fontSize: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{ color: '#000000', fontWeight: 700, fontStyle: 'italic', textAlign: 'center', margin: 'auto' }}>
            NO LOGS RECORDED YET...
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const badge = getBadgeStyle(log.type);
            return (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '3px', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ color: '#000000', fontWeight: 800, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                  [{format12HourTime(log.timestamp)}]
                </span>
                <span style={{
                  padding: '1px 6px',
                  border: '1.5px solid #000',
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  background: badge.bg,
                  color: badge.color
                }}>
                  {log.type}
                </span>
                <span style={{ color: '#000000', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}

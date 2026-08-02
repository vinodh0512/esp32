import React, { useState, useEffect } from 'react';
import { Play, Square, Clock, Thermometer, Activity, FlaskConical, CheckCircle2 } from 'lucide-react';

export function FermentationCard({ state, onStartBatch, onStopBatch, activeBatch }) {
  const [batchNameInput, setBatchNameInput] = useState('Yeast Sugar Test');
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  const isRunning = activeBatch && activeBatch.status === 'RUNNING';

  // Timer for elapsed time
  useEffect(() => {
    let timer;
    if (isRunning && activeBatch?.startTime) {
      timer = setInterval(() => {
        const start = new Date(activeBatch.startTime).getTime();
        const now = Date.now();
        const diffMs = Math.max(0, now - start);

        const hours = Math.floor(diffMs / (1000 * 60 * 60)).toString().padStart(2, '0');
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000).toString().padStart(2, '0');

        setElapsedTime(`${hours}:${minutes}:${seconds}`);
      }, 1000);
    } else {
      setElapsedTime('00:00:00');
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, activeBatch]);

  const handleStart = (e) => {
    e.preventDefault();
    if (!batchNameInput.trim()) return;
    onStartBatch(batchNameInput.trim());
  };

  const format12HourTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  return (
    <div className="brutal-card" style={{ padding: '12px 16px', background: '#ffffff', flexShrink: 0 }}>
      {!isRunning ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '5px', background: '#facc15', border: '2.5px solid #000', boxShadow: '2px 2px 0 #000' }}>
              <FlaskConical size={18} strokeWidth={3} />
            </div>
            <div>
              <h3 className="brutal-title" style={{ fontSize: '1.05rem', margin: 0 }}>FERMENTATION BATCH TRACKER</h3>
              <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', margin: 0 }}>RECORD INITIAL CONTEXT & MONITOR LIVE DRIFT</p>
            </div>
          </div>

          <form onSubmit={handleStart} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '600px', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, whiteSpace: 'nowrap' }}>BATCH NAME:</span>
              <input 
                type="text" 
                className="brutal-input font-mono" 
                value={batchNameInput}
                onChange={(e) => setBatchNameInput(e.target.value)}
                placeholder="e.g. Yeast Sugar Test"
                style={{ padding: '6px 10px', fontSize: '0.85rem', height: '36px' }}
                required
              />
            </div>

            <button 
              type="submit" 
              className="brutal-sure-btn"
              style={{ padding: '6px 14px', height: '36px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            >
              <Play size={14} strokeWidth={3} />
              <span>[ START ]</span>
            </button>
          </form>

        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ padding: '4px 8px', background: '#5ad641', border: '2px solid #000', fontWeight: 900, fontSize: '0.75rem' }}>
              🟢 ACTIVE
            </span>

            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#475569' }}>BATCH:</span>
              <strong style={{ fontSize: '0.95rem', fontWeight: 900, marginLeft: '6px' }}>{activeBatch.name}</strong>
            </div>

            <div style={{ fontSize: '0.8rem', fontWeight: 900 }}>
              TIME: <span className="font-mono" style={{ background: '#facc15', padding: '2px 6px', border: '1.5px solid #000' }}>{elapsedTime}</span>
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>
              START: <span className="font-mono">{format12HourTime(activeBatch.startTime)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 900 }}>
              INIT: <span className="font-mono">{activeBatch.initialPH} pH</span> | <span className="font-mono">{activeBatch.initialTemp}°C</span>
            </span>

            <button
              onClick={onStopBatch}
              className="brutal-btn brutal-btn-danger"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              <Square size={13} strokeWidth={3} />
              <span>END BATCH</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

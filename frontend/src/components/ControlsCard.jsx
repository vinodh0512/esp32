import React from 'react';
import { Power, Lightbulb, Flame, Zap, Sliders } from 'lucide-react';

export function ControlsCard({ state, onControl }) {
  const isLedOn = state.led || false;
  const isTempEnabled = state.tempEnabled ?? true;

  const toggleLed = () => {
    onControl({ led: !isLedOn });
  };

  const toggleTemp = () => {
    onControl({ tempEnabled: !isTempEnabled });
  };

  return (
    <div className="brutal-card" style={{ padding: '12px 14px', flexShrink: 0 }}>
      {/* Title Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ padding: '4px', background: '#facc15', border: '2px solid #000', boxShadow: '1.5px 1.5px 0 #000' }}>
          <Sliders size={16} strokeWidth={3} />
        </div>
        <h3 className="brutal-title" style={{ fontSize: '0.95rem' }}>HARDWARE CONTROLS</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        
        {/* LED Toggle Control */}
        <div style={{
          padding: '10px',
          background: isLedOn ? '#facc15' : '#ffffff',
          border: '2.5px solid #000000',
          boxShadow: '2.5px 2.5px 0 #000000',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lightbulb size={16} strokeWidth={2.5} />
              <span style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>LED</span>
            </div>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 900,
              padding: '1px 5px',
              border: '1.5px solid #000',
              background: isLedOn ? '#5ad641' : '#ff4757',
              color: isLedOn ? '#000' : '#fff'
            }}>
              {isLedOn ? 'ACTIVE' : 'OFF'}
            </span>
          </div>

          <button
            onClick={toggleLed}
            className={`brutal-btn ${isLedOn ? 'brutal-btn-danger' : 'brutal-btn-primary'}`}
            style={{ width: '100%', padding: '4px 8px', fontSize: '0.7rem' }}
          >
            <Power size={13} strokeWidth={3} />
            <span>{isLedOn ? 'TURN OFF' : 'TURN ON'}</span>
          </button>
        </div>

        {/* Sensor Stream Control */}
        <div style={{
          padding: '10px',
          background: isTempEnabled ? '#38bdf8' : '#ffffff',
          border: '2.5px solid #000000',
          boxShadow: '2.5px 2.5px 0 #000000',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={16} strokeWidth={2.5} />
              <span style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>STREAM</span>
            </div>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 900,
              padding: '1px 5px',
              border: '1.5px solid #000',
              background: isTempEnabled ? '#5ad641' : '#ff4757',
              color: isTempEnabled ? '#000' : '#fff'
            }}>
              {isTempEnabled ? 'LIVE' : 'PAUSED'}
            </span>
          </div>

          <button
            onClick={toggleTemp}
            className="brutal-btn"
            style={{ width: '100%', padding: '4px 8px', fontSize: '0.7rem', background: isTempEnabled ? '#ffffff' : '#5ad641' }}
          >
            <Zap size={13} strokeWidth={3} />
            <span>{isTempEnabled ? 'PAUSE' : 'RESUME'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

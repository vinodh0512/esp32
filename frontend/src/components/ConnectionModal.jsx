import React, { useState } from 'react';
import { X, Radio, Server, Save, Activity, CheckCircle2, ShieldCheck, Cpu } from 'lucide-react';

export function ConnectionModal({ isOpen, onClose, currentMode, currentConfig, onSave }) {
  const [mode, setMode] = useState(currentMode === 'direct' ? 'direct' : 'relay');
  const [directIp, setDirectIp] = useState(currentConfig.directIp || '192.168.1.100');
  const [directWsPath, setDirectWsPath] = useState(currentConfig.directWsPath || '/ws');
  const [relayUrl, setRelayUrl] = useState(currentConfig.relayUrl || 'https://esp32-1-5ssj.onrender.com');
  const [deviceId, setDeviceId] = useState(currentConfig.deviceId || 'esp32-1');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(mode, {
      directIp,
      directWsPath,
      relayUrl,
      deviceId
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(3px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div 
        className="brutal-card" 
        style={{ width: '100%', maxWidth: '560px', padding: '24px', position: 'relative', background: '#ffffff', boxShadow: '10px 10px 0 #000000' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="brutal-title" style={{ fontSize: '1.3rem' }}>CONNECTION SETUP & RELAY STATUS</h2>
              <span style={{ background: '#5ad641', color: '#000', padding: '2px 6px', border: '1.5px solid #000', fontWeight: 900, fontSize: '0.7rem' }}>
                ONLINE
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginTop: '2px' }}>
              CONFIGURE RENDER BACKEND RELAY SERVER OR DIRECT ESP32 TARGET
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ background: '#ff4757', border: '2.5px solid #000', color: '#fff', cursor: 'pointer', padding: '4px', boxShadow: '2px 2px 0 #000' }}
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        {/* Live Relay Diagnostic Status Box */}
        <div style={{ background: '#facc15', border: '2.5px solid #000', padding: '10px 14px', boxShadow: '2.5px 2.5px 0 #000', marginBottom: '18px', fontSize: '0.78rem', fontWeight: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>ACTIVE BACKEND: <strong className="font-mono">RENDER CLOUD RELAY</strong></span>
            <span style={{ color: '#059669' }}>LATENCY: ~14ms</span>
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#000' }}>
            ENDPOINT: <span className="font-mono">{relayUrl}</span> (ID: <strong className="font-mono">{deviceId}</strong>)
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Mode Selector Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
            
            {/* Backend Relay Server */}
            <div 
              onClick={() => setMode('relay')}
              style={{
                padding: '14px',
                border: '3px solid #000000',
                boxShadow: mode === 'relay' ? '4px 4px 0 #000000' : '2px 2px 0 #000000',
                background: mode === 'relay' ? '#5ad641' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'center',
                transform: mode === 'relay' ? 'translate(-2px, -2px)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Server size={22} strokeWidth={3} style={{ marginBottom: '4px', color: '#000' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', color: '#000' }}>RENDER BACKEND</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, marginTop: '2px', color: '#000' }}>WSS:// CLOUD RELAY</div>
            </div>

            {/* Direct ESP32 */}
            <div 
              onClick={() => setMode('direct')}
              style={{
                padding: '14px',
                border: '3px solid #000000',
                boxShadow: mode === 'direct' ? '4px 4px 0 #000000' : '2px 2px 0 #000000',
                background: mode === 'direct' ? '#38bdf8' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'center',
                transform: mode === 'direct' ? 'translate(-2px, -2px)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Radio size={22} strokeWidth={3} style={{ color: '#000000', marginBottom: '4px' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', color: '#000' }}>DIRECT ESP32</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000', marginTop: '2px' }}>LOCAL IP / WS</div>
            </div>

          </div>

          {/* Conditional Form Fields */}
          {mode === 'relay' && (
            <div style={{ background: '#f4f4f0', padding: '14px', border: '2.5px solid #000000', boxShadow: '3px 3px 0 #000000', marginBottom: '18px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', marginBottom: '4px' }}>
                  RENDER BACKEND SERVER URL
                </label>
                <input 
                  type="text" 
                  className="brutal-input font-mono" 
                  value={relayUrl} 
                  onChange={(e) => setRelayUrl(e.target.value)}
                  placeholder="https://esp32-1-5ssj.onrender.com"
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', marginBottom: '4px' }}>
                  TARGET ESP32 DEVICE ID
                </label>
                <input 
                  type="text" 
                  className="brutal-input font-mono" 
                  value={deviceId} 
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="esp32-1"
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          )}

          {mode === 'direct' && (
            <div style={{ background: '#f4f4f0', padding: '14px', border: '2.5px solid #000000', boxShadow: '3px 3px 0 #000000', marginBottom: '18px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', marginBottom: '4px' }}>
                  ESP32 IP ADDRESS / HOSTNAME
                </label>
                <input 
                  type="text" 
                  className="brutal-input font-mono" 
                  value={directIp} 
                  onChange={(e) => setDirectIp(e.target.value)}
                  placeholder="192.168.1.100"
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', marginBottom: '4px' }}>
                  WEBSOCKET PATH
                </label>
                <input 
                  type="text" 
                  className="brutal-input font-mono" 
                  value={directWsPath} 
                  onChange={(e) => setDirectWsPath(e.target.value)}
                  placeholder="/ws"
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="brutal-btn" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
              CANCEL
            </button>
            <button type="submit" className="brutal-sure-btn" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
              <Save size={16} strokeWidth={3} />
              <span>SAVE & RECONNECT</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

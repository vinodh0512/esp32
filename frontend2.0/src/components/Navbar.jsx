import React from 'react';
import { Cpu, Settings, LayoutDashboard, LineChart, FlaskConical } from 'lucide-react';

export function Navbar({ state, status, activePage, setActivePage, onOpenSettings }) {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      background: '#ffffff',
      borderBottom: '4.5px solid #000000',
      padding: '8px 16px',
      marginBottom: '14px',
      boxShadow: '0 5px 0 #000000',
      flexShrink: 0
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        
        {/* 1. Left: Brand Logo & Device ID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: '#facc15',
            border: '3px solid #000000',
            boxShadow: '2.5px 2.5px 0 #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Cpu size={20} strokeWidth={3} style={{ color: '#000000' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0, whiteSpace: 'nowrap' }}>
              ESP32 HUB
            </h1>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 900,
              padding: '1px 5px',
              background: '#5ad641',
              color: '#000000',
              border: '1.5px solid #000000',
              boxShadow: '1.5px 1.5px 0 #000000'
            }}>v2.0</span>
            <span className="font-mono" style={{ fontSize: '0.7rem', fontWeight: 800, background: '#38bdf8', padding: '1px 5px', border: '1.5px solid #000', whiteSpace: 'nowrap' }}>
              {state.deviceId || 'esp32-1'}
            </span>
          </div>
        </div>

        {/* 2. Middle: Page Navigation Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: '#f4f4f0',
          padding: '3px',
          border: '2.5px solid #000',
          boxShadow: '2.5px 2.5px 0 #000',
          overflowX: 'auto',
          maxWidth: '100%'
        }}>
          <button
            onClick={() => setActivePage('dashboard')}
            style={{
              background: activePage === 'dashboard' ? '#5ad641' : '#ffffff',
              border: '2px solid #000000',
              color: '#000000',
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: 900,
              cursor: 'pointer',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}
          >
            <LayoutDashboard size={14} strokeWidth={3} />
            <span>DASHBOARD</span>
          </button>

          <button
            onClick={() => setActivePage('fermentation')}
            style={{
              background: activePage === 'fermentation' ? '#5ad641' : '#ffffff',
              border: '2px solid #000000',
              color: '#000000',
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: 900,
              cursor: 'pointer',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}
          >
            <FlaskConical size={14} strokeWidth={3} />
            <span>FERMENTATION</span>
          </button>

          <button
            onClick={() => setActivePage('graph')}
            style={{
              background: activePage === 'graph' ? '#5ad641' : '#ffffff',
              border: '2px solid #000000',
              color: '#000000',
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: 900,
              cursor: 'pointer',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}
          >
            <LineChart size={14} strokeWidth={3} />
            <span>TELEMETRY</span>
          </button>
        </div>

        {/* 3. Right: Connection Status & Settings Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          
          {/* Connection Status Badge */}
          <button
            onClick={onOpenSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              background: status === 'connected' ? '#5ad641' : status === 'connecting' ? '#facc15' : '#ff4757',
              color: '#000000',
              border: '2px solid #000000',
              boxShadow: '2px 2px 0 #000000',
              fontSize: '0.75rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
            title="Click to view connection status details"
          >
            <span>{status}</span>
          </button>

          {/* Settings Button */}
          <button 
            onClick={onOpenSettings}
            className="brutal-btn"
            style={{ padding: '4px 8px', fontSize: '0.7rem' }}
            title="Connection Settings"
          >
            <Settings size={13} strokeWidth={3} />
            <span>CONFIG</span>
          </button>
        </div>

      </div>
    </header>
  );
}

import React from 'react';
import { AlertCircle, WifiOff } from 'lucide-react';

export function AlertBanner({ status, temperature }) {
  if (status === 'disconnected' || status === 'error') {
    return (
      <div style={{
        background: '#ff4757',
        color: '#ffffff',
        border: '4px solid #000000',
        boxShadow: '6px 6px 0 #000000',
        padding: '14px 18px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontSize: '0.95rem',
        fontWeight: 900,
        textTransform: 'uppercase'
      }}>
        <WifiOff size={24} strokeWidth={3} />
        <span>CONNECTION DISCONNECTED FROM ESP32 TARGET. CLICK "CONFIGURE" TO UPDATE TARGET PARAMS.</span>
      </div>
    );
  }

  if (temperature !== undefined && temperature > 35.0) {
    return (
      <div className="glitch" style={{
        background: '#facc15',
        color: '#000000',
        border: '4px solid #000000',
        boxShadow: '6px 6px 0 #000000',
        padding: '14px 18px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontSize: '0.95rem',
        fontWeight: 900,
        textTransform: 'uppercase'
      }}>
        <AlertCircle size={24} strokeWidth={3} />
        <span>HIGH TEMPERATURE ALARM: READING HAS EXCEEDED THRESHOLD ({temperature}°C)!</span>
      </div>
    );
  }

  return null;
}

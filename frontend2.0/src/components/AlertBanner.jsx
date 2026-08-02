import React from 'react';
import { AlertCircle, WifiOff } from 'lucide-react';

export function AlertBanner({ status, deviceStatus, temperature }) {
  if (deviceStatus === 'offline') {
    return (
      <div style={{
        background: '#facc15',
        color: '#000000',
        border: '4px solid #000000',
        boxShadow: '6px 6px 0 #000000',
        padding: '14px 18px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontSize: '0.92rem',
        fontWeight: 900,
        textTransform: 'uppercase'
      }}>
        <WifiOff size={24} strokeWidth={3} />
        <span>⚠️ ESP32 IS OFFLINE — PLEASE TURN ON YOUR ESP32 DEVICE & CONNECT TO WI-FI TO VIEW LIVE SENSOR READINGS.</span>
      </div>
    );
  }

  if (status === 'disconnected' || status === 'error') {
    return (
      <div style={{
        background: '#ff4757',
        color: '#ffffff',
        border: '4px solid #000000',
        boxShadow: '6px 6px 0 #000000',
        padding: '14px 18px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontSize: '0.92rem',
        fontWeight: 900,
        textTransform: 'uppercase'
      }}>
        <WifiOff size={24} strokeWidth={3} />
        <span>CONNECTION DISCONNECTED FROM BACKEND TARGET. CLICK "CONFIG" TO UPDATE TARGET PARAMS.</span>
      </div>
    );
  }

  if (temperature !== undefined && temperature !== null && temperature > 35.0) {
    return (
      <div className="glitch" style={{
        background: '#ff4757',
        color: '#ffffff',
        border: '4px solid #000000',
        boxShadow: '6px 6px 0 #000000',
        padding: '14px 18px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontSize: '0.92rem',
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

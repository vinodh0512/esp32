import React from 'react';
import { Thermometer, Droplets, Activity, AlertTriangle, TrendingUp } from 'lucide-react';

export function SensorCard({ title, value, unit, iconType, minVal, maxVal, warningThreshold, color }) {
  const getIcon = () => {
    switch (iconType) {
      case 'temp': return <Thermometer size={18} strokeWidth={2.5} />;
      case 'humidity': return <Droplets size={18} strokeWidth={2.5} />;
      case 'ph': return <Activity size={18} strokeWidth={2.5} />;
      default: return <TrendingUp size={18} strokeWidth={2.5} />;
    }
  };

  const getHeaderColor = () => {
    switch (iconType) {
      case 'temp': return '#ff4757';
      case 'humidity': return '#38bdf8';
      case 'ph': return '#5ad641';
      default: return '#facc15';
    }
  };

  const isWarning = warningThreshold !== undefined && value > warningThreshold;
  const headerBg = getHeaderColor();

  return (
    <div className="brutal-card" style={{ padding: '12px 16px', position: 'relative' }}>
      
      {/* Top Header Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            padding: '5px',
            background: headerBg,
            border: '2.5px solid #000000',
            boxShadow: '2px 2px 0 #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000000'
          }}>
            {getIcon()}
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>
            {title}
          </span>
        </div>

        {isWarning && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: '#ff4757',
            color: '#ffffff',
            padding: '2px 6px',
            border: '1.5px solid #000000',
            fontSize: '0.65rem',
            fontWeight: 900,
            textTransform: 'uppercase'
          }}>
            <AlertTriangle size={12} strokeWidth={3} />
            <span>HIGH</span>
          </div>
        )}
      </div>

      {/* Value Display */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '6px',
        marginBottom: '8px',
        background: '#f4f4f0',
        padding: '6px 12px',
        border: '2.5px solid #000000',
        boxShadow: '2.5px 2.5px 0 #000000'
      }}>
        <span className="font-mono" style={{ fontSize: '2.2rem', fontWeight: 900, color: isWarning ? '#ff4757' : '#000000', letterSpacing: '-0.03em' }}>
          {value !== undefined && value !== null ? value : '--'}
        </span>
        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#000000' }}>{unit}</span>
      </div>

      {/* Min / Max Footer */}
      {(minVal !== undefined || maxVal !== undefined) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '6px',
          borderTop: '2px solid #000000',
          fontSize: '0.72rem',
          fontWeight: 800,
          color: '#000000'
        }}>
          <span>MIN: <strong style={{ background: '#ffffff', padding: '1px 4px', border: '1px solid #000' }}>{minVal}{unit}</strong></span>
          <span>MAX: <strong style={{ background: '#ffffff', padding: '1px 4px', border: '1px solid #000' }}>{maxVal}{unit}</strong></span>
        </div>
      )}
    </div>
  );
}

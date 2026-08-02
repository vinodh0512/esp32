import React, { useState } from 'react';
import { LineChart, BarChart2 } from 'lucide-react';

export function LiveTelemetryChart({ historyData, isDeviceOnline = true, isSensorConnected = true }) {
  const [activeMetric, setActiveMetric] = useState('temperature');
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const filteredData = (historyData || []).slice(-30);

  const getMetricColor = () => {
    switch (activeMetric) {
      case 'temperature': return '#ff4757';
      case 'pH': return '#5ad641';
      default: return '#000000';
    }
  };

  const getMetricUnit = () => {
    switch (activeMetric) {
      case 'temperature': return '°C';
      case 'pH': return 'pH';
      default: return '';
    }
  };

  const color = getMetricColor();
  const unit = getMetricUnit();

  const format12HourTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const values = filteredData.map(d => d[activeMetric]).filter(v => v !== undefined && v !== null && !isNaN(v));
  const count = values.length;
  const latestValue = count > 0 ? values[count - 1] : null;

  const svgWidth = 600;
  const svgHeight = 175;
  const paddingLeft = 55;
  const paddingBottom = 30;
  const paddingTop = 15;
  const paddingRight = 20;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const minVal = count > 0 ? Math.min(...values) : 0;
  const maxVal = count > 0 ? Math.max(...values) : 0;
  const yMin = count > 0 ? Math.floor(minVal - (maxVal === minVal ? 2 : (maxVal - minVal) * 0.2)) : 0;
  const yMax = count > 0 ? Math.ceil(maxVal + (maxVal === minVal ? 2 : (maxVal - minVal) * 0.2)) : 100;
  const yRange = (yMax - yMin) || 1;

  // Generate Y-axis ticks
  const yTicks = [0, 0.5, 1].map(pct => {
    const val = yMin + pct * yRange;
    const yPos = paddingTop + (1 - pct) * chartHeight;
    return { val: val.toFixed(1), yPos };
  });

  // Generate X-axis ticks (3 points, 12h format)
  const xTicks = [];
  if (count >= 2) {
    const step = Math.floor((count - 1) / 2) || 1;
    for (let i = 0; i < count; i += step) {
      if (xTicks.length < 3) {
        const item = filteredData[i];
        const xPos = paddingLeft + (i / (count - 1)) * chartWidth;
        const timeStr = item?.timestamp ? format12HourTime(item.timestamp) : `#${i}`;
        xTicks.push({ timeStr, xPos });
      }
    }
  }

  // Signal Points
  const mainPoints = filteredData.map((d, i) => {
    const x = paddingLeft + (i / (count > 1 ? count - 1 : 1)) * chartWidth;
    const val = d[activeMetric] ?? 0;
    const y = paddingTop + (1 - (val - yMin) / yRange) * chartHeight;
    return { x, y, val, timestamp: d.timestamp, index: i };
  });

  const mainPathD = mainPoints.length >= 2 
    ? `M ${mainPoints.map(p => `${p.x},${p.y}`).join(' L ')}` 
    : '';

  return (
    <div className="brutal-card" style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      
      {/* Header Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '4px', background: color, border: '2px solid #000', boxShadow: '1.5px 1.5px 0 #000', color: color === '#5ad641' ? '#000' : '#fff' }}>
            <BarChart2 size={16} strokeWidth={3} />
          </div>
          <h3 className="brutal-title" style={{ fontSize: '0.95rem' }}>LIVE TELEMETRY GRAPH</h3>
        </div>

        {/* Metric Selector Tabs */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['temperature', 'pH'].map(metric => (
            <button
              key={metric}
              onClick={() => { setActiveMetric(metric); setHoveredPoint(null); }}
              style={{
                background: activeMetric === metric ? '#000000' : '#ffffff',
                border: '2px solid #000000',
                color: activeMetric === metric ? '#ffffff' : '#000000',
                padding: '3px 8px',
                fontSize: '0.7rem',
                fontWeight: 900,
                cursor: 'pointer',
                textTransform: 'uppercase',
                boxShadow: activeMetric === metric ? '2px 2px 0 #facc15' : '2px 2px 0 #000000'
              }}
            >
              {metric}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart Area */}
      <div style={{ width: '100%', flex: 1, minHeight: 0, background: '#f4f4f0', border: '3px solid #000000', boxShadow: '3px 3px 0 #000000', padding: '8px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Latest Value Overlay */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '12px',
          display: 'flex',
          alignItems: 'baseline',
          gap: '4px',
          background: '#ffffff',
          padding: '2px 8px',
          border: '2px solid #000',
          boxShadow: '2px 2px 0 #000',
          zIndex: 10
        }}>
          <span className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 900, color: '#000000' }}>
            {latestValue !== null ? Number(latestValue).toFixed(2) : '--'}
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#000000' }}>{unit}</span>
        </div>

        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }}>
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={svgHeight - paddingBottom} stroke="#000000" strokeWidth="2.5" />
          <line x1={paddingLeft} y1={svgHeight - paddingBottom} x2={svgWidth - paddingRight} y2={svgHeight - paddingBottom} stroke="#000000" strokeWidth="2.5" />

          {/* Y-Axis Gridlines */}
          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line x1={paddingLeft} y1={tick.yPos} x2={svgWidth - paddingRight} y2={tick.yPos} stroke="#000000" strokeWidth="1.5" strokeDasharray="4" opacity="0.2" />
              <text x={paddingLeft - 8} y={tick.yPos + 4} fill="#000000" fontSize="11" fontWeight="900" fontFamily="JetBrains Mono" textAnchor="end">
                {tick.val}{unit}
              </text>
            </g>
          ))}

          {/* X-Axis Timestamps */}
          {xTicks.map((tick, idx) => (
            <g key={idx}>
              <line x1={tick.xPos} y1={svgHeight - paddingBottom} x2={tick.xPos} y2={svgHeight - paddingBottom + 5} stroke="#000000" strokeWidth="2" />
              <text x={tick.xPos} y={svgHeight - paddingBottom + 18} fill="#000000" fontSize="10" fontWeight="800" fontFamily="JetBrains Mono" textAnchor="middle">
                {tick.timeStr}
              </text>
            </g>
          ))}

          {/* Main Stroke Line */}
          {mainPathD && (
            <path d={mainPathD} fill="none" stroke="#000000" strokeWidth="4.5" strokeLinecap="square" strokeLinejoin="miter" />
          )}

          {/* Active Data Points */}
          {mainPoints.map((pt, idx) => (
            <g key={idx}>
              <rect
                x={pt.x - (hoveredPoint?.index === idx ? 6 : 3)}
                y={pt.y - (hoveredPoint?.index === idx ? 6 : 3)}
                width={hoveredPoint?.index === idx ? 12 : 6}
                height={hoveredPoint?.index === idx ? 12 : 6}
                fill={hoveredPoint?.index === idx ? color : (idx === mainPoints.length - 1 ? color : "#000000")}
                stroke="#000000"
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPoint(pt)}
              />
            </g>
          ))}

          {/* Hover Tooltip */}
          {hoveredPoint && (
            <g transform={`translate(${Math.min(svgWidth - 150, Math.max(paddingLeft, hoveredPoint.x - 65))}, ${Math.max(paddingTop + 5, hoveredPoint.y - 55)})`}>
              <rect width="145" height="46" fill="#ffffff" stroke="#000000" strokeWidth="2.5" filter="drop-shadow(3px 3px 0 #000)" />
              <text x="8" y="18" fill="#000000" fontSize="11" fontWeight="900" fontFamily="JetBrains Mono">
                VAL: {hoveredPoint.val !== undefined ? Number(hoveredPoint.val).toFixed(2) : '--'}{unit}
              </text>
              <text x="8" y="34" fill="#475569" fontSize="9" fontWeight="900" fontFamily="JetBrains Mono">
                TIME: {hoveredPoint.timestamp ? format12HourTime(hoveredPoint.timestamp) : `#${hoveredPoint.index}`}
              </text>
            </g>
          )}
        </svg>

        {!isDeviceOnline ? (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ff4757', padding: '16px', textAlign: 'center', zIndex: 20 }}>
            <span style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>
              ⚠️ ESP32 IS OFFLINE
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#000000' }}>
              Please turn on your ESP32 device and connect to Wi-Fi to view live telemetry.
            </span>
          </div>
        ) : !isSensorConnected ? (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#000000', padding: '16px', textAlign: 'center', zIndex: 20 }}>
            <span style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', color: '#d97706', marginBottom: '4px' }}>
              ⚠️ SENSOR NOT CONNECTED
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#000000' }}>
              Please check your physical sensor wiring (GPIO 4 DS18B20 / GPIO 32 pH).
            </span>
          </div>
        ) : count < 2 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000000', fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase' }}>
            AWAITING LIVE TELEMETRY SAMPLES...
          </div>
        ) : null}
      </div>

    </div>
  );
}

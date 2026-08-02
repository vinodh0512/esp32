import React, { useState } from 'react';
import { LineChart, Thermometer, Activity, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Download, RefreshCw, BarChart2, ShieldCheck } from 'lucide-react';

export function TelemetryGraphPage({ historyData, state }) {
  const [activeMetric, setActiveMetric] = useState('temperature'); // 'temperature' | 'pH'
  const [sampleLimit, setSampleLimit] = useState(60);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [showMovingAvg, setShowMovingAvg] = useState(true);

  const filteredData = (historyData || []).slice(-sampleLimit);

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

  const getMetricIcon = () => {
    switch (activeMetric) {
      case 'temperature': return <Thermometer size={28} strokeWidth={3} />;
      case 'pH': return <Activity size={28} strokeWidth={3} />;
      default: return <LineChart size={28} strokeWidth={3} />;
    }
  };

  const color = getMetricColor();
  const unit = getMetricUnit();

  const format12HourTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  // --- STATISTICAL CALCULATIONS ---
  const values = filteredData.map(d => d[activeMetric]).filter(v => v !== undefined && v !== null && !isNaN(v));
  const count = values.length;
  const latestValue = state[activeMetric] !== undefined ? state[activeMetric] : (count > 0 ? values[count - 1] : null);
  
  const minVal = count > 0 ? Math.min(...values) : 0;
  const maxVal = count > 0 ? Math.max(...values) : 0;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = count > 0 ? sum / count : 0;

  // Standard Deviation
  const variance = count > 1 ? values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (count - 1) : 0;
  const stdDev = Math.sqrt(variance);

  // Rate of change (per minute based on last 5 samples)
  let rateOfChange = 0;
  let trendDirection = 'stable';
  if (count >= 5) {
    const recent = values.slice(-5);
    const delta = recent[recent.length - 1] - recent[0];
    rateOfChange = (delta * 3);
    if (delta > 0.1) trendDirection = 'up';
    else if (delta < -0.1) trendDirection = 'down';
  }

  // Median & Percentiles
  const sortedValues = [...values].sort((a, b) => a - b);
  const median = count > 0 ? (count % 2 === 0 ? (sortedValues[count/2 - 1] + sortedValues[count/2]) / 2 : sortedValues[Math.floor(count/2)]) : 0;
  const p95 = count > 0 ? sortedValues[Math.floor(count * 0.95)] || sortedValues[count - 1] : 0;

  // --- SVG GRAPH AXES & BOUNDS ---
  const svgWidth = 900;
  const svgHeight = 360;
  const paddingLeft = 75;
  const paddingBottom = 50;
  const paddingTop = 30;
  const paddingRight = 30;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const yMin = count > 0 ? Math.floor(minVal - (maxVal === minVal ? 2 : (maxVal - minVal) * 0.2)) : 0;
  const yMax = count > 0 ? Math.ceil(maxVal + (maxVal === minVal ? 2 : (maxVal - minVal) * 0.2)) : 100;
  const yRange = (yMax - yMin) || 1;

  // Generate 5 Y-Axis Ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const val = yMin + pct * yRange;
    const yPos = paddingTop + (1 - pct) * chartHeight;
    return { val: val.toFixed(1), yPos };
  });

  // Generate X-Axis Ticks (5 points)
  const xTicks = [];
  if (count >= 2) {
    const step = Math.floor((count - 1) / 4) || 1;
    for (let i = 0; i < count; i += step) {
      if (xTicks.length < 5) {
        const item = filteredData[i];
        const xPos = paddingLeft + (i / (count - 1)) * chartWidth;
        const timeStr = item?.timestamp ? format12HourTime(item.timestamp) : `#${i}`;
        xTicks.push({ timeStr, xPos });
      }
    }
  }

  // Main Signal Path
  const mainPoints = filteredData.map((d, i) => {
    const x = paddingLeft + (i / (count > 1 ? count - 1 : 1)) * chartWidth;
    const val = d[activeMetric] ?? mean;
    const y = paddingTop + (1 - (val - yMin) / yRange) * chartHeight;
    return { x, y, val, timestamp: d.timestamp, index: i };
  });

  const mainPathD = mainPoints.length >= 2 
    ? `M ${mainPoints.map(p => `${p.x},${p.y}`).join(' L ')}` 
    : '';

  // Moving Average Path (5-sample window)
  const movAvgPoints = filteredData.map((d, i) => {
    const windowSlice = filteredData.slice(Math.max(0, i - 4), i + 1);
    const avg = windowSlice.reduce((acc, curr) => acc + (curr[activeMetric] ?? mean), 0) / windowSlice.length;
    const x = paddingLeft + (i / (count > 1 ? count - 1 : 1)) * chartWidth;
    const y = paddingTop + (1 - (avg - yMin) / yRange) * chartHeight;
    return `${x},${y}`;
  });

  const movAvgPathD = movAvgPoints.length >= 2 ? `M ${movAvgPoints.join(' L ')}` : '';

  const warningThreshold = activeMetric === 'temperature' ? 35 : 8.5;
  const thresholdY = paddingTop + (1 - (warningThreshold - yMin) / yRange) * chartHeight;
  const showThresholdLine = warningThreshold >= yMin && warningThreshold <= yMax;

  return (
    <div style={{ maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
      
      {/* Header & Metric Selector Bar */}
      <div className="brutal-card" style={{ padding: '28px', marginBottom: '28px', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 className="brutal-title" style={{ fontSize: '1.6rem' }}>TELEMETRY ANALYTICS SUITE</h2>
              <span style={{ background: '#5ad641', color: '#000', padding: '2px 8px', border: '2px solid #000', fontWeight: 900, fontSize: '0.75rem' }}>PRO ANALYTICS</span>
            </div>
            <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#000000', marginTop: '6px' }}>
              PRECISION TIME-SERIES SIGNAL ANALYSIS & STATISTICAL METRICS (12-HOUR FORMAT)
            </p>
          </div>

          {/* Metric Selector Buttons (HUMIDITY REMOVED) */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {[
              { id: 'temperature', label: 'TEMPERATURE (°C)', color: '#ff4757' },
              { id: 'pH', label: 'PH ANALYTICS', color: '#5ad641' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveMetric(tab.id); setHoveredPoint(null); }}
                style={{
                  background: activeMetric === tab.id ? tab.color : '#ffffff',
                  color: activeMetric === tab.id ? (tab.id === 'pH' ? '#000000' : '#ffffff') : '#000000',
                  border: '3.5px solid #000000',
                  boxShadow: activeMetric === tab.id ? '5px 5px 0 #000000' : '3px 3px 0 #000000',
                  padding: '10px 18px',
                  fontSize: '0.9rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transform: activeMetric === tab.id ? 'translate(-2px, -2px)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Real-Time Metric Hero Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}>
          
          {/* Main Reading */}
          <div style={{
            background: color,
            color: color === '#5ad641' ? '#000000' : '#ffffff',
            border: '4px solid #000000',
            boxShadow: '5px 5px 0 #000000',
            padding: '20px'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>
              CURRENT READOUT
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
              <span className="font-mono" style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.04em' }}>
                {latestValue !== null ? Number(latestValue).toFixed(2) : '--'}
              </span>
              <span style={{ fontSize: '1.4rem', fontWeight: 900 }}>{unit}</span>
            </div>
          </div>

          {/* Rate of Change Card */}
          <div style={{
            background: '#ffffff',
            border: '4px solid #000000',
            boxShadow: '5px 5px 0 #000000',
            padding: '20px'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', color: '#000' }}>
              RATE OF CHANGE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              {trendDirection === 'up' && <ArrowUpRight size={32} strokeWidth={3.5} style={{ color: '#ff4757' }} />}
              {trendDirection === 'down' && <ArrowDownRight size={32} strokeWidth={3.5} style={{ color: '#5ad641' }} />}
              {trendDirection === 'stable' && <Minus size={32} strokeWidth={3.5} style={{ color: '#000000' }} />}
              <div>
                <div className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 900 }}>
                  {rateOfChange > 0 ? `+${rateOfChange.toFixed(2)}` : rateOfChange.toFixed(2)} {unit}/m
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>
                  {trendDirection === 'up' ? 'RISING DRIFT' : trendDirection === 'down' ? 'FALLING DRIFT' : 'STABLE SIGNAL'}
                </div>
              </div>
            </div>
          </div>

          {/* Variance & Std Dev */}
          <div style={{
            background: '#ffffff',
            border: '4px solid #000000',
            boxShadow: '5px 5px 0 #000000',
            padding: '20px'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', color: '#000' }}>
              SIGNAL VARIANCE (STD DEV)
            </div>
            <div className="font-mono" style={{ fontSize: '2rem', fontWeight: 900, color: '#000000', marginTop: '4px' }}>
              ±{stdDev.toFixed(3)} <span style={{ fontSize: '0.9rem' }}>{unit}</span>
            </div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginTop: '2px' }}>
              {stdDev < 0.15 ? 'HIGH NOISE STABILITY' : 'MODERATE FLUCTUATION'}
            </div>
          </div>

          {/* Percentiles */}
          <div style={{
            background: '#ffffff',
            border: '4px solid #000000',
            boxShadow: '5px 5px 0 #000000',
            padding: '20px'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', color: '#000' }}>
              STATISTICAL RANGE
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.85rem', fontWeight: 900 }}>
              <span>MEDIAN (P50): <strong className="font-mono">{median.toFixed(2)}{unit}</strong></span>
              <span>P95 PEAK: <strong className="font-mono">{p95.toFixed(2)}{unit}</strong></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.85rem', fontWeight: 900 }}>
              <span>MIN: <strong className="font-mono">{minVal.toFixed(2)}{unit}</strong></span>
              <span>MAX: <strong className="font-mono">{maxVal.toFixed(2)}{unit}</strong></span>
            </div>
          </div>

        </div>

      </div>

      {/* Main Full Analytics Graph Card */}
      <div className="brutal-card" style={{ padding: '28px', marginBottom: '28px', background: '#ffffff' }}>
        
        {/* Controls Toolbar Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '6px', background: '#facc15', border: '3px solid #000', boxShadow: '2px 2px 0 #000' }}>
              <BarChart2 size={20} strokeWidth={3} />
            </div>
            <h3 className="brutal-title">CALIBRATED SIGNAL GRAPH (12-HOUR TIMESTAMPS)</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowMovingAvg(!showMovingAvg)}
              style={{
                background: showMovingAvg ? '#38bdf8' : '#ffffff',
                color: '#000000',
                border: '2.5px solid #000',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '2px 2px 0 #000'
              }}
            >
              {showMovingAvg ? 'SMA LINE: ON' : 'SMA LINE: OFF'}
            </button>

            <div style={{ display: 'flex', gap: '4px', background: '#f4f4f0', padding: '3px', border: '2.5px solid #000' }}>
              {[15, 30, 60, 100, 150].map(cnt => (
                <button
                  key={cnt}
                  onClick={() => { setSampleLimit(cnt); setHoveredPoint(null); }}
                  style={{
                    background: sampleLimit === cnt ? '#000000' : 'transparent',
                    color: sampleLimit === cnt ? '#ffffff' : '#000000',
                    border: 'none',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  {cnt} SAMPLES
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SVG Viewport */}
        <div style={{
          width: '100%',
          background: '#f4f4f0',
          border: '4px solid #000000',
          boxShadow: '6px 6px 0 #000000',
          padding: '16px',
          position: 'relative'
        }}>
          
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '360px', overflow: 'visible' }}>
            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={svgHeight - paddingBottom} stroke="#000000" strokeWidth="3" />
            <line x1={paddingLeft} y1={svgHeight - paddingBottom} x2={svgWidth - paddingRight} y2={svgHeight - paddingBottom} stroke="#000000" strokeWidth="3" />

            {/* Y-Axis Gridlines */}
            {yTicks.map((tick, idx) => (
              <g key={idx}>
                <line x1={paddingLeft} y1={tick.yPos} x2={svgWidth - paddingRight} y2={tick.yPos} stroke="#000000" strokeWidth="1.5" strokeDasharray="4" opacity="0.2" />
                <text x={paddingLeft - 10} y={tick.yPos + 4} fill="#000000" fontSize="12" fontWeight="900" fontFamily="JetBrains Mono" textAnchor="end">
                  {tick.val}{unit}
                </text>
              </g>
            ))}

            {/* X-Axis Timestamps (12-hour format) */}
            {xTicks.map((tick, idx) => (
              <g key={idx}>
                <line x1={tick.xPos} y1={svgHeight - paddingBottom} x2={tick.xPos} y2={svgHeight - paddingBottom + 6} stroke="#000000" strokeWidth="2.5" />
                <text x={tick.xPos} y={svgHeight - paddingBottom + 24} fill="#000000" fontSize="10" fontWeight="800" fontFamily="JetBrains Mono" textAnchor="middle">
                  {tick.timeStr}
                </text>
              </g>
            ))}

            {/* Threshold Line */}
            {showThresholdLine && (
              <g>
                <line x1={paddingLeft} y1={thresholdY} x2={svgWidth - paddingRight} y2={thresholdY} stroke="#ff4757" strokeWidth="2.5" strokeDasharray="6 4" />
                <text x={svgWidth - paddingRight - 10} y={thresholdY - 6} fill="#ff4757" fontSize="11" fontWeight="900" textAnchor="end">
                  THRESHOLD ALARM ({warningThreshold}{unit})
                </text>
              </g>
            )}

            {/* Moving Average */}
            {showMovingAvg && movAvgPathD && (
              <path d={movAvgPathD} fill="none" stroke="#38bdf8" strokeWidth="3" strokeDasharray="6 3" />
            )}

            {/* Main Signal Path */}
            {mainPathD && (
              <path d={mainPathD} fill="none" stroke="#000000" strokeWidth="5" strokeLinecap="square" strokeLinejoin="miter" />
            )}

            {/* Data Point Rects */}
            {mainPoints.map((pt, idx) => (
              <g key={idx}>
                <rect
                  x={pt.x - (hoveredPoint?.index === idx ? 7 : 4)}
                  y={pt.y - (hoveredPoint?.index === idx ? 7 : 4)}
                  width={hoveredPoint?.index === idx ? 14 : 8}
                  height={hoveredPoint?.index === idx ? 14 : 8}
                  fill={hoveredPoint?.index === idx ? color : (idx === mainPoints.length - 1 ? color : "#000000")}
                  stroke="#000000"
                  strokeWidth="2.5"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredPoint(pt)}
                />
              </g>
            ))}

            {/* Hover Tooltip (12h AM/PM) */}
            {hoveredPoint && (
              <g transform={`translate(${Math.min(svgWidth - 190, Math.max(paddingLeft, hoveredPoint.x - 75))}, ${Math.max(paddingTop + 10, hoveredPoint.y - 65)})`}>
                <rect width="165" height="52" fill="#ffffff" stroke="#000000" strokeWidth="3" filter="drop-shadow(4px 4px 0 #000)" />
                <text x="10" y="20" fill="#000000" fontSize="12" fontWeight="900" fontFamily="JetBrains Mono">
                  VAL: {hoveredPoint.val !== undefined ? Number(hoveredPoint.val).toFixed(2) : '--'}{unit}
                </text>
                <text x="10" y="38" fill="#475569" fontSize="10" fontWeight="900" fontFamily="JetBrains Mono">
                  TIME: {hoveredPoint.timestamp ? format12HourTime(hoveredPoint.timestamp) : `#${hoveredPoint.index}`}
                </text>
              </g>
            )}
          </svg>

          {count < 2 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000000', fontWeight: 900, fontSize: '1rem', textTransform: 'uppercase' }}>
              WAITING FOR TELEMETRY SAMPLES...
            </div>
          )}
        </div>

        {/* Legend Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', fontSize: '0.8rem', fontWeight: 900, flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '16px', height: '4px', background: '#000000', display: 'inline-block' }}></span>
              <span>RAW SIGNAL</span>
            </div>
            {showMovingAvg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '16px', height: '4px', background: '#38bdf8', display: 'inline-block' }}></span>
                <span>5-SAMPLE MOVING AVG</span>
              </div>
            )}
            {showThresholdLine && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '16px', height: '4px', background: '#ff4757', display: 'inline-block' }}></span>
                <span>WARNING THRESHOLD</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
            <ShieldCheck size={16} strokeWidth={3} />
            <span>PACKET INTEGRITY: 100% OK</span>
          </div>
        </div>

      </div>

    </div>
  );
}

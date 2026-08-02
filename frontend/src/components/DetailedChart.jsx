import React, { useState, useEffect, useRef, useMemo } from "react";
import { AreaChart, Calendar, Maximize2, Minimize2, Clock, Loader2, Thermometer, TrendingUp, TrendingDown, Activity } from "lucide-react";

export const DetailedChart = React.memo(({ history = [], activeRange = "live", onRangeChange, isLoading = false, tempEnabled = false, isOnline = false }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const svgRef = useRef(null);

  // Zoom and Pan States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef(0);

  // Sync references to prevent stale closures
  const zoomRef = useRef(1);
  const panRef = useRef(0);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  // High performance animation frame batching
  const requestRef = useRef(null);
  const pendingZoomRef = useRef(null);
  const pendingPanRef = useRef(null);

  const updateZoomPan = () => {
    if (pendingZoomRef.current !== null) {
      setZoom(pendingZoomRef.current);
      pendingZoomRef.current = null;
    }
    if (pendingPanRef.current !== null) {
      setPan(pendingPanRef.current);
      pendingPanRef.current = null;
    }
    requestRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // Reset zoom when activeRange changes
  useEffect(() => {
    setZoom(1);
    setPan(0);
    zoomRef.current = 1;
    panRef.current = 0;
  }, [activeRange]);

  // Native wheel event listener for passive: false prevention of page scroll
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const handleWheelNative = (e) => {
      e.preventDefault();
      
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const zoomFactor = 1.15;
      let nextZoom = currentZoom;
      
      if (e.deltaY < 0) {
        nextZoom = Math.min(15, currentZoom * zoomFactor);
      } else {
        nextZoom = Math.max(1, currentZoom / zoomFactor);
      }
      
      if (nextZoom === currentZoom) return;

      const rect = svgEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseRatio = mouseX / rect.width;
      
      const prevVisibleWidth = 600 / currentZoom;
      const nextVisibleWidth = 600 / nextZoom;
      
      const prevMouseSvgX = currentPan + mouseRatio * prevVisibleWidth;
      let nextPan = prevMouseSvgX - mouseRatio * nextVisibleWidth;
      
      const maxPan = 600 - nextVisibleWidth;
      nextPan = Math.max(0, Math.min(maxPan, nextPan));
      
      pendingZoomRef.current = nextZoom;
      pendingPanRef.current = nextPan;
      zoomRef.current = nextZoom;
      panRef.current = nextPan;

      if (!requestRef.current) {
        requestRef.current = requestAnimationFrame(updateZoomPan);
      }
    };

    svgEl.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => svgEl.removeEventListener("wheel", handleWheelNative);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  // 1. Calculate boundaries & points
  const { points, linePath, areaPath, minTemp, maxTemp, gridLines, temps, minTime, maxTime, timeRange } = useMemo(() => {
    let dataset = history;
    if (!history || history.length < 2) {
      if (activeRange !== "live") {
        let hours = 1;
        if (activeRange === "3h") hours = 3;
        else if (activeRange === "6h") hours = 6;
        else if (activeRange === "12h") hours = 12;
        
        dataset = [
          { temperature: 0.0, timestamp: new Date(Date.now() - hours * 3600 * 1000) },
          { temperature: 0.0, timestamp: new Date() }
        ];
      } else {
        return { points: [], linePath: "", areaPath: "", minTemp: 0, maxTemp: 0, gridLines: [], temps: [], minTime: 0, maxTime: 0, timeRange: 1 };
      }
    }

    const width = 600;
    const height = 180;
    const paddingLeft = 40;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 32;

    const tVals = dataset.map(h => h.temperature);
    const rawMin = Math.min(...tVals);
    const rawMax = Math.max(...tVals);
    
    // Grid alignment
    const minT = Math.floor(rawMin) - 1;
    const maxT = Math.ceil(rawMax) + 1;
    const range = maxT - minT || 1;

    // Grid lines every 1 degree or divided ranges
    const grids = [];
    const step = Math.max(1, Math.round(range / 4));
    for (let tempVal = minT; tempVal <= maxT; tempVal += step) {
      grids.push(tempVal);
    }

    // Time-based X scaling: fixed bounds for historical ranges
    let maxTVal = Date.now();
    let minTVal = Date.now() - 3600 * 1000;
    
    if (activeRange === "live") {
      const times = dataset.map(h => new Date(h.timestamp || h.createdAt).getTime());
      minTVal = times.length > 0 ? Math.min(...times) : Date.now() - 20000;
      maxTVal = times.length > 0 ? Math.max(...times) : Date.now();
    } else {
      let hours = 1;
      if (activeRange === "3h") hours = 3;
      else if (activeRange === "6h") hours = 6;
      else if (activeRange === "12h") hours = 12;
      minTVal = Date.now() - hours * 3600 * 1000;
      maxTVal = Date.now();
    }
    const tRange = maxTVal - minTVal || 1;

    const pts = dataset.map((h, i) => {
      const t = new Date(h.timestamp || h.createdAt).getTime();
      const x = paddingLeft + ((t - minTVal) / tRange) * (width - paddingLeft - paddingRight);
      const y = height - paddingBottom - ((h.temperature - minT) / range) * (height - paddingTop - paddingBottom);
      return { x, y, temp: h.temperature, timestamp: h.timestamp || h.createdAt };
    });

    const lPath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const aPath = pts.length > 0 ? `
      ${lPath} 
      L ${pts[pts.length - 1].x} ${height - paddingBottom} 
      L ${pts[0].x} ${height - paddingBottom} 
      Z
    ` : "";

    return { points: pts, linePath: lPath, areaPath: aPath, minTemp: minT, maxTemp: maxT, gridLines: grids, temps: tVals, minTime: minTVal, maxTime: maxTVal, timeRange: tRange };
  }, [history, activeRange]);

  // 2. Mouse interactivity for tooltips and panning
  const handleMouseMove = (e) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;

    // Map screen mouse x to zoomed SVG coordinate space
    const visibleWidth = 600 / currentZoom;
    const mappedX = currentPan + (x / rect.width) * visibleWidth;

    let closest = points[0];
    let minDist = Math.abs(points[0].x - mappedX);
    let closestIndex = 0;

    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - mappedX);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
        closestIndex = idx;
      }
    });

    setHoveredPoint({ ...closest, index: closestIndex });

    // Drag-to-pan logic
    if (isDraggingRef.current) {
      const deltaX = e.clientX - dragStartRef.current;
      dragStartRef.current = e.clientX;
      
      const svgDeltaX = (deltaX / rect.width) * visibleWidth;
      const nextPan = Math.max(0, Math.min(600 - visibleWidth, currentPan - svgDeltaX));
      
      pendingPanRef.current = nextPan;
      panRef.current = nextPan;

      if (!requestRef.current) {
        requestRef.current = requestAnimationFrame(updateZoomPan);
      }
    }
  };

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    isDraggingRef.current = true;
    dragStartRef.current = e.clientX;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    isDraggingRef.current = false;
  };

  // Helper stats for fullscreen
  const fullscreenStats = useMemo(() => {
    if (temps.length === 0) return { avg: "—", max: "—", min: "—" };
    const sum = temps.reduce((a, b) => a + b, 0);
    return {
      avg: (sum / temps.length).toFixed(1) + "°C",
      max: Math.max(...temps).toFixed(1) + "°C",
      min: Math.min(...temps).toFixed(1) + "°C"
    };
  }, [temps]);

  // Render range selectors
  const renderRangeSelector = () => (
    <div className="range-selector" style={{ 
      display: "flex", 
      gap: "4px", 
      background: "var(--border-muted)", 
      padding: "4px", 
      borderRadius: "14px", 
      border: "1px solid var(--border-color)",
      alignItems: "center"
    }}>
      {["live", "1h", "3h", "6h", "12h"].map((range) => {
        const isActive = activeRange === range;
        return (
          <button
            key={range}
            onClick={() => onRangeChange(range)}
            disabled={isLoading}
            style={{
              border: "none",
              background: isActive ? "var(--accent-blue)" : "transparent",
              color: isActive ? "#FFFFFF" : "var(--text-muted)",
              fontSize: "10px",
              fontWeight: "800",
              padding: "6px 12px",
              borderRadius: "10px",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              boxShadow: isActive ? "0 4px 10px rgba(59, 130, 246, 0.2)" : "none",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            {range === "live" && (
              <span className="live-dot-pulse" style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: isActive ? "#FFFFFF" : "var(--color-online)",
                display: "inline-block",
                animation: "pulse-green 1.5s infinite"
              }} />
            )}
            <span>{range === "live" ? "Real-Time" : range}</span>
          </button>
        );
      })}
    </div>
  );

  // Render the core SVG chart
  const renderSvgChart = (isLarge = false) => {
    const width = 600;
    const height = 180;
    const paddingLeft = 40;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 32;

    // Detect Telemetry offline gaps (> 15 seconds gap)
    const gapMarkers = [];
    if (points && points.length >= 1) {
      // 1. Initial gap check (from minTime start boundaries to the first point)
      const firstTime = new Date(points[0].timestamp).getTime();
      if (firstTime - minTime > 15000 && activeRange !== "live") {
        gapMarkers.push({
          x: paddingLeft,
          time: new Date(minTime),
          type: "stop",
          label: "Telemetry Stopped"
        });
        gapMarkers.push({
          x: points[0].x,
          time: new Date(firstTime),
          type: "start",
          label: "Telemetry Resumed"
        });
      }

      // 2. Check consecutive gaps
      if (points.length >= 2) {
        for (let i = 1; i < points.length; i++) {
          const prevTime = new Date(points[i - 1].timestamp).getTime();
          const currTime = new Date(points[i].timestamp).getTime();
          const diffMs = currTime - prevTime;
          if (diffMs > 15000) { // Gap greater than 15 seconds
            gapMarkers.push({
              x: points[i - 1].x,
              time: new Date(prevTime),
              type: "stop",
              label: "Telemetry Stopped"
            });
            gapMarkers.push({
              x: points[i].x,
              time: new Date(currTime),
              type: "start",
              label: "Telemetry Resumed"
            });
          }
        }
      }
    }

    const formatShortTime = (timestamp) => {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    };

    // Filter text labels to prevent collision
    const renderedTopXCoords = [];
    const renderedBottomXCoords = [];

    // Calculate hover tooltip position in screen percentages, taking zoom and pan into account
    const visibleWidth = 600 / zoom;
    const tooltipLeft = hoveredPoint ? ((hoveredPoint.x - pan) / visibleWidth) * 100 : 0;
    const tooltipTop = hoveredPoint ? (hoveredPoint.y / 180) * 100 - 45 : 0;
    
    // Check if the tooltip is within the visible zoomed window
    const isTooltipVisible = hoveredPoint && (hoveredPoint.x >= pan) && (hoveredPoint.x <= pan + visibleWidth);

    return (
      <div style={{ position: "relative", width: "100%" }}>
        <svg 
          ref={svgRef}
          viewBox={`${pan} 0 ${visibleWidth} 180`} 
          width="100%" 
          style={{ 
            overflow: "visible", 
            cursor: zoom > 1 ? (isDraggingRef.current ? "grabbing" : "grab") : "crosshair",
            width: "100%",
            height: isLarge ? (isMobile ? "220px" : "320px") : "auto",
            maxHeight: isLarge ? "none" : "240px",
            display: "block",
            userSelect: "none"
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="mainChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-warning)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--color-warning)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Gridlines (Lines only) */}
          {gridLines.map((tempValue) => {
            const y = height - paddingBottom - ((tempValue - minTemp) / (maxTemp - minTemp || 1)) * (height - paddingTop - paddingBottom);
            return (
              <line 
                key={`grid-line-${tempValue}`}
                x1={pan + paddingLeft} 
                y1={y} 
                x2={pan + visibleWidth - paddingRight} 
                y2={y} 
                stroke="#E2E8F0" 
                strokeWidth="1" 
                strokeDasharray="4 4" 
              />
            );
          })}

          {/* No Data Shaded Areas */}
          {(() => {
            const regions = [];
            if (gapMarkers.length >= 2) {
              for (let i = 0; i < gapMarkers.length; i += 2) {
                const stopMarker = gapMarkers[i];
                const startMarker = gapMarkers[i + 1];
                if (stopMarker && startMarker) {
                  regions.push({
                    x: stopMarker.x,
                    width: Math.max(2, startMarker.x - stopMarker.x)
                  });
                }
              }
            }
            return regions.map((reg, idx) => (
              <rect
                key={`no-data-${idx}`}
                x={reg.x}
                y={paddingTop}
                width={reg.width}
                height={height - paddingTop - paddingBottom}
                fill="rgba(239, 68, 68, 0.05)"
                stroke="none"
              />
            ));
          })()}

          {/* Area Fill */}
          <path d={areaPath} fill="url(#mainChartGrad)" />

          {/* Main Curve Line */}
          <path d={linePath} fill="none" stroke="var(--color-warning)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Telemetry Gap Markers (Stopped/Resumed dashed lines like YouTube) */}
          {gapMarkers.map((marker, idx) => {
            const isStop = marker.type === "stop";
            const color = isStop ? "var(--color-offline)" : "var(--color-online)";
            const icon = isStop ? "⏸" : "▶";
            
            // Prevent overlapping text labels: if start marker is close to stop marker, offset start text below badge
            const isClose = idx > 0 && (marker.x - gapMarkers[idx - 1].x < 45);
            const textY = isStop ? (paddingTop - 5) : (isClose ? (paddingTop + 18) : (paddingTop - 5));
            
            let showTextLabel = true;
            if (textY === (paddingTop - 5)) {
              const hasCollision = renderedTopXCoords.some(x => Math.abs(marker.x - x) < 35);
              if (hasCollision) showTextLabel = false;
              else renderedTopXCoords.push(marker.x);
            } else {
              const hasCollision = renderedBottomXCoords.some(x => Math.abs(marker.x - x) < 35);
              if (hasCollision) showTextLabel = false;
              else renderedBottomXCoords.push(marker.x);
            }

            return (
              <g key={`gap-${idx}`}>
                {/* Vertical Dashed Line */}
                <line 
                  x1={marker.x} 
                  y1={paddingTop} 
                  x2={marker.x} 
                  y2={height - paddingBottom} 
                  stroke={color} 
                  strokeWidth="1.5" 
                  strokeDasharray="3 3" 
                  style={{ opacity: 0.8 }}
                />
                
                {/* Circle Icon Badge */}
                <circle 
                  cx={marker.x} 
                  cy={paddingTop + 6} 
                  r="6" 
                  fill={color} 
                  style={{ opacity: 0.9 }}
                />
                
                {/* Text icon inside badge */}
                <text
                  x={marker.x}
                  y={paddingTop + 9}
                  fill="#FFFFFF"
                  fontSize="8"
                  fontWeight="900"
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {icon}
                </text>
                
                {/* Text label flag */}
                {showTextLabel && (
                  <text
                    x={marker.x}
                    y={textY}
                    fill={color}
                    fontSize="7"
                    fontWeight="800"
                    textAnchor="middle"
                    style={{ opacity: 0.9 }}
                  >
                    {isStop ? "Stopped" : "Started"}
                  </text>
                )}
                
                <title>{marker.label} at {formatShortTime(marker.time)}</title>
              </g>
            );
          })}

          {/* Highlight line for hovered point */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.x}
              y1={paddingTop}
              x2={hoveredPoint.x}
              y2={height - paddingBottom}
              stroke={isFullscreen ? "rgba(245, 158, 11, 0.4)" : "rgba(59, 130, 246, 0.3)"}
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          {/* X-Axis Horizontal Bottom Line */}
          <line 
            x1={pan + paddingLeft} 
            y1={height - paddingBottom} 
            x2={pan + visibleWidth - paddingRight} 
            y2={height - paddingBottom} 
            stroke="#CBD5E1" 
            strokeWidth="1" 
          />

          {/* Linear dynamic X-Axis Time Ticks */}
          {points.length >= 1 && (() => {
            const ticksCount = isFullscreen ? 5 : 3;
            const ticks = [];
            
            if (activeRange === "live") {
              // Live view: space ticks based on actual point indexes
              for (let i = 0; i < ticksCount; i++) {
                const idx = Math.round((i / (ticksCount - 1)) * (points.length - 1));
                const p = points[idx];
                if (p) {
                  ticks.push({
                    x: p.x,
                    label: formatShortTime(p.timestamp)
                  });
                }
              }
            } else {
              // Historical views: space ticks linearly across the visible viewport
              const plotWidth = visibleWidth - paddingLeft - paddingRight;
              for (let i = 0; i < ticksCount; i++) {
                const tickX = pan + paddingLeft + (i / (ticksCount - 1)) * plotWidth;
                const t = minTime + ((tickX - paddingLeft) / 545) * timeRange;
                ticks.push({
                  x: tickX,
                  label: formatShortTime(new Date(t))
                });
              }
            }

            return ticks.map((tick, idx) => (
              <g key={`x-tick-${idx}`}>
                <line 
                  x1={tick.x} 
                  y1={height - paddingBottom} 
                  x2={tick.x} 
                  y2={height - paddingBottom + 4} 
                  stroke="#CBD5E1" 
                  strokeWidth="1" 
                />
                <text
                  x={tick.x}
                  y={height - paddingBottom + 12}
                  fill="#64748B"
                  fontSize="8"
                  fontWeight="700"
                  textAnchor="middle"
                  style={{ fontFamily: "monospace" }}
                >
                  {tick.label}
                </text>
              </g>
            ));
          })()}

          {/* Nodes (Optimized: Render only Hovered and Last node to keep DOM lightweight & scrolling smooth) */}
          {(() => {
            const nodesToRender = [];
            
            // 1. Last node
            if (points.length > 0) {
              const lastIdx = points.length - 1;
              const lastPoint = points[lastIdx];
              const isHovered = hoveredPoint && hoveredPoint.index === lastIdx;
              nodesToRender.push(
                <circle 
                  key="last-node" 
                  cx={lastPoint.x} 
                  cy={lastPoint.y} 
                  r={isHovered ? "6" : "4"} 
                  fill="var(--color-warning)" 
                  stroke="var(--color-warning)" 
                  strokeWidth={isHovered ? "2.5" : "1.5"} 
                  style={{ transition: "r 0.1s ease" }}
                />
              );
            }
            
            // 2. Hovered node (if it's not already the last node)
            if (hoveredPoint && hoveredPoint.index !== points.length - 1) {
              nodesToRender.push(
                <circle 
                  key="hovered-node" 
                  cx={hoveredPoint.x} 
                  cy={hoveredPoint.y} 
                  r="6" 
                  fill="var(--color-warning)" 
                  stroke="var(--color-warning)" 
                  strokeWidth="2.5" 
                  style={{ transition: "r 0.1s ease" }}
                />
              );
            }
            
            return nodesToRender;
          })()}

          {/* Sticky Left Y-Axis Background Mask */}
          <rect 
            x={pan} 
            y={0} 
            width={paddingLeft - 3} 
            height={height} 
            fill="var(--bg-card)" 
            style={{ opacity: 0.95 }}
          />

          {/* Sticky Y-Axis Text Labels */}
          {gridLines.map((tempValue) => {
            const y = height - paddingBottom - ((tempValue - minTemp) / (maxTemp - minTemp || 1)) * (height - paddingTop - paddingBottom);
            return (
              <text 
                key={`grid-text-${tempValue}`}
                x={pan + paddingLeft - 8} 
                y={y + 3} 
                textAnchor="end" 
                fill="#64748B" 
                style={{ fontSize: "9px", fontFamily: "monospace", fontWeight: "700" }}
              >
                {tempValue}°C
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay (zoomed tracking) */}
        {isTooltipVisible && (
          <div 
            style={{
              position: "absolute",
              left: `${tooltipLeft}%`,
              top: `${tooltipTop}%`,
              transform: "translateX(-50%)",
              background: "var(--text-primary)",
              border: `1px solid var(--border-color)`,
              color: "var(--bg-card)",
              padding: "6px 10px",
              borderRadius: "8px",
              fontSize: "9px",
              fontWeight: "700",
              pointerEvents: "none",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.15)",
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              minWidth: "70px",
              alignItems: "center"
            }}
          >
            <span style={{ color: "var(--color-warning)", fontSize: "11px", fontWeight: "800" }}>{hoveredPoint.temp.toFixed(1)}°C</span>
            <span style={{ opacity: 0.8, fontSize: "8px" }}>{formatTimestamp(hoveredPoint.timestamp)}</span>
          </div>
        )}
      </div>
    );
  };

  // If loading, show query spinner
  if (isLoading) {
    return (
      <div className="card card-hover" style={{ minHeight: "220px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="card-label">History Timeline</span>
            <h3 className="card-title">Detailed Temperature Chart</h3>
          </div>
          {renderRangeSelector()}
        </div>
        <div style={{ height: "140px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: "8px" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent-blue)" }} />
          <span style={{ fontSize: "12px", fontWeight: "700" }}>Querying MongoDB timeline logs...</span>
        </div>
      </div>
    );
  }

  // If no data and it's Real-Time view, show awaiting readings
  if (activeRange === "live" && (!history || history.length < 2)) {
    return (
      <div className="card card-hover" style={{ minHeight: "220px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="card-label">History Timeline</span>
            <h3 className="card-title">Detailed Temperature Chart</h3>
          </div>
          {renderRangeSelector()}
        </div>
        <div style={{ height: "140px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: "8px" }}>
          <AreaChart size={32} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: "12px", fontWeight: "700" }}>Awaiting sensor readings for chart timeline...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card card-hover" style={{ minHeight: "220px" }}>
        {/* Card Header */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <div>
            <span className="card-label">History Timeline</span>
            <h3 className="card-title">Detailed Temperature Chart</h3>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {isLoading && <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent-blue)" }} />}
            {zoom > 1 && (
              <button 
                onClick={() => { setZoom(1); setPan(0); }} 
                className="nav-btn" 
                title="Reset Zoom"
                style={{ padding: "4px 10px", fontSize: "10px", fontWeight: "800", color: "var(--color-warning)", borderColor: "rgba(245, 158, 11, 0.4)", background: "rgba(245, 158, 11, 0.05)" }}
              >
                Reset Zoom
              </button>
            )}
            {renderRangeSelector()}
            <button 
              onClick={() => setIsFullscreen(true)} 
              className="nav-btn" 
              title="Full Screen Dashboard"
              style={{ padding: "6px" }}
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* Chart View */}
        {renderSvgChart(false)}

        {/* Footer Statistics */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 10px", fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", marginTop: "4px" }}>
          <span>{history.length} samples</span>
          <span style={{ color: "var(--color-warning)" }}>Current: {temps.length > 0 ? `${temps[temps.length - 1].toFixed(1)}°C` : "00.0°C"}</span>
          <span>Latest reading</span>
        </div>
      </div>

      {/* Fullscreen Overlay Dashboard */}
      {isFullscreen && (
        <div className="fullscreen-overlay">
          {/* Header */}
          <div className="fullscreen-header">
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div className="navbar-icon-bg" style={{ background: "rgba(245, 158, 11, 0.08)", borderColor: "rgba(245, 158, 11, 0.15)", color: "var(--color-warning)", animation: "none" }}>
                <AreaChart size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
                  Temperature Analytics Center
                </h1>
                <p style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  ESP32 Controller Dashboard
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              {isLoading && <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-warning)" }} />}
              {zoom > 1 && (
                <button 
                  onClick={() => { setZoom(1); setPan(0); }} 
                  className="nav-btn" 
                  title="Reset Zoom"
                  style={{ padding: "6px 12px", fontSize: "11px", fontWeight: "800", color: "var(--color-warning)", borderColor: "rgba(245, 158, 11, 0.4)", background: "rgba(245, 158, 11, 0.05)" }}
                >
                  Reset Zoom
                </button>
              )}
              {renderRangeSelector()}
              <button 
                onClick={() => setIsFullscreen(false)} 
                className="nav-btn" 
                style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: "12px" }}
              >
                <Minimize2 size={16} />
                <span style={{ fontSize: "12px", fontWeight: "700" }}>Exit Fullscreen</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Grid Layout */}
          <div className="fullscreen-grid">
            {/* Left Column: Big Chart */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "24px", padding: "28px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-warning)", textTransform: "uppercase" }}>
                  Timeline View ({activeRange})
                </span>
                <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)" }}>
                  Time bounds: {formatTimestamp(points[0]?.timestamp)} - {formatTimestamp(points[points.length-1]?.timestamp)}
                </span>
              </div>

              <div style={{ flexGrow: 1, display: "flex", alignItems: "center", margin: "20px 0" }}>
                {renderSvgChart(true)}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>
                <span>Total Samples: {history.length}</span>
                <span>Interval rate: 1 Reading/sec (Live)</span>
              </div>
            </div>

            {/* Right Column: Stats Panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Current Temperature Node */}
              <div style={{ background: "linear-gradient(135deg, var(--accent-blue-bg) 0%, var(--bg-card) 100%)", border: "1px solid var(--accent-blue-border)", borderRadius: "24px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", justifyContent: "center", minHeight: "150px" }}>
                <div style={{ background: "rgba(245, 158, 11, 0.08)", padding: "12px", borderRadius: "50%", color: "var(--color-warning)" }}>
                  <Thermometer size={28} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "10px", fontWeight: "800", color: "var(--text-secondary)", textTransform: "uppercase" }}>Current Temperature</span>
                  <h2 style={{ fontSize: "36px", fontWeight: "800", color: "var(--text-primary)", marginTop: "4px" }}>
                    {temps.length > 0 ? `${temps[temps.length - 1].toFixed(1)}°C` : "00.0°C"}
                  </h2>
                </div>
              </div>

              {/* Stats Panel */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "24px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flexGrow: 1 }}>
                <h3 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-primary)", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                  Session statistics
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Maximum */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                      <TrendingUp size={14} style={{ color: "#EF4444" }} />
                      <span style={{ fontSize: "11px", fontWeight: "700" }}>Maximum Temp</span>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-primary)" }}>{fullscreenStats.max}</span>
                  </div>

                  {/* Minimum */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                      <TrendingDown size={14} style={{ color: "#3B82F6" }} />
                      <span style={{ fontSize: "11px", fontWeight: "700" }}>Minimum Temp</span>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-primary)" }}>{fullscreenStats.min}</span>
                  </div>

                  {/* Average */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                      <Activity size={14} style={{ color: "var(--accent-blue)" }} />
                      <span style={{ fontSize: "11px", fontWeight: "700" }}>Average Temp</span>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-primary)" }}>{fullscreenStats.avg}</span>
                  </div>
                </div>

                <div style={{ marginTop: "auto", background: "var(--border-muted)", padding: "12px", borderRadius: "12px", fontSize: "9px", color: "var(--text-secondary)", fontWeight: "600", lineHeight: "1.4" }}>
                  💡 Tip: Use your mouse scroll wheel over the chart to zoom in/out. Click and drag to pan left/right. Move your cursor to read coordinates with precision tooltips.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

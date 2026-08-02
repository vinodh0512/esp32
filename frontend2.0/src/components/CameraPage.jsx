import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, Maximize2, Minimize2, Download, Video, Globe, AlertTriangle, Zap, CheckCircle2 } from 'lucide-react';

export function CameraPage() {
  const [cameraUrl, setCameraUrl] = useState(() => {
    return localStorage.getItem('esp2_camera_url') || 'https://esp32-1-5ssj.onrender.com/api/camera/stream';
  });
  const [inputUrl, setInputUrl] = useState(cameraUrl);
  const [isStreaming, setIsStreaming] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const imgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('esp2_camera_url', cameraUrl);
    setInputUrl(cameraUrl);
  }, [cameraUrl]);

  // Auto-poll new camera frame every 1 second
  useEffect(() => {
    if (!isStreaming || streamError) return;
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming, streamError]);

  const handleSaveUrl = (e) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    setCameraUrl(inputUrl.trim());
    setStreamError(false);
    setIsStreaming(true);
    setLastUpdated(new Date());
  };

  const handleToggleFlash = async () => {
    try {
      const nextFlash = !flashOn;
      await fetch("https://esp32-1-5ssj.onrender.com/api/camera/flash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flash: nextFlash })
      });
      setFlashOn(nextFlash);
    } catch (err) {
      console.error("Failed to toggle flash light:", err);
    }
  };

  const handleRefresh = () => {
    setStreamError(false);
    setIsStreaming(false);
    setTimeout(() => {
      setIsStreaming(true);
      setLastUpdated(new Date());
    }, 150);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch((err) => {
        console.error("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch((err) => {
        console.error("Fullscreen exit error:", err);
      });
    }
  };

  const handleCaptureSnapshot = () => {
    if (!imgRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imgRef.current.naturalWidth || 640;
      canvas.height = imgRef.current.naturalHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `esp32cam_snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Snapshot error:", err);
      alert("Unable to capture snapshot directly due to browser security (CORS). Right-click image to save or open stream URL in a new tab.");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: '16px' }} ref={containerRef}>
      
      {/* 1. Top Neo-Brutalist Camera Control Header */}
      <div style={{
        background: '#ffffff',
        border: '3.5px solid #000000',
        boxShadow: '4px 4px 0 #000000',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: '#38bdf8',
            border: '2.5px solid #000000',
            boxShadow: '2px 2px 0 #000000',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Video size={20} strokeWidth={3} style={{ color: '#000000' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>
              ESP32-CAM SURVEILLANCE FEED
            </h2>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#666666' }}>
              Real-time MJPEG Camera Stream & Snapshot Capture
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Badge */}
          <span style={{
            background: !streamError && isStreaming ? '#5ad641' : '#ff4757',
            color: '#000000',
            border: '2px solid #000000',
            boxShadow: '2px 2px 0 #000000',
            fontSize: '0.75rem',
            fontWeight: 900,
            padding: '4px 10px',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#000000',
              display: 'inline-block'
            }} />
            {!streamError && isStreaming ? 'STREAM LIVE' : 'FEED OFFLINE'}
          </span>

          <button
            onClick={handleToggleFlash}
            style={{
              background: flashOn ? '#facc15' : '#ffffff',
              border: '2px solid #000000',
              boxShadow: '2px 2px 0 #000000',
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 900,
              cursor: 'pointer',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Zap size={13} strokeWidth={3} fill={flashOn ? '#000000' : 'none'} />
            <span>{flashOn ? 'FLASH ON' : 'FLASH OFF'}</span>
          </button>

          <button
            onClick={handleRefresh}
            style={{
              background: '#facc15',
              border: '2px solid #000000',
              boxShadow: '2px 2px 0 #000000',
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 900,
              cursor: 'pointer',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <RefreshCw size={13} strokeWidth={3} />
            <span>REFRESH</span>
          </button>

          <button
            onClick={handleCaptureSnapshot}
            style={{
              background: '#ffffff',
              border: '2px solid #000000',
              boxShadow: '2px 2px 0 #000000',
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 900,
              cursor: 'pointer',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Download size={13} strokeWidth={3} />
            <span>SNAPSHOT</span>
          </button>

          <button
            onClick={toggleFullscreen}
            style={{
              background: '#ffffff',
              border: '2px solid #000000',
              boxShadow: '2px 2px 0 #000000',
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 900,
              cursor: 'pointer',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            {isFullscreen ? <Minimize2 size={13} strokeWidth={3} /> : <Maximize2 size={13} strokeWidth={3} />}
            <span>{isFullscreen ? 'EXIT FULL' : 'FULLSCREEN'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Stream Screen Container */}
      <div style={{
        background: '#0a0a0a',
        border: '3.5px solid #000000',
        boxShadow: '4px 4px 0 #000000',
        minHeight: '420px',
        height: isFullscreen ? '100vh' : '520px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        {isStreaming && !streamError ? (
          <img
            ref={imgRef}
            src={`${cameraUrl}?t=${lastUpdated.getTime()}`}
            alt="ESP32-CAM Feed"
            onError={() => setStreamError(true)}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#ffffff', padding: '30px 20px', maxWidth: '520px' }}>
            <div style={{
              background: '#ff4757',
              border: '3px solid #000000',
              width: '56px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              boxShadow: '3px 3px 0 #000000'
            }}>
              <AlertTriangle size={28} strokeWidth={3} style={{ color: '#000000' }} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
              CAMERA STREAM UNREACHABLE
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#aaaaaa', marginBottom: '20px', lineHeight: '1.5' }}>
              Could not load video stream from <code style={{ background: '#222222', color: '#5ad641', padding: '2px 6px', border: '1px solid #444' }}>{cameraUrl}</code>. Ensure the ESP32-CAM is powered, connected to local Wi-Fi, and serving MJPEG video on <code>/stream</code>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                onClick={handleRefresh}
                style={{
                  background: '#5ad641',
                  border: '2.5px solid #000',
                  boxShadow: '2px 2px 0 #000',
                  padding: '8px 16px',
                  fontWeight: 900,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                RETRY STREAM
              </button>
              <a
                href={cameraUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#ffffff',
                  color: '#000000',
                  border: '2.5px solid #000',
                  boxShadow: '2px 2px 0 #000',
                  padding: '8px 16px',
                  fontWeight: 900,
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Globe size={14} strokeWidth={3} />
                OPEN IN BROWSER
              </a>
            </div>
          </div>
        )}

        {/* Live Watermark Badge */}
        {!streamError && isStreaming && (
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: '#ff4757',
            color: '#000000',
            border: '2px solid #000000',
            boxShadow: '2px 2px 0 #000000',
            fontSize: '0.7rem',
            fontWeight: 900,
            padding: '3px 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            ● LIVE STREAM
          </div>
        )}
      </div>

      {/* 3. Bottom URL Configurator Box */}
      <div style={{
        background: '#ffffff',
        border: '3.5px solid #000000',
        boxShadow: '4px 4px 0 #000000',
        padding: '16px'
      }}>
        <form onSubmit={handleSaveUrl} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase' }}>
            <Globe size={16} strokeWidth={3} />
            <span>ESP32-CAM STREAM URL:</span>
          </div>

          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="http://192.168.1.100/stream"
            style={{
              flex: 1,
              minWidth: '260px',
              padding: '8px 12px',
              border: '2.5px solid #000000',
              fontWeight: 800,
              fontSize: '0.85rem',
              outline: 'none',
              background: '#fcfcf8'
            }}
          />

          <button
            type="submit"
            style={{
              background: '#5ad641',
              border: '2.5px solid #000000',
              boxShadow: '2.5px 2.5px 0 #000000',
              padding: '8px 16px',
              fontSize: '0.8rem',
              fontWeight: 900,
              cursor: 'pointer',
              textTransform: 'uppercase'
            }}
          >
            SAVE & CONNECT
          </button>
        </form>
      </div>

    </div>
  );
}

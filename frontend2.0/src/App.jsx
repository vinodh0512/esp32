import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ConnectionModal } from './components/ConnectionModal';
import { SensorCard } from './components/SensorCard';
import { ControlsCard } from './components/ControlsCard';
import { LiveTelemetryChart } from './components/LiveTelemetryChart';
import { ActivityLogs } from './components/ActivityLogs';
import { AlertBanner } from './components/AlertBanner';
import { TelemetryGraphPage } from './components/TelemetryGraphPage';
import { FermentationCard } from './components/FermentationCard';
import { FermentationHistoryPage } from './components/FermentationHistoryPage';
import { espService } from './services/espConnection';

export default function App() {
  const [state, setState] = useState(espService.state);
  const [status, setStatus] = useState(espService.status);
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' | 'fermentation' | 'graph'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);

  // Fermentation Active Batch State
  const [activeBatch, setActiveBatch] = useState(() => {
    try {
      const saved = localStorage.getItem('esp_active_batch');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Filter numeric telemetry values
  const tempValues = history.map(h => h.temperature).filter(v => v !== undefined && v !== null && !isNaN(v));
  const minTemp = tempValues.length > 0 ? Math.min(...tempValues).toFixed(1) : undefined;
  const maxTemp = tempValues.length > 0 ? Math.max(...tempValues).toFixed(1) : undefined;

  const phValues = history.map(h => h.pH).filter(v => v !== undefined && v !== null && !isNaN(v));
  const minPh = phValues.length > 0 ? Math.min(...phValues).toFixed(2) : undefined;
  const maxPh = phValues.length > 0 ? Math.max(...phValues).toFixed(2) : undefined;

  useEffect(() => {
    // Connect service on mount
    espService.connect();

    const unsubscribe = espService.subscribe((newState, newStatus) => {
      setState(newState);
      setStatus(newStatus);
      if (newState.activeBatch !== undefined) {
        setActiveBatch(newState.activeBatch);
      }

      // Append to history buffer without truncating active runs (retains 5,000 samples)
      if (newState.temperature !== undefined || newState.pH !== undefined) {
        setHistory(prev => {
          const nextHist = [...prev, {
            timestamp: new Date().toISOString(),
            temperature: newState.temperature,
            pH: newState.pH,
            voltage: newState.voltage,
            raw: newState.raw
          }];
          return nextHist.slice(-5000);
        });
      }
    });

    return () => {
      unsubscribe();
      espService.disconnect();
    };
  }, []);

  const logEvent = (type, message) => {
    setLogs(prev => [
      { timestamp: new Date().toISOString(), type, message },
      ...prev.slice(0, 199)
    ]);
  };

  useEffect(() => {
    logEvent('info', `Switched connection mode to ${state.connectionMode.toUpperCase()}`);
  }, [state.connectionMode]);

  useEffect(() => {
    if (status === 'connected') {
      logEvent('info', `Successfully established socket session in ${state.connectionMode.toUpperCase()} mode`);
    } else if (status === 'error') {
      logEvent('error', `Connection error occurred on target IP/host`);
    }
  }, [status]);

  const handleControl = (controlPayload) => {
    espService.sendControl(controlPayload);
    if (controlPayload.led !== undefined) {
      logEvent('info', `Command issued: Set LED -> ${controlPayload.led ? 'ON' : 'OFF'}`);
    }
    if (controlPayload.tempEnabled !== undefined) {
      logEvent('info', `Command issued: Set Polling Stream -> ${controlPayload.tempEnabled ? 'RESUME' : 'PAUSE'}`);
    }
  };

  const handleSaveConfig = (newMode, newConfig) => {
    espService.updateConfig(newMode, newConfig);
    logEvent('info', `Updated connection parameters. Target IP: ${newConfig.directIp || newConfig.relayUrl}`);
  };

  // --- FERMENTATION BATCH HANDLERS ---
  const handleStartBatch = (name) => {
    const newBatch = {
      name: name || 'Yeast Sugar Test',
      initialPH: state.pH !== undefined ? state.pH : 6.82,
      initialTemp: state.temperature !== undefined ? state.temperature : 28.4
    };

    const baseUrl = espService.config.relayUrl.trim().replace(/\/$/, '');
    fetch(`${baseUrl}/api/batches/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newBatch, deviceId: espService.config.deviceId })
    }).catch(err => console.error("Error starting batch via REST:", err));

    espService.sendControl({ fermentation: 'start', batch: newBatch });
    logEvent('warn', `🚀 FERMENTATION STARTED: "${newBatch.name}" | Initial pH: ${newBatch.initialPH} | Initial Temp: ${newBatch.initialTemp}°C`);
  };

  const handleStopBatch = () => {
    if (!activeBatch) return;
    
    const baseUrl = espService.config.relayUrl.trim().replace(/\/$/, '');
    fetch(`${baseUrl}/api/batches/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: espService.config.deviceId, finalPH: state.pH })
    }).catch(err => console.error("Error stopping batch via REST:", err));

    espService.sendControl({ fermentation: 'stop', finalPH: state.pH });
    logEvent('warn', `🛑 FERMENTATION COMPLETED: "${activeBatch.name}"`);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* Top Navbar with Navigation Tabs */}
      <Navbar 
        state={state} 
        status={status} 
        activePage={activePage}
        setActivePage={setActivePage}
        onOpenSettings={() => setIsSettingsOpen(true)} 
      />

      {/* Connection Config Drawer / Modal */}
      <ConnectionModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        currentMode={state.connectionMode}
        currentConfig={espService.config}
        onSave={handleSaveConfig}
      />

      {/* Main Container */}
      <main style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '0 16px 12px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: activePage === 'dashboard' ? 'hidden' : 'auto' }}>
        
        {/* Floating Alert Banner */}
        <AlertBanner status={status} temperature={state.temperature} />

        {/* View Switcher: Fermentation Page vs Graph Page vs Camera Page vs Single-Page Non-Scrollable Dashboard */}
        {activePage === 'fermentation' ? (
          <FermentationHistoryPage activeBatch={activeBatch} liveHistory={history} currentState={state} />
        ) : activePage === 'graph' ? (
          <TelemetryGraphPage historyData={history} state={state} />
        ) : (
          /* SINGLE-PAGE NON-SCROLLABLE DASHBOARD VIEWPORT GRID */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '12px', minHeight: 0, overflow: 'hidden' }}>
            
            {/* Top Compact Fermentation Tracker Bar */}
            <FermentationCard 
              state={state} 
              activeBatch={activeBatch}
              onStartBatch={handleStartBatch}
              onStopBatch={handleStopBatch}
            />

            {/* Main 2-Column Dashboard Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              
              {/* Left Column: Sensor Cards & Live Chart */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, overflow: 'hidden' }}>
                
                {/* Sensors Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <SensorCard 
                    title="Temperature Sensor" 
                    value={state.temperature} 
                    unit="°C" 
                    iconType="temp" 
                    minVal={minTemp}
                    maxVal={maxTemp}
                    warningThreshold={35.0}
                  />

                  <SensorCard 
                    title="Water pH Level" 
                    value={state.pH} 
                    unit="pH" 
                    iconType="ph" 
                    minVal={minPh}
                    maxVal={maxPh}
                  />
                </div>

                {/* Live Telemetry Chart (Fills remaining height) */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <LiveTelemetryChart historyData={history} />
                </div>

              </div>

              {/* Right Column: Hardware Controls & Activity Logs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, overflow: 'hidden' }}>
                <ControlsCard state={state} onControl={handleControl} />
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <ActivityLogs logs={logs} onClear={() => setLogs([])} />
                </div>
              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
const url = require("url");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

let device = {
  deviceId: "esp32-1",
  status: "offline",
  led: true,
  lastSeen: null
};

// WebSocket connection tracking
const dashboardClients = new Set();
const deviceClients = new Map();

// Helper to broadcast to all connected dashboards
function broadcastToDashboards(messageObj) {
  const messageStr = JSON.stringify(messageObj);
  for (const client of dashboardClients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(messageStr);
    }
  }
}

// WebSocket Event Handlers
wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const { clientType, deviceId } = parsedUrl.query;
  const devId = deviceId || "esp32-1";

  console.log(`[WS] Connection opened: type=${clientType}, deviceId=${devId}`);

  if (clientType === "dashboard") {
    dashboardClients.add(ws);
    // Send current state immediately on connect
    ws.send(JSON.stringify({ type: "deviceUpdate", data: device }));

    ws.on("message", (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        console.log("[WS] Dashboard Msg:", parsedMessage);

        if (parsedMessage.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: parsedMessage.timestamp }));
        } else if (parsedMessage.type === "control") {
          const { led } = parsedMessage;
          device.led = led;
          device.lastSeen = Date.now();
          device.status = "online";

          // Broadcast updated state to all dashboards
          broadcastToDashboards({ type: "deviceUpdate", data: device });

          // Forward command to device if connected via WS
          const deviceWs = deviceClients.get(devId);
          if (deviceWs && deviceWs.readyState === 1) {
            deviceWs.send(JSON.stringify({ type: "control", led }));
          }
        }
      } catch (err) {
        console.error("[WS] Error parsing dashboard message:", err);
      }
    });

    ws.on("close", () => {
      dashboardClients.delete(ws);
      console.log("[WS] Dashboard disconnected");
    });

  } else if (clientType === "device") {
    deviceClients.set(devId, ws);
    device.deviceId = devId;
    device.status = "online";
    device.lastSeen = Date.now();

    // Broadcast updated state to dashboards
    broadcastToDashboards({ type: "deviceUpdate", data: device });

    ws.on("message", (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        console.log("[WS] Device Msg:", parsedMessage);

        if (parsedMessage.type === "status" || parsedMessage.type === "heartbeat") {
          device = {
            ...device,
            ...parsedMessage.data,
            deviceId: devId,
            status: "online",
            lastSeen: Date.now()
          };
          broadcastToDashboards({ type: "deviceUpdate", data: device });
        }
      } catch (err) {
        console.error("[WS] Error parsing device message:", err);
      }
    });

    ws.on("close", () => {
      deviceClients.delete(devId);
      console.log(`[WS] Device disconnected: ${devId}`);
      device.status = "offline";
      broadcastToDashboards({ type: "deviceUpdate", data: device });
    });
  } else {
    ws.close();
  }
});

// Periodic inactive device detection (marks offline if no heartbeat/action for >15s)
setInterval(() => {
  if (device.lastSeen && Date.now() - device.lastSeen > 15000 && device.status !== "offline") {
    device.status = "offline";
    broadcastToDashboards({ type: "deviceUpdate", data: device });
    console.log("[WS] Device marked offline due to inactivity (>15s)");
  }
}, 5000);

// --- HTTP API Endpoints ---

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "ESP32 Backend Running with WebSocket Support"
  });
});

// ESP32 HTTP Heartbeat / Status
app.post("/status", (req, res) => {
  const { deviceId, status } = req.body;

  device = {
    ...device,
    ...req.body,
    deviceId: deviceId || device.deviceId,
    status: status || "online",
    lastSeen: Date.now()
  };

  console.log("[HTTP] ESP32 status post:", device);

  // Broadcast update to WS dashboards instantly
  broadcastToDashboards({ type: "deviceUpdate", data: device });

  res.json({
    success: true
  });
});

// React Dashboard GET status (fallback)
app.get("/status", (req, res) => {
  if (device.lastSeen && Date.now() - device.lastSeen > 15000) {
    device.status = "offline";
  }
  res.json(device);
});

// LED ON (HTTP)
app.post("/led/on", (req, res) => {
  device.led = true;
  device.lastSeen = Date.now();
  device.status = "online";

  console.log("[HTTP] LED ON command");

  // Broadcast to WS dashboards
  broadcastToDashboards({ type: "deviceUpdate", data: device });

  // Forward to WS device if connected
  const deviceWs = deviceClients.get(device.deviceId);
  if (deviceWs && deviceWs.readyState === 1) {
    deviceWs.send(JSON.stringify({ type: "control", led: true }));
  }

  res.json({
    success: true
  });
});

// LED OFF (HTTP)
app.post("/led/off", (req, res) => {
  device.led = false;
  device.lastSeen = Date.now();
  device.status = "online";

  console.log("[HTTP] LED OFF command");

  // Broadcast to WS dashboards
  broadcastToDashboards({ type: "deviceUpdate", data: device });

  // Forward to WS device if connected
  const deviceWs = deviceClients.get(device.deviceId);
  if (deviceWs && deviceWs.readyState === 1) {
    deviceWs.send(JSON.stringify({ type: "control", led: false }));
  }

  res.json({
    success: true
  });
});

// ESP32 checks LED state (HTTP poll fallback)
app.get("/led", (req, res) => {
  res.json({
    led: device.led
  });
});

// Listen on server instead of app
server.listen(PORT, () => {
  console.log("Server Running On Port", PORT);
});

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
const url = require("url");

// Import Database and Models
const connectDB = require("./config/db");
const Device = require("./models/Device");
const TemperatureLog = require("./models/TemperatureLog");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Database connection
connectDB().catch((err) => {
  console.error("[Backend] Mongoose Connection Failed at Startup:", err);
});

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// WebSocket Connection Tracking
const dashboardClients = new Set();
const deviceClients = new Map(); // deviceId -> ws socket

// Helper to broadcast state changes to all dashboards
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

  // Production-grade Connection Keep-Alive Setup
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  console.log(`[WS] Connection opened: clientType=${clientType}, deviceId=${devId}`);

  if (clientType === "dashboard") {
    dashboardClients.add(ws);

    // Fetch initial device state from database to send immediately
    Device.findOne({ deviceId: devId })
      .then((dev) => {
        const payload = dev
          ? { deviceId: dev.deviceId, status: dev.status, led: dev.led, tempEnabled: dev.tempEnabled, temperature: dev.temperature, humidity: dev.humidity, lastSeen: dev.lastSeen }
          : { deviceId: devId, status: "offline", led: false, tempEnabled: false, lastSeen: null };
        ws.send(JSON.stringify({ type: "deviceUpdate", data: payload }));
      })
      .catch((err) => console.error("[WS] Error sending initial status to dashboard:", err));

    ws.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        console.log("[WS] Dashboard Msg:", parsedMessage);

        if (parsedMessage.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: parsedMessage.timestamp }));
        } else if (parsedMessage.type === "control") {
          const { led, tempEnabled } = parsedMessage;
          const targetDeviceId = parsedMessage.deviceId || devId;

          const updateObj = { lastSeen: new Date(), status: "online" };
          if (led !== undefined) updateObj.led = led;
          if (tempEnabled !== undefined) updateObj.tempEnabled = tempEnabled;

          // Save new state in database
          const dev = await Device.findOneAndUpdate(
            { deviceId: targetDeviceId },
            updateObj,
            { returnDocument: "after", upsert: true }
          );

          // Broadcast state to dashboards
          broadcastToDashboards({ type: "deviceUpdate", data: dev });

          // Forward to target device socket instantly
          const deviceWs = deviceClients.get(targetDeviceId);
          if (deviceWs && deviceWs.readyState === 1) {
            const forwardPayload = { type: "control" };
            if (led !== undefined) forwardPayload.led = led;
            if (tempEnabled !== undefined) forwardPayload.tempEnabled = tempEnabled;
            deviceWs.send(JSON.stringify(forwardPayload));
          }
        }
      } catch (err) {
        console.error("[WS] Error parsing dashboard message:", err);
      }
    });

    ws.on("close", () => {
      dashboardClients.delete(ws);
      console.log("[WS] Dashboard client disconnected");
    });

  } else if (clientType === "device") {
    deviceClients.set(devId, ws);

    // Update status to online in MongoDB
    Device.findOneAndUpdate(
      { deviceId: devId },
      { status: "online", lastSeen: new Date() },
      { returnDocument: "after", upsert: true }
    )
      .then((dev) => {
        broadcastToDashboards({ type: "deviceUpdate", data: dev });
      })
      .catch((err) => console.error("[WS] Error marking device online in DB:", err));

    ws.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        console.log("[WS] Device Msg:", parsedMessage);

        if (parsedMessage.type === "status" || parsedMessage.type === "heartbeat") {
          const metrics = parsedMessage.data || {};
          
          // Save status, latency, or sensor metrics to MongoDB
          const dev = await Device.findOneAndUpdate(
            { deviceId: devId },
            {
              ...metrics,
              status: "online",
              lastSeen: new Date()
            },
            { returnDocument: "after", upsert: true }
          );

          if (metrics.temperature !== undefined && metrics.temperature !== null) {
            await TemperatureLog.create({
              deviceId: devId,
              temperature: metrics.temperature
            });
          }

          broadcastToDashboards({ type: "deviceUpdate", data: dev });
        } else if (parsedMessage.type === "temperature") {
          const { temperature } = parsedMessage.data || {};
          if (temperature !== undefined && temperature !== null) {
            const dev = await Device.findOneAndUpdate(
              { deviceId: devId },
              { temperature, status: "online", lastSeen: new Date() },
              { returnDocument: "after", upsert: true }
            );

            await TemperatureLog.create({
              deviceId: devId,
              temperature
            });

            broadcastToDashboards({ type: "deviceUpdate", data: dev });
          }
        }
      } catch (err) {
        console.error("[WS] Error parsing device message:", err);
      }
    });

    ws.on("close", async () => {
      deviceClients.delete(devId);
      console.log(`[WS] Device disconnected: ${devId}`);

      try {
        const dev = await Device.findOneAndUpdate(
          { deviceId: devId },
          { status: "offline", lastSeen: new Date() },
          { returnDocument: "after" }
        );
        if (dev) {
          broadcastToDashboards({ type: "deviceUpdate", data: dev });
        }
      } catch (err) {
        console.error("[WS] Error setting device offline in DB on close:", err);
      }
    });
  } else {
    // Unrecognized client, reject connection
    ws.close();
  }
});

// Production-grade connection monitoring (Ping check interval)
const keepAliveInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log("[WS] Terminating stale connection due to missed pong");
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(keepAliveInterval);
});

// Periodic offline sweep: Scan DB every 5 seconds for devices inactive for > 15s
setInterval(async () => {
  try {
    const cutoffTime = new Date(Date.now() - 15000);
    const staleDevices = await Device.find({
      status: "online",
      lastSeen: { $lt: cutoffTime }
    });

    for (const dev of staleDevices) {
      dev.status = "offline";
      await dev.save();
      console.log(`[Sweep] Device ${dev.deviceId} flagged offline due to inactivity.`);
      broadcastToDashboards({ type: "deviceUpdate", data: dev });
    }
  } catch (err) {
    console.error("[Sweep] Error in offline check interval:", err);
  }
}, 5000);


// --- HTTP REST API Endpoints ---

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "ESP32 Backend Running with WebSockets & MongoDB Support"
  });
});

// ESP32 Heartbeat / Status Post (HTTP Fallback)
app.post("/status", async (req, res) => {
  try {
    const { deviceId, status } = req.body;
    const devId = deviceId || "esp32-1";

    const dev = await Device.findOneAndUpdate(
      { deviceId: devId },
      {
        ...req.body,
        status: status || "online",
        lastSeen: new Date()
      },
      { returnDocument: "after", upsert: true }
    );

    console.log("[HTTP] Device status update:", dev);
    broadcastToDashboards({ type: "deviceUpdate", data: dev });

    res.json({ success: true });
  } catch (err) {
    console.error("[HTTP] Error updating status:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET status (HTTP Polling fallback for React Dashboard)
app.get("/status", async (req, res) => {
  try {
    const devId = req.query.deviceId || "esp32-1";
    let dev = await Device.findOne({ deviceId: devId });

    if (dev) {
      // Check offline timeout locally before returning
      if (dev.lastSeen && Date.now() - dev.lastSeen.getTime() > 15000 && dev.status !== "offline") {
        dev.status = "offline";
        await dev.save();
        broadcastToDashboards({ type: "deviceUpdate", data: dev });
      }
      res.json(dev);
    } else {
      res.status(404).json({ error: "Device not found" });
    }
  } catch (err) {
    console.error("[HTTP] Error fetching status:", err);
    res.status(500).json({ error: err.message });
  }
});

// LED ON (HTTP)
app.post("/led/on", async (req, res) => {
  try {
    const devId = req.body.deviceId || "esp32-1";

    const dev = await Device.findOneAndUpdate(
      { deviceId: devId },
      { led: true, lastSeen: new Date(), status: "online" },
      { returnDocument: "after", upsert: true }
    );

    console.log(`[HTTP] LED ON command for ${devId}`);
    broadcastToDashboards({ type: "deviceUpdate", data: dev });

    // Send WebSocket command if online
    const deviceWs = deviceClients.get(devId);
    if (deviceWs && deviceWs.readyState === 1) {
      deviceWs.send(JSON.stringify({ type: "control", led: true }));
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[HTTP] Error handling LED ON:", err);
    res.status(500).json({ error: err.message });
  }
});

// LED OFF (HTTP)
app.post("/led/off", async (req, res) => {
  try {
    const devId = req.body.deviceId || "esp32-1";

    const dev = await Device.findOneAndUpdate(
      { deviceId: devId },
      { led: false, lastSeen: new Date(), status: "online" },
      { returnDocument: "after", upsert: true }
    );

    console.log(`[HTTP] LED OFF command for ${devId}`);
    broadcastToDashboards({ type: "deviceUpdate", data: dev });

    // Send WebSocket command if online
    const deviceWs = deviceClients.get(devId);
    if (deviceWs && deviceWs.readyState === 1) {
      deviceWs.send(JSON.stringify({ type: "control", led: false }));
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[HTTP] Error handling LED OFF:", err);
    res.status(500).json({ error: err.message });
  }
});

// ESP32 checks LED state (HTTP poll fallback)
app.get("/led", async (req, res) => {
  try {
    const devId = req.query.deviceId || "esp32-1";
    const dev = await Device.findOne({ deviceId: devId });
    res.json({ led: dev ? dev.led : false });
  } catch (err) {
    console.error("[HTTP] Error getting LED state:", err);
    res.status(500).json({ error: err.message });
  }
});

// Temperature Sensor ON (HTTP)
app.post("/temp/on", async (req, res) => {
  try {
    const devId = req.body.deviceId || "esp32-1";

    const dev = await Device.findOneAndUpdate(
      { deviceId: devId },
      { tempEnabled: true, lastSeen: new Date(), status: "online" },
      { returnDocument: "after", upsert: true }
    );

    console.log(`[HTTP] Temp Sensor ON command for ${devId}`);
    broadcastToDashboards({ type: "deviceUpdate", data: dev });

    // Send WebSocket command if online
    const deviceWs = deviceClients.get(devId);
    if (deviceWs && deviceWs.readyState === 1) {
      deviceWs.send(JSON.stringify({ type: "control", tempEnabled: true }));
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[HTTP] Error handling Temp ON:", err);
    res.status(500).json({ error: err.message });
  }
});

// Temperature Sensor OFF (HTTP)
app.post("/temp/off", async (req, res) => {
  try {
    const devId = req.body.deviceId || "esp32-1";

    const dev = await Device.findOneAndUpdate(
      { deviceId: devId },
      { tempEnabled: false, lastSeen: new Date(), status: "online" },
      { returnDocument: "after", upsert: true }
    );

    console.log(`[HTTP] Temp Sensor OFF command for ${devId}`);
    broadcastToDashboards({ type: "deviceUpdate", data: dev });

    // Send WebSocket command if online
    const deviceWs = deviceClients.get(devId);
    if (deviceWs && deviceWs.readyState === 1) {
      deviceWs.send(JSON.stringify({ type: "control", tempEnabled: false }));
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[HTTP] Error handling Temp OFF:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET recent temperature log history (HTTP API)
app.get("/temp/history", async (req, res) => {
  try {
    const devId = req.query.deviceId || "esp32-1";
    const limit = parseInt(req.query.limit) || 20;

    const logs = await TemperatureLog.find({ deviceId: devId })
      .sort({ timestamp: -1 })
      .limit(limit);

    res.json(logs.reverse());
  } catch (err) {
    console.error("[HTTP] Error fetching temp history:", err);
    res.status(500).json({ error: err.message });
  }
});

// Listen on server
server.listen(PORT, () => {
  console.log("Server Running On Port", PORT);
});

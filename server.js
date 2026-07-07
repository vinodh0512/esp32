require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const Device = require("./models/Device");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("ESP32 Backend Running");
});

// Route for device to report status or UI to mock status
app.post(["/api/status", "/status"], async (req, res, next) => {
    try {
        const deviceId = req.body.deviceId || "esp32_sensor_1";
        const { temperature, humidity } = req.body;

        const updateFields = {
            status: "Online",
            lastSeen: new Date()
        };

        // Only add telemetry if explicitly provided
        if (temperature !== undefined) updateFields.temperature = Number(temperature);
        if (humidity !== undefined) updateFields.humidity = Number(humidity);

        const device = await Device.findOneAndUpdate(
            { deviceId },
            { $set: updateFields },
            {
                returnDocument: "after",
                upsert: true,
                runValidators: true
            }
        );

        res.status(200).json(device);
    } catch (error) {
        next(error);
    }
});

// Route to get the latest status
app.get(["/api/status", "/status"], async (req, res, next) => {
    try {
        const filter = req.query.deviceId ? { deviceId: req.query.deviceId } : {};
        const device = await Device.findOne(filter).sort({ lastSeen: -1 });
        
        if (!device) {
            return res.status(404).json({ message: "No device records found." });
        }
        
        res.status(200).json(device);
    } catch (error) {
        next(error);
    }
});

// Offline status check monitor (Interval: 1s, Offline Threshold: 3s)
const OFFLINE_THRESHOLD_MS = Number(process.env.OFFLINE_THRESHOLD_MS) || 3 * 1000;
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS) || 1 * 1000;

let monitorTimeoutId = null;

async function checkDeviceStatus() {
    try {
        const cutoffTime = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
        
        const result = await Device.updateMany(
            {
                status: "Online",
                lastSeen: { $lt: cutoffTime }
            },
            {
                $set: { status: "Offline" }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`[Offline Monitor] Marked ${result.modifiedCount} device(s) as Offline (last seen > ${OFFLINE_THRESHOLD_MS / 1000}s ago)`);
        }
    } catch (error) {
        console.error("[Offline Monitor Error] Failed to run offline status check:", error);
    } finally {
        // Schedule next check only after the current one completes to prevent overlapping executions
        monitorTimeoutId = setTimeout(checkDeviceStatus, CHECK_INTERVAL_MS);
    }
}

// Start the check monitor
checkDeviceStatus();

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error("[Server Error]", err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server Running on ${PORT}`);
});

// Graceful Shutdown Handler
const gracefulShutdown = async (signal) => {
    console.log(`[System] Received ${signal}. Shutting down gracefully...`);
    
    if (monitorTimeoutId) {
        clearTimeout(monitorTimeoutId);
        console.log("[Offline Monitor] Stopped status checking loop.");
    }

    server.close(async () => {
        console.log("[Server] Express server closed.");
        try {
            const mongoose = require("mongoose");
            await mongoose.disconnect();
            console.log("[Database] Mongoose connection closed.");
            process.exit(0);
        } catch (err) {
            console.error("[System Error] Error closing Mongoose connection:", err);
            process.exit(1);
        }
    });

    // Force close connections after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
        console.error("[System] Forcefully shutting down...");
        process.exit(1);
    }, 10 * 1000).unref();
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));


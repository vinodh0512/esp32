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

// Offline status check monitor (Interval: 5s, Offline Threshold: 30s)
const OFFLINE_THRESHOLD_MS = 30 * 1000;
const CHECK_INTERVAL_MS = 5 * 1000;

setInterval(async () => {
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
            console.log(`[Offline Monitor] Marked ${result.modifiedCount} device(s) as Offline (last seen > 30s ago)`);
        }
    } catch (error) {
        console.error("[Offline Monitor Error] Failed to run offline status check:", error);
    }
}, CHECK_INTERVAL_MS);

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error("[Server Error]", err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server Running on ${PORT}`);
});

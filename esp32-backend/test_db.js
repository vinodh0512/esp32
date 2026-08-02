require("dotenv").config();
const mongoose = require("mongoose");
const Device = require("./models/Device");
const TemperatureLog = require("./models/TemperatureLog");

async function testMongoDatabase() {
    console.log("[Test] Connecting to MongoDB...");
    console.log("[Test] URI:", process.env.MONGODB_URI);

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("[Test] Successfully connected to MongoDB!");

        const testDeviceId = "esp32-1";
        const mockTemperature = 27.50;
        const mockPH = 6.75;
        const mockVoltage = 1.85;
        const mockRaw = 2290;

        // 1. Upsert Device document
        const updatedDevice = await Device.findOneAndUpdate(
            { deviceId: testDeviceId },
            {
                status: "online",
                temperature: mockTemperature,
                pH: mockPH,
                voltage: mockVoltage,
                raw: mockRaw,
                tempConnected: true,
                phConnected: true,
                led: true,
                lastSeen: new Date()
            },
            { returnDocument: "after", upsert: true }
        );
        console.log("[Test] Updated Device Record in MongoDB:\n", JSON.stringify(updatedDevice, null, 2));

        // 2. Insert Telemetry / TemperatureLog document with pH & Temperature
        const logEntry = await TemperatureLog.create({
            deviceId: testDeviceId,
            temperature: mockTemperature,
            pH: mockPH,
            voltage: mockVoltage,
            raw: mockRaw,
            tempConnected: true,
            phConnected: true,
            led: true,
            timestamp: new Date()
        });
        console.log("[Test] Saved Telemetry Log in MongoDB:\n", JSON.stringify(logEntry, null, 2));

        // 3. Query TemperatureLog documents
        const logs = await TemperatureLog.find({ deviceId: testDeviceId }).sort({ timestamp: -1 }).limit(5);
        console.log(`\n[Test] Retrieved ${logs.length} telemetry logs from MongoDB:`);
        logs.forEach((l, idx) => {
            console.log(`  [${idx + 1}] Time: ${l.timestamp.toISOString()} | Temp: ${l.temperature}°C | pH: ${l.pH} | Volt: ${l.voltage}V | ADC Raw: ${l.raw}`);
        });

        console.log("\n[Test] MongoDB verification passed successfully!");
    } catch (err) {
        console.error("[Test] Verification failed with error:", err);
    } finally {
        await mongoose.disconnect();
        console.log("[Test] Disconnected from MongoDB.");
    }
}

testMongoDatabase();

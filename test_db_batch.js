require("dotenv").config();
const mongoose = require("mongoose");
const FermentationBatch = require("./models/FermentationBatch");
const Device = require("./models/Device");
const TemperatureLog = require("./models/TemperatureLog");

async function testFermentationBatchInMongo() {
    console.log("[Test] Connecting to MongoDB Atlas...");
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("[Test] Connected to MongoDB Atlas!");

        // 1. Create a new FermentationBatch document in MongoDB
        const newBatch = await FermentationBatch.create({
            name: "Yeast Sugar Test Batch (Live)",
            deviceId: "esp32-1",
            startTime: new Date(),
            initialPH: 6.45,
            initialTemp: 28.5,
            status: "RUNNING",
            dataPoints: [{
                time: new Date(),
                pH: 6.45,
                temperature: 28.5
            }]
        });
        console.log("\n[Test] Successfully created FermentationBatch in MongoDB Atlas:");
        console.log(JSON.stringify(newBatch, null, 2));

        // 2. Query running batch from MongoDB Atlas
        const activeBatch = await FermentationBatch.findOne({ deviceId: "esp32-1", status: "RUNNING" });
        console.log("\n[Test] Queried Active Batch from MongoDB Atlas:");
        console.log(`  ID: ${activeBatch._id}`);
        console.log(`  Name: ${activeBatch.name}`);
        console.log(`  Status: ${activeBatch.status}`);
        console.log(`  Initial pH: ${activeBatch.initialPH}`);
        console.log(`  Initial Temp: ${activeBatch.initialTemp}°C`);

        console.log("\n[Test] SUCCESS: Fermentation Batch is successfully saved in MongoDB Atlas 'fermentationbatches' collection!");
    } catch (err) {
        console.error("[Test] Error testing FermentationBatch in Mongo:", err);
    } finally {
        await mongoose.disconnect();
    }
}

testFermentationBatchInMongo();

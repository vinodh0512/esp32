require("dotenv").config();
const mongoose = require("mongoose");
const Device = require("./models/Device");
const TemperatureLog = require("./models/TemperatureLog");

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("DB Connected.");

    const devices = await Device.find({});
    console.log("\n--- Devices ---");
    console.log(JSON.stringify(devices, null, 2));

    const logs = await TemperatureLog.find({}).sort({ timestamp: -1 }).limit(5);
    console.log("\n--- Last 5 Temperature Logs ---");
    console.log(JSON.stringify(logs, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();

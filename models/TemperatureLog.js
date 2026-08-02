const mongoose = require("mongoose");

const temperatureLogSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    temperature: {
        type: Number
    },
    pH: {
        type: Number
    },
    voltage: {
        type: Number
    },
    raw: {
        type: Number
    },
    phConnected: {
        type: Boolean,
        default: false
    },
    tempConnected: {
        type: Boolean,
        default: false
    },
    led: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Optimize query for fetching logs for a device ordered by time
temperatureLogSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model("TemperatureLog", temperatureLogSchema);

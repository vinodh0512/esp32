const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    status: {
        type: String,
        enum: ["Online", "Offline"],
        default: "Offline",
        index: true
    },

    temperature: {
        type: Number
    },

    humidity: {
        type: Number
    },

    lastSeen: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Compound index to optimize the query that finds online devices to mark offline:
// { status: "Online", lastSeen: { $lt: cutoffTime } }
deviceSchema.index({ status: 1, lastSeen: 1 });

module.exports = mongoose.model("Device", deviceSchema);


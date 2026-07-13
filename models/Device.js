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
        enum: ["online", "offline"],
        default: "offline",
        index: true
    },

    led: {
        type: Boolean,
        default: false
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

// Compound index to optimize the query that finds online devices to mark offline
deviceSchema.index({ status: 1, lastSeen: 1 });

module.exports = mongoose.model("Device", deviceSchema);

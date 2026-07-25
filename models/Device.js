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

    tempEnabled: {
        type: Boolean,
        default: true
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

    tempConnected: {
        type: Boolean,
        default: false
    },

    phConnected: {
        type: Boolean,
        default: false
    },

    lastSeen: {
        type: Date,
        default: Date.now,
        index: true
    }
});

deviceSchema.index({ status: 1, lastSeen: 1 });

module.exports = mongoose.model("Device", deviceSchema);

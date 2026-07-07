const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true
    },

    status: {
        type: String,
        enum: ["Online", "Offline"],
        default: "Offline"
    },

    temperature: {
        type: Number
    },

    humidity: {
        type: Number
    },

    lastSeen: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Device", deviceSchema);

const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true
    },

    status: {
        type: String,
        default: "online"
    },

    lastSeen: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Device", deviceSchema);

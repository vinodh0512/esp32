const mongoose = require("mongoose");

const fermentationBatchSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        default: "Yeast Sugar Test"
    },
    deviceId: {
        type: String,
        default: "esp32-1"
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    initialPH: {
        type: Number,
        required: true
    },
    finalPH: {
        type: Number
    },
    initialTemp: {
        type: Number,
        required: true
    },
    maxTemp: {
        type: Number
    },
    status: {
        type: String,
        enum: ["RUNNING", "COMPLETED", "CANCELLED"],
        default: "RUNNING"
    },
    dataPoints: [
        {
            time: { type: Date, default: Date.now },
            pH: Number,
            temperature: Number
        }
    ]
});

module.exports = mongoose.model("FermentationBatch", fermentationBatchSchema);

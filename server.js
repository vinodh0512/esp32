require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const Device = require("./models/Device");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("ESP32 Backend Running");
});

// ESP32 sends online status
app.post("/status", async (req, res) => {

    const { deviceId, status } = req.body;

    const device = await Device.findOneAndUpdate(
        { deviceId },
        {
            status,
            lastSeen: new Date()
        },
        {
            new: true,
            upsert: true
        }
    );

    res.json(device);

});

// React gets latest status
app.get("/status", async (req, res) => {

    const device = await Device.findOne();

    res.json(device);

});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server Running on ${PORT}`);
});

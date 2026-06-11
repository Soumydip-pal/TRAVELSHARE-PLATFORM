const express = require("express");
const Message = require("../models/Message");
const Trip = require("../models/Trip");
const auth = require("../middleware/auth");

const router = express.Router();

// GET /api/chat/:tripId - Get messages for a trip
router.get("/:tripId", auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const isParticipant =
      trip.host.toString() === req.user._id.toString() ||
      trip.passengers.some(
        (p) => p.user.toString() === req.user._id.toString() && p.status === "accepted"
      );

    if (!isParticipant)
      return res.status(403).json({ error: "Not a participant of this trip" });

    const messages = await Message.find({ trip: req.params.tripId })
      .populate("sender", "name profilePhoto")
      .sort({ createdAt: 1 })
      .limit(200);

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/:tripId - Send a message (REST fallback; prefer Socket.IO)
router.post("/:tripId", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Message text required" });

    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const message = await Message.create({
      trip: req.params.tripId,
      sender: req.user._id,
      text: text.trim(),
    });

    await message.populate("sender", "name profilePhoto");
    res.status(201).json({ message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

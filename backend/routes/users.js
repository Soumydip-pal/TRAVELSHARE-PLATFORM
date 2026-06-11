const express = require("express");
const User = require("../models/User");
const Trip = require("../models/Trip");
const Report = require("../models/Report");
const auth = require("../middleware/auth");
const { createNotification } = require("../utils/notifications");

const router = express.Router();

async function applyTrustFeedback(req, res) {
  try {
    const { tripId, completed = true, onTime = true, complaint = false } = req.body;
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target._id.toString() === req.user._id.toString()) return res.status(400).json({ error: "Cannot score yourself" });

    if (tripId) {
      const trip = await Trip.findById(tripId);
      const participated = trip && (
        trip.host.toString() === req.params.id ||
        trip.passengers.some((p) => p.user.toString() === req.params.id && p.status === "accepted")
      );
      if (!participated) return res.status(403).json({ error: "Trust feedback is limited to co-travelers" });
    }

    if (completed) target.rideStats.completed += 1;
    else target.rideStats.cancelled += 1;
    if (onTime) target.rideStats.onTime += 1;
    else target.rideStats.late += 1;
    if (complaint) target.rideStats.complaints += 1;
    target.recalculateTrustScore();
    await target.save();

    res.json({ message: "Trust feedback recorded", trustScore: target.trustScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/users/:id/trust-event - submit post-trip accountability feedback
router.post("/:id/trust-event", auth, applyTrustFeedback);

// Backward-compatible route: converts legacy feedback submissions into trust events.
router.post("/:id/rate", auth, async (req, res) => {
  req.body.completed = true;
  req.body.onTime = Number(req.body.rating || 5) >= 4;
  req.body.complaint = Number(req.body.rating || 5) <= 2;
  return applyTrustFeedback(req, res);
});

router.post("/:id/report", auth, async (req, res) => {
  try {
    const { reason, tripId } = req.body;
    if (!reason) return res.status(400).json({ error: "Reason required" });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });
    target.rideStats.complaints += 1;
    target.recalculateTrustScore();
    await target.save();
    await Report.create({
      reporter: req.user._id,
      target: target._id,
      trip: tripId,
      reason,
      severity: reason.toLowerCase().includes("unsafe") || reason.toLowerCase().includes("sos") ? "high" : "medium",
    });

    await createNotification({
      io: req.app.get("io"),
      userId: target._id,
      type: "safety",
      title: "Safety report received",
      message: "A trip safety report has been logged for review.",
      data: { tripId, reason },
    });

    res.json({ message: "Report submitted. Our team will review it.", trustScore: target.trustScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/public", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("name gender trustScore rideMood city profilePhoto createdAt");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

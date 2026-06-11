const express = require("express");
const Trip = require("../models/Trip");
const User = require("../models/User");
const Report = require("../models/Report");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(auth, requireRole("admin"));

router.get("/summary", async (req, res) => {
  try {
    const [totalTrips, activeTrips, cancelledTrips, users, openReports, unreadNotifications] = await Promise.all([
      Trip.countDocuments(),
      Trip.countDocuments({ status: "active" }),
      Trip.countDocuments({ status: "cancelled" }),
      User.countDocuments(),
      Report.countDocuments({ status: { $in: ["open", "reviewing"] } }),
      Notification.countDocuments({ readAt: null }),
    ]);

    res.json({
      totalTrips,
      activeTrips,
      cancelledTrips,
      users,
      openReports,
      unreadNotifications,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/reports", async (req, res) => {
  try {
    const reports = await Report.find()
      .populate("reporter", "name email trustScore")
      .populate("target", "name email trustScore")
      .populate("trip", "origin destination departureTime status")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/reports/:id", async (req, res) => {
  try {
    const { status, severity } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, severity },
      { new: true, runValidators: true }
    );
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

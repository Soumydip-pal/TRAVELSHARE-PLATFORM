const express = require("express");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");

const router = express.Router();

// GET /api/notifications — fetch last 30 for the current user
router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);
    const unread = await Notification.countDocuments({ user: req.user._id, readAt: null });
    res.json({ notifications, unread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read — mark one as read and broadcast via socket
router.put("/:id/read", auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: "Notification not found" });

    // Real-time: update unread badge on all open tabs for this user
    req.app.get("io")
      ?.to(`user_${req.user._id}`)
      .emit("notification_read", { _id: notification._id });

    res.json({ notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/read-all — mark all as read and broadcast updated count
router.put("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, readAt: null }, { readAt: new Date() });

    // Real-time: clear badge across all open tabs
    req.app.get("io")
      ?.to(`user_${req.user._id}`)
      .emit("notifications_cleared");

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id — remove a single notification
router.delete("/:id", auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!notification) return res.status(404).json({ error: "Notification not found" });

    req.app.get("io")
      ?.to(`user_${req.user._id}`)
      .emit("notification_deleted", { _id: req.params.id });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications — clear all notifications for the user
router.delete("/", auth, async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    req.app.get("io")?.to(`user_${req.user._id}`).emit("notifications_cleared");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

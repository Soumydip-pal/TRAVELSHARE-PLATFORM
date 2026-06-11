const Notification = require("../models/Notification");

async function createNotification({ io, userId, type = "system", title, message = "", data = {} }) {
  const notification = await Notification.create({ user: userId, type, title, message, data });
  io?.to(`user_${userId}`).emit("notification", notification);
  return notification;
}

module.exports = { createNotification };

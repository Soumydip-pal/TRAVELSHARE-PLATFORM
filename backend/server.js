require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const authRoutes  = require("./routes/auth");
const tripRoutes  = require("./routes/trips");
const chatRoutes  = require("./routes/chat");
const userRoutes  = require("./routes/users");
const notificationRoutes = require("./routes/notifications");
const adminRoutes = require("./routes/admin");
const { authLimiter, apiLimiter, sanitizeBody, requestLogger } = require("./middleware/security");
const { notFoundHandler, globalErrorHandler } = require("./middleware/errorHandler");
const Message     = require("./models/Message");
const authMiddleware = require("./middleware/auth");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const { startSwtarsWorker } = require("./utils/swtars");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json());
app.use(sanitizeBody);
app.use(requestLogger);

// ── Routes ───────────────────────────────────────────────────
app.use("/api/auth",  authLimiter, authRoutes);
app.use("/api/trips", apiLimiter,  tripRoutes);
app.use("/api/chat",  apiLimiter,  chatRoutes);
app.use("/api/users", apiLimiter,  userRoutes);
app.use("/api/notifications", apiLimiter, notificationRoutes);
app.use("/api/admin", apiLimiter, adminRoutes);

app.get("/api/health", (req, res) =>
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    env: process.env.NODE_ENV || "development",
  })
);

// ── Socket.IO - Real-time Chat ───────────────────────────────
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) return next(new Error("User not found"));
    socket.user = user;
    next();
  } catch {
    next(new Error("Auth error"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user_${socket.user._id}`);
  if (socket.user.city) socket.join(`city_${socket.user.city}`);

  // Join trip chat room
  socket.on("join_trip", (tripId) => {
    socket.join(`trip_${tripId}`);
  });

  // Send chat message
  socket.on("send_message", async ({ tripId, text }) => {
    try {
      if (!text?.trim()) return;
      const msg = await Message.create({
        trip: tripId,
        sender: socket.user._id,
        text: text.trim(),
      });
      await msg.populate("sender", "name profilePhoto");

      io.to(`trip_${tripId}`).emit("new_message", {
        _id: msg._id,
        trip: tripId,
        sender: { _id: socket.user._id, name: socket.user.name, profilePhoto: socket.user.profilePhoto },
        text: msg.text,
        createdAt: msg.createdAt,
      });
    } catch (err) {
      socket.emit("error", { message: err.message });
    }
  });

  // Live location update
  socket.on("location_update", ({ tripId, lat, lng }) => {
    socket.to(`trip_${tripId}`).emit("partner_location", {
      userId: socket.user._id,
      name: socket.user.name,
      lat, lng,
    });
    socket.to(`trip_${tripId}`).emit("ride_update", {
      type: "location",
      tripId,
      userId: socket.user._id,
      lat,
      lng,
      at: new Date().toISOString(),
    });
  });

  // Trip match notification (broadcast to all in city room)
  socket.on("join_city", (city) => {
    socket.join(`city_${city}`);
  });

  // ── Live Match Watching ───────────────────────────────────────────────────
  // Client calls join_match_watch when the user opens Smart Match panel.
  // The server emits match_suggestion events when new trips appear in the city.
  socket.on("join_match_watch", ({ city }) => {
    socket.join(`match_watch_${city}`);
  });

  socket.on("leave_match_watch", ({ city }) => {
    socket.leave(`match_watch_${city}`);
  });

  socket.on("status_update", ({ tripId, status }) => {
    socket.to(`trip_${tripId}`).emit("ride_update", {
      type: "status",
      tripId,
      userId: socket.user._id,
      status,
      at: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {});
});

// Expose io for routes
app.set("io", io);
// ── Error Handlers (must be last middleware) ─────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);


// ── DB + Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGODB_URI || "mongodb://localhost:27017/travelshare";

mongoose
  .connect(MONGO)
  .then(() => {
    console.log("MongoDB connected");
    startSwtarsWorker(io);
    server.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });

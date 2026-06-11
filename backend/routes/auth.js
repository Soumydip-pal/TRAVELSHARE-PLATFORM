const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

const signToken = (userId) =>
  jwt.sign({ userId, type: "access" }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "15m" });

const signRefreshToken = (userId) =>
  jwt.sign({ userId, type: "refresh" }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" });

const tokenPayload = (user) => ({
  token: signToken(user._id),
  refreshToken: signRefreshToken(user._id),
  user: user.toPublic(),
});

// POST /api/auth/register
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("phone").notEmpty().withMessage("Phone is required"),
    body("password")
      .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
      .matches(/[A-Za-z]/).withMessage("Password must include a letter")
      .matches(/\d/).withMessage("Password must include a number"),
    body("gender").isIn(["Male", "Female", "Other"]).withMessage("Gender required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const { name, email, phone, password, gender, city, rideMood } = req.body;

      const existing = await User.findOne({ email });
      if (existing)
        return res.status(409).json({ error: "Email already registered" });

      const user = await User.create({ name, email, phone, password, gender, city, rideMood });
      res.status(201).json(tokenPayload(user));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/auth/login
router.post(
  "/login",
  [
    body("email").isEmail(),
    body("password").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user || !(await user.comparePassword(password)))
        return res.status(401).json({ error: "Invalid credentials" });

      res.json(tokenPayload(user));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/auth/me
router.get("/me", auth, (req, res) => {
  res.json({ user: req.user });
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: "Refresh token required" });
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    if (decoded.type !== "refresh") return res.status(401).json({ error: "Invalid refresh token" });
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json(tokenPayload(user));
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Valid email required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const user = await User.findOne({ email: req.body.email.toLowerCase() });
      if (user) {
        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });
        console.log(`[PASSWORD_RESET] ${user.email}: ${process.env.CLIENT_URL || "http://localhost:3000"}/reset-password/${resetToken}`);
      }
      res.json({ message: "If the email exists, reset instructions have been sent." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  "/reset-password/:token",
  [
    body("password")
      .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
      .matches(/[A-Za-z]/).withMessage("Password must include a letter")
      .matches(/\d/).withMessage("Password must include a number"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      });
      if (!user) return res.status(400).json({ error: "Reset link is invalid or expired" });
      user.password = req.body.password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      res.json(tokenPayload(user));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post("/social-login", async (req, res) => {
  const { provider } = req.body;
  if (!["google", "github"].includes(provider)) {
    return res.status(400).json({ error: "Unsupported social provider" });
  }
  return res.status(501).json({
    error: `${provider} login requires OAuth client credentials in production.`,
    provider,
    requiredEnv: provider === "google" ? ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] : ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  });
});

// PUT /api/auth/profile
router.put("/profile", auth, async (req, res) => {
  try {
    const { name, phone, city, emergencyContact, trustedContacts, rideMood } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, city, emergencyContact, trustedContacts, rideMood },
      { new: true, runValidators: true }
    ).select("-password");
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

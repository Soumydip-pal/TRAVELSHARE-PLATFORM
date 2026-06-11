const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
  role: { type: String, enum: ["rider", "driver", "admin"], default: "rider" },
  profilePhoto: { type: String, default: "" },
  trustScore: {
    score: { type: Number, default: 82, min: 0, max: 100 },
    rideCompletion: { type: Number, default: 1, min: 0, max: 1 },
    cancellationRate: { type: Number, default: 0, min: 0, max: 1 },
    complaints: { type: Number, default: 0, min: 0 },
    onTimeRate: { type: Number, default: 1, min: 0, max: 1 },
    safeDriving: { type: Number, default: 1, min: 0, max: 1 },
    lastCalculatedAt: { type: Date, default: Date.now },
  },
  rideStats: {
    completed: { type: Number, default: 0 },
    cancelled: { type: Number, default: 0 },
    complaints: { type: Number, default: 0 },
    onTime: { type: Number, default: 0 },
    late: { type: Number, default: 0 },
  },
  isVerified: { type: Boolean, default: false },
  emergencyContact: {
    name: String,
    phone: String,
  },
  trustedContacts: [{
    name: String,
    phone: String,
    relation: String,
  }],
  wallet: {
    balance: { type: Number, default: 0, min: 0 },
    compensationCredits: { type: Number, default: 0, min: 0 },
    transactions: [{
      amount: Number,
      type: { type: String, enum: ["credit", "debit", "penalty", "compensation"] },
      reason: String,
      createdAt: { type: Date, default: Date.now },
    }],
  },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Trip" }],
  recentlyViewed: [{
    trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    viewedAt: { type: Date, default: Date.now },
  }],
  rideMood: {
    conversation: { type: String, enum: ["quiet", "friendly", "any"], default: "any" },
    music: { type: String, enum: ["none", "low", "any"], default: "any" },
    ac: { type: String, enum: ["on", "off", "any"], default: "any" },
    safeDriving: { type: Boolean, default: true },
  },
  city: { type: String, default: "Kolkata" },
  passwordResetToken: String,
  passwordResetExpires: Date,
  createdAt: { type: Date, default: Date.now },
});

userSchema.methods.recalculateTrustScore = function () {
  const completed = this.rideStats?.completed || 0;
  const cancelled = this.rideStats?.cancelled || 0;
  const total = Math.max(1, completed + cancelled);
  const onTimeTotal = Math.max(1, (this.rideStats?.onTime || 0) + (this.rideStats?.late || 0));
  const cancellationRate = cancelled / total;
  const complaints = this.rideStats?.complaints || 0;
  const rideCompletion = completed / total;
  const onTimeRate = (this.rideStats?.onTime || 0) / onTimeTotal;
  const safeDriving = complaints === 0 ? 1 : Math.max(0, 1 - complaints / Math.max(3, completed));

  const score = Math.round(
    100 * (
      0.34 * rideCompletion +
      0.24 * (1 - cancellationRate) +
      0.18 * Math.max(0, 1 - complaints / 5) +
      0.14 * onTimeRate +
      0.10 * safeDriving
    )
  );

  this.trustScore = {
    score: Math.max(0, Math.min(100, score)),
    rideCompletion,
    cancellationRate,
    complaints,
    onTimeRate,
    safeDriving,
    lastCalculatedAt: new Date(),
  };
  return this.trustScore;
};

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

userSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  this.passwordResetExpires = Date.now() + 30 * 60 * 1000;
  return rawToken;
};

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ city: 1, role: 1 });

module.exports = mongoose.model("User", userSchema);

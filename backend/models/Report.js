const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  target: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, enum: ["open", "reviewing", "resolved", "dismissed"], default: "open" },
  severity: { type: String, enum: ["low", "medium", "high"], default: "medium" },
}, { timestamps: true });

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ target: 1, createdAt: -1 });

module.exports = mongoose.model("Report", reportSchema);

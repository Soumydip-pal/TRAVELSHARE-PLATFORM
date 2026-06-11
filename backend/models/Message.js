const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

messageSchema.index({ trip: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);

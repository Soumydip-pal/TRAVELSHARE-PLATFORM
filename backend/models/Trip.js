const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  address: { type: String, default: "" },
  geo: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: undefined },
  },
});

const tripSchema = new mongoose.Schema({
  host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, trim: true, maxlength: 120, default: "" },
  description: { type: String, trim: true, maxlength: 800, default: "" },
  visibility: { type: String, enum: ["public", "private"], default: "public" },
  shareToken: { type: String, index: true },
  
  // Trip type
  tripType: {
    type: String,
    enum: ["live", "need_partner", "scheduled"],
    required: true,
  },
  
  // Locations
  origin: { type: locationSchema, required: true },
  destination: { type: locationSchema, required: true },
  itinerary: [{
    time: String,
    title: { type: String, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 240 },
  }],
  images: [{
    url: { type: String, trim: true },
    alt: { type: String, trim: true, maxlength: 120 },
  }],
  tags: [{ type: String, trim: true, lowercase: true }],
  routeLine: {
    type: { type: String, enum: ["LineString"], default: "LineString" },
    coordinates: { type: [[Number]], default: undefined },
  },
  
  // Time
  departureTime: { type: Date, required: true },
  
  // Capacity
  totalSeats: { type: Number, default: 3, min: 1, max: 6 },
  availableSeats: { type: Number, default: 3 },
  
  // Passengers
  passengers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    joinedAt: { type: Date, default: Date.now },
    waitingStartedAt: Date,
    autoCancelAt: Date,
  }],
  
  // Fare (for live trips where fare is known)
  actualFare: { type: Number },
  
  // ML Predicted fare (for scheduled trips)
  predictedFare: {
    lower: Number,
    median: Number,
    upper: Number,
    perPerson: Number,
    surge: Number,
    modelUsed: String,
  },
  
  // Preferences
  genderPreference: { type: String, enum: ["Any", "Male", "Female"], default: "Any" },
  rideMood: {
    conversation: { type: String, enum: ["quiet", "friendly", "any"], default: "any" },
    music: { type: String, enum: ["none", "low", "any"], default: "any" },
    ac: { type: String, enum: ["on", "off", "any"], default: "any" },
    safeDriving: { type: Boolean, default: true },
  },
  safety: {
    comfortMode: { type: Boolean, default: false },
    routeSharingEnabled: { type: Boolean, default: true },
    sosActivatedAt: Date,
    sosResolvedAt: Date,
    lastSharedLocation: {
      lat: Number,
      lng: Number,
      sharedAt: Date,
    },
  },
  dacs: {
    driverPenalty: { type: Number, default: 0, min: 0 },
    passengerCompensation: { type: Number, default: 0, min: 0 },
    reassignmentStatus: {
      type: String,
      enum: ["none", "queued", "reassigned", "failed"],
      default: "none",
    },
  },
  swtars: {
    waitingTimerMin: { type: Number, default: 10, min: 1, max: 45 },
    autoCancellationEnabled: { type: Boolean, default: true },
    autoRebookingEnabled: { type: Boolean, default: true },
  },
  analytics: {
    routeOverlapScore: Number,
    moodCompatibilityScore: Number,
    matchAlertCount: { type: Number, default: 0 },
    cancellationReason: String,
    completedAt: Date,
  },
  comments: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  }],
  reviews: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, trim: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  }],
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  
  // City
  city: { type: String, default: "Kolkata" },
  
  // Status
  status: {
    type: String,
    enum: ["active", "full", "completed", "cancelled"],
    default: "active",
  },
  
  // Trip distance/duration (estimated)
  distanceKm: Number,
  durationMin: Number,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update updatedAt on save
tripSchema.pre("save", function (next) {
  if (this.origin?.lat && this.origin?.lng) {
    this.origin.geo = { type: "Point", coordinates: [this.origin.lng, this.origin.lat] };
  }
  if (this.destination?.lat && this.destination?.lng) {
    this.destination.geo = { type: "Point", coordinates: [this.destination.lng, this.destination.lat] };
  }
  if (!this.shareToken) {
    this.shareToken = new mongoose.Types.ObjectId().toString();
  }
  if (Array.isArray(this.reviews) && this.reviews.length) {
    const total = this.reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    this.averageRating = Math.round((total / this.reviews.length) * 10) / 10;
  }
  this.updatedAt = Date.now();
  next();
});

tripSchema.index({ "origin.lat": 1, "origin.lng": 1 });
tripSchema.index({ "origin.geo": "2dsphere" });
tripSchema.index({ "destination.geo": "2dsphere" });
tripSchema.index({ routeLine: "2dsphere" });
tripSchema.index({ status: 1, departureTime: 1 });
tripSchema.index({ tripType: 1, city: 1, status: 1 });
tripSchema.index({ city: 1, status: 1, availableSeats: 1, departureTime: 1 });
tripSchema.index({ title: "text", description: "text", city: "text", tags: "text" });
tripSchema.index({ visibility: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Trip", tripSchema);

const express = require("express");
const axios = require("axios");
const { body } = require("express-validator");
const Trip = require("../models/Trip");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { validateRequest } = require("../middleware/validate");
const {
  findTopMatches, calculateCostSplit, haversine,
  suggestPickupPoint, clusterPassengers, optimizePickupOrder, routeSimilarity,
} = require("../utils/matching");
const { estimateFareRange } = require("../utils/fare");
const { queueTripEmail } = require("../utils/email");
const { createNotification } = require("../utils/notifications");
const { getTripFareSummary, attachTripSummary, attachTripSummaries } = require("../utils/tripSummary");

const router = express.Router();
const ML_API = process.env.ML_API_URL || "http://localhost:5001";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cityFilter = (city) => new RegExp(`^${escapeRegex(String(city).trim())}$`, "i");
const normalizeCity = (city, fallback = "Kolkata") => String(city || fallback).trim();
const getParticipantIds = (trip) => {
  const ids = [trip.host];
  (trip.passengers || []).forEach((p) => {
    if (p.status === "accepted" && p.user) ids.push(p.user);
  });
  return [...new Set(ids.map((id) => id?.toString()).filter(Boolean))];
};

async function notifyTripParticipants({ io, trip, type = "trip", title, message, exclude = [] }) {
  const excluded = new Set(exclude.map((id) => id?.toString()));
  const ids = getParticipantIds(trip).filter((id) => !excluded.has(id));
  await Promise.all(ids.map((userId) => createNotification({
    io,
    userId,
    type,
    title,
    message,
    data: { tripId: trip._id },
  })));
}

const locationValidators = (prefix) => [
  body(`${prefix}.lat`).isFloat({ min: -90, max: 90 }).withMessage(`${prefix} latitude must be valid`),
  body(`${prefix}.lng`).isFloat({ min: -180, max: 180 }).withMessage(`${prefix} longitude must be valid`),
  body(`${prefix}.address`).optional({ nullable: true }).isString().isLength({ max: 240 }).withMessage(`${prefix} address is too long`),
];

const rideMoodValidators = [
  body("rideMood.conversation").optional().isIn(["quiet", "friendly", "any"]).withMessage("Invalid ride mood"),
  body("rideMood.music").optional().isIn(["none", "low", "any"]).withMessage("Invalid music preference"),
  body("rideMood.ac").optional().isIn(["on", "off", "any"]).withMessage("Invalid AC preference"),
  body("rideMood.safeDriving").optional().isBoolean().withMessage("Safe driving must be true or false"),
];

// POST /api/trips - Create a new trip
router.post("/", auth, [
  body("tripType").isIn(["live", "need_partner", "scheduled"]).withMessage("Invalid trip type"),
  body("departureTime").isISO8601().withMessage("Valid departure time required"),
  body("totalSeats").optional().isInt({ min: 1, max: 6 }).withMessage("Seats must be between 1 and 6"),
  body("genderPreference").optional().isIn(["Any", "Male", "Female"]).withMessage("Invalid gender preference"),
  body("actualFare").optional({ nullable: true }).isFloat({ min: 1 }).withMessage("Fare must be positive"),
  body("city").optional().isString().isLength({ min: 2, max: 40 }).withMessage("Invalid city"),
  ...locationValidators("origin"),
  ...locationValidators("destination"),
  ...rideMoodValidators,
  validateRequest,
], async (req, res) => {
  try {
    const {
      title, description, visibility, images, itinerary, tags,
      tripType, origin, destination, routeLine, departureTime,
      totalSeats, genderPreference, actualFare, city, rideMood,
      distanceKm, durationMin,
    } = req.body;

    let predictedFare = null;

    // Call ML API for scheduled trips
    const resolvedDistanceKm = distanceKm || Math.round((haversine(origin, destination) / 1000) * 10) / 10;
    const resolvedDurationMin = durationMin || Math.max(5, Math.round(resolvedDistanceKm * 3));

    // Request ML fare prediction for ALL trip types that have a route
    if (resolvedDistanceKm) {
      const tripCity    = normalizeCity(city, req.user.city || "Kolkata");
      const depDate     = new Date(departureTime);
      const hour        = depDate.getHours();
      const dow         = depDate.getDay();
      const passengers  = totalSeats || 2;

      try {
        const mlRes = await axios.post(`${ML_API}/predict`, {
          city:           tripCity,
          distance_km:    resolvedDistanceKm,
          duration_min:   resolvedDurationMin,
          departure_hour: hour,
          day_of_week:    dow,
          traffic_index:  1.2,
          passengers,
        }, { timeout: 6000 });

        const d = mlRes.data;
        // Validate required fields exist in response
        if (d.median_fare && d.lower_fare && d.upper_fare) {
          predictedFare = {
            lower:     d.lower_fare,
            median:    d.median_fare,
            upper:     d.upper_fare,
            perPerson: d.per_person_estimate || Math.ceil(d.median_fare / passengers),
            modelUsed: d.model_used || "gradient_boosting",
          };
        } else {
          throw new Error("Invalid ML response shape");
        }
      } catch (mlErr) {
        // Graceful fallback — rule-based estimate
        predictedFare = estimateFareRange({
          city:           tripCity,
          distanceKm:     resolvedDistanceKm,
          durationMin:    resolvedDurationMin,
          departureTime,
          trafficIndex:   1.2,
          passengers,
        });
        console.warn(`[ML] Fallback for ${tripCity} ${resolvedDistanceKm}km: ${mlErr.message}`);
      }
    }

    const trip = await Trip.create({
      host: req.user._id,
      title,
      description,
      visibility: visibility || "public",
      images,
      itinerary,
      tags,
      tripType,
      origin,
      destination,
      routeLine,
      departureTime: new Date(departureTime),
      totalSeats: totalSeats || 3,
      availableSeats: totalSeats || 3,
      genderPreference: genderPreference || "Any",
      rideMood: rideMood || req.user.rideMood,
      actualFare,
      predictedFare,
      city: normalizeCity(city, req.user.city || "Kolkata"),
      distanceKm: resolvedDistanceKm,
      durationMin: resolvedDurationMin,
    });

    await trip.populate("host", "name gender trustScore profilePhoto");
    const io = req.app.get("io");
    io?.to(`city_${trip.city}`).emit("trip_created", { trip });
    io?.to(`city_${trip.city}`).emit("ride_update", { type: "trip_created", tripId: trip._id });

    User.find({
      _id: { $ne: req.user._id },
      city: cityFilter(trip.city),
    }).select("_id").limit(50).then((users) => Promise.all(users.map((u) => createNotification({
      io,
      userId: u._id,
      type: "match",
      title: "New route match nearby",
      message: `${req.user.name} posted a ${trip.city} trip that may match your route.`,
      data: { tripId: trip._id, city: trip.city },
    })))).catch((err) => console.warn(`[Notifications] route match failed: ${err.message}`));

    // ── Live Match Suggestions ────────────────────────────────────────────────
    // Emit a match_suggestion event to all users subscribed to match-watching
    // in this city so the UI can show a "New compatible ride appeared!" banner.
    // Payload includes the new trip's key fields so the client can evaluate
    // compatibility before making a full /matches API call.
    io?.to(`match_watch_${trip.city}`).emit("match_suggestion", {
      type: "new_trip",
      tripId: trip._id,
      trip: {
        _id: trip._id,
        tripType: trip.tripType,
        origin: trip.origin,
        destination: trip.destination,
        departureTime: trip.departureTime,
        genderPreference: trip.genderPreference,
        availableSeats: trip.availableSeats,
        city: trip.city,
        host: { name: trip.host?.name, trustScore: trip.host?.trustScore },
      },
      at: new Date().toISOString(),
    });
    if (tripType === "scheduled") {
      await queueTripEmail({
        to: req.user.email,
        subject: "TravelShare scheduled trip confirmed",
        text: `Your scheduled trip from ${origin.address} to ${destination.address} is confirmed.`,
      });
    }
    res.status(201).json({ trip: attachTripSummary(trip) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trips - List active trips with optional filters
router.get("/", auth, async (req, res) => {
  try {
    const {
      city, tripType, gender, seats, maxFare, mood, ac, upcomingOnly = "true",
      q, sort = "departureTime", page = 1, limit = 20, visibility,
    } = req.query;
    const filter = { status: "active", $or: [{ visibility: "public" }, { host: req.user._id }, { "passengers.user": req.user._id }] };
    if (city) filter.city = cityFilter(city);
    if (tripType) filter.tripType = tripType;
    if (visibility && visibility !== "all") filter.visibility = visibility;
    if (gender && gender !== "Any") filter.genderPreference = { $in: ["Any", gender] };
    if (mood && mood !== "any") filter["rideMood.conversation"] = { $in: ["any", mood] };
    if (ac && ac !== "any") filter["rideMood.ac"] = { $in: ["any", ac] };
    if (upcomingOnly !== "false") filter.departureTime = { $gte: new Date() };

    if (q?.trim()) filter.$text = { $search: q.trim() };

    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);
    const sortMap = {
      departureTime: { departureTime: 1 },
      newest: { createdAt: -1 },
      seats: { availableSeats: -1 },
      fare: { "predictedFare.median": 1, actualFare: 1 },
      rating: { averageRating: -1 },
    };

    let trips = await Trip.find(filter)
      .populate("host", "name gender trustScore rideMood profilePhoto phone")
      .sort(sortMap[sort] || sortMap.departureTime)
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit);

    const total = await Trip.countDocuments(filter);

    const minSeats = Math.max(1, Number(seats) || 1);
    trips = trips.filter((trip) => trip.availableSeats >= minSeats);

    if (maxFare) {
      const fareLimit = Number(maxFare);
      trips = trips.filter((trip) => {
        const fare = trip.actualFare || trip.predictedFare?.median || trip.predictedFare?.upper || 0;
        return fare > 0 && fare <= fareLimit;
      });
    }

    res.json({ trips: attachTripSummaries(trips), pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trips/matches - Smart ride matching with pickup suggestions & clustering
router.post("/matches", auth, [
  body("departureTime").isISO8601().withMessage("Valid departure time required"),
  body("genderPreference").optional().isIn(["Any", "Male", "Female"]).withMessage("Invalid gender preference"),
  body("seats").optional().isInt({ min: 1, max: 6 }).withMessage("Seats must be between 1 and 6"),
  ...locationValidators("origin"),
  ...locationValidators("destination"),
  ...rideMoodValidators,
  validateRequest,
], async (req, res) => {
  try {
    const { origin, destination, routeLine, departureTime, genderPreference, seats, rideMood, city } = req.body;

    const filter = {
      status: "active",
      availableSeats: { $gte: Math.max(1, Number(seats) || 1) },
      $or: [{ visibility: "public" }, { host: req.user._id }],
    };
    if (genderPreference && genderPreference !== "Any") {
      filter.genderPreference = { $in: ["Any", genderPreference] };
    }
    if (city) filter.city = cityFilter(city);

    const allTrips = await Trip.find(filter)
      .populate("host", "name gender trustScore rideMood profilePhoto phone city");

    const requestTrip = {
      origin,
      destination,
      routeLine,
      departureTime,
      userGender: req.user.gender,
      rideMood: rideMood || req.user.rideMood,
      city: city || req.user.city,
    };

    // Core matches with scores
    const matches = findTopMatches(requestTrip, allTrips, 10).map((m) => {
      // Attach smart pickup suggestion for each match
      const pickupSuggestion = suggestPickupPoint(
        { origin, destination, host: req.user },
        { origin: m.trip.origin, destination: m.trip.destination, host: m.trip.host }
      );
      return { ...m, pickupSuggestion };
    });

    // Passenger clustering — find groups of nearby requests
    const nearbySimilar = allTrips.filter((t) => {
      const dist = haversine(origin, t.origin);
      return dist <= 3000 && t.status === "active";
    });
    const clusters = clusterPassengers(nearbySimilar);
    const clusterSummary = clusters.map((cl) => ({
      centroid: cl.centroid,
      count: cl.members.length,
      memberIds: cl.members.map((t) => t._id),
    }));

    // Route similarity groups (for auto-pooling suggestions)
    const similarRouteGroups = [];
    const checked = new Set();
    for (let i = 0; i < matches.length; i++) {
      if (checked.has(i)) continue;
      const group = [matches[i]];
      for (let j = i + 1; j < matches.length; j++) {
        const sim = routeSimilarity(matches[i].trip, matches[j].trip);
        if (sim >= 0.65) { group.push(matches[j]); checked.add(j); }
      }
      if (group.length > 1) similarRouteGroups.push({ similarity: group[0].overlapScore, trips: group.map((g) => g.trip._id) });
      checked.add(i);
    }

    res.json({
      matches: matches.map((m) => ({ ...m, trip: attachTripSummary(m.trip) })),
      totalCandidates: allTrips.length,
      clusterSummary,
      similarRouteGroups,
      meta: {
        origin,
        destination,
        requestedAt: new Date().toISOString(),
        distanceKm: Math.round(haversine(origin, destination) / 100) / 10,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trips/:id/optimize-pickups - Driver pickup route optimization
router.get("/:id/optimize-pickups", auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate("passengers.user", "name gender trustScore profilePhoto");
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    if (trip.host.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Only the driver can view pickup optimization" });

    const accepted = trip.passengers.filter((p) => p.status === "accepted");
    // We can only optimize if we have destination info stored per-passenger
    // For now, use the trip destination as shared; real version would use per-passenger data
    const passengerTrips = accepted.map((p) => ({
      origin: trip.origin, // placeholder — use per-passenger origin if stored
      destination: trip.destination,
      user: p.user,
    }));

    const { order, totalDetourM } = optimizePickupOrder(
      { origin: trip.origin, destination: trip.destination },
      passengerTrips
    );

    res.json({ optimizedOrder: order, totalDetourM, passengerCount: accepted.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trips/user/my - Get current user's trips
router.get("/user/my", auth, async (req, res) => {
  try {
    const hosted = await Trip.find({ host: req.user._id })
      .populate("passengers.user", "name gender trustScore")
      .sort({ createdAt: -1 });

    const joined = await Trip.find({
      "passengers.user": req.user._id,
    }).populate("host", "name gender trustScore profilePhoto").sort({ createdAt: -1 });

    res.json({ hosted: attachTripSummaries(hosted), joined: attachTripSummaries(joined) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/trips/:id - Update a hosted trip
router.put("/:id", auth, [
  body("departureTime").optional().isISO8601().withMessage("Valid departure time required"),
  body("totalSeats").optional().isInt({ min: 1, max: 6 }).withMessage("Seats must be between 1 and 6"),
  body("genderPreference").optional().isIn(["Any", "Male", "Female"]).withMessage("Invalid gender preference"),
  body("actualFare").optional({ nullable: true }).isFloat({ min: 1 }).withMessage("Fare must be positive"),
  body("city").optional().isString().isLength({ min: 2, max: 40 }).withMessage("Invalid city"),
  ...rideMoodValidators,
  validateRequest,
], async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    if (trip.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Only host can update this trip" });
    }
    if (["completed", "cancelled"].includes(trip.status)) {
      return res.status(400).json({ error: "This trip can no longer be updated" });
    }

    const acceptedCount = trip.passengers.filter((p) => p.status === "accepted").length;
    const nextTotalSeats = req.body.totalSeats !== undefined ? Number(req.body.totalSeats) : trip.totalSeats;
    if (nextTotalSeats < acceptedCount) {
      return res.status(400).json({ error: "Seats cannot be less than accepted passengers" });
    }

    const editable = ["title", "description", "visibility", "images", "itinerary", "tags", "genderPreference", "actualFare"];
    editable.forEach((key) => {
      if (req.body[key] !== undefined) trip[key] = req.body[key];
    });
    if (req.body.city !== undefined) trip.city = normalizeCity(req.body.city);
    if (req.body.departureTime !== undefined) trip.departureTime = new Date(req.body.departureTime);
    if (req.body.rideMood !== undefined) trip.rideMood = { ...trip.rideMood, ...req.body.rideMood };
    if (req.body.totalSeats !== undefined) {
      trip.totalSeats = nextTotalSeats;
      trip.availableSeats = Math.max(0, nextTotalSeats - acceptedCount);
      if (trip.status === "full" && trip.availableSeats > 0) trip.status = "active";
      if (trip.availableSeats === 0) trip.status = "full";
    }

    await trip.save();
    await trip.populate("host", "name gender trustScore rideMood profilePhoto phone");
    await trip.populate("host", "name gender trustScore rideMood profilePhoto phone");
    await trip.populate("passengers.user", "name gender trustScore profilePhoto");

    const io = req.app.get("io");
    const payload = { type: "trip_updated", tripId: trip._id, trip: attachTripSummary(trip) };
    io?.to(`trip_${trip._id}`).emit("trip_updated", payload);
    io?.to(`city_${trip.city}`).emit("trip_updated", payload);
    io?.to(`city_${trip.city}`).emit("ride_update", { type: "trip_updated", tripId: trip._id });
    await notifyTripParticipants({
      io,
      trip,
      title: "Trip updated",
      message: "A trip you are part of was updated.",
      exclude: [req.user._id],
    });

    res.json({ trip: attachTripSummary(trip) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/trips/:id - Delete a hosted trip
router.delete("/:id", auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    if (trip.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Only host can delete this trip" });
    }

    const io = req.app.get("io");
    await notifyTripParticipants({
      io,
      trip,
      title: "Trip deleted",
      message: "A trip you joined was deleted by the host.",
      exclude: [req.user._id],
    });
    await Trip.deleteOne({ _id: trip._id });

    io?.to(`trip_${trip._id}`).emit("trip_deleted", { tripId: trip._id });
    io?.to(`city_${trip.city}`).emit("trip_deleted", { tripId: trip._id });
    io?.to(`city_${trip.city}`).emit("ride_update", { type: "trip_deleted", tripId: trip._id });
    res.json({ ok: true, message: "Trip deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trips/:id
router.get("/:id", auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate("host", "name gender trustScore rideMood profilePhoto phone emergencyContact")
      .populate("passengers.user", "name gender trustScore profilePhoto");
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    const canView = trip.visibility === "public" ||
      trip.host?._id?.toString() === req.user._id.toString() ||
      trip.passengers?.some((p) => p.user?._id?.toString() === req.user._id.toString());
    if (!canView) return res.status(403).json({ error: "This trip is private" });
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { recentlyViewed: { trip: trip._id } },
    });
    await User.findByIdAndUpdate(req.user._id, {
      $push: { recentlyViewed: { $each: [{ trip: trip._id, viewedAt: new Date() }], $position: 0, $slice: 12 } },
    });
    res.json({ trip: attachTripSummary(trip) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/favorite", auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { favorites: trip._id } });
    res.json({ message: "Trip saved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id/favorite", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $pull: { favorites: req.params.id } });
    res.json({ message: "Trip removed from favorites" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/user/saved", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({ path: "favorites", populate: { path: "host", select: "name gender trustScore profilePhoto" } })
      .populate({ path: "recentlyViewed.trip", populate: { path: "host", select: "name gender trustScore profilePhoto" } });
    res.json({
      favorites: user.favorites || [],
      recentlyViewed: (user.recentlyViewed || []).map((item) => item.trip).filter(Boolean),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/comments", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Comment text required" });
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    trip.comments.push({ author: req.user._id, text: text.trim() });
    await trip.save();
    await trip.populate("comments.author", "name trustScore profilePhoto");
    req.app.get("io")?.to(`trip_${trip._id}`).emit("comment_created", { tripId: trip._id });
    res.status(201).json({ comments: trip.comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/reviews", auth, async (req, res) => {
  try {
    const { rating, text } = req.body;
    const safeRating = Number(rating);
    if (!safeRating || safeRating < 1 || safeRating > 5) return res.status(400).json({ error: "Rating must be 1-5" });
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    const participated = trip.host.toString() === req.user._id.toString() ||
      trip.passengers.some((p) => p.user.toString() === req.user._id.toString() && p.status === "accepted");
    if (!participated) return res.status(403).json({ error: "Only participants can review this trip" });
    const existing = trip.reviews.find((review) => review.author?.toString() === req.user._id.toString());
    if (existing) {
      existing.rating = safeRating;
      existing.text = text || "";
    } else {
      trip.reviews.push({ author: req.user._id, rating: safeRating, text });
    }
    await trip.save();
    await trip.populate("reviews.author", "name trustScore profilePhoto");
    res.status(201).json({ reviews: trip.reviews, averageRating: trip.averageRating });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trips/:id/join - Request to join a trip
router.post("/:id/join", auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    if (trip.status !== "active") return res.status(400).json({ error: "Trip not available" });
    if (trip.availableSeats <= 0) return res.status(400).json({ error: "No seats available" });
    if (trip.host.toString() === req.user._id.toString())
      return res.status(400).json({ error: "Cannot join your own trip" });

    const alreadyJoined = trip.passengers.some(
      (p) => p.user.toString() === req.user._id.toString()
    );
    if (alreadyJoined) return res.status(400).json({ error: "Already requested to join" });

    const waitingStartedAt = new Date();
    const autoCancelAt = new Date(waitingStartedAt.getTime() + (trip.swtars?.waitingTimerMin || 10) * 60000);
    trip.passengers.push({ user: req.user._id, status: "pending", waitingStartedAt, autoCancelAt });
    await trip.save();

    await trip.populate("host", "name gender trustScore rideMood profilePhoto phone");
    await trip.populate("passengers.user", "name gender trustScore profilePhoto");
    const io = req.app.get("io");
    const joinPayload = { tripId: trip._id, userId: req.user._id, trip: attachTripSummary(trip) };
    io?.to(`trip_${trip._id}`).emit("join_requested", joinPayload);
    io?.to(`user_${trip.host}`).emit("join_requested", joinPayload);
    io?.to(`user_${trip.host}`).emit("ride_update", { type: "join_requested", tripId: trip._id });
    await createNotification({
      io,
      userId: trip.host,
      type: "match",
      title: "New join request",
      message: `${req.user.name} wants to join your trip.`,
      data: { tripId: trip._id, userId: req.user._id },
    });
    if (trip.tripType === "scheduled") {
      await trip.populate("host", "email name");
      await queueTripEmail({
        to: trip.host.email,
        subject: "TravelShare match request",
        text: `${req.user.name} requested to join your scheduled trip.`,
      });
    }
    res.json({ trip: attachTripSummary(trip), message: "Join request sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/trips/:id/passenger/:userId - Accept/reject a passenger
router.put("/:id/passenger/:userId", auth, async (req, res) => {
  try {
    const { action } = req.body; // "accept" | "reject"
    const trip = await Trip.findById(req.params.id);

    if (!trip) return res.status(404).json({ error: "Trip not found" });
    if (trip.host.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Only host can manage passengers" });

    const passenger = trip.passengers.find(
      (p) => p.user.toString() === req.params.userId
    );
    if (!passenger) return res.status(404).json({ error: "Passenger not found" });

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ error: "Action must be accept or reject" });
    }

    const previousStatus = passenger.status;
    passenger.status = action === "accept" ? "accepted" : "rejected";

    if (action === "accept" && previousStatus !== "accepted") {
      if (trip.availableSeats <= 0) return res.status(400).json({ error: "No seats available" });
      trip.availableSeats = Math.max(0, trip.availableSeats - 1);
      if (trip.availableSeats === 0) trip.status = "full";
    } else if (action === "reject" && previousStatus === "accepted") {
      trip.availableSeats = Math.min(trip.totalSeats, trip.availableSeats + 1);
      if (trip.status === "full") trip.status = "active";
    }

    await trip.save();
    await trip.populate("passengers.user", "name gender trustScore profilePhoto");
    const io = req.app.get("io");
    const fareSplit = getTripFareSummary(trip);
    io?.to(`trip_${trip._id}`).emit("passenger_updated", { tripId: trip._id, userId: req.params.userId, action, fareSplit });
    io?.to(`city_${trip.city}`).emit("ride_update", { type: "passenger_updated", tripId: trip._id, fareSplit });
    await createNotification({
      io,
      userId: req.params.userId,
      type: "trip",
      title: action === "accept" ? "Seat confirmed" : "Request declined",
      message: action === "accept" ? "Your ride request was accepted." : "Your ride request was not accepted.",
      data: { tripId: trip._id },
    });
    if (action === "accept") {
      await notifyTripParticipants({
        io,
        trip,
        title: "Fare split updated",
        message: `Your share is now Rs ${fareSplit.perPerson} for this trip.`,
        exclude: [req.params.userId],
      });
    }
    res.json({ trip: attachTripSummary(trip) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /api/trips/:id/cancel - DACS cancellation handling
router.post("/:id/cancel", auth, async (req, res) => {
  try {
    const { reason = "Cancelled by host" } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    if (trip.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Only host can cancel this trip" });
    }

    const acceptedPassengerIds = trip.passengers.filter((p) => p.status === "accepted").map((p) => p.user);
    const compensation = acceptedPassengerIds.length ? Math.max(25, Math.round((trip.actualFare || trip.predictedFare?.median || 100) * 0.08)) : 0;
    trip.status = "cancelled";
    trip.analytics.cancellationReason = reason;
    trip.dacs.driverPenalty = acceptedPassengerIds.length ? compensation * acceptedPassengerIds.length : 0;
    trip.dacs.passengerCompensation = compensation;
    trip.dacs.reassignmentStatus = acceptedPassengerIds.length ? "queued" : "none";
    await trip.save();

    const User = require("../models/User");
    if (acceptedPassengerIds.length) {
      await User.updateMany(
        { _id: { $in: acceptedPassengerIds } },
        {
          $inc: { "wallet.balance": compensation, "wallet.compensationCredits": compensation },
          $push: { "wallet.transactions": { amount: compensation, type: "compensation", reason: `DACS: ${reason}` } },
        }
      );
    }

    req.app.get("io")?.to(`trip_${trip._id}`).emit("ride_update", { type: "trip_cancelled", tripId: trip._id });
    res.json({ trip, compensation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trips/:id/fare-split - Calculate fare split
router.get("/:id/fare-split", auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const acceptedPassengers = trip.passengers.filter((p) => p.status === "accepted").length + 1; // +1 host
    const fare = trip.actualFare || trip.predictedFare?.median || 0;
    const split = calculateCostSplit(fare, acceptedPassengers);

    res.json({ split, trip: { actualFare: trip.actualFare, predictedFare: trip.predictedFare, fareSplit: getTripFareSummary(trip) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

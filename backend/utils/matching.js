/**
 * TravelShare — Smart Ride Matching Engine v2
 * Features:
 *  - Haversine distance & bearing
 *  - Turf.js geometric route overlap
 *  - Multi-user passenger clustering
 *  - Smart pickup point suggestion (midpoint + weighted centroid)
 *  - Dynamic match scoring (overlap, time, detour, mood, gender)
 *  - Driver optimization (minimize total detour across all passengers)
 */

const turf = require("@turf/turf");

// ─── Constants ───────────────────────────────────────────────────────────────
const MAX_PICKUP_DIST   = 3000;   // meters
const MAX_DEST_DIST     = 5000;   // meters
const MAX_BEARING_DIFF  = 90;     // degrees
const TIME_WINDOW_MS    = 45 * 60 * 1000; // 45 minutes
const MIN_COMPATIBLE_SCORE = 0.25;
const CLUSTER_RADIUS_M  = 2000;   // meters for passenger clustering

// ─── Core Geo ────────────────────────────────────────────────────────────────

function haversine(p1, p2) {
  const R = 6371000;
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function bearing(p1, p2) {
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const x = Math.sin(dLng) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

function midpoint(p1, p2) {
  return {
    lat: (p1.lat + p2.lat) / 2,
    lng: (p1.lng + p2.lng) / 2,
  };
}

/**
 * Weighted centroid of multiple points
 */
function weightedCentroid(points, weights) {
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;
  const lat = points.reduce((s, p, i) => s + p.lat * weights[i], 0) / totalWeight;
  const lng = points.reduce((s, p, i) => s + p.lng * weights[i], 0) / totalWeight;
  return { lat, lng };
}

// ─── Route Scoring ───────────────────────────────────────────────────────────

function routeOverlapScore(o1, d1, o2, d2) {
  const pickupDist = haversine(o1, o2);
  const destDist   = haversine(d1, d2);
  const b1 = bearing(o1, d1);
  const b2 = bearing(o2, d2);
  let bDiff = Math.abs(b1 - b2);
  if (bDiff > 180) bDiff = 360 - bDiff;

  const pickupScore  = Math.max(0, 1 - pickupDist / MAX_PICKUP_DIST);
  const destScore    = Math.max(0, 1 - destDist   / MAX_DEST_DIST);
  const bearingScore = Math.max(0, 1 - bDiff / MAX_BEARING_DIFF);

  return 0.4 * pickupScore + 0.3 * destScore + 0.3 * bearingScore;
}

function normalizeLine(routeLine, origin, destination) {
  if (
    routeLine?.type === "LineString" &&
    Array.isArray(routeLine.coordinates) &&
    routeLine.coordinates.length >= 2
  ) {
    return turf.lineString(routeLine.coordinates);
  }
  return turf.lineString([[origin.lng, origin.lat], [destination.lng, destination.lat]]);
}

function turfOverlapScore(requestTrip, candidateTrip) {
  const requestLine   = normalizeLine(requestTrip.routeLine,   requestTrip.origin,   requestTrip.destination);
  const candidateLine = normalizeLine(candidateTrip.routeLine, candidateTrip.origin, candidateTrip.destination);
  const requestLength = Math.max(turf.length(requestLine, { units: "kilometers" }), 0.1);
  const sampled = turf.lineChunk(requestLine, Math.max(0.25, requestLength / 18), { units: "kilometers" });
  let nearby = 0;

  for (const feature of sampled.features) {
    const midpoint = turf.along(
      feature,
      turf.length(feature, { units: "kilometers" }) / 2,
      { units: "kilometers" }
    );
    const distance = turf.pointToLineDistance(midpoint, candidateLine, { units: "kilometers" });
    if (distance <= 0.75) nearby += 1;
  }

  const geometricOverlap = sampled.features.length
    ? nearby / sampled.features.length
    : 0;

  return Math.max(
    geometricOverlap,
    routeOverlapScore(
      requestTrip.origin, requestTrip.destination,
      candidateTrip.origin, candidateTrip.destination
    )
  );
}

function routeDistance(origin, destination) {
  return haversine(origin, destination);
}

function detourScore(o1, d1, o2, d2) {
  const mainDistance  = Math.max(routeDistance(o1, d1), routeDistance(o2, d2), 1);
  const extraDistance = haversine(o1, o2) + haversine(d1, d2);
  return Math.max(0, 1 - extraDistance / mainDistance);
}

// ─── Preference Scoring ──────────────────────────────────────────────────────

function moodCompatibilityScore(requestMood = {}, candidateMood = {}) {
  const checks = [["conversation", "any"], ["music", "any"], ["ac", "any"]];
  let score = 0;
  checks.forEach(([key, fallback]) => {
    const a = requestMood[key] || fallback;
    const b = candidateMood[key] || fallback;
    if (a === "any" || b === "any" || a === b) score += 1;
    else score += 0.25;
  });
  const safeA = requestMood.safeDriving !== false;
  const safeB = candidateMood.safeDriving !== false;
  score += safeA === safeB || safeA ? 1 : 0.35;
  return Math.round((score / 4) * 100) / 100;
}

// ─── Final Match Score ───────────────────────────────────────────────────────

function computeMatchScore(requestTrip, candidateTrip, weights = {}) {
  const w = {
    overlap:     0.31,
    time:        0.23,
    pickup:      0.15,
    destination: 0.11,
    detour:      0.08,
    preference:  0.08,
    mood:        0.04,
    ...weights,
  };

  const overlapScore = turfOverlapScore(requestTrip, candidateTrip);

  const timeDiff = Math.abs(
    new Date(requestTrip.departureTime) - new Date(candidateTrip.departureTime)
  );
  const timeScore = timeDiff > TIME_WINDOW_MS ? 0 : 1 - timeDiff / TIME_WINDOW_MS;

  const pickupDist  = haversine(requestTrip.origin,      candidateTrip.origin);
  const pickupScore = Math.max(0, 1 - pickupDist / MAX_PICKUP_DIST);

  const destinationDist  = haversine(requestTrip.destination, candidateTrip.destination);
  const destinationScore = Math.max(0, 1 - destinationDist / MAX_DEST_DIST);

  const practicalDetourScore = detourScore(
    requestTrip.origin,      requestTrip.destination,
    candidateTrip.origin,    candidateTrip.destination
  );

  let preferenceScore = 1;
  if (
    candidateTrip.genderPreference !== "Any" &&
    requestTrip.userGender &&
    candidateTrip.genderPreference !== requestTrip.userGender
  ) {
    preferenceScore = 0;
  }

  const moodScore = moodCompatibilityScore(requestTrip.rideMood, candidateTrip.rideMood);

  const finalScore = Math.min(
    1,
    w.overlap      * overlapScore +
    w.time         * timeScore +
    w.pickup       * pickupScore +
    w.destination  * destinationScore +
    w.detour       * practicalDetourScore +
    w.preference   * preferenceScore +
    w.mood         * moodScore
  );

  return {
    finalScore:         Math.round(finalScore * 100) / 100,
    overlapScore:       Math.round(overlapScore * 100) / 100,
    timeScore:          Math.round(timeScore * 100) / 100,
    pickupScore:        Math.round(pickupScore * 100) / 100,
    destinationScore:   Math.round(destinationScore * 100) / 100,
    detourScore:        Math.round(practicalDetourScore * 100) / 100,
    preferenceScore,
    moodScore,
    pickupDistanceM:    Math.round(pickupDist),
    destinationDistanceM: Math.round(destinationDist),
    timeDiffMin:        Math.round(timeDiff / 60000),
    isCompatible:       finalScore >= MIN_COMPATIBLE_SCORE,
  };
}

// ─── Top K Matches ───────────────────────────────────────────────────────────

function findTopMatches(requestTrip, candidates, k = 5) {
  return candidates
    .filter((c) => c._id.toString() !== (requestTrip._id || "").toString())
    .filter((c) => c.status === "active" && c.availableSeats > 0)
    .map((c) => {
      const scores = computeMatchScore(requestTrip, c);
      return { trip: c, ...scores };
    })
    .filter((r) => r.isCompatible)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, k);
}

// ─── Smart Pickup Suggestion ─────────────────────────────────────────────────

/**
 * Suggest an optimal shared pickup point between two trips.
 * Uses weighted centroid biased toward the route with higher trust score.
 * Returns { lat, lng, distanceFromA, distanceFromB, detourM }
 */
function suggestPickupPoint(tripA, tripB) {
  const trustA = tripA.host?.trustScore?.score || 80;
  const trustB = tripB.host?.trustScore?.score || 80;

  const pickup = weightedCentroid(
    [tripA.origin, tripB.origin],
    [trustA, trustB]
  );

  const distanceFromA = haversine(tripA.origin, pickup);
  const distanceFromB = haversine(tripB.origin, pickup);

  // Sanity check — if too far from either, fall back to tripA origin
  const MAX_PICKUP_WALK = 1500; // meters
  if (distanceFromA > MAX_PICKUP_WALK || distanceFromB > MAX_PICKUP_WALK) {
    const fallback = tripA.origin;
    return {
      lat: fallback.lat,
      lng: fallback.lng,
      distanceFromA: 0,
      distanceFromB: haversine(tripB.origin, fallback),
      strategy: "host_origin",
      note: "Pickup at driver's origin (walkling distance exceeded for smart pickup)",
    };
  }

  return {
    lat: pickup.lat,
    lng: pickup.lng,
    distanceFromA: Math.round(distanceFromA),
    distanceFromB: Math.round(distanceFromB),
    strategy: "weighted_centroid",
    note: `~${Math.round(distanceFromA)}m from you, ~${Math.round(distanceFromB)}m from partner`,
  };
}

// ─── Passenger Clustering ────────────────────────────────────────────────────

/**
 * Cluster passengers by proximity (greedy radius-based).
 * Returns array of clusters: [{ centroid, members: [trip], avgScore }]
 */
function clusterPassengers(trips) {
  const visited = new Set();
  const clusters = [];

  for (let i = 0; i < trips.length; i++) {
    if (visited.has(i)) continue;
    const cluster = { centroid: trips[i].origin, members: [trips[i]] };
    visited.add(i);

    for (let j = i + 1; j < trips.length; j++) {
      if (visited.has(j)) continue;
      const dist = haversine(trips[i].origin, trips[j].origin);
      if (dist <= CLUSTER_RADIUS_M) {
        cluster.members.push(trips[j]);
        visited.add(j);
      }
    }

    // Recalculate centroid as average
    const lats = cluster.members.map((t) => t.origin.lat);
    const lngs = cluster.members.map((t) => t.origin.lng);
    cluster.centroid = {
      lat: lats.reduce((s, v) => s + v, 0) / lats.length,
      lng: lngs.reduce((s, v) => s + v, 0) / lngs.length,
    };

    clusters.push(cluster);
  }

  return clusters;
}

// ─── Driver Route Optimization ───────────────────────────────────────────────

/**
 * Given a driver trip and a list of accepted passengers, compute
 * optimal pickup order using nearest-neighbour heuristic.
 * Returns { order: [trip], totalDetourM }
 */
function optimizePickupOrder(driverTrip, passengerTrips) {
  if (!passengerTrips.length) return { order: [], totalDetourM: 0 };

  const remaining = [...passengerTrips];
  const order = [];
  let current = driverTrip.origin;
  let totalDetour = 0;

  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((t, i) => {
      const d = haversine(current, t.origin);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    order.push(remaining[bestIdx]);
    totalDetour += bestDist;
    current = remaining[bestIdx].origin;
    remaining.splice(bestIdx, 1);
  }

  return { order, totalDetourM: Math.round(totalDetour) };
}

// ─── Cost Split ───────────────────────────────────────────────────────────────

function calculateCostSplit(totalFare, passengers) {
  const safePassengers = Math.max(1, Number(passengers) || 1);
  const fare = Math.max(0, Number(totalFare) || 0);
  const perPerson = Math.ceil(fare / safePassengers);
  return { total: fare, perPerson, passengers: safePassengers };
}

// ─── Route Similarity (0-1, used for deduplication / auto-grouping) ──────────

function routeSimilarity(tripA, tripB) {
  const overlap = turfOverlapScore(tripA, tripB);
  const timeDiff = Math.abs(
    new Date(tripA.departureTime) - new Date(tripB.departureTime)
  );
  const timeScore = timeDiff > TIME_WINDOW_MS ? 0 : 1 - timeDiff / TIME_WINDOW_MS;
  return Math.round((0.6 * overlap + 0.4 * timeScore) * 100) / 100;
}

module.exports = {
  haversine,
  bearing,
  midpoint,
  weightedCentroid,
  routeOverlapScore,
  turfOverlapScore,
  computeMatchScore,
  findTopMatches,
  suggestPickupPoint,
  clusterPassengers,
  optimizePickupOrder,
  calculateCostSplit,
  detourScore,
  moodCompatibilityScore,
  routeSimilarity,
};

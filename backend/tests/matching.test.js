/**
 * TravelShare — Backend Unit Tests
 * Tests for matching algorithms, fare calculations, and utilities.
 *
 * Run: node tests/matching.test.js
 * (No external test runner needed — pure Node.js assertions)
 */

const assert = require("assert");
const {
  haversine,
  bearing,
  routeOverlapScore,
  computeMatchScore,
  findTopMatches,
  calculateCostSplit,
} = require("../utils/matching");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✅\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.log(`  \x1b[31m❌\x1b[0m ${name}`);
    console.log(`     → ${err.message}`);
    failed++;
  }
}

function approx(a, b, tol = 50) {
  assert.ok(Math.abs(a - b) <= tol, `Expected ~${b}, got ${a} (tolerance ±${tol})`);
}

// ─────────────────────────────────────────
console.log("\n\x1b[1m1. Haversine Distance\x1b[0m");
// ─────────────────────────────────────────

test("same point → 0 meters", () => {
  const d = haversine({ lat: 22.5726, lng: 88.3639 }, { lat: 22.5726, lng: 88.3639 });
  assert.strictEqual(d, 0);
});

test("Salt Lake → Park Street Kolkata ≈ 8–10 km", () => {
  const d = haversine({ lat: 22.5726, lng: 88.4145 }, { lat: 22.5514, lng: 88.3517 });
  assert.ok(d > 5000 && d < 12000, `Got ${(d/1000).toFixed(2)} km`);
});

test("Delhi → Mumbai ≈ 1100–1200 km", () => {
  const d = haversine({ lat: 28.6139, lng: 77.2090 }, { lat: 19.0760, lng: 72.8777 });
  assert.ok(d > 1100000 && d < 1300000, `Got ${(d/1000).toFixed(1)} km`);
});

test("symmetry: d(A,B) === d(B,A)", () => {
  const A = { lat: 22.5726, lng: 88.3639 };
  const B = { lat: 22.6000, lng: 88.4500 };
  assert.strictEqual(
    haversine(A, B).toFixed(4),
    haversine(B, A).toFixed(4)
  );
});

// ─────────────────────────────────────────
console.log("\n\x1b[1m2. Bearing Calculation\x1b[0m");
// ─────────────────────────────────────────

test("bearing north ≈ 0°", () => {
  const b = bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(Math.abs(b) < 1 || Math.abs(b - 360) < 1, `Got ${b.toFixed(2)}°`);
});

test("bearing east ≈ 90°", () => {
  const b = bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  approx(b, 90, 2);
});

test("bearing south ≈ 180°", () => {
  const b = bearing({ lat: 1, lng: 0 }, { lat: 0, lng: 0 });
  approx(b, 180, 2);
});

test("bearing west ≈ 270°", () => {
  const b = bearing({ lat: 0, lng: 1 }, { lat: 0, lng: 0 });
  approx(b, 270, 2);
});

// ─────────────────────────────────────────
console.log("\n\x1b[1m3. Route Overlap Score\x1b[0m");
// ─────────────────────────────────────────

test("identical trips → score = 1.0", () => {
  const o = { lat: 22.5726, lng: 88.4145 };
  const d = { lat: 22.5514, lng: 88.3517 };
  const score = routeOverlapScore(o, d, o, d);
  assert.strictEqual(score, 1);
});

test("completely different routes → score < 0.3", () => {
  const score = routeOverlapScore(
    { lat: 22.5726, lng: 88.4145 }, { lat: 22.5514, lng: 88.3517 }, // Kolkata
    { lat: 28.6139, lng: 77.2090 }, { lat: 19.0760, lng: 72.8777 }  // Delhi→Mumbai
  );
  assert.ok(score < 0.3, `Expected < 0.3, got ${score}`);
});

test("nearby trips same direction → score > 0.7", () => {
  // Two trips starting ~200m apart, going same direction
  const score = routeOverlapScore(
    { lat: 22.5726, lng: 88.4145 }, { lat: 22.5514, lng: 88.3517 },
    { lat: 22.5730, lng: 88.4150 }, { lat: 22.5520, lng: 88.3520 }
  );
  assert.ok(score > 0.7, `Expected > 0.7, got ${score.toFixed(3)}`);
});

test("score always in [0, 1]", () => {
  const pairs = [
    [{ lat: 22.5726, lng: 88.4145 }, { lat: 22.5514, lng: 88.3517 },
     { lat: 19.0760, lng: 72.8777 }, { lat: 13.0827, lng: 80.2707 }],
    [{ lat: 28.6139, lng: 77.2090 }, { lat: 28.7041, lng: 77.1025 },
     { lat: 28.6200, lng: 77.2100 }, { lat: 28.7100, lng: 77.1000 }],
  ];
  for (const [o1, d1, o2, d2] of pairs) {
    const s = routeOverlapScore(o1, d1, o2, d2);
    assert.ok(s >= 0 && s <= 1, `Score out of range: ${s}`);
  }
});

// ─────────────────────────────────────────
console.log("\n\x1b[1m4. Match Scoring\x1b[0m");
// ─────────────────────────────────────────

const baseTrip = {
  origin:        { lat: 22.5726, lng: 88.4145 },
  destination:   { lat: 22.5514, lng: 88.3517 },
  departureTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min from now
  userGender:    "Male",
};

const perfectCandidate = {
  _id:           "abc123",
  status:        "active",
  availableSeats: 2,
  origin:        { lat: 22.5728, lng: 88.4147 },
  destination:   { lat: 22.5516, lng: 88.3519 },
  departureTime: new Date(Date.now() + 32 * 60 * 1000).toISOString(),
  genderPreference: "Any",
};

test("perfect match → score > 0.8", () => {
  const result = computeMatchScore(baseTrip, perfectCandidate);
  assert.ok(result.finalScore > 0.8, `Expected > 0.8, got ${result.finalScore}`);
});

test("wrong gender preference → lower score", () => {
  const femaleOnly = { ...perfectCandidate, genderPreference: "Female" };
  const result = computeMatchScore(baseTrip, femaleOnly);
  assert.ok(result.preferenceScore === 0, "Preference score should be 0");
  assert.ok(result.finalScore < 0.95, "Final score should be reduced");
});

test("time too far apart → timeScore = 0", () => {
  const farFuture = {
    ...perfectCandidate,
    departureTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours away
  };
  const result = computeMatchScore(baseTrip, farFuture);
  assert.strictEqual(result.timeScore, 0);
});

test("findTopMatches returns sorted results", () => {
  const candidates = [
    { ...perfectCandidate, _id: "c1", origin: { lat: 22.5726, lng: 88.4145 }, destination: { lat: 22.5514, lng: 88.3517 } },
    { ...perfectCandidate, _id: "c2", origin: { lat: 19.0760, lng: 72.8777 }, destination: { lat: 18.9220, lng: 72.8347 } },
    { ...perfectCandidate, _id: "c3", origin: { lat: 22.5730, lng: 88.4150 }, destination: { lat: 22.5520, lng: 88.3520 } },
  ];
  const matches = findTopMatches(baseTrip, candidates, 5);
  // Results should be in descending order of score
  for (let i = 1; i < matches.length; i++) {
    assert.ok(
      matches[i - 1].finalScore >= matches[i].finalScore,
      "Results not sorted by score"
    );
  }
});

test("findTopMatches excludes full trips", () => {
  const fullTrip = { ...perfectCandidate, _id: "full1", availableSeats: 0 };
  const matches = findTopMatches(baseTrip, [fullTrip], 5);
  assert.strictEqual(matches.length, 0);
});

test("findTopMatches excludes non-active trips", () => {
  const cancelledTrip = { ...perfectCandidate, _id: "x1", status: "cancelled" };
  const matches = findTopMatches(baseTrip, [cancelledTrip], 5);
  assert.strictEqual(matches.length, 0);
});

// ─────────────────────────────────────────
console.log("\n\x1b[1m5. Cost Split\x1b[0m");
// ─────────────────────────────────────────

test("₹200 ÷ 2 = ₹100 each", () => {
  const r = calculateCostSplit(200, 2);
  assert.strictEqual(r.perPerson, 100);
  assert.strictEqual(r.passengers, 2);
});

test("₹300 ÷ 3 = ₹100 each", () => {
  const r = calculateCostSplit(300, 3);
  assert.strictEqual(r.perPerson, 100);
});

test("₹250 ÷ 3 rounds up to ₹84", () => {
  const r = calculateCostSplit(250, 3);
  assert.strictEqual(r.perPerson, 84);
});

test("₹185 ÷ 4 rounds up to ₹47", () => {
  const r = calculateCostSplit(185, 4);
  assert.strictEqual(r.perPerson, 47);
});

test("split total is always preserved", () => {
  const fare = 457;
  const pax  = 3;
  const r    = calculateCostSplit(fare, pax);
  assert.strictEqual(r.total, fare);
  assert.strictEqual(r.passengers, pax);
});

// ─────────────────────────────────────────
console.log("\n\x1b[1m6. Edge Cases\x1b[0m");
// ─────────────────────────────────────────

test("haversine handles antipodal points", () => {
  const d = haversine({ lat: 90, lng: 0 }, { lat: -90, lng: 0 });
  approx(d, 20015000, 100000); // ~20,015 km
});

test("overlap score with null-island origins → valid", () => {
  const s = routeOverlapScore(
    { lat: 0, lng: 0 }, { lat: 1, lng: 1 },
    { lat: 0, lng: 0 }, { lat: 1, lng: 1 }
  );
  assert.strictEqual(s, 1);
});

test("computeMatchScore returns all required fields", () => {
  const r = computeMatchScore(baseTrip, perfectCandidate);
  assert.ok("finalScore"      in r, "missing finalScore");
  assert.ok("overlapScore"    in r, "missing overlapScore");
  assert.ok("timeScore"       in r, "missing timeScore");
  assert.ok("pickupScore"     in r, "missing pickupScore");
  assert.ok("preferenceScore" in r, "missing preferenceScore");
  assert.ok("pickupDistanceM" in r, "missing pickupDistanceM");
});

// ─────────────────────────────────────────
// Summary
// ─────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`  Total: ${passed + failed}  |  Passed: \x1b[32m${passed}\x1b[0m  |  Failed: \x1b[31m${failed}\x1b[0m`);
if (failed === 0) {
  console.log("  \x1b[32m✅ All tests passed!\x1b[0m\n");
} else {
  console.log("  \x1b[31m❌ Some tests failed. Check output above.\x1b[0m\n");
  process.exit(1);
}

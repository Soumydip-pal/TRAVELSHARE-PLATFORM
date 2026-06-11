const { calculateCostSplit } = require("./matching");

function getTripFareSummary(trip) {
  const acceptedPassengers = (trip.passengers || []).filter((p) => p.status === "accepted").length;
  const riderCount = acceptedPassengers + 1;
  const totalFare = trip.actualFare || trip.predictedFare?.median || 0;
  const split = calculateCostSplit(totalFare, riderCount);

  return {
    total: split.total,
    perPerson: split.perPerson,
    riders: riderCount,
    acceptedPassengers,
    availableSeats: trip.availableSeats,
  };
}

function attachTripSummary(trip) {
  if (!trip) return trip;
  const obj = typeof trip.toObject === "function" ? trip.toObject() : trip;
  return {
    ...obj,
    fareSplit: getTripFareSummary(obj),
  };
}

function attachTripSummaries(trips) {
  return (trips || []).map(attachTripSummary);
}

module.exports = {
  getTripFareSummary,
  attachTripSummary,
  attachTripSummaries,
};

const CITY_CONFIG = {
  Kolkata: { baseFare: 30, perKm: 13, perMin: 1.2 },
  Delhi: { baseFare: 35, perKm: 15, perMin: 1.5 },
  Mumbai: { baseFare: 40, perKm: 17, perMin: 1.8 },
  Bengaluru: { baseFare: 38, perKm: 16, perMin: 1.6 },
};

const SURGE_BY_HOUR = {
  0: 1.0, 1: 0.9, 2: 0.9, 3: 0.9, 4: 1.0, 5: 1.1,
  6: 1.3, 7: 1.6, 8: 1.8, 9: 1.5, 10: 1.2, 11: 1.1,
  12: 1.3, 13: 1.2, 14: 1.1, 15: 1.2, 16: 1.4, 17: 1.7,
  18: 1.9, 19: 1.6, 20: 1.4, 21: 1.2, 22: 1.1, 23: 1.0,
};

function estimateFareRange({
  city = "Kolkata",
  distanceKm = 0,
  durationMin,
  departureTime,
  departureHour,
  dayOfWeek,
  trafficIndex = 1.2,
  passengers = 2,
} = {}) {
  const distance = Math.max(0, Number(distanceKm) || 0);
  const duration = Math.max(5, Number(durationMin) || Math.round(distance * 3));
  const when = departureTime ? new Date(departureTime) : new Date();
  const hour = Number.isFinite(Number(departureHour)) ? Number(departureHour) : when.getHours();
  const day = Number.isFinite(Number(dayOfWeek)) ? Number(dayOfWeek) : when.getDay();
  const traffic = Math.min(3, Math.max(0.5, Number(trafficIndex) || 1.2));
  const riders = Math.max(1, Number(passengers) || 2);
  const config = CITY_CONFIG[city] || CITY_CONFIG.Kolkata;
  const surge = day >= 5 ? Math.max(1, (SURGE_BY_HOUR[hour] || 1) - 0.2) : SURGE_BY_HOUR[hour] || 1;
  const estimate = (config.baseFare + distance * config.perKm + duration * config.perMin) * surge * traffic;
  const median = Math.max(config.baseFare, Math.round(estimate));

  return {
    lower: Math.round(median * 0.85),
    median,
    upper: Math.round(median * 1.2),
    perPerson: Math.ceil(median / riders),
    surge,
    modelUsed: "rule_based_fallback",
  };
}

module.exports = { estimateFareRange };

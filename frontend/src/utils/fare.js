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

export function estimateFareLocally({
  city = "Kolkata",
  distance_km = 0,
  duration_min,
  departure_hour = new Date().getHours(),
  day_of_week = new Date().getDay(),
  traffic_index = 1.2,
  passengers = 2,
}) {
  const distance = Math.max(0, Number(distance_km) || 0);
  const duration = Math.max(5, Number(duration_min) || Math.round(distance * 3));
  const hour = Math.min(23, Math.max(0, Number(departure_hour) || 0));
  const day = Math.min(6, Math.max(0, Number(day_of_week) || 0));
  const traffic = Math.min(3, Math.max(0.5, Number(traffic_index) || 1.2));
  const riders = Math.max(1, Number(passengers) || 1);
  const config = CITY_CONFIG[city] || CITY_CONFIG.Kolkata;
  const surge = day >= 5 ? Math.max(1, (SURGE_BY_HOUR[hour] || 1) - 0.2) : SURGE_BY_HOUR[hour] || 1;
  const median = Math.max(config.baseFare, Math.round((config.baseFare + distance * config.perKm + duration * config.perMin) * surge * traffic));

  return {
    lower_fare: Math.round(median * 0.85),
    median_fare: median,
    upper_fare: Math.round(median * 1.2),
    per_person_estimate: Math.ceil(median / riders),
    passengers: riders,
    city,
    model_used: "rule_based_fallback",
    inputs: {
      distance_km: distance,
      duration_min: duration,
      departure_hour: hour,
      day_of_week: day,
      traffic_index: traffic,
    },
  };
}

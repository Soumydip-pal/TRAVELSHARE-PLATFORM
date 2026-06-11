"""
TravelShare — ML Fare Prediction API
Flask service for real Gradient Boosting fare predictions.

Endpoints:
  GET  /health          → model status
  POST /predict         → fare range prediction (ML or rule-based fallback)
  POST /route-overlap   → geometric route compatibility score
  POST /match-score     → combined match quality score
  POST /demand-prediction → city/hour demand label
  GET  /cities          → supported cities
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle, json, os, subprocess, sys
import numpy as np
import pandas as pd

app = Flask(__name__)
CORS(app)

BASE       = os.path.dirname(__file__)
MODELS_DIR = os.path.abspath(os.path.join(BASE, "..", "models"))
GEN_SCRIPT = os.path.abspath(os.path.join(BASE, "..", "generate_dataset.py"))

# ── Auto-train if pkl files missing ───────────────────────────────────────────
def _train_if_needed():
    pkl = os.path.join(MODELS_DIR, "fare_model.pkl")
    if not os.path.exists(pkl):
        print("⏳  No trained model found — running generate_dataset.py …", flush=True)
        result = subprocess.run(
            [sys.executable, GEN_SCRIPT],
            cwd=os.path.dirname(GEN_SCRIPT),
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print("❌  Training failed:", result.stderr, flush=True)
        else:
            print("✅  Model trained successfully", flush=True)

_train_if_needed()

# ── Load artifacts ─────────────────────────────────────────────────────────────
MODEL_READY = False
model = le = meta = None

try:
    with open(os.path.join(MODELS_DIR, "fare_model.pkl"), "rb") as f:
        model = pickle.load(f)
    with open(os.path.join(MODELS_DIR, "label_encoder.pkl"), "rb") as f:
        le = pickle.load(f)
    with open(os.path.join(MODELS_DIR, "meta.json")) as f:
        meta = json.load(f)
    FEATURE_NAMES = meta["features"]
    print(f"✅  ML model loaded — GradientBoosting, MAE ≈ {meta['metrics']['gradient_boosting']['MAE']}", flush=True)
    MODEL_READY = True
except Exception as e:
    print(f"⚠️   Model load failed: {e}", flush=True)
    meta = {
        "city_config": {
            "Kolkata":   {"base_fare": 30, "per_km": 13, "per_min": 1.2, "fuel_price": 103.5},
            "Delhi":     {"base_fare": 35, "per_km": 15, "per_min": 1.5, "fuel_price": 94.7},
            "Mumbai":    {"base_fare": 40, "per_km": 17, "per_min": 1.8, "fuel_price": 106.3},
            "Bengaluru": {"base_fare": 38, "per_km": 16, "per_min": 1.6, "fuel_price": 101.9},
            "Chennai":   {"base_fare": 36, "per_km": 14, "per_min": 1.4, "fuel_price": 102.6},
            "Hyderabad": {"base_fare": 33, "per_km": 13, "per_min": 1.3, "fuel_price": 100.9},
        },
        "surge_table": {str(h): v for h, v in {
            0:1.0,1:0.9,2:0.9,3:0.9,4:1.0,5:1.1,6:1.3,7:1.6,8:1.8,9:1.5,
            10:1.2,11:1.1,12:1.3,13:1.2,14:1.1,15:1.2,16:1.4,17:1.7,
            18:1.9,19:1.6,20:1.4,21:1.2,22:1.1,23:1.0
        }.items()},
        "cities": ["Kolkata","Delhi","Mumbai","Bengaluru","Chennai","Hyderabad"],
        "metrics": {"gradient_boosting": {"MAE": 19.1, "RMSE": 29.53}}
    }
    FEATURE_NAMES = ["distance_km","duration_min","departure_hour","day_of_week",
                     "traffic_index","surge_flag","fuel_price","base_fare","city_encoded"]

SURGE_TABLE = {int(k): float(v) for k, v in meta.get("surge_table", {}).items()} or {
    0:1.0,1:0.9,2:0.9,3:0.9,4:1.0,5:1.1,6:1.3,7:1.6,8:1.8,9:1.5,10:1.2,11:1.1,
    12:1.3,13:1.2,14:1.1,15:1.2,16:1.4,17:1.7,18:1.9,19:1.6,20:1.4,21:1.2,22:1.1,23:1.0
}
CITY_CONFIG = meta["city_config"]

# ── Helpers ────────────────────────────────────────────────────────────────────
def rule_based(distance_km, duration_min, departure_hour, day_of_week, city, traffic_index=1.0):
    cfg = CITY_CONFIG.get(city, CITY_CONFIG["Kolkata"])
    base = cfg["base_fare"] + distance_km * cfg["per_km"] + duration_min * cfg["per_min"]
    surge = SURGE_TABLE.get(departure_hour, 1.0)
    if day_of_week >= 5:
        surge = max(1.0, surge - 0.2)
    adj = base * surge * traffic_index
    return round(adj * 0.85), round(adj), round(adj * 1.20)


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_ready": MODEL_READY,
        "model_type": "GradientBoostingRegressor" if MODEL_READY else "rule_based_fallback",
        "mae": meta["metrics"]["gradient_boosting"]["MAE"] if MODEL_READY else None,
        "cities": list(CITY_CONFIG.keys()),
    })


@app.route("/predict", methods=["POST"])
def predict():
    """
    Body: { city, distance_km, duration_min, departure_hour, day_of_week,
             traffic_index?, passengers? }
    Returns: { lower_fare, median_fare, upper_fare, per_person_estimate,
               model_used, passengers, city, inputs }
    """
    try:
        data = request.get_json(force=True) or {}

        city          = data.get("city", "Kolkata")
        distance_km   = max(0.1, float(data.get("distance_km", 5)))
        duration_min  = max(1.0, float(data.get("duration_min", max(5, distance_km * 3))))
        departure_hour= min(23, max(0, int(data.get("departure_hour", 9))))
        day_of_week   = min(6,  max(0, int(data.get("day_of_week", 1))))
        traffic_index = min(3.0, max(0.5, float(data.get("traffic_index", 1.0))))
        passengers    = max(1, int(data.get("passengers", 2)))

        if MODEL_READY:
            cfg        = CITY_CONFIG.get(city, CITY_CONFIG["Kolkata"])
            known_cities = list(le.classes_)
            city_enc   = le.transform([city])[0] if city in known_cities else le.transform(["Kolkata"])[0]
            surge      = SURGE_TABLE.get(departure_hour, 1.0)
            if day_of_week >= 5:
                surge = max(1.0, surge - 0.2)

            row = pd.DataFrame([[
                distance_km, duration_min, departure_hour, day_of_week,
                traffic_index, surge, cfg["fuel_price"], cfg["base_fare"], city_enc
            ]], columns=FEATURE_NAMES)

            pred   = float(model.predict(row)[0])
            lower  = round(pred * 0.85)
            median = round(pred)
            upper  = round(pred * 1.20)
            model_used = "gradient_boosting"
        else:
            lower, median, upper = rule_based(
                distance_km, duration_min, departure_hour, day_of_week, city, traffic_index
            )
            model_used = "rule_based_fallback"

        return jsonify({
            "lower_fare":         int(lower),
            "median_fare":        int(median),
            "upper_fare":         int(upper),
            "per_person_estimate": int(round(median / passengers)),
            "passengers":         passengers,
            "city":               city,
            "model_used":         model_used,
            "inputs": {
                "distance_km":    distance_km,
                "duration_min":   duration_min,
                "departure_hour": departure_hour,
                "day_of_week":    day_of_week,
                "traffic_index":  traffic_index,
            }
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/route-overlap", methods=["POST"])
def route_overlap():
    try:
        data = request.get_json(force=True)
        o1, d1 = data["origin1"], data["dest1"]
        o2, d2 = data["origin2"], data["dest2"]

        def haversine(p1, p2):
            R = 6371000
            lat1, lat2 = np.radians(p1["lat"]), np.radians(p2["lat"])
            dlat = lat2 - lat1
            dlng = np.radians(p2["lng"] - p1["lng"])
            a = np.sin(dlat/2)**2 + np.cos(lat1)*np.cos(lat2)*np.sin(dlng/2)**2
            return R * 2 * np.arcsin(np.sqrt(a))

        def bearing(p1, p2):
            lat1 = np.radians(p1["lat"]); lat2 = np.radians(p2["lat"])
            dlng = np.radians(p2["lng"] - p1["lng"])
            x = np.sin(dlng) * np.cos(lat2)
            y = np.cos(lat1)*np.sin(lat2) - np.sin(lat1)*np.cos(lat2)*np.cos(dlng)
            return np.degrees(np.arctan2(x, y)) % 360

        pickup_dist = haversine(o1, o2)
        dest_dist   = haversine(d1, d2)
        b_diff = abs(bearing(o1,d1) - bearing(o2,d2))
        b_diff = min(b_diff, 360 - b_diff)
        route_dist  = max(haversine(o1,d1), haversine(o2,d2), 1)

        overlap = (
            0.34 * max(0, 1 - pickup_dist / 3000) +
            0.28 * max(0, 1 - dest_dist   / 5000) +
            0.24 * max(0, 1 - b_diff      / 90)   +
            0.14 * max(0, 1 - (pickup_dist + dest_dist) / route_dist)
        )

        return jsonify({
            "overlap_score":       round(overlap, 3),
            "pickup_distance_m":   round(pickup_dist),
            "dest_distance_m":     round(dest_dist),
            "bearing_diff_deg":    round(b_diff, 1),
            "is_compatible":       overlap >= 0.4,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/match-score", methods=["POST"])
def match_score():
    try:
        data = request.get_json(force=True) or {}
        overlap     = float(data.get("route_overlap", 0))
        time_score  = float(data.get("time_score", 0))
        trust_score = min(1.0, max(0.0, float(data.get("trust_score", 80)) / 100))
        rm = data.get("rider_mood",  {}) or {}
        dm = data.get("driver_mood", {}) or {}

        def pref_sim(a, b):
            if not a or a == "any" or not b or b == "any": return 1.0
            return 1.0 if a == b else 0.25

        mood_score = round(sum([
            pref_sim(rm.get("conversation"), dm.get("conversation")),
            pref_sim(rm.get("music"),        dm.get("music")),
            pref_sim(rm.get("ac"),           dm.get("ac")),
            1.0 if dm.get("safeDriving", True) else 0.35,
        ]) / 4, 3)

        final = round(0.48*overlap + 0.18*time_score + 0.18*mood_score + 0.16*trust_score, 3)
        return jsonify({
            "final_score":      max(0, min(1, final)),
            "mood_score":       mood_score,
            "trust_component":  round(trust_score, 3),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/demand-prediction", methods=["POST"])
def demand_prediction():
    try:
        data    = request.get_json(force=True) or {}
        hour    = int(data.get("departure_hour", 9))
        city    = data.get("city", "Kolkata")
        weekend = int(data.get("day_of_week", 1)) >= 5
        rush    = 1.0 if hour in [8,9,17,18,19] else 0.45
        boost   = {"Kolkata":0.72,"Delhi":0.82,"Mumbai":0.86,"Bengaluru":0.8,
                   "Chennai":0.75,"Hyderabad":0.73}.get(city, 0.70)
        score   = min(1.0, boost * (rush + (0.12 if weekend else 0)))
        return jsonify({
            "demand_score": round(score, 3),
            "label": "high" if score >= 0.75 else "medium" if score >= 0.45 else "low",
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/cities")
def cities():
    return jsonify({"cities": list(CITY_CONFIG.keys())})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)

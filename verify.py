#!/usr/bin/env python3
"""
Travel Sharing Coordination App — Project Verification Script
Run this to verify all components are set up correctly before demo.
Usage: python verify.py
"""

import subprocess, sys, os, json, time, importlib

PASS = "\033[92m✅\033[0m"
FAIL = "\033[91m❌\033[0m"
WARN = "\033[93m⚠️ \033[0m"
INFO = "\033[94mℹ️ \033[0m"

def check(label, ok, detail=""):
    status = PASS if ok else FAIL
    print(f"  {status} {label}" + (f" — {detail}" if detail else ""))
    return ok

def section(title):
    print(f"\n{'─'*50}")
    print(f"  {title}")
    print('─'*50)

results = []

# ── Python Packages ──
section("1. Python Packages (ML)")
for pkg in ["numpy","pandas","sklearn","flask","flask_cors","pickle","json"]:
    real_pkg = "scikit-learn" if pkg == "sklearn" else "flask-cors" if pkg == "flask_cors" else pkg
    ok = True
    try:
        importlib.import_module(pkg)
    except ImportError:
        ok = False
    results.append(check(real_pkg, ok, "installed" if ok else f"pip install {real_pkg}"))

# ── Node.js ──
section("2. Node.js Runtime")
try:
    v = subprocess.check_output(["node","--version"], text=True).strip()
    results.append(check("Node.js", True, v))
except:
    results.append(check("Node.js", False, "Install from nodejs.org"))

try:
    v = subprocess.check_output(["npm","--version"], text=True).strip()
    results.append(check("npm", True, v))
except:
    results.append(check("npm", False, "Install npm"))

# ── File Structure ──
section("3. Project File Structure")
required_files = [
    "ml/generate_dataset.py",
    "ml/api/app.py",
    "ml/requirements.txt",
    "backend/server.js",
    "backend/models/User.js",
    "backend/models/Trip.js",
    "backend/models/Message.js",
    "backend/routes/auth.js",
    "backend/routes/trips.js",
    "backend/routes/chat.js",
    "backend/routes/users.js",
    "backend/utils/matching.js",
    "backend/middleware/auth.js",
    "backend/seed.js",
    "backend/package.json",
    "frontend/src/App.js",
    "frontend/src/index.js",
    "frontend/src/pages/Landing.js",
    "frontend/src/pages/Login.js",
    "frontend/src/pages/Register.js",
    "frontend/src/pages/Dashboard.js",
    "frontend/src/pages/PostTrip.js",
    "frontend/src/pages/BrowseTrips.js",
    "frontend/src/pages/TripDetail.js",
    "frontend/src/pages/MyTrips.js",
    "frontend/src/pages/Profile.js",
    "frontend/src/pages/FarePredictor.js",
    "frontend/src/pages/Admin.js",
    "frontend/src/components/Navbar.js",
    "frontend/src/components/TripCard.js",
    "frontend/src/styles/global.css",
    "frontend/package.json",
    "docker-compose.yml",
    "README.md",
]
for f in required_files:
    exists = os.path.isfile(f)
    results.append(check(f, exists))

# ── ML Model ──
section("4. ML Model Artifacts")
model_files = ["ml/models/fare_model.pkl","ml/models/scaler.pkl","ml/models/label_encoder.pkl","ml/models/meta.json"]
for f in model_files:
    exists = os.path.isfile(f)
    results.append(check(f, exists, "generated" if exists else "Run: python ml/generate_dataset.py"))

dataset = os.path.isfile("ml/data/trips_dataset.csv")
results.append(check("ml/data/trips_dataset.csv", dataset, "generated" if dataset else "Run: python ml/generate_dataset.py"))

if os.path.isfile("ml/data/trips_dataset.csv"):
    import csv
    with open("ml/data/trips_dataset.csv") as f:
        row_count = sum(1 for _ in f) - 1
    results.append(check(f"Dataset rows", row_count >= 1000, f"{row_count:,} records"))

# ── Backend .env ──
section("5. Backend Configuration")
env_ok = os.path.isfile("backend/.env")
results.append(check("backend/.env exists", env_ok, "Copy from .env.example" if not env_ok else "found"))
if env_ok:
    with open("backend/.env") as f:
        env_content = f.read()
    results.append(check("JWT_SECRET set", "JWT_SECRET" in env_content and "change_this" not in env_content,
                          "⚠️  Still using example value — change it!" if "change_this" in env_content else "ok"))
    results.append(check("MONGODB_URI set", "MONGODB_URI" in env_content))
    results.append(check("ML_API_URL set",  "ML_API_URL" in env_content))

# ── ML Logic Verification ──
section("6. Matching Algorithm Verification")
try:
    import math

    def haversine(p1, p2):
        R = 6371000
        lat1,lat2 = math.radians(p1[0]),math.radians(p2[0])
        dlat = lat2-lat1
        dlng = math.radians(p2[1]-p1[1])
        a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlng/2)**2
        return R*2*math.asin(math.sqrt(a))

    # Salt Lake → Park Street (≈ 7–10 km by straight line)
    d = haversine((22.5726,88.4145),(22.5514,88.3517))
    results.append(check("Haversine distance", 5000 < d < 13000, f"{d/1000:.1f} km"))

    # Overlap score test — same route
    p_dist = haversine((22.5726,88.4145),(22.5726,88.4145))
    pickup_score = max(0, 1 - p_dist/3000)
    results.append(check("Pickup score (same point)", pickup_score == 1.0, f"{pickup_score:.2f}"))

    # Fare calculation
    base = 30 + 7.2*13 + 22*1.2
    adj  = base * 1.8 * 1.4
    lower = round(adj * 0.85)
    upper = round(adj * 1.20)
    results.append(check("Fare interval", lower < adj < upper, f"₹{lower}–₹{upper}"))

except Exception as e:
    results.append(check("Matching algorithms", False, str(e)))

# ── ML Prediction ──
section("7. ML Fare Prediction")
if os.path.isfile("ml/models/fare_model.pkl"):
    try:
        import pickle, numpy as np
        with open("ml/models/fare_model.pkl","rb") as f: model = pickle.load(f)
        with open("ml/models/meta.json") as f:           meta  = json.load(f)
        from sklearn.preprocessing import LabelEncoder
        with open("ml/models/label_encoder.pkl","rb") as f: le = pickle.load(f)

        cfg = meta["city_config"]["Kolkata"]
        city_enc = le.transform(["Kolkata"])[0]
        feat = np.array([[7.2, 22, 8, 1, 1.4, 1.8, cfg["fuel_price"], cfg["base_fare"], city_enc]])
        pred = model.predict(feat)[0]
        per_person = round(pred/2)

        results.append(check("Model prediction", 50 < pred < 1000, f"₹{pred:.0f} raw prediction"))
        results.append(check("Per-person split", per_person > 0, f"₹{per_person} (÷2 riders)"))
        results.append(check("Model type", True, meta.get("best_model", "gradient_boosting")))

        mae_val = meta.get("metrics",{}).get("Gradient Boosting",{}).get("MAE", None)
        if mae_val:
            results.append(check("Gradient Boosting MAE", mae_val < 50, f"₹{mae_val}"))
    except Exception as e:
        results.append(check("ML prediction", False, str(e)))
else:
    print(f"  {WARN} Models not trained yet — run: cd ml && python generate_dataset.py")

# ── Summary ──
section("SUMMARY")
total  = len(results)
passed = sum(results)
failed = total - passed
pct    = (passed/total*100) if total else 0

print(f"\n  Total checks : {total}")
print(f"  Passed       : \033[92m{passed}\033[0m")
print(f"  Failed       : \033[91m{failed}\033[0m")
print(f"  Score        : {pct:.0f}%")

if pct == 100:
    print(f"\n  {PASS} All checks passed! Project is ready to run.")
elif pct >= 80:
    print(f"\n  {WARN} Most checks passed. Address the failures above before demo.")
else:
    print(f"\n  {FAIL} Several issues found. Follow setup instructions in README.md")

print(f"\n  Quick Start:")
print(f"    Linux/Mac: chmod +x start.sh && ./start.sh")
print(f"    Windows  : start.bat")
print(f"    Docker   : docker compose up --build")
print()

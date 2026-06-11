"""
TravelShare — ML Unit Tests
Tests for dataset generation, model training, and fare prediction.

Run: python tests/test_ml.py
"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pickle

PASS = "\033[92m✅\033[0m"
FAIL = "\033[91m❌\033[0m"
passed = 0
failed = 0


def run_check(name, fn):
    global passed, failed
    try:
        fn()
        print(f"  {PASS} {name}")
        passed += 1
    except Exception as e:
        print(f"  {FAIL} {name}")
        print(f"     → {e}")
        failed += 1


def section(title):
    print(f"\n\033[1m{title}\033[0m")


# ─────────────────────────────────────────
section("1. Dataset Generation")
# ─────────────────────────────────────────

from generate_dataset import generate_dataset, CITY_CONFIG, SURGE_TABLE

df = None

def test_generate():
    global df
    df = generate_dataset(200)  # small for tests
    assert len(df) == 800, f"Expected 800 (4 cities × 200), got {len(df)}"

def test_columns():
    expected = {"trip_id","city","distance_km","duration_min","departure_hour",
                "day_of_week","traffic_index","surge_flag","fuel_price","base_fare","actual_fare"}
    assert expected.issubset(set(df.columns)), f"Missing: {expected - set(df.columns)}"

def test_cities():
    cities = set(df["city"].unique())
    assert cities == {"Kolkata","Delhi","Mumbai","Bengaluru"}, f"Got: {cities}"

def test_city_counts():
    for city in CITY_CONFIG:
        count = len(df[df["city"] == city])
        assert count == 200, f"{city}: expected 200, got {count}"

def test_fare_positive():
    assert (df["actual_fare"] > 0).all(), "All fares must be positive"

def test_fare_reasonable():
    assert df["actual_fare"].max() < 5000, f"Max fare too high: {df['actual_fare'].max()}"
    assert df["actual_fare"].min() >= 40, f"Min fare too low: {df['actual_fare'].min()}"

def test_distance_positive():
    assert (df["distance_km"] > 0).all(), "All distances must be positive"

def test_hour_range():
    assert df["departure_hour"].between(0, 23).all(), "Hours out of range"

def test_no_nulls():
    assert df.isnull().sum().sum() == 0, f"Found nulls: {df.isnull().sum()}"

def test_surge_table():
    assert len(SURGE_TABLE) == 24, f"Expected 24 surge values, got {len(SURGE_TABLE)}"
    for h, s in SURGE_TABLE.items():
        assert 0.5 <= s <= 3.0, f"Surge at hour {h} = {s} out of range"

run_check("generate_dataset() returns correct size", test_generate)
run_check("DataFrame has all required columns",    test_columns)
run_check("All 4 cities present",                  test_cities)
run_check("200 records per city",                  test_city_counts)
run_check("All fares are positive",                test_fare_positive)
run_check("Fares within reasonable range (Rs 40-Rs 5000)", test_fare_reasonable)
run_check("All distances are positive",            test_distance_positive)
run_check("Departure hours 0-23",                  test_hour_range)
run_check("No null values",                        test_no_nulls)
run_check("Surge table has 24 entries",            test_surge_table)


# ─────────────────────────────────────────
section("2. Model Training")
# ─────────────────────────────────────────

from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
from sklearn.preprocessing import LabelEncoder, StandardScaler
from generate_dataset import train_models

le_tmp = LabelEncoder()
df["city_encoded"] = le_tmp.fit_transform(df["city"])
features = ["distance_km","duration_min","departure_hour","day_of_week",
            "traffic_index","surge_flag","fuel_price","base_fare","city_encoded"]
X = df[features]; y = df["actual_fare"]

trained_models = scaler = le = metrics = None

def test_training():
    global trained_models, scaler, le, metrics
    trained_models, scaler, le, metrics, _ = train_models(df)

def test_all_models_returned():
    assert "linear" in trained_models
    assert "random_forest" in trained_models
    assert "gradient_boosting" in trained_models

def test_mae_reasonable():
    for name, m in metrics.items():
        assert m["MAE"] < 200, f"{name}: MAE {m['MAE']} too high (expected < 200 on small dataset)"

def test_gb_best():
    gb_mae = metrics["gradient_boosting"]["MAE"]
    lr_mae = metrics["linear"]["MAE"]
    assert gb_mae <= lr_mae * 1.5, f"GB ({gb_mae}) not competitive with LR ({lr_mae})"

def test_scaler_fitted():
    import numpy as np
    sample = np.array([[7.2, 22, 8, 1, 1.4, 1.8, 103.5, 30, 0]])
    result = scaler.transform(sample)
    assert result.shape == (1, 9)

def test_label_encoder():
    cities = list(CITY_CONFIG.keys())
    encoded = le.transform(cities)
    assert len(set(encoded)) == 4, "Should encode 4 unique cities"
    decoded = le.inverse_transform(encoded)
    assert list(decoded) == cities

run_check("train_models() runs without error",     test_training)
run_check("All 3 models returned",                 test_all_models_returned)
run_check("All models have MAE < 200",             test_mae_reasonable)
run_check("Gradient Boosting competitive with LR", test_gb_best)
run_check("StandardScaler fitted correctly",        test_scaler_fitted)
run_check("LabelEncoder encodes 4 cities",         test_label_encoder)


# ─────────────────────────────────────────
section("3. Fare Prediction")
# ─────────────────────────────────────────

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

def test_model_files_exist():
    for f in ["fare_model.pkl","scaler.pkl","label_encoder.pkl","meta.json"]:
        path = os.path.join(MODEL_DIR, f)
        assert os.path.isfile(path), f"Missing: {path}"

def test_model_loads():
    with open(os.path.join(MODEL_DIR, "fare_model.pkl"),"rb") as f:
        model = pickle.load(f)
    assert hasattr(model, "predict"), "Model must have predict()"

def test_meta_json():
    with open(os.path.join(MODEL_DIR, "meta.json")) as f:
        meta = json.load(f)
    assert "features" in meta
    assert "city_config" in meta
    assert "surge_table" in meta
    assert len(meta["features"]) == 9

def test_prediction_range():
    with open(os.path.join(MODEL_DIR, "fare_model.pkl"),"rb") as f:
        model = pickle.load(f)
    with open(os.path.join(MODEL_DIR, "label_encoder.pkl"),"rb") as f:
        le_prod = pickle.load(f)
    with open(os.path.join(MODEL_DIR, "meta.json")) as f:
        meta = json.load(f)

    cfg = meta["city_config"]["Kolkata"]
    city_enc = le_prod.transform(["Kolkata"])[0]
    feat = np.array([[7.2, 22, 8, 1, 1.4, 1.8, cfg["fuel_price"], cfg["base_fare"], city_enc]])
    pred = model.predict(feat)[0]
    assert 50 < pred < 2000, f"Prediction {pred:.0f} out of expected range"

def test_all_cities_predict():
    with open(os.path.join(MODEL_DIR, "fare_model.pkl"),"rb") as f:
        model = pickle.load(f)
    with open(os.path.join(MODEL_DIR, "label_encoder.pkl"),"rb") as f:
        le_prod = pickle.load(f)
    with open(os.path.join(MODEL_DIR, "meta.json")) as f:
        meta = json.load(f)

    for city in ["Kolkata","Delhi","Mumbai","Bengaluru"]:
        cfg = meta["city_config"][city]
        city_enc = le_prod.transform([city])[0]
        feat = np.array([[8.0, 25, 9, 1, 1.2, 1.3, cfg["fuel_price"], cfg["base_fare"], city_enc]])
        pred = model.predict(feat)[0]
        assert pred > 0, f"{city}: negative prediction {pred}"

def test_fare_interval():
    pred = 200.0
    lower  = round(pred * 0.85)
    median = round(pred)
    upper  = round(pred * 1.20)
    assert lower < median < upper
    assert lower == 170
    assert median == 200
    assert upper == 240

def test_per_person_split():
    median = 300
    for pax in [1, 2, 3, 4]:
        per_person = round(median / pax)
        assert per_person > 0
        assert per_person * pax >= median * 0.9  # within 10%

run_check("Model artifact files exist",             test_model_files_exist)
run_check("fare_model.pkl loads correctly",          test_model_loads)
run_check("meta.json has required keys",             test_meta_json)
run_check("Prediction within Rs 50-Rs 2000 range",  test_prediction_range)
run_check("All 4 cities produce valid predictions",  test_all_cities_predict)
run_check("Fare interval: lower < median < upper",   test_fare_interval)
run_check("Per-person split always positive",        test_per_person_split)


# ─────────────────────────────────────────
section("4. Route Overlap (Python)")
# ─────────────────────────────────────────

import math

def haversine_py(p1, p2):
    R = 6371000
    lat1,lat2 = math.radians(p1["lat"]),math.radians(p2["lat"])
    dlat = lat2-lat1
    dlng = math.radians(p2["lng"]-p1["lng"])
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlng/2)**2
    return R*2*math.asin(math.sqrt(a))

def bearing_py(p1, p2):
    lat1=math.radians(p1["lat"]); lat2=math.radians(p2["lat"])
    dlng=math.radians(p2["lng"]-p1["lng"])
    x=math.sin(dlng)*math.cos(lat2)
    y=math.cos(lat1)*math.sin(lat2)-math.sin(lat1)*math.cos(lat2)*math.cos(dlng)
    return (math.degrees(math.atan2(x,y))+360)%360

def overlap_py(o1,d1,o2,d2,mp=3000,md=5000,mb=90):
    pd=haversine_py(o1,o2); dd=haversine_py(d1,d2)
    b1=bearing_py(o1,d1); b2=bearing_py(o2,d2)
    bd=abs(b1-b2); bd=min(bd,360-bd)
    ps=max(0,1-pd/mp); ds=max(0,1-dd/md); bs=max(0,1-bd/mb)
    return 0.4*ps+0.3*ds+0.3*bs

def test_py_identical():
    o={"lat":22.5726,"lng":88.4145}; d={"lat":22.5514,"lng":88.3517}
    assert overlap_py(o,d,o,d) == 1.0

def test_py_range():
    pairs = [
        ({"lat":22.5726,"lng":88.4145},{"lat":22.5514,"lng":88.3517},
         {"lat":28.6139,"lng":77.2090},{"lat":19.0760,"lng":72.8777}),
    ]
    for o1,d1,o2,d2 in pairs:
        s = overlap_py(o1,d1,o2,d2)
        assert 0 <= s <= 1, f"Out of range: {s}"

def test_py_haversine_symmetry():
    a={"lat":22.5726,"lng":88.4145}; b={"lat":22.5514,"lng":88.3517}
    assert abs(haversine_py(a,b)-haversine_py(b,a)) < 0.001

run_check("Python overlap: identical routes = 1.0",  test_py_identical)
run_check("Python overlap: score in [0,1]",           test_py_range)
run_check("Python haversine: symmetric",              test_py_haversine_symmetry)


# ─────────────────────────────────────────
# Summary
# ─────────────────────────────────────────
print(f"\n{'─'*50}")
print(f"  Total: {passed+failed}  |  Passed: \033[92m{passed}\033[0m  |  Failed: \033[91m{failed}\033[0m")
if failed == 0:
    print("  \033[92m✅ All ML tests passed!\033[0m\n")
else:
    print("  \033[91m❌ Some tests failed.\033[0m\n")
    sys.exit(1)

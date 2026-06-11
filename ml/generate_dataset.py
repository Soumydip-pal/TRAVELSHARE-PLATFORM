"""
Travel Sharing Coordination App - ML Dataset Generator & Model Trainer
Generates synthetic trip data for 4 Indian cities and trains fare prediction models.
"""

import numpy as np
import pandas as pd
import json
import pickle
import os
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import LabelEncoder, StandardScaler

np.random.seed(42)

# City-specific pricing parameters
CITY_CONFIG = {
    "Kolkata": {"base_fare": 30, "per_km": 13, "per_min": 1.2, "fuel_price": 103.5},
    "Delhi":   {"base_fare": 35, "per_km": 15, "per_min": 1.5, "fuel_price": 94.7},
    "Mumbai":  {"base_fare": 40, "per_km": 17, "per_min": 1.8, "fuel_price": 106.3},
    "Bengaluru": {"base_fare": 38, "per_km": 16, "per_min": 1.6, "fuel_price": 101.9},
}

SURGE_TABLE = {
    # hour: surge_multiplier
    0: 1.0, 1: 0.9, 2: 0.9, 3: 0.9, 4: 1.0, 5: 1.1,
    6: 1.3, 7: 1.6, 8: 1.8, 9: 1.5, 10: 1.2, 11: 1.1,
    12: 1.3, 13: 1.2, 14: 1.1, 15: 1.2, 16: 1.4, 17: 1.7,
    18: 1.9, 19: 1.6, 20: 1.4, 21: 1.2, 22: 1.1, 23: 1.0,
}

def generate_dataset(n_per_city=5000):
    records = []
    cities = list(CITY_CONFIG.keys())
    trip_id = 1

    for city in cities:
        cfg = CITY_CONFIG[city]
        for _ in range(n_per_city):
            distance_km = round(np.random.exponential(8) + 2, 1)
            distance_km = min(distance_km, 50)
            
            speed_kmh = np.random.uniform(15, 40)
            duration_min = round((distance_km / speed_kmh) * 60 + np.random.normal(5, 2), 1)
            duration_min = max(5, duration_min)
            
            departure_hour = int(np.random.choice(range(24), p=[
                0.01,0.01,0.01,0.01,0.01,0.02,
                0.04,0.07,0.08,0.06,0.04,0.04,
                0.05,0.04,0.04,0.04,0.05,0.07,
                0.08,0.06,0.05,0.04,0.03,0.05
            ]))
            day_of_week = int(np.random.randint(0, 7))
            
            traffic_index = np.random.choice([0.8, 1.0, 1.2, 1.5, 1.8],
                p=[0.1, 0.3, 0.3, 0.2, 0.1])
            
            surge = SURGE_TABLE[departure_hour]
            if day_of_week >= 5:  # weekend
                surge = max(1.0, surge - 0.2)
            
            base = cfg["base_fare"] + distance_km * cfg["per_km"] + duration_min * cfg["per_min"]
            actual_fare = round(base * surge * traffic_index * np.random.uniform(0.92, 1.08))
            actual_fare = max(40, actual_fare)

            records.append({
                "trip_id": trip_id,
                "city": city,
                "distance_km": distance_km,
                "duration_min": round(duration_min, 1),
                "departure_hour": departure_hour,
                "day_of_week": day_of_week,
                "traffic_index": traffic_index,
                "surge_flag": round(surge, 2),
                "fuel_price": cfg["fuel_price"],
                "base_fare": cfg["base_fare"],
                "actual_fare": actual_fare,
            })
            trip_id += 1

    df = pd.DataFrame(records)
    return df


def train_models(df):
    le = LabelEncoder()
    df["city_encoded"] = le.fit_transform(df["city"])

    features = ["distance_km", "duration_min", "departure_hour", "day_of_week",
                "traffic_index", "surge_flag", "fuel_price", "base_fare", "city_encoded"]
    X = df[features]
    y = df["actual_fare"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)

    models = {
        "linear": LinearRegression(),
        "random_forest": RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1),
        "gradient_boosting": GradientBoostingRegressor(n_estimators=150, learning_rate=0.1, random_state=42),
    }

    results = {}
    trained = {}
    for name, model in models.items():
        if name == "linear":
            model.fit(X_train_sc, y_train)
            preds = model.predict(X_test_sc)
        else:
            model.fit(X_train, y_train)
            preds = model.predict(X_test)
        
        mae = mean_absolute_error(y_test, preds)
        rmse = np.sqrt(mean_squared_error(y_test, preds))
        results[name] = {"MAE": round(mae, 2), "RMSE": round(rmse, 2)}
        trained[name] = model
        print(f"{name}: MAE={mae:.2f}, RMSE={rmse:.2f}")

    return trained, scaler, le, results, features


def save_artifacts(trained_models, scaler, le, results, features):
    os.makedirs("models", exist_ok=True)
    
    # Save best model (gradient boosting typically best)
    best_model = trained_models["gradient_boosting"]
    with open("models/fare_model.pkl", "wb") as f:
        pickle.dump(best_model, f)
    
    with open("models/scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)
    
    with open("models/label_encoder.pkl", "wb") as f:
        pickle.dump(le, f)
    
    # Save city config and feature list
    # Convert numpy float64 to plain float for JSON serialization
    clean_results = {
        model: {k: float(v) for k, v in metrics.items()}
        for model, metrics in results.items()
    }
    meta = {
        "features": features,
        "city_config": CITY_CONFIG,
        "surge_table": {str(k): float(v) for k, v in SURGE_TABLE.items()},
        "metrics": clean_results,
        "cities": list(CITY_CONFIG.keys()),
    }
    with open("models/meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    
    print("\nAll artifacts saved to models/")


if __name__ == "__main__":
    print("Generating dataset...")
    df = generate_dataset(5000)
    df.to_csv("data/trips_dataset.csv", index=False)
    print(f"Dataset saved: {len(df)} records")
    print(df.head())
    
    print("\nTraining models...")
    trained_models, scaler, le, results, features = train_models(df)
    
    print("\nSaving artifacts...")
    save_artifacts(trained_models, scaler, le, results, features)
    
    print("\nDone! Summary:")
    for m, r in results.items():
        print(f"  {m}: {r}")

"""
train_rent_model.py
-------------------
Trains a Random Forest regression model to predict Indian residential rent.

Dataset : 8,000 synthetic-but-realistic samples derived from publicly
          available Indian real-estate price benchmarks (2022-2026).
Features: city, city_tier, room_type, furnishing, floor, year, area_mult
Target  : monthly rent (INR)

Run once to (re)train and save the model:
    python train_rent_model.py

Outputs:
    models/rent_predictor.pkl       – trained sklearn Pipeline
    models/rent_model_meta.json     – feature lists, metrics, city metadata
    data/india_rent_dataset.csv     – the training dataset (for reproducibility)
"""

import os, json, random
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

# ── Reproducibility ────────────────────────────────────────────────────────────
SEED = 42
np.random.seed(SEED); random.seed(SEED)

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = BASE_DIR                                          # save here
DATA_DIR   = os.path.join(BASE_DIR, '..', 'data')

# ── City catalogue ─────────────────────────────────────────────────────────────
# base = median 1RK rent (semi-furnished, typical area, ground floor)
# tier : 1=metro  2=major  3=mid-size  4=small
CITIES = {
    'Mumbai':           {'base': 14000, 'tier': 1},
    'Delhi':            {'base':  9000, 'tier': 1},
    'Bengaluru':        {'base':  8500, 'tier': 1},
    'Hyderabad':        {'base':  6500, 'tier': 1},
    'Chennai':          {'base':  7500, 'tier': 1},
    'Kolkata':          {'base':  6000, 'tier': 1},
    'Pune':             {'base':  5500, 'tier': 2},
    'Ahmedabad':        {'base':  6000, 'tier': 2},
    'Gurugram':         {'base': 10000, 'tier': 2},
    'Noida':            {'base':  8000, 'tier': 2},
    'Jaipur':           {'base':  5000, 'tier': 2},
    'Chandigarh':       {'base':  7000, 'tier': 2},
    'Faridabad':        {'base':  6000, 'tier': 2},
    'Ghaziabad':        {'base':  6500, 'tier': 2},
    'Panaji':           {'base':  8000, 'tier': 2},
    'Indore':           {'base':  5000, 'tier': 3},
    'Lucknow':          {'base':  5500, 'tier': 3},
    'Kochi':            {'base':  6500, 'tier': 3},
    'Nagpur':           {'base':  4000, 'tier': 3},
    'Bhopal':           {'base':  4500, 'tier': 3},
    'Surat':            {'base':  5500, 'tier': 3},
    'Nashik':           {'base':  4200, 'tier': 3},
    'Coimbatore':       {'base':  5000, 'tier': 3},
    'Visakhapatnam':    {'base':  5500, 'tier': 3},
    'Mysuru':           {'base':  4000, 'tier': 3},
    'Mangaluru':        {'base':  4500, 'tier': 3},
    'Vijayawada':       {'base':  5000, 'tier': 3},
    'Thiruvananthapuram':{'base': 5500, 'tier': 3},
    'Patna':            {'base':  4500, 'tier': 4},
    'Varanasi':         {'base':  4000, 'tier': 4},
    'Dehradun':         {'base':  5500, 'tier': 4},
    'Warangal':         {'base':  3000, 'tier': 4},
}

ROOM_MULT    = {'1RK': 1.0, '1BHK': 1.7, '2BHK': 2.8, '3BHK': 4.3, 'PG': 0.82}
FURNISH_MULT = {'Unfurnished': 0.82, 'Semi-Furnished': 1.0, 'Fully Furnished': 1.28}
FLOOR_MULT   = {'Ground': 0.92, '1st-2nd': 1.0, '3rd-5th': 1.06, '6th+': 0.96}
YEAR_MULT    = {2022: 0.91, 2023: 0.94, 2024: 1.0, 2025: 1.06, 2026: 1.10}

# Area-multiplier range per city tier (mirrors JS-side indiaGeodata premiums)
AREA_RANGES  = {1: (0.75, 2.50), 2: (0.80, 1.80), 3: (0.82, 1.50), 4: (0.85, 1.35)}

# ── Dataset generation ─────────────────────────────────────────────────────────
def build_dataset(n: int = 8000) -> pd.DataFrame:
    rows = []
    for _ in range(n):
        city    = random.choice(list(CITIES.keys()))
        cfg     = CITIES[city]; tier = cfg['tier']; base = cfg['base']
        room    = random.choice(list(ROOM_MULT.keys()))
        furnish = random.choice(list(FURNISH_MULT.keys()))
        floor   = random.choice(list(FLOOR_MULT.keys()))
        year    = random.choice(list(YEAR_MULT.keys()))
        lo, hi  = AREA_RANGES[tier]
        am      = round(np.random.uniform(lo, hi), 3)

        rent = (base
                * ROOM_MULT[room]
                * FURNISH_MULT[furnish]
                * FLOOR_MULT[floor]
                * YEAR_MULT[year]
                * am)
        rent = max(1500, int(rent * np.random.normal(1.0, 0.09)))  # ±9 % noise

        rows.append({
            'city': city, 'city_tier': tier,
            'room_type': room, 'furnishing': furnish,
            'floor': floor, 'year': year,
            'area_mult': am, 'rent': rent,
        })
    return pd.DataFrame(rows)

# ── Train ──────────────────────────────────────────────────────────────────────
def train():
    print("[RentModel] Building dataset …")
    df = build_dataset(8000)

    X = df.drop('rent', axis=1)
    y = df['rent']
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=SEED)

    cat_cols = ['city', 'room_type', 'furnishing', 'floor']
    num_cols = ['city_tier', 'year', 'area_mult']

    preprocessor = ColumnTransformer([
        ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), cat_cols),
        ('num', StandardScaler(), num_cols),
    ])

    pipeline = Pipeline([
        ('pre',   preprocessor),
        ('model', RandomForestRegressor(
            n_estimators=200, max_depth=15,
            random_state=SEED, n_jobs=-1)),
    ])

    print("[RentModel] Training Random Forest (200 trees) …")
    pipeline.fit(X_train, y_train)

    preds = pipeline.predict(X_test)
    mae   = mean_absolute_error(y_test, preds)
    r2    = r2_score(y_test, preds)
    print(f"[RentModel] ✅  MAE: ₹{mae:,.0f}   R²: {r2:.4f}")

    # ── Persist ────────────────────────────────────────────────────────────────
    model_path = os.path.join(MODELS_DIR, 'rent_predictor.pkl')
    meta_path  = os.path.join(MODELS_DIR, 'rent_model_meta.json')
    data_path  = os.path.join(DATA_DIR,   'india_rent_dataset.csv')

    joblib.dump(pipeline, model_path)

    metadata = {
        'model':       'RandomForestRegressor',
        'n_estimators': 200,
        'features':    {'categorical': cat_cols, 'numerical': num_cols},
        'cities':      list(CITIES.keys()),
        'room_types':  list(ROOM_MULT.keys()),
        'furnishings': list(FURNISH_MULT.keys()),
        'floors':      list(FLOOR_MULT.keys()),
        'years':       list(YEAR_MULT.keys()),
        'city_tiers':  {c: v['tier'] for c, v in CITIES.items()},
        'city_bases':  {c: v['base'] for c, v in CITIES.items()},
        'area_ranges': {str(k): list(v) for k, v in AREA_RANGES.items()},
        'metrics':     {
            'mae':     round(mae, 2),
            'r2':      round(r2, 4),
            'n_train': len(X_train),
            'n_test':  len(X_test),
        },
    }
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    os.makedirs(DATA_DIR, exist_ok=True)
    df.to_csv(data_path, index=False)

    print(f"[RentModel] 💾 Model  → {model_path}")
    print(f"[RentModel] 💾 Meta   → {meta_path}")
    print(f"[RentModel] 💾 Data   → {data_path}")
    return pipeline, metadata

if __name__ == '__main__':
    train()

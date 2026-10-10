"""
RoomSync ML — Fixed training with correct feature engineering
"""
import os, numpy as np, pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, mean_absolute_error
import joblib

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, '..', 'data', 'student_profiles.csv')

FEAT = ['openness','conscientiousness','extraversion','agreeableness','neuroticism',
        'sleep_enc','study_enc','year_enc','cleanliness','budget_mid','past_rating','smoke_enc','guests_enc']
N_FEAT = len(FEAT)  # 13

SLEEP_E  = {'Early Bird':0, 'Flexible':1, 'Night Owl':2}
STUDY_E  = {'Silent Study':0, 'Both':1, 'Group Study':2}
YEAR_E   = {'FY':1, 'SY':2, 'TY':3, 'Final Year':4}
SMOKE_E  = {'No':0, 'Occasionally':1, 'Yes':2}
GUESTS_E = {'Rarely':0, 'Sometimes':1, 'Often':2}

def generate_profiles(n=3000):
    np.random.seed(42)
    rows = []
    for i in range(n):
        sleep  = np.random.choice(['Early Bird','Flexible','Night Owl'], p=[0.35,0.35,0.30])
        study  = np.random.choice(['Silent Study','Both','Group Study'], p=[0.40,0.35,0.25])
        year   = np.random.choice(['FY','SY','TY','Final Year'], p=[0.30,0.30,0.25,0.15])
        smoke  = np.random.choice(['No','Occasionally','Yes'], p=[0.70,0.20,0.10])
        guests = np.random.choice(['Rarely','Sometimes','Often'], p=[0.40,0.40,0.20])
        clean  = np.random.randint(2, 6)
        bmin   = int(np.random.choice([4000,5000,6000,7000,8000,10000]))
        bmax   = bmin + int(np.random.choice([2000,3000,4000,5000]))
        rating = round(float(np.random.uniform(2.5, 5.0)), 1)
        rows.append({
            'uid': f'syn_{i:04d}',
            'name': f'Student_{i}',
            'openness':          round(float(np.random.beta(2,2)*4+1), 2),
            'conscientiousness': round(float(np.random.beta(2,2)*4+1), 2),
            'extraversion':      round(float(np.random.beta(2,2)*4+1), 2),
            'agreeableness':     round(float(np.random.beta(2.5,1.5)*4+1), 2),
            'neuroticism':       round(float(np.random.beta(1.5,2.5)*4+1), 2),
            'sleep_schedule': sleep, 'study_type': study, 'year': year,
            'smoking': smoke, 'guests': guests,
            'cleanliness': clean, 'budget_min': bmin, 'budget_max': bmax,
            'past_rating': rating,
            'sleep_enc':  SLEEP_E[sleep],
            'study_enc':  STUDY_E[study],
            'year_enc':   YEAR_E[year],
            'smoke_enc':  SMOKE_E[smoke],
            'guests_enc': GUESTS_E[guests],
            'budget_mid': (bmin+bmax)/2,
        })
    return pd.DataFrame(rows)

def compatibility_score(a, b):
    score = 0.0
    # OCEAN — 40 pts
    ocean_w = {'openness':0.15,'conscientiousness':0.25,'extraversion':0.15,'agreeableness':0.25,'neuroticism':0.20}
    for field, w in ocean_w.items():
        diff = abs(float(a[field]) - float(b[field]))
        if field == 'neuroticism':
            bonus = (5-float(a[field]))*(5-float(b[field]))/16
            score += w*40*(1-diff/4)*0.6 + w*40*bonus*0.4
        else:
            score += w*40*max(0, 1-diff/4)
    # Sleep — 20 pts
    if a['sleep_enc'] == b['sleep_enc']:      score += 20
    elif 1 in [a['sleep_enc'],b['sleep_enc']]: score += 12
    else:                                       score += 2
    # Study — 15 pts
    if a['study_enc'] == b['study_enc']:      score += 15
    elif 1 in [a['study_enc'],b['study_enc']]: score += 9
    else:                                       score += 3
    # Budget — 15 pts
    overlap = max(0, min(a['budget_max'],b['budget_max']) - max(a['budget_min'],b['budget_min']))
    total   = max(a['budget_max'],b['budget_max']) - min(a['budget_min'],b['budget_min'])
    score  += 15*(overlap/total) if total>0 else 0
    # Cleanliness — 7 pts
    score += max(0, 7 - abs(int(a['cleanliness'])-int(b['cleanliness']))*2)
    # Smoking — 3 pts
    if a['smoke_enc'] == b['smoke_enc']:    score += 3
    elif a['smoke_enc']==0 and b['smoke_enc']>0: score += 0
    else:                                    score += 1
    return min(100, max(0, round(score)))

def make_pair_features(a_vec, b_vec):
    """FIXED: 13*2 = 26 features — diff + mean"""
    diff = a_vec - b_vec
    mean = (a_vec + b_vec) / 2
    return np.concatenate([diff, mean])  # 26 features

def generate_pairs(df, n_pairs=8000):
    X, y_clf, y_reg = [], [], []
    a_idx = np.random.randint(0, len(df), n_pairs)
    b_idx = np.random.randint(0, len(df), n_pairs)
    for ai, bi in zip(a_idx, b_idx):
        if ai == bi: continue
        a, b = df.iloc[ai], df.iloc[bi]
        sc = compatibility_score(a, b)
        a_vec = a[FEAT].values.astype(float)
        b_vec = b[FEAT].values.astype(float)
        fv = make_pair_features(a_vec, b_vec)
        X.append(fv)
        y_clf.append(1 if sc >= 70 else 0)
        y_reg.append(sc)
    return np.array(X), np.array(y_clf), np.array(y_reg)

print("Generating 3000 student profiles...")
df = generate_profiles(3000)
df.to_csv(DATA, index=False)
print(f"Saved to {DATA}")

print("Generating training pairs...")
X, y_clf, y_reg = generate_pairs(df, 8000)
print(f"Pair features shape: {X.shape}  (should be N x {N_FEAT*2})")

# Scaler on raw profiles
Xs = df[FEAT].fillna(df[FEAT].median()).values
scaler = StandardScaler()
scaler.fit(Xs)
joblib.dump(scaler, os.path.join(BASE,'scaler.pkl'))
print(f"Scaler fitted on {Xs.shape[1]} features")

# K-Means
Xs_norm = scaler.transform(Xs)
kmeans = KMeans(n_clusters=8, random_state=42, n_init=15)
kmeans.fit(Xs_norm)
joblib.dump(kmeans, os.path.join(BASE,'kmeans_model.pkl'))
print(f"K-Means done — {kmeans.n_clusters} clusters")

X_tr, X_te, yc_tr, yc_te, yr_tr, yr_te = train_test_split(X, y_clf, y_reg, test_size=0.2, random_state=42)

# RF Classifier
print("Training RF Classifier...")
rf_clf = RandomForestClassifier(n_estimators=300, max_depth=14, min_samples_leaf=2,
    class_weight='balanced', random_state=42, n_jobs=-1)
rf_clf.fit(X_tr, yc_tr)
acc = accuracy_score(yc_te, rf_clf.predict(X_te))
print(f"RF Clf accuracy: {acc:.3f}")
joblib.dump(rf_clf, os.path.join(BASE,'rf_classifier.pkl'))

# RF Regressor
print("Training RF Regressor...")
rf_reg = RandomForestRegressor(n_estimators=300, max_depth=14, min_samples_leaf=2,
    random_state=42, n_jobs=-1)
rf_reg.fit(X_tr, yr_tr)
mae = mean_absolute_error(yr_te, rf_reg.predict(X_te))
print(f"RF Reg MAE: {mae:.2f} pts")
joblib.dump(rf_reg, os.path.join(BASE,'rf_regressor.pkl'))

# GB Classifier
print("Training GB Classifier...")
gb_clf = GradientBoostingClassifier(n_estimators=200, learning_rate=0.08,
    max_depth=5, subsample=0.85, random_state=42)
gb_clf.fit(X_tr, yc_tr)
gb_acc = accuracy_score(yc_te, gb_clf.predict(X_te))
print(f"GB Clf accuracy: {gb_acc:.3f}")
joblib.dump(gb_clf, os.path.join(BASE,'gb_finetuned.pkl'))

print(f"\n✅ All models trained!")
print(f"   Feature size per pair: {X.shape[1]}  (= {N_FEAT}*2)")
print(f"   RF Classifier:  {acc:.1%}")
print(f"   GB Classifier:  {gb_acc:.1%}")
print(f"   RF Regressor:   MAE = {mae:.1f} pts")

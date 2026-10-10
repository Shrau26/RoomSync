"""
RoomSync ML Matcher — FIXED feature engineering to match trained models
RF + GB Ensemble + K-Means Clustering + Cosine Similarity + OCEAN
"""
import os
import numpy as np
import pandas as pd
import joblib
from sklearn.metrics.pairwise import cosine_similarity

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, '..', 'data', 'student_profiles.csv')

# ── Must match train_model.py exactly ──────────────────
FEAT = ['openness','conscientiousness','extraversion','agreeableness','neuroticism',
        'sleep_enc','study_enc','year_enc','cleanliness','budget_mid','past_rating',
        'smoke_enc','guests_enc']
N_FEAT = len(FEAT)  # 13 — pair features = 13*2 = 26

SLEEP_E  = {'Early Bird':0, 'Flexible':1, 'Night Owl':2}
STUDY_E  = {'Silent Study':0, 'Both':1, 'Group Study':2}
YEAR_E   = {'FY':1, 'SY':2, 'TY':3, 'Final Year':4}
SMOKE_E  = {'No':0, 'Occasionally':1, 'Yes':2}
GUESTS_E = {'Rarely':0, 'Sometimes':1, 'Often':2}

def sf(v, d=3.0):
    try: return float(d) if v is None else float(v)
    except: return float(d)

def si(v, d=0):
    try: return int(d) if v is None else int(float(v))
    except: return int(d)

def encode_profile(p, scaler):
    """Convert a profile dict to a scaled feature vector (13 features)"""
    b    = p.get('budget') or {}
    bmin = sf(b.get('min') if isinstance(b, dict) else None, 5000)
    bmax = sf(b.get('max') if isinstance(b, dict) else None, 10000)
    raw  = np.array([[
        sf(p.get('openness'),          3.0),
        sf(p.get('conscientiousness'), 3.0),
        sf(p.get('extraversion'),      3.0),
        sf(p.get('agreeableness'),     3.0),
        sf(p.get('neuroticism'),       3.0),
        float(SLEEP_E.get(p.get('sleep_schedule') or 'Flexible', 1)),
        float(STUDY_E.get(p.get('study_type')     or 'Both',     1)),
        float(YEAR_E.get(p.get('year')            or 'SY',       2)),
        sf(p.get('cleanliness'), 3.0),
        (bmin + bmax) / 2,
        sf(p.get('past_rating'), 3.5),
        float(SMOKE_E.get(p.get('smoking')  or 'No',        0)),
        float(GUESTS_E.get(p.get('guests')  or 'Sometimes', 1)),
    ]])
    return scaler.transform(raw)[0]  # shape: (13,)

def make_pair_features(a_vec, b_vec):
    """FIXED: 13 diff + 13 mean = 26 features — matches trained model exactly"""
    diff = a_vec - b_vec
    mean = (a_vec + b_vec) / 2
    return np.concatenate([diff, mean]).reshape(1, -1)  # shape: (1, 26)

def score_label(sc):
    if sc >= 85: return 'Excellent Match'
    if sc >= 70: return 'Good Match'
    if sc >= 55: return 'Moderate Match'
    return 'Low Match'

class RoommateMatcherML:
    def __init__(self):
        self.scaler  = joblib.load(os.path.join(BASE, 'scaler.pkl'))
        self.kmeans  = joblib.load(os.path.join(BASE, 'kmeans_model.pkl'))
        self.rf_clf  = joblib.load(os.path.join(BASE, 'rf_classifier.pkl'))
        self.rf_reg  = joblib.load(os.path.join(BASE, 'rf_regressor.pkl'))
        gb_path      = os.path.join(BASE, 'gb_finetuned.pkl')
        self.gb_clf  = joblib.load(gb_path) if os.path.exists(gb_path) else None
        self.live_profiles = []
        self._load_base()
        print(f"[ML] ✅ {len(self.df)} profiles | GB: {'yes' if self.gb_clf else 'no'} | Features: {N_FEAT}x2={N_FEAT*2}")

    def _load_base(self):
        self.df = pd.read_csv(DATA)
        self.df['budget_mid'] = (self.df['budget_min'] + self.df['budget_max']) / 2
        for col in FEAT:
            if col in self.df.columns:
                self.df[col] = self.df[col].fillna(self.df[col].median())
        # Pre-compute scaled vectors for all base profiles
        self.base_vecs = self.scaler.transform(self.df[FEAT].values)  # (3000, 13)
        self.df['cluster'] = self.kmeans.predict(self.base_vecs)

    def inject_live_profiles(self, profiles):
        self.live_profiles = [p for p in (profiles or []) if p.get('name')]

    def _get_compat(self, u_vec, c_vec):
        """Get compatibility score using RF + GB ensemble — pair features = 26"""
        fv = make_pair_features(u_vec, c_vec)  # (1, 26)
        rf_prob = float(self.rf_clf.predict_proba(fv)[0][1])
        rf_sc   = float(self.rf_reg.predict(fv)[0])
        if self.gb_clf:
            gb_prob = float(self.gb_clf.predict_proba(fv)[0][1])
            prob = 0.50 * rf_prob + 0.50 * gb_prob
        else:
            prob = rf_prob
        # Blend: 50% regressor score + 50% classifier probability
        final = 0.55 * rf_sc + 0.45 * prob * 100
        return round(min(100, max(0, final))), prob

    def find_matches(self, user, top_k=10):
        u_vec = encode_profile(user, self.scaler)   # (13,)
        u_cl  = int(self.kmeans.predict(u_vec.reshape(1, -1))[0])

        b     = user.get('budget') or {}
        u_bmin = sf(b.get('min') if isinstance(b, dict) else None, 5000)
        u_bmax = sf(b.get('max') if isinstance(b, dict) else None, 10000)

        # ── Build candidate pool ────────────────────────
        cand_rows = []
        cand_vecs = []

        # 1) Real Firebase users (priority)
        for lp in self.live_profiles:
            if str(lp.get('uid','')) == str(user.get('uid','')): continue
            try:
                lv  = encode_profile(lp, self.scaler)
                b2  = lp.get('budget') or {}
                cand_rows.append({
                    'uid':          str(lp.get('uid', '')),
                    'name':         str(lp.get('name', 'Student')),
                    'college':      str(lp.get('college', '')),
                    'year':         str(lp.get('year', 'SY')),
                    'role':         str(lp.get('role', '')),
                    'profile_image_url': lp.get('profile_image_url',''),
                    'bio':          str(lp.get('bio', '')),
                    'sleep_schedule': str(lp.get('sleep_schedule', 'Flexible')),
                    'study_type':   str(lp.get('study_type', 'Both')),
                    'cleanliness':  sf(lp.get('cleanliness'), 3),
                    'smoking':      str(lp.get('smoking', 'No')),
                    'guests':       str(lp.get('guests', 'Sometimes')),
                    'diet':         str(lp.get('diet', '')),
                    'budget_min':   sf(b2.get('min') if isinstance(b2,dict) else None, 5000),
                    'budget_max':   sf(b2.get('max') if isinstance(b2,dict) else None, 10000),
                    'past_rating':  sf(lp.get('past_rating'), 3.5),
                    'openness':     sf(lp.get('openness'), 3),
                    'conscientiousness': sf(lp.get('conscientiousness'), 3),
                    'extraversion': sf(lp.get('extraversion'), 3),
                    'agreeableness': sf(lp.get('agreeableness'), 3),
                    'neuroticism':  sf(lp.get('neuroticism'), 3),
                    'is_real': True,
                })
                cand_vecs.append(lv)
            except Exception as e:
                print(f"[ML] Skip live profile: {e}")

        # 2) Synthetic profiles (fill if needed)
        same_cl = self.df[self.df['cluster'] == u_cl]
        other   = self.df[self.df['cluster'] != u_cl]
        syn_pool = pd.concat([same_cl, other]).head(200)
        for i, row in syn_pool.iterrows():
            cand_rows.append({
                'uid':          str(row.get('uid', f'syn_{i}')),
                'name':         str(row.get('name', f'Student_{i}')),
                'college':      '', 'year': str(row.get('year','SY')),
                'role':         '', 'bio': '', 'profile_image_url': '',
                'sleep_schedule': str(row.get('sleep_schedule','Flexible')),
                'study_type':   str(row.get('study_type','Both')),
                'cleanliness':  sf(row.get('cleanliness'), 3),
                'smoking':      str(row.get('smoking','No')),
                'guests':       str(row.get('guests','Sometimes')),
                'diet':         '', 'budget_min': sf(row.get('budget_min'),5000),
                'budget_max':   sf(row.get('budget_max'),10000),
                'past_rating':  sf(row.get('past_rating'),3.5),
                'openness':     sf(row.get('openness'),3),
                'conscientiousness': sf(row.get('conscientiousness'),3),
                'extraversion': sf(row.get('extraversion'),3),
                'agreeableness': sf(row.get('agreeableness'),3),
                'neuroticism':  sf(row.get('neuroticism'),3),
                'is_real':      False,
            })
            cand_vecs.append(self.base_vecs[i])

        if not cand_vecs:
            return []

        cand_vecs = np.array(cand_vecs)  # (N, 13)

        # ── Cosine similarity pre-filter ────────────────
        cos_scores = cosine_similarity(u_vec.reshape(1,-1), cand_vecs)[0]
        top_indices = np.argsort(cos_scores)[::-1][:top_k * 4]

        # ── Score each candidate ────────────────────────
        results = []
        seen    = set()
        for idx in top_indices:
            row = cand_rows[idx]
            uid = row['uid']
            if uid in seen or uid == str(user.get('uid','')): continue
            seen.add(uid)

            c_vec = cand_vecs[idx]
            try:
                compat_sc, prob = self._get_compat(u_vec, c_vec)
            except Exception as e:
                print(f"[ML] Compat error for {uid}: {e}")
                continue

            # Bonus: real user +8, same cluster +5
            c_cl = int(self.kmeans.predict(c_vec.reshape(1,-1))[0])
            bonus = (8 if row['is_real'] else 0) + (5 if c_cl == u_cl else 0)
            final = int(min(100, compat_sc + bonus))

            # Breakdown scores
            r_bmin = row['budget_min']
            r_bmax = row['budget_max']
            overlap = max(0, min(u_bmax, r_bmax) - max(u_bmin, r_bmin))
            span    = max(u_bmax, r_bmax) - min(u_bmin, r_bmin)
            budget_s = int(min(100, (overlap/span)*100)) if span>0 else 50
            sleep_s  = 100 if row['sleep_schedule'] == (user.get('sleep_schedule') or 'Flexible') else 40
            study_s  = 100 if row['study_type']     == (user.get('study_type')     or 'Both')     else 40
            clean_s  = max(0, 100 - abs(sf(user.get('cleanliness'),3) - row['cleanliness']) * 25)

            results.append({
                'uid':                  uid,
                'name':                 row['name'],
                'college':              row['college'],
                'year':                 row['year'],
                'role':                 row['role'],
                'bio':                  row['bio'],
                'profile_image_url':    row['profile_image_url'],
                'compatibility_score':  final,
                'score':                final,
                'quality':              score_label(final),
                'rf_match_probability': round(prob * 100, 1),
                'cosine_similarity':    round(float(cos_scores[idx]), 3),
                'same_cluster':         c_cl == u_cl,
                'is_real_user':         row['is_real'],
                'sleep_schedule':       row['sleep_schedule'],
                'study_type':           row['study_type'],
                'cleanliness':          int(row['cleanliness']),
                'smoking':              row['smoking'],
                'guests':               row['guests'],
                'diet':                 row['diet'],
                'budget':               {'min': int(r_bmin), 'max': int(r_bmax)},
                'past_rating':          round(row['past_rating'], 1),
                'openness':             round(row['openness'], 2),
                'conscientiousness':    round(row['conscientiousness'], 2),
                'extraversion':         round(row['extraversion'], 2),
                'agreeableness':        round(row['agreeableness'], 2),
                'neuroticism':          round(row['neuroticism'], 2),
                'breakdown': {
                    'Budget':      budget_s,
                    'Sleep':       sleep_s,
                    'Study':       study_s,
                    'Cleanliness': int(clean_s),
                },
                'explanation': (
                    f"You and {row['name']} share similar {'sleep schedules, ' if sleep_s==100 else ''}"
                    f"{'study preferences, ' if study_s==100 else ''}"
                    f"{'budget ranges, ' if budget_s>70 else ''}"
                    f"and personality traits — making you {score_label(final).lower()}."
                ).strip(', ') + '.',
            })

            if len(results) >= top_k:
                break

        # Real users first, then by score
        results.sort(key=lambda x: (x['is_real_user'], x['compatibility_score']), reverse=True)
        return results[:top_k]

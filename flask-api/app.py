"""RoomSync Flask ML API - Big Five OCEAN + Random Forest + Groq AI"""
import os, sys, json, urllib.request, smtplib
import joblib
import numpy as np
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
app = Flask(__name__)
CORS(app, origins=["*"])

# ── Config ─────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# ── Email Config (Gmail SMTP) ───────────────────────────
EMAIL_USER     =  'shravani.1252130006@vit.edu'  # your Gmail
EMAIL_PASSWORD = '1252130006'   # Gmail App Password (not regular password)
EMAIL_ENABLED  = True # set True after configuring above

matcher = None

def get_matcher():
    global matcher
    if matcher is None:
        try:
            from models.matcher import RoommateMatcherML
            matcher = RoommateMatcherML()
            print("[ML] ✅ Matcher loaded successfully")
        except Exception as e:
            print(f"[ML] ❌ Failed to load: {e}")
    return matcher

# ── Rent Predictor ML (Random Forest) ─────────────────────────────────────────
_rent_model    = None
_rent_meta     = None

def get_rent_model():
    """Lazy-load the Random Forest rent predictor and its metadata."""
    global _rent_model, _rent_meta
    if _rent_model is None:
        model_path = os.path.join(BASE_DIR, 'models', 'rent_predictor.pkl')
        meta_path  = os.path.join(BASE_DIR, 'models', 'rent_model_meta.json')
        try:
            _rent_model = joblib.load(model_path)
            with open(meta_path) as f:
                _rent_meta = json.load(f)
            print("[RentModel] ✅ rent_predictor.pkl loaded")
        except FileNotFoundError:
            print("[RentModel] ⚠️  Model not found — running train_rent_model.py …")
            try:
                from models.train_rent_model import train as _train_rent
                _rent_model, _rent_meta = _train_rent()
                print("[RentModel] ✅ Model trained on-the-fly")
            except Exception as e:
                print(f"[RentModel] ❌ Auto-train failed: {e}")
        except Exception as e:
            print(f"[RentModel] ❌ Load error: {e}")
    return _rent_model, _rent_meta

# ── Health Check ───────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health():
    m = get_matcher()
    return jsonify({
        'status': 'ok',
        'ml_loaded': m is not None,
        'algorithms': ['Random Forest', 'Big Five OCEAN', 'Cosine Similarity', 'K-Means'],
        'dataset': '1500 student profiles',
        'ai': 'Groq llama-3.1-8b',
        'email': 'enabled' if EMAIL_ENABLED else 'disabled'
    })

# ── Roommate Match ─────────────────────────────────────
@app.route('/api/match', methods=['POST'])
def match():
    data = request.json or {}
    print(f"[Match] uid={data.get('uid')} sleep={data.get('sleep_schedule')} year={data.get('year')}")

    budget = data.get('budget')
    if not isinstance(budget, dict) or not budget:
        budget = {'min': 5000, 'max': 10000}
    budget['min'] = budget.get('min') or 5000
    budget['max'] = budget.get('max') or 10000

    user = {
        'uid':               data.get('uid', ''),
        'name':              data.get('name', ''),
        'budget':            budget,
        'sleep_schedule':    data.get('sleep_schedule') or 'Flexible',
        'study_type':        data.get('study_type')     or 'Both',
        'cleanliness':       data.get('cleanliness')    or 3,
        'year':              data.get('year')           or 'SY',
        'schedule':          data.get('schedule')       or 'Mixed',
        'past_rating':       data.get('past_rating')    or 3.5,
        'smoking':           data.get('smoking')        or 'No',
        'guests':            data.get('guests')         or 'Sometimes',
        'openness':          data.get('openness')       or 3.0,
        'conscientiousness': data.get('conscientiousness') or 3.0,
        'extraversion':      data.get('extraversion')   or 3.0,
        'agreeableness':     data.get('agreeableness')  or 3.0,
        'neuroticism':       data.get('neuroticism')    or 3.0,
    }

    # Live Firebase profiles passed from frontend
    live_profiles = data.get('live_profiles', [])
    print(f"[Match] Live profiles received: {len(live_profiles)}")

    m = get_matcher()
    if m:
        try:
            m.inject_live_profiles(live_profiles)
            results = m.find_matches(user, top_k=10)
            method  = 'rf+gb_ensemble+big5+cosine+kmeans'
            real    = sum(1 for r in results if r.get('is_real_user'))
            print(f"[Match] ✅ {len(results)} matches ({real} real users)")
        except Exception as e:
            print(f"[ML Error] {e}")
            import traceback; traceback.print_exc()
            results = []; method = 'error'
    else:
        results = []; method = 'ml_unavailable'

    return jsonify({'matches': results, 'total': len(results), 'method': method})

# ── Groq AI Explanation ────────────────────────────────
@app.route('/api/groq-explain', methods=['POST'])
def groq_explain():
    data   = request.json or {}
    prompt = data.get('prompt', '')
    if not prompt:
        return jsonify({'explanation': None, 'error': 'No prompt'}), 400
    try:
        body = json.dumps({
            'model': 'llama-3.1-8b-instant',
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': 250, 'temperature': 0.7
        }).encode('utf-8')
        req = urllib.request.Request(
            'https://api.groq.com/openai/v1/chat/completions', data=body,
            headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {GROQ_API_KEY}'},
            method='POST')
        with urllib.request.urlopen(req, timeout=15) as res:
            result = json.loads(res.read().decode('utf-8'))
            return jsonify({'explanation': result['choices'][0]['message']['content'], 'model': 'llama-3.1-8b-instant'})
    except Exception as e:
        return jsonify({'explanation': None, 'error': str(e)}), 500

# ── Email Notification ─────────────────────────────────
@app.route('/api/send-visit-email', methods=['POST'])
def send_visit_email():
    data = request.json or {}
    student_name  = data.get('student_name',  'Student')
    student_email = data.get('student_email', '')
    owner_name    = data.get('owner_name',    'Owner')
    owner_email   = data.get('owner_email',   '')
    room_title    = data.get('room_title',    'Room')
    visit_date    = data.get('visit_date',    '')
    visit_time    = data.get('visit_time',    '')
    location      = data.get('location',      '')

    if not EMAIL_ENABLED:
        print(f"[Email] Visit scheduled (email disabled): {student_name} -> {room_title} on {visit_date}")
        return jsonify({'status': 'ok', 'note': 'Email disabled - configure Gmail in app.py'})

    try:
        def make_email(to_email, subject, html_body):
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From']    = f'RoomSync <{EMAIL_USER}>'
            msg['To']      = to_email
            msg.attach(MIMEText(html_body, 'html'))
            return msg

        STYLE = "font-family:Arial,sans-serif;background:#0f0c29;color:#fff;padding:30px;border-radius:16px"
        BOX   = "background:rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin:15px 0"
        BTN   = "background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block;margin-top:15px"

        # Email to student
        student_html = f"""
        <div style="{STYLE}">
          <h2 style="color:#60a5fa">🏠 Visit Confirmed — RoomSync</h2>
          <div style="{BOX}">
            <p>Hi <b>{student_name}</b>,</p>
            <p>Your room visit request has been sent successfully!</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#94a3b8">Room</td><td><b>{room_title}</b></td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8">Location</td><td>{location}</td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8">Date</td><td><b>{visit_date}</b></td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8">Time</td><td><b>{visit_time}</b></td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8">Owner</td><td>{owner_name}</td></tr>
            </table>
            <p style="color:#94a3b8;font-size:13px">The owner will confirm your visit shortly. You will receive another email when confirmed.</p>
          </div>
          <p style="color:#64748b;font-size:12px">— RoomSync Team | Find. Match. Live.</p>
        </div>"""

        # Email to owner
        owner_html = f"""
        <div style="{STYLE}">
          <h2 style="color:#a78bfa">📅 New Visit Request — RoomSync</h2>
          <div style="{BOX}">
            <p>Hi <b>{owner_name}</b>,</p>
            <p>A student wants to visit your listing!</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#94a3b8">Student</td><td><b>{student_name}</b></td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8">Room</td><td><b>{room_title}</b></td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8">Requested Date</td><td><b>{visit_date}</b></td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8">Requested Time</td><td><b>{visit_time}</b></td></tr>
            </table>
            <p style="color:#94a3b8;font-size:13px">Please log in to RoomSync to confirm or reschedule the visit.</p>
            <a href="http://localhost:3000/owner-dashboard" style="{BTN}">Go to Owner Dashboard</a>
          </div>
          <p style="color:#64748b;font-size:12px">— RoomSync Team | Find. Match. Live.</p>
        </div>"""

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            if student_email:
                server.sendmail(EMAIL_USER, student_email, make_email(student_email, f'Visit Request: {room_title}', student_html).as_string())
                print(f"[Email] ✅ Sent to student: {student_email}")
            if owner_email:
                server.sendmail(EMAIL_USER, owner_email, make_email(owner_email, f'New Visit Request from {student_name}', owner_html).as_string())
                print(f"[Email] ✅ Sent to owner: {owner_email}")

        return jsonify({'status': 'ok', 'sent_to': [student_email, owner_email]})
    except Exception as e:
        print(f"[Email Error] {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

# ── AI Rent Predictor (ML — Random Forest) ─────────────────────────────────
@app.route('/api/rent-predict', methods=['POST'])
def rent_predict():
    """
    Predict fair monthly rent for any Indian locality using a trained
    Random Forest regression model (R² ≈ 0.95, MAE ≈ ₹2,085).

    Input  (JSON): { city, area, room_type, furnishing, floor, year }
    Output (JSON): { predicted_rent, rent_min, rent_max, confidence, … }
    """
    import pandas as pd

    data      = request.json or {}
    city      = data.get('city',       'Pune')
    area      = data.get('area',       'Katraj')          # used for area_mult lookup
    room_type = data.get('room_type',  '1RK')
    furnish   = data.get('furnishing', 'Semi-Furnished')
    floor_val = data.get('floor',      '1st-2nd')
    year      = int(data.get('year',   2025))

    model, meta = get_rent_model()

    # ── Area → multiplier lookup (mirrors JS indiaGeodata premiums) ──────────
    AREA_MULT_FLAT = {
        # Pune
        'Koregaon Park':1.65,'Kalyani Nagar':1.55,'Baner':1.45,'Aundh':1.40,
        'Viman Nagar':1.40,'Kharadi':1.35,'Wakad':1.25,'Hinjewadi':1.30,
        'Magarpatta':1.30,'Balewadi':1.30,'Pashan':1.20,'Kothrud':1.20,
        'Shivajinagar':1.25,'FC Road':1.20,'Deccan':1.10,'Erandwane':1.25,
        'Katraj':0.82,'Kondhwa':0.88,'Hadapsar':0.90,'Pimpri':0.88,
        'Chinchwad':0.85,'Bhosari':0.82,'Nigdi':0.90,'Warje':1.00,
        # Mumbai
        'South Mumbai':2.20,'Colaba':2.40,'Bandra West':2.00,'Bandra East':1.70,
        'Juhu':1.90,'Santacruz':1.50,'Khar':1.80,'Vile Parle':1.50,
        'Andheri West':1.30,'Andheri East':1.20,'Goregaon':1.05,'Malad':1.00,
        'Kandivali':0.95,'Borivali':0.90,'Powai':1.45,'Thane':0.85,
        'Navi Mumbai':0.88,'Worli':1.95,'Dadar':1.30,'Lower Parel':1.55,
        # Bengaluru
        'Indiranagar':1.60,'Koramangala':1.65,'MG Road':1.70,'Whitefield':1.35,
        'HSR Layout':1.50,'JP Nagar':1.25,'Marathahalli':1.30,'Bellandur':1.35,
        'BTM Layout':1.30,'Electronic City':0.85,'Hebbal':1.20,'Yelahanka':1.00,
        'Malleshwaram':1.35,'Basavanagudi':1.20,'Jayanagar':1.30,'Sarjapur':1.25,
        # Hyderabad
        'Banjara Hills':1.60,'Jubilee Hills':1.65,'Madhapur':1.40,'Hitec City':1.45,
        'Gachibowli':1.35,'Kondapur':1.30,'Kukatpally':1.05,'Miyapur':1.00,
        'Ameerpet':1.15,'Uppal':0.88,'LB Nagar':0.90,'Secunderabad':1.10,
        # Chennai
        'Anna Nagar':1.40,'Adyar':1.45,'T Nagar':1.35,'Nungambakkam':1.55,
        'Velachery':1.15,'Sholinganallur':1.20,'OMR':1.15,'Tambaram':0.92,
        'Mylapore':1.30,'Besant Nagar':1.40,'Porur':1.05,'Mogappair':1.10,
        # Delhi NCR
        'South Delhi':1.70,'Greater Kailash':1.65,'Defence Colony':1.75,
        'Lajpat Nagar':1.30,'Saket':1.45,'Hauz Khas':1.55,'Vasant Kunj':1.40,
        'Rohini':0.98,'Dwarka':1.10,'Janakpuri':1.05,'Karol Bagh':1.15,
        'Golf Course Road':1.70,'Cyber City':1.50,'Sohna Road':1.20,
        'Sector 18':1.35,'Sector 62':1.20,'Indirapuram':1.20,'Vaishali':1.25,
        # Other cities
        'Malviya Nagar':1.35,'Vaishali Nagar':1.30,'C Scheme':1.45,'Civil Lines':1.40,
        'SG Highway':1.40,'Prahlad Nagar':1.45,'Bodakdev':1.35,'Satellite':1.25,
        'Navrangpura':1.35,'Bopal':1.10,'Gota':0.92,'Vatva':0.80,
        'Vijay Nagar':1.35,'Palasia':1.30,'Bhawarkuan':1.20,'AB Road':1.25,
        'Gomti Nagar':1.35,'Hazratganj':1.40,'Aliganj':1.20,'Indira Nagar':1.15,
        'Park Street':1.60,'Ballygunge':1.50,'Salt Lake City':1.35,'New Town':1.30,
        'Edapally':1.25,'Kakkanad':1.30,'Panampilly Nagar':1.40,'Vyttila':1.20,
        'Sector 17':1.50,'Sector 22':1.40,'Sector 35':1.30,'Mohali':1.15,
    }
    METRO_CITIES   = {'Mumbai','Delhi','Bengaluru','Chennai','Hyderabad','Kolkata'}
    COLLEGE_KEYS   = ['college','university','bhu','iit','nit','iim','campus','lanka','peelamedu']

    # Derive city_tier from meta (or fall back)
    city_tiers = (meta or {}).get('city_tiers', {})
    city_tier  = city_tiers.get(city, 2)

    # Derive area_mult — named area → known mult, else use city-tier midpoint
    area_mult = AREA_MULT_FLAT.get(area)
    if area_mult is None:
        tier_ranges = {1:(0.75,2.50),2:(0.80,1.80),3:(0.82,1.50),4:(0.85,1.35)}
        lo, hi     = tier_ranges.get(city_tier, (0.85,1.35))
        area_mult  = round((lo + hi) / 2, 3)   # neutral estimate for unknown areas

    # Normalise inputs (guard against unseen categoricals)
    valid_rooms    = ['1RK','1BHK','2BHK','3BHK','PG']
    valid_furnish  = ['Unfurnished','Semi-Furnished','Fully Furnished']
    valid_floors   = ['Ground','1st-2nd','3rd-5th','6th+']
    room_type = room_type  if room_type in valid_rooms   else '1BHK'
    furnish   = furnish    if furnish   in valid_furnish  else 'Semi-Furnished'
    floor_val = floor_val  if floor_val in valid_floors   else '1st-2nd'
    year      = year       if 2022 <= year <= 2026        else 2025

    is_metro        = city in METRO_CITIES
    is_college_zone = any(k in area.lower() for k in COLLEGE_KEYS)

    # ── ML Prediction ────────────────────────────────────────────────────────
    if model is not None:
        X = pd.DataFrame([{
            'city':       city,
            'city_tier':  city_tier,
            'room_type':  room_type,
            'furnishing': furnish,
            'floor':      floor_val,
            'year':       year,
            'area_mult':  area_mult,
        }])
        predicted_raw = float(model.predict(X)[0])

        # Derive uncertainty from tree variance (std of individual tree preds)
        try:
            tree_preds = np.array([
                t.predict(model.named_steps['pre'].transform(X))[0]
                for t in model.named_steps['model'].estimators_
            ])
            std_dev   = float(np.std(tree_preds))
            rent_min  = max(1000, round((predicted_raw - 1.5 * std_dev) / 500) * 500)
            rent_max  = round((predicted_raw + 1.5 * std_dev) / 500) * 500
            # Confidence: inversely proportional to CV (coefficient of variation)
            cv        = std_dev / max(predicted_raw, 1)
            confidence= max(60, min(98, round(100 - cv * 150)))
        except Exception:
            rent_min   = round(predicted_raw * 0.87 / 500) * 500
            rent_max   = round(predicted_raw * 1.16 / 500) * 500
            confidence = 88

        predicted = round(predicted_raw / 500) * 500
        source    = 'rf_ml_model_v1'
        model_r2  = (meta or {}).get('metrics', {}).get('r2', None)
        model_mae = (meta or {}).get('metrics', {}).get('mae', None)

    else:
        # ── Graceful fallback (model unavailable) ────────────────────────────
        CITY_BASE = {'Pune':5500,'Mumbai':14000,'Bengaluru':8500,'Delhi':9000,
                     'Hyderabad':6500,'Chennai':7500,'Kolkata':6000}
        ROOM_M    = {'1RK':1.0,'1BHK':1.7,'2BHK':2.8,'3BHK':4.3,'PG':0.82}
        FURN_M    = {'Unfurnished':0.82,'Semi-Furnished':1.0,'Fully Furnished':1.28}
        FLOOR_M   = {'Ground':0.92,'1st-2nd':1.0,'3rd-5th':1.06,'6th+':0.96}
        YEAR_M    = {2022:0.91,2023:0.94,2024:1.0,2025:1.06,2026:1.10}
        base      = CITY_BASE.get(city, 6000)
        predicted_raw = (base * ROOM_M.get(room_type,1.0) * FURN_M.get(furnish,1.0)
                         * FLOOR_M.get(floor_val,1.0) * YEAR_M.get(year,1.0) * area_mult)
        predicted  = round(predicted_raw / 500) * 500
        rent_min   = round(predicted * 0.87 / 500) * 500
        rent_max   = round(predicted * 1.16 / 500) * 500
        confidence = 75
        source     = 'rule_based_fallback'
        model_r2   = None
        model_mae  = None

    print(f"[RentPredict] {city}/{area}/{room_type} → ₹{predicted:,} "
          f"(₹{rent_min:,}–₹{rent_max:,})  conf={confidence}%  src={source}")

    return jsonify({
        'city':            city,
        'area':            area,
        'room_type':       room_type,
        'furnishing':      furnish,
        'floor':           floor_val,
        'year':            year,
        'predicted_rent':  predicted,
        'rent_min':        rent_min,
        'rent_max':        rent_max,
        'market_average':  predicted,
        'confidence':      confidence,
        'is_metro':        is_metro,
        'is_college_zone': is_college_zone,
        'area_multiplier': round(area_mult, 2),
        'model_r2':        model_r2,
        'model_mae':       model_mae,
        'source':          source,
    })

# ── Model Report ───────────────────────────────────────
@app.route('/api/model/report', methods=['GET'])
def model_report():
    path = os.path.join(BASE_DIR, 'models', 'evaluation_report.json')
    if os.path.exists(path):
        with open(path) as f: return jsonify(json.load(f))
    return jsonify({'status': 'not_trained'})

if __name__ == '__main__':
    print("=" * 55)
    print("  RoomSync ML API — http://localhost:5001")
    print("  AI: Groq llama-3.1 (works in India 🇮🇳)")
    print("  ML: Random Forest + Big Five OCEAN")
    print("  Email: Gmail SMTP (configure in app.py)")
    print("=" * 55)
    get_matcher()
    app.run(host='0.0.0.0', port=5001, debug=True)

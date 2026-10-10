"""
Generate 2000 realistic student profiles with Big Five OCEAN traits
5 personality archetypes for fine-tuning:
  1. Scholar    — high C, high O, low E
  2. Social     — high E, high A, low N
  3. Homebody   — high C, low E, low O
  4. Creative   — high O, high E, low C
  5. Anxious    — high N, low A, moderate others
"""
import pandas as pd, numpy as np, os, random

random.seed(42); np.random.seed(42)
BASE = os.path.dirname(os.path.abspath(__file__))

NAMES = ['Aarav','Aditya','Akash','Amit','Ananya','Ankit','Arjun','Ayesha','Deepak','Dhruv',
         'Farhan','Gaurav','Harsh','Ishaan','Jaya','Kabir','Kartik','Kavya','Kiran','Kunal',
         'Lakshmi','Manav','Meera','Mihir','Nandini','Neha','Nikhil','Nisha','Omkar','Pooja',
         'Pranav','Priya','Rahul','Raj','Raksha','Ravi','Ritesh','Rohan','Rohit','Ruchi',
         'Sachin','Sahil','Saloni','Saniya','Sanya','Sara','Shivam','Shreya','Simran','Sneha',
         'Sonia','Soumya','Swati','Tanvi','Tarun','Tushar','Uday','Varun','Vidya','Vikram',
         'Vinay','Vishal','Yash','Zara','Zoya','Abhishek','Aishwarya','Ajay','Akshay','Alisha']
COLLEGES = ['Mumbai University','NMIMS','VJTI','ICT Mumbai','KC College','Mithibai College',
            'Jai Hind College','Fergusson College Pune','COEP Pune','Symbiosis Pune',
            'SP College Pune','IIT Bombay','BITS Pilani Goa','Xavier Mumbai','Thakur College']
SLEEP   = ['Early Bird','Flexible','Night Owl']
STUDY   = ['Silent Study','Both','Group Study']
YEARS   = ['FY','SY','TY','Final Year']
SCHED   = ['Morning Classes','Afternoon Classes','Evening Classes','Mixed']
SMOKE   = ['No','No','No','Occasionally','Yes']     # weighted — mostly No
GUESTS  = ['Rarely','Sometimes','Often']
DIET    = ['Veg','Non-Veg','Eggetarian','Vegan']

SLEEP_E  = {'Early Bird':0,'Flexible':1,'Night Owl':2}
STUDY_E  = {'Silent Study':0,'Both':1,'Group Study':2}
YEAR_E   = {'FY':1,'SY':2,'TY':3,'Final Year':4}
SCHED_E  = {'Morning Classes':0,'Afternoon Classes':1,'Evening Classes':2,'Mixed':3}
SMOKE_E  = {'No':0,'Occasionally':1,'Yes':2}
GUESTS_E = {'Rarely':0,'Sometimes':1,'Often':2}

def clip(val, lo=1.0, hi=5.0): return round(float(np.clip(val, lo, hi)), 2)

def make_profile(uid, archetype):
    name = random.choice(NAMES) + ' ' + random.choice(['Sharma','Mehta','Patel','Joshi','Nair',
           'Desai','Singh','Gupta','Kumar','Verma','Kulkarni','Rao','Shah','Khan','Mishra'])
    college = random.choice(COLLEGES)
    year    = random.choice(YEARS)
    sleep   = random.choice(SLEEP)
    study   = random.choice(STUDY)
    sched   = random.choice(SCHED)
    smoke   = random.choice(SMOKE)
    guests  = random.choice(GUESTS)
    diet    = random.choice(DIET)
    b_min   = random.choice([3000,4000,5000,6000,7000,8000])
    b_max   = b_min + random.choice([2000,3000,4000,5000,6000])
    clean   = clip(np.random.normal(3.5,1.0))
    rating  = clip(np.random.normal(3.8,0.7), 1.0, 5.0)

    # Personality by archetype
    if archetype == 'scholar':
        O = clip(np.random.normal(4.2,0.5)); C = clip(np.random.normal(4.5,0.4))
        E = clip(np.random.normal(2.0,0.6)); A = clip(np.random.normal(3.5,0.5))
        N = clip(np.random.normal(2.5,0.6))
        sleep='Early Bird'; study='Silent Study'; clean=clip(np.random.normal(4.2,0.5))
    elif archetype == 'social':
        O = clip(np.random.normal(3.5,0.5)); C = clip(np.random.normal(3.0,0.6))
        E = clip(np.random.normal(4.5,0.4)); A = clip(np.random.normal(4.2,0.4))
        N = clip(np.random.normal(2.0,0.5))
        guests='Often'; study='Group Study'
    elif archetype == 'homebody':
        O = clip(np.random.normal(2.5,0.6)); C = clip(np.random.normal(4.0,0.5))
        E = clip(np.random.normal(1.8,0.5)); A = clip(np.random.normal(3.5,0.5))
        N = clip(np.random.normal(2.8,0.6))
        guests='Rarely'; sleep='Early Bird'
    elif archetype == 'creative':
        O = clip(np.random.normal(4.8,0.3)); C = clip(np.random.normal(2.5,0.7))
        E = clip(np.random.normal(4.0,0.5)); A = clip(np.random.normal(3.8,0.5))
        N = clip(np.random.normal(3.0,0.7))
        sleep='Night Owl'; study='Both'
    else:  # anxious
        O = clip(np.random.normal(3.0,0.6)); C = clip(np.random.normal(3.2,0.6))
        E = clip(np.random.normal(2.5,0.6)); A = clip(np.random.normal(2.8,0.6))
        N = clip(np.random.normal(4.5,0.4))
        clean=clip(np.random.normal(4.0,0.5))

    return {
        'uid':uid,'name':name,'college':college,'year':year,
        'sleep_schedule':sleep,'study_type':study,'schedule':sched,
        'smoking':smoke,'guests_frequency':guests,'diet':diet,
        'budget_min':b_min,'budget_max':b_max,'cleanliness':clean,
        'past_rating':rating,
        'openness':O,'conscientiousness':C,'extraversion':E,
        'agreeableness':A,'neuroticism':N,
        'sleep_enc':SLEEP_E[sleep],'study_enc':STUDY_E[study],
        'year_enc':YEAR_E[year],'sched_enc':SCHED_E[sched],
        'smoke_enc':SMOKE_E[smoke],'guests_enc':GUESTS_E[guests],
    }

archetypes = ['scholar','social','homebody','creative','anxious']
profiles = []
for i in range(2000):
    arch = archetypes[i % 5]
    profiles.append(make_profile(f'syn_{i:04d}', arch))

df = pd.DataFrame(profiles)
df.to_csv(os.path.join(BASE,'student_profiles.csv'), index=False)
print(f"✅ Generated {len(df)} profiles")

# ── Compatibility pairs ────────────────────────────────
FEAT = ['openness','conscientiousness','extraversion','agreeableness','neuroticism',
        'sleep_enc','study_enc','cleanliness','budget_min','budget_max','smoke_enc','guests_enc']

pairs = []
uids  = df['uid'].tolist()
for _ in range(10000):
    i,j = random.sample(range(len(df)), 2)
    a,b = df.iloc[i], df.iloc[j]

    # Big Five similarity (lower diff = better)
    ocean_sim = 1 - np.mean([abs(a[k]-b[k])/4 for k in
                ['openness','conscientiousness','extraversion','agreeableness','neuroticism']])
    sleep_s  = 1.0 if a['sleep_enc']==b['sleep_enc'] else (0.5 if abs(a['sleep_enc']-b['sleep_enc'])==1 else 0.0)
    study_s  = 1.0 if a['study_enc']==b['study_enc'] else 0.3
    clean_s  = 1 - abs(a['cleanliness']-b['cleanliness'])/4
    budget_s = max(0, min(b['budget_max'],a['budget_max'])-max(b['budget_min'],a['budget_min'])) / \
               max(1, ((a['budget_max']-a['budget_min'])+(b['budget_max']-b['budget_min']))/2)
    smoke_s  = 1.0 if a['smoke_enc']==b['smoke_enc'] else 0.2
    guest_s  = 1.0 if a['guests_enc']==b['guests_enc'] else 0.5

    score = (0.35*ocean_sim + 0.20*sleep_s + 0.15*study_s +
             0.12*clean_s   + 0.10*budget_s + 0.05*smoke_s + 0.03*guest_s)
    score = round(score * 100, 1)
    match = 1 if score >= 55 else 0
    pairs.append({'uid_1':a['uid'],'uid_2':b['uid'],'compatibility':score,'match':match})

pd.DataFrame(pairs).to_csv(os.path.join(BASE,'compatibility_labels.csv'), index=False)
print(f"✅ Generated {len(pairs)} compatibility pairs")

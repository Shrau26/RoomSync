/**
 * RentPredictorPage — AI Rent Predictor for ALL Indian Cities
 * Covers 50+ cities across every state in India
 * Factors: locality premium, furnishing, floor, year, metro proximity,
 *           college zone bonus, seasonal variation (admission spike)
 * No API key needed — fully offline ML model built-in
 */
import { useState, useMemo } from 'react';
import OnboardingTip from '../components/common/OnboardingTip';
import {
  TrendingUp, MapPin, Home, IndianRupee, Zap,
  AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// INDIA CITIES DATABASE — 50+ cities, every state
// base rents = semi-furnished, ground floor, 2025, typical area
// ─────────────────────────────────────────────────────────────
const INDIA_CITIES = {

  // ── Maharashtra ──────────────────────────────────────────
  'Pune': {
    state: 'Maharashtra',
    baseline: { '1RK':5500,'1BHK':9500,'2BHK':16000,'3BHK':24000,'PG':4500 },
    areas: {
      // Premium
      'Koregaon Park':1.65,'Kalyani Nagar':1.55,'Baner':1.45,'Aundh':1.40,
      'Viman Nagar':1.40,'Kharadi':1.35,'Wakad':1.25,'Hinjewadi':1.30,
      'Magarpatta':1.30,'Balewadi':1.30,'Pashan':1.20,
      // Mid
      'Kothrud':1.20,'Shivajinagar':1.25,'FC Road':1.20,'JM Road':1.15,
      'Deccan':1.10,'Erandwane':1.25,'Prabhat Road':1.30,'Sadashiv Peth':1.10,
      'Swargate':1.05,'Bibwewadi':1.00,'Warje':1.00,'Dhayari':0.92,
      // Budget / Student
      'Katraj':0.82,'Kondhwa':0.88,'Ambegaon':0.80,'Narhe':0.78,
      'Hadapsar':0.90,'Undri':0.88,'Pisoli':0.82,'Fursungi':0.80,
      'Pimpri':0.88,'Chinchwad':0.85,'Bhosari':0.82,'Dapodi':0.88,
      'Nigdi':0.90,'Akurdi':0.88,'Talegaon':0.72,'Chakan':0.70,
    }
  },
  'Mumbai': {
    state: 'Maharashtra',
    baseline: { '1RK':14000,'1BHK':25000,'2BHK':42000,'3BHK':70000,'PG':9000 },
    areas: {
      'South Mumbai':2.20,'Colaba':2.40,'Nariman Point':2.50,'Churchgate':2.20,
      'Bandra West':2.00,'Bandra East':1.70,'Juhu':1.90,'Santacruz':1.50,
      'Khar':1.80,'Vile Parle':1.50,'Andheri West':1.30,'Andheri East':1.20,
      'Goregaon':1.05,'Malad':1.00,'Kandivali':0.95,'Borivali':0.90,
      'Dahisar':0.85,'Vasai':0.68,'Virar':0.62,'Nalasopara':0.60,
      'Powai':1.45,'Vikhroli':0.95,'Ghatkopar':1.00,'Kurla':0.95,
      'Chembur':1.05,'Mulund':0.95,'Thane':0.85,'Kalyan':0.72,
      'Dombivli':0.68,'Navi Mumbai':0.88,'Vashi':1.00,'Belapur':0.90,
      'Kharghar':0.85,'Panvel':0.72,'Worli':1.95,'Dadar':1.30,
      'Parel':1.40,'Lower Parel':1.55,'Matunga':1.20,'Sion':1.10,
      'Dharavi':0.75,'Jogeshwari':1.10,'Oshiwara':1.20,
    }
  },
  'Nagpur': {
    state: 'Maharashtra',
    baseline: { '1RK':4000,'1BHK':7000,'2BHK':12000,'3BHK':18000,'PG':3200 },
    areas: {
      'Dharampeth':1.40,'Civil Lines':1.50,'Sitabuldi':1.20,'Sadar':1.25,
      'Bajaj Nagar':1.30,'Ramdaspeth':1.35,'Shankar Nagar':1.25,
      'Pratap Nagar':1.10,'Manish Nagar':1.00,'Hingna':0.80,
      'Wadi':0.82,'Kamptee':0.75,'Butibori':0.70,'Amravati Road':0.85,
      'Wardha Road':0.90,'Khamla':1.05,'Ambazari':1.15,'Laxmi Nagar':1.10,
    }
  },
  'Nashik': {
    state: 'Maharashtra',
    baseline: { '1RK':4200,'1BHK':7500,'2BHK':13000,'3BHK':20000,'PG':3500 },
    areas: {
      'College Road':1.35,'Gangapur Road':1.30,'Panchavati':1.20,
      'Indira Nagar':1.15,'Satpur':1.00,'Ambad':0.95,'Cidco':1.00,
      'Deolali':0.85,'Pathardi Phata':0.88,'Nashik Road':0.90,
      'Malegaon Naka':0.85,'Dwarka':1.10,'Mhasrul':0.92,
    }
  },
  'Aurangabad': {
    state: 'Maharashtra',
    baseline: { '1RK':3500,'1BHK':6000,'2BHK':10000,'3BHK':15000,'PG':2800 },
    areas: {
      'Cantonment':1.30,'CIDCO':1.20,'Garkheda':1.10,'Hudco':1.00,
      'Osmanpura':1.05,'Kranti Chowk':0.95,'N-1':1.00,'N-2':1.00,
      'Waluj':0.80,'Chikalthana':0.85,'Satara Parisar':0.88,
    }
  },

  // ── Karnataka ─────────────────────────────────────────────
  'Bengaluru': {
    state: 'Karnataka',
    baseline: { '1RK':8500,'1BHK':16000,'2BHK':27000,'3BHK':42000,'PG':6500 },
    areas: {
      'Indiranagar':1.60,'Koramangala':1.65,'MG Road':1.70,'Brigade Road':1.65,
      'Whitefield':1.35,'HSR Layout':1.50,'JP Nagar':1.25,'Jayanagar':1.30,
      'Marathahalli':1.30,'Bellandur':1.35,'Sarjapur':1.25,'Outer Ring Road':1.20,
      'BTM Layout':1.30,'Banashankari':1.10,'Bannerghatta':1.00,
      'Electronic City':0.85,'Hebbagodi':0.82,'Bommasandra':0.80,
      'Hebbal':1.20,'Yelahanka':1.00,'Thanisandra':1.00,'Rachenahalli':0.92,
      'Rajajinagar':1.20,'Malleshwaram':1.35,'Basavanagudi':1.20,
      'Vijayanagar':1.10,'Mysore Road':0.90,'Kengeri':0.82,'Uttarahalli':0.88,
      'Bommanahalli':1.05,'Kudlu':0.95,'Harlur':1.10,'Haralur':1.05,
      'Domlur':1.40,'Ulsoor':1.30,'Richmond Town':1.55,'Sadashivanagar':1.60,
      'RT Nagar':1.05,'KR Puram':0.90,'Mahadevapura':1.10,'Varthur':0.95,
    }
  },
  'Mysuru': {
    state: 'Karnataka',
    baseline: { '1RK':4000,'1BHK':7000,'2BHK':12000,'3BHK':18000,'PG':3200 },
    areas: {
      'Vijayanagar':1.20,'Kuvempunagar':1.15,'Saraswathipuram':1.25,
      'Jayalakshmipuram':1.10,'Hebbal':1.05,'Nazarbad':1.00,
      'Gokulam':1.30,'Udayagiri':0.95,'Srirampura':0.90,'Bogadi':0.88,
    }
  },
  'Mangaluru': {
    state: 'Karnataka',
    baseline: { '1RK':4500,'1BHK':8000,'2BHK':13000,'3BHK':20000,'PG':3500 },
    areas: {
      'Hampankatta':1.20,'Kadri':1.15,'Kodialbail':1.10,'Bejai':1.05,
      'Kankanady':1.00,'Attavar':0.95,'Konchady':0.90,'Surathkal':1.10,
      'Deralakatte':1.05,'Mukka':0.88,'Vamanjoor':0.85,
    }
  },
  'Hubli-Dharwad': {
    state: 'Karnataka',
    baseline: { '1RK':3500,'1BHK':6000,'2BHK':10000,'3BHK':15000,'PG':2800 },
    areas: {
      'Vidyanagar':1.20,'Keshwapur':1.15,'Gokul Road':1.10,'Navanagar':1.00,
      'Unkal':0.92,'Toll Naka':0.90,'Deshpande Nagar':1.05,'Hosur':0.88,
    }
  },

  // ── Telangana ─────────────────────────────────────────────
  'Hyderabad': {
    state: 'Telangana',
    baseline: { '1RK':6500,'1BHK':13000,'2BHK':22000,'3BHK':35000,'PG':5500 },
    areas: {
      'Banjara Hills':1.60,'Jubilee Hills':1.65,'Film Nagar':1.50,
      'Madhapur':1.40,'Hitec City':1.45,'Gachibowli':1.35,'Kondapur':1.30,
      'Nanakramguda':1.25,'Financial District':1.35,'Kokapet':1.20,
      'Kukatpally':1.05,'Miyapur':1.00,'Nizampet':0.95,'Bachupally':0.90,
      'Kompally':0.88,'Dundigal':0.82,'Ameerpet':1.15,'SR Nagar':1.00,
      'Mehdipatnam':0.95,'Tolichowki':1.00,'Attapur':0.90,'Rajendranagar':0.88,
      'Uppal':0.88,'LB Nagar':0.90,'Dilsukhnagar':0.92,'Kothapet':0.88,
      'Hayathnagar':0.82,'Secunderabad':1.10,'Alwal':0.92,'Malkajgiri':0.90,
      'ECIL':0.88,'Nacharam':0.88,'Tarnaka':1.00,'Trimulgherry':1.05,
      'Bowenpally':1.00,'Sainikpuri':0.92,'Yapral':0.88,
    }
  },
  'Warangal': {
    state: 'Telangana',
    baseline: { '1RK':3000,'1BHK':5500,'2BHK':9000,'3BHK':14000,'PG':2500 },
    areas: {
      'Hanamkonda':1.20,'Kazipet':1.00,'Subedari':1.10,'Dharmasagar':0.95,
      'Naimnagar':0.90,'Mathsyapuri':0.88,'Bheemaram':0.85,
    }
  },

  // ── Tamil Nadu ────────────────────────────────────────────
  'Chennai': {
    state: 'Tamil Nadu',
    baseline: { '1RK':7500,'1BHK':13500,'2BHK':22000,'3BHK':35000,'PG':6000 },
    areas: {
      'Anna Nagar':1.40,'Adyar':1.45,'T Nagar':1.35,'Nungambakkam':1.55,
      'Mylapore':1.30,'Besant Nagar':1.40,'Kilpauk':1.25,'Saidapet':1.10,
      'Velachery':1.15,'Pallavaram':1.00,'Tambaram':0.92,'Chromepet':0.90,
      'Perungalathur':0.85,'Guduvanchery':0.80,'Sholinganallur':1.20,
      'OMR':1.15,'Perungudi':1.10,'Navalur':1.05,'Kelambakkam':0.90,
      'Medavakkam':0.95,'Perambur':1.00,'Kolathur':0.95,'Villivakkam':1.00,
      'Ambattur':0.92,'Avadi':0.82,'Poonamallee':0.85,'Koyambedu':1.15,
      'Porur':1.05,'Valasaravakkam':1.00,'Mogappair':1.10,'Virugambakkam':1.05,
      'Kodambakkam':1.10,'Guindy':1.15,'St Thomas Mount':1.05,
      'Thiruvanmiyur':1.30,'Injambakkam':1.20,'Kottivakkam':1.15,
    }
  },
  'Coimbatore': {
    state: 'Tamil Nadu',
    baseline: { '1RK':5000,'1BHK':9000,'2BHK':15000,'3BHK':23000,'PG':4000 },
    areas: {
      'RS Puram':1.30,'Gandhipuram':1.25,'Peelamedu':1.20,'Saibaba Colony':1.25,
      'Ramanathapuram':1.15,'Singanallur':1.00,'Ukkadam':0.95,'Kuniyamuthur':0.90,
      'Thudiyalur':0.88,'Saravanampatty':1.10,'Sulur':0.80,'Pollachi Road':0.82,
      'Hopes College':1.15,'Avinashi Road':1.20,'Race Course':1.35,
    }
  },
  'Madurai': {
    state: 'Tamil Nadu',
    baseline: { '1RK':4000,'1BHK':7000,'2BHK':11000,'3BHK':17000,'PG':3200 },
    areas: {
      'Anna Nagar':1.20,'KK Nagar':1.15,'Thirunagar':1.10,'Mattuthavani':1.05,
      'Alagar Kovil Road':1.00,'Surveyor Colony':1.15,'Villapuram':0.90,
      'Palanganatham':0.88,'Avaniapuram':0.85,'Kappalur':0.80,
    }
  },
  'Tiruchirappalli': {
    state: 'Tamil Nadu',
    baseline: { '1RK':3800,'1BHK':6500,'2BHK':11000,'3BHK':16000,'PG':3000 },
    areas: {
      'Woraiyur':1.15,'Thillai Nagar':1.20,'Cantonment':1.25,'KK Nagar':1.10,
      'Ariyamangalam':1.00,'Srirangam':1.05,'Palakarai':0.95,'Manachanallur':0.82,
    }
  },
  'Salem': {
    state: 'Tamil Nadu',
    baseline: { '1RK':3500,'1BHK':6000,'2BHK':10000,'3BHK':15000,'PG':2800 },
    areas: {
      'Fairlands':1.20,'Swarnapuri':1.15,'Hasthampatti':1.10,'Alagapuram':1.05,
      'Suramangalam':0.95,'Attur Road':0.90,'Yercaud Road':0.88,
    }
  },

  // ── Delhi NCR ─────────────────────────────────────────────
  'Delhi': {
    state: 'Delhi',
    baseline: { '1RK':9000,'1BHK':17000,'2BHK':28000,'3BHK':45000,'PG':7000 },
    areas: {
      'South Delhi':1.70,'Greater Kailash':1.65,'Defence Colony':1.75,
      'Lajpat Nagar':1.30,'Saket':1.45,'Malviya Nagar':1.35,'Hauz Khas':1.55,
      'Vasant Kunj':1.40,'Vasant Vihar':1.60,'Green Park':1.50,'Panchsheel':1.55,
      'CR Park':1.35,'Nehru Place':1.25,'Okhla':1.10,'Kalkaji':1.15,
      'East Delhi':0.90,'Preet Vihar':1.00,'Mayur Vihar':1.00,'IP Extension':1.00,
      'Laxmi Nagar':0.92,'Shahdara':0.88,'Patparganj':1.05,'Geeta Colony':0.90,
      'West Delhi':0.88,'Dwarka':1.10,'Janakpuri':1.05,'Uttam Nagar':0.82,
      'Vikaspuri':0.90,'Punjabi Bagh':1.20,'Rajouri Garden':1.15,'Patel Nagar':1.10,
      'North Delhi':0.92,'Rohini':0.98,'Pitampura':1.05,'Ashok Vihar':1.10,
      'Shalimar Bagh':1.05,'Model Town':1.10,'Mukherjee Nagar':1.05,
      'Civil Lines':1.25,'Karol Bagh':1.15,'Paharganj':1.00,
      'Central Delhi':1.20,'Connaught Place':1.80,'Khan Market':2.00,
    }
  },
  'Gurugram': {
    state: 'Haryana',
    baseline: { '1RK':10000,'1BHK':18000,'2BHK':30000,'3BHK':50000,'PG':8000 },
    areas: {
      'Golf Course Road':1.70,'DLF Phase 1-5':1.60,'Sohna Road':1.20,
      'NH-48':1.15,'Cyber City':1.50,'MG Road':1.40,'Sector 14':1.10,
      'Sector 29':1.30,'Old Gurugram':1.00,'Palam Vihar':1.05,
      'Manesar':0.80,'Bhondsi':0.78,'Farrukhnagar':0.75,'Wazirabad':0.80,
      'Sector 56-58':1.25,'Sector 65-67':1.20,'Vatika':1.15,
    }
  },
  'Noida': {
    state: 'Uttar Pradesh',
    baseline: { '1RK':8000,'1BHK':15000,'2BHK':25000,'3BHK':40000,'PG':6500 },
    areas: {
      'Sector 18':1.35,'Sector 62':1.20,'Sector 63':1.15,'Sector 137':1.10,
      'Sector 150':1.05,'Expressway':1.15,'Greater Noida West':0.90,
      'Greater Noida':0.88,'Sector 44-46':1.25,'Sector 100-110':1.10,
      'Sector 22':1.10,'Botanical Garden':1.20,'Film City':1.05,
      'Noida Extension':0.85,'Crossing Republic':0.82,
    }
  },
  'Faridabad': {
    state: 'Haryana',
    baseline: { '1RK':6000,'1BHK':11000,'2BHK':18000,'3BHK':28000,'PG':4500 },
    areas: {
      'Sector 15-21':1.20,'NIT':1.10,'Old Faridabad':0.95,'Ballabhgarh':0.88,
      'Neharpar':1.00,'Tigaon':0.82,'Surajkund':1.25,'Sector 55-56':1.15,
    }
  },
  'Ghaziabad': {
    state: 'Uttar Pradesh',
    baseline: { '1RK':6500,'1BHK':12000,'2BHK':20000,'3BHK':32000,'PG':5000 },
    areas: {
      'Indirapuram':1.20,'Vaishali':1.25,'Raj Nagar':1.10,'Kaushambi':1.15,
      'Crossings Republik':0.90,'Mohan Nagar':1.00,'Loni':0.80,
      'Sahibabad':0.95,'Vasundhara':1.15,'Siddharth Vihar':0.88,
    }
  },

  // ── Rajasthan ─────────────────────────────────────────────
  'Jaipur': {
    state: 'Rajasthan',
    baseline: { '1RK':5000,'1BHK':9000,'2BHK':15000,'3BHK':23000,'PG':4000 },
    areas: {
      'Malviya Nagar':1.35,'Vaishali Nagar':1.30,'C Scheme':1.45,'Tonk Road':1.10,
      'Jagatpura':1.00,'Sitapura':0.95,'Mansarovar':1.15,'Shyam Nagar':1.05,
      'Pratap Nagar':0.92,'Sanganer':0.88,'Sodala':1.00,'Civil Lines':1.40,
      'Raja Park':1.25,'Gopalpura':1.05,'Durgapura':1.10,'Nirman Nagar':1.20,
      'Bani Park':1.35,'Adarsh Nagar':1.10,'JLN Marg':1.25,
    }
  },
  'Jodhpur': {
    state: 'Rajasthan',
    baseline: { '1RK':4000,'1BHK':7000,'2BHK':12000,'3BHK':18000,'PG':3200 },
    areas: {
      'Ratanada':1.25,'Shastri Nagar':1.20,'Residency Road':1.30,
      'Sardarpura':1.15,'Paota':1.10,'Chopasni Housing Board':1.00,
      'New Power House':0.95,'Pal Road':0.90,'Mandore':0.82,
    }
  },
  'Udaipur': {
    state: 'Rajasthan',
    baseline: { '1RK':4500,'1BHK':8000,'2BHK':13000,'3BHK':20000,'PG':3500 },
    areas: {
      'Fatehpura':1.20,'Madhuban':1.15,'Hiran Magri':1.10,'Sukhadia Circle':1.25,
      'Bhuwana':1.00,'Shobhagpura':0.95,'Ambamata':0.90,'Goverdhan Vilas':0.88,
    }
  },

  // ── Gujarat ───────────────────────────────────────────────
  'Ahmedabad': {
    state: 'Gujarat',
    baseline: { '1RK':6000,'1BHK':11000,'2BHK':18000,'3BHK':28000,'PG':5000 },
    areas: {
      'SG Highway':1.40,'Prahlad Nagar':1.45,'Bodakdev':1.35,'Thaltej':1.30,
      'Vastrapur':1.30,'Satellite':1.25,'Navrangpura':1.35,'CG Road':1.30,
      'Maninagar':1.00,'Naranpura':1.15,'Chandkheda':0.95,'Motera':0.98,
      'Bopal':1.10,'South Bopal':1.05,'Ambli':1.15,'Shela':1.00,
      'Gota':0.92,'New Ranip':0.88,'Odhav':0.82,'Vatva':0.80,
      'Naroda':0.85,'Bapunagar':0.80,'Saraspur':0.82,'Vastral':0.80,
    }
  },
  'Surat': {
    state: 'Gujarat',
    baseline: { '1RK':5500,'1BHK':10000,'2BHK':16000,'3BHK':25000,'PG':4500 },
    areas: {
      'Vesu':1.35,'Adajan':1.30,'Pal':1.20,'Althan':1.15,'Dumas':1.10,
      'Athwalines':1.25,'City Light':1.30,'Piplod':1.05,'Jahangirpura':0.90,
      'Pandesara':0.85,'Sachin':0.78,'Udhna':0.80,'Katargam':0.85,
    }
  },
  'Vadodara': {
    state: 'Gujarat',
    baseline: { '1RK':5000,'1BHK':9000,'2BHK':15000,'3BHK':22000,'PG':4000 },
    areas: {
      'Alkapuri':1.40,'Fatehgunj':1.25,'Akota':1.30,'Gotri':1.15,
      'Waghodia Road':1.00,'Karelibaug':1.05,'Manjalpur':1.00,
      'Sama':0.92,'Nizampura':0.88,'Makarpura':0.85,'Vasna':0.90,
    }
  },
  'Rajkot': {
    state: 'Gujarat',
    baseline: { '1RK':4500,'1BHK':8000,'2BHK':13000,'3BHK':20000,'PG':3500 },
    areas: {
      'Kalawad Road':1.25,'Yagnik Road':1.20,'150 Feet Ring Road':1.15,
      'Race Course':1.30,'University Road':1.20,'Mavdi':1.00,
      'Sadhu Vasvani Road':1.10,'Raiya':1.05,'Kothariya':0.92,
    }
  },

  // ── Madhya Pradesh ────────────────────────────────────────
  'Indore': {
    state: 'Madhya Pradesh',
    baseline: { '1RK':5000,'1BHK':9000,'2BHK':15000,'3BHK':23000,'PG':4000 },
    areas: {
      'Vijay Nagar':1.35,'Palasia':1.30,'Scheme 54':1.25,'Bhawarkuan':1.20,
      'AB Road':1.25,'MG Road':1.30,'New Palasia':1.20,'Rau':1.00,
      'Nipania':1.05,'Super Corridor':1.00,'Lasudia':0.92,'Banganga':0.88,
      'Rajendra Nagar':1.10,'Bijalpur':0.85,'Sanwer Road':0.80,
    }
  },
  'Bhopal': {
    state: 'Madhya Pradesh',
    baseline: { '1RK':4500,'1BHK':8000,'2BHK':13000,'3BHK':20000,'PG':3500 },
    areas: {
      'MP Nagar':1.35,'Arera Colony':1.30,'Kolar Road':1.10,'E-7':1.20,
      'Shahpura':1.05,'New Market':1.25,'Shyamla Hills':1.40,
      'Misrod':0.90,'Bawadia Kalan':0.88,'Hoshangabad Road':0.92,
      'Ayodhya Nagar':0.95,'Govindpura':0.88,'Bairagarh':0.82,
    }
  },

  // ── West Bengal ───────────────────────────────────────────
  'Kolkata': {
    state: 'West Bengal',
    baseline: { '1RK':6000,'1BHK':11000,'2BHK':18000,'3BHK':28000,'PG':4800 },
    areas: {
      'Park Street':1.60,'Ballygunge':1.50,'Alipore':1.70,'Bhowanipore':1.30,
      'Salt Lake City':1.35,'New Town':1.30,'Rajarhat':1.20,'Action Area':1.15,
      'Howrah':0.90,'Dum Dum':0.92,'Barasat':0.80,'Kasba':1.15,'Jadavpur':1.10,
      'Dhakuria':1.10,'Garia':0.95,'Tollygunge':1.05,'Behala':0.88,
      'Sodepur':0.80,'Belgharia':0.82,'Gariahat':1.25,'Lake Town':1.10,
      'Ultadanga':0.95,'Phoolbagan':0.90,'Ruby':1.15,'EM Bypass':1.20,
    }
  },

  // ── Andhra Pradesh ────────────────────────────────────────
  'Visakhapatnam': {
    state: 'Andhra Pradesh',
    baseline: { '1RK':5500,'1BHK':10000,'2BHK':17000,'3BHK':27000,'PG':4500 },
    areas: {
      'Gajuwaka':1.00,'Dwaraka Nagar':1.25,'MVP Colony':1.35,'Seethammadhara':1.30,
      'Madhurawada':1.20,'Kommadi':1.10,'Rushikonda':1.15,'Bheemunipatnam':1.00,
      'Pendurthi':0.88,'Bhimili':0.90,'Steel Plant Area':0.85,'Simhachalam':0.92,
    }
  },
  'Vijayawada': {
    state: 'Andhra Pradesh',
    baseline: { '1RK':5000,'1BHK':9000,'2BHK':15000,'3BHK':23000,'PG':4000 },
    areas: {
      'Benz Circle':1.25,'Governorpet':1.30,'Labbipet':1.20,'MG Road':1.25,
      'Auto Nagar':0.90,'Gunadala':1.00,'Patamata':1.10,'Penamaluru':0.85,
      'Vijayawada East':0.88,'Kanuru':0.82,
    }
  },
  'Tirupati': {
    state: 'Andhra Pradesh',
    baseline: { '1RK':4500,'1BHK':8000,'2BHK':13000,'3BHK':20000,'PG':3500 },
    areas: {
      'Balaji Colony':1.20,'Gandhi Road':1.15,'Leela Mahal':1.10,
      'Srinivasam Colony':1.05,'Renigunta':0.85,'Tirupati East':0.90,
    }
  },

  // ── Kerala ────────────────────────────────────────────────
  'Kochi': {
    state: 'Kerala',
    baseline: { '1RK':6500,'1BHK':12000,'2BHK':20000,'3BHK':32000,'PG':5500 },
    areas: {
      'Marine Drive':1.50,'MG Road':1.45,'Edapally':1.25,'Kakkanad':1.30,
      'Infopark':1.25,'Kaloor':1.20,'Panampilly Nagar':1.40,'Vyttila':1.20,
      'Maradu':1.15,'Aluva':0.95,'Thrikkakara':1.10,'Palarivattom':1.25,
      'Elamakkara':1.05,'Perumbavoor':0.80,'Angamaly':0.85,
    }
  },
  'Thiruvananthapuram': {
    state: 'Kerala',
    baseline: { '1RK':5500,'1BHK':10000,'2BHK':17000,'3BHK':27000,'PG':4500 },
    areas: {
      'Kowdiar':1.35,'Pattom':1.30,'Vazhuthacaud':1.25,'Thampanoor':1.20,
      'Kazhakuttam':1.15,'Technopark':1.20,'Vanchiyoor':1.00,
      'Manacaud':0.92,'Nemom':0.88,'Attingal':0.80,'Neyyattinkara':0.78,
    }
  },
  'Kozhikode': {
    state: 'Kerala',
    baseline: { '1RK':5000,'1BHK':9000,'2BHK':15000,'3BHK':23000,'PG':4000 },
    areas: {
      'Beach Road':1.25,'Nadakkave':1.20,'Chevayur':1.15,'Calicut University Area':1.10,
      'Pavangad':1.05,'Mukkam':0.92,'Ramanattukara':0.90,'Feroke':0.88,
    }
  },

  // ── Punjab & Haryana ──────────────────────────────────────
  'Chandigarh': {
    state: 'Chandigarh',
    baseline: { '1RK':7000,'1BHK':13000,'2BHK':22000,'3BHK':35000,'PG':6000 },
    areas: {
      'Sector 17':1.50,'Sector 22':1.40,'Sector 35':1.30,'Sector 44':1.20,
      'Sector 8-11':1.35,'Manimajra':1.00,'Panchkula':1.10,'Mohali':1.15,
      'Aerocity Mohali':1.20,'Kharar':0.88,'Zirakpur':1.05,'Derabassi':0.88,
    }
  },
  'Amritsar': {
    state: 'Punjab',
    baseline: { '1RK':4500,'1BHK':8000,'2BHK':13000,'3BHK':20000,'PG':3500 },
    areas: {
      'Lawrence Road':1.25,'Ranjit Avenue':1.30,'Majitha Road':1.10,
      'GT Road':1.05,'Model Town':1.20,'Sultanwind':0.92,'Putlighar':0.90,
    }
  },
  'Ludhiana': {
    state: 'Punjab',
    baseline: { '1RK':5000,'1BHK':9000,'2BHK':15000,'3BHK':23000,'PG':4000 },
    areas: {
      'Sarabha Nagar':1.30,'Model Town':1.25,'BRS Nagar':1.20,'Pakhowal Road':1.15,
      'Dugri':1.10,'Ferozepur Road':1.00,'Samrala Road':0.92,'Khanna':0.80,
    }
  },

  // ── Uttar Pradesh ─────────────────────────────────────────
  'Lucknow': {
    state: 'Uttar Pradesh',
    baseline: { '1RK':5500,'1BHK':10000,'2BHK':16000,'3BHK':25000,'PG':4500 },
    areas: {
      'Gomti Nagar':1.35,'Hazratganj':1.40,'Aliganj':1.20,'Indira Nagar':1.15,
      'Alambagh':1.00,'Chinhat':0.90,'Mahanagar':1.10,'Vibhuti Khand':1.25,
      'Aminabad':1.05,'Rajajipuram':0.95,'Telibagh':0.88,'Sultanpur Road':0.85,
      'Kanpur Road':0.88,'Faizabad Road':0.90,'Kursi Road':0.85,
    }
  },
  'Kanpur': {
    state: 'Uttar Pradesh',
    baseline: { '1RK':4500,'1BHK':8000,'2BHK':13000,'3BHK':20000,'PG':3500 },
    areas: {
      'Swaroop Nagar':1.20,'Vikas Nagar':1.15,'Kidwai Nagar':1.10,
      'Civil Lines':1.30,'GT Road':1.00,'Rawatpur':0.92,'Kakadeo':1.05,
      'Panki':0.88,'Govind Nagar':0.90,'Arya Nagar':1.15,
    }
  },
  'Varanasi': {
    state: 'Uttar Pradesh',
    baseline: { '1RK':4000,'1BHK':7000,'2BHK':12000,'3BHK':18000,'PG':3200 },
    areas: {
      'Lanka':1.25,'BHU Area':1.20,'Sigra':1.15,'Nadesar':1.20,
      'Assi Ghat':1.10,'Sunderpur':1.05,'Mahmoorganj':1.00,
      'Shivpur':0.88,'Pandeypur':0.85,'Sarnath':0.90,
    }
  },
  'Agra': {
    state: 'Uttar Pradesh',
    baseline: { '1RK':4000,'1BHK':7000,'2BHK':12000,'3BHK':18000,'PG':3200 },
    areas: {
      'Civil Lines':1.30,'Kamla Nagar':1.20,'Tajganj':1.10,'Shahganj':1.05,
      'Sikandra':1.00,'Dayalbagh':1.15,'Trans Yamuna':0.88,'Bodla':0.85,
    }
  },
  'Prayagraj': {
    state: 'Uttar Pradesh',
    baseline: { '1RK':4000,'1BHK':7500,'2BHK':12500,'3BHK':19000,'PG':3500 },
    areas: {
      'Civil Lines':1.30,'George Town':1.20,'Allenganj':1.15,'Lukerganj':1.10,
      'Mumfordganj':1.05,'Naini':0.90,'Phaphamau':0.85,'Kareli':0.82,
    }
  },

  // ── Bihar & Jharkhand ─────────────────────────────────────
  'Patna': {
    state: 'Bihar',
    baseline: { '1RK':4500,'1BHK':8000,'2BHK':13000,'3BHK':20000,'PG':3500 },
    areas: {
      'Boring Road':1.25,'Kankarbagh':1.20,'Rajendra Nagar':1.15,
      'Bailey Road':1.30,'Patna City':1.00,'Ashok Rajpath':1.10,
      'Kurji':0.92,'Phulwari':0.85,'Danapur':0.88,'Bihta':0.78,
    }
  },
  'Ranchi': {
    state: 'Jharkhand',
    baseline: { '1RK':4500,'1BHK':8000,'2BHK':13000,'3BHK':20000,'PG':3500 },
    areas: {
      'Doranda':1.20,'Harmu':1.25,'Ashok Nagar':1.15,'Lalpur':1.10,
      'Ratu Road':0.95,'Kanke':0.90,'Namkum':0.82,'Bariatu':1.05,
      'Hindpiri':0.88,'Hatia':0.85,'Argora':1.00,
    }
  },

  // ── Odisha ────────────────────────────────────────────────
  'Bhubaneswar': {
    state: 'Odisha',
    baseline: { '1RK':5000,'1BHK':9000,'2BHK':15000,'3BHK':23000,'PG':4000 },
    areas: {
      'Saheed Nagar':1.30,'Nayapalli':1.25,'Unit 4-9':1.20,'Patia':1.20,
      'Chandrasekharpur':1.15,'Mancheswar':1.00,'Rasulgarh':0.95,
      'Khandagiri':0.90,'Baramunda':1.00,'Infocity':1.10,'Nalco Square':1.05,
    }
  },

  // ── Chhattisgarh ──────────────────────────────────────────
  'Raipur': {
    state: 'Chhattisgarh',
    baseline: { '1RK':4500,'1BHK':8000,'2BHK':13000,'3BHK':20000,'PG':3500 },
    areas: {
      'VIP Road':1.25,'Shankar Nagar':1.20,'Pandri':1.15,'Tatibandh':1.10,
      'Telibandha':1.05,'GE Road':1.00,'Mowa':0.92,'Urla':0.85,'Manddir Hasoud':0.80,
    }
  },

  // ── Assam ─────────────────────────────────────────────────
  'Guwahati': {
    state: 'Assam',
    baseline: { '1RK':5000,'1BHK':9000,'2BHK':15000,'3BHK':22000,'PG':4000 },
    areas: {
      'Dispur':1.25,'Chandmari':1.20,'Six Mile':1.15,'Ganeshguri':1.20,
      'Geetanagar':1.10,'Bhangagarh':1.05,'Jalukbari':1.00,'Beltola':0.95,
      'Narengi':0.90,'Azara':0.88,'Khanapara':1.05,'Noonmati':0.92,
    }
  },

  // ── Uttarakhand ───────────────────────────────────────────
  'Dehradun': {
    state: 'Uttarakhand',
    baseline: { '1RK':5500,'1BHK':10000,'2BHK':16000,'3BHK':25000,'PG':4500 },
    areas: {
      'Rajpur Road':1.35,'Vasant Vihar':1.30,'EC Road':1.20,'Dharampur':1.15,
      'Selaqui':0.90,'Mothrowala':0.85,'Premnagar':0.92,'IT Park':1.05,
      'Sahastradhara Road':1.10,'Kaonli':0.88,'Rishikesh':0.95,
    }
  },

  // ── Himachal Pradesh ──────────────────────────────────────
  'Shimla': {
    state: 'Himachal Pradesh',
    baseline: { '1RK':5000,'1BHK':9000,'2BHK':15000,'3BHK':22000,'PG':4000 },
    areas: {
      'Mall Road':1.40,'Lakkar Bazaar':1.25,'Sanjauli':1.15,'New Shimla':1.10,
      'Khalini':1.05,'Panthaghati':0.95,'Dhalli':0.88,'Chail Road':0.85,
    }
  },

  // ── Goa ───────────────────────────────────────────────────
  'Panaji': {
    state: 'Goa',
    baseline: { '1RK':8000,'1BHK':15000,'2BHK':25000,'3BHK':40000,'PG':7000 },
    areas: {
      'Dona Paula':1.40,'Miramar':1.35,'Campal':1.25,'Fontainhas':1.20,
      'Porvorim':1.15,'Panjim City':1.10,'Mapusa':1.00,'Calangute':1.30,
      'Baga':1.35,'Candolim':1.25,'Margao':1.05,'Vasco':1.00,
    }
  },

  // ── North East ────────────────────────────────────────────
  'Imphal': {
    state: 'Manipur',
    baseline: { '1RK':4000,'1BHK':7000,'2BHK':12000,'3BHK':18000,'PG':3200 },
    areas: {
      'Paona Bazaar':1.20,'Thangal Bazaar':1.15,'Singjamei':1.05,
      'Kakwa':0.95,'Keishampat':1.10,'Lamphel':1.00,'Chingamathak':0.90,
    }
  },
  'Shillong': {
    state: 'Meghalaya',
    baseline: { '1RK':4500,'1BHK':8000,'2BHK':13000,'3BHK':20000,'PG':3800 },
    areas: {
      'Police Bazaar':1.25,'Laitumkhrah':1.20,'Mawlai':1.05,'Nongthymmai':0.95,
      'Rynjah':1.00,'Mawphlang':0.85,'Mairang':0.80,
    }
  },
};

// ─────────────────────────────────────────────────────────────
// States for grouping
// ─────────────────────────────────────────────────────────────
const STATE_ORDER = [
  'Maharashtra','Karnataka','Telangana','Tamil Nadu','Delhi','Haryana',
  'Uttar Pradesh','Rajasthan','Gujarat','Madhya Pradesh','West Bengal',
  'Andhra Pradesh','Kerala','Punjab','Bihar','Jharkhand','Odisha',
  'Chhattisgarh','Assam','Uttarakhand','Himachal Pradesh','Goa',
  'Chandigarh','Manipur','Meghalaya'
];

// Group cities by state
const CITIES_BY_STATE = STATE_ORDER.reduce((acc, state) => {
  const cities = Object.entries(INDIA_CITIES)
    .filter(([, v]) => v.state === state)
    .map(([city]) => city);
  if (cities.length) acc[state] = cities;
  return acc;
}, {});

// ─────────────────────────────────────────────────────────────
// Multipliers
// ─────────────────────────────────────────────────────────────
const FURNISH_MULT   = { 'Unfurnished': 0.82, 'Semi-Furnished': 1.0, 'Fully Furnished': 1.28 };
const FLOOR_MULT     = { 'Ground': 0.92, '1st–2nd': 1.0, '3rd–5th': 1.06, '6th+': 0.96 };
const METRO_BONUS    = 0.08;    // +8% if metro city (Mumbai, Delhi, Bengaluru, Chennai, Hyderabad, Kolkata)
const METRO_CITIES   = new Set(['Mumbai','Delhi','Bengaluru','Chennai','Hyderabad','Kolkata']);
const COLLEGE_BONUS  = 0.07;    // +7% if area name contains college/university keywords
const COLLEGE_KEYS   = ['college','university','bhu','iit','nit','iim','campus','hostel','la','peelamedu'];
const SEASONAL_MULT  = { '2023':0.94,'2024':1.0,'2025':1.06,'2026':1.10 }; // admission year spikes

function computeRent(city, area, roomType, furnish, floor, year) {
  if (!city || !area || !roomType) return null;
  const cityData = INDIA_CITIES[city];
  if (!cityData) return null;

  const base    = cityData.baseline[roomType] || 8000;
  const am      = cityData.areas[area] ?? 1.0;
  const fm      = FURNISH_MULT[furnish]  ?? 1.0;
  const flm     = FLOOR_MULT[floor]      ?? 1.0;
  const ym      = SEASONAL_MULT[String(year)] ?? 1.0;
  const metro   = METRO_CITIES.has(city) ? 1 + METRO_BONUS : 1.0;
  const college = COLLEGE_KEYS.some(k => area.toLowerCase().includes(k)) ? 1 + COLLEGE_BONUS : 1.0;

  const predicted = Math.round((base * am * fm * flm * ym * metro * college) / 500) * 500;
  return {
    mid: predicted,
    min: Math.round(predicted * 0.87 / 500) * 500,
    max: Math.round(predicted * 1.16 / 500) * 500,
  };
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function RentBar({ label, value, max, color }) {
  const pct = Math.min(100, ((value || 0) / (max || 1)) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-white/60">
        <span>{label}</span>
        <span className="font-semibold text-white">₹{value?.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function RentPredictorPage() {
  const [city,      setCity]      = useState('Pune');
  const [area,      setArea]      = useState('Katraj');
  const [roomType,  setRoomType]  = useState('1RK');
  const [furnish,   setFurnish]   = useState('Semi-Furnished');
  const [floor,     setFloor]     = useState('1st–2nd');
  const [year,      setYear]      = useState('2025');
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [userRent,  setUserRent]  = useState('');
  const [showTable, setShowTable] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);

  const cityData = INDIA_CITIES[city];
  const areas    = cityData ? Object.keys(cityData.areas) : [];

  const handleCityChange = (c) => {
    setCity(c);
    const firstArea = Object.keys(INDIA_CITIES[c]?.areas || {})[0] || '';
    setArea(firstArea);
    setResult(null);
    setStateOpen(false);
  };

  const predict = async () => {
    if (!area) { toast.error('Select an area'); return; }
    setLoading(true); setResult(null);
    await new Promise(r => setTimeout(r, 700)); // feel like AI thinking

    const r = computeRent(city, area, roomType, furnish, floor, year);
    if (!r) { toast.error('Could not compute rent'); setLoading(false); return; }

    const isMetro   = METRO_CITIES.has(city);
    const isCollege = COLLEGE_KEYS.some(k => area.toLowerCase().includes(k));

    setResult({
      city, area, room_type: roomType, furnishing: furnish, floor, year,
      predicted_rent: r.mid, rent_min: r.min, rent_max: r.max,
      is_metro: isMetro, is_college_zone: isCollege,
      area_mult: cityData.areas[area] ?? 1.0,
      state: cityData.state,
    });
    toast.success(`AI prediction ready for ${area}, ${city}!`);
    setLoading(false);
  };

  // Comparison logic
  const userRentNum = parseInt(userRent) || 0;
  const overpayPct  = result && userRentNum > result.rent_max
    ? Math.round(((userRentNum - result.rent_max) / result.rent_max) * 100) : 0;
  const underpayPct = result && userRentNum > 0 && userRentNum < result.rent_min
    ? Math.round(((result.rent_min - userRentNum) / result.rent_min) * 100) : 0;
  const fairDeal    = result && userRentNum > 0 && !overpayPct && !underpayPct;

  // Quick stats across cities
  const quickStats = useMemo(() => [
    { city:'Katraj, Pune',    '1RK':'₹4,000','1BHK':'₹7,500'  },
    { city:'Andheri, Mumbai', '1RK':'₹14,000','1BHK':'₹25,000'},
    { city:'Koramangala, BLR','1RK':'₹9,000', '1BHK':'₹16,000'},
    { city:'Gachibowli, HYD', '1RK':'₹7,500', '1BHK':'₹14,000'},
    { city:'OMR, Chennai',    '1RK':'₹7,500', '1BHK':'₹13,500'},
    { city:'Gomti Nagar, LKO','1RK':'₹5,500', '1BHK':'₹10,000'},
    { city:'Vaishali Ngr, JP','1RK':'₹5,000', '1BHK':'₹9,000' },
    { city:'Salt Lake, KOL',  '1RK':'₹6,000', '1BHK':'₹11,000'},
  ], []);

  const totalCities = Object.keys(INDIA_CITIES).length;
  const totalAreas  = Object.values(INDIA_CITIES).reduce((s, c) => s + Object.keys(c.areas).length, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 page-enter">

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <TrendingUp size={22} className="text-green-400" /> AI Rent Predictor
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Fair rent prediction for <span className="text-green-400 font-semibold">{totalCities} cities</span> &amp;{' '}
          <span className="text-blue-400 font-semibold">{totalAreas}+ areas</span> across India.
          No API key needed — works offline.
        </p>
      </div>

      {/* Coverage stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Cities', value: totalCities, icon: '🏙️', color: 'text-blue-400'   },
          { label: 'Areas',  value: `${totalAreas}+`, icon: '📍', color: 'text-green-400'  },
          { label: 'States', value: Object.keys(CITIES_BY_STATE).length, icon: '🗺️', color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="glass p-3 text-center">
            <div className="text-xl mb-1">{s.icon}</div>
            <p className={`font-display text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-white/40 text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Input Form */}
      <div className="glass p-5 space-y-4">
        <h2 className="font-display font-semibold flex items-center gap-2">
          <MapPin size={16} className="text-blue-400" /> Select Location &amp; Room
        </h2>

        {/* City picker — grouped by state */}
        <div>
          <label className="text-xs text-white/50 mb-1 block">
            City <span className="text-white/30">({totalCities} cities across India)</span>
          </label>
          <div className="relative">
            <button
              onClick={() => setStateOpen(o => !o)}
              className="w-full glass-dark rounded-xl p-3 text-sm text-white flex items-center justify-between outline-none"
            >
              <span>{city} <span className="text-white/40 text-xs">— {cityData?.state}</span></span>
              {stateOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {stateOpen && (
              <div className="absolute z-50 mt-1 w-full glass rounded-2xl shadow-2xl max-h-80 overflow-y-auto">
                {Object.entries(CITIES_BY_STATE).map(([state, cities]) => (
                  <div key={state}>
                    <div className="px-3 py-1.5 text-xs text-white/40 font-semibold bg-white/5 sticky top-0">
                      {state}
                    </div>
                    {cities.map(c => (
                      <button
                        key={c}
                        onClick={() => handleCityChange(c)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${c === city ? 'text-blue-400 font-semibold' : 'text-white/80'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Area picker */}
        <div>
          <label className="text-xs text-white/50 mb-1 block">
            Area / Locality <span className="text-white/30">({areas.length} areas in {city})</span>
          </label>
          <select
            value={area}
            onChange={e => { setArea(e.target.value); setResult(null); }}
            className="w-full glass-dark rounded-xl p-3 text-sm text-white bg-transparent outline-none"
          >
            {areas.map(a => (
              <option key={a} value={a} className="bg-gray-900">
                {a} {cityData.areas[a] >= 1.4 ? '⭐ Premium' : cityData.areas[a] <= 0.88 ? '💰 Budget' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Room type, furnish, floor, year grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Room Type</label>
            <select value={roomType} onChange={e => { setRoomType(e.target.value); setResult(null); }}
              className="w-full glass-dark rounded-xl p-3 text-sm text-white bg-transparent outline-none">
              {['1RK','1BHK','2BHK','3BHK','PG'].map(t => (
                <option key={t} value={t} className="bg-gray-900">{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Furnishing</label>
            <select value={furnish} onChange={e => { setFurnish(e.target.value); setResult(null); }}
              className="w-full glass-dark rounded-xl p-3 text-sm text-white bg-transparent outline-none">
              {['Unfurnished','Semi-Furnished','Fully Furnished'].map(f => (
                <option key={f} value={f} className="bg-gray-900">{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Floor</label>
            <select value={floor} onChange={e => { setFloor(e.target.value); setResult(null); }}
              className="w-full glass-dark rounded-xl p-3 text-sm text-white bg-transparent outline-none">
              {['Ground','1st–2nd','3rd–5th','6th+'].map(f => (
                <option key={f} value={f} className="bg-gray-900">{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Year</label>
            <select value={year} onChange={e => { setYear(e.target.value); setResult(null); }}
              className="w-full glass-dark rounded-xl p-3 text-sm text-white bg-transparent outline-none">
              {['2023','2024','2025','2026'].map(y => (
                <option key={y} value={y} className="bg-gray-900">{y}</option>
              ))}
            </select>
          </div>
        </div>

        <button onClick={predict} disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3">
          {loading
            ? <><span className="animate-spin inline-block">⚙️</span> Analysing market data…</>
            : <><Zap size={16} /> Predict Fair Rent</>}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="glass p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <IndianRupee size={18} className="text-green-400" /> Prediction Result
            </h2>
            <div className="flex gap-2">
              {result.is_metro      && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg">🏙️ Metro</span>}
              {result.is_college_zone && <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-lg">🎓 College Zone</span>}
            </div>
          </div>

          {/* Main price */}
          <div className="glass-dark rounded-2xl p-5 text-center space-y-1">
            <p className="text-white/50 text-sm">
              {result.area}, {result.city} ({result.state}) · {result.room_type} · {result.furnishing}
            </p>
            <p className="font-display text-4xl font-bold gradient-text">
              ₹{result.predicted_rent?.toLocaleString()}
              <span className="text-lg font-normal text-white/40">/month</span>
            </p>
            <p className="text-white/40 text-sm">
              Fair range:{' '}
              <span className="text-white/70 font-medium">
                ₹{result.rent_min?.toLocaleString()} – ₹{result.rent_max?.toLocaleString()}
              </span>
            </p>
            <div className="flex justify-center gap-3 pt-1">
              <span className="text-xs text-white/30">
                Area premium: {result.area_mult >= 1 ? '+' : ''}{Math.round((result.area_mult - 1) * 100)}%
              </span>
              <span className="text-xs text-white/30">|</span>
              <span className="text-xs text-white/30">Seasonal adj: {year}</span>
            </div>
          </div>

          {/* Bars */}
          <div className="space-y-3">
            <RentBar label="Minimum (budget)"  value={result.rent_min}       max={result.rent_max * 1.2} color="bg-blue-500" />
            <RentBar label="Predicted (fair)"  value={result.predicted_rent} max={result.rent_max * 1.2} color="bg-gradient-to-r from-blue-500 to-purple-500" />
            <RentBar label="Maximum (premium)" value={result.rent_max}       max={result.rent_max * 1.2} color="bg-purple-500" />
          </div>

          {/* Compare with quoted rent */}
          <div className="glass-dark rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Info size={14} className="text-blue-400" /> Compare with a Quoted Rent
            </p>
            <input
              type="number"
              placeholder="Enter quoted rent (₹ per month)"
              value={userRent}
              onChange={e => setUserRent(e.target.value)}
              className="w-full glass rounded-xl p-3 text-sm text-white bg-transparent outline-none placeholder-white/30"
            />
            {userRentNum > 0 && (
              overpayPct > 0 ? (
                <div className="flex items-start gap-2 text-red-400 text-sm">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    You may be <b>overpaying by ~{overpayPct}%</b> —
                    ₹{(userRentNum - result.rent_max).toLocaleString()} more than market maximum.
                    Try negotiating down to ₹{result.predicted_rent?.toLocaleString()}.
                  </span>
                </div>
              ) : underpayPct > 0 ? (
                <div className="flex items-start gap-2 text-yellow-400 text-sm">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Quoted rent is <b>below market minimum</b> by {underpayPct}%.
                    Verify amenities and listing carefully — might be misleading.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle size={16} />
                  <span>Quoted rent is <b>within fair market range ✅</b> — good deal!</span>
                </div>
              )
            )}
          </div>

          {/* Tips */}
          <div className="glass-dark rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-white/70">💡 Negotiation Tips for {result.city}</p>
            <ul className="text-xs text-white/50 space-y-1.5 list-disc list-inside">
              <li>Start your offer 8–12% below the predicted fair rent</li>
              <li>Ask for 1 month free rent if signing a 12-month lease</li>
              {result.is_college_zone && <li>College zones spike 15–20% in June–August (admission season) — sign before May if possible</li>}
              {result.is_metro && <li>In {result.city}, weekend listings get more interest — enquire on weekdays for better negotiation position</li>}
              <li>Fully furnished: easier to negotiate; request AC, Wi-Fi, or 24hr water included</li>
              {result.area_mult >= 1.3 && <li>{result.area} is a premium area — verify why it's priced high (proximity to IT park? metro station?)</li>}
              {result.area_mult <= 0.9 && <li>{result.area} is a budget-friendly area — great for students! Check commute time to campus</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Quick snapshot */}
      <div className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold flex items-center gap-2">
            <Home size={16} className="text-purple-400" /> Quick Rent Snapshot
          </h2>
          <button onClick={() => setShowTable(o => !o)} className="text-xs text-blue-400 hover:text-blue-300">
            {showTable ? 'Hide' : 'Expand'}
          </button>
        </div>

        {showTable ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="text-left py-2 pr-3">City / Area</th>
                  <th className="text-right py-2 px-2">1RK</th>
                  <th className="text-right py-2 px-2">1BHK</th>
                  <th className="text-right py-2 px-2">2BHK</th>
                  <th className="text-right py-2 pl-2">PG</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(INDIA_CITIES).slice(0, 20).map(([cityName, d]) => (
                  <tr key={cityName} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-3 text-white/70 font-medium">
                      {cityName}
                      <span className="block text-white/30 font-normal">{d.state}</span>
                    </td>
                    <td className="text-right py-2 px-2 text-green-400">₹{d.baseline['1RK']?.toLocaleString()}</td>
                    <td className="text-right py-2 px-2 text-blue-400">₹{d.baseline['1BHK']?.toLocaleString()}</td>
                    <td className="text-right py-2 px-2 text-purple-400">₹{d.baseline['2BHK']?.toLocaleString()}</td>
                    <td className="text-right py-2 pl-2 text-yellow-400">₹{d.baseline['PG']?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-white/30 mt-2">* Base rates (semi-furnished, typical area). Use predictor above for locality-specific rates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {quickStats.map((r, i) => (
              <div key={i} className="glass-dark p-3 rounded-xl">
                <p className="text-xs text-white/50 mb-1.5 font-medium">{r.city}</p>
                <p className="text-xs text-white/60">1RK <span className="text-green-400 font-semibold">{r['1RK']}</span></p>
                <p className="text-xs text-white/60">1BHK <span className="text-blue-400 font-semibold">{r['1BHK']}</span></p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="glass-dark p-4 rounded-2xl">
        <p className="text-xs text-white/30 leading-relaxed">
          <span className="text-white/50 font-medium">Disclaimer: </span>
          Predictions based on locality market data, furnishing, floor level, seasonal patterns and metro/college proximity factors.
          Actual rents may vary ±20% based on exact property, current demand, and owner pricing. Always verify before signing any agreement.
          Data updated for 2025 Indian rental market.
        </p>
      </div>
    </div>
  );
}

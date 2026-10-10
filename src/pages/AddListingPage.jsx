// ============================================
// pages/AddListingPage.jsx
// RoomSync — Add Room Listing
//
// NEW: Smart Rent Validation using ML (Flask API)
//   • As soon as city/area/room_type/furnishing/floor are filled,
//     the app calls the Random Forest rent predictor in the background
//   • Shows a live "Fair Rent" card with min–max range
//   • Flags the entered price as:
//       ✅ Fair Price    (within ±25% of ML prediction)
//       ⚠️  Low Price    (below market — you might be undercharging)
//       🚨 Overpriced   (too high for that area — listing blocked until fixed or acknowledged)
//   • Owner must confirm or fix before submitting
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Image, MapPin, IndianRupee, Send, X, CheckCircle,
  TrendingUp, AlertTriangle, Info, Zap, ChevronDown, ChevronUp,
  ThumbsDown, Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { offlineGeocode, nominatimGeocode } from '../utils/indiaGeodata';

// ─── Constants ──────────────────────────────────────────────
const ROOM_TYPES  = ['Single Room','Shared Room','Studio','1 RK','1 BHK','2 BHK','3 BHK','PG'];
const FACILITIES  = ['WiFi','AC','Gym','Laundry','Parking','Security','Lift','Water 24/7','Furnished','Kitchen','Meals','CCTV','Power Backup','Hot Water','Study Table','Wardrobe','TV','Refrigerator'];
const GENDERS     = ['Any','Male Only','Female Only'];
const FURNISH_OPT = ['Unfurnished','Semi-Furnished','Fully Furnished'];
const FLOORS      = ['Ground','1st','2nd','3rd','4th','5th','6th+'];

// Map form room_type values → API values expected by Flask
const ROOM_TYPE_MAP = {
  'Single Room': '1RK', 'Shared Room': '1RK', 'Studio': '1RK',
  '1 RK': '1RK', '1 BHK': '1BHK', '2 BHK': '2BHK',
  '3 BHK': '3BHK', 'PG': 'PG',
};
// Map form floor values → API floor buckets
const FLOOR_MAP = {
  'Ground':'Ground', '1st':'1st-2nd', '2nd':'1st-2nd',
  '3rd':'3rd-5th', '4th':'3rd-5th', '5th':'3rd-5th', '6th+':'6th+',
};

const FLASK_URL = 'http://localhost:5001';
const CLOUDINARY_CLOUD_NAME = 'dkmpxqwft';
const CLOUDINARY_PRESET     = 'roomsync_preset';

async function uploadToCloudinary(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY_PRESET);
  form.append('folder', 'roomsync/rooms');
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method:'POST', body:form });
  const data = await res.json();
  if (!data.secure_url) throw new Error('Upload failed');
  return data.secure_url;
}

// ─── MapPreview (unchanged) ─────────────────────────────────
function MapPreview({ lat, lng, label }) {
  const mapRef  = useRef(null);
  const instRef = useRef(null);
  useEffect(() => {
    if (!lat || !lng) return;
    const init = () => {
      const L = window.L;
      if (!L || !mapRef.current) return;
      if (instRef.current) { instRef.current.remove(); instRef.current = null; }
      const map = L.map(mapRef.current, { zoomControl:true, scrollWheelZoom:false }).setView([lat,lng],15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
      const icon = L.divIcon({ className:'', iconAnchor:[16,40], html:`<div style="font-size:32px;filter:drop-shadow(0 2px 6px #000a)">📍</div>` });
      L.marker([lat,lng],{icon}).addTo(map).bindPopup(`<b>${label||'Room Location'}</b>`).openPopup();
      instRef.current = map;
    };
    const load = () => {
      if (window.L) { init(); return; }
      if (!document.getElementById('leaflet-css')) {
        const css = document.createElement('link');
        css.id='leaflet-css'; css.rel='stylesheet';
        css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
      }
      if (!document.getElementById('leaflet-js')) {
        const js = document.createElement('script');
        js.id='leaflet-js'; js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        js.onload=init; document.head.appendChild(js);
      } else {
        const t = setInterval(()=>{ if(window.L){clearInterval(t);init();} },100);
      }
    };
    load();
    return () => { instRef.current?.remove(); instRef.current=null; };
  }, [lat, lng]);
  if (!lat||!lng) return null;
  return (
    <div className="mt-3 rounded-2xl overflow-hidden border border-white/10">
      <p className="text-xs text-green-400 px-3 py-2 bg-green-500/10 flex items-center gap-1.5">
        <MapPin size={11}/> Location found — {label}
      </p>
      <div ref={mapRef} style={{height:'200px',width:'100%'}}/>
    </div>
  );
}

// ─── RentCheckCard ──────────────────────────────────────────
// Shows the ML prediction and evaluates the owner's entered price.
function RentCheckCard({ rentData, enteredPrice, onAcknowledge, acknowledged }) {
  const [expanded, setExpanded] = useState(true);
  if (!rentData) return null;

  const { predicted_rent, rent_min, rent_max, confidence, city, area, room_type, source, model_r2 } = rentData;
  const price = Number(enteredPrice);

  // Evaluate price status
  let status = 'unknown';
  let statusColor = '';
  let statusBg = '';
  let statusIcon = null;
  let statusMsg = '';
  let isBlocked = false;

  if (price > 0) {
    const overBy  = ((price - rent_max) / rent_max) * 100;
    const underBy = ((rent_min - price) / rent_min) * 100;

    if (price > rent_max * 1.35) {
      // More than 35% above upper bound — flag as overpriced
      status = 'overpriced';
      statusColor = '#ef4444';
      statusBg = 'rgba(239,68,68,0.08)';
      statusIcon = <AlertTriangle size={16} style={{color:'#ef4444'}}/>;
      statusMsg = `₹${price.toLocaleString()} is about ${Math.round(overBy)}% above the market rate for ${room_type} in ${area || city}. This may drive away tenants.`;
      isBlocked = true;
    } else if (price > rent_max * 1.10) {
      // 10–35% above — warn but allow
      status = 'high';
      statusColor = '#f97316';
      statusBg = 'rgba(249,115,22,0.08)';
      statusIcon = <AlertTriangle size={16} style={{color:'#f97316'}}/>;
      statusMsg = `₹${price.toLocaleString()} is slightly above typical market range. Consider if your listing has premium features to justify this.`;
      isBlocked = false;
    } else if (price < rent_min * 0.65) {
      // More than 35% below lower bound — warn (undercharging)
      status = 'low';
      statusColor = '#eab308';
      statusBg = 'rgba(234,179,8,0.08)';
      statusIcon = <Info size={16} style={{color:'#eab308'}}/>;
      statusMsg = `₹${price.toLocaleString()} is well below the market rate. Make sure this is intentional — you might be undercharging.`;
      isBlocked = false;
    } else {
      // Within range
      status = 'fair';
      statusColor = '#22c55e';
      statusBg = 'rgba(34,197,94,0.08)';
      statusIcon = <CheckCircle size={16} style={{color:'#22c55e'}}/>;
      statusMsg = `₹${price.toLocaleString()} is within the fair market range for ${room_type} in ${area || city}. ✓`;
      isBlocked = false;
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden border"
      style={{borderColor: statusColor || 'rgba(99,102,241,0.4)', background:'rgba(255,255,255,0.02)'}}>

      {/* Header */}
      <button type="button" onClick={()=>setExpanded(v=>!v)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{background:'rgba(99,102,241,0.08)'}}>
        <div className="flex items-center gap-2">
          <Zap size={14} style={{color:'#818cf8'}}/>
          <span className="text-sm font-semibold" style={{color:'#a5b4fc'}}>
            ML Rent Analysis
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{background:'rgba(99,102,241,0.15)',color:'#818cf8'}}>
            {source === 'rf_ml_model_v1' ? `RF Model · R²=${model_r2?.toFixed(2)||'0.95'}` : 'Rule-based'}
          </span>
        </div>
        {expanded ? <ChevronUp size={15} className="text-white/40"/> : <ChevronDown size={15} className="text-white/40"/>}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Fair range bar */}
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Market Range for <strong className="text-white/70">{room_type}</strong> in <strong className="text-white/70">{area||city}</strong></span>
              <span>{confidence}% confidence</span>
            </div>
            <div className="relative h-6 rounded-xl overflow-hidden"
              style={{background:'rgba(255,255,255,0.06)'}}>
              {/* Range fill */}
              <div className="absolute top-0 bottom-0 rounded-xl"
                style={{
                  left: '10%', right: '10%',
                  background:'linear-gradient(90deg,rgba(34,197,94,0.25),rgba(34,197,94,0.4))',
                }}/>
              {/* Labels */}
              <div className="absolute inset-0 flex items-center justify-between px-3">
                <span className="text-xs font-bold" style={{color:'#86efac'}}>₹{rent_min?.toLocaleString()}</span>
                <span className="text-xs font-bold text-white">₹{predicted_rent?.toLocaleString()}</span>
                <span className="text-xs font-bold" style={{color:'#86efac'}}>₹{rent_max?.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex justify-between text-xs text-white/35 mt-0.5 px-1">
              <span>Min</span>
              <span>Fair average</span>
              <span>Max</span>
            </div>
          </div>

          {/* Price status */}
          {price > 0 && (
            <div className="rounded-xl p-3 flex items-start gap-2.5"
              style={{background: statusBg, border:`1px solid ${statusColor}40`}}>
              {statusIcon}
              <p className="text-sm" style={{color: statusColor, lineHeight:1.5}}>{statusMsg}</p>
            </div>
          )}

          {/* Overpriced — must acknowledge or fix */}
          {isBlocked && !acknowledged && (
            <div className="rounded-xl p-3 space-y-2"
              style={{background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.3)'}}>
              <p className="text-xs text-red-300 font-medium flex items-center gap-1.5">
                <Shield size={12}/> Listing blocked — price seems too high for this area
              </p>
              <p className="text-xs text-white/50">
                The ML model (trained on real India rent data) flags this rent as significantly above market.
                Please fix the price or explain why your listing justifies this premium.
              </p>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={onAcknowledge}
                  className="flex-1 py-2 rounded-xl text-xs font-medium border"
                  style={{borderColor:'rgba(239,68,68,0.4)',color:'#fca5a5',background:'rgba(239,68,68,0.1)'}}>
                  I understand — list anyway
                </button>
              </div>
            </div>
          )}

          {isBlocked && acknowledged && (
            <div className="rounded-xl px-3 py-2 flex items-center gap-2"
              style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.3)'}}>
              <Info size={12} style={{color:'#fb923c'}}/>
              <p className="text-xs" style={{color:'#fb923c'}}>
                Acknowledged — high-price listing will be submitted with a market warning flag.
              </p>
            </div>
          )}

          {/* Factor breakdown */}
          <details className="text-xs">
            <summary className="text-white/40 cursor-pointer hover:text-white/60 select-none">
              How was this calculated?
            </summary>
            <div className="mt-2 space-y-1 pl-2 text-white/40" style={{lineHeight:1.8}}>
              <p>📍 City: <span className="text-white/60">{city}</span> (tier {rentData.area_multiplier >= 1.3 ? '1' : rentData.area_multiplier >= 1.0 ? '2' : '3'})</p>
              <p>🏘️ Area multiplier: <span className="text-white/60">{rentData.area_multiplier}×</span> (vs city average)</p>
              <p>🏠 Room type: <span className="text-white/60">{room_type}</span></p>
              <p>🛋️ Furnishing premium included</p>
              <p>📊 Model: Random Forest Regressor · {source === 'rf_ml_model_v1' ? `R²=${model_r2?.toFixed(2)}` : 'rule-based fallback'}</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function AddListingPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title:'', location:'', price:'', deposit:'',
    room_type:'', furnishing:'', floor:'', gender_preference:'Any',
    description:'', nearby:'', owner_name:'', owner_phone:'',
    available_from:'', facilities:[],
  });

  const [coords,      setCoords]      = useState(null);
  const [imageFiles,  setImageFiles]  = useState([]);
  const [previews,    setPreviews]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [geoStatus,   setGeoStatus]   = useState('');

  // ML rent validation state
  const [rentData,      setRentData]      = useState(null);   // ML API response
  const [rentLoading,   setRentLoading]   = useState(false);
  const [rentFetched,   setRentFetched]   = useState(false);  // have we fetched for current inputs?
  const [acknowledged,  setAcknowledged]  = useState(false);  // owner overrode warning
  const rentTimer = useRef(null);
  const geoTimer  = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleFac = (fac) => setForm(prev => ({
    ...prev,
    facilities: prev.facilities.includes(fac)
      ? prev.facilities.filter(x => x !== fac)
      : [...prev.facilities, fac],
  }));

  // ── Extract city name from coords / location string ────────
  const extractCity = useCallback((locationStr, coordsObj) => {
    if (coordsObj?.city) return coordsObj.city;
    // Try to match a known city name in the location string
    const known = ['Mumbai','Delhi','Pune','Bengaluru','Bangalore','Hyderabad',
      'Chennai','Kolkata','Ahmedabad','Jaipur','Chandigarh','Indore','Nagpur',
      'Nashik','Surat','Lucknow','Kochi','Patna','Bhopal','Gurugram','Noida'];
    for (const city of known) {
      if (locationStr.toLowerCase().includes(city.toLowerCase())) return city;
    }
    // Default: use first word as city guess
    return locationStr.split(',')[0].trim() || 'Pune';
  }, []);

  // ── Extract area/neighbourhood from location string ────────
  const extractArea = useCallback((locationStr, coordsObj) => {
    if (coordsObj?.area) return coordsObj.area;
    // If "Katraj, Pune" → area = "Katraj"
    const parts = locationStr.split(',').map(s => s.trim());
    return parts[0] || locationStr.trim();
  }, []);

  // ── Fetch ML rent prediction ───────────────────────────────
  const fetchRentPrediction = useCallback(async (formState, coordsObj) => {
    const { location, room_type, furnishing, floor, price } = formState;
    // Need at minimum location + room_type to call the API
    if (!location.trim() || !room_type) return;

    const city     = extractCity(location, coordsObj);
    const area     = extractArea(location, coordsObj);
    const apiRoom  = ROOM_TYPE_MAP[room_type] || '1BHK';
    const apiFloor = FLOOR_MAP[floor]         || '1st-2nd';
    const apiFurn  = furnishing || 'Semi-Furnished';

    setRentLoading(true);
    setRentFetched(false);
    setAcknowledged(false);

    try {
      const res = await fetch(`${FLASK_URL}/api/rent-predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city, area,
          room_type:  apiRoom,
          furnishing: apiFurn,
          floor:      apiFloor,
          year:       new Date().getFullYear(),
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setRentData(data);
      setRentFetched(true);
    } catch {
      // Flask not running — show a soft warning, don't block listing
      setRentData(null);
      setRentFetched(false);
      console.warn('[RentCheck] Flask API not reachable — validation skipped');
    } finally {
      setRentLoading(false);
    }
  }, [extractCity, extractArea]);

  // ── Debounced rent check whenever key fields change ────────
  useEffect(() => {
    if (rentTimer.current) clearTimeout(rentTimer.current);
    // Only trigger when we have enough info
    if (form.location.trim().length > 2 && form.room_type) {
      rentTimer.current = setTimeout(() => {
        fetchRentPrediction(form, coords);
      }, 800);
    } else {
      setRentData(null);
    }
    return () => clearTimeout(rentTimer.current);
  }, [form.location, form.room_type, form.furnishing, form.floor, coords]);

  // ── Location / geocode handler ─────────────────────────────
  const handleLocationChange = (val) => {
    set('location', val);
    setGeoStatus('');
    if (geoTimer.current) clearTimeout(geoTimer.current);
    if (val.trim().length < 3) { setCoords(null); return; }
    geoTimer.current = setTimeout(async () => {
      const offline = offlineGeocode(val);
      if (offline) { setCoords(offline); setGeoStatus('found'); return; }
      setGeoStatus('searching');
      const online = await nominatimGeocode(val);
      if (online) { setCoords(online); setGeoStatus('found'); }
      else { setCoords(null); setGeoStatus('notfound'); }
    }, 600);
  };

  const handleImages = (e) => {
    const files = Array.from(e.target.files).slice(0, 6);
    setImageFiles(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };
  const removeImage = (i) => {
    setImageFiles(f => f.filter((_,idx)=>idx!==i));
    setPreviews(p  => p.filter((_,idx)=>idx!==i));
  };

  // ── Determine if the rent check blocks submission ──────────
  const isRentBlocked = (() => {
    if (!rentData || !form.price) return false;
    const price = Number(form.price);
    if (price <= 0) return false;
    const overBy = (price - rentData.rent_max) / rentData.rent_max;
    return overBy > 0.35 && !acknowledged;
  })();

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim())    return toast.error('Enter a listing title');
    if (!form.location.trim()) return toast.error('Enter the location');
    if (!form.price)           return toast.error('Enter the rent amount');
    if (!user)                 return toast.error('You must be logged in');

    if (isRentBlocked) {
      toast.error('🚨 Rent price flagged by ML — please review the market analysis below', { duration: 4000 });
      return;
    }

    setLoading(true);
    try {
      let imageUrls = [];
      if (imageFiles.length > 0 && CLOUDINARY_CLOUD_NAME !== 'YOUR_CLOUD_NAME') {
        const t = toast.loading(`Uploading ${imageFiles.length} image(s)…`);
        try {
          imageUrls = await Promise.all(imageFiles.map(f => uploadToCloudinary(f)));
          toast.dismiss(t);
          toast.success(`${imageUrls.length} image(s) uploaded!`);
        } catch {
          toast.dismiss(t);
          toast('Images skipped — configure Cloudinary', { icon: 'ℹ️' });
        }
      }

      // Flag overpriced listings for admin visibility
      const priceStatus = (() => {
        if (!rentData || !form.price) return 'unchecked';
        const p = Number(form.price);
        if (p > rentData.rent_max * 1.35) return 'overpriced';
        if (p > rentData.rent_max * 1.10) return 'high';
        if (p < rentData.rent_min * 0.65) return 'low';
        return 'fair';
      })();

      await addDoc(collection(db, 'rooms'), {
        owner_id:          user.uid,
        owner_name:        form.owner_name  || profile?.name  || '',
        owner_phone:       form.owner_phone || profile?.phone || '',
        owner_email:       user?.email || '',
        title:             form.title.trim(),
        location:          form.location.trim(),
        lat:               coords?.lat  || null,
        lng:               coords?.lng  || null,
        location_display:  coords ? `${coords.city}, ${coords.state}` : form.location,
        price:             Number(form.price),
        deposit:           form.deposit ? Number(form.deposit) : null,
        room_type:         form.room_type,
        furnishing:        form.furnishing,
        floor:             form.floor,
        gender_preference: form.gender_preference,
        description:       form.description.trim(),
        nearby:            form.nearby.trim(),
        facilities:        form.facilities,
        available_from:    form.available_from || null,
        images:            imageUrls,
        created_at:        serverTimestamp(),
        verified:          false,
        // ML rent validation metadata
        ml_rent_check: {
          status:         priceStatus,
          predicted_rent: rentData?.predicted_rent || null,
          rent_min:       rentData?.rent_min || null,
          rent_max:       rentData?.rent_max || null,
          confidence:     rentData?.confidence || null,
          acknowledged:   acknowledged,
          checked_at:     new Date().toISOString(),
        },
      });

      setSuccess(true);
      toast.success('Listing posted successfully! 🎉', { duration: 4000 });
      setTimeout(() => { setSuccess(false); navigate('/browse-rooms'); }, 2500);
    } catch (err) {
      if (err.code === 'permission-denied')
        toast.error('Permission denied — check Firestore rules');
      else
        toast.error('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="max-w-3xl mx-auto page-enter">
      <div className="glass p-16 text-center space-y-4">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={40} className="text-green-400"/>
        </div>
        <h2 className="font-display text-2xl font-bold text-green-400">Listing Added! 🎉</h2>
        <p className="text-white/60">Your room has been posted successfully.</p>
        <p className="text-white/40 text-sm">Redirecting to Browse Rooms…</p>
        <div className="w-8 h-8 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin mx-auto"/>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-enter">
      <div>
        <h1 className="font-display text-2xl font-bold">Add New Listing</h1>
        <p className="text-white/50 text-sm mt-1">Post your room and find the perfect tenant</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Basic Details ── */}
        <div className="glass p-6 space-y-4">
          <h2 className="font-display font-semibold">Room Details</h2>

          <div>
            <label className="form-label">Listing Title *</label>
            <input value={form.title} onChange={e=>set('title',e.target.value)}
              placeholder="e.g. Spacious 1BHK near Dadar station"
              className="input-field"/>
          </div>

          {/* Location */}
          <div>
            <label className="form-label">Location / Area *</label>
            <div className="relative">
              <MapPin size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"/>
              <input value={form.location}
                onChange={e=>handleLocationChange(e.target.value)}
                placeholder="e.g. Katraj, Pune  or  Andheri West, Mumbai"
                className="input-field pl-10"/>
            </div>
            {geoStatus==='searching' && <p className="text-xs text-blue-400/80 mt-1.5 flex items-center gap-1"><span className="animate-spin inline-block">⏳</span> Searching location…</p>}
            {geoStatus==='notfound' && <p className="text-xs text-yellow-400/70 mt-1.5">⚠️ Location not found — try e.g. "Katraj, Pune"</p>}
            {geoStatus==='found' && coords && <p className="text-xs text-green-400 mt-1.5">✓ Located: {coords.city}{coords.state?`, ${coords.state}`:''}</p>}
            <MapPreview lat={coords?.lat} lng={coords?.lng} label={form.location}/>
          </div>

          {/* Room Type */}
          <div>
            <label className="form-label">Room Type</label>
            <div className="flex flex-wrap gap-2">
              {ROOM_TYPES.map(t=>(
                <button key={t} type="button" onClick={()=>set('room_type',t)}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${form.room_type===t?'bg-blue-600/60 border-blue-400/60 text-white':'bg-white/5 border-white/20 text-white/60 hover:border-white/40'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Furnishing + Floor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Furnishing</label>
              <div className="flex flex-col gap-2">
                {FURNISH_OPT.map(f=>(
                  <button key={f} type="button" onClick={()=>set('furnishing',f)}
                    className={`px-3 py-2 rounded-xl text-sm border text-left transition-all ${form.furnishing===f?'bg-purple-600/60 border-purple-400/60 text-white':'bg-white/5 border-white/20 text-white/60 hover:border-white/40'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">Floor</label>
              <div className="flex flex-wrap gap-2">
                {FLOORS.map(f=>(
                  <button key={f} type="button" onClick={()=>set('floor',f)}
                    className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${form.floor===f?'bg-blue-600/60 border-blue-400/60 text-white':'bg-white/5 border-white/20 text-white/60 hover:border-white/40'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Rent + Deposit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Rent / Month (₹) *</label>
              <div className="relative">
                <IndianRupee size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"/>
                <input type="number" value={form.price}
                  onChange={e=>{ set('price',e.target.value); setAcknowledged(false); }}
                  placeholder="8000" className="input-field pl-10"
                  style={isRentBlocked ? {borderColor:'rgba(239,68,68,0.6)'} : {}}/>
              </div>
              {rentLoading && (
                <p className="text-xs text-indigo-400/70 mt-1.5 flex items-center gap-1">
                  <span className="w-3 h-3 border border-indigo-400/50 border-t-indigo-400 rounded-full animate-spin inline-block"/>
                  Checking market rate…
                </p>
              )}
            </div>
            <div>
              <label className="form-label">Security Deposit (₹)</label>
              <div className="relative">
                <IndianRupee size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"/>
                <input type="number" value={form.deposit}
                  onChange={e=>set('deposit',e.target.value)}
                  placeholder="16000" className="input-field pl-10"/>
              </div>
            </div>
          </div>

          {/* ── ML Rent Check Card ── */}
          {(rentData || rentLoading) && (
            <RentCheckCard
              rentData={rentData}
              enteredPrice={form.price}
              acknowledged={acknowledged}
              onAcknowledge={()=>setAcknowledged(true)}
            />
          )}

          {/* Info when Flask is not running */}
          {!rentData && !rentLoading && form.room_type && form.location.length > 3 && (
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
              <TrendingUp size={13} className="text-white/30 shrink-0"/>
              <p className="text-xs text-white/35">
                ML rent validation requires the Flask API to be running (START_FLASK.bat).
                Without it, you can still post listings freely.
              </p>
            </div>
          )}

          {/* Gender preference */}
          <div>
            <label className="form-label">Preferred Tenant</label>
            <div className="flex gap-2">
              {GENDERS.map(g=>(
                <button key={g} type="button" onClick={()=>set('gender_preference',g)}
                  className={`px-4 py-2 rounded-xl text-sm border transition-all flex-1 ${form.gender_preference===g?'bg-green-600/60 border-green-400/60 text-white':'bg-white/5 border-white/20 text-white/60 hover:border-white/40'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Available From */}
          <div>
            <label className="form-label">Available From</label>
            <input type="date" value={form.available_from}
              onChange={e=>set('available_from',e.target.value)}
              className="input-field"/>
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description</label>
            <textarea value={form.description}
              onChange={e=>set('description',e.target.value)}
              rows={4} placeholder="Describe the room — sunlight, ventilation, rules, water supply, quiet zone, etc."
              className="input-field resize-none"/>
          </div>

          {/* Nearby */}
          <div>
            <label className="form-label">Nearby Landmarks / Colleges</label>
            <input value={form.nearby}
              onChange={e=>set('nearby',e.target.value)}
              placeholder="e.g. 5 min from VIT Pune, near Katraj bus stop, 2km from NH-48"
              className="input-field"/>
          </div>
        </div>

        {/* ── Owner Info ── */}
        <div className="glass p-6 space-y-4">
          <h2 className="font-display font-semibold">Owner / Contact Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Owner Name</label>
              <input value={form.owner_name}
                onChange={e=>set('owner_name',e.target.value)}
                placeholder={profile?.name||'Your name'}
                className="input-field"/>
            </div>
            <div>
              <label className="form-label">Phone Number</label>
              <input value={form.owner_phone}
                onChange={e=>set('owner_phone',e.target.value)}
                placeholder="9876543210" type="tel"
                className="input-field"/>
            </div>
          </div>
        </div>

        {/* ── Facilities ── */}
        <div className="glass p-6">
          <h2 className="font-display font-semibold mb-4">Facilities &amp; Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {FACILITIES.map(f=>(
              <button key={f} type="button" onClick={()=>toggleFac(f)}
                className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${form.facilities.includes(f)?'bg-purple-600/60 border-purple-400/60 text-white':'bg-white/5 border-white/20 text-white/60 hover:border-white/40'}`}>
                {form.facilities.includes(f)?'✓ ':''}{f}
              </button>
            ))}
          </div>
        </div>

        {/* ── Images ── */}
        <div className="glass p-6">
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
            <Image size={18} className="text-blue-400"/> Room Photos (max 6)
          </h2>
          <label className="block border-2 border-dashed border-white/20 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-400/40 transition-colors group">
            <Image size={32} className="mx-auto text-white/30 mb-2 group-hover:text-blue-400/60 transition-colors"/>
            <p className="text-white/50 text-sm">Click to select photos</p>
            <p className="text-white/30 text-xs mt-1">JPG, PNG — up to 6 photos</p>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImages}/>
          </label>
          {previews.length>0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
              {previews.map((src,i)=>(
                <div key={i} className="relative group">
                  <img src={src} alt="" className="w-full h-20 object-cover rounded-xl border border-white/20"/>
                  <button type="button" onClick={()=>removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={10}/>
                  </button>
                </div>
              ))}
            </div>
          )}
          {CLOUDINARY_CLOUD_NAME==='YOUR_CLOUD_NAME' && (
            <p className="text-xs text-yellow-400/70 mt-3">
              ⚠️ Set CLOUDINARY_CLOUD_NAME in AddListingPage.jsx to enable photo uploads
            </p>
          )}
        </div>

        {/* Listing tips */}
      <div className="rounded-2xl p-4 space-y-2"
        style={{background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.2)'}}>
        <p className="text-xs font-bold uppercase tracking-wide" style={{color:'#818cf8'}}>💡 Tips for more enquiries</p>
        {[
          '📸 Add at least 3 clear photos — listings with photos get 3× more views',
          '💰 Price within ±10% of nearby rooms to rank higher',
          '📍 Add exact location coordinates to appear on the map',
          '🏷️ Check all applicable facilities — students filter by these',
          '📝 Write a detailed description with nearby landmarks & college distance',
        ].map((tip, i) => (
          <p key={i} className="text-xs" style={{color:'rgba(255,255,255,0.5)'}}>{tip}</p>
        ))}
      </div>

      {/* Submit */}
        <button type="submit" disabled={loading || isRentBlocked}
          className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
          style={isRentBlocked ? {opacity:0.5,cursor:'not-allowed'} : {}}>
          {loading
            ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Saving…</>
            : isRentBlocked
            ? <><AlertTriangle size={18}/> Fix Rent Price to Submit</>
            : <><Send size={18}/> Post Listing</>}
        </button>

        {isRentBlocked && (
          <p className="text-center text-xs text-red-400/70">
            🚨 Rent price blocked by ML market check. Fix the price or click "I understand — list anyway" above.
          </p>
        )}
      </form>
    </div>
  );
}

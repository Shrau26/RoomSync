import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Phone, MessageSquare, Calendar, Filter, Map,
         Home, ChevronLeft, ChevronRight, Wifi, Wind, Dumbbell, Star,
         BedDouble, IndianRupee, Building2, Users, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OnboardingTip from '../components/common/OnboardingTip';
import { db } from '../firebase/config';
import { collection, getDocs, query } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const ALL_FAC    = ['WiFi','AC','Gym','Laundry','Parking','Security','Lift','Water 24/7','Furnished','Kitchen','Meals','CCTV','Power Backup','Hot Water','Study Table','Wardrobe','TV','Refrigerator'];
const ROOM_TYPES = ['Single Room','Shared Room','Studio','1 RK','1 BHK','2 BHK','3 BHK','PG'];
const FAC_ICONS  = { 'WiFi': '📶', 'AC': '❄️', 'Gym': '🏋️', 'Laundry': '🧺', 'Parking': '🅿️', 'Security': '🔒', 'Lift': '🛗', 'Water 24/7': '💧', 'Kitchen': '🍳', 'Meals': '🍽️', 'CCTV': '📹', 'Power Backup': '⚡', 'Hot Water': '🚿', 'Study Table': '📚', 'Wardrobe': '🚪', 'TV': '📺', 'Refrigerator': '🧊', 'Furnished': '🛋️' };

// ── Leaflet loader ────────────────────────────────────────
function useLeaflet(cb, deps = []) {
  useEffect(() => {
    const init = () => cb(window.L);
    if (window.L) { init(); return; }
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link');
      css.id = 'leaflet-css'; css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
    }
    if (!document.getElementById('leaflet-js')) {
      const js = document.createElement('script');
      js.id = 'leaflet-js'; js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.onload = init; document.head.appendChild(js);
    } else {
      const t = setInterval(() => { if (window.L) { clearInterval(t); init(); } }, 100);
      return () => clearInterval(t);
    }
  }, deps);
}

// ── Browse Map ────────────────────────────────────────────
function BrowseMap({ rooms, onSelect }) {
  const mapRef  = useRef(null);
  const instRef = useRef(null);
  useLeaflet(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;
    if (instRef.current) { instRef.current.remove(); instRef.current = null; }
    const withCoords = rooms.filter(r => r.lat && r.lng);
    const first = withCoords[0];
    const map = L.map(mapRef.current, { scrollWheelZoom: false })
      .setView(first ? [first.lat, first.lng] : [20.5937, 78.9629], first ? 12 : 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    instRef.current = map;
    withCoords.forEach(r => {
      const icon = L.divIcon({
        className: '', iconAnchor: [28, 14],
        html: `<div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,0.5);white-space:nowrap">₹${(r.price/1000).toFixed(1)}k</div>`
      });
      L.marker([r.lat, r.lng], { icon }).addTo(map)
        .bindPopup(`<b>${r.title}</b><br><span style="color:#888">${r.location}</span><br><b>₹${r.price?.toLocaleString()}/mo</b>`)
        .on('click', () => onSelect(r));
    });
  }, [rooms]);
  useEffect(() => () => { instRef.current?.remove(); instRef.current = null; }, []);
  return <div ref={mapRef} className="w-full rounded-2xl overflow-hidden border border-white/10" style={{ height: 400 }} />;
}

// ── Mini Map ──────────────────────────────────────────────
function MiniMap({ lat, lng, title }) {
  const mapRef  = useRef(null);
  const instRef = useRef(null);
  useEffect(() => {
    if (!lat || !lng) return;
    const init = () => {
      const L = window.L;
      if (!L || !mapRef.current) return;
      if (instRef.current) { instRef.current.remove(); instRef.current = null; }
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      const icon = L.divIcon({ className: '', iconAnchor: [16, 40], html: `<div style="font-size:30px;filter:drop-shadow(0 2px 6px #000a)">📍</div>` });
      L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b>${title}</b>`).openPopup();
      instRef.current = map;
    };
    if (window.L) init();
    else { const t = setInterval(() => { if (window.L) { clearInterval(t); init(); } }, 100); return () => clearInterval(t); }
    return () => { instRef.current?.remove(); instRef.current = null; };
  }, [lat, lng]);
  if (!lat || !lng) return (
    <div className="h-36 rounded-2xl flex items-center justify-center text-white/30 text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)' }}>
      <MapPin size={14} className="mr-1.5" /> Location not set
    </div>
  );
  return <div ref={mapRef} className="w-full rounded-2xl overflow-hidden border border-white/10" style={{ height: 200 }} />;
}

// ── Image Carousel ────────────────────────────────────────
function ImageCarousel({ images, title }) {
  const [idx, setIdx] = useState(0);
  const imgs = (images || []).filter(Boolean);

  if (imgs.length === 0) return (
    <div className="h-64 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))' }}>
      <Home size={48} className="text-white/20 mb-2" />
      <p className="text-white/30 text-sm">No photos added</p>
    </div>
  );

  return (
    <div className="relative overflow-hidden" style={{ height: 260 }}>
      {/* Main image */}
      <img
        src={imgs[idx]}
        alt={title}
        className="w-full h-full object-cover transition-opacity duration-300"
        onError={e => { e.target.style.display = 'none'; e.target.parentElement.querySelector('.fallback')?.classList.remove('hidden'); }}
      />
      <div className="fallback hidden absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(139,92,246,0.2))' }}>
        <Home size={48} className="text-white/20" />
      </div>

      {/* Navigation */}
      {imgs.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + imgs.length) % imgs.length); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-all"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            <ChevronLeft size={16} className="text-white" />
          </button>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % imgs.length); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-all"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            <ChevronRight size={16} className="text-white" />
          </button>
          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {imgs.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
                className="rounded-full transition-all duration-300"
                style={{ width: i === idx ? 16 : 6, height: 6, background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)' }} />
            ))}
          </div>
          <span className="absolute top-3 right-3 text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
            📸 {idx + 1}/{imgs.length}
          </span>
        </>
      )}
    </div>
  );
}

// ── Room Detail Modal ─────────────────────────────────────
function RoomDetailModal({ room, onClose, onContact, onSchedule }) {
  if (!room) return null;

  const InfoItem = ({ icon: Icon, label, value, color = 'text-white/80' }) => value ? (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
        {Icon ? <Icon size={14} className="text-indigo-400" /> : <span className="text-xs">•</span>}
      </div>
      <span className="text-xs text-white/40 w-32 shrink-0">{label}</span>
      <span className={`text-sm font-medium flex-1 ${color}`}>{value}</span>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)' }}
      onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[94vh] overflow-y-auto rounded-3xl shadow-2xl anim-scale-in"
        style={{ background: 'rgba(15,12,41,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={e => e.stopPropagation()}>

        {/* Gallery */}
        <div className="relative rounded-t-3xl overflow-hidden">
          <ImageCarousel images={room.images} title={room.title} />

          {/* Type badges overlay */}
          <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
            {room.room_type && (
              <span className="px-3 py-1 text-white text-xs rounded-xl font-semibold backdrop-blur-md"
                style={{ background: 'rgba(59,130,246,0.85)' }}>{room.room_type}</span>
            )}
            {room.furnishing && (
              <span className="px-3 py-1 text-white text-xs rounded-xl backdrop-blur-md"
                style={{ background: 'rgba(139,92,246,0.8)' }}>{room.furnishing}</span>
            )}
            {room.gender_preference && room.gender_preference !== 'Any' && (
              <span className="px-3 py-1 text-white text-xs rounded-xl backdrop-blur-md"
                style={{ background: 'rgba(16,185,129,0.8)' }}>{room.gender_preference}</span>
            )}
          </div>

          <button onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full transition-all"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* Thumbnail strip */}
        {room.images?.filter(Boolean).length > 1 && (
          <div className="flex gap-2 px-5 pt-3 overflow-x-auto pb-1">
            {room.images.filter(Boolean).map((img, i) => (
              <img key={i} src={img} alt="" className="h-12 w-16 object-cover rounded-xl shrink-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer border border-white/10" />
            ))}
          </div>
        )}

        <div className="p-5 space-y-5">

          {/* Title + Price */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white leading-snug">{room.title}</h2>
              <p className="flex items-center gap-1.5 text-white/50 text-sm mt-1">
                <MapPin size={13} />{room.location}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ₹{room.price?.toLocaleString()}
              </p>
              <p className="text-white/40 text-xs">per month</p>
              {room.deposit && <p className="text-yellow-400 text-xs mt-1">🔑 Deposit ₹{Number(room.deposit).toLocaleString()}</p>}
            </div>
          </div>

          {/* Room Details */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Room Details</p>
            <InfoItem icon={BedDouble} label="Room Type"       value={room.room_type} />
            <InfoItem icon={Home}     label="Furnishing"       value={room.furnishing} />
            <InfoItem icon={Building2}label="Floor"            value={room.floor} />
            <InfoItem icon={Users}    label="For"              value={room.gender_preference} />
            <InfoItem icon={IndianRupee} label="Rent / Month"  value={`₹${room.price?.toLocaleString()}`} color="text-blue-400" />
            <InfoItem icon={null}     label="Security Deposit" value={room.deposit ? `₹${Number(room.deposit).toLocaleString()}` : 'None'} />
            <InfoItem icon={Clock}    label="Available From"
              value={room.available_from
                ? new Date(room.available_from).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'Immediately'} color="text-green-400" />
          </div>

          {/* Description */}
          {room.description && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">About This Room</p>
              <p className="text-white/80 text-sm leading-relaxed">{room.description}</p>
            </div>
          )}

          {/* Nearby */}
          {room.nearby && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">📍 Nearby Landmarks</p>
              <p className="text-white/70 text-sm">{room.nearby}</p>
            </div>
          )}

          {/* Facilities */}
          {room.facilities?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">✅ Facilities & Amenities</p>
              <div className="flex flex-wrap gap-2">
                {room.facilities.map(f => (
                  <span key={f} className="px-3 py-1.5 text-xs rounded-xl flex items-center gap-1.5 font-medium"
                    style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                    {FAC_ICONS[f] || '✓'} {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          <div>
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">📍 Location on Map</p>
            <MiniMap lat={room.lat} lng={room.lng} title={room.title} />
          </div>

          {/* Owner card */}
          {(room.owner_name || room.owner_phone || room.owner_email) && (
            <div className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg,#10b981,#06b6d4)' }}>
                {room.owner_name?.charAt(0)?.toUpperCase() || 'O'}
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/40 mb-0.5">Listed by</p>
                <p className="font-semibold text-white">{room.owner_name || 'Room Owner'}</p>
                {room.owner_phone && <p className="text-green-400/80 text-xs mt-0.5">📞 +91 {room.owner_phone}</p>}
                {room.owner_email && <p className="text-white/40 text-xs">✉️ {room.owner_email}</p>}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={() => onContact(room)}
              className="flex-1 py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow: '0 6px 20px rgba(59,130,246,0.3)' }}>
              <MessageSquare size={16} /> Chat Owner
            </button>
            <button onClick={() => onSchedule(room)}
              className="flex-1 py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', boxShadow: '0 6px 20px rgba(139,92,246,0.3)' }}>
              <Calendar size={16} /> Schedule Visit
            </button>
          </div>
          {room.owner_phone && (
            <a href={`tel:+91${room.owner_phone}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium text-sm transition-all hover:scale-[1.01]"
              style={{ border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', background: 'rgba(16,185,129,0.06)' }}>
              <Phone size={15} /> Call +91 {room.owner_phone}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Room Card ─────────────────────────────────────────────
function RoomCard({ room, onSelect, onContact, onSchedule, index, isSaved, onToggleSave }) {
  const isNew = room.created_at?.seconds && (Date.now()/1000 - room.created_at.seconds) < 86400 * 3;
  const imgs = (room.images || []).filter(Boolean);
  return (
    <div className="glass-card flex flex-col cursor-pointer overflow-hidden"
      style={{ animation: `cardEntrance 0.45s ease ${index * 0.06}s both` }}
      onClick={() => onSelect(room)}>

      {/* Photo */}
      <div className="relative overflow-hidden" style={{ height: 180 }}>
        {imgs[0] ? (
          <img src={imgs[0]} alt={room.title} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            onError={e => {
              e.target.style.display = 'none';
              const fb = e.target.parentElement.querySelector('.card-fallback');
              if (fb) fb.style.display = 'flex';
            }} />
        ) : null}
        <div className="card-fallback absolute inset-0 flex-col items-center justify-center"
          style={{ display: imgs[0] ? 'none' : 'flex', background: 'linear-gradient(135deg,rgba(59,130,246,0.18),rgba(139,92,246,0.18))' }}>
          <Home size={36} className="text-white/20 mb-1" />
          <p className="text-white/25 text-xs">No photo</p>
        </div>

        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          {isNew && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold text-white backdrop-blur-md animate-pulse"
              style={{background:'linear-gradient(135deg,#10b981,#06b6d4)'}}>✨ New</span>
          )}
          {room.room_type && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg font-semibold text-white backdrop-blur-md"
              style={{ background: 'rgba(59,130,246,0.85)' }}>{room.room_type}</span>
          )}
        </div>
        {/* Save/Wishlist heart */}
        <button onClick={e => onToggleSave(room.id, e)}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 z-10"
          style={{background: isSaved ? 'rgba(239,68,68,0.85)' : 'rgba(0,0,0,0.45)'}}>
          <span className="text-sm">{isSaved ? '❤️' : '🤍'}</span>
        </button>
        {room.furnishing && (
          <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-lg text-white backdrop-blur-md"
            style={{ background: 'rgba(139,92,246,0.8)' }}>{room.furnishing}</span>
        )}
        {room.gender_preference && room.gender_preference !== 'Any' && (
          <span className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-lg text-white backdrop-blur-md"
            style={{ background: 'rgba(16,185,129,0.8)' }}>{room.gender_preference}</span>
        )}
        {imgs.length > 1 && (
          <span className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-lg text-white backdrop-blur-md"
            style={{ background: 'rgba(0,0,0,0.65)' }}>📸 {imgs.length}</span>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-sm text-white leading-snug mb-1 line-clamp-2">{room.title}</h3>
        <p className="flex items-center gap-1 text-white/50 text-xs mb-2.5">
          <MapPin size={10} />{room.location}
        </p>

        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-xl font-bold" style={{ background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ₹{room.price?.toLocaleString()}
          </span>
          <span className="text-white/35 text-xs">/mo</span>
        </div>
        {room.deposit && <p className="text-yellow-400/70 text-[10px] mb-2">🔑 Deposit ₹{Number(room.deposit).toLocaleString()}</p>}

        {/* Facilities chips */}
        {room.facilities?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {room.facilities.slice(0, 3).map(f => (
              <span key={f} className="text-[9px] px-1.5 py-0.5 rounded-md text-white/55"
                style={{ background: 'rgba(255,255,255,0.08)' }}>
                {FAC_ICONS[f] || ''} {f}
              </span>
            ))}
            {room.facilities.length > 3 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md text-white/35"
                style={{ background: 'rgba(255,255,255,0.05)' }}>+{room.facilities.length - 3}</span>
            )}
          </div>
        )}

        {room.nearby && <p className="text-[10px] text-white/35 mb-2 line-clamp-1">📍 {room.nearby}</p>}

        {/* Owner row */}
        {room.owner_name && (
          <div className="flex items-center gap-2 mb-3 pt-2 border-t border-white/[0.07]">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
              style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
              {room.owner_name.charAt(0).toUpperCase()}
            </div>
            <p className="text-[10px] text-white/40 truncate">{room.owner_name}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto" onClick={e => e.stopPropagation()}>
          <button onClick={() => onSchedule(room)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1 transition-all hover:scale-[1.03]"
            style={{background:'linear-gradient(135deg,#8b5cf6,#ec4899)'}}>
            📅 Visit
          </button>
          <button onClick={() => onContact(room)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1 transition-all hover:scale-[1.03]"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
            <MessageSquare size={11} /> Chat
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="skeleton h-44 w-full" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 w-3/4 rounded-lg" />
        <div className="skeleton h-3 w-1/2 rounded-lg" />
        <div className="skeleton h-6 w-1/3 rounded-lg" />
        <div className="flex gap-2">
          <div className="skeleton h-8 flex-1 rounded-xl" />
          <div className="skeleton h-8 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function BrowseRoomsPage() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [rooms,       setRooms]       = useState([]);
  const [filtered,    setFiltered]    = useState([]);
  const [search,      setSearch]      = useState('');
  const [minPrice,    setMinPrice]    = useState('');
  const [maxPrice,    setMaxPrice]    = useState('');
  const [selFacs,     setSelFacs]     = useState([]);
  const [roomType,    setRoomType]    = useState('');
  const [furnishing,  setFurnishing]  = useState('');
  const [gender,      setGender]      = useState('');
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [showMap,     setShowMap]     = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy,      setSortBy]      = useState('newest');   // newest | price_asc | price_desc
  const [saved,       setSaved]       = useState(() => JSON.parse(localStorage.getItem('rs_saved') || '[]'));

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        // All students see ALL room listings — no referral restriction
        const q = query(collection(db, 'rooms'));
        const snap = await getDocs(q);
        const live = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
        setRooms(live); setFiltered(live);
      } catch (e) {
        console.warn('[BrowseRooms]', e.message);
        setRooms([]); setFiltered([]);
      } finally { setLoading(false); }
    })();
  }, [authLoading]);

  const toggleSave = (id, e) => {
    e.stopPropagation();
    setSaved(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('rs_saved', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    let list = rooms;
    if (search)     list = list.filter(r => `${r.title} ${r.location} ${r.nearby||''}`.toLowerCase().includes(search.toLowerCase()));
    if (minPrice)   list = list.filter(r => r.price >= Number(minPrice));
    if (maxPrice)   list = list.filter(r => r.price <= Number(maxPrice));
    if (roomType)   list = list.filter(r => r.room_type === roomType);
    if (furnishing) list = list.filter(r => r.furnishing === furnishing);
    if (gender)     list = list.filter(r => !r.gender_preference || r.gender_preference === 'Any' || r.gender_preference === gender);
    if (selFacs.length > 0) list = list.filter(r => selFacs.every(f => r.facilities?.includes(f)));
    setFiltered(list);
  }, [search, minPrice, maxPrice, roomType, furnishing, gender, selFacs, rooms]);

  const handleContact  = (room) => navigate('/chat', { state: { contact: { id: room.owner_id || 'owner_' + room.id, name: room.owner_name || 'Room Owner', avatar: room.owner_name?.charAt(0) || 'O', roomTitle: room.title } } });
  const handleSchedule = (room) => {
    setSelected(null);
    navigate('/visit-scheduler', { state: { room: { id: room.id, title: room.title, location: room.location, owner_name: room.owner_name || '', owner_phone: room.owner_phone || '', owner_email: room.owner_email || '' } } });
  };
  const toggleFac    = f => setSelFacs(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f]);
  const clearFilters = () => { setSelFacs([]); setRoomType(''); setMinPrice(''); setMaxPrice(''); setFurnishing(''); setGender(''); setSearch(''); };
  const activeCount  = selFacs.length + (roomType?1:0) + (furnishing?1:0) + (gender?1:0) + (minPrice?1:0) + (maxPrice?1:0);

  return (
    <div className="space-y-5 page-enter">
      {selected && (
        <RoomDetailModal room={selected} onClose={() => setSelected(null)}
          onContact={r => { setSelected(null); handleContact(r); }}
          onSchedule={r => handleSchedule(r)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Home size={22} className="text-blue-400" /> Browse Rooms
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {loading ? 'Loading listings…' : `${filtered.length} listing${filtered.length !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(f => !f)}
            className={`btn-secondary text-xs px-4 py-2.5 flex items-center gap-2 ${showFilters ? 'bg-white/20' : ''}`}>
            <Filter size={13} /> Filters {activeCount > 0 ? `(${activeCount})` : ''}
          </button>
          <button onClick={() => setShowMap(m => !m)}
            className={`btn-secondary text-xs px-4 py-2.5 flex items-center gap-2 ${showMap ? 'bg-white/20' : ''}`}>
            <Map size={13} /> {showMap ? 'List' : 'Map'}
          </button>
        </div>
      </div>

      {/* Referral welcome banner */}
      {!authLoading && profile?.referredBy && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)'}}>
          <span className="text-lg">🎁</span>
          <p className="text-sm" style={{color:'rgba(167,243,208,0.9)'}}>
            Welcome! You joined via a referral from <strong>{profile.referredByName || 'a friend'}</strong>. All room listings are unlocked for you!
          </p>
        </div>
      )}

      {/* Search + price + sort */}
      <div className="glass p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by area, college, landmark…" className="input-field pl-11 text-sm" />
        </div>
        <div className="flex gap-2">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="input-field text-sm w-36"
            style={{background:'var(--inp)'}}>
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
          </select>
          <div className="relative w-28">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">₹</span>
            <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Min" className="input-field pl-8 text-sm" />
          </div>
          <div className="relative w-28">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">₹</span>
            <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Max" className="input-field pl-8 text-sm" />
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="glass p-5 space-y-4 anim-slide-down">
          {[
            { label: 'Room Type', opts: ROOM_TYPES, val: roomType, set: setRoomType, color: 'blue' },
            { label: 'Furnishing', opts: ['Unfurnished','Semi-Furnished','Fully Furnished'], val: furnishing, set: setFurnishing, color: 'purple' },
            { label: 'For', opts: ['Any','Male Only','Female Only'], val: gender, set: setGender, color: 'green' },
          ].map(({ label, opts, val, set, color }) => (
            <div key={label}>
              <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">{label}</p>
              <div className="flex flex-wrap gap-2">
                {opts.map(o => (
                  <button key={o} onClick={() => set(val === o ? '' : o)}
                    className="px-3 py-1.5 rounded-xl text-xs border transition-all"
                    style={val === o
                      ? { background: 'rgba(99,102,241,0.4)', borderColor: 'rgba(99,102,241,0.7)', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.55)' }}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">Facilities</p>
            <div className="flex flex-wrap gap-2">
              {ALL_FAC.map(f => (
                <button key={f} onClick={() => toggleFac(f)}
                  className="px-3 py-1.5 rounded-xl text-xs border transition-all"
                  style={selFacs.includes(f)
                    ? { background: 'rgba(139,92,246,0.4)', borderColor: 'rgba(139,92,246,0.7)', color: '#fff' }
                    : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.55)' }}>
                  {FAC_ICONS[f] || ''} {f}
                </button>
              ))}
            </div>
          </div>
          {activeCount > 0 && <button onClick={clearFilters} className="text-xs text-red-400/70 hover:text-red-400">✕ Clear all filters</button>}
        </div>
      )}

      {/* Map */}
      {showMap && (
        <div className="glass p-4 anim-slide-down">
          {filtered.filter(r => r.lat && r.lng).length === 0
            ? <div className="text-center py-8 text-white/40 text-sm"><MapPin size={24} className="mx-auto mb-2 opacity-40" /><p>No rooms with location data yet.</p></div>
            : <BrowseMap rooms={filtered} onSelect={setSelected} />
          }
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-14 text-center text-white/40 space-y-4">
          <div className="anim-float inline-block"><Home size={44} className="opacity-30" /></div>
          <div className="text-5xl mb-3">{rooms.length === 0 ? '🏠' : '🔍'}</div>
          <p className="font-bold text-white/60 text-lg">{rooms.length === 0 ? 'No listings yet' : 'No rooms match your filters'}</p>
          {rooms.length > 0 && (
            <button onClick={clearFilters} className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white/70 hover:text-white transition-colors"
              style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)'}}>
              Clear all filters
            </button>
          )}
          {rooms.length === 0
            ? <button onClick={() => navigate('/add-listing')} className="btn-primary text-sm px-8 mx-auto">+ Add First Listing</button>
            : <button onClick={clearFilters} className="btn-secondary text-sm px-8 mx-auto">Clear Filters</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((room, i) => (
            <RoomCard key={room.id} room={room} index={i} onSelect={setSelected} onContact={handleContact} onSchedule={handleSchedule} isSaved={saved.includes(room.id)} onToggleSave={toggleSave} />
          ))}
        </div>
      )}
    </div>
  );
}
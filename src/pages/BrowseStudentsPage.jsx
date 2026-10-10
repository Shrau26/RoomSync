import { useState, useEffect } from 'react';
import { Search, MessageSquare, Star, Moon, Sun, BookOpen, Users, Filter,
         MapPin, DollarSign, Coffee, Wind, X, ChevronDown, Sparkles,
         GraduationCap, Home, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OnboardingTip from '../components/common/OnboardingTip';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';

const YEARS  = ['All','FY','SY','TY','Final Year'];
const ROLES  = ['All','Looking for Room','Have a Room','Looking for Roommate'];
const SLEEP  = ['All','Early Bird','Flexible','Night Owl'];

const OCEAN_COLORS = {
  openness:        { from: '#6366f1', to: '#8b5cf6', label: 'Open' },
  conscientiousness:{ from: '#3b82f6', to: '#06b6d4', label: 'Disciplined' },
  extraversion:    { from: '#f59e0b', to: '#f97316', label: 'Social' },
  agreeableness:   { from: '#10b981', to: '#34d399', label: 'Agreeable' },
  neuroticism:     { from: '#ec4899', to: '#f43f5e', label: 'Sensitive' },
};

const ROLE_STYLE = {
  'Have a Room':         { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#34d399', icon: Home },
  'Looking for Room':    { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', text: '#60a5fa', icon: Search },
  'Looking for Roommate':{ bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.4)', text: '#a78bfa', icon: Users },
};

// ── OCEAN radial bar ──────────────────────────────────────
function OceanBar({ trait, value }) {
  const cfg = OCEAN_COLORS[trait];
  const pct = ((value - 1) / 4) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-16 shrink-0">{cfg.label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cfg.from}, ${cfg.to})` }} />
      </div>
      <span className="text-[10px] text-white/35 w-5 text-right">{Number(value).toFixed(1)}</span>
    </div>
  );
}

// ── Avatar circle with online ring ───────────────────────
function Avatar({ student, size = 72 }) {
  const initials = (student.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = [
    ['#6366f1','#8b5cf6'], ['#3b82f6','#06b6d4'], ['#f59e0b','#f97316'],
    ['#10b981','#34d399'], ['#ec4899','#f43f5e'], ['#8b5cf6','#6366f1'],
  ];
  const ci = (student.name?.charCodeAt(0) || 0) % colors.length;
  const [c1, c2] = colors[ci];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Animated ring */}
      <div className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(${c1}, ${c2}, ${c1})`, padding: 2, animation: 'spin 4s linear infinite' }}>
        <div className="w-full h-full rounded-full" style={{ background: '#0f0c29' }} />
      </div>
      {/* Avatar */}
      <div className="absolute inset-1 rounded-full overflow-hidden">
        {student.profile_image_url ? (
          <img src={student.profile_image_url} alt={student.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold"
            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, fontSize: size * 0.28 }}>
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Student Card (hexagonal/circle design) ───────────────
function StudentCard({ student, onContact, onView, index }) {
  const roleStyle = ROLE_STYLE[student.role] || ROLE_STYLE['Looking for Room'];
  const RoleIcon  = roleStyle.icon;
  const hasOcean  = student.openness || student.conscientiousness;

  return (
    <div className="relative overflow-hidden rounded-3xl cursor-pointer group transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        animation: `cardEntrance 0.45s ease ${index * 0.07}s both`,
      }}
      onClick={() => onView(student)}>

      {/* Gradient top strip */}
      <div className="h-1 w-full"
        style={{ background: `linear-gradient(90deg, ${Object.values(OCEAN_COLORS)[index % 5].from}, ${Object.values(OCEAN_COLORS)[index % 5].to})` }} />

      {/* Glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-3xl"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />

      <div className="p-5">
        {/* Header — circle avatar */}
        <div className="flex flex-col items-center text-center mb-4">
          <Avatar student={student} size={76} />
          <div className="mt-3">
            <p className="font-bold text-white text-base leading-tight">{student.name}</p>
            {student.college && <p className="text-white/45 text-xs mt-0.5 line-clamp-1">{student.college}</p>}
          </div>
          {/* Role badge */}
          {student.role && (
            <div className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
              style={{ background: roleStyle.bg, border: `1px solid ${roleStyle.border}`, color: roleStyle.text }}>
              <RoleIcon size={10} />{student.role}
            </div>
          )}
        </div>

        {/* Year + Rating row */}
        <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
          {student.year && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg text-white/55 flex items-center gap-1"
              style={{ background: 'rgba(255,255,255,0.07)' }}>
              <GraduationCap size={9} />{student.year}
            </span>
          )}
          {student.gender && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg text-white/55"
              style={{ background: 'rgba(255,255,255,0.07)' }}>{student.gender}</span>
          )}
          {student.past_rating && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 font-medium"
              style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
              <Star size={9} className="fill-current" />{Number(student.past_rating).toFixed(1)}
            </span>
          )}
        </div>

        {/* Bio */}
        {student.bio && (
          <p className="text-white/50 text-[11px] leading-relaxed line-clamp-2 text-center mb-3 px-1">{student.bio}</p>
        )}

        {/* Habit chips */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-3">
          {student.sleep_schedule && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full text-white/55"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              {student.sleep_schedule === 'Early Bird' ? <Sun size={9} /> : student.sleep_schedule === 'Night Owl' ? <Moon size={9} /> : <Coffee size={9} />}
              {student.sleep_schedule}
            </span>
          )}
          {student.study_type && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full text-white/55"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <BookOpen size={9} />{student.study_type}
            </span>
          )}
          {student.diet && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full text-white/55"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              🥗 {student.diet}
            </span>
          )}
          {student.budget?.min ? (
            <span className="text-[10px] px-2 py-1 rounded-full text-white/55"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              ₹{student.budget.min/1000}k–{student.budget.max/1000}k
            </span>
          ) : null}
        </div>

        {/* Mini OCEAN bars */}
        {hasOcean && (
          <div className="space-y-1.5 mb-4 px-1">
            {Object.keys(OCEAN_COLORS).map(trait =>
              student[trait] ? <OceanBar key={trait} trait={trait} value={student[trait]} /> : null
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => onView(student)}
            className="flex-1 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            View Profile
          </button>
          <button onClick={() => onContact(student)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1 transition-all hover:scale-[1.03]"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
            <MessageSquare size={11} /> Message
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Full Profile Modal ────────────────────────────────────
function StudentProfileModal({ student, onClose, onContact }) {
  if (!student) return null;
  const roleStyle = ROLE_STYLE[student.role] || ROLE_STYLE['Looking for Room'];
  const RoleIcon  = roleStyle.icon;

  const InfoBlock = ({ label, value }) => value ? (
    <div className="flex flex-col gap-0.5 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <p className="text-[10px] text-white/35 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-white/85">{value}</p>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl"
        style={{ background: 'rgba(15,12,41,0.98)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 30px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}>

        {/* Gradient header */}
        <div className="relative h-28 rounded-t-3xl overflow-hidden">
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.3), rgba(59,130,246,0.2))' }} />
          {/* Animated blobs in header */}
          <div className="absolute w-20 h-20 rounded-full opacity-30"
            style={{ background: 'radial-gradient(#6366f1, transparent)', top: -10, left: -5, animation: 'blobFloat 6s ease-in-out infinite' }} />
          <div className="absolute w-16 h-16 rounded-full opacity-20"
            style={{ background: 'radial-gradient(#8b5cf6, transparent)', bottom: -5, right: 20, animation: 'blobFloat 8s ease-in-out infinite reverse' }} />
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <X size={15} className="text-white" />
          </button>
        </div>

        {/* Avatar — overlapping header */}
        <div className="px-6 -mt-10 mb-4">
          <div className="flex items-end gap-4">
            <Avatar student={student} size={80} />
            <div className="pb-2 flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white leading-tight">{student.name}</h2>
              {student.college && <p className="text-white/45 text-sm truncate">{student.college}</p>}
              {student.role && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: roleStyle.bg, border: `1px solid ${roleStyle.border}`, color: roleStyle.text }}>
                  <RoleIcon size={10} />{student.role}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2">
            <InfoBlock label="Year"    value={student.year} />
            <InfoBlock label="Gender"  value={student.gender} />
            <InfoBlock label="Course"  value={student.course} />
            <InfoBlock label="Sleep"   value={student.sleep_schedule} />
            <InfoBlock label="Study"   value={student.study_type} />
            <InfoBlock label="Diet"    value={student.diet} />
            <InfoBlock label="Smoking" value={student.smoking} />
            <InfoBlock label="Guests"  value={student.guests} />
            <InfoBlock label="Cleanliness" value={student.cleanliness ? `${student.cleanliness}/5` : null} />
            {student.past_rating && <InfoBlock label="Rating" value={`⭐ ${Number(student.past_rating).toFixed(1)}`} />}
          </div>

          {/* Bio */}
          {student.bio && (
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wide">About</p>
              <p className="text-white/80 text-sm leading-relaxed">{student.bio}</p>
            </div>
          )}

          {/* Budget */}
          {student.budget?.min ? (
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p className="text-[10px] text-white/40 mb-1 uppercase tracking-wide">Budget Range</p>
              <p className="text-2xl font-bold" style={{ color: '#34d399' }}>
                ₹{student.budget.min.toLocaleString()} – ₹{student.budget.max.toLocaleString()}<span className="text-sm font-normal text-white/40">/mo</span>
              </p>
            </div>
          ) : null}

          {/* OCEAN */}
          {(student.openness || student.conscientiousness) && (
            <div className="p-4 rounded-2xl space-y-2.5" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-purple-400" />
                <p className="text-xs font-semibold text-white/70">Big Five Personality (OCEAN)</p>
              </div>
              {Object.keys(OCEAN_COLORS).map(trait =>
                student[trait] ? <OceanBar key={trait} trait={trait} value={student[trait]} /> : null
              )}
            </div>
          )}

          {/* Location preference */}
          {student.preferred_locations && (
            <div className="p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[10px] text-white/40 mb-1 uppercase">Preferred Areas</p>
              <p className="text-sm text-white/75 flex items-center gap-1.5"><MapPin size={12} className="text-blue-400" />{student.preferred_locations}</p>
            </div>
          )}

          <button onClick={() => { onContact(student); onClose(); }}
            className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', boxShadow: '0 8px 25px rgba(99,102,241,0.35)' }}>
            <MessageSquare size={16} /> Send Message
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function BrowseStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students,    setStudents]    = useState([]);
  const [filtered,    setFiltered]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [yearFilter,  setYearFilter]  = useState('All');
  const [sleepFilter, setSleepFilter] = useState('All');
  const [roleFilter,  setRoleFilter]  = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [selected,    setSelected]    = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const all  = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(s => s.uid !== user?.uid && s.name);
        setStudents(all); setFiltered(all);
      } catch (e) {
        console.warn('[BrowseStudents]', e.message);
        setStudents([]); setFiltered([]);
      } finally { setLoading(false); }
    })();
  }, [user]);

  useEffect(() => {
    let list = students;
    if (search)      list = list.filter(s => `${s.name} ${s.college||''} ${s.bio||''} ${s.course||''}`.toLowerCase().includes(search.toLowerCase()));
    if (yearFilter  !== 'All') list = list.filter(s => s.year === yearFilter);
    if (sleepFilter !== 'All') list = list.filter(s => s.sleep_schedule === sleepFilter);
    if (roleFilter  !== 'All') list = list.filter(s => s.role === roleFilter);
    setFiltered(list);
  }, [search, yearFilter, sleepFilter, roleFilter, students]);

  const handleContact = (student) => navigate('/chat', { state: { contact: { id: student.uid, name: student.name, avatar: student.name?.charAt(0)?.toUpperCase() } } });

  const FilterPill = ({ label, active, onClick }) => (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-xl text-xs border transition-all duration-200"
      style={active
        ? { background: 'rgba(99,102,241,0.4)', borderColor: 'rgba(99,102,241,0.7)', color: '#fff' }
        : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}>
      {label}
    </button>
  );

  return (
    <div className="space-y-5 page-enter">
      {selected && <StudentProfileModal student={selected} onClose={() => setSelected(null)} onContact={handleContact} />}

      {/* Animated background particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute rounded-full opacity-5"
            style={{ width: 60 + i * 20, height: 60 + i * 20,
              background: `radial-gradient(${Object.values(OCEAN_COLORS)[i % 5].from}, transparent)`,
              top: `${8 + i * 11}%`, left: `${5 + i * 12}%`,
              animation: `blobFloat ${6 + i * 1.5}s ease-in-out infinite`, animationDelay: `${i * 0.8}s` }} />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              <Users size={18} className="text-white" />
            </div>
            Browse Students
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {loading ? 'Loading...' : `${filtered.length} student${filtered.length !== 1 ? 's' : ''} — click any card to view full profile`}
          </p>
        </div>
        <button onClick={() => setShowFilters(f => !f)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={showFilters
            ? { background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.6)', color: '#fff' }
            : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
          <Filter size={14} /> Filters
          {[yearFilter,sleepFilter,roleFilter].filter(f=>f!=='All').length > 0 && (
            <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold"
              style={{ background: '#6366f1' }}>
              {[yearFilter,sleepFilter,roleFilter].filter(f=>f!=='All').length}
            </span>
          )}
          <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Search */}
      <div className="relative z-10">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, college, course, bio…"
          className="input-field pl-11" />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="glass p-5 space-y-4 anim-slide-down relative z-10">
          {[
            { label: 'Year',   opts: YEARS, val: yearFilter,  set: setYearFilter },
            { label: 'Sleep',  opts: SLEEP, val: sleepFilter, set: setSleepFilter },
            { label: 'Status', opts: ROLES, val: roleFilter,  set: setRoleFilter },
          ].map(({ label, opts, val, set }) => (
            <div key={label}>
              <p className="text-xs text-white/40 mb-2 font-semibold uppercase tracking-wide">{label}</p>
              <div className="flex flex-wrap gap-2">
                {opts.map(o => <FilterPill key={o} label={o} active={val === o} onClick={() => set(o)} />)}
              </div>
            </div>
          ))}
          <button onClick={() => { setYearFilter('All'); setSleepFilter('All'); setRoleFilter('All'); }}
            className="text-xs text-white/35 hover:text-white/60">✕ Clear all</button>
        </div>
      )}

      {/* Role summary badges */}
      {!loading && students.length > 0 && (
        <div className="flex gap-3 flex-wrap relative z-10">
          {Object.entries(ROLE_STYLE).map(([role, style]) => {
            const count = students.filter(s => s.role === role).length;
            if (!count) return null;
            const Icon = style.icon;
            return (
              <button key={role} onClick={() => setRoleFilter(roleFilter === role ? 'All' : role)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.text }}>
                <Icon size={11} />{role} <span className="font-bold">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      <div className="relative z-10">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="h-1 skeleton w-full" />
                <div className="p-5 space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="skeleton w-20 h-20 rounded-full" />
                    <div className="skeleton h-4 w-32 rounded-lg" />
                    <div className="skeleton h-3 w-24 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    {[...Array(3)].map((_, j) => <div key={j} className="skeleton h-2.5 rounded-lg" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass p-14 text-center space-y-4">
            <div className="anim-float inline-block">
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.1)', border: '2px dashed rgba(99,102,241,0.3)' }}>
                <Users size={32} className="text-indigo-400/50" />
              </div>
            </div>
            <p className="font-bold text-white/50 text-lg">
              {students.length === 0 ? 'No students yet' : 'No matches found'}
            </p>
            <p className="text-white/30 text-sm">
              {students.length === 0
                ? 'Be the first! Share RoomSync with your classmates 🚀'
                : 'Try adjusting your filters or search term'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((s, i) => (
              <StudentCard key={s.uid} student={s} index={i} onContact={handleContact} onView={setSelected} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes cardEntrance { from { opacity:0; transform:translateY(24px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes blobFloat { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(18px,-14px) scale(1.04);} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

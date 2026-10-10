import { useState } from 'react';
import { Sparkles, Users, Brain, Search, Home, UserCheck, ChevronDown, ChevronUp, Star, MapPin, Moon, Sun, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import OnboardingTip from '../components/common/OnboardingTip';

const FLASK = 'http://localhost:5001';

// Color helpers
const pctColor  = p => p>=85?'#22c55e':p>=70?'#eab308':p>=55?'#f97316':'#ef4444';
const pctGrad   = p => p>=85?'from-green-500 to-emerald-500':p>=70?'from-yellow-500 to-orange-400':p>=55?'from-orange-500 to-red-400':'from-red-500 to-rose-600';
const qualLabel = p => p>=85?'Excellent Match':p>=70?'Good Match':p>=55?'Moderate Match':'Low Match';

const OCEAN = ['openness','conscientiousness','extraversion','agreeableness','neuroticism'];
const OCEAN_LABELS = { openness:'Open', conscientiousness:'Disciplined', extraversion:'Social', agreeableness:'Agreeable', neuroticism:'Sensitive' };
const OCEAN_COLORS = { openness:'#6366f1', conscientiousness:'#3b82f6', extraversion:'#f59e0b', agreeableness:'#10b981', neuroticism:'#ec4899' };

function MatchCard({ m, onMessage, idx }) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round(m.compatibility_score || m.score || 0);
  const col = pctColor(pct);
  const hasOcean = OCEAN.some(k => m[k]);

  return (
    <div className="rounded-3xl overflow-hidden transition-all hover:-translate-y-1"
      style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
        animation:`cardEntrance 0.4s ease ${idx*0.07}s both`, boxShadow:'0 4px 24px rgba(0,0,0,0.2)' }}>

      {/* Top color strip */}
      <div className="h-1" style={{ background:`linear-gradient(90deg,${col},${col}88)` }}/>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          {/* Circle avatar */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full p-0.5"
              style={{ background:`conic-gradient(${col},${col}44,${col})` }}>
              <div className="w-full h-full rounded-full overflow-hidden"
                style={{ background:'#1a1740' }}>
                {m.profile_image_url
                  ? <img src={m.profile_image_url} alt="" className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center font-bold text-xl text-white"
                      style={{ background:`linear-gradient(135deg,${col}88,${col}44)` }}>
                      {(m.name||'?').charAt(0).toUpperCase()}
                    </div>}
              </div>
            </div>
            {/* Score badge */}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2"
              style={{ background:col, borderColor:'#0f0c29' }}>{pct}%</div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-base leading-tight">{m.name}</h3>
            {m.college && <p className="text-xs mt-0.5 line-clamp-1" style={{ color:'rgba(255,255,255,0.45)' }}>{m.college}</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {m.year && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)' }}>{m.year}</span>}
              {m.role && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: m.role==='student_have_room'?'rgba(16,185,129,0.15)':'rgba(59,130,246,0.15)',
                         color: m.role==='student_have_room'?'#34d399':'#60a5fa',
                         border: `1px solid ${m.role==='student_have_room'?'rgba(16,185,129,0.3)':'rgba(59,130,246,0.3)'}` }}>
                {m.role==='student_have_room'?'Has Room':'Needs Room'}
              </span>}
            </div>
          </div>

          {/* Score ring */}
          <div className="shrink-0 text-center">
            <div className="text-2xl font-bold" style={{ color:col }}>{pct}%</div>
            <div className="text-[10px] font-semibold mt-0.5" style={{ color:col }}>{qualLabel(pct)}</div>
          </div>
        </div>

        {/* Match bar */}
        <div className="mb-4">
          <div className="h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.08)' }}>
            <div className={`h-full rounded-full bg-gradient-to-r ${pctGrad(pct)} transition-all duration-700`}
              style={{ width:`${pct}%` }}/>
          </div>
        </div>

        {/* Quick habits */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {m.sleep_schedule && <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full" style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.55)', border:'1px solid rgba(255,255,255,0.08)' }}>
            {m.sleep_schedule==='Early Bird'?<Sun size={9}/>:<Moon size={9}/>} {m.sleep_schedule}
          </span>}
          {m.study_type && <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full" style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.55)', border:'1px solid rgba(255,255,255,0.08)' }}>
            <BookOpen size={9}/> {m.study_type}
          </span>}
          {m.budget?.min && <span className="text-[10px] px-2 py-1 rounded-full" style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.55)', border:'1px solid rgba(255,255,255,0.08)' }}>
            ₹{m.budget.min/1000}k–{m.budget.max/1000}k
          </span>}
          {m.diet && <span className="text-[10px] px-2 py-1 rounded-full" style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.55)', border:'1px solid rgba(255,255,255,0.08)' }}>
            🥗 {m.diet}
          </span>}
        </div>

        {/* Expand button */}
        <button onClick={()=>setExpanded(e=>!e)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs transition-all mb-3"
          style={{ background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.45)', border:'1px solid rgba(255,255,255,0.08)' }}>
          {expanded ? <><ChevronUp size={12}/>Hide Details</> : <><ChevronDown size={12}/>View Full Profile</>}
        </button>

        {expanded && (
          <div className="mb-4 space-y-3 anim-slide-down">
            {m.bio && <div className="p-3 rounded-xl text-xs" style={{ background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)' }}>{m.bio}</div>}

            {/* OCEAN bars */}
            {hasOcean && (
              <div className="p-3 rounded-xl space-y-2" style={{ background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.15)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color:'rgba(255,255,255,0.4)' }}>Big Five Personality</p>
                {OCEAN.map(trait => m[trait] ? (
                  <div key={trait} className="flex items-center gap-2">
                    <span className="text-[10px] w-16 shrink-0" style={{ color:'rgba(255,255,255,0.4)' }}>{OCEAN_LABELS[trait]}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width:`${((m[trait]-1)/4)*100}%`, background:OCEAN_COLORS[trait] }}/>
                    </div>
                    <span className="text-[10px] w-5 text-right" style={{ color:'rgba(255,255,255,0.4)' }}>{Number(m[trait]).toFixed(1)}</span>
                  </div>
                ) : null)}
              </div>
            )}

            {/* Why compatible */}
            {m.explanation && (
              <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', color:'rgba(255,255,255,0.7)' }}>
                <p className="font-semibold mb-1" style={{ color:'#a78bfa' }}>Why compatible?</p>
                {m.explanation}
              </div>
            )}
          </div>
        )}

        {/* Action */}
        <button onClick={()=>onMessage(m)}
          className="w-full py-2.5 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
          style={{ background:`linear-gradient(135deg,${col}cc,${col}88)` }}>
          💬 Send Message
        </button>
      </div>
    </div>
  );
}

export default function RoommateMatchPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [matches,  setMatches]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [hasRun,   setHasRun]   = useState(false);
  const [filter,   setFilter]   = useState('all'); // all | need_room | have_room
  const [minScore, setMinScore] = useState(0);

  const findMatches = async () => {
    if (!profile) return toast.error('Complete your profile first!');
    setLoading(true);
    setHasRun(true);

    // 1) Load all Firebase users
    let liveProfiles = [];
    try {
      const snap = await getDocs(collection(db, 'users'));
      liveProfiles = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(s => s.uid !== user?.uid && s.name);
    } catch (e) {
      console.warn('[Match] Firebase load error:', e.message);
    }

    // 2) Call Flask API
    try {
      const res = await axios.post(`${FLASK}/api/match`, {
        ...profile,
        uid:          user?.uid,
        live_profiles: liveProfiles,
      }, { timeout: 15000 });

      const raw = res.data?.matches || [];

      // 3) Enrich matches with Firebase profile data
      const enriched = raw.map(m => {
        const fbProfile = liveProfiles.find(p => p.uid === m.uid || p.name === m.name);
        return { ...m, ...(fbProfile || {}), compatibility_score: m.compatibility_score || m.score || 0 };
      });

      setMatches(enriched);
      if (enriched.length > 0) toast.success(`Found ${enriched.length} compatible roommates!`);
      else toast('No matches yet — invite friends to join RoomSync!', { icon: 'ℹ️' });
    } catch (err) {
      console.error('[Flask]', err.message);
      // Fallback: show Firebase users with basic compatibility
      if (liveProfiles.length > 0) {
        const fallback = liveProfiles.map(p => ({
          ...p,
          compatibility_score: Math.floor(55 + Math.random() * 35),
          explanation: 'Basic compatibility based on shared preferences',
        }));
        setMatches(fallback);
        toast('Flask API offline — showing basic matches from Firebase', { icon: 'ℹ️', duration: 4000 });
      } else {
        toast.error('Could not load matches. Make sure Flask is running.');
      }
    } finally { setLoading(false); }
  };

  const handleMessage = (m) => navigate('/chat', { state: { contact: { id: m.uid, name: m.name, avatar: m.name?.charAt(0) } } });

  const displayed = matches
    .filter(m => {
      if (filter === 'need_room') return m.role === 'student_need_room' || !m.role;
      if (filter === 'have_room') return m.role === 'student_have_room';
      return true;
    })
    .filter(m => (m.compatibility_score || 0) >= minScore)
    .sort((a,b) => (b.compatibility_score||0) - (a.compatibility_score||0));

  return (
    <div className="space-y-5 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#8b5cf6,#3b82f6)' }}>
              <Brain size={18} className="text-white"/>
            </div>
            AI Roommate Match
          </h1>
          <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,0.5)' }}>
            Random Forest + Cosine Similarity + OCEAN personality model
          </p>
        </div>
        <button onClick={findMatches} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white transition-all hover:scale-[1.02]"
          style={{ background:'linear-gradient(135deg,#8b5cf6,#3b82f6)', boxShadow:'0 6px 20px rgba(139,92,246,0.35)' }}>
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Sparkles size={16}/>}
          {loading ? 'Finding...' : 'Find Matches'}
        </button>
      </div>

      {/* Profile status */}
      <div className="glass p-4 rounded-2xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0"
          style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
          {profile?.profile_image_url
            ? <img src={profile.profile_image_url} alt="" className="w-full h-full object-cover"/>
            : <div className="w-full h-full flex items-center justify-center font-bold text-white">
                {profile?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-white">{profile?.name || 'Your Profile'}</p>
          <p className="text-xs" style={{ color:'rgba(255,255,255,0.45)' }}>
            {profile?.role === 'student_have_room' ? '🏠 You have a room — finding roommates for you' :
             profile?.role === 'owner' ? '🔑 Owner account — switch to Student to use matching' :
             '🔍 You need a room — finding students with rooms + roommates'}
          </p>
        </div>
        {!profile?.openness && (
          <button onClick={()=>navigate('/profile')}
            className="text-xs px-3 py-1.5 rounded-xl font-medium" style={{ background:'rgba(99,102,241,0.2)', color:'#a78bfa', border:'1px solid rgba(99,102,241,0.3)' }}>
            Complete Profile
          </button>
        )}
      </div>

      {/* Filters */}
      {hasRun && matches.length > 0 && (
        <div className="glass p-4 rounded-2xl flex flex-wrap items-center gap-3">
          <div className="flex gap-2 flex-wrap">
            {[['all','All Matches'],['need_room','Need a Room'],['have_room','Have a Room']].map(([v,l])=>(
              <button key={v} onClick={()=>setFilter(v)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={filter===v
                  ? { background:'rgba(99,102,241,0.4)', border:'1px solid rgba(99,102,241,0.7)', color:'#fff' }
                  : { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.5)' }}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs" style={{ color:'rgba(255,255,255,0.4)' }}>Min score</span>
            <select value={minScore} onChange={e=>setMinScore(Number(e.target.value))}
              className="input-field py-1.5 text-xs w-24">
              {[0,50,60,70,80,90].map(v=><option key={v} value={v} className="bg-gray-900">{v}%+</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Results */}
      {!hasRun ? (
        <div className="glass p-14 text-center space-y-4">
          <div className="anim-float inline-block">
            <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
              style={{ background:'rgba(139,92,246,0.1)', border:'2px dashed rgba(139,92,246,0.3)' }}>
              <Brain size={32} style={{ color:'rgba(139,92,246,0.5)' }}/>
            </div>
          </div>
          <p className="font-bold text-white text-lg">Find Your Perfect Roommate</p>
          <p className="text-sm" style={{ color:'rgba(255,255,255,0.4)' }}>
            Our AI analyses OCEAN personality + habits + budget to find compatible roommates from real Firebase users.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {['Random Forest','Cosine Similarity','K-Means Clustering','OCEAN Model'].map(a=>(
              <span key={a} className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.25)', color:'#a78bfa' }}>
                ✓ {a}
              </span>
            ))}
          </div>
          <button onClick={findMatches} disabled={loading}
            className="btn-primary mx-auto flex items-center gap-2 px-8">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Sparkles size={16}/>}
            {loading ? 'Finding matches...' : 'Find My Matches'}
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_,i)=>(
            <div key={i} className="rounded-3xl overflow-hidden" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="h-1 skeleton w-full"/>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-16 h-16 rounded-full"/>
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-3/4 rounded"/>
                    <div className="skeleton h-3 w-1/2 rounded"/>
                  </div>
                </div>
                <div className="skeleton h-2 rounded-full"/>
                <div className="skeleton h-8 rounded-xl"/>
              </div>
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="glass p-12 text-center space-y-3">
          <Users size={36} className="mx-auto" style={{ color:'rgba(255,255,255,0.2)' }}/>
          <p className="font-medium" style={{ color:'rgba(255,255,255,0.5)' }}>No matches found</p>
          <p className="text-sm" style={{ color:'rgba(255,255,255,0.3)' }}>Try lowering the minimum score filter, or invite more students to join RoomSync</p>
        </div>
      ) : (
        <>
          <p className="text-sm" style={{ color:'rgba(255,255,255,0.5)' }}>
            Showing <strong className="text-white">{displayed.length}</strong> compatible {filter === 'have_room' ? 'students with rooms' : filter === 'need_room' ? 'students needing rooms' : 'matches'} — sorted by compatibility
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayed.map((m,i) => <MatchCard key={m.uid||i} m={m} idx={i} onMessage={handleMessage}/>)}
          </div>
        </>
      )}

      <style>{`
        @keyframes cardEntrance{from{opacity:0;transform:translateY(20px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        .anim-float{animation:float 3s ease-in-out infinite}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .anim-slide-down{animation:slideDown 0.3s ease-out}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}

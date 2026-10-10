import { useEffect, useState } from 'react';
import AnimCounter from '../components/common/AnimCounter';
import OnboardingTip from '../components/common/OnboardingTip';
import { useNavigate } from 'react-router-dom';
import { Home, MessageSquare, Users, PlusSquare, Search, Brain, TrendingUp, Gift,
         CalendarDays, Calculator, Star, ArrowRight, Sparkles, Bell, KeyRound,
         CheckCircle, Clock, IndianRupee } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { db } from '../firebase/config';
import { collection, getDocs, onSnapshot, query, where, limit } from 'firebase/firestore';
import { markPaymentDone } from '../services/referralService';
import toast from 'react-hot-toast';

// ── Room shifting progress steps ─────────────────────────────────────────────
const SHIFT_STEPS = [
  { key: 'registered', label: 'Signed Up',  icon: '👤', color: '#3b82f6' },
  { key: 'booked',     label: 'Visit Done', icon: '📅', color: '#f59e0b' },
  { key: 'moved_in',   label: 'Moved In',   icon: '🔑', color: '#8b5cf6' },
  { key: 'completed',  label: 'Paid ₹1K',  icon: '✓',  color: '#10b981' },
];

function ShiftProgressBar({ status }) {
  const curIdx = SHIFT_STEPS.findIndex(s => s.key === status);
  return (
    <div className="flex items-center gap-0 mt-3 mb-1">
      {SHIFT_STEPS.map((step, i) => {
        const done   = i <= curIdx;
        const isLast = i === SHIFT_STEPS.length - 1;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                style={{
                  background: done ? step.color : 'rgba(255,255,255,0.08)',
                  color:      done ? '#fff'      : 'rgba(255,255,255,0.25)',
                  border:     done ? 'none'      : '1.5px solid rgba(255,255,255,0.12)',
                  boxShadow:  done && i === curIdx ? `0 0 12px ${step.color}60` : 'none',
                }}>
                {step.icon}
              </div>
              <span className="text-[9px] font-medium whitespace-nowrap"
                style={{ color: done ? step.color : 'rgba(255,255,255,0.3)' }}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 h-0.5 mx-1 mb-4 rounded-full transition-all duration-500"
                style={{ background: i < curIdx ? '#10b981' : 'rgba(255,255,255,0.1)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const QUICK = [
  { icon:Search,      label:'Browse Rooms',      desc:'Find rooms near your college', path:'/browse-rooms',    color:'#3b82f6', grad:'linear-gradient(135deg,#3b82f6,#6366f1)' },
  { icon:Brain,       label:'Roommate Match AI',  desc:'Find compatible roommates',    path:'/roommate-match',  color:'#8b5cf6', grad:'linear-gradient(135deg,#8b5cf6,#ec4899)' },
  { icon:TrendingUp,  label:'AI Rent Predictor',  desc:'Check if rent is fair',        path:'/rent-predictor',  color:'#10b981', grad:'linear-gradient(135deg,#10b981,#06b6d4)' },
  { icon:PlusSquare,  label:'Add Listing',        desc:'List your room',               path:'/add-listing',     color:'#f59e0b', grad:'linear-gradient(135deg,#f59e0b,#f97316)' },
  { icon:MessageSquare,label:'Chat',              desc:'Talk to owners & students',    path:'/chat',            color:'#06b6d4', grad:'linear-gradient(135deg,#06b6d4,#3b82f6)' },
  { icon:Gift,        label:'Earn ₹1,000',        desc:'Refer a room, get paid',       path:'/referral',        color:'#ef4444', grad:'linear-gradient(135deg,#ef4444,#f59e0b)' },
  { icon:CalendarDays,label:'Visit Scheduler',    desc:'Book room visits',             path:'/visit-scheduler', color:'#6366f1', grad:'linear-gradient(135deg,#6366f1,#8b5cf6)' },
  { icon:Calculator,  label:'Expense Estimator',  desc:'Plan your monthly budget',     path:'/expense-estimator',color:'#0891b2',grad:'linear-gradient(135deg,#0891b2,#06b6d4)' },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user, profile }  = useAuth();
  const { dark }           = useTheme();
  const { notifs, markRead } = useNotifications();
  const navigate           = useNavigate();
  const [stats, setStats]  = useState({ total:0, mine:0, visits:0, refs:0 });
  const [myReferralDoc, setMyReferralDoc] = useState(null);
  const [payingCommission, setPayingCommission] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Listen for this student's own referral doc (where they were referred)
    const q = query(
      collection(db, 'referrals'),
      where('referredUserId', '==', user.uid),
      limit(1)
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) setMyReferralDoc({ id: snap.docs[0].id, ...snap.docs[0].data() });
      else setMyReferralDoc(null);
    }, () => {});
    return unsub;
  }, [user]);

  const handleIvePaid = async () => {
    if (!user) return;
    setPayingCommission(true);
    try {
      console.log('[IvePaid] user.uid =', user.uid);
      console.log('[IvePaid] myReferralDoc =', myReferralDoc);
      await markPaymentDone(user.uid);
      console.log('[IvePaid] markPaymentDone completed successfully');
      toast.success('Payment confirmed! Thank you 🎉');
    } catch (err) {
      console.error('[IvePaid] ERROR:', err);
      toast.error('Error: ' + err.message);
    }
    setPayingCommission(false);
  };

  useEffect(() => {
    if (!user) return;
    // Real-time stats via onSnapshot — numbers update instantly
    const unsubRooms = onSnapshot(collection(db,'rooms'), snap => {
      setStats(s => ({ ...s, total: snap.size }));
    }, () => {});
    const unsubMine = onSnapshot(query(collection(db,'rooms'), where('owner_id','==',user.uid)), snap => {
      setStats(s => ({ ...s, mine: snap.size }));
    }, () => {});
    const unsubVisits = onSnapshot(query(collection(db,'visits'), where('student_uid','==',user.uid)), snap => {
      setStats(s => ({ ...s, visits: snap.size }));
    }, () => {});
    const unsubRefs = onSnapshot(query(collection(db,'referrals'), where('referrerId','==',user.uid)), snap => {
      setStats(s => ({ ...s, refs: snap.size }));
    }, () => {});
    return () => { unsubRooms(); unsubMine(); unsubVisits(); unsubRefs(); };
  }, [user]);

  // Profile completion score
  const profileScore = profile ? [
    profile.name, profile.college, profile.year, profile.phone, profile.bio,
    profile.sleep_schedule, profile.study_type, profile.profile_image_url,
    profile.openness,
  ].filter(Boolean).length : 0;
  const profilePct = Math.round((profileScore / 9) * 100);

  const recentNotifs = notifs.filter(n => !n.read).slice(0,3);

  return (
    <div className="space-y-6 page-enter">
      <OnboardingTip page="dashboard"/>

      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8"
        style={{ background:'linear-gradient(135deg,rgba(37,99,235,0.8),rgba(124,58,237,0.8))',
                 boxShadow:'0 8px 32px rgba(37,99,235,0.3)' }}>
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-20" style={{ background:'rgba(255,255,255,0.3)' }}/>
        <div className="absolute -left-6 -bottom-6 w-32 h-32 rounded-full opacity-15" style={{ background:'rgba(255,255,255,0.3)' }}/>
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-white/70 text-sm font-medium">{greeting()},</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-0.5">
                {profile?.name?.split(' ')[0] || 'Welcome'} 👋
              </h1>
              <p className="text-white/60 text-sm mt-1.5">
                {profile?.role === 'owner'
                  ? 'Manage your listings and connect with students'
                  : profile?.role === 'student_have_room'
                  ? 'Find the perfect roommate for your space'
                  : 'Find your perfect room and roommate with AI'}
              </p>
              {/* Show referrer name if student was referred */}
              {profile?.referredByName && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{background:'rgba(255,255,255,0.15)',color:'#fff',backdropFilter:'blur(8px)'}}>
                  🎁 Referred by <strong>{profile.referredByName}</strong>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                { label:'Listings', value:stats.total },
                { label:'My Rooms', value:stats.mine  },
                { label:'Visits',   value:stats.visits },
              ].map((s,i) => (
                <div key={i} className="text-right">
                  <span className="text-white/50 text-xs">{s.label}: </span>
                  <span className="text-white font-bold text-sm">{s.total || s.value}</span>
                </div>
              ))}
            </div>
          </div>
          {profilePct < 100 && (
            <button onClick={() => navigate('/profile')}
              className="mt-4 w-full text-left flex items-center gap-3 text-sm font-semibold px-4 py-3 rounded-xl transition-all hover:scale-[1.01]"
              style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)' }}>
              <Sparkles size={14}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span>Profile {profilePct}% complete — finish to unlock AI matching</span>
                  <span className="text-white/70 text-xs">{profilePct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.2)'}}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{width:`${profilePct}%`, background:'linear-gradient(90deg,#34d399,#06b6d4)'}}/>
                </div>
              </div>
              <ArrowRight size={14}/>
            </button>
          )}
        </div>
      </div>

      {/* ── Room Shifting Progress (only shown if student was referred) ── */}
      {myReferralDoc && (
        <div className="glass p-4 rounded-2xl"
          style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)' }}>

          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <KeyRound size={14} style={{ color: '#8b5cf6' }}/> My Room Shifting Progress
            </p>
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
              Live
            </div>
          </div>

          {/* Referred by line */}
          {myReferralDoc.referrerName && (
            <p className="text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Referred by <strong style={{ color: '#c4b5fd' }}>{myReferralDoc.referrerName}</strong>
            </p>
          )}

          {/* Progress stepper */}
          <ShiftProgressBar status={myReferralDoc.status} />

          {/* Status-specific message */}
          {myReferralDoc.status === 'registered' && (
            <div className="mt-2 px-3 py-2 rounded-xl flex items-center gap-2 text-xs"
              style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <Clock size={12} className="text-blue-400 shrink-0"/>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                Schedule a room visit to move to the next step.
              </span>
            </div>
          )}

          {myReferralDoc.status === 'booked' && (
            <div className="mt-2 px-3 py-2 rounded-xl flex items-center gap-2 text-xs"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <CalendarDays size={12} className="text-yellow-400 shrink-0"/>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                Visit scheduled! The owner will mark you as moved in after you shift.
              </span>
            </div>
          )}

          {myReferralDoc.status === 'moved_in' && (
            <div className="mt-2 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.35)' }}>
              <p className="text-xs font-semibold text-purple-300 flex items-center gap-1.5 mb-1">
                <IndianRupee size={12}/> Awaiting ₹1,000 payment to {myReferralDoc.referrerName || 'your referrer'}
              </p>
              <p className="text-[11px] mb-2.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                They have been notified by email. Once you pay them ₹1,000 directly, click below.
              </p>
              <button
                onClick={handleIvePaid}
                disabled={payingCommission}
                className="w-full py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
                  color: '#fff',
                  opacity: payingCommission ? 0.6 : 1,
                }}>
                {payingCommission ? 'Processing…' : "✅ I've Paid ₹1,000"}
              </button>
            </div>
          )}

          {myReferralDoc.status === 'completed' && (
            <div className="mt-2 px-3 py-2 rounded-xl flex items-center gap-2 text-xs"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <CheckCircle size={12} className="text-green-400 shrink-0"/>
              <span className="text-green-400 font-medium">
                All done! ₹1,000 paid to {myReferralDoc.referrerName || 'your referrer'}. Welcome to your new room! 🏠
              </span>
            </div>
          )}
        </div>
      )}

      {/* Unread notifications */}
      {recentNotifs.length > 0 && (
        <div className="glass p-4 rounded-2xl space-y-2">
          <p className="text-sm font-bold flex items-center gap-2" style={{ color:'var(--text-primary)' }}>
            <Bell size={14} style={{ color:'#f59e0b' }}/> New Notifications
          </p>
          {recentNotifs.map(n => (
            <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-all"
              onClick={() => markRead(n.id)}>
              <span className="text-base shrink-0">{n.type==='visit'?'📅':n.type==='match'?'🤝':n.type==='referral'?'💸':'ℹ️'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>{n.title}</p>
                <p className="text-xs truncate" style={{ color:'var(--text-secondary)' }}>{n.body}</p>
              </div>
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background:'#3b82f6' }}/>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions grid */}
      <div>
        <p className="text-sm font-bold mb-3" style={{ color:'var(--text-secondary)' }}>QUICK ACTIONS</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {QUICK.map((q, i) => (
            <button key={q.path} onClick={() => navigate(q.path)}
              className="group p-4 rounded-2xl text-left transition-all hover:-translate-y-1 hover:shadow-lg"
              style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
                       animationDelay:`${i*50}ms`,
                       boxShadow: `0 0 0 rgba(0,0,0,0)` }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = `0 8px 25px ${q.color}25`}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 rgba(0,0,0,0)'}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                style={{ background: q.grad }}>
                <q.icon size={18} className="text-white"/>
              </div>
              <p className="font-bold text-sm leading-tight" style={{ color:'var(--text-primary)' }}>{q.label}</p>
              <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>{q.desc}</p>
              <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs font-medium" style={{ color:q.color }}>Open</span>
                <ArrowRight size={11} style={{ color:q.color }}/>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon:'🏠', label:'Total Listings',    value:stats.total,  color:'#3b82f6', hint:'rooms on platform' },
          { icon:'📅', label:'My Visits',         value:stats.visits, color:'#8b5cf6', hint:'visits scheduled'  },
          { icon:'💸', label:'Referrals Made',    value:stats.refs,   color:'#f59e0b', hint:'people referred'   },
          { icon:'⭐', label:'AI Algorithms',     value:'5',          color:'#10b981' },
        ].map((s,i) => (
          <div key={i} className="stat-card" style={{ animationDelay:`${i*80}ms` }}>
            <span className="text-2xl">{s.icon}</span>
            <p className="text-2xl font-bold" style={{ color:s.color }}>{s.value}</p>
            <p className="text-xs" style={{ color:'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ML Algorithms info */}
      <div className="glass p-5 rounded-2xl">
        <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color:'var(--text-primary)' }}>
          <Brain size={16} style={{ color:'#8b5cf6' }}/> AI Algorithms Powering RoomSync
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {[
            { name:'Random Forest',     use:'Match classification', acc:'91.7%', color:'#3b82f6' },
            { name:'Gradient Boosting', use:'Match accuracy',       acc:'93.3%', color:'#8b5cf6' },
            { name:'K-Means (8)',       use:'Student clustering',   acc:'8 clusters', color:'#10b981' },
            { name:'Cosine Similarity', use:'Profile ranking',      acc:'Vector math', color:'#f59e0b' },
            { name:'OCEAN Model',       use:'Personality input',    acc:'Big Five', color:'#ec4899' },
          ].map((a,i) => (
            <div key={i} className="p-3 rounded-xl text-center"
              style={{ background:`${a.color}10`, border:`1px solid ${a.color}30` }}>
              <p className="font-bold text-xs" style={{ color:a.color }}>{a.name}</p>
              <p className="text-[10px] mt-0.5" style={{ color:'var(--text-secondary)' }}>{a.use}</p>
              <p className="text-[10px] font-bold mt-1" style={{ color:a.color }}>{a.acc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
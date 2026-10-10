import { useState, useEffect } from 'react';
import { Home, Eye, MessageSquare, Calendar, Plus, Trash2, CheckCircle, Clock,
         MapPin, IndianRupee, Phone, Mail, ChevronDown, ChevronUp, Send, X, KeyRound,
         IndianRupee as Rupee, Gift } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc,
         onSnapshot, serverTimestamp } from 'firebase/firestore';
import { sendVisitEmails } from '../services/emailService';
import toast from 'react-hot-toast';
// CHANGE: Import markReferralCompleted so when an owner confirms a visit,
// the referred student's referral document is updated to "completed" and
// the referrer earns their ₹1,000 commission automatically.
import { markReferralMovedIn, markReferralCompleted } from '../services/referralService';

// ── Referral step definitions (matches the screenshot UI) ────────────────────
const REF_STEPS = [
  { key: 'registered', label: 'Signed Up',   icon: '👤', activeColor: '#3b82f6' },
  { key: 'booked',     label: 'Visit Done',  icon: '📅', activeColor: '#f59e0b' },
  { key: 'moved_in',   label: 'Moved In',    icon: '🔑', activeColor: '#8b5cf6' },
  { key: 'completed',  label: 'Paid ₹1K',   icon: '4',  activeColor: '#10b981' },
];

const STATUS_BADGE = {
  registered: { label: 'Signed Up',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
  booked:     { label: 'Visit Done',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  moved_in:   { label: '🔑 Moved In', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)'  },
  completed:  { label: '✅ Completed',color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
};

function ReferralProgressBar({ status }) {
  const curIdx = REF_STEPS.findIndex(s => s.key === status);
  return (
    <div className="flex items-center gap-0 mt-3">
      {REF_STEPS.map((step, i) => {
        const done    = i <= curIdx;
        const isLast  = i === REF_STEPS.length - 1;
        const isNum   = step.key === 'completed'; // step 4 shown as number
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                style={{
                  background: done ? step.activeColor : 'rgba(255,255,255,0.08)',
                  color:      done ? '#fff'            : 'rgba(255,255,255,0.25)',
                  border:     done ? 'none'            : '1.5px solid rgba(255,255,255,0.12)',
                  boxShadow:  done && i === curIdx ? `0 0 12px ${step.activeColor}60` : 'none',
                }}
              >
                {isNum ? (done ? '✓' : '4') : step.icon}
              </div>
              <span className="text-[9px] font-medium whitespace-nowrap"
                style={{ color: done ? step.activeColor : 'rgba(255,255,255,0.3)' }}>
                {step.label}
              </span>
            </div>
            {/* Connector line */}
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

function ReferralStatusMessage({ status }) {
  if (status === 'registered') return (
    <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2 text-xs"
      style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
      <Clock size={12} className="text-blue-400 shrink-0" />
      <span style={{ color: 'rgba(255,255,255,0.55)' }}>Waiting for this student to schedule a room visit.</span>
    </div>
  );
  if (status === 'booked') return (
    <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2 text-xs"
      style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <Calendar size={12} className="text-yellow-400 shrink-0" />
      <span style={{ color: 'rgba(255,255,255,0.55)' }}>Visit scheduled. Mark as <strong className="text-yellow-300">Moved In</strong> once they shift in.</span>
    </div>
  );
  if (status === 'moved_in') return (
    <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2 text-xs"
      style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
      <KeyRound size={12} className="text-purple-400 shrink-0" />
      <span style={{ color: 'rgba(255,255,255,0.55)' }}>
        <strong className="text-purple-300">Awaiting ₹1,000 payment</strong> from student. They've been notified by email. Once they pay and click "I've Paid", this will update to Completed.
      </span>
    </div>
  );
  if (status === 'completed') return (
    <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2 text-xs"
      style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
      <CheckCircle size={12} className="text-green-400 shrink-0" />
      <span className="text-green-400 font-medium">₹1,000 commission earned from this referral! 🎉</span>
    </div>
  );
  return null;
}

export default function OwnerDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]             = useState('listings');
  const [listings, setListings]   = useState([]);
  const [visits, setVisits]       = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [expanded, setExpanded]   = useState({});
  const [loading, setLoading]     = useState(true);
  const [myReferrals, setMyReferrals] = useState([]);
  // Map of studentUID → referral status, for showing moved_in/completed banners on visit cards
  const [referralStatusMap, setReferralStatusMap] = useState({});

  // ── Real-time listings ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rooms'), where('owner_id', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      setListings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  // ── Real-time visit requests for this owner ─────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'visits'), where('owner_uid', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      setVisits(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)));
    }, () => {});
    return unsub;
  }, [user]);

  // ── Real-time referral docs — used for both status map & My Referrals section ─
  const [referralEarnings, setReferralEarnings] = useState(0);
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'referrals'), where('referrerId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const map = {};
      let earned = 0;
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      docs.forEach(data => {
        map[data.referredUserId] = data.status;
        if (data.status === 'completed') earned += (data.commission || 1000);
      });
      setReferralStatusMap(map);
      setReferralEarnings(earned);
      setMyReferrals(docs);
    }, () => {});
    return unsub;
  }, [user]);

  // ── Confirm visit + send emails to both parties ─────────────────────────────
  const confirmVisit = async (visit) => {
    const t = toast.loading('Confirming visit & sending emails…');
    try {
      await updateDoc(doc(db, 'visits', visit.id), {
        status: 'confirmed',
        confirmed_at: serverTimestamp(),
      });

      // Send emails now that owner confirmed
      await sendVisitEmails({
        studentName:  visit.student_name  || 'Student',
        studentEmail: visit.student_email || '',
        ownerName:    visit.owner_name    || profile?.name || 'Owner',
        ownerEmail:   visit.owner_email   || user?.email   || '',
        ownerPhone:   visit.owner_phone   || '',
        roomTitle:    visit.room_title    || '',
        date:         visit.date          || '',
        time:         visit.time          || '',
        location:     visit.location      || '',
      });

      toast.dismiss(t);
      toast.success('Visit confirmed! Emails sent to student & owner ✅');

    } catch (err) {
      toast.dismiss(t);
      toast.error('Could not confirm: ' + err.message);
    }
  };

  // ── Mark student as moved in → advances referral to moved_in ───────────────
  const markMovedIn = async (visit) => {
    const t = toast.loading('Marking as moved in…');
    try {
      await markReferralMovedIn(visit.student_uid);
      toast.dismiss(t);
      toast.success('Marked as moved in! 🔑 Commission step unlocked.');
    } catch (err) {
      toast.dismiss(t);
      toast.error('Error: ' + err.message);
    }
  };

  // ── Confirm move-in and credit ₹1000 commission ────────────────────────────
  const confirmMoveInAndPay = async (visit) => {
    const t = toast.loading('Confirming move-in & crediting commission…');
    try {
      await markReferralCompleted(visit.student_uid);
      toast.dismiss(t);
      toast.success('Commission of ₹1,000 credited to referrer! 🎉');
    } catch (err) {
      toast.dismiss(t);
      toast.error('Error: ' + err.message);
    }
  };

  const declineVisit = async (id) => {
    try {
      await updateDoc(doc(db, 'visits', id), { status: 'declined' });
      toast('Visit declined');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const deleteListing = async (id) => {
    if (!window.confirm('Delete this listing?')) return;
    try {
      await deleteDoc(doc(db, 'rooms', id));
      toast.success('Listing deleted');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const pendingVisits = visits.filter(v => v.status === 'pending');

  const stats = [
    { icon: '🏠', label: 'Active Listings',  value: listings.filter(l => l.status !== 'inactive').length, color: 'text-blue-400' },
    { icon: '📅', label: 'Pending Visits',   value: pendingVisits.length, color: 'text-yellow-400' },
    { icon: '✅', label: 'Confirmed Visits', value: visits.filter(v => v.status === 'confirmed').length, color: 'text-green-400' },
    { icon: '💸', label: 'Referral Earned',  value: `₹${referralEarnings.toLocaleString()}`, color: 'text-emerald-400' },
  ];

  const statusColor = (s) =>
    s === 'confirmed' ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : s === 'declined' ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Home size={22} className="text-blue-400" /> Owner Dashboard
          </h1>
          <p className="text-white/50 text-sm mt-1">Manage listings, confirm visits & send emails</p>
        </div>
        <button onClick={() => navigate('/add-listing')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add New Listing
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="glass p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className={`font-display text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-white/40 text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending visit alert banner */}
      {pendingVisits.length > 0 && (
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
          <Clock size={18} className="text-yellow-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-300">
              {pendingVisits.length} visit request{pendingVisits.length > 1 ? 's' : ''} awaiting your confirmation
            </p>
            <p className="text-white/45 text-xs mt-0.5">
              Emails are sent to both parties only after you confirm below.
            </p>
          </div>
          <button onClick={() => setTab('visits')}
            className="text-xs px-3 py-1.5 rounded-xl font-semibold text-yellow-300"
            style={{ background: 'rgba(234,179,8,0.2)', border: '1px solid rgba(234,179,8,0.3)' }}>
            Review Now
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          ['listings',  `🏠 My Listings (${listings.length})`],
          ['visits',    `📅 Visits (${visits.length})`],
          ['referrals', `🎁 My Referrals (${myReferrals.length})`],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === id
              ? 'bg-blue-600/60 text-white border border-blue-400/40'
              : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
            {label}
            {id === 'visits' && pendingVisits.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400 text-black">
                {pendingVisits.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── LISTINGS TAB ────────────────────────────────────────────────── */}
      {tab === 'listings' && (
        <div className="space-y-4">
          {loading ? (
            <div className="glass p-12 text-center text-white/40">
              <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
              Loading your listings…
            </div>
          ) : listings.length === 0 ? (
            <div className="glass p-12 text-center text-white/40">
              <Home size={32} className="mx-auto mb-3 opacity-40" />
              <p className="mb-4">No listings yet</p>
              <button onClick={() => navigate('/add-listing')} className="btn-primary">
                Add Your First Listing
              </button>
            </div>
          ) : listings.map(l => (
            <div key={l.id} className="glass overflow-hidden">
              {/* ── Listing header row ── */}
              <div className="p-5 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-sm">{l.title}</h3>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${
                      l.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {l.status || 'active'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-white/50">
                    {l.location && <span className="flex items-center gap-1"><MapPin size={10}/>{l.location}</span>}
                    {l.price    && <span className="flex items-center gap-1"><IndianRupee size={10}/>₹{Number(l.price).toLocaleString()}/mo</span>}
                    {l.room_type && <span>🛏 {l.room_type}</span>}
                    {l.furnishing && <span>🪑 {l.furnishing}</span>}
                  </div>
                  <div className="flex gap-4 mt-2">
                    <span className="text-xs text-white/40 flex items-center gap-1"><Eye size={11}/>{l.views || 0} views</span>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={() => toggleExpand(l.id)}
                    className="btn-secondary text-xs px-3 py-2 flex items-center gap-1">
                    {expanded[l.id] ? <><ChevronUp size={12}/>Hide</> : <><ChevronDown size={12}/>Details</>}
                  </button>
                  <button onClick={() => deleteListing(l.id)}
                    className="px-3 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs transition-colors flex items-center gap-1">
                    <Trash2 size={12}/>Delete
                  </button>
                </div>
              </div>

              {/* ── Expanded full details ── */}
              {expanded[l.id] && (
                <div className="border-t border-white/8 px-5 pb-5 pt-4 space-y-4"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    {[
                      ['💰 Rent',         l.price       ? `₹${Number(l.price).toLocaleString()}/mo` : '—'],
                      ['🔐 Deposit',      l.deposit     ? `₹${Number(l.deposit).toLocaleString()}` : '—'],
                      ['🛏 Room Type',    l.room_type   || '—'],
                      ['🪑 Furnishing',   l.furnishing  || '—'],
                      ['🏢 Floor',        l.floor       || '—'],
                      ['👤 Gender Pref',  l.gender_preference || '—'],
                      ['📅 Available',    l.available_from || '—'],
                      ['📍 Location',     l.location    || '—'],
                      ['🏫 Nearby',       l.nearby      || '—'],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl p-3"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-white/40 mb-0.5">{k}</p>
                        <p className="font-medium text-white/90 truncate">{v}</p>
                      </div>
                    ))}
                  </div>

                  {l.description && (
                    <div>
                      <p className="text-xs text-white/40 mb-1">📝 Description</p>
                      <p className="text-sm text-white/70 leading-relaxed">{l.description}</p>
                    </div>
                  )}

                  {l.facilities?.length > 0 && (
                    <div>
                      <p className="text-xs text-white/40 mb-2">✨ Facilities</p>
                      <div className="flex flex-wrap gap-2">
                        {l.facilities.map(f => (
                          <span key={f} className="px-2.5 py-1 rounded-lg text-xs"
                            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Images */}
                  {l.images?.length > 0 && (
                    <div>
                      <p className="text-xs text-white/40 mb-2">📸 Photos</p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {l.images.map((url, i) => (
                          <img key={i} src={url} alt={`Room ${i + 1}`}
                            className="w-28 h-20 object-cover rounded-xl shrink-0 border border-white/10" />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Owner contact */}
                  <div className="rounded-xl p-3 flex flex-wrap gap-4 text-xs"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <span className="text-green-400 font-semibold">Owner Contact:</span>
                    {l.owner_name  && <span className="text-white/70">👤 {l.owner_name}</span>}
                    {l.owner_phone && <span className="text-white/70">📞 {l.owner_phone}</span>}
                    {l.owner_email && <span className="text-white/70">✉️ {l.owner_email}</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── VISITS TAB ──────────────────────────────────────────────────── */}
      {tab === 'visits' && (
        <div className="space-y-3">
          {visits.length === 0 ? (
            <div className="glass p-12 text-center text-white/40">
              <Calendar size={32} className="mx-auto mb-3 opacity-40" />
              <p>No visit requests yet</p>
            </div>
          ) : visits.map(v => (
            <div key={v.id} className="glass p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-purple-500
                    flex items-center justify-center text-sm font-bold shrink-0">
                    {v.student_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{v.student_name}</p>
                    <p className="text-white/50 text-xs">🏠 {v.room_title}</p>
                    <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
                      <Calendar size={10}/>{v.date} at {v.time}
                    </p>
                    {v.student_email && (
                      <p className="text-white/35 text-xs mt-0.5">✉️ {v.student_email}</p>
                    )}
                    {v.notes && (
                      <p className="text-white/40 text-xs mt-1 italic">📝 {v.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 items-end">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${statusColor(v.status)}`}>
                    {v.status === 'confirmed' ? '✅ Confirmed'
                      : v.status === 'declined' ? '❌ Declined'
                      : '⏳ Pending Confirmation'}
                  </span>

                  {v.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => confirmVisit(v)}
                        className="btn-primary text-xs px-4 py-2 flex items-center gap-1">
                        <CheckCircle size={12}/> Confirm &amp; Email Both
                      </button>
                      <button onClick={() => declineVisit(v.id)}
                        className="px-3 py-2 rounded-xl border border-red-500/30 text-red-400
                          hover:bg-red-500/10 text-xs transition-colors flex items-center gap-1">
                        <X size={12}/> Decline
                      </button>
                    </div>
                  )}

                  {v.status === 'confirmed' && v.student_uid && (
                    <button onClick={() => markMovedIn(v)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                      style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }}>
                      <KeyRound size={12}/> Mark as Moved In
                    </button>
                  )}

                  {v.status === 'confirmed' && (
                    <p className="text-green-400 text-xs flex items-center gap-1">
                      <Mail size={10}/> Emails sent to both parties
                    </p>
                  )}
                </div>
              </div>

              {v.status === 'confirmed' && (
                <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <CheckCircle size={13} className="text-green-400" />
                  <p className="text-green-400 text-xs">
                    Confirmed on {v.confirmed_at
                      ? new Date(v.confirmed_at.seconds * 1000).toLocaleDateString('en-IN')
                      : 'recently'}. Click <strong>Mark as Moved In</strong> once the student physically shifts in.
                  </p>
                </div>
              )}

              {referralStatusMap[v.student_uid] === 'moved_in' && (
                <div className="mt-3 px-4 py-3 rounded-xl flex items-center gap-3"
                  style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)' }}>
                  <KeyRound size={14} className="text-purple-400 shrink-0" />
                  <div>
                    <p className="text-purple-300 text-xs font-medium">
                      Student marked as moved in 🔑
                    </p>
                    <p className="text-purple-400/60 text-[10px] mt-0.5">
                      Awaiting student to confirm ₹1,000 payment to referrer. The referral dashboard will update automatically once they pay.
                    </p>
                  </div>
                </div>
              )}

              {referralStatusMap[v.student_uid] === 'completed' && (
                <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <CheckCircle size={13} className="text-green-400" />
                  <p className="text-green-400 text-xs">
                    ₹1,000 commission credited to referrer for this student. ✅
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── MY REFERRALS TAB ────────────────────────────────────────── */}
      {tab === 'referrals' && (
        <div className="space-y-3">
          {/* Header row with live indicator */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white/90">
              My Referrals ({myReferrals.length})
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
              Live
            </div>
          </div>

          {myReferrals.length === 0 ? (
            <div className="glass p-12 text-center text-white/40">
              <Gift size={32} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">No referrals yet</p>
              <p className="text-xs mt-1 text-white/30">
                Share your referral code from the Referral page to start earning ₹1,000 per move-in.
              </p>
            </div>
          ) : myReferrals.map((r, i) => {
            const badge = STATUS_BADGE[r.status] || STATUS_BADGE.registered;
            const fmtDate = (ts) => {
              try { return ts?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
              catch { return ''; }
            };
            return (
              <div key={r.id} className="glass p-4 rounded-2xl space-y-1"
                style={{ animationDelay: `${i * 60}ms` }}>

                {/* Top row: avatar + email + badge */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 text-base"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
                    {(r.referredEmail || 'F').charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-white/90 truncate">
                      {r.referredEmail || 'Friend'}
                    </p>
                    <p className="text-[10px] text-white/35">
                      Referred on {fmtDate(r.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {r.status === 'completed' && (
                      <span className="font-bold text-sm text-green-400">+₹1,000</span>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold"
                      style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}30` }}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Progress stepper */}
                <ReferralProgressBar status={r.status} />

                {/* Context message */}
                <ReferralStatusMessage status={r.status} />
              </div>
            );
          })}

          {/* Commission summary */}
          {referralEarnings > 0 && (
            <div className="glass p-4 rounded-2xl flex items-center gap-4 mt-2"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg,#10b981,#06b6d4)' }}>
                <IndianRupee size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-green-400">₹{referralEarnings.toLocaleString()} Total Earned</p>
                <p className="text-xs text-white/40">
                  From {myReferrals.filter(r => r.status === 'completed').length} completed referral{myReferrals.filter(r => r.status === 'completed').length !== 1 ? 's' : ''}.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
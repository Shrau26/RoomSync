import { useState, useEffect } from 'react';
import {
  Gift, Copy, Check, IndianRupee, Clock,
  Zap, AlertCircle, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import {
  collection, query, where, onSnapshot, doc, updateDoc,
} from 'firebase/firestore';
import { generateReferralCode } from '../utils/referralUtils';
import toast from 'react-hot-toast';

const COMMISSION = 1000;

// ── Status metadata ───────────────────────────────────────────────────────────
const STATUS_META = {
  registered: {
    label: 'Signed Up',
    emoji: '👤',
    color: '#3b82f6',
    bg:    'rgba(59,130,246,0.12)',
    desc:  'Friend signed up with your code — waiting for them to book a visit',
  },
  booked: {
    label: 'Visit Scheduled',
    emoji: '📅',
    color: '#f59e0b',
    bg:    'rgba(245,158,11,0.12)',
    desc:  'Friend has scheduled a room visit — waiting for owner to confirm move-in',
  },
  moved_in: {
    label: 'Moved In 🔑',
    emoji: '🔑',
    color: '#8b5cf6',
    bg:    'rgba(139,92,246,0.15)',
    desc:  'Friend has moved in! Waiting for them to pay you ₹1,000',
  },
  completed: {
    label: 'Payment Done ✅',
    emoji: '✅',
    color: '#10b981',
    bg:    'rgba(16,185,129,0.12)',
    desc:  '₹1,000 commission received!',
  },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.registered;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold"
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
      {meta.emoji} {meta.label}
    </span>
  );
}

function ReferralProgress({ status }) {
  const steps = ['registered', 'booked', 'moved_in', 'completed'];
  const cur   = steps.indexOf(status);
  const labels = ['Signed Up', 'Visit Done', 'Moved In', 'Paid ₹1K'];
  return (
    <div className="flex items-center gap-0 mt-3">
      {steps.map((s, i) => {
        const meta = STATUS_META[s];
        const done = i <= cur;
        return (
          <div key={s} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                style={{
                  background: done ? meta.color : 'rgba(255,255,255,0.08)',
                  color:      done ? '#fff'      : 'rgba(255,255,255,0.25)',
                  boxShadow:  i === cur ? `0 0 8px ${meta.color}80` : 'none',
                }}>
                {done ? meta.emoji : i + 1}
              </div>
              <p className="text-[9px] text-center whitespace-nowrap"
                style={{ color: done ? meta.color : 'rgba(255,255,255,0.25)' }}>
                {labels[i]}
              </p>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-0.5 -mt-3 mx-1 rounded-full transition-all"
                style={{ background: i < cur ? '#10b981' : 'rgba(255,255,255,0.08)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ReferralPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [refs,    setRefs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);

  const myCode = profile?.referralCode || null;

  // Auto-generate referral code for old accounts
  useEffect(() => {
    if (!user || !profile || profile.referralCode) return;
    const code = generateReferralCode(profile.name || user.displayName || 'USER');
    updateDoc(doc(db, 'users', user.uid), { referralCode: code })
      .then(() => refreshProfile())
      .catch(err => console.warn('[ReferralPage] Could not save referralCode:', err));
  }, [user, profile?.referralCode]);

  // ── Real-time referrals where I am the referrer ──────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'referrals'), where('referrerId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      setRefs(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      );
      setLoading(false);
    }, err => {
      console.error('[ReferralPage]', err);
      setRefs([]);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const totalEarned    = refs.filter(r => r.status === 'completed').length * COMMISSION;
  const movedInPending = refs.filter(r => r.status === 'moved_in');
  const countDone      = refs.filter(r => r.status === 'completed').length;

  const copyCode = () => {
    if (!myCode) return;
    navigator.clipboard.writeText(myCode)
      .then(() => { setCopied(true); toast.success('Referral code copied!'); setTimeout(() => setCopied(false), 2000); })
      .catch(() => toast.error('Could not copy'));
  };

  const fmtDate = (ts) => {
    try { return ts?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  };

  return (
    <div className="space-y-6 page-enter max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
            <Gift size={18} className="text-white" />
          </div>
          Referral Dashboard
        </h1>
        <p className="text-sm mt-1 text-white/50">
          Share your code → Friend moves in → You earn ₹{COMMISSION.toLocaleString()}
        </p>
      </div>

      {/* ── ₹1000 PENDING PAYMENT ALERT (shown when friend moved in but hasn't paid yet) ── */}
      {movedInPending.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3"
          style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(236,72,153,0.1))',
                   border: '1px solid rgba(139,92,246,0.5)' }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-purple-400 shrink-0" />
            <p className="font-bold text-purple-300">
              🔑 {movedInPending.length} friend{movedInPending.length > 1 ? 's have' : ' has'} moved in — awaiting ₹1,000 payment
            </p>
          </div>
          {movedInPending.map(r => (
            <div key={r.id} className="rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <div>
                <p className="text-white/90 text-sm font-semibold">{r.referredEmail || 'Your referral'}</p>
                <p className="text-purple-400/80 text-xs mt-0.5">
                  Moved in on {fmtDate(r.movedInAt) || 'recently'} — they have been notified to pay you ₹1,000
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-yellow-400" />
                <span className="text-yellow-400 text-xs font-semibold">Payment Pending</span>
              </div>
            </div>
          ))}
          <p className="text-white/40 text-xs">
            💡 Your referral has been notified by email to pay you ₹1,000.
            Once they click "I've Paid" on their dashboard, the status updates to <strong className="text-green-400">Completed</strong> here automatically.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Earned',   value: `₹${totalEarned.toLocaleString()}`, icon: '💰', color: '#10b981' },
          { label: 'Total Referred', value: refs.length,                         icon: '👥', color: '#3b82f6' },
          { label: 'Moved In',       value: refs.filter(r => r.status === 'moved_in' || r.status === 'completed').length, icon: '🔑', color: '#8b5cf6' },
          { label: 'Completed',      value: countDone,                            icon: '✅', color: '#10b981' },
        ].map((s, i) => (
          <div key={i} className="glass p-4 rounded-2xl text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5 text-white/40">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referral Code */}
      <div className="glass p-5 rounded-2xl"
        style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-yellow-400" />
          <p className="text-sm font-bold text-yellow-400">Your Referral Code</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 px-5 py-3 rounded-2xl"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px dashed rgba(245,158,11,0.5)' }}>
            {myCode
              ? <span className="text-2xl font-bold tracking-widest text-yellow-400" style={{ fontFamily: 'monospace' }}>{myCode}</span>
              : <span className="text-sm text-yellow-400/60 italic">Generating your code…</span>}
          </div>
          <button onClick={copyCode} disabled={!myCode}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
            style={{
              background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.15)',
              border: `1px solid ${copied ? 'rgba(16,185,129,0.5)' : 'rgba(245,158,11,0.4)'}`,
              color: copied ? '#10b981' : '#fbbf24',
            }}>
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
        <p className="text-xs mt-2 text-white/40">
          Share this code with friends. When they sign up and the owner marks them as moved in, you earn ₹{COMMISSION.toLocaleString()}.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { n: '1', title: 'Share Code',   desc: 'Friend signs up with your code',          icon: '📤', color: '#3b82f6' },
          { n: '2', title: 'Books Visit',  desc: 'Friend schedules & visits a room',         icon: '🏠', color: '#f59e0b' },
          { n: '3', title: 'Moves In',     desc: 'Owner marks friend as moved in',           icon: '🔑', color: '#8b5cf6' },
          { n: '4', title: 'You Earn',     desc: 'Friend pays you ₹1,000 directly',         icon: '💸', color: '#10b981' },
        ].map((s, i) => (
          <div key={i} className="glass p-3 rounded-2xl text-center">
            <div className="w-9 h-9 rounded-full mx-auto flex items-center justify-center text-base mb-2"
              style={{ background: `${s.color}20` }}>{s.icon}</div>
            <p className="font-bold text-[10px]" style={{ color: s.color }}>Step {s.n}</p>
            <p className="text-xs font-semibold mt-0.5 text-white/80">{s.title}</p>
            <p className="text-[9px] mt-0.5 text-white/40 leading-tight">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Referral List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">My Referrals ({refs.length})</h2>
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </div>
        </div>

        {loading ? (
          [...Array(2)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))
        ) : refs.length === 0 ? (
          <div className="glass p-12 rounded-2xl text-center">
            <Gift size={36} className="mx-auto mb-3 text-white/20" />
            <p className="font-medium text-white/50">No referrals yet</p>
            <p className="text-sm mt-1 text-white/30">
              Share your code <strong className="text-yellow-400">{myCode}</strong> to get started!
            </p>
          </div>
        ) : refs.map((r, i) => (
          <div key={r.id} className="glass p-4 rounded-2xl space-y-3"
            style={{ animationDelay: `${i * 60}ms` }}>

            {/* Top row */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
                {(r.referredEmail || 'F').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white">{r.referredEmail || 'Friend'}</p>
                <p className="text-[10px] text-white/40">Referred on {fmtDate(r.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.status === 'completed' && (
                  <span className="font-bold text-sm text-green-400">+₹{COMMISSION.toLocaleString()}</span>
                )}
                <StatusBadge status={r.status} />
              </div>
            </div>

            {/* Progress */}
            <ReferralProgress status={r.status} />

            {/* Moved in — payment pending banner */}
            {r.status === 'moved_in' && (
              <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.35)' }}>
                <Clock size={13} className="text-purple-400 shrink-0" />
                <div>
                  <p className="text-purple-300 text-xs font-semibold">Awaiting ₹1,000 payment from {r.referredEmail || 'your referral'}</p>
                  <p className="text-purple-400/60 text-[10px] mt-0.5">
                    They have been notified by email. Once they pay and click "I've Paid", this will update to Completed.
                  </p>
                </div>
              </div>
            )}

            {/* Completed banner */}
            {r.status === 'completed' && (
              <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <CheckCircle size={13} className="text-green-400 shrink-0" />
                <p className="text-green-400 text-xs font-semibold">
                  ₹1,000 received from {r.referredEmail || 'your referral'} 🎉
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Total earned summary */}
      {totalEarned > 0 && (
        <div className="glass p-5 rounded-2xl flex items-center gap-4"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#10b981,#06b6d4)' }}>
            <IndianRupee size={22} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-lg text-green-400">₹{totalEarned.toLocaleString()} Earned</p>
            <p className="text-xs text-white/40">
              From {countDone} completed referral{countDone !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
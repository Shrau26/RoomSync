import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Calendar, Clock, MapPin, CheckCircle, X, Bell, Plus, Mail, Phone, Home, User, Info, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import {
  collection, addDoc, query, where, updateDoc, doc,
  serverTimestamp, onSnapshot, getDocs,
} from 'firebase/firestore';
import { markReferralBooked, markPaymentDone } from '../services/referralService';
import toast from 'react-hot-toast';

export default function VisitSchedulerPage() {
  const { user, profile } = useAuth();
  const location          = useLocation();
  const roomFromNav       = location.state?.room;

  const [visits,   setVisits]   = useState([]);
  const [showForm, setShowForm] = useState(!!roomFromNav);
  const [saving,   setSaving]   = useState(false);
  const [rescheduleVisit, setRescheduleVisit] = useState(null);
  const [rescheduleForm, setRescheduleForm]   = useState({ date: '', time: '' });
  const [rescheduling, setRescheduling]       = useState(false);

  const [form, setForm] = useState({
    room_title:  roomFromNav?.title       || '',
    room_loc:    roomFromNav?.location    || '',
    owner_name:  roomFromNav?.owner_name  || '',
    owner_phone: roomFromNav?.owner_phone || '',
    owner_email: roomFromNav?.owner_email || '',
    owner_uid:   roomFromNav?.owner_id    || '',
    room_id:     roomFromNav?.id          || '',
    date: '', time: '', notes: '',
  });

  const [lookupStatus, setLookupStatus] = useState(
    roomFromNav?.owner_id ? 'found' : 'idle'
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const lookupOwnerUid = useCallback(async (email) => {
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setLookupStatus('idle');
      setForm(f => ({ ...f, owner_uid: '' }));
      return null;
    }
    setLookupStatus('searching');
    try {
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', trimmed))
      );
      if (!usersSnap.empty) {
        const uid  = usersSnap.docs[0].id;
        const data = usersSnap.docs[0].data();
        setForm(f => ({
          ...f,
          owner_uid:  uid,
          owner_name: f.owner_name || data.name || data.displayName || f.owner_name,
        }));
        setLookupStatus('found');
        return uid;
      }
      const roomsSnap = await getDocs(
        query(collection(db, 'rooms'), where('owner_email', '==', trimmed))
      );
      if (!roomsSnap.empty) {
        const uid = roomsSnap.docs[0].data().owner_id;
        if (uid) {
          setForm(f => ({ ...f, owner_uid: uid }));
          setLookupStatus('found');
          return uid;
        }
      }
      setForm(f => ({ ...f, owner_uid: '' }));
      setLookupStatus('not_found');
      return null;
    } catch (err) {
      console.warn('[VisitScheduler] owner lookup error:', err);
      setForm(f => ({ ...f, owner_uid: '' }));
      setLookupStatus('idle');
      return null;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visits listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'visits'), where('student_uid', '==', user.uid));
    const unsub = onSnapshot(
      q,
      snap => setVisits(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0))
      ),
      () => setVisits([])
    );
    return unsub;
  }, [user]);

  // ── Payment request listener — SINGLE where() to avoid composite index error ─
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [payingNow, setPayingNow]           = useState(false);

  useEffect(() => {
    if (!user) return;
    // Only one where() clause — filter status in JS
    const q = query(
      collection(db, 'paymentRequests'),
      where('studentUid', '==', user.uid),
    );
    const unsub = onSnapshot(q, snap => {
      const pending = snap.docs.find(d => d.data().status === 'pending');
      setPaymentRequest(pending ? { id: pending.id, ...pending.data() } : null);
    }, (err) => {
      console.error('[paymentRequests listener]', err);
      setPaymentRequest(null);
    });
    return unsub;
  }, [user]);

  const handleMarkPaid = async () => {
    if (!user) return;
    setPayingNow(true);
    try {
      await markPaymentDone(user.uid);
      toast.success('Payment confirmed! ✅ Referrer notified.');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
    setPayingNow(false);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.room_title)  return toast.error('Enter the room title');
    if (!form.date)        return toast.error('Select a visit date');
    if (!form.time)        return toast.error('Select a visit time');
    if (!form.owner_email) return toast.error('Enter the owner email');

    setSaving(true);

    let ownerUid = form.owner_uid;
    if (!ownerUid && form.owner_email) {
      ownerUid = (await lookupOwnerUid(form.owner_email)) || '';
    }

    if (!ownerUid) {
      toast.error(
        'Could not find a RoomSync account for this owner email. Make sure the owner is registered.',
        { duration: 7000 }
      );
      setSaving(false);
      return;
    }

    const studentName  = profile?.name || user?.displayName || 'Student';
    const studentEmail = user?.email   || '';

    const visitDoc = {
      room_title:    form.room_title,
      location:      form.room_loc,
      owner_name:    form.owner_name,
      owner_phone:   form.owner_phone,
      owner_email:   form.owner_email,
      owner_uid:     ownerUid,
      room_id:       form.room_id,
      date:          form.date,
      time:          form.time,
      notes:         form.notes,
      status:        'pending',
      student_uid:   user?.uid   || '',
      student_name:  studentName,
      student_email: studentEmail,
      created_at:    serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'visits'), visitDoc);
      try { await markReferralBooked(user.uid); } catch (e) { /* no referral is fine */ }

      if (ownerUid) {
        try {
          const { addDoc: ad, collection: col, serverTimestamp: sts } = await import('firebase/firestore');
          const { db: firedb } = await import('../firebase/config');
          await ad(col(firedb, 'notifications'), {
            uid:       ownerUid,
            title:     '📅 New Visit Request!',
            body:      `${profile?.name || 'A student'} wants to visit "${form.room_title}" on ${form.date} at ${form.time}`,
            type:      'visit',
            read:      false,
            createdAt: sts(),
          });
        } catch (e) { /* non-critical */ }
      }

      toast.success('Visit request sent! ✅ Waiting for owner confirmation.');
      toast('📧 Emails will be sent to both of you once the owner confirms.', {
        icon: 'ℹ️', duration: 6000,
      });
    } catch (err) {
      toast.error('Could not save visit: ' + err.message);
      setSaving(false);
      return;
    }

    setShowForm(false);
    setForm({ room_title:'', room_loc:'', owner_name:'', owner_phone:'', owner_email:'', owner_uid:'', room_id:'', date:'', time:'', notes:'' });
    setLookupStatus('idle');
    setSaving(false);
  };

  // ── Reschedule ───────────────────────────────────────────────────────────────
  const openReschedule = (v) => {
    setRescheduleVisit(v);
    setRescheduleForm({ date: v.date || '', time: v.time || '' });
  };

  const handleReschedule = async () => {
    if (!rescheduleForm.date) return toast.error('Select a new date');
    if (!rescheduleForm.time) return toast.error('Select a new time');
    setRescheduling(true);
    try {
      await updateDoc(doc(db, 'visits', rescheduleVisit.id), {
        date:   rescheduleForm.date,
        time:   rescheduleForm.time,
        status: 'pending',
        rescheduled_at: serverTimestamp(),
      });
      toast.success('Visit rescheduled! ⏰ Owner will re-confirm the new time.');
      setRescheduleVisit(null);
    } catch (err) {
      toast.error('Could not reschedule: ' + err.message);
    }
    setRescheduling(false);
  };

  const cancelVisit = async (id) => {
    try {
      await updateDoc(doc(db, 'visits', id), { status: 'cancelled' });
      toast('Visit cancelled');
    } catch {
      toast.error('Could not cancel visit');
    }
  };

  const today    = new Date().toISOString().split('T')[0];
  const upcoming = visits.filter(v => !v.date || v.date >= today || v.status === 'moved_in' || v.status === 'confirmed');
  const past     = visits.filter(v => v.date && v.date < today && v.status !== 'moved_in' && v.status !== 'confirmed');

  const statusStyle = (s) =>
    s === 'confirmed' ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : s === 'moved_in'  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    : s === 'declined'  ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : s === 'cancelled' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25';

  const statusLabel = (s) =>
    s === 'confirmed'  ? '✅ Confirmed'
    : s === 'declined'  ? '❌ Declined'
    : s === 'cancelled' ? '🚫 Cancelled'
    : s === 'moved_in'  ? '🔑 Moved In'
    : '⏳ Awaiting Owner';

  const LookupBadge = () => {
    if (lookupStatus === 'searching')
      return <p className="text-xs text-blue-400 flex items-center gap-1 mt-1.5"><Search size={10} className="animate-pulse" /> Looking up owner account…</p>;
    if (lookupStatus === 'found')
      return <p className="text-xs text-green-400 flex items-center gap-1 mt-1.5"><CheckCircle size={10} /> Owner account found ✓</p>;
    if (lookupStatus === 'not_found')
      return <p className="text-xs text-red-400 mt-1.5">⚠️ No RoomSync account found for this email. The owner must be registered on RoomSync.</p>;
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-enter">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#ec4899)' }}>
              <Calendar size={18} className="text-white" />
            </div>
            Visit Scheduler
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Request a visit — emails sent after owner confirms
          </p>
        </div>
        <button onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-white transition-all hover:scale-[1.02]"
          style={{
            background: showForm ? 'rgba(255,255,255,0.12)' : 'linear-gradient(135deg,#8b5cf6,#ec4899)',
            boxShadow:  showForm ? 'none' : '0 6px 20px rgba(139,92,246,0.35)',
          }}>
          {showForm ? <><X size={15} /> Cancel</> : <><Plus size={15} /> New Visit</>}
        </button>
      </div>

      {/* How it works */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
        <Info size={18} className="text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-indigo-300">How visit confirmation works</p>
          <p className="text-white/45 text-xs mt-0.5">
            1. You submit a request → 2. Owner sees it on their dashboard and confirms →
            3. Email notifications are sent automatically to <strong className="text-white/65">both you and the owner</strong>.
          </p>
        </div>
      </div>

      {/* Auto-fill notice */}
      {roomFromNav && showForm && (
        <div className="rounded-2xl p-3 flex items-center gap-3"
          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
          <Home size={16} className="text-purple-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-purple-300">Owner details auto-filled from listing</p>
            <p className="text-white/45 text-xs">{roomFromNav.title} • {roomFromNav.location}</p>
          </div>
        </div>
      )}

      {/* ── FORM ── */}
      {showForm && (
        <div className="rounded-2xl p-6 space-y-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="font-bold text-white flex items-center gap-2">
            <Calendar size={16} className="text-purple-400" /> New Visit Request
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label text-xs">Room Title *</label>
                <input value={form.room_title} onChange={e => set('room_title', e.target.value)}
                  placeholder="e.g. 1BHK near Station" className="input-field" />
              </div>
              <div>
                <label className="form-label text-xs">Location</label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input value={form.room_loc} onChange={e => set('room_loc', e.target.value)}
                    placeholder="Katraj, Pune" className="input-field pl-9" />
                </div>
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wide flex items-center gap-1.5">
                <User size={11} /> Owner Details
                {roomFromNav?.owner_name && (
                  <span className="text-purple-400/70 normal-case font-normal">(auto-filled)</span>
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Owner Name</label>
                  <input value={form.owner_name} onChange={e => set('owner_name', e.target.value)}
                    placeholder="Owner's name" className="input-field" />
                </div>
                <div>
                  <label className="form-label text-xs flex items-center gap-1"><Phone size={10} /> Phone</label>
                  <input value={form.owner_phone} onChange={e => set('owner_phone', e.target.value)}
                    placeholder="9876543210" className="input-field" type="tel" />
                </div>
              </div>
              <div>
                <label className="form-label text-xs flex items-center gap-1">
                  <Mail size={10} /> Owner Email *
                </label>
                <input
                  value={form.owner_email}
                  onChange={e => {
                    set('owner_email', e.target.value);
                    setLookupStatus('idle');
                    set('owner_uid', '');
                  }}
                  onBlur={e => lookupOwnerUid(e.target.value)}
                  placeholder="owner@email.com"
                  className="input-field"
                  type="email"
                />
                <LookupBadge />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label text-xs">Visit Date *</label>
                <input type="date" min={today} value={form.date}
                  onChange={e => set('date', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="form-label text-xs">Visit Time *</label>
                <select value={form.time} onChange={e => set('time', e.target.value)} className="input-field">
                  <option value="">Select time</option>
                  {['9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM',
                    '3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM'].map(t =>
                    <option key={t} className="bg-gray-900">{t}</option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="form-label text-xs">Notes (optional)</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Questions? How many people visiting? Any requirements..."
                rows={2} className="input-field resize-none" />
            </div>

            <button type="submit" disabled={saving}
              className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', boxShadow: '0 6px 20px rgba(139,92,246,0.35)' }}>
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
                : <><Calendar size={16} /> Send Visit Request to Owner</>}
            </button>
          </form>
        </div>
      )}

      {/* ── ₹1000 Referral Payment Banner ── */}
      {paymentRequest && (
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(236,72,153,0.1))',
                   border: '1px solid rgba(139,92,246,0.4)' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
              style={{ background: 'rgba(139,92,246,0.2)' }}>💸</div>
            <div className="flex-1">
              <p className="font-bold text-purple-300 text-sm">Action Required: Pay ₹1,000 to your referrer</p>
              <p className="text-white/60 text-xs mt-1">
                You have moved into your room! As per RoomSync referral program, please pay
                <strong className="text-white/90"> ₹1,000 </strong>
                to <strong className="text-purple-300">{paymentRequest.referrerName || 'the person who referred you'}</strong>.
              </p>
              {paymentRequest.referrerUpi && (
                <div className="mt-2 px-3 py-2 rounded-xl inline-flex items-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <span className="text-xs text-white/50">UPI ID:</span>
                  <span className="text-sm font-mono font-bold text-white">{paymentRequest.referrerUpi}</span>
                </div>
              )}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  onClick={handleMarkPaid}
                  disabled={payingNow}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
                           boxShadow: '0 4px 15px rgba(139,92,246,0.4)' }}>
                  {payingNow
                    ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Confirming…</>
                    : <>✅ I've Paid ₹1,000</>}
                </button>
                <p className="text-white/35 text-xs">
                  Once you click this, your referrer will be notified automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── My Visit Requests ── */}
      <div className="space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <Bell size={16} className="text-yellow-400" /> My Visit Requests
          <span className="text-white/40 font-normal text-sm">({upcoming.length})</span>
        </h2>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl p-12 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <Calendar size={36} className="mx-auto mb-3 text-white/20" />
            <p className="text-white/40 font-medium">No visit requests yet</p>
            <p className="text-white/25 text-sm mt-1">Go to Browse Rooms and click "Schedule Visit"</p>
          </div>
        ) : upcoming.map((v, i) => (
          <div key={v.id} className="rounded-2xl p-5 transition-all hover:bg-white/8"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
              animation: `slideUp 0.3s ease ${i * 0.05}s both` }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h3 className="font-bold text-sm text-white">{v.room_title}</h3>
                  <span className={`px-2.5 py-0.5 rounded-xl text-[10px] font-bold border ${statusStyle(v.status)}`}>
                    {statusLabel(v.status)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-white/45">
                  {v.location && <span className="flex items-center gap-1"><MapPin size={10} />{v.location}</span>}
                  {v.date     && <span className="flex items-center gap-1"><Calendar size={10} />{new Date(v.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>}
                  {v.time     && <span className="flex items-center gap-1"><Clock size={10} />{v.time}</span>}
                </div>

                {v.owner_name && (
                  <p className="text-white/35 text-xs mt-1.5">
                    Owner: <span className="text-white/65 font-medium">{v.owner_name}</span>
                    {v.owner_phone && (
                      <> · <a href={`tel:+91${v.owner_phone}`} className="text-blue-400 hover:text-blue-300"> 📞 +91 {v.owner_phone}</a></>
                    )}
                  </p>
                )}

                {v.notes && (
                  <p className="text-white/40 text-xs mt-2 pl-3 italic border-l-2 border-white/10">📝 {v.notes}</p>
                )}

                {v.status === 'moved_in' && (
                  <div className="mt-3 rounded-xl p-3"
                    style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.4)' }}>
                    <p className="text-purple-300 text-xs font-semibold flex items-center gap-1.5">
                      🔑 You have moved in! Check the payment banner above to pay ₹1,000 to your referrer.
                    </p>
                  </div>
                )}

                {v.status === 'confirmed' && (
                  <div className="mt-3 rounded-xl overflow-hidden"
                    style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)' }}>
                    <div className="px-3 pt-3 pb-2">
                      <p className="text-green-400 text-xs font-semibold flex items-center gap-1.5">
                        <CheckCircle size={12} /> Visit confirmed by owner
                      </p>
                    </div>
                    <div className="flex items-center px-3 pb-3 gap-0">
                      {['Requested','Confirmed','Visit Day','Move In'].map((step, si) => (
                        <div key={step} className="flex items-center flex-1">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                              style={{ background: si <= 1 ? '#10b981' : 'rgba(255,255,255,0.1)',
                                       color:      si <= 1 ? '#fff'     : 'rgba(255,255,255,0.3)' }}>
                              {si <= 1 ? '✓' : si + 1}
                            </div>
                            <p className="text-[8px] text-center leading-none whitespace-nowrap"
                              style={{ color: si <= 1 ? '#10b981' : 'rgba(255,255,255,0.25)' }}>
                              {step}
                            </p>
                          </div>
                          {si < 3 && (
                            <div className="flex-1 h-0.5 -mt-3 mx-0.5 rounded-full"
                              style={{ background: si < 1 ? '#10b981' : 'rgba(255,255,255,0.1)' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {v.status === 'pending' && (
                  <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2"
                    style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
                    <Clock size={13} className="text-yellow-400" />
                    <p className="text-yellow-400 text-xs">Waiting for owner to confirm. Email will be sent once confirmed.</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                {(v.status === 'pending' || v.status === 'confirmed') && (
                  <button onClick={() => openReschedule(v)}
                    className="text-xs px-3 py-2 rounded-xl text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    style={{ border: '1px solid rgba(59,130,246,0.3)' }}>
                    <Clock size={11} /> Reschedule
                  </button>
                )}
                {(v.status === 'pending' || v.status === 'confirmed') && (
                  <button onClick={() => cancelVisit(v.id)}
                    className="text-xs px-3 py-2 rounded-xl text-white/30 hover:text-red-400 transition-colors flex items-center gap-1"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                    <X size={11} /> Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Past visits */}
      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/30 font-semibold uppercase tracking-wide">Past Visits</p>
          {past.map(v => (
            <div key={v.id} className="rounded-2xl p-4 flex items-center justify-between opacity-45"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <p className="font-semibold text-sm">{v.room_title}</p>
                <p className="text-white/40 text-xs">{v.date} at {v.time}</p>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-xl text-white/40"
                style={{ background: 'rgba(255,255,255,0.06)' }}>Past</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Reschedule Modal ── */}
      {rescheduleVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5"
            style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Clock size={16} className="text-blue-400" /> Reschedule Visit
                </h3>
                <p className="text-white/45 text-xs mt-0.5">{rescheduleVisit.room_title}</p>
              </div>
              <button onClick={() => setRescheduleVisit(null)}
                className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-lg">📅</div>
              <div>
                <p className="text-white/40 text-xs">Current schedule</p>
                <p className="text-white/80 text-sm font-medium">
                  {rescheduleVisit.date} at {rescheduleVisit.time}
                </p>
              </div>
            </div>

            <div>
              <label className="form-label text-xs">New Visit Date *</label>
              <input type="date" min={today} value={rescheduleForm.date}
                onChange={e => setRescheduleForm(f => ({ ...f, date: e.target.value }))}
                className="input-field" />
            </div>

            <div>
              <label className="form-label text-xs">New Visit Time *</label>
              <select value={rescheduleForm.time}
                onChange={e => setRescheduleForm(f => ({ ...f, time: e.target.value }))}
                className="input-field">
                <option value="">Select time</option>
                {['9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM',
                  '3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM'].map(t =>
                  <option key={t} className="bg-gray-900">{t}</option>
                )}
              </select>
            </div>

            <div className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <Clock size={13} className="text-blue-400 shrink-0 mt-0.5" />
              <p className="text-blue-300/80 text-xs">
                Rescheduling resets the status to <strong>Pending</strong>. The owner will need to re-confirm the new time.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setRescheduleVisit(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                Cancel
              </button>
              <button onClick={handleReschedule} disabled={rescheduling}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                         boxShadow: '0 4px 15px rgba(59,130,246,0.35)' }}>
                {rescheduling
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                  : <>⏰ Confirm Reschedule</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
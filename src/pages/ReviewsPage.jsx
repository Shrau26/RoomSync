import { useState, useEffect } from 'react';
import { Star, Send, Loader, Sparkles, ThumbsUp, Zap, Shield, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import {
  collection, addDoc, serverTimestamp, query, orderBy, onSnapshot
} from 'firebase/firestore';
import toast from 'react-hot-toast';

const ASPECTS = [
  { key: 'ui',         label: 'UI & Design',       icon: '🎨' },
  { key: 'ease',       label: 'Ease of Use',        icon: '⚡' },
  { key: 'features',   label: 'Features',           icon: '✨' },
  { key: 'matching',   label: 'Room Matching',      icon: '🏠' },
  { key: 'support',    label: 'Support',            icon: '🤝' },
];

const QUICK_TAGS = [
  'Easy to use', 'Great design', 'Found a room fast', 'Helpful features',
  'Smooth experience', 'Love the referral system', 'Good notifications', 'Reliable',
];

const StarRating = ({ value, onChange, readOnly = false, size = 24 }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} type="button"
        onClick={() => !readOnly && onChange(n)}
        className={`transition-transform ${readOnly ? 'cursor-default' : 'hover:scale-125 active:scale-110'}`}>
        <Star size={size}
          className={n <= value ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'} />
      </button>
    ))}
  </div>
);

export default function ReviewsPage() {
  const { user, profile } = useAuth();
  const [reviews, setReviews]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [form, setForm] = useState({
    overall: 0,
    aspect_ui: 0, aspect_ease: 0, aspect_features: 0, aspect_matching: 0, aspect_support: 0,
    comment: '',
    recommend: null, // true | false
  });

  useEffect(() => {
    const q = query(collection(db, 'appReviews'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error('[AppReviews]', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  const toggleTag = (tag) => {
    setSelectedTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.overall === 0) return toast.error('Please give an overall star rating');
    if (!user)              return toast.error('You must be signed in to review');

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'appReviews'), {
        overall:          form.overall,
        aspect_ui:        form.aspect_ui,
        aspect_ease:      form.aspect_ease,
        aspect_features:  form.aspect_features,
        aspect_matching:  form.aspect_matching,
        aspect_support:   form.aspect_support,
        comment:          form.comment.trim(),
        tags:             selectedTags,
        recommend:        form.recommend,
        reviewer:         profile?.name || user?.displayName || 'Anonymous',
        reviewer_uid:     user.uid,
        reviewer_email:   user.email || '',
        created_at:       serverTimestamp(),
      });
      setForm({ overall: 0, aspect_ui: 0, aspect_ease: 0, aspect_features: 0, aspect_matching: 0, aspect_support: 0, comment: '', recommend: null });
      setSelectedTags([]);
      toast.success('Thank you for your feedback! 🙏');
    } catch (err) {
      toast.error('Failed to save review: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.overall, 0) / reviews.length).toFixed(1)
    : '—';

  const recommendPct = reviews.filter(r => r.recommend === true).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-enter">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
              <Star size={18} className="text-white fill-white" />
            </div>
            Rate RoomSync
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Share your experience with the RoomSync app — your feedback shapes our future
          </p>
        </div>

        {reviews.length > 0 && (
          <div className="glass px-5 py-3 text-center rounded-2xl">
            <p className="text-3xl font-bold text-yellow-400">{avgRating}</p>
            <div className="flex gap-0.5 justify-center mt-1">
              {[1,2,3,4,5].map(n => (
                <Star key={n} size={12}
                  className={n <= Math.round(Number(avgRating)) ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'} />
              ))}
            </div>
            <p className="text-white/40 text-xs mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
            {reviews.length > 0 && (
              <p className="text-green-400 text-xs mt-0.5 font-medium">
                {recommendPct} would recommend
              </p>
            )}
          </div>
        )}
      </div>

      {/* Write review */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="font-display font-semibold mb-5 flex items-center gap-2">
          <Sparkles size={16} className="text-yellow-400" /> Share Your Experience
        </h2>

        <form onSubmit={submit} className="space-y-6">

          {/* Overall rating */}
          <div className="text-center py-4 rounded-2xl"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <p className="text-sm font-semibold text-white/70 mb-3">Overall Rating *</p>
            <div className="flex justify-center">
              <StarRating value={form.overall} onChange={v => setForm(f => ({ ...f, overall: v }))} size={36} />
            </div>
            <p className="text-xs text-white/30 mt-2">
              {form.overall === 0 && 'Tap to rate'}
              {form.overall === 1 && 'Needs improvement'}
              {form.overall === 2 && 'Below average'}
              {form.overall === 3 && 'Average'}
              {form.overall === 4 && 'Good'}
              {form.overall === 5 && '⭐ Excellent!'}
            </p>
          </div>

          {/* Aspect ratings */}
          <div>
            <p className="text-sm font-semibold text-white/60 mb-3">Rate Specific Aspects</p>
            <div className="space-y-3">
              {ASPECTS.map(a => (
                <div key={a.key} className="flex items-center justify-between">
                  <span className="text-sm text-white/70 flex items-center gap-2">
                    <span>{a.icon}</span> {a.label}
                  </span>
                  <StarRating
                    value={form[`aspect_${a.key}`]}
                    onChange={v => setForm(f => ({ ...f, [`aspect_${a.key}`]: v }))}
                    size={18}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Quick tags */}
          <div>
            <p className="text-sm font-semibold text-white/60 mb-2">What did you like? (optional)</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_TAGS.map(tag => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: selectedTags.includes(tag) ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)',
                    border: selectedTags.includes(tag) ? '1px solid rgba(139,92,246,0.6)' : '1px solid rgba(255,255,255,0.1)',
                    color: selectedTags.includes(tag) ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                  }}>
                  {selectedTags.includes(tag) ? '✓ ' : ''}{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="form-label text-xs">Your Review (optional)</label>
            <textarea value={form.comment}
              onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              rows={3}
              placeholder="Tell us what you love, what could be better, or any suggestions for new features..."
              className="input-field resize-none" />
          </div>

          {/* Would recommend */}
          <div>
            <p className="text-sm font-semibold text-white/60 mb-2">Would you recommend RoomSync to others?</p>
            <div className="flex gap-3">
              {[{ val: true, label: '👍 Yes, definitely!', color: '#10b981' },
                { val: false, label: '👎 Not right now', color: '#ef4444' }].map(opt => (
                <button key={String(opt.val)} type="button"
                  onClick={() => setForm(f => ({ ...f, recommend: opt.val }))}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: form.recommend === opt.val ? `${opt.color}20` : 'rgba(255,255,255,0.05)',
                    border: form.recommend === opt.val ? `1px solid ${opt.color}60` : '1px solid rgba(255,255,255,0.1)',
                    color: form.recommend === opt.val ? opt.color : 'rgba(255,255,255,0.45)',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={submitting}
            className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', boxShadow: '0 6px 20px rgba(245,158,11,0.3)' }}>
            {submitting
              ? <><Loader size={15} className="animate-spin" /> Saving…</>
              : <><Send size={15} /> Submit Feedback</>}
          </button>
        </form>
      </div>

      {/* Reviews list */}
      <div>
        <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
          What Users Are Saying
          {loading && <Loader size={14} className="animate-spin text-white/40" />}
        </h2>

        {loading ? (
          <div className="glass p-12 text-center text-white/40">
            <Loader size={28} className="animate-spin mx-auto mb-3" />
            Loading reviews…
          </div>
        ) : reviews.length === 0 ? (
          <div className="glass p-12 text-center text-white/40">
            <Star size={32} className="mx-auto mb-3 opacity-30" />
            <p>No reviews yet — be the first to share your experience!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((r, i) => (
              <div key={r.id} className="glass p-5 rounded-2xl"
                style={{ animation: `slideUp 0.3s ease ${i * 0.04}s both` }}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: 'linear-gradient(135deg,#8b5cf6,#ec4899)' }}>
                      {(r.reviewer || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{r.reviewer}</p>
                      <p className="text-white/35 text-xs">
                        {r.created_at?.seconds && new Date(r.created_at.seconds * 1000).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StarRating value={r.overall} readOnly size={14} />
                    {r.recommend === true && (
                      <span className="text-[10px] text-green-400 flex items-center gap-1">
                        <ThumbsUp size={9} /> Recommends
                      </span>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {r.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {r.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-lg text-[10px] font-medium"
                        style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {r.comment && (
                  <p className="text-white/65 text-sm leading-relaxed">{r.comment}</p>
                )}

                {/* Aspect mini-ratings */}
                {(r.aspect_ui || r.aspect_ease || r.aspect_features) ? (
                  <div className="mt-3 pt-3 grid grid-cols-3 gap-2"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {ASPECTS.filter(a => r[`aspect_${a.key}`] > 0).map(a => (
                      <div key={a.key} className="text-center">
                        <p className="text-[10px] text-white/30">{a.icon} {a.label}</p>
                        <div className="flex justify-center mt-0.5">
                          <StarRating value={r[`aspect_${a.key}`]} readOnly size={10} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
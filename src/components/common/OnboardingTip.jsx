import { useState, useEffect } from 'react';
import { X, ChevronRight, Lightbulb } from 'lucide-react';

const TIPS = {
  dashboard:       { title:'Welcome to RoomSync! 🏠', body:'Click any quick action card below to get started. Dark/light mode button is in the top right corner.' },
  browseRooms:     { title:'Browse Rooms 🔍',          body:'Click any room card to see all details, photos, and map location. Then click "Schedule Visit" to book!' },
  browseStudents:  { title:'Browse Students 👥',        body:'Click any profile card to see full personality details and OCEAN scores. Filter by year, sleep habits, and more.' },
  roommateMatch:   { title:'AI Roommate Match 🤖',      body:'Click "Find Matches" to run the AI. It uses 5 algorithms to find your most compatible roommates.' },
  rentPredictor:   { title:'AI Rent Predictor 📊',      body:'Select your city and area to get fair rent range. Use the comparison field to check if you\'re overpaying!' },
  visitScheduler:  { title:'Visit Scheduler 📅',        body:'Owner details auto-fill when you come from a room listing. Pick date and time — emails sent to both parties!' },
  chat:            { title:'Real-Time Chat 💬',          body:'Use the map pin icon to share your live location. Messages sync instantly across all devices.' },
  referral:        { title:'Earn ₹1,000 💸',            body:'Click "Pay ₹1 Demo" to see a live Razorpay payment simulation — great for showing the teacher!' },
  profile:         { title:'Complete Your Profile ✨',   body:'Fill your OCEAN personality test to unlock AI roommate matching. More details = better matches!' },
};

export default function OnboardingTip({ page }) {
  const tip = TIPS[page];
  const key = `tip_seen_${page}`;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!tip) return;
    const seen = sessionStorage.getItem(key);
    if (!seen) {
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    }
  }, [page]);

  const dismiss = () => {
    sessionStorage.setItem(key, '1');
    setShow(false);
  };

  if (!show || !tip) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-72 anim-left"
      style={{ filter:'drop-shadow(0 8px 30px rgba(79,70,229,0.4))' }}>
      <div className="rounded-2xl p-4 relative overflow-hidden"
        style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'1px solid rgba(255,255,255,0.2)' }}>
        {/* Shimmer overlay */}
        <div className="absolute inset-0 opacity-20"
          style={{ background:'linear-gradient(45deg,transparent 30%,rgba(255,255,255,0.3) 50%,transparent 70%)', backgroundSize:'200% 200%', animation:'shimmer 2s infinite' }}/>
        <div className="relative">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <Lightbulb size={14} className="text-white"/>
              </div>
              <p className="font-bold text-white text-sm leading-tight">{tip.title}</p>
            </div>
            <button onClick={dismiss} className="text-white/60 hover:text-white transition-colors shrink-0">
              <X size={14}/>
            </button>
          </div>
          <p className="text-white/80 text-xs leading-relaxed">{tip.body}</p>
          <button onClick={dismiss}
            className="mt-3 flex items-center gap-1 text-xs font-bold text-white/90 hover:text-white transition-colors">
            Got it <ChevronRight size={12}/>
          </button>
        </div>
      </div>
    </div>
  );
}

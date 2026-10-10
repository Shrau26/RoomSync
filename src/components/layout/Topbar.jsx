import { Menu, Bell, Sun, Moon, Search, X, CheckCheck, Sparkles } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

const TYPE_ICON  = { visit:'📅', chat:'💬', match:'🤝', referral:'💸', room:'🏠', info:'💡' };
const TYPE_COLOR = { visit:'#8b5cf6', chat:'#3b82f6', match:'#10b981', referral:'#f59e0b', room:'#06b6d4', info:'#6366f1' };

const SEARCH_ROUTES = [
  { q:['room','listing','browse'],  path:'/browse-rooms',    icon:'🏠', label:'Browse Rooms'      },
  { q:['match','roommate','ai'],    path:'/roommate-match',  icon:'🤝', label:'Roommate Match AI'  },
  { q:['rent','predict','price'],   path:'/rent-predictor',  icon:'📊', label:'AI Rent Predictor'  },
  { q:['chat','message','talk'],    path:'/chat',            icon:'💬', label:'Messages'           },
  { q:['visit','schedule','book'],  path:'/visit-scheduler', icon:'📅', label:'Visit Scheduler'    },
  { q:['referral','earn','money'],  path:'/referral',        icon:'💸', label:'Earn ₹1000'         },
  { q:['student','people','find'],  path:'/browse-students', icon:'👥', label:'Browse Students'    },
  { q:['profile','edit','account'], path:'/profile',         icon:'👤', label:'My Profile'         },
  { q:['expense','budget','cost'],  path:'/expense-estimator',icon:'💰',label:'Expense Estimator'  },
  { q:['owner','dashboard','manage'],path:'/owner-dashboard',icon:'🏢', label:'Owner Dashboard'    },
  { q:['add','list','post'],        path:'/add-listing',     icon:'➕', label:'Add Listing'        },
];

export default function Topbar({ onMenuClick }) {
  const { profile }    = useAuth();
  const { dark, toggle} = useTheme();
  const { notifs, unread, markAllRead, markRead } = useNotifications();
  const navigate       = useNavigate();
  const [showNotifs,   setShowNotifs]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [showSearch,   setShowSearch]   = useState(false);
  const [searchSuggs,  setSearchSuggs]  = useState([]);
  const [themeAnim,    setThemeAnim]    = useState(false);
  const panelRef  = useRef(null);
  const searchRef = useRef(null);

  // Close notifs on outside click
  useEffect(() => {
    const h = e => { if (panelRef.current && !panelRef.current.contains(e.target)) setShowNotifs(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Search suggestions
  useEffect(() => {
    if (!search.trim()) { setSearchSuggs([]); return; }
    const q = search.toLowerCase();
    const matches = SEARCH_ROUTES.filter(r => r.q.some(kw => kw.includes(q) || q.includes(kw)));
    setSearchSuggs(matches.slice(0, 4));
  }, [search]);

  const handleSearch = (path) => {
    navigate(path || '/dashboard');
    setSearch(''); setSearchSuggs([]); setShowSearch(false);
  };

  const handleThemeToggle = () => {
    setThemeAnim(true);
    toggle();
    setTimeout(() => setThemeAnim(false), 600);
  };

  return (
    <header className="h-14 flex items-center justify-between px-4 sm:px-5 shrink-0 relative z-20"
      style={{ borderBottom:'1px solid var(--border)', background:'var(--glass)', backdropFilter:'blur(20px)' }}>

      {/* Left */}
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl transition-all hover:bg-white/10 active:scale-95">
          <Menu size={18} style={{ color:'var(--text1)' }}/>
        </button>

        {/* Search — desktop */}
        <div className="hidden sm:block relative">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl w-48 lg:w-56 transition-all"
            style={{ background:'var(--inp)', border:'1.5px solid var(--border)' }}
            onFocus={() => {}} >
            <Search size={13} style={{ color:'var(--text3)' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter' && searchSuggs[0]) handleSearch(searchSuggs[0].path); }}
              placeholder="Search features..."
              className="bg-transparent outline-none text-xs flex-1"
              style={{ color:'var(--text1)' }}/>
            {search && (
              <button onClick={() => { setSearch(''); setSearchSuggs([]); }}
                className="text-gray-400 hover:text-gray-200 transition-colors">
                <X size={11}/>
              </button>
            )}
          </div>
          {/* Suggestions dropdown */}
          {searchSuggs.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-2xl z-50 anim-down"
              style={{ background: dark ? '#1a1635' : '#fff', border:'1px solid var(--border)' }}>
              {searchSuggs.map((s,i) => (
                <button key={i} onClick={() => handleSearch(s.path)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-medium transition-all hover:bg-indigo-500/15"
                  style={{ color:'var(--text1)', borderBottom: i<searchSuggs.length-1 ? '1px solid var(--border)' : 'none' }}>
                  <span className="text-base">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5 sm:gap-2">

        {/* Mobile search */}
        <button onClick={() => setShowSearch(s => !s)}
          className="sm:hidden p-2 rounded-xl transition-all hover:bg-white/10">
          <Search size={16} style={{ color:'var(--text1)' }}/>
        </button>

        {/* Dark/Light toggle */}
        <button onClick={handleThemeToggle}
          className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-95 tooltip ${themeAnim ? 'anim-wobble' : ''}`}
          style={{ background: dark ? 'rgba(251,191,36,0.12)' : 'rgba(99,102,241,0.12)',
                   border: `1px solid ${dark ? 'rgba(251,191,36,0.25)' : 'rgba(99,102,241,0.25)'}` }}>
          <span className="tooltip-text">{dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
          <div className="transition-transform duration-300" style={{ transform: themeAnim ? 'rotate(360deg)' : 'none' }}>
            {dark
              ? <Sun size={15} style={{ color:'#fbbf24' }}/>
              : <Moon size={15} style={{ color:'#6366f1' }}/>}
          </div>
        </button>

        {/* Notifications */}
        <div className="relative" ref={panelRef}>
          <button onClick={() => setShowNotifs(s => !s)}
            className="relative p-2 rounded-xl transition-all hover:scale-110 active:scale-95 tooltip"
            style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <span className="tooltip-text">Notifications</span>
            <Bell size={15} style={{ color:'var(--text1)' }}/>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center anim-badge"
                style={{ background:'linear-gradient(135deg,#ef4444,#f97316)', boxShadow:'0 0 8px rgba(239,68,68,0.6)' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* Notif panel */}
          {showNotifs && (
            <div className="absolute right-0 top-11 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden anim-notif"
              style={{ background: dark ? '#12102a' : '#fff', border:'1px solid var(--border)',
                       boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom:'1px solid var(--border)', background: dark ? 'rgba(79,70,229,0.1)' : 'rgba(79,70,229,0.05)' }}>
                <div className="flex items-center gap-2">
                  <Bell size={14} style={{ color:'var(--accent)' }}/>
                  <h3 className="font-bold text-sm" style={{ color:'var(--text1)' }}>
                    Notifications
                    {unread > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] text-white font-bold"
                        style={{ background:'#ef4444' }}>{unread}</span>
                    )}
                  </h3>
                </div>
                {unread > 0 && (
                  <button onClick={markAllRead}
                    className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                    style={{ color:'var(--accent)' }}>
                    <CheckCheck size={12}/> All read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3"
                      style={{ background:'var(--card)' }}>
                      <Bell size={22} style={{ color:'var(--text3)' }}/>
                    </div>
                    <p className="text-sm font-medium" style={{ color:'var(--text3)' }}>All caught up!</p>
                  </div>
                ) : notifs.map((n, i) => (
                  <button key={n.id} onClick={() => markRead(n.id)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 transition-all hover:bg-indigo-500/8"
                    style={{ background: !n.read ? (dark?'rgba(79,70,229,0.07)':'rgba(79,70,229,0.04)') : 'transparent',
                             borderBottom:'1px solid var(--border)' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm"
                      style={{ background:`${TYPE_COLOR[n.type]||'#6366f1'}18` }}>
                      {TYPE_ICON[n.type]||'💡'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold leading-snug" style={{ color:'var(--text1)' }}>{n.title}</p>
                      <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color:'var(--text2)' }}>{n.body}</p>
                      <p className="text-[10px] mt-1" style={{ color:'var(--text3)' }}>{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                        style={{ background:'var(--accent)', boxShadow:`0 0 6px var(--accent)` }}/>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <button onClick={() => navigate('/profile')}
          className="relative w-8 h-8 rounded-full overflow-hidden transition-all hover:scale-110 hover:ring-2 hover:ring-indigo-500 active:scale-95 tooltip"
          style={{ border:'2px solid var(--border)' }}>
          <span className="tooltip-text">My Profile</span>
          {profile?.profile_image_url
            ? <img src={profile.profile_image_url} alt="" className="w-full h-full object-cover"/>
            : <div className="w-full h-full flex items-center justify-center font-bold text-xs text-white"
                style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>}
        </button>
      </div>

      {/* Mobile search bar */}
      {showSearch && (
        <div className="absolute left-0 right-0 top-14 px-4 py-3 z-30 sm:hidden anim-down"
          style={{ background: dark ? '#0e0c2a' : '#f5f4ff', borderBottom:'1px solid var(--border)' }}>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background:'var(--inp)', border:'1.5px solid var(--border)' }}>
            <Search size={14} style={{ color:'var(--text3)' }}/>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter' && searchSuggs[0]) handleSearch(searchSuggs[0].path); }}
              placeholder="Search features..."
              className="bg-transparent outline-none text-sm flex-1" style={{ color:'var(--text1)' }}/>
          </div>
          {searchSuggs.length > 0 && (
            <div className="mt-2 rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
              {searchSuggs.map((s,i) => (
                <button key={i} onClick={() => handleSearch(s.path)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-medium transition-all"
                  style={{ color:'var(--text1)', background: dark ? '#1a1635' : '#fff',
                           borderBottom: i<searchSuggs.length-1 ? '1px solid var(--border)' : 'none' }}>
                  <span>{s.icon}</span>{s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

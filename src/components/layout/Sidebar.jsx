import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, User, PlusSquare, Search, Users, MessageSquare, CalendarDays,
         Star, Calculator, LogOut, Home, Gift, Building2, TrendingUp, Brain, ChevronRight, Bell } from 'lucide-react';
import { logoutUser } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import toast from 'react-hot-toast';

const NAV = [
  { path:'/dashboard',         icon:LayoutDashboard, label:'Dashboard',         emoji:'🏡' },
  { path:'/profile',           icon:User,            label:'My Profile',         emoji:'👤' },
  { path:'/browse-rooms',      icon:Search,          label:'Browse Rooms',       emoji:'🔍' },
  { path:'/browse-students',   icon:Users,           label:'Browse Students',    emoji:'👥' },
  { path:'/roommate-match',    icon:Brain,           label:'Roommate Match AI',  emoji:'🤝' },
  { path:'/rent-predictor',    icon:TrendingUp,      label:'AI Rent Predictor',  emoji:'📊' },
  { path:'/add-listing',       icon:PlusSquare,      label:'Add Listing',        emoji:'➕' },
  { path:'/owner-dashboard',   icon:Building2,       label:'Owner Dashboard',    emoji:'🏢' },
  { path:'/chat',              icon:MessageSquare,   label:'Messages',           emoji:'💬' },
  { path:'/visit-scheduler',   icon:CalendarDays,    label:'Visit Scheduler',    emoji:'📅' },
  { path:'/expense-estimator', icon:Calculator,      label:'Expense Estimator',  emoji:'💰' },
  { path:'/referral',          icon:Gift,            label:'Earn ₹1000',         emoji:'💸' },
  { path:'/reviews',           icon:Star,            label:'Reviews',            emoji:'⭐' },
];

export default function Sidebar({ onClose }) {
  const { profile }                          = useAuth();
  const { dark }                             = useTheme();
  const { unread, unreadMessages }           = useNotifications();
  const navigate                             = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    toast.success('Logged out! See you soon 👋');
    navigate('/login');
  };

  const roleLabel = profile?.role === 'owner'
    ? '🔑 Room Owner'
    : profile?.role === 'student_have_room'
    ? '🏠 Has a Room'
    : '🔍 Needs a Room';

  return (
    <div className="flex flex-col h-full py-4 px-2.5 overflow-y-auto">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-5 anim-right">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 anim-glow"
          style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow:'0 0 20px rgba(79,70,229,0.45)' }}>
          <Home size={15} className="text-white"/>
        </div>
        <div>
          <h1 className="font-bold text-sm leading-none tracking-tight" style={{ color:'var(--text1)' }}>RoomSync</h1>
          <p className="text-[10px] mt-0.5 font-medium" style={{ color:'var(--text3)' }}>Find. Match. Live.</p>
        </div>
        {/* Bell icon with notification badge */}
        {unread > 0 && (
          <button onClick={() => { navigate('/dashboard'); onClose(); }}
            className="ml-auto relative p-1.5 rounded-xl transition-all hover:bg-white/10">
            <Bell size={15} style={{ color: '#f59e0b' }} />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
              style={{ background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.6)' }}>
              {unread > 9 ? '9+' : unread}
            </span>
          </button>
        )}
      </div>

      {/* Profile chip */}
      {profile && (
        <button onClick={() => { navigate('/profile'); onClose(); }}
          className="flex items-center gap-2.5 p-2.5 rounded-2xl mb-4 w-full text-left transition-all hover:scale-[1.02] anim-fade"
          style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 relative"
            style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
            {profile.profile_image_url
              ? <img src={profile.profile_image_url} alt="" className="w-full h-full object-cover"/>
              : <div className="w-full h-full flex items-center justify-center font-bold text-sm text-white">
                  {profile.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>}
            {/* Online dot */}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
              style={{ background:'#22c55e', borderColor: dark ? '#0a091e' : '#fff' }}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs truncate" style={{ color:'var(--text1)' }}>{profile.name}</p>
            <p className="text-[10px] truncate mt-0.5" style={{ color:'var(--text3)' }}>{roleLabel}</p>
          </div>
          <ChevronRight size={12} style={{ color:'var(--text3)' }}/>
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5">
        {NAV.map(({ path, icon: Icon, label, emoji }, i) => (
          <NavLink key={path} to={path} onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            style={{ animationDelay:`${i*25}ms` }}>
            <Icon size={14} className="shrink-0"/>
            <span className="flex-1 truncate text-xs">{label}</span>

            {/* Real-time unread CHAT MESSAGES badge */}
            {path === '/chat' && unreadMessages > 0 && (
              <span className="w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center shrink-0 anim-badge"
                style={{ background:'#ef4444', boxShadow:'0 0 8px rgba(239,68,68,0.6)' }}>
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}

            {/* Real-time unread NOTIFICATIONS badge on Dashboard */}
            {path === '/dashboard' && unread > 0 && (
              <span className="w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center shrink-0 anim-badge"
                style={{ background:'#f59e0b', boxShadow:'0 0 8px rgba(245,158,11,0.6)' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}

            {/* HOT badge for referral */}
            {path === '/referral' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background:'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white' }}>
                HOT
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <button onClick={handleLogout}
        className="mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full text-left text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95 ripple-btn"
        style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', color:'#f87171' }}>
        <LogOut size={13}/>
        Sign Out
      </button>
    </div>
  );
}
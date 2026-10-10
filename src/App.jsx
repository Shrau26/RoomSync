import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import PageTransition from './components/common/PageTransition';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';
import AddListingPage from './pages/AddListingPage';
import BrowseRoomsPage from './pages/BrowseRoomsPage';
import BrowseStudentsPage from './pages/BrowseStudentsPage';
import RoommateMatchPage from './pages/RoommateMatchPage';
import ChatPage from './pages/ChatPage';
import VisitSchedulerPage from './pages/VisitSchedulerPage';
import ReviewsPage from './pages/ReviewsPage';
import ExpenseEstimatorPage from './pages/ExpenseEstimatorPage';
import ReferralPage from './pages/ReferralPage';
import OwnerDashboard from './pages/OwnerDashboard';
import RentPredictorPage from './pages/RentPredictorPage';

// Animated splash loader
const Loader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4"
    style={{ background:'linear-gradient(135deg,#070714,#0e0c2a)' }}>
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"/>
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin"/>
      <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-400 animate-spin"
        style={{ animationDuration:'0.6s', animationDirection:'reverse' }}/>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl">🏠</span>
      </div>
    </div>
    <div className="text-center">
      <p className="font-bold text-white text-lg tracking-tight">RoomSync</p>
      <p className="text-white/40 text-xs mt-0.5">Loading your experience...</p>
    </div>
  </div>
);

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loader/>;
  return user ? children : <Navigate to="/login" replace/>;
};

const Public = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loader/>;
  return !user ? children : <Navigate to="/dashboard" replace/>;
};

function ChatPageWrapper() {
  const loc = useLocation();
  return <ChatPage initialContact={loc.state?.contact}/>;
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1e1b4b',
            color: '#f1f0ff',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '14px',
            fontSize: '14px',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
      <Route path="/login"          element={<Public><PageTransition><LoginPage/></PageTransition></Public>}/>
      <Route path="/signup"         element={<Public><PageTransition><SignupPage/></PageTransition></Public>}/>
      <Route path="/forgot-password"element={<Public><PageTransition><ForgotPasswordPage/></PageTransition></Public>}/>

      <Route path="/" element={<Protected><DashboardLayout/></Protected>}>
        <Route index                 element={<Navigate to="/dashboard" replace/>}/>
        <Route path="dashboard"      element={<PageTransition><Dashboard/></PageTransition>}/>
        <Route path="profile"        element={<PageTransition><ProfilePage/></PageTransition>}/>
        <Route path="add-listing"    element={<PageTransition><AddListingPage/></PageTransition>}/>
        <Route path="browse-rooms"   element={<PageTransition><BrowseRoomsPage/></PageTransition>}/>
        <Route path="browse-students"element={<PageTransition><BrowseStudentsPage/></PageTransition>}/>
        <Route path="roommate-match" element={<PageTransition><RoommateMatchPage/></PageTransition>}/>
        <Route path="chat"           element={<PageTransition><ChatPageWrapper/></PageTransition>}/>
        <Route path="visit-scheduler"element={<PageTransition><VisitSchedulerPage/></PageTransition>}/>
        <Route path="reviews"        element={<PageTransition><ReviewsPage/></PageTransition>}/>
        <Route path="expense-estimator" element={<PageTransition><ExpenseEstimatorPage/></PageTransition>}/>
        <Route path="referral"       element={<PageTransition><ReferralPage/></PageTransition>}/>
        <Route path="owner-dashboard"element={<PageTransition><OwnerDashboard/></PageTransition>}/>
        <Route path="rent-predictor" element={<PageTransition><RentPredictorPage/></PageTransition>}/>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
      </Routes>
    </>
  );
}

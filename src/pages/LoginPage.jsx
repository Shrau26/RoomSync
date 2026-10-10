// ============================================
// pages/LoginPage.jsx
// RoomSync Login — role selector removed,
// full input validation, inline field errors,
// disabled button, loading spinner,
// and visible "Login Successful" / "Invalid Credentials" messages
// ============================================

import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, LogIn, Home, AlertCircle } from 'lucide-react';
import { loginUser, getUserProfile } from '../services/authService';
import { validateLoginForm, isFormValid } from '../utils/validation';
import toast from 'react-hot-toast';

const BTN_GRAD  = 'linear-gradient(135deg,#3b82f6,#6366f1)';
const BTN_COLOR = '#3b82f6';

/** Small inline error under a field */
function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <div id={id} className="flex items-center gap-1.5 mt-1.5" role="alert">
      <AlertCircle size={12} style={{ color:'#f87171', flexShrink:0 }}/>
      <p style={{ color:'#f87171', fontSize:'11px', lineHeight:1.4 }}>{message}</p>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();

  const [form,    setForm]    = useState({ email:'', password:'' });
  const [errors,  setErrors]  = useState({ email:null, password:null });
  const [touched, setTouched] = useState({ email:false, password:false });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Re-validate a single field whenever it changes
  const handleChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const errs = validateLoginForm({ ...form, [field]: value });
      setErrors(prev => ({ ...prev, [field]: errs[field] }));
    }
  }, [form, touched]);

  // Validate on blur so errors appear after user leaves a field
  const handleBlur = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const errs = validateLoginForm(form);
    setErrors(prev => ({ ...prev, [field]: errs[field] }));
  }, [form]);

  // Whether the form is currently valid enough to submit
  const canSubmit = isFormValid(validateLoginForm(form)) && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Touch all fields to reveal any remaining errors
    setTouched({ email:true, password:true });
    const allErrors = validateLoginForm(form);
    setErrors(allErrors);
    if (!isFormValid(allErrors)) {
      toast.error('Please fix the errors before signing in');
      return;
    }

    setLoading(true);
    try {
      const fbUser = await loginUser(form.email.trim(), form.password);
      let dest = '/dashboard';
      try {
        const prof = await getUserProfile(fbUser.uid);
        if (prof?.role === 'owner') dest = '/owner-dashboard';
      } catch { /* profile fetch non-critical */ }

      // ✅ Visible success message
      toast.success('Login Successful! Welcome back 🎉', { duration: 3000 });
      navigate(dest);

    } catch (err) {
      // ❌ Visible, human-readable error message
      const isCredErr = ['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(err.code);
      const msg = isCredErr
        ? 'Invalid Credentials — email or password is incorrect'
        : err.code === 'auth/too-many-requests'
        ? 'Too many failed attempts. Please try again later.'
        : err.message || 'Login failed. Please try again.';

      toast.error(msg, { duration: 4000 });

      if (isCredErr) {
        setErrors(prev => ({ ...prev, password:'Incorrect email or password' }));
        setTouched(prev => ({ ...prev, password:true }));
      }
    } finally {
      setLoading(false);
    }
  };

  // Dynamic border colour: red=error, green=valid, default otherwise
  const inputStyle = (field) => ({
    background: 'rgba(255,255,255,0.07)',
    border: `1px solid ${
      touched[field] && errors[field]   ? '#f87171'
      : touched[field] && !errors[field] ? 'rgba(34,197,94,0.6)'
      : 'rgba(255,255,255,0.12)'}`,
    transition: 'border-color 0.2s',
  });

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)' }}>

      {/* Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[{w:380,top:'-8%',left:'-4%',c:'#3b82f6',d:8},{w:300,bottom:'5%',right:'-4%',c:'#8b5cf6',d:6},{w:250,top:'45%',left:'55%',c:'#06b6d4',d:10}].map((b,i)=>(
          <div key={i} className="absolute rounded-full" style={{width:b.w,height:b.w,top:b.top,bottom:b.bottom,left:b.left,right:b.right,opacity:0.15,background:`radial-gradient(circle,${b.c},transparent)`,animation:`blobFloat ${b.d}s ease-in-out infinite`,animationDelay:`${i*1.5}s`}}/>
        ))}
        {[...Array(10)].map((_,i)=>(
          <div key={i} className="absolute rounded-full bg-white" style={{width:3,height:3,opacity:0.18,top:`${6+i*9}%`,left:`${4+i*9}%`,animation:`sparkle ${2+i*0.4}s ease-in-out infinite`,animationDelay:`${i*0.25}s`}}/>
        ))}
      </div>

      <div className="w-full max-w-md px-4 relative z-10 py-8" style={{animation:'slideUp 0.5s ease-out'}}>

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
            style={{background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',boxShadow:'0 0 40px rgba(99,102,241,0.5)'}}>
            <Home size={28} className="text-white"/>
          </div>
          <h1 className="text-3xl font-bold text-white">RoomSync</h1>
          <p className="text-sm mt-1" style={{color:'rgba(255,255,255,0.4)'}}>AI-Powered Student Housing</p>
        </div>

        <div className="rounded-3xl p-7 backdrop-blur-xl"
          style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',boxShadow:'0 30px 60px rgba(0,0,0,0.5)'}}>

          <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-sm mb-5" style={{color:'rgba(255,255,255,0.4)'}}>Sign in to your RoomSync account</p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Email */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{color:'rgba(255,255,255,0.5)'}}>
                Email <span style={{color:'#f87171'}}>*</span>
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{color:touched.email&&errors.email?'#f87171':'rgba(255,255,255,0.4)'}}/>
                <input
                  type="email"
                  value={form.email}
                  onChange={e=>handleChange('email',e.target.value)}
                  onBlur={()=>handleBlur('email')}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={!!(touched.email&&errors.email)}
                  aria-describedby="email-error"
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-white text-sm placeholder-white/25 outline-none"
                  style={inputStyle('email')}
                />
              </div>
              <FieldError id="email-error" message={touched.email ? errors.email : null}/>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{color:'rgba(255,255,255,0.5)'}}>
                Password <span style={{color:'#f87171'}}>*</span>
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{color:touched.password&&errors.password?'#f87171':'rgba(255,255,255,0.4)'}}/>
                <input
                  type={showPwd?'text':'password'}
                  value={form.password}
                  onChange={e=>handleChange('password',e.target.value)}
                  onBlur={()=>handleBlur('password')}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={!!(touched.password&&errors.password)}
                  aria-describedby="password-error"
                  className="w-full pl-11 pr-11 py-3 rounded-xl text-white text-sm placeholder-white/25 outline-none"
                  style={inputStyle('password')}
                />
                <button type="button" onClick={()=>setShowPwd(v=>!v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 hover:opacity-80"
                  style={{color:'rgba(255,255,255,0.4)'}} aria-label="Toggle password visibility">
                  {showPwd?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
              <FieldError id="password-error" message={touched.password ? errors.password : null}/>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs" style={{color:'#60a5fa'}}>Forgot password?</Link>
            </div>

            {/* Submit — disabled when invalid or loading */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
              style={{
                background: canSubmit ? BTN_GRAD : 'rgba(255,255,255,0.1)',
                boxShadow:  canSubmit ? `0 8px 25px ${BTN_COLOR}44` : 'none',
                cursor:  canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.55,
              }}>
              {loading
                ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Signing in…</span></>
                : <><LogIn size={17}/> Sign In</>}
            </button>
          </form>

          <p className="text-center text-sm mt-5" style={{color:'rgba(255,255,255,0.4)'}}>
            New to RoomSync?{' '}
            <Link to="/signup" className="font-medium" style={{color:'#60a5fa'}}>Create account</Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideUp   {from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blobFloat {0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(18px,18px) scale(1.05)}}
        @keyframes sparkle   {0%,100%{opacity:0.08;transform:scale(0.7)}50%{opacity:0.5;transform:scale(1.5)}}
      `}</style>
    </div>
  );
}
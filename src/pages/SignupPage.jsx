// ============================================
// pages/SignupPage.jsx
// CHANGES in this version:
//   • Added "Referral Code (optional)" input field
//   • On signup: look up referral code → if valid, call createReferralOnSignup()
//   • Prevents self-referral and invalid codes (errors shown inline)
//   • All other logic (OTP, validation, role selector) unchanged
// ============================================

import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Mail, Lock, User, Home, Search, Users,
  AlertCircle, CheckCircle, KeyRound, RefreshCw, Gift,
} from 'lucide-react';
import { registerUser, checkEmailExists } from '../services/authService';
import { sendOTP, verifyOTP, clearOTP } from '../services/otpService';
import { findUserByReferralCode, createReferralOnSignup } from '../services/referralService';
import { validateSignupForm, isFormValid, getPasswordStrength } from '../utils/validation';
import toast from 'react-hot-toast';

const ROLES = [
  { id:'student_need_room', label:'Student — Need a Room', desc:'Looking for a room near college', icon:Search, color:'#3b82f6', grad:'linear-gradient(135deg,#3b82f6,#6366f1)' },
  { id:'student_have_room', label:'Student — Have a Room', desc:'Have space, looking for roommate',  icon:Users,  color:'#8b5cf6', grad:'linear-gradient(135deg,#8b5cf6,#ec4899)' },
  { id:'owner',             label:'Room Owner',            desc:'List rooms, manage tenants',       icon:Home,   color:'#10b981', grad:'linear-gradient(135deg,#10b981,#06b6d4)' },
];

const STEP_FORM = 'form';
const STEP_OTP  = 'otp';

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <div id={id} className="flex items-center gap-1.5 mt-1.5" role="alert">
      <AlertCircle size={12} style={{color:'#f87171',flexShrink:0}}/>
      <p style={{color:'#f87171',fontSize:'11px',lineHeight:1.4}}>{message}</p>
    </div>
  );
}

function PasswordStrengthBar({ password }) {
  if (!password) return null;
  const { score, label, color } = getPasswordStrength(password);
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0,1,2,3].map(i=>(
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{background: i < score ? color : 'rgba(255,255,255,0.12)'}}/>
        ))}
      </div>
      {label && <p style={{fontSize:'10px',color}}>{label}</p>}
    </div>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();

  const [step,    setStep]    = useState(STEP_FORM);
  const [role,    setRole]    = useState('student_need_room');
  const [form,    setForm]    = useState({ name:'', email:'', password:'', confirm:'' });
  const [errors,  setErrors]  = useState({ name:null, email:null, password:null, confirm:null });
  const [touched, setTouched] = useState({ name:false, email:false, password:false, confirm:false });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailExists, setEmailExists] = useState(false);

  // ── Referral code state (NEW) ──────────────────────────────
  const [referralCode,      setReferralCode]      = useState('');
  const [referralError,     setReferralError]     = useState(null);
  const [referralValid,     setReferralValid]     = useState(false);  // true when code resolves
  const [referrerData,      setReferrerData]      = useState(null);   // the referrer's user doc
  const [checkingReferral,  setCheckingReferral]  = useState(false);

  // OTP state
  const [otp,       setOtp]       = useState('');
  const [otpError,  setOtpError]  = useState(null);
  const [devOtp,    setDevOtp]    = useState(null);
  const [resending, setResending] = useState(false);

  const sel = ROLES.find(r => r.id === role);

  const handleChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'email') setEmailExists(false);
    if (touched[field]) {
      const errs = validateSignupForm({ ...form, [field]: value });
      setErrors(prev => ({ ...prev, [field]: errs[field] }));
      if (field === 'password' && touched.confirm) {
        setErrors(prev => ({ ...prev, confirm: errs.confirm }));
      }
    }
  }, [form, touched]);

  const handleBlur = useCallback(async (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const errs = validateSignupForm(form);
    setErrors(prev => ({ ...prev, [field]: errs[field] }));
    // Check email existence on email blur — before OTP is sent
    if (field === 'email' && form.email && !errs.email) {
      const exists = await checkEmailExists(form.email.trim());
      setEmailExists(exists);
      if (exists) {
        setErrors(prev => ({ ...prev, email: 'This email is already registered. Please sign in instead.' }));
      }
    }
  }, [form]);

  // ── Validate referral code on blur (NEW) ─────────────────
  const handleReferralBlur = async () => {
    const code = referralCode.trim().toUpperCase();
    if (!code) {
      // Optional field — empty is fine
      setReferralError(null);
      setReferralValid(false);
      setReferrerData(null);
      return;
    }
    setCheckingReferral(true);
    setReferralError(null);
    setReferralValid(false);
    setReferrerData(null);
    try {
      const referrer = await findUserByReferralCode(code);
      if (!referrer) {
        setReferralError('Invalid referral code — not found');
      } else {
        setReferralValid(true);
        setReferrerData(referrer);
      }
    } catch {
      setReferralError('Could not verify code — please try again');
    } finally {
      setCheckingReferral(false);
    }
  };

  const canSubmitForm = isFormValid(validateSignupForm(form)) && !loading;

  // ── Step 1: Validate form + optionally validate code, then send OTP ─────────
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setTouched({ name:true, email:true, password:true, confirm:true });
    const allErrors = validateSignupForm(form);
    setErrors(allErrors);
    if (!isFormValid(allErrors)) {
      toast.error('Please fix all errors before continuing');
      return;
    }

    // If referral code entered but not yet validated, validate it now
    const code = referralCode.trim().toUpperCase();
    if (code && !referralValid) {
      setCheckingReferral(true);
      try {
        const referrer = await findUserByReferralCode(code);
        if (!referrer) {
          setReferralError('Invalid referral code — not found');
          setCheckingReferral(false);
          return;
        }
        setReferralValid(true);
        setReferrerData(referrer);
      } catch {
        setReferralError('Could not verify code — please try again');
        setCheckingReferral(false);
        return;
      }
      setCheckingReferral(false);
    }

    // Block if email already registered
    if (emailExists) {
      toast.error('This email is already registered. Please sign in instead.');
      return;
    }

    // Double-check email existence before sending OTP
    const exists = await checkEmailExists(form.email.trim());
    if (exists) {
      setEmailExists(true);
      setErrors(prev => ({ ...prev, email: 'This email is already registered. Please sign in instead.' }));
      toast.error('This email is already registered. Please sign in instead.');
      return;
    }

    setLoading(true);
    try {
      const result = await sendOTP(form.email.trim(), form.name.trim());
      if (!result.ok) { toast.error(result.error || 'Failed to send OTP'); return; }
      if (result.devOtp) {
        setDevOtp(result.devOtp);
        toast('📧 Dev mode: OTP shown below', { icon:'🛠️', duration:5000 });
      } else {
        toast.success(`OTP sent to ${form.email}!`, { duration:4000 });
      }
      setStep(STEP_OTP);
    } catch {
      toast.error('Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP → Register → Optionally link referral (NEW) ──────────
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    if (!otp.trim())                          { setOtpError('Please enter the OTP'); return; }
    if (!/^\d{6}$/.test(otp.trim()))          { setOtpError('OTP must be 6 digits'); return; }

    const result = verifyOTP(form.email.trim(), otp.trim());
    if (!result.valid) { setOtpError(result.reason); return; }

    setOtpError(null);
    setLoading(true);
    try {
      // 1. Create Firebase Auth user + Firestore profile (generates referralCode)
      // If a valid referral code was supplied, pass the referrer's UID so it's
      // stored as referredBy — BrowseRoomsPage uses this to restrict listings.
      const fbUser = await registerUser(
        form.name.trim(),
        form.email.trim(),
        form.password,
        role,
        (referralValid && referrerData) ? referrerData.uid : null,
      );

      // 2. If a valid referral code was supplied, create the referral document
      //    Also save the referrer's name on the student's own profile so the
      //    student's dashboard can show "Referred by <name>" without extra queries.
      if (referralValid && referrerData) {
        try {
          // Save referrerName on the student's Firestore profile
          const { doc, updateDoc } = await import('firebase/firestore');
          const { db: _db } = await import('../firebase/config');
          await updateDoc(doc(_db, 'users', fbUser.uid), {
            referredByName: referrerData.name || '',
          });

          await createReferralOnSignup({
            referrerId:     referrerData.uid,
            referredUserId: fbUser.uid,
            referredEmail:  form.email.trim(),
            referrerName:   referrerData.name || '',
          });
          toast.success(`Referral applied! ${referrerData.name} will earn ₹1,000 when you move in 🎉`, { duration: 5000 });
        } catch (refErr) {
          // Referral creation failed (e.g. self-referral, duplicate) — warn but
          // do NOT block signup; user account is already created
          toast(refErr.message || 'Could not apply referral code', { icon:'⚠️' });
        }
      }

      toast.success('Registration Successful! Welcome to RoomSync 🎉', { duration:4000 });
      navigate(role === 'owner' ? '/add-listing' : '/profile');

    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use'
        ? 'This email is already registered. Try signing in instead.'
        : err.message || 'Registration failed. Please try again.';
      toast.error(msg, { duration:4000 });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true); setOtp(''); setOtpError(null); setDevOtp(null);
    try {
      const result = await sendOTP(form.email.trim(), form.name.trim());
      if (result.ok) {
        result.devOtp ? setDevOtp(result.devOtp) : toast.success('New OTP sent!');
      } else { toast.error(result.error || 'Failed to resend OTP'); }
    } finally { setResending(false); }
  };

  const handleBack = () => {
    clearOTP(form.email.trim());
    setStep(STEP_FORM); setOtp(''); setOtpError(null); setDevOtp(null);
  };

  const inputStyle = (field) => ({
    background:'rgba(255,255,255,0.07)',
    border:`1px solid ${
      touched[field]&&errors[field]    ? '#f87171'
      : touched[field]&&!errors[field] ? 'rgba(34,197,94,0.6)'
      : 'rgba(255,255,255,0.12)'}`,
    transition:'border-color 0.2s',
  });

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-8"
      style={{background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)'}}>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[{w:360,top:'-8%',right:'-4%',c:'#8b5cf6',d:8},{w:280,bottom:'5%',left:'-4%',c:'#3b82f6',d:6}].map((b,i)=>(
          <div key={i} className="absolute rounded-full" style={{width:b.w,height:b.w,top:b.top,bottom:b.bottom,left:b.left,right:b.right,opacity:0.15,background:`radial-gradient(circle,${b.c},transparent)`,animation:`blobFloat ${b.d}s ease-in-out infinite`,animationDelay:`${i}s`}}/>
        ))}
      </div>

      <div className="w-full max-w-md px-4 relative z-10" style={{animation:'slideUp 0.5s ease-out'}}>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{background:'linear-gradient(135deg,#8b5cf6,#3b82f6)',boxShadow:'0 0 40px rgba(139,92,246,0.5)'}}>
            <Home size={24} className="text-white"/>
          </div>
          <h1 className="text-2xl font-bold text-white">RoomSync</h1>
          <p className="text-sm" style={{color:'rgba(255,255,255,0.4)'}}>AI-Powered Student Housing</p>
        </div>

        <div className="rounded-3xl p-7 backdrop-blur-xl"
          style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',boxShadow:'0 30px 60px rgba(0,0,0,0.5)'}}>

          {/* ══════ STEP 1 — FORM ══════ */}
          {step === STEP_FORM && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Create Account</h2>
              <p className="text-sm mb-5" style={{color:'rgba(255,255,255,0.4)'}}>Join thousands of students on RoomSync</p>

              {/* Role selector */}
              <p className="text-xs font-semibold mb-2.5 uppercase tracking-wide" style={{color:'rgba(255,255,255,0.4)'}}>I am a</p>
              <div className="space-y-2 mb-5">
                {ROLES.map(r => {
                  const Icon = r.icon;
                  return (
                    <button key={r.id} type="button" onClick={()=>setRole(r.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left"
                      style={role===r.id
                        ? {background:`${r.color}22`,border:`1.5px solid ${r.color}88`,boxShadow:`0 0 12px ${r.color}33`}
                        : {background:'rgba(255,255,255,0.04)',border:'1.5px solid rgba(255,255,255,0.1)'}}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{background:role===r.id?r.grad:'rgba(255,255,255,0.1)'}}>
                        <Icon size={15} className="text-white"/>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white leading-tight">{r.label}</p>
                        <p className="text-xs" style={{color:'rgba(255,255,255,0.4)'}}>{r.desc}</p>
                      </div>
                      <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                        style={{borderColor:role===r.id?r.color:'rgba(255,255,255,0.2)'}}>
                        {role===r.id && <div className="w-2 h-2 rounded-full" style={{background:r.color}}/>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSendOTP} className="space-y-3.5" noValidate>

                {/* Name */}
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{color:'rgba(255,255,255,0.5)'}}>
                    Full Name <span style={{color:'#f87171'}}>*</span>
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2"
                      style={{color:touched.name&&errors.name?'#f87171':'rgba(255,255,255,0.4)'}}/>
                    <input value={form.name}
                      onChange={e=>handleChange('name',e.target.value)}
                      onBlur={()=>handleBlur('name')}
                      placeholder="Your full name" autoComplete="name"
                      aria-invalid={!!(touched.name&&errors.name)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl text-white text-sm placeholder-white/25 outline-none"
                      style={inputStyle('name')}/>
                  </div>
                  <FieldError message={touched.name ? errors.name : null}/>
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{color:'rgba(255,255,255,0.5)'}}>
                    Email <span style={{color:'#f87171'}}>*</span>
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2"
                      style={{color:touched.email&&errors.email?'#f87171':'rgba(255,255,255,0.4)'}}/>
                    <input type="email" value={form.email}
                      onChange={e=>handleChange('email',e.target.value)}
                      onBlur={()=>handleBlur('email')}
                      placeholder="you@example.com" autoComplete="email"
                      aria-invalid={!!(touched.email&&errors.email)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl text-white text-sm placeholder-white/25 outline-none"
                      style={inputStyle('email')}/>
                  </div>
                  <FieldError message={touched.email ? errors.email : null}/>
                </div>

                {/* Password + Confirm */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{color:'rgba(255,255,255,0.5)'}}>
                      Password <span style={{color:'#f87171'}}>*</span>
                    </label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{color:touched.password&&errors.password?'#f87171':'rgba(255,255,255,0.4)'}}/>
                      <input type={showPwd?'text':'password'} value={form.password}
                        onChange={e=>handleChange('password',e.target.value)}
                        onBlur={()=>handleBlur('password')}
                        placeholder="Min 8 chars" autoComplete="new-password"
                        className="w-full pl-9 pr-8 py-3 rounded-xl text-white text-sm placeholder-white/25 outline-none"
                        style={inputStyle('password')}/>
                      <button type="button" onClick={()=>setShowPwd(v=>!v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2"
                        style={{color:'rgba(255,255,255,0.4)'}}>
                        {showPwd?<EyeOff size={13}/>:<Eye size={13}/>}
                      </button>
                    </div>
                    <PasswordStrengthBar password={form.password}/>
                    <FieldError message={touched.password ? errors.password : null}/>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{color:'rgba(255,255,255,0.5)'}}>
                      Confirm <span style={{color:'#f87171'}}>*</span>
                    </label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{color:touched.confirm&&errors.confirm?'#f87171':'rgba(255,255,255,0.4)'}}/>
                      <input type="password" value={form.confirm}
                        onChange={e=>handleChange('confirm',e.target.value)}
                        onBlur={()=>handleBlur('confirm')}
                        placeholder="Repeat" autoComplete="new-password"
                        className="w-full pl-9 pr-4 py-3 rounded-xl text-white text-sm placeholder-white/25 outline-none"
                        style={inputStyle('confirm')}/>
                    </div>
                    <FieldError message={touched.confirm ? errors.confirm : null}/>
                  </div>
                </div>

                <p style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',lineHeight:1.6}}>
                  Password: 8+ chars, uppercase, lowercase, number &amp; special character.
                </p>

                {/* ── Referral Code field (NEW) ────────────────────── */}
                <div>
                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{color:'rgba(255,255,255,0.5)'}}>
                    <Gift size={11}/>
                    Referral Code
                    <span style={{color:'rgba(255,255,255,0.25)',fontWeight:400}}>(optional)</span>
                  </label>
                  <div className="relative">
                    <Gift size={14} className="absolute left-4 top-1/2 -translate-y-1/2"
                      style={{color: referralValid ? '#22c55e' : referralError ? '#f87171' : 'rgba(255,255,255,0.4)'}}/>
                    <input
                      value={referralCode}
                      onChange={e => {
                        setReferralCode(e.target.value.toUpperCase());
                        // Reset validation state when user edits
                        setReferralError(null);
                        setReferralValid(false);
                        setReferrerData(null);
                      }}
                      onBlur={handleReferralBlur}
                      placeholder="e.g. SHRAVANI4821"
                      maxLength={20}
                      className="w-full pl-11 pr-10 py-3 rounded-xl text-white text-sm placeholder-white/25 outline-none font-mono tracking-wider"
                      style={{
                        background:'rgba(255,255,255,0.07)',
                        border:`1px solid ${
                          referralValid ? 'rgba(34,197,94,0.6)'
                          : referralError ? '#f87171'
                          : 'rgba(255,255,255,0.12)'}`,
                        transition:'border-color 0.2s',
                      }}
                    />
                    {/* Status indicator on the right */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingReferral && (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"/>
                      )}
                      {!checkingReferral && referralValid && (
                        <CheckCircle size={15} style={{color:'#22c55e'}}/>
                      )}
                      {!checkingReferral && referralError && (
                        <AlertCircle size={15} style={{color:'#f87171'}}/>
                      )}
                    </div>
                  </div>

                  {/* Validation feedback */}
                  {referralError && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <AlertCircle size={12} style={{color:'#f87171',flexShrink:0}}/>
                      <p style={{color:'#f87171',fontSize:'11px'}}>{referralError}</p>
                    </div>
                  )}
                  {referralValid && referrerData && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <CheckCircle size={12} style={{color:'#22c55e',flexShrink:0}}/>
                      <p style={{color:'#22c55e',fontSize:'11px'}}>
                        Code accepted! Referred by <strong>{referrerData.name}</strong>
                      </p>
                    </div>
                  )}
                </div>
                {/* ── End referral code field ─────────────────────── */}

                <button type="submit" disabled={!canSubmitForm}
                  className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all mt-1"
                  style={{
                    background: canSubmitForm ? sel?.grad : 'rgba(255,255,255,0.1)',
                    cursor:  canSubmitForm ? 'pointer' : 'not-allowed',
                    opacity: canSubmitForm ? 1 : 0.55,
                  }}>
                  {loading
                    ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Sending OTP…</span></>
                    : <><Mail size={16}/> Send Verification Code</>}
                </button>
              </form>

              <p className="text-center text-sm mt-5" style={{color:'rgba(255,255,255,0.4)'}}>
                Already registered?{' '}
                <Link to="/login" className="font-medium" style={{color:'#60a5fa'}}>Sign in</Link>
              </p>
            </>
          )}

          {/* ══════ STEP 2 — OTP ══════ */}
          {step === STEP_OTP && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
                  style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)',boxShadow:'0 0 30px rgba(99,102,241,0.4)'}}>
                  <KeyRound size={22} className="text-white"/>
                </div>
                <h2 className="text-xl font-bold text-white">Verify Your Email</h2>
                <p className="text-sm mt-1" style={{color:'rgba(255,255,255,0.45)'}}>6-digit code sent to</p>
                <p className="text-sm font-semibold mt-0.5" style={{color:'#60a5fa'}}>{form.email}</p>
              </div>

              {devOtp && (
                <div className="mb-4 p-4 rounded-xl text-center"
                  style={{background:'rgba(234,179,8,0.12)',border:'2px solid rgba(234,179,8,0.5)'}}>
                  <p style={{color:'#fbbf24',fontSize:'11px',marginBottom:6}}>
                    🛠️ Dev Mode — EmailJS not configured. Your OTP is:
                  </p>
                  <p style={{color:'#fff',fontSize:'28px',fontWeight:'700',letterSpacing:'8px',fontFamily:'monospace',marginBottom:8}}>
                    {devOtp}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setOtp(devOtp); setOtpError(null); }}
                    className="text-xs px-4 py-1.5 rounded-lg font-medium"
                    style={{background:'rgba(234,179,8,0.25)',color:'#fbbf24',border:'1px solid rgba(234,179,8,0.5)'}}>
                    Click to fill automatically →
                  </button>
                </div>
              )}

              <form onSubmit={handleVerifyAndRegister} noValidate>
                <div className="mb-4">
                  <label className="text-xs font-medium mb-1.5 block" style={{color:'rgba(255,255,255,0.5)'}}>
                    Enter 6-digit OTP <span style={{color:'#f87171'}}>*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={otp}
                    onChange={e => {
                      // Strip non-digits, limit to 6
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(val);
                      setOtpError(null);
                    }}
                    onPaste={e => {
                      // Support paste — grab digits only from clipboard
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                      setOtp(pasted);
                      setOtpError(null);
                    }}
                    placeholder="_ _ _ _ _ _"
                    autoFocus
                    autoComplete="one-time-code"
                    className="w-full px-4 py-3.5 rounded-xl text-white text-center text-2xl font-bold tracking-[8px] placeholder-white/20 outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: `1px solid ${otpError ? '#f87171' : otp.length === 6 ? 'rgba(34,197,94,0.6)' : 'rgba(255,255,255,0.15)'}`,
                      transition: 'border-color 0.2s',
                    }}
                  />
                  {/* Character counter so user knows how many digits entered */}
                  <div className="flex justify-between mt-1">
                    <div><FieldError message={otpError}/></div>
                    <p style={{fontSize:'10px', color: otp.length===6 ? 'rgba(34,197,94,0.7)' : 'rgba(255,255,255,0.25)'}}>
                      {otp.length}/6
                    </p>
                  </div>
                </div>

                <button type="submit" disabled={loading || otp.length !== 6}
                  className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 mb-3"
                  style={{
                    background: otp.length===6&&!loading ? sel?.grad : 'rgba(255,255,255,0.1)',
                    cursor: otp.length===6&&!loading ? 'pointer' : 'not-allowed',
                    opacity: otp.length===6&&!loading ? 1 : 0.55,
                  }}>
                  {loading
                    ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Creating account…</span></>
                    : <><CheckCircle size={17}/> Verify &amp; Create Account</>}
                </button>

                <div className="flex items-center justify-between">
                  <button type="button" onClick={handleBack}
                    className="text-xs hover:opacity-80" style={{color:'rgba(255,255,255,0.4)'}}>
                    ← Edit details
                  </button>
                  <button type="button" onClick={handleResend} disabled={resending}
                    className="flex items-center gap-1.5 text-xs hover:opacity-80" style={{color:'#60a5fa'}}>
                    <RefreshCw size={12} className={resending?'animate-spin':''}/>
                    {resending?'Sending…':'Resend OTP'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp   {from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blobFloat {0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(18px,18px) scale(1.05)}}
      `}</style>
    </div>
  );
}
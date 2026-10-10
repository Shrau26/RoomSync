// ============================================
// pages/ForgotPasswordPage.jsx
// ============================================
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import { forgotPassword } from '../services/authService';
import AuthLayout from '../components/common/AuthLayout';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Enter your email');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
      toast.success('Reset email sent!');
    } catch {
      toast.error('Could not send reset email. Check the address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="glass p-8">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft size={15} /> Back to login
        </Link>

        {sent ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <Send size={24} className="text-green-400" />
            </div>
            <h2 className="font-display text-xl font-bold mb-2">Check your inbox</h2>
            <p className="text-white/50 text-sm">We sent a password reset link to <strong className="text-white">{email}</strong></p>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold mb-1">Reset password</h2>
            <p className="text-white/50 text-sm mb-7">Enter your email to receive a reset link</p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="form-label">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" className="input-field pl-11" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Send size={16} /> Send Reset Link</>}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

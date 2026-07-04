import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const Login = () => {
  const { signInWithGoogle, currentUser, authError } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) navigate('/picks');
  }, [currentUser, navigate]);

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) {
        setError(err.message || 'Sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const shownError = error || authError;

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <Hero />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-wc-accent to-emerald-600 shadow-glow mb-4 text-4xl">⚽</div>
          <h1 className="text-4xl font-bold tracking-tight">One More Shot</h1>
          <p className="text-gray-300 mt-1">World Cup 2026 Knockout Pool</p>
          <div className="mt-3 text-2xl tracking-widest opacity-90">🏴󠁧󠁢󠁥󠁮󠁧󠁿 🇫🇷 🇧🇷 🇦🇷 🇪🇸 🇵🇹 🇲🇽 🇺🇸</div>
        </div>
        <div className="card p-6 backdrop-blur">
          <p className="text-sm text-gray-400 text-center mb-4">Sign in with the Google account Ranjit has on the roster.</p>
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold px-4 py-3 rounded-lg hover:bg-gray-100 transition disabled:opacity-60"
          >
            <GoogleIcon />
            {loading ? 'Opening Google…' : 'Continue with Google'}
          </button>
          {shownError && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{shownError}</div>
          )}
          <p className="text-center text-xs text-gray-500 mt-4">
            Opened from a chat app? If Google says it can't sign you in, tap "open in Safari/Chrome."
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// Decorative background: navy base, soft glows, and faint pitch lines.
const Hero = () => (
  <div className="absolute inset-0 -z-0">
    <div className="absolute inset-0 bg-wc-navy" />
    <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[42rem] h-[42rem] rounded-full bg-wc-accent/10 blur-3xl" />
    <div className="absolute -bottom-40 -right-20 w-[36rem] h-[36rem] rounded-full bg-emerald-500/10 blur-3xl" />
    <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 600" fill="none" stroke="white" strokeWidth="2">
      <rect x="40" y="40" width="720" height="520" rx="6" />
      <line x1="400" y1="40" x2="400" y2="560" />
      <circle cx="400" cy="300" r="90" />
      <circle cx="400" cy="300" r="4" fill="white" />
      <rect x="40" y="180" width="120" height="240" />
      <rect x="640" y="180" width="120" height="240" />
    </svg>
  </div>
);

export default Login;

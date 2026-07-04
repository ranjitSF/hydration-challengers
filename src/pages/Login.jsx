import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Mail, CheckCircle } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const { sendSignInLink, currentUser, authError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) navigate('/picks');
  }, [currentUser, navigate]);

  // Surface an expired/invalid magic-link error raised during sign-in.
  const shownError = error || authError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendSignInLink(email);
      window.localStorage.setItem('emailForSignIn', email);
      setEmailSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send sign-in link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <Hero />
      {emailSent ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative max-w-md w-full text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-wc-accent mx-auto" />
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-gray-300">
            We emailed a sign-in link to <span className="text-wc-accent">{email}</span>.
            <br />Open it and <span className="text-white font-medium">tap the link</span> to get in — no password, no code.
          </p>
          <p className="text-gray-500 text-xs">Didn't get it? Check spam, or use a different email.</p>
          <button onClick={() => setEmailSent(false)} className="text-wc-accent text-sm hover:underline">
            Use a different email
          </button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-wc-accent to-emerald-600 shadow-glow mb-4 text-4xl">⚽</div>
            <h1 className="text-4xl font-bold tracking-tight">One More Shot</h1>
            <p className="text-gray-300 mt-1">World Cup 2026 Knockout Pool</p>
            <div className="mt-3 text-2xl tracking-widest opacity-90">🏴󠁧󠁢󠁥󠁮󠁧󠁿 🇫🇷 🇧🇷 🇦🇷 🇪🇸 🇵🇹 🇲🇽 🇺🇸</div>
          </div>
          <div className="card p-6 backdrop-blur">
            <div className="mb-4 text-center">
              <p className="text-sm text-gray-400">Enter the email Ranjit has for you — we'll send a one-tap sign-in link.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-wc-navyDarker border border-wc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-wc-accent"
              />
              {shownError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{shownError}</div>
              )}
              <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50 flex items-center justify-center gap-2">
                <Mail className="w-5 h-5" />
                {loading ? 'Sending...' : 'Email me a sign-in link'}
              </button>
            </form>
          </div>
        </motion.div>
      )}
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

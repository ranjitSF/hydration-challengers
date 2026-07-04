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

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-wc-accent mx-auto" />
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-gray-400">We sent a sign-in link to <span className="text-wc-accent">{email}</span>. Tap it to continue.</p>
          <button onClick={() => setEmailSent(false)} className="text-wc-accent text-sm hover:underline">
            Use a different email
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-3xl font-bold">One More Shot</h1>
          <p className="text-gray-400 mt-1">World Cup 2026 Knockout Pool</p>
        </div>
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-wc-navyDarker border border-wc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-wc-accent"
              />
            </div>
            {shownError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{shownError}</div>
            )}
            <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50 flex items-center justify-center gap-2">
              <Mail className="w-5 h-5" />
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { checkRoster, syncPlayer } from '../services';
import { adminEmail } from '../config/app';
import LoadingSpinner from '../components/LoadingSpinner';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const isAdminEmail = (email) =>
  !!email && !!adminEmail && email.toLowerCase() === adminEmail.toLowerCase();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Please confirm the email you used to sign in');
      }

      signInWithEmailLink(auth, email, window.location.href)
        .then(() => window.localStorage.removeItem('emailForSignIn'))
        .catch((error) => {
          console.error('Error signing in with email link:', error);
          setAuthError('That sign-in link is invalid or expired. Please enter your email to get a new one.');
        });
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          const token = await user.getIdToken();
          setAuthToken(token);
          setIsAdmin(isAdminEmail(user.email));
          const playerData = await syncPlayer(token);
          setPlayer(playerData);
        } catch (error) {
          console.error('Error syncing player:', error);
          setPlayer(null);
          setAuthError('We couldn’t find your account on the roster. Check with Ranjit.');
        }
      } else {
        setAuthToken(null);
        setPlayer(null);
        setIsAdmin(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const sendSignInLink = async (email) => {
    setAuthError('');
    const { found } = await checkRoster(email);
    if (!found) {
      throw new Error('Email not recognized — check with Ranjit.');
    }

    const actionCodeSettings = {
      url: window.location.origin + '/login',
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  };

  const signOut = () => firebaseSignOut(auth);

  const value = { currentUser, player, authToken, isAdmin, authError, sendSignInLink, signOut, loading };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <LoadingSpinner /> : children}
    </AuthContext.Provider>
  );
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { syncPlayer } from '../services';
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          const playerData = await syncPlayer(token); // 403 if email isn't on the roster
          setCurrentUser(user);
          setAuthToken(token);
          setIsAdmin(isAdminEmail(user.email));
          setPlayer(playerData);
        } catch (error) {
          // Signed in with Google but not on the roster → reject and sign back out.
          if (/roster|not on/i.test(error.message || '')) {
            setAuthError(`${user.email} isn't on the pool roster — check with Ranjit.`);
          } else {
            setAuthError('Something went wrong signing you in. Please try again.');
          }
          await firebaseSignOut(auth);
          setCurrentUser(null);
          setAuthToken(null);
          setPlayer(null);
          setIsAdmin(false);
        }
      } else {
        setCurrentUser(null);
        setAuthToken(null);
        setPlayer(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setAuthError('');
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = () => firebaseSignOut(auth);

  const value = { currentUser, player, authToken, isAdmin, authError, signInWithGoogle, signOut, loading };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <LoadingSpinner /> : children}
    </AuthContext.Provider>
  );
};

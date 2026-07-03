import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requireAdmin }) => {
  const { currentUser, isAdmin } = useAuth();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/standings" replace />;

  return children;
};

export default ProtectedRoute;

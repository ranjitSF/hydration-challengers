import React from 'react';

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-wc-border border-t-wc-accent rounded-full animate-spin" />
  </div>
);

export default LoadingSpinner;

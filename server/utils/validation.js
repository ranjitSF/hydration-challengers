export const isValidEmail = (email) =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const sanitizeString = (str) => (typeof str === 'string' ? str.trim() : '');

export const isPositiveInteger = (value) => /^\d+$/.test(String(value));

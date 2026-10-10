// ============================================
// utils/validation.js
// Centralised validation helpers for RoomSync
// Used by LoginPage, SignupPage, and any future forms
// ============================================

/**
 * Validates an email address using a standard pattern.
 * Returns an error string, or null if valid.
 */
export const validateEmail = (email) => {
  if (!email || !email.trim()) return 'Email is required';
  // Standard email regex: local@domain.tld
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!pattern.test(email.trim())) return 'Enter a valid email address (e.g. you@example.com)';
  return null;
};

/**
 * Validates a password against strength rules:
 *  - Minimum 8 characters
 *  - At least one uppercase letter
 *  - At least one lowercase letter
 *  - At least one digit
 *  - At least one special character
 * Returns an error string, or null if valid.
 */
export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password))
    return 'Password must contain at least one special character (!@#$%^&*…)';
  return null;
};

/**
 * Validates that a required text field is not empty.
 * @param {string} value - the field value
 * @param {string} fieldName - human-readable field name for error messages
 */
export const validateRequired = (value, fieldName = 'This field') => {
  if (!value || !value.trim()) return `${fieldName} is required`;
  return null;
};

/**
 * Validates that a confirm-password field matches the original password.
 */
export const validateConfirmPassword = (password, confirm) => {
  if (!confirm) return 'Please confirm your password';
  if (password !== confirm) return 'Passwords do not match';
  return null;
};

/**
 * Analyses password strength and returns a score (0–4) and label.
 * Useful for a visual strength indicator.
 * @returns {{ score: number, label: string, color: string }}
 */
export const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8)  score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) score++;

  const levels = [
    { label: 'Very Weak', color: '#ef4444' },
    { label: 'Weak',      color: '#f97316' },
    { label: 'Fair',      color: '#eab308' },
    { label: 'Strong',    color: '#22c55e' },
    { label: 'Very Strong', color: '#10b981' },
  ];
  return { score, ...levels[score] };
};

/**
 * Validates all login form fields at once.
 * Returns an object with field-level errors: { email: '...', password: '...' }
 * A field is null/undefined if valid.
 */
export const validateLoginForm = ({ email, password }) => ({
  email:    validateEmail(email),
  password: password ? null : 'Password is required',  // login: don't enforce strength
});

/**
 * Validates all signup form fields at once.
 * Returns an object with field-level errors.
 */
export const validateSignupForm = ({ name, email, password, confirm }) => ({
  name:     validateRequired(name, 'Full name'),
  email:    validateEmail(email),
  password: validatePassword(password),
  confirm:  validateConfirmPassword(password, confirm),
});

/**
 * Returns true if an errors object (from validateLoginForm / validateSignupForm)
 * has zero error strings (i.e., all values are null).
 */
export const isFormValid = (errors) =>
  Object.values(errors).every((v) => v === null || v === undefined);

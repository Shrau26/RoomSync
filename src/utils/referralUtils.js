// ============================================
// utils/referralUtils.js
// Utility functions for the Referral system
// ============================================

/**
 * generateReferralCode — creates a unique referral code
 * Format: FIRSTNAME + 4 random digits (uppercase)
 * Example: SHRAVANI4821, PRIYA9032, ANKIT1247
 *
 * @param {string} name - the user's full name
 * @returns {string} referral code e.g. "SHRAVANI4821"
 */
export function generateReferralCode(name) {
  // Take first name only, uppercase, strip non-alpha
  const firstName = (name || 'USER')
    .split(' ')[0]
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 12); // cap length for readability

  // 4 random digits
  const digits = Math.floor(1000 + Math.random() * 9000).toString();

  return `${firstName}${digits}`;
}

/**
 * STATUS_LABELS — human-readable labels and colours for referral statuses
 */
export const STATUS_META = {
  registered: {
    label: 'Registered',
    emoji: '👤',
    color: '#3b82f6',
    bg:    'rgba(59,130,246,0.12)',
    desc:  'Friend signed up with your code',
  },
  booked: {
    label: 'Room Booked',
    emoji: '🏠',
    color: '#f59e0b',
    bg:    'rgba(245,158,11,0.12)',
    desc:  'Friend has booked a visit / room',
  },
  moved_in: {
    label: 'Moved In',
    emoji: '🔑',
    color: '#8b5cf6',
    bg:    'rgba(139,92,246,0.12)',
    desc:  'Friend has moved into the room',
  },
  completed: {
    label: 'Completed',
    emoji: '✅',
    color: '#10b981',
    bg:    'rgba(16,185,129,0.12)',
    desc:  'Move-in confirmed — ₹1,000 commission earned!',
  },
};

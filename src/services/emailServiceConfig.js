// ============================================
// services/emailServiceConfig.js
// Single source of truth for EmailJS credentials
// ============================================
//
// HOW TO CONFIGURE (5 minutes, free):
//  1. Visit https://www.emailjs.com/ and create a free account
//  2. Add Email Service → Connect Gmail → copy SERVICE_ID
//  3. Email Templates → Create Template → copy TEMPLATE_ID
//     Template variables needed:
//     {{to_name}}, {{to_email}}, {{subject}}, {{message}}, {{otp_code}} (for OTP emails)
//     {{room_title}}, {{visit_date}}, {{visit_time}}, {{location}},
//     {{owner_name}}, {{student_name}}, {{owner_phone}}
//  4. Account → copy PUBLIC_KEY
//  5. Replace the placeholder strings below and save.
//
// ─────────────────────────────────────────────────────────

export const SERVICE_ID  = 'service_cnfe3mn';   // e.g. service_abc123
export const TEMPLATE_ID = 'template_xc9qarv';  // e.g. template_xyz789
export const PUBLIC_KEY  = 'o1D-Osihxwvo9Xrqc';   // e.g. AbCdEfGhIjKlMnOp12

/** True once real credentials have been supplied */
export const IS_CONFIGURED = SERVICE_ID !== 'YOUR_SERVICE_ID';

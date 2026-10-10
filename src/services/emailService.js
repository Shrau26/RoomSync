/**
 * RoomSync Email Service — EmailJS
 * ══════════════════════════════════
 * Credentials are now managed in emailServiceConfig.js (single source of truth).
 *
 * HOW TO SET UP (5 minutes, free):
 *
 * 1. Go to https://www.emailjs.com/ → Sign up free
 * 2. Add Email Service → Connect Gmail → Copy SERVICE_ID
 * 3. Email Templates → Create Template → Copy TEMPLATE_ID
 *    Template must have these variables:
 *    {{to_name}}, {{to_email}}, {{subject}}, {{message}},
 *    {{room_title}}, {{visit_date}}, {{visit_time}},
 *    {{location}}, {{owner_name}}, {{student_name}}, {{owner_phone}}
 * 4. Account → Copy PUBLIC_KEY
 * 5. Paste all 3 below and save
 */

import { SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY, IS_CONFIGURED } from './emailServiceConfig';

// ── Load EmailJS SDK once ──────────────────────────────
let sdkLoaded = false;
async function loadSDK() {
  if (sdkLoaded && window.emailjs) return;
  if (window.emailjs) { sdkLoaded = true; return; }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload = () => {
      window.emailjs.init(PUBLIC_KEY);
      sdkLoaded = true;
      console.log('[EmailJS] SDK loaded and initialized');
      resolve();
    };
    s.onerror = (e) => {
      console.error('[EmailJS] Failed to load SDK — check internet connection');
      reject(e);
    };
    document.head.appendChild(s);
  });
}

// ── Send one email ─────────────────────────────────────
async function sendEmail(toEmail, toName, subject, templateVars) {
  if (!toEmail || !toEmail.includes('@')) {
    console.warn('[Email] Invalid email:', toEmail);
    return { skipped: true, reason: 'invalid_email' };
  }
  await loadSDK();
  const params = {
    to_email:  toEmail,
    to_name:   toName  || 'User',
    from_name: 'RoomSync',
    reply_to:  'noreply@roomsync.in',
    subject,
    ...templateVars,
  };
  console.log('[Email] Sending to:', toEmail, '| Subject:', subject);
  const result = await window.emailjs.send(SERVICE_ID, TEMPLATE_ID, params);
  console.log('[Email] ✅ Sent to', toEmail, '| Status:', result.status);
  return result;
}

/**
 * sendVisitEmails — sends confirmation to BOTH student AND owner
 *
 * Call this when a visit is scheduled.
 * Returns: { ok: true } on success, { ok: false, error: ... } on failure,
 *          { ok: true, note: 'not_configured' } if EmailJS not set up yet
 */
export async function sendVisitEmails({
  studentName,
  studentEmail,
  ownerName,
  ownerEmail,
  ownerPhone,
  roomTitle,
  date,
  time,
  location,
}) {
  console.log('[Email] sendVisitEmails called');
  console.log('  Student:', studentName, studentEmail);
  console.log('  Owner:',   ownerName,   ownerEmail);
  console.log('  Room:',    roomTitle,   date, time);

  // Not configured yet — show setup instructions in console
  if (!IS_CONFIGURED) {
    console.warn('[Email] ⚠️  EmailJS not configured.');
    console.warn('  To enable emails:');
    console.warn('  1. Visit https://emailjs.com');
    console.warn('  2. Get SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY');
    console.warn('  3. Paste them in src/services/emailService.js');
    return { ok: true, note: 'not_configured' };
  }

  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    : date;

  const errors = [];
  let sentCount = 0;

  // ── 1. Email to STUDENT ────────────────────────────────
  if (studentEmail) {
    try {
      await sendEmail(
        studentEmail,
        studentName || 'Student',
        `✅ Visit Confirmed — ${roomTitle}`,
        {
          message: [
            `Hi ${studentName || 'there'},`,
            ``,
            `Your room visit has been scheduled successfully! Here are the details:`,
            ``,
            `🏠 Room:      ${roomTitle}`,
            `📍 Location:  ${location || 'See listing for address'}`,
            `📅 Date:      ${formattedDate}`,
            `🕐 Time:      ${time}`,
            `👤 Owner:     ${ownerName || 'Room Owner'}`,
            ownerPhone ? `📞 Phone:     +91 ${ownerPhone}` : '',
            ``,
            `Please carry a valid ID proof when you visit.`,
            `You can contact the owner directly if you need to reschedule.`,
            ``,
            `Best of luck finding your perfect room! 🏡`,
            `— RoomSync Team`,
          ].filter(Boolean).join('\n'),
          room_title:   roomTitle,
          visit_date:   formattedDate,
          visit_time:   time,
          location:     location || 'See listing',
          owner_name:   ownerName || 'Room Owner',
          owner_phone:  ownerPhone || 'N/A',
          student_name: studentName,
        }
      );
      sentCount++;
    } catch (err) {
      const msg = err?.text || err?.message || 'Unknown error';
      console.error('[Email] ❌ Student email failed:', msg);
      errors.push(`Student (${studentEmail}): ${msg}`);
    }
  } else {
    console.warn('[Email] No student email — skipping student notification');
  }

  // ── 2. Email to OWNER ──────────────────────────────────
  if (ownerEmail) {
    try {
      await sendEmail(
        ownerEmail,
        ownerName || 'Owner',
        `🔔 New Visit Request — ${roomTitle}`,
        {
          message: [
            `Hi ${ownerName || 'there'},`,
            ``,
            `A student wants to visit your room listing on RoomSync!`,
            ``,
            `🎓 Student:   ${studentName || 'A student'}`,
            `✉️  Email:     ${studentEmail || 'N/A'}`,
            `🏠 Your Room: ${roomTitle}`,
            `📍 Location:  ${location || 'Your listing address'}`,
            `📅 Date:      ${formattedDate}`,
            `🕐 Time:      ${time}`,
            ``,
            `Please log into RoomSync to confirm or reschedule this visit.`,
            `You can also contact the student directly at ${studentEmail || 'their registered email'}.`,
            ``,
            `— RoomSync Team`,
          ].filter(Boolean).join('\n'),
          room_title:   roomTitle,
          visit_date:   formattedDate,
          visit_time:   time,
          location:     location || 'Your listing',
          owner_name:   ownerName || 'Owner',
          student_name: studentName || 'A Student',
          to_email:     ownerEmail,
        }
      );
      sentCount++;
    } catch (err) {
      const msg = err?.text || err?.message || 'Unknown error';
      console.error('[Email] ❌ Owner email failed:', msg);
      errors.push(`Owner (${ownerEmail}): ${msg}`);
    }
  } else {
    console.warn('[Email] No owner email provided — owner notification skipped');
  }

  console.log(`[Email] Done — ${sentCount} sent, ${errors.length} failed`);

  if (errors.length > 0 && sentCount === 0) {
    return { ok: false, error: errors.join(' | '), sentCount };
  }
  return { ok: true, sentCount, errors: errors.length > 0 ? errors : undefined };
}

/**
 * sendReferralPayoutEmails
 * Sent when owner clicks "Mark as Moved In":
 *   • Email to STUDENT  → "Please pay ₹1,000 to <referrer>"
 *   • Email to REFERRER → "Your friend moved in! You'll receive ₹1,000"
 */
export async function sendReferralPayoutEmails({
  studentName,
  studentEmail,
  referrerName,
  referrerEmail,
  referrerUpi,
  roomTitle,
  amount = 1000,
}) {
  if (!IS_CONFIGURED) {
    console.warn('[Email] EmailJS not configured — referral payout emails skipped.');
    return { ok: true, note: 'not_configured' };
  }

  const errors   = [];
  let sentCount  = 0;

  // ── Email to STUDENT ───────────────────────────────────────────────────────
  if (studentEmail) {
    try {
      await sendEmail(
        studentEmail,
        studentName || 'Student',
        `💸 Action Required: Pay ₹${amount.toLocaleString()} to your referrer`,
        {
          message: [
            `Hi ${studentName || 'there'},`,
            ``,
            `Congratulations on moving into your new room — ${roomTitle}! 🎉`,
            ``,
            `As per the RoomSync referral program, you have been referred by:`,
            ``,
            `👤 Referrer Name:  ${referrerName || 'your referrer'}`,
            referrerEmail ? `✉️  Referrer Email: ${referrerEmail}` : '',
            referrerUpi   ? `💳 Referrer UPI:   ${referrerUpi}` : '',
            ``,
            `Please pay ₹${amount.toLocaleString()} to ${referrerName || 'your referrer'} directly.`,
            referrerUpi
              ? `You can pay via UPI ID: ${referrerUpi}`
              : `Please contact ${referrerName || 'your referrer'} to arrange the payment.`,
            ``,
            `Once you have paid, please mark the payment as done on your RoomSync dashboard`,
            `(Visit Scheduler → your confirmed visit → "I've Paid ₹1,000").`,
            ``,
            `Thank you for using RoomSync! 🏡`,
            `— RoomSync Team`,
          ].filter(Boolean).join('\n'),
          room_title:    roomTitle,
          referrer_name: referrerName || 'your referrer',
          referrer_upi:  referrerUpi  || 'N/A',
          amount:        `₹${amount.toLocaleString()}`,
        }
      );
      sentCount++;
    } catch (err) {
      const msg = err?.text || err?.message || 'Unknown error';
      console.error('[Email] ❌ Student payout email failed:', msg);
      errors.push(`Student (${studentEmail}): ${msg}`);
    }
  }

  // ── Email to REFERRER ──────────────────────────────────────────────────────
  if (referrerEmail) {
    try {
      await sendEmail(
        referrerEmail,
        referrerName || 'Referrer',
        `🎉 Your referral moved in! You'll receive ₹${amount.toLocaleString()}`,
        {
          message: [
            `Hi ${referrerName || 'there'},`,
            ``,
            `Great news! The friend you referred on RoomSync has officially moved in. 🎊`,
            ``,
            `👤 Student Name:  ${studentName || 'Your referral'}`,
            studentEmail ? `✉️  Student Email: ${studentEmail}` : '',
            `🏠 Room:          ${roomTitle}`,
            ``,
            `As per the RoomSync referral program, you will receive ₹${amount.toLocaleString()} from ${studentName || 'the student'}.`,
            `They have been notified to pay you directly.`,
            referrerUpi
              ? `They will pay to your UPI ID: ${referrerUpi}`
              : `Please share your UPI ID with the student to receive payment.`,
            ``,
            `You can track this on your RoomSync Referral dashboard.`,
            ``,
            `Thank you for growing the RoomSync community! 🙌`,
            `— RoomSync Team`,
          ].filter(Boolean).join('\n'),
          room_title:    roomTitle,
          student_name:  studentName || 'Your referral',
          amount:        `₹${amount.toLocaleString()}`,
        }
      );
      sentCount++;
    } catch (err) {
      const msg = err?.text || err?.message || 'Unknown error';
      console.error('[Email] ❌ Referrer payout email failed:', msg);
      errors.push(`Referrer (${referrerEmail}): ${msg}`);
    }
  }

  console.log(`[ReferralEmail] Done — ${sentCount} sent, ${errors.length} failed`);
  return { ok: sentCount > 0, sentCount, errors: errors.length ? errors : undefined };
}

/**
 * sendMovedInStudentEmail
 * Sent to the STUDENT when owner clicks "Mark as Moved In"
 * Subject: "🎉 Your shift is confirmed! Please pay ₹1,000 to your referrer"
 */
export async function sendMovedInStudentEmail({
  studentName,
  studentEmail,
  roomTitle,
  referrerName,
  referrerEmail,
  referrerUpi,
  hasReferral,
}) {
  if (!IS_CONFIGURED) {
    console.warn('[Email] EmailJS not configured — moved-in student email skipped.');
    return { ok: true, note: 'not_configured' };
  }
  if (!studentEmail) return { ok: false, error: 'No student email' };

  const paymentLines = hasReferral ? [
    ``,
    `💸 REFERRAL PAYMENT REQUIRED`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Since you signed up using a referral code, please pay ₹1,000 to:`,
    ``,
    `👤 Referrer Name:  ${referrerName || 'your referrer'}`,
    referrerEmail ? `✉️  Referrer Email: ${referrerEmail}` : '',
    referrerUpi   ? `💳 UPI ID:         ${referrerUpi}` : '',
    ``,
    `Please pay ₹1,000 directly via UPI or any payment method.`,
    `Once paid, open RoomSync → Visit Scheduler → click "I've Paid ₹1,000"`,
    `so your referrer gets notified automatically.`,
  ] : [];

  const body = [
    `Hi ${studentName || 'there'},`,
    ``,
    `🎉 Congratulations! Your shift has been confirmed by the owner.`,
    ``,
    `🏠 Room: ${roomTitle}`,
    `✅ Status: Moved In — confirmed by owner`,
    ...paymentLines,
    ``,
    `Welcome to your new home! 🏡`,
    `— RoomSync Team`,
  ].filter(l => l !== null && l !== undefined).join('\n');

  try {
    await sendEmail(
      studentEmail,
      studentName || 'Student',
      `🎉 Your shift is confirmed! ${hasReferral ? 'Please pay ₹1,000 to your referrer' : 'Welcome to your new home!'}`,
      { message: body, room_title: roomTitle }
    );
    console.log('[Email] ✅ Moved-in student email sent to', studentEmail);
    return { ok: true };
  } catch (err) {
    const msg = err?.text || err?.message || 'Unknown error';
    console.error('[Email] ❌ Moved-in student email failed:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * sendReferrerNotificationEmail
 * Sent to the REFERRER when their friend moves in
 * Subject: "🎉 Your referral moved in! You'll receive ₹1,000"
 */
export async function sendReferrerNotificationEmail({
  studentName,
  studentEmail,
  referrerName,
  referrerEmail,
  referrerUpi,
  roomTitle,
  amount = 1000,
}) {
  if (!IS_CONFIGURED) {
    console.warn('[Email] EmailJS not configured — referrer notification email skipped.');
    return { ok: true, note: 'not_configured' };
  }
  if (!referrerEmail) return { ok: false, error: 'No referrer email' };

  const body = [
    `Hi ${referrerName || 'there'},`,
    ``,
    `🎉 Great news! The friend you referred on RoomSync has officially moved in!`,
    ``,
    `👤 Student:  ${studentName || 'Your referral'}`,
    studentEmail ? `✉️  Email:    ${studentEmail}` : '',
    `🏠 Room:     ${roomTitle}`,
    ``,
    `💸 You will receive ₹${amount.toLocaleString()} from ${studentName || 'them'} directly.`,
    referrerUpi
      ? `They will pay to your UPI ID: ${referrerUpi}`
      : `Please share your UPI ID with them so they can pay you.`,
    ``,
    `You can track this payment on your RoomSync Referral Dashboard.`,
    `Once they click "I've Paid", your status will update to Completed.`,
    ``,
    `Thank you for growing the RoomSync community! 🙌`,
    `— RoomSync Team`,
  ].filter(Boolean).join('\n');

  try {
    await sendEmail(
      referrerEmail,
      referrerName || 'Referrer',
      `🎉 Your referral moved in! You'll receive ₹${amount.toLocaleString()}`,
      {
        message:      body,
        room_title:   roomTitle,
        student_name: studentName || 'Your referral',
        amount:       `₹${amount.toLocaleString()}`,
      }
    );
    console.log('[Email] ✅ Referrer notification email sent to', referrerEmail);
    return { ok: true };
  } catch (err) {
    const msg = err?.text || err?.message || 'Unknown error';
    console.error('[Email] ❌ Referrer notification email failed:', msg);
    return { ok: false, error: msg };
  }
}
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import {
  collection, query, where, onSnapshot, orderBy, limit,
  addDoc, updateDoc, doc, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { useAuth } from './AuthContext';

const NotifContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();

  // ── Notifications (visits, referrals, moved-in etc.) ─────────────────────────
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);

  // ── Unread CHAT messages count (separate from notifications) ─────────────────
  const [unreadMessages, setUnreadMessages] = useState(0);

  const prevVisitStatuses = useRef({});   // visitId → status (to detect changes)
  const prevMsgCount      = useRef(0);

  // ── Listen to Firestore notifications collection ─────────────────────────────
  useEffect(() => {
    if (!user) { setNotifs([]); setUnread(0); return; }

    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(30),
    );

    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifs(all);
      setUnread(all.filter(n => !n.read).length);
    }, () => {
      // Fallback demo notifs if index not yet created
      setNotifs([
        { id: 'd1', uid: user.uid, title: 'Welcome to RoomSync! 🎉', body: 'Complete your profile for better matches', type: 'info', read: false, createdAt: { toDate: () => new Date() } },
      ]);
      setUnread(1);
    });

    return unsub;
  }, [user]);

  // ── Real-time visit status watcher → push notification on change ─────────────
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'visits'), where('student_uid', '==', user.uid));
    const unsub = onSnapshot(q, async snap => {
      for (const d of snap.docs) {
        const v      = d.data();
        const prev   = prevVisitStatuses.current[d.id];
        const cur    = v.status;

        if (prev && prev !== cur) {
          // Status changed — push a notification
          let title = '', body = '', type = 'visit';

          if (cur === 'confirmed') {
            title = '✅ Visit Confirmed!';
            body  = `Your visit to "${v.room_title}" has been confirmed by the owner.`;
          } else if (cur === 'declined') {
            title = '❌ Visit Declined';
            body  = `Your visit to "${v.room_title}" was declined by the owner.`;
            type  = 'info';
          } else if (cur === 'moved_in') {
            title = '🔑 Shifted Confirmed!';
            body  = `Owner confirmed you moved into "${v.room_title}". Please pay ₹1,000 to your referrer.`;
            type  = 'referral';
          }

          if (title) {
            await pushNotif(user.uid, title, body, type);
            // Show browser notification
            if (Notification.permission === 'granted') {
              new Notification(title, { body, icon: '/favicon.ico' });
            }
          }
        }

        prevVisitStatuses.current[d.id] = cur;
      }
    }, () => {});

    return unsub;
  }, [user]);

  // ── Real-time OWNER visit watcher → notify owner of new pending visits ────────
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'visits'), where('owner_uid', '==', user.uid), where('status', '==', 'pending'));
    const prevCount = { n: -1 };

    const unsub = onSnapshot(q, async snap => {
      if (prevCount.n >= 0 && snap.size > prevCount.n) {
        // New visit request came in
        const newest = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0))[0];
        if (newest) {
          await pushNotif(
            user.uid,
            '📅 New Visit Request!',
            `${newest.student_name || 'A student'} wants to visit "${newest.room_title}" on ${newest.date} at ${newest.time}`,
            'visit'
          );
          if (Notification.permission === 'granted') {
            new Notification('📅 New Visit Request!', {
              body: `${newest.student_name || 'A student'} wants to visit "${newest.room_title}"`,
              icon: '/favicon.ico',
            });
          }
        }
      }
      prevCount.n = snap.size;
    }, () => {});

    return unsub;
  }, [user]);

  // ── Real-time referral moved_in watcher → notify referrer ───────────────────
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'referrals'),
      where('referrerId', '==', user.uid),
      where('status', '==', 'moved_in'),
    );
    const prevIds = new Set();

    const unsub = onSnapshot(q, async snap => {
      for (const d of snap.docs) {
        if (!prevIds.has(d.id)) {
          prevIds.add(d.id);
          if (prevIds.size > 1) { // Skip on initial load
            await pushNotif(
              user.uid,
              '💸 Your referral moved in!',
              `${d.data().referredEmail || 'Your friend'} moved in — you'll receive ₹1,000!`,
              'referral'
            );
            if (Notification.permission === 'granted') {
              new Notification('💸 Referral Payout!', {
                body: 'Your referred friend moved in. You will receive ₹1,000!',
                icon: '/favicon.ico',
              });
            }
          }
        }
      }
    }, () => {});

    return unsub;
  }, [user]);

  // ── Real-time UNREAD CHAT MESSAGES count ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Count messages in all chats that are unread by this user
    const q = query(
      collection(db, 'messages'),
      where('receiverId', '==', user.uid),
      where('read', '==', false),
    );

    const unsub = onSnapshot(q, snap => {
      const count = snap.size;
      if (prevMsgCount.current > 0 && count > prevMsgCount.current) {
        // New message arrived
        if (Notification.permission === 'granted') {
          const newest = snap.docs[snap.docs.length - 1]?.data();
          new Notification('💬 New Message', {
            body: newest?.text ? newest.text.slice(0, 60) : 'You have a new message',
            icon: '/favicon.ico',
          });
        }
      }
      prevMsgCount.current = count;
      setUnreadMessages(count);
    }, () => setUnreadMessages(0));

    return unsub;
  }, [user]);

  // ── Request browser notification permission ──────────────────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
    if (!user) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'notifications'),
        where('uid', '==', user.uid),
        where('read', '==', false),
      ));
      snap.docs.forEach(d => updateDoc(doc(db, 'notifications', d.id), { read: true }));
    } catch {}
  };

  const markRead = async (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
    try { await updateDoc(doc(db, 'notifications', id), { read: true }); } catch {}
  };

  const pushNotif = async (toUid, title, body, type = 'info') => {
    try {
      await addDoc(collection(db, 'notifications'), {
        uid: toUid, title, body, type,
        read: false, createdAt: serverTimestamp(),
      });
    } catch (e) { console.warn('[Notif]', e.message); }
  };

  return (
    <NotifContext.Provider value={{
      notifs, unread, unreadMessages,
      markAllRead, markRead, pushNotif,
    }}>
      {children}
    </NotifContext.Provider>
  );
}

export const useNotifications = () => useContext(NotifContext);
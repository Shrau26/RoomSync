/**
 * RoomSync Real-Time Chat — Fixed location sharing + all features
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import OnboardingTip from '../components/common/OnboardingTip';
import {
  Send, MessageSquare, Phone, Video, ArrowLeft,
  Search, Image as ImageIcon, MapPin, Check, CheckCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp, doc, setDoc, getDoc, getDocs,
  updateDoc, limit
} from 'firebase/firestore';
import toast from 'react-hot-toast';

const makeChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

const fmtTime = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const fmtConvoTime = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
};

function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-4 py-2.5 rounded-2xl rounded-tl-sm w-16"
      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)' }}>
      {[0,1,2].map(i => (
        <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ background: 'rgba(255,255,255,0.5)', animationDelay:`${i*0.15}s`}}/>
      ))}
    </div>
  );
}

function Bubble({ msg, isMe, showAvatar, avatar }) {
  return (
    <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mb-0.5 transition-opacity ${showAvatar ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
          {avatar}
        </div>
      )}
      <div className={`group max-w-[72%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-lg ${
          isMe
            ? 'text-white rounded-tr-sm'
            : 'text-white rounded-tl-sm'}`}
          style={isMe
            ? { background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }
            : { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {msg.type === 'location' ? (
            <a href={msg.mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 underline underline-offset-2"
              style={{ color: '#93c5fd' }}>
              <MapPin size={13}/>
              <span>📍 View my location on Google Maps</span>
            </a>
          ) : msg.type === 'image' && msg.imageUrl ? (
            <img src={msg.imageUrl} alt="shared" className="max-w-[200px] rounded-xl mb-1"/>
          ) : (
            <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
          )}
          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] opacity-50">{fmtTime(msg.createdAt)}</span>
            {isMe && (msg.read
              ? <CheckCheck size={11} style={{ color: '#93c5fd', opacity: 0.8 }}/>
              : <Check size={11} className="opacity-40"/>
            )}
          </div>
        </div>
      </div>
      {isMe && <div className="w-7 shrink-0"/>}
    </div>
  );
}

function ConvoItem({ convo, active, onClick }) {
  return (
    <button onClick={onClick}
      className="w-full text-left px-4 py-3.5 transition-all relative"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent',
      }}>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
            {convo.avatar || convo.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
            style={{ background: '#22c55e', borderColor: '#1a1545' }}/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-semibold text-sm truncate text-white">{convo.name}</span>
            <span className="text-[10px] shrink-0 ml-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {fmtConvoTime(convo.lastUpdated)}
            </span>
          </div>
          <p className="text-xs truncate" style={{ color: convo.unread > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}>
            {convo.lastMessage || 'Start a conversation'}
          </p>
        </div>
        {convo.unread > 0 && (
          <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center shrink-0 font-bold text-white"
            style={{ background: '#3b82f6' }}>
            {convo.unread}
          </span>
        )}
      </div>
    </button>
  );
}

export default function ChatPage({ initialContact }) {
  const { user, profile } = useAuth();
  const [convos,      setConvos]      = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [search,      setSearch]      = useState('');
  const [sending,     setSending]     = useState(false);
  const [firebaseOk,  setFirebaseOk]  = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const fileRef    = useRef(null);
  const msgUnsub   = useRef(null);
  const [mobileView, setMobileView] = useState('list');

  const chatId = activeConvo && user
    ? makeChatId(user.uid, activeConvo.uid || activeConvo.id)
    : null;

  // Load conversations
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'chats'));
        const myChats = snap.docs
          .filter(d => d.id.includes(user.uid))
          .map(d => ({ id: d.id, ...d.data() }));
        const processed = myChats.map(chat => {
          const parts = chat.id.split('_');
          const otherUid = parts.find(p => p !== user.uid) || parts[1];
          return {
            id:          chat.id,
            uid:         otherUid,
            name:        chat['name_' + otherUid] || 'Unknown',
            avatar:      (chat['name_' + otherUid] || 'U').charAt(0).toUpperCase(),
            lastMessage: chat.lastMessage || '',
            lastUpdated: chat.lastUpdated,
            unread:      chat['unread_' + user.uid] || 0,
          };
        });
        setConvos(processed);
        setFirebaseOk(true);
      } catch (e) {
        console.warn('[Chat]', e.message);
        setFirebaseOk(false);
      }
    })();
  }, [user]);

  // Open from contact button (Browse Rooms / Students)
  useEffect(() => {
    if (!initialContact || !user) return;
    const convo = {
      id:     makeChatId(user.uid, initialContact.id),
      uid:    initialContact.id,
      name:   initialContact.name || 'User',
      avatar: (initialContact.name || 'U').charAt(0).toUpperCase(),
      lastMessage: '',
      unread: 0,
    };
    setConvos(prev => prev.find(c => c.id === convo.id) ? prev : [convo, ...prev]);
    setActiveConvo(convo);
    setMobileView('chat');
  }, [initialContact, user]);

  // Real-time messages
  useEffect(() => {
    if (msgUnsub.current) { msgUnsub.current(); msgUnsub.current = null; }
    if (!chatId || !user) { setMessages([]); return; }
    setMessages([]);
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt','asc'), limit(200));
    msgUnsub.current = onSnapshot(q,
      snap => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setFirebaseOk(true);
        if (activeConvo) {
          updateDoc(doc(db,'chats',chatId), { [`unread_${user.uid}`]: 0 }).catch(()=>{});
        }
      },
      err => { console.warn('[Msg]', err.message); setFirebaseOk(false); }
    );
    return () => { if (msgUnsub.current) msgUnsub.current(); };
  }, [chatId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text, type = 'text', extra = {}) => {
    if (!text?.trim() && type === 'text') return;
    if (!user || !activeConvo || !chatId) return;
    setSending(true);
    setInput('');

    const msgData = {
      text: text.trim(),
      senderId: user.uid,
      senderName: profile?.name || user.email || 'User',
      type,
      createdAt: serverTimestamp(),
      read: false,
      ...extra,
    };

    // Optimistic UI
    setMessages(prev => [...prev, { ...msgData, id: 'opt_'+Date.now(), createdAt: { toDate: ()=>new Date() } }]);

    try {
      await addDoc(collection(db,'chats',chatId,'messages'), msgData);
      const otherUid = activeConvo.uid || activeConvo.id;
      const chatDoc = await getDoc(doc(db,'chats',chatId)).catch(()=>null);
      const curUnread = chatDoc?.data()?.[`unread_${otherUid}`] || 0;
      await setDoc(doc(db,'chats',chatId), {
        lastMessage:             text.trim().substring(0,60),
        lastUpdated:             serverTimestamp(),
        [`unread_${otherUid}`]:  curUnread + 1,
        [`name_${user.uid}`]:    profile?.name || 'User',
        [`name_${otherUid}`]:    activeConvo.name,
        participants:            [user.uid, otherUid],
      }, { merge: true });
      setConvos(prev => prev.map(c =>
        c.id === chatId ? { ...c, lastMessage: text.trim().substring(0,60), lastUpdated: new Date() } : c
      ));
      setFirebaseOk(true);
    } catch (err) {
      console.error('[Send]', err.message);
      if (err.code === 'permission-denied') {
        toast.error('Firebase permission denied — update Firestore Rules');
      }
    } finally { setSending(false); }
  }, [user, activeConvo, chatId, profile]);

  // ── FIXED: Location sharing sends real Google Maps link ──
  const shareLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported on this device');
      return;
    }
    const t = toast.loading('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss(t);
        const { latitude: lat, longitude: lng } = pos.coords;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        sendMessage('📍 Location shared', 'location', { mapsUrl, lat, lng });
        toast.success('Location sent! ✅');
      },
      (err) => {
        toast.dismiss(t);
        if (err.code === 1) toast.error('Location permission denied — allow in browser settings');
        else if (err.code === 2) toast.error('Location unavailable — try again');
        else toast.error('Could not get location');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => sendMessage('[Photo]', 'image', { imageUrl: ev.target.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const openConvo = (c) => {
    setActiveConvo(c);
    setMobileView('chat');
    setMessages([]);
    setConvos(prev => prev.map(x => x.id===c.id ? {...x,unread:0} : x));
  };

  const filteredConvos = convos.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-enter h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <MessageSquare size={22} className="text-blue-400"/>Messages
        </h1>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
          style={firebaseOk
            ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }
            : { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
          <div className={`w-2 h-2 rounded-full ${firebaseOk ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`}/>
          {firebaseOk ? 'Live — real-time sync active' : 'Configure Firebase for live chat'}
        </div>
      </div>

      <div className="glass overflow-hidden rounded-3xl flex-1" style={{ height:'calc(100vh - 210px)', minHeight: 520 }}>
        <div className="flex h-full">

          {/* Conversation list */}
          <div className={`w-full sm:w-72 lg:w-80 flex flex-col shrink-0 ${mobileView==='chat' ? 'hidden sm:flex' : 'flex'}`}
            style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.35)' }}/>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="input-field text-sm py-2.5 pl-9"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredConvos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                  <MessageSquare size={36} style={{ color: 'rgba(255,255,255,0.2)' }}/>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    No conversations yet.{'\n'}Contact an owner from Browse Rooms!
                  </p>
                </div>
              ) : filteredConvos.map(c => (
                <ConvoItem key={c.id} convo={c} active={activeConvo?.id===c.id} onClick={()=>openConvo(c)}/>
              ))}
            </div>
            <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Contact owners from Browse Rooms to start chatting
              </p>
            </div>
          </div>

          {/* Chat area */}
          <div className={`flex-1 flex flex-col min-w-0 ${mobileView==='list' ? 'hidden sm:flex' : 'flex'}`}>
            {activeConvo ? (
              <>
                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
                  <button onClick={()=>setMobileView('list')} className="sm:hidden p-1.5 rounded-xl hover:bg-white/10">
                    <ArrowLeft size={18}/>
                  </button>
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
                      {activeConvo.avatar || activeConvo.name?.charAt(0)}
                    </div>
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                      style={{ background: '#22c55e', borderColor: '#1a1545' }}/>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-white">{activeConvo.name}</p>
                    <p className="text-[11px]" style={{ color: '#4ade80' }}>
                      {firebaseOk ? 'Online · messages sync live' : 'Connecting...'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-2 rounded-xl transition-colors hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <Phone size={17}/>
                    </button>
                    <button className="p-2 rounded-xl transition-colors hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <Video size={17}/>
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(99,102,241,0.1)' }}>
                        <MessageSquare size={28} style={{ color: 'rgba(255,255,255,0.25)' }}/>
                      </div>
                      <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Start the conversation!<br/>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>Ask about the room, visit time, or rent</span>
                      </p>
                    </div>
                  )}
                  {messages.map((msg, i) => {
                    const isMe = msg.senderId === user?.uid;
                    const prev = messages[i-1];
                    const showAvatar = !isMe && (!prev || prev.senderId !== msg.senderId);
                    return <Bubble key={msg.id} msg={msg} isMe={isMe} showAvatar={showAvatar}
                      avatar={activeConvo.avatar || activeConvo.name?.charAt(0)}/>;
                  })}
                  <div ref={bottomRef}/>
                </div>

                {/* Input */}
                <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-end gap-2">
                    <div className="flex gap-1 shrink-0">
                      <button onClick={()=>fileRef.current?.click()}
                        className="p-2.5 rounded-xl transition-colors hover:bg-white/10"
                        style={{ color: 'rgba(255,255,255,0.5)' }} title="Send photo">
                        <ImageIcon size={18}/>
                      </button>
                      <button onClick={shareLocation}
                        className="p-2.5 rounded-xl transition-colors hover:bg-white/10"
                        style={{ color: 'rgba(255,255,255,0.5)' }} title="Share location">
                        <MapPin size={18}/>
                      </button>
                    </div>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e=>setInput(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(input);}}}
                      placeholder="Type a message... (Enter to send)"
                      rows={1}
                      className="input-field flex-1 py-3 text-sm resize-none"
                      style={{ maxHeight: 120, overflowY: 'auto' }}
                      onInput={e=>{ e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
                    />
                    <button
                      onClick={()=>sendMessage(input)}
                      disabled={!input.trim()||sending}
                      className="p-3 rounded-2xl transition-all shrink-0"
                      style={input.trim()
                        ? { background: 'linear-gradient(135deg,#2563eb,#7c3aed)', boxShadow: '0 4px 15px rgba(37,99,235,0.4)' }
                        : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                      <Send size={18} className="text-white"/>
                    </button>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange}/>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.08)' }}>
                  <MessageSquare size={36} style={{ color: 'rgba(255,255,255,0.2)' }}/>
                </div>
                <div className="text-center">
                  <p className="font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Select a conversation</p>
                  <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.22)' }}>Or contact an owner from Browse Rooms</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

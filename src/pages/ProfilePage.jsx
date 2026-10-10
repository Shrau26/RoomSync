import { useState, useEffect } from 'react';
import { Camera, Save, User, Home, Brain, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../services/userService';
import toast from 'react-hot-toast';
import OnboardingTip from '../components/common/OnboardingTip';

const YEARS  = ['FY','SY','TY','Final Year'];
const SLEEP  = ['Early Bird','Night Owl','Flexible'];
const STUDY  = ['Silent Study','Group Study','Both'];
const ROLES  = [
  { label: 'Looking for Room',    value: 'student_need_room' },
  { label: 'Have a Room',         value: 'student_have_room' },
  { label: 'Looking for Roommate',value: 'student_have_room' },
  { label: 'Room Owner',          value: 'owner'             },
];
const DIET   = ['Veg','Non-Veg','Eggetarian','Vegan'];
const SMOKE  = ['No','Occasionally','Yes'];
const GUESTS = ['Rarely','Sometimes','Often'];
const OCEAN  = [
  { key:'openness',          label:'I enjoy new experiences and exploring new ideas', trait:'Openness (O)' },
  { key:'conscientiousness', label:'I am organized, disciplined and hardworking',      trait:'Conscientiousness (C)' },
  { key:'extraversion',      label:'I enjoy socializing and being around people',      trait:'Extraversion (E)' },
  { key:'agreeableness',     label:'I am cooperative and considerate of others',       trait:'Agreeableness (A)' },
  { key:'neuroticism',       label:'I often feel anxious or emotionally stressed',     trait:'Neuroticism (N)' },
];

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    name:'', college:'', year:'', phone:'', bio:'', role:'student_need_room',
    budget_min:'', budget_max:'', sleep_schedule:'', study_type:'', cleanliness:3,
    diet:'Veg', smoking:'No', guests:'Sometimes',
    openness:3, conscientiousness:3, extraversion:3, agreeableness:3, neuroticism:3,
  });
  const [imgPreview, setImgPreview] = useState(null);
  const [imgFile,    setImgFile]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [tab,        setTab]        = useState('basic');

  const completionFields = [
    form.name, form.college, form.year, form.phone, form.bio,
    form.sleep_schedule, form.study_type, imgPreview || profile?.profile_image_url,
    form.openness !== 3 || form.conscientiousness !== 3,
  ];
  const completionPct = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  useEffect(() => {
    if (profile) {
      setForm({
        name:             profile.name            || '',
        college:          profile.college         || '',
        year:             profile.year            || '',
        phone:            profile.phone           || '',
        bio:              profile.bio             || '',
        role:             profile.role            || 'student_need_room',
        budget_min:       profile.budget?.min     || '',
        budget_max:       profile.budget?.max     || '',
        sleep_schedule:   profile.sleep_schedule  || '',
        study_type:       profile.study_type      || '',
        cleanliness:      profile.cleanliness     || 3,
        diet:             profile.diet            || 'Veg',
        smoking:          profile.smoking         || 'No',
        guests:           profile.guests          || 'Sometimes',
        openness:         profile.openness        || 3,
        conscientiousness:profile.conscientiousness || 3,
        extraversion:     profile.extraversion    || 3,
        agreeableness:    profile.agreeableness   || 3,
        neuroticism:      profile.neuroticism     || 3,
      });
      setImgPreview(profile.profile_image_url || null);
    }
  }, [profile]);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setImgFile(file);
    setImgPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user)          return toast.error('Not logged in');
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);

    try {
      let imageUrl = profile?.profile_image_url || '';

      // Upload image to Cloudinary if selected
      if (imgFile) {
        const CLOUD   = 'dkmpxqwft';
        const PRESET  = 'roomsync_preset';
        if (CLOUD === 'YOUR_CLOUD_NAME') {
          toast('Profile photo not saved — configure Cloudinary. See SETUP_GUIDE.txt', { icon:'⚠️', duration:5000 });
        } else {
          try {
            toast.loading('Uploading photo...', { id:'img' });
            const fd = new FormData();
            fd.append('file', imgFile);
            fd.append('upload_preset', PRESET);
            fd.append('folder', 'roomsync/profiles');
            const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method:'POST', body:fd });
            const data = await res.json();
            if (data.secure_url) { imageUrl = data.secure_url; toast.success('Photo uploaded!', { id:'img' }); }
            else throw new Error(data.error?.message);
          } catch (imgErr) {
            toast.error('Photo upload failed: ' + imgErr.message, { id:'img' });
          }
        }
      }

      // Save profile to Firestore
      await updateUserProfile(user.uid, {
        name:              form.name.trim(),
        college:           form.college.trim(),
        year:              form.year,
        phone:             form.phone.trim(),
        bio:               form.bio.trim(),
        role:              form.role,
        budget:            { min: Number(form.budget_min) || 0, max: Number(form.budget_max) || 0 },
        sleep_schedule:    form.sleep_schedule,
        study_type:        form.study_type,
        cleanliness:       Number(form.cleanliness),
        diet:              form.diet,
        smoking:           form.smoking,
        guests:            form.guests,
        openness:          Number(form.openness),
        conscientiousness: Number(form.conscientiousness),
        extraversion:      Number(form.extraversion),
        agreeableness:     Number(form.agreeableness),
        neuroticism:       Number(form.neuroticism),
        profile_image_url: imageUrl,
      });

      await refreshProfile();
      toast.success('Profile saved successfully! ✅');
    } catch (err) {
      console.error('[Profile Save Error]', err);
      if (err.code === 'permission-denied') {
        toast.error('Permission denied — check Firestore rules in Firebase Console');
      } else {
        toast.error('Save failed: ' + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const Chip = ({ label, active, onClick, color='blue' }) => (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${
        active ? `bg-${color}-600/60 border-${color}-400/60 text-white`
               : 'bg-white/5 border-white/20 text-white/60 hover:border-white/40'}`}>
      {label}
    </button>
  );

  const TabBtn = ({ id, label, icon:Icon }) => (
    <button type="button" onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
        tab===id ? 'bg-blue-600/60 text-white border border-blue-400/40'
                 : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
      <Icon size={15}/>{label}
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-enter">
      <div>
        <h1 className="font-display text-2xl font-bold">My Profile</h1>
        <p className="text-white/50 text-sm mt-1">Complete profile improves AI roommate match accuracy</p>
        {/* Profile completion bar */}
        <div className="mt-3 p-3 rounded-2xl flex items-center gap-3"
          style={{background: completionPct === 100 ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                  border: `1px solid ${completionPct === 100 ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.25)'}`}}>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold" style={{color: completionPct === 100 ? '#34d399' : '#818cf8'}}>
                {completionPct === 100 ? '✅ Profile Complete!' : `Profile ${completionPct}% complete`}
              </span>
              <span className="text-xs" style={{color:'rgba(255,255,255,0.4)'}}>{completionPct}/100%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.1)'}}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{width:`${completionPct}%`,
                        background: completionPct === 100
                          ? 'linear-gradient(90deg,#10b981,#34d399)'
                          : 'linear-gradient(90deg,#6366f1,#8b5cf6)'}}/>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Avatar + Role Card */}
        <div className="glass p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-3xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl">
              {imgPreview
                ? <img src={imgPreview} alt="Profile" className="w-full h-full object-cover"/>
                : <User size={36} className="text-white/60"/>}
            </div>
            <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-500 hover:bg-blue-400 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors">
              <Camera size={14} className="text-white"/>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange}/>
            </label>
          </div>
          <div className="flex-1 w-full space-y-3">
            <input value={form.name} onChange={e => set('name',e.target.value)}
              placeholder="Your full name *" className="input-field text-lg font-semibold"/>
            <div>
              <p className="text-xs text-white/50 mb-2">I am currently...</p>
              <div className="flex flex-wrap gap-2">
                {ROLES.map(r => (
                  <button key={r.value} type="button" onClick={() => set('role', r.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs border font-medium transition-all ${
                      form.role===r.value
                        ? r.value==='student_need_room' ? 'bg-blue-600/60 border-blue-400/60 text-white'
                          : r.value==='owner'           ? 'bg-green-600/60 border-green-400/60 text-white'
                          : 'bg-purple-600/60 border-purple-400/60 text-white'
                        : 'bg-white/5 border-white/20 text-white/60 hover:border-white/40'}`}>
                    {r.value==='student_need_room'?'🔍 ':r.value==='owner'?'🏠 ':'👥 '}{r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          <TabBtn id="basic"       label="Basic Info"    icon={User}/>
          <TabBtn id="lifestyle"   label="Lifestyle"     icon={Home}/>
          <TabBtn id="personality" label="Big Five Test" icon={Brain}/>
        </div>

        {/* Basic Info */}
        {tab==='basic' && (
          <div className="glass p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label text-xs">College / University</label>
                <input value={form.college} onChange={e=>set('college',e.target.value)} placeholder="Mumbai University" className="input-field"/>
              </div>
              <div>
                <label className="form-label text-xs">Year</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {YEARS.map(y => <Chip key={y} label={y} active={form.year===y} onClick={()=>set('year',y)}/>)}
                </div>
              </div>
            </div>
            <div>
              <label className="form-label text-xs">Phone</label>
              <input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91 9876543210" className="input-field" type="tel"/>
            </div>
            <div>
              <label className="form-label text-xs">Bio</label>
              <textarea value={form.bio} onChange={e=>set('bio',e.target.value)}
                placeholder="Tell potential roommates about yourself..." rows={3} className="input-field resize-none"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label text-xs">Min Budget (Rs/mo)</label>
                <input type="number" value={form.budget_min} onChange={e=>set('budget_min',e.target.value)} placeholder="5000" className="input-field"/>
              </div>
              <div>
                <label className="form-label text-xs">Max Budget (Rs/mo)</label>
                <input type="number" value={form.budget_max} onChange={e=>set('budget_max',e.target.value)} placeholder="10000" className="input-field"/>
              </div>
            </div>
          </div>
        )}

        {/* Lifestyle */}
        {tab==='lifestyle' && (
          <div className="glass p-6 space-y-5">
            {[
              ['Sleep Schedule',SLEEP,'sleep_schedule'],
              ['Study Preference',STUDY,'study_type'],
              ['Diet',DIET,'diet'],
              ['Smoking',SMOKE,'smoking'],
              ['Guests Frequency',GUESTS,'guests'],
            ].map(([label,opts,key]) => (
              <div key={key}>
                <label className="form-label text-xs">{label}</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {opts.map(o => <Chip key={o} label={o} active={form[key]===o} onClick={()=>set(key,o)}/>)}
                </div>
              </div>
            ))}
            <div>
              <label className="form-label text-xs">Cleanliness: {form.cleanliness}/5</label>
              <input type="range" min="1" max="5" value={form.cleanliness}
                onChange={e => set('cleanliness',e.target.value)} className="w-full mt-2 accent-blue-500"/>
              <div className="flex justify-between text-[10px] text-white/40 mt-1">
                <span>Relaxed</span><span>Moderate</span><span>Very Clean</span>
              </div>
            </div>
          </div>
        )}

        {/* Big Five OCEAN */}
        {tab==='personality' && (
          <div className="glass p-6 space-y-5">
            <div className="glass-dark p-4 rounded-2xl">
              <p className="text-sm font-semibold text-blue-300 flex items-center gap-2 mb-1">
                <Brain size={16}/> Big Five Personality Test (OCEAN)
              </p>
              <p className="text-white/50 text-xs">Rate 1–5 for each trait. Our AI uses this for more accurate roommate matching.</p>
            </div>
            {OCEAN.map(q => (
              <div key={q.key}>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm text-white/80 flex-1 pr-4">{q.label}</label>
                  <span className="text-blue-300 font-bold text-sm shrink-0">{form[q.key]}/5</span>
                </div>
                <input type="range" min="1" max="5" step="0.5" value={form[q.key]}
                  onChange={e => set(q.key, e.target.value)} className="w-full accent-blue-500"/>
                <div className="flex justify-between text-[10px] mt-0.5">
                  <span className="text-white/30">Strongly Disagree</span>
                  <span className="text-blue-400/70 font-medium">{q.trait}</span>
                  <span className="text-white/30">Strongly Agree</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base">
          {saving
            ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving...</>
            : <><Save size={18}/>Save Profile</>}
        </button>
      </form>
    </div>
  );
}

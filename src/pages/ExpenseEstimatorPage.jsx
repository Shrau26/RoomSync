import { useState } from 'react';
import { Calculator, MapPin, TrendingUp } from 'lucide-react';

const FIELDS=[
  {key:'rent',label:'Room Rent',placeholder:'8000',icon:'🏠',color:'blue'},
  {key:'mess',label:'Mess / Food',placeholder:'3000',icon:'🍱',color:'green'},
  {key:'travel',label:'Travel to College',placeholder:'1500',icon:'🚌',color:'yellow'},
  {key:'electricity',label:'Electricity Bill',placeholder:'500',icon:'💡',color:'orange'},
  {key:'maintenance',label:'Maintenance Charges',placeholder:'300',icon:'🔧',color:'red'},
  {key:'internet',label:'Internet / Mobile',placeholder:'500',icon:'📶',color:'purple'},
  {key:'laundry',label:'Laundry',placeholder:'300',icon:'👕',color:'pink'},
  {key:'misc',label:'Miscellaneous',placeholder:'1000',icon:'🛒',color:'gray'},
];
const COLOR_CLS={
  blue:'bg-blue-500/20 text-blue-300',green:'bg-green-500/20 text-green-300',
  yellow:'bg-yellow-500/20 text-yellow-300',orange:'bg-orange-500/20 text-orange-300',
  red:'bg-red-500/20 text-red-300',purple:'bg-purple-500/20 text-purple-300',
  pink:'bg-pink-500/20 text-pink-300',gray:'bg-white/10 text-white/60',
};
const BAR_CLS={
  blue:'from-blue-500 to-blue-400',green:'from-green-500 to-green-400',
  yellow:'from-yellow-500 to-yellow-400',orange:'from-orange-500 to-orange-400',
  red:'from-red-500 to-red-400',purple:'from-purple-500 to-purple-400',
  pink:'from-pink-500 to-pink-400',gray:'from-white/40 to-white/20',
};
const TIPS=[
  {icon:'🍱',tip:'Cook at home 3x/week to cut food cost by Rs.1000+'},
  {icon:'🚌',tip:'Monthly bus/metro pass saves 30-40% on travel'},
  {icon:'💡',tip:'LED bulbs and unplugging devices cut electricity by 20%'},
  {icon:'🤝',tip:'Split internet with roommate - saves Rs.300/month each'},
  {icon:'🏠',tip:'Room closer to college reduces travel cost significantly'},
  {icon:'📦',tip:'Buy groceries in bulk monthly - saves 15-20%'},
];

export default function ExpenseEstimatorPage(){
  const [values,setValues]=useState({});
  const [distance,setDistance]=useState('');
  const [messDistance,setMessDistance]=useState('');
  const [city,setCity]=useState('Mumbai');

  const total=FIELDS.reduce((s,f)=>s+(Number(values[f.key])||0),0);
  const pct=(key)=>total>0?((Number(values[key])||0)/total*100).toFixed(1):0;

  const suggestTravel=(km)=>{
    const k=Number(km); if(!k) return;
    setValues(v=>({...v,travel:Math.round(k*2*25*5)}));
  };
  const cityMult={Mumbai:1.3,Pune:1.0,Thane:1.1,'Navi Mumbai':1.05,Other:1.0};
  const adjusted=Math.round(total*(cityMult[city]||1.0));

  return(
    <div className="max-w-3xl mx-auto space-y-6 page-enter">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Calculator size={22} className="text-green-400"/>Monthly Expense Estimator
        </h1>
        <p className="text-white/50 text-sm mt-1">Calculate your complete monthly student living cost</p>
      </div>

      <div className="glass p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="form-label text-xs">City</label>
          <select value={city} onChange={e=>setCity(e.target.value)} className="input-field mt-1">
            {Object.keys(cityMult).map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label text-xs flex items-center gap-1"><MapPin size={11}/>Room to College (km)</label>
          <input type="number" value={distance} onChange={e=>{setDistance(e.target.value);suggestTravel(e.target.value);}} placeholder="e.g. 5" className="input-field mt-1"/>
          {distance&&<p className="text-xs text-green-400 mt-1">Est: Rs.{Math.round(Number(distance)*2*25*5)}/mo</p>}
        </div>
        <div>
          <label className="form-label text-xs">Room to Mess (km)</label>
          <input type="number" value={messDistance} onChange={e=>setMessDistance(e.target.value)} placeholder="e.g. 0.5" className="input-field mt-1"/>
          {messDistance&&<p className="text-xs text-blue-400 mt-1">{Number(messDistance)<1?'Walking distance':'About '+Math.round(Number(messDistance)*10)+' min walk'}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-6 space-y-3">
          <h2 className="font-display font-semibold mb-2">Enter Your Costs</h2>
          {FIELDS.map(f=>(
            <div key={f.key} className="flex items-center gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${COLOR_CLS[f.color]}`}>{f.icon}</span>
              <div className="flex-1">
                <p className="text-xs text-white/60 mb-1">{f.label}</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">Rs.</span>
                  <input type="number" value={values[f.key]||''} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}
                    placeholder={f.placeholder} className="input-field pl-9 py-2 text-sm"/>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="glass p-6 text-center">
            <p className="text-white/50 text-sm mb-1">Monthly Total</p>
            <p className="font-display text-4xl font-bold gradient-text">Rs.{total.toLocaleString()}</p>
            {city!=='Pune'&&city!=='Other'&&total>0&&<p className="text-white/40 text-xs mt-1">~Rs.{adjusted.toLocaleString()} adjusted for {city}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[['Per Day','Rs.'+Math.round(total/30).toLocaleString()],['Per Week','Rs.'+Math.round(total/4).toLocaleString()],['Per Year','Rs.'+(total*12).toLocaleString()]].map(([l,v])=>(
                <div key={l} className="glass-dark p-2 rounded-xl text-center">
                  <p className="text-[10px] text-white/40">{l}</p>
                  <p className="font-bold text-xs">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {total>0&&(
            <div className="glass p-5 space-y-2.5">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Breakdown</p>
              {FIELDS.filter(f=>Number(values[f.key])>0).map(f=>(
                <div key={f.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/70">{f.icon} {f.label}</span>
                    <span className="font-semibold">Rs.{Number(values[f.key]).toLocaleString()} ({pct(f.key)}%)</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${BAR_CLS[f.color]} rounded-full transition-all duration-500`} style={{width:pct(f.key)+'%'}}/>
                  </div>
                </div>
              ))}
            </div>
          )}

          {total>0&&(
            <div className={`glass p-4 rounded-2xl border ${total<8000?'border-green-500/30 bg-green-500/5':total<15000?'border-yellow-500/30 bg-yellow-500/5':'border-red-500/30 bg-red-500/5'}`}>
              <p className="text-xs font-semibold mb-1">{total<8000?'Budget-Friendly':total<15000?'Moderate Budget':'High Budget'}</p>
              <p className="text-white/60 text-xs">{total<8000?'Great! Managing expenses well for a student.':total<15000?'Consider reducing food or travel costs.':'Look for shared accommodation or rooms closer to college.'}</p>
            </div>
          )}
        </div>
      </div>

      <div className="glass p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-green-400"/>Money-Saving Tips</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {TIPS.map((t,i)=>(
            <div key={i} className="glass-dark p-3 rounded-xl flex items-start gap-2">
              <span className="text-base shrink-0">{t.icon}</span>
              <p className="text-white/60 text-xs leading-relaxed">{t.tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

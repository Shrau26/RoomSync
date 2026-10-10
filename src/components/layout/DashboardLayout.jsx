import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useTheme } from '../../context/ThemeContext';

// Floating background particles
function BgParticles({ dark }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Blobs */}
      {[
        { size:400, top:'-10%', left:'-8%',  color:dark?'rgba(79,70,229,0.15)':'rgba(79,70,229,0.07)',   d:10 },
        { size:350, bottom:'-8%',right:'-6%', color:dark?'rgba(124,58,237,0.12)':'rgba(124,58,237,0.06)', d:8  },
        { size:280, top:'40%',  left:'45%',  color:dark?'rgba(6,182,212,0.08)':'rgba(6,182,212,0.05)',   d:12 },
        { size:200, top:'20%',  right:'15%', color:dark?'rgba(16,185,129,0.08)':'rgba(16,185,129,0.04)', d:15 },
      ].map((b, i) => (
        <div key={i} className="absolute rounded-full"
          style={{ width:b.size, height:b.size, top:b.top, bottom:b.bottom,
                   left:b.left, right:b.right, background:b.color,
                   filter:'blur(60px)', animation:`blobFloat ${b.d}s ease-in-out infinite`,
                   animationDelay:`${i*2.5}s` }}/>
      ))}
      {/* Grid overlay */}
      <div className="absolute inset-0" style={{
        backgroundImage: dark
          ? 'radial-gradient(rgba(79,70,229,0.08) 1px, transparent 1px)'
          : 'radial-gradient(rgba(79,70,229,0.05) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}/>
      {/* Sparkle dots */}
      {[...Array(12)].map((_,i) => (
        <div key={i} className="absolute rounded-full"
          style={{ width:3, height:3, top:`${5+i*8}%`, left:`${3+i*8}%`,
                   background: dark ? 'rgba(167,139,250,0.4)' : 'rgba(79,70,229,0.25)',
                   animation:`sparkle ${2+i*0.5}s ease-in-out infinite`,
                   animationDelay:`${i*0.3}s` }}/>
      ))}
    </div>
  );
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { dark } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden"
      style={{ background: dark ? 'var(--bg)' : 'var(--bg)' }}>

      <BgParticles dark={dark}/>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden"
          style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}/>
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:relative z-40 h-full w-60 transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: dark ? 'rgba(10,9,30,0.95)' : 'rgba(255,255,255,0.92)',
                 backdropFilter:'blur(24px)', borderRight:'1px solid var(--border)' }}>
        <Sidebar onClose={() => setSidebarOpen(false)}/>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative z-10">
        <Topbar onMenuClick={() => setSidebarOpen(true)}/>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            <Outlet/>
          </div>
        </main>
      </div>
    </div>
  );
}

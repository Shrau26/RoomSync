// Shared auth page background layout
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden
                    bg-gradient-to-br from-[#0f0c29] via-[#1a1545] to-[#24243e]">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-600/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl animate-float" />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                          bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl shadow-purple-500/30 mb-4">
            <span className="text-2xl font-display font-black text-white">R</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-white">RoomSync</h1>
          <p className="text-white/50 text-sm mt-1">Find Rooms. Find Roommates. Find Comfort.</p>
        </div>
        {children}
      </div>
    </div>
  );
}

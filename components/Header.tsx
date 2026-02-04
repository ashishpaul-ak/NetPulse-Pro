
import React from 'react';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenDesktopExport?: () => void;
  engineMode?: 'native' | 'simulated';
}

export const Header: React.FC<HeaderProps> = ({ theme, onToggleTheme, onOpenDesktopExport, engineMode = 'simulated' }) => {
  return (
    <header className={`border-b backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100/80 border-slate-300'}`}>
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
          <i className="fas fa-network-wired text-white text-xl"></i>
        </div>
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            NetPulse <span className="text-blue-500">Pro</span>
          </h1>
          <p className="text-[10px] text-blue-500/80 font-bold uppercase tracking-[0.2em]">Diagnostic Terminal</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Connection Engine Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${engineMode === 'native' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${engineMode === 'native' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
          <span className="text-[9px] font-black uppercase tracking-widest">{engineMode === 'native' ? 'Native Engine' : 'Simulation Mode'}</span>
        </div>

        <button 
          onClick={onOpenDesktopExport}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all border ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
          title="Export for Desktop"
        >
          <i className="fab fa-windows text-blue-500"></i>
          <span className="hidden sm:inline">Build Client</span>
        </button>
        <button 
          onClick={onToggleTheme}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
          title="Toggle Light/Dark Mode"
        >
          <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
      </div>
    </header>
  );
};

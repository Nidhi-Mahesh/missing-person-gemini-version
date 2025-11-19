
import React from 'react';
import { UserPlus, Users, ScanEye, ShieldAlert } from 'lucide-react';
import { AppView } from '../types';

interface NavbarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setView }) => {
  const navItems = [
    { id: AppView.REPORT, label: 'Report Missing', icon: UserPlus },
    { id: AppView.DIRECTORY, label: 'Directory', icon: Users },
    { id: AppView.SCAN, label: 'Active Scan', icon: ScanEye },
  ];

  return (
    <nav className="w-20 lg:w-64 bg-slate-900 border-r border-slate-800 h-screen flex flex-col justify-between shrink-0 transition-all duration-300">
      <div>
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
          <ShieldAlert className="w-8 h-8 text-neon-blue" />
          <span className="hidden lg:block ml-3 text-xl font-bold tracking-wider text-white">SENTINEL</span>
        </div>

        <div className="py-6 flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`
                  h-12 flex items-center px-4 mx-2 rounded-lg transition-all duration-200 group
                  ${isActive 
                    ? 'bg-neon-blue/10 text-neon-blue shadow-[0_0_15px_rgba(14,165,233,0.3)]' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'animate-pulse' : ''}`} />
                <span className="hidden lg:block ml-3 font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-blue shadow-[0_0_10px_#0ea5e9]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="hidden lg:block p-4 rounded-xl bg-slate-950/50 border border-slate-800">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">System Status</h4>
            <div className="flex items-center gap-2 text-xs text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Gemini Vision v2.5 Online
            </div>
        </div>
      </div>
    </nav>
  );
};

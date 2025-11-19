import React from 'react';
import { Person, AppView } from '../types';
import { Activity, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface HomeProps {
  people: Person[];
  setView: (view: AppView) => void;
}

export const Home: React.FC<HomeProps> = ({ people, setView }) => {
  const missingCount = people.filter(p => p.status === 'MISSING').length;
  const foundCount = people.filter(p => p.status === 'FOUND').length;

  const data = [
    { name: 'Missing', value: missingCount, color: '#f43f5e' },
    { name: 'Found', value: foundCount, color: '#10b981' },
    { name: 'Sighted', value: people.filter(p => p.status === 'SIGHTED').length, color: '#fbbf24' },
  ];

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Command Dashboard</h1>
        <p className="text-slate-400">Real-time overview of active search operations.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 font-medium">Active Cases</span>
            <AlertTriangle className="text-neon-red w-5 h-5" />
          </div>
          <div className="text-4xl font-bold text-white mb-1">{missingCount}</div>
          <div className="text-xs text-slate-500">Priority High</div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 font-medium">Recovered</span>
            <CheckCircle2 className="text-neon-green w-5 h-5" />
          </div>
          <div className="text-4xl font-bold text-white mb-1">{foundCount}</div>
          <div className="text-xs text-slate-500">+2 in last 24h</div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 font-medium">System Load</span>
            <Activity className="text-neon-blue w-5 h-5" />
          </div>
          <div className="text-4xl font-bold text-white mb-1">Optimal</div>
          <div className="text-xs text-slate-500">Gemini V2.5 Connected</div>
        </div>

         <div 
            onClick={() => setView(AppView.SCAN)}
            className="bg-gradient-to-br from-neon-blue/20 to-slate-900 border border-neon-blue/50 p-6 rounded-2xl cursor-pointer hover:scale-[1.02] transition-transform group"
         >
          <div className="flex items-center justify-between mb-4">
            <span className="text-neon-blue font-bold uppercase tracking-wider text-sm">Initiate Scan</span>
            <div className="w-2 h-2 bg-neon-blue rounded-full animate-ping" />
          </div>
          <div className="text-2xl font-bold text-white mb-2 group-hover:text-neon-blue transition-colors">Start Video Analysis</div>
          <div className="text-xs text-slate-400">Upload footage to match vectors</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 h-96">
          <h3 className="text-lg font-semibold text-white mb-6">Case Status Distribution</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data}>
              <XAxis 
                dataKey="name" 
                stroke="#64748b" 
                tick={{fill: '#94a3b8'}}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip 
                contentStyle={{backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff'}}
                cursor={{fill: 'rgba(255,255,255,0.05)'}}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-96 overflow-y-auto">
          <h3 className="text-lg font-semibold text-white mb-6">Recent Reports</h3>
          <div className="space-y-4">
            {people.length === 0 ? (
                <p className="text-slate-500 text-sm italic">No reports filed yet.</p>
            ) : (
                people.slice(0, 5).map((person) => (
                <div key={person.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <img src={person.imageUrl} alt={person.name} className="w-10 h-10 rounded-full object-cover border border-slate-600" />
                    <div>
                    <p className="text-sm font-medium text-white">{person.name}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{person.lastSeenDate}</span>
                    </div>
                    </div>
                    <span className={`ml-auto text-[10px] px-2 py-1 rounded-full font-bold ${
                        person.status === 'MISSING' ? 'bg-neon-red/10 text-neon-red' : 'bg-neon-green/10 text-neon-green'
                    }`}>
                        {person.status}
                    </span>
                </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
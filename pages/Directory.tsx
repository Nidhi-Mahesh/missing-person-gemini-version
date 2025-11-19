import React from 'react';
import { Person } from '../types';
import { MapPin, Calendar, User, Shirt } from 'lucide-react';

interface DirectoryProps {
  people: Person[];
}

export const Directory: React.FC<DirectoryProps> = ({ people }) => {
  return (
    <div className="p-6 lg:p-10 w-full">
      <header className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">Directory</h1>
            <p className="text-slate-400">Active missing person database.</p>
        </div>
        <div className="text-slate-500 font-mono text-sm">
            Records: {people.length}
        </div>
      </header>

      {people.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
            <User className="w-16 h-16 mb-4 opacity-50" />
            <p>No records in the database.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {people.map((person) => (
            <div key={person.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-neon-blue/50 transition-all duration-300 group">
              <div className="relative h-48 overflow-hidden">
                <img 
                    src={person.imageUrl} 
                    alt={person.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3">
                    <span className={`
                        text-xs font-bold px-3 py-1 rounded-full border backdrop-blur-md shadow-lg
                        ${person.status === 'MISSING' 
                            ? 'bg-red-500/20 border-red-500/50 text-red-200' 
                            : 'bg-green-500/20 border-green-500/50 text-green-200'}
                    `}>
                        {person.status}
                    </span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60" />
              </div>
              
              <div className="p-5 space-y-4">
                <div>
                    <h3 className="text-xl font-bold text-white">{person.name}</h3>
                    <p className="text-sm text-slate-400">Age: {person.age}</p>
                </div>
                
                <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm text-slate-300">
                        <MapPin className="w-4 h-4 text-neon-blue shrink-0 mt-0.5" />
                        <span>{person.lastSeenLocation}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Calendar className="w-4 h-4 text-neon-blue shrink-0" />
                        <span>{person.lastSeenDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Shirt className="w-4 h-4 text-neon-blue shrink-0" />
                        <span>{person.lastSeenClothing}</span>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                    <p className="text-xs text-slate-500 line-clamp-2 italic">
                        "Biometrics: {person.description}"
                    </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
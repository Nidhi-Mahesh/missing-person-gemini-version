import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Report } from './pages/Report';
import { Directory } from './pages/Directory';
import { Scan } from './pages/Scan';
import { AppView, Person } from './types';

const App: React.FC = () => {
  const [currentView, setView] = useState<AppView>(AppView.SCAN);
  const [people, setPeople] = useState<Person[]>([]);

  const handleAddPerson = (person: Person) => {
    setPeople([person, ...people]);
    setView(AppView.DIRECTORY);
  };

  const handleUpdateStatus = (id: string, status: 'FOUND') => {
    setPeople(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  // Render the active view
  const renderView = () => {
    switch (currentView) {
      case AppView.REPORT:
        return <Report onAddPerson={handleAddPerson} />;
      case AppView.DIRECTORY:
        return <Directory people={people} />;
      case AppView.SCAN:
        return <Scan people={people} onUpdatePersonStatus={handleUpdateStatus} />;
      default:
        return <Scan people={people} onUpdatePersonStatus={handleUpdateStatus} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Fixed Sidebar */}
      <Navbar currentView={currentView} setView={setView} />
      
      {/* Scrollable Main Content */}
      <main className="flex-1 h-full overflow-y-auto relative scroll-smooth">
        {/* Background ambient glow - Fixed position relative to main view */}
        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-neon-blue/5 rounded-full blur-[100px] pointer-events-none z-0" />
        <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-neon-red/5 rounded-full blur-[100px] pointer-events-none z-0" />
        
        <div className="relative z-10 min-h-full">
            {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;
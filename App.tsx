
import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Report } from './pages/Report';
import { Directory } from './pages/Directory';
import { Scan } from './pages/Scan';
import { AppView, Person } from './types';

// Mock Data to start with
const MOCK_PEOPLE: Person[] = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    age: '24',
    lastSeenLocation: 'Central Station, Platform 4',
    lastSeenDate: '2024-05-12',
    description: 'Female, blonde hair tied back, wearing a red hoodie and blue jeans. Carrying a black backpack.',
    imageUrl: 'https://picsum.photos/id/64/400/400',
    status: 'MISSING'
  },
  {
    id: '2',
    name: 'Michael Ross',
    age: '45',
    lastSeenLocation: 'Downtown Park Entrance',
    lastSeenDate: '2024-05-10',
    description: 'Male, short dark hair, beard. Wearing a grey suit jacket and glasses.',
    imageUrl: 'https://picsum.photos/id/91/400/400',
    status: 'FOUND'
  }
];

const App: React.FC = () => {
  const [currentView, setView] = useState<AppView>(AppView.SCAN);
  const [people, setPeople] = useState<Person[]>(MOCK_PEOPLE);

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
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
      <Navbar currentView={currentView} setView={setView} />
      <main className="flex-1 h-full overflow-hidden relative">
        {/* Background ambient glow */}
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-neon-blue/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-neon-red/5 rounded-full blur-[100px] pointer-events-none" />
        
        {renderView()}
      </main>
    </div>
  );
};

export default App;

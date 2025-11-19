import React, { useState, useRef } from 'react';
import { Person } from '../types';
import { Upload, Loader2, Sparkles } from 'lucide-react';
import { analyzePersonImage } from '../services/geminiService';

interface ReportProps {
  onAddPerson: (person: Person) => void;
}

export const Report: React.FC<ReportProps> = ({ onAddPerson }) => {
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    lastSeenLocation: '',
    lastSeenDate: new Date().toISOString().split('T')[0],
    description: '',
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      
      // Auto-fill description using AI
      setLoading(true);
      const description = await analyzePersonImage(base64);
      setFormData(prev => ({ ...prev, description }));
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) return alert("Please upload an image");

    const newPerson: Person = {
      id: crypto.randomUUID(),
      ...formData,
      imageUrl: imagePreview,
      status: 'MISSING',
    };

    onAddPerson(newPerson);
  };

  return (
    <div className="p-6 lg:p-10 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-bold text-white mb-2">Report Missing Person</h1>
      <p className="text-slate-400 mb-8">Submit details to the centralized database. AI will auto-generate physical descriptors.</p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Section */}
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative aspect-square rounded-2xl border-2 border-dashed 
              flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all
              ${imagePreview ? 'border-neon-blue' : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'}
            `}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-6">
                <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-300 font-medium">Click to upload photo</p>
                <p className="text-slate-500 text-sm mt-2">Supports JPG, PNG</p>
              </div>
            )}
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload}
            />
            
            {loading && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 text-neon-blue animate-spin mb-3" />
                    <p className="text-neon-blue font-mono text-sm animate-pulse">Analyzing biometrics...</p>
                </div>
            )}
          </div>
          <p className="text-xs text-slate-500 text-center">Upload a clear, front-facing photo for best vector embedding results.</p>
        </div>

        {/* Details Section */}
        <div className="space-y-6 bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Full Name</label>
              <input 
                required
                type="text"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-all"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Age</label>
              <input 
                required
                type="number"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-all"
                value={formData.age}
                onChange={e => setFormData({...formData, age: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Last Seen Location</label>
            <input 
              required
              type="text"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-all"
              value={formData.lastSeenLocation}
              onChange={e => setFormData({...formData, lastSeenLocation: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Date Missing</label>
            <input 
              required
              type="date"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-all"
              value={formData.lastSeenDate}
              onChange={e => setFormData({...formData, lastSeenDate: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-400">Physical Description</label>
                {formData.description && !loading && (
                    <span className="text-[10px] text-neon-blue flex items-center gap-1 bg-neon-blue/10 px-2 py-0.5 rounded-full">
                        <Sparkles className="w-3 h-3" /> AI Generated
                    </span>
                )}
            </div>
            <textarea 
              required
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-all resize-none"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Waiting for image analysis..."
            />
          </div>

          <button 
            type="submit"
            disabled={loading || !imagePreview}
            className="w-full bg-neon-blue hover:bg-blue-500 text-white font-bold py-4 rounded-lg transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_30px_rgba(14,165,233,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Report
          </button>
        </div>
      </form>
    </div>
  );
};
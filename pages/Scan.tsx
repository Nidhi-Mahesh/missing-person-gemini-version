import React, { useState, useRef, useEffect } from 'react';
import { Person, MatchResult } from '../types';
import { ScanEye, Video, Image as ImageIcon, AlertCircle, CheckCircle, Loader2, Play, Pause, Crosshair, FileUp, Target, Shirt } from 'lucide-react';
import { scanCrowdForMatch } from '../services/geminiService';

interface ScanProps {
  people: Person[];
  onUpdatePersonStatus: (id: string, status: 'FOUND') => void;
}

export const Scan: React.FC<ScanProps> = ({ people, onUpdatePersonStatus }) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentScanTime, setCurrentScanTime] = useState("00:00");
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [result, setResult] = useState<MatchResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cleanup media URL on unmount or change
  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setMediaType(file.type.startsWith('video/') ? 'video' : 'image');
    setResult(null);
    setScanLog([]);
    setScanProgress(0);
    setCurrentScanTime("00:00");
  };

  const captureFrame = (source: HTMLVideoElement | HTMLImageElement): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;

    if (width === 0 || height === 0) return null;

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(source, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const runScan = async () => {
    if (!selectedPersonId || !mediaUrl) return;
    
    const targetPerson = people.find(p => p.id === selectedPersonId);
    if (!targetPerson) {
        setScanLog(prev => ["Error: Target not found in database.", ...prev]);
        return;
    }

    setScanning(true);
    setResult(null);
    setScanLog(prev => ["Initializing Biometric Vector Analysis...", ...prev]);
    setScanLog(prev => [`Target Attire Protocol: "${targetPerson.lastSeenClothing}"`, ...prev]);

    if (mediaType === 'image') {
        await runImageScan(targetPerson);
    } else if (mediaType === 'video') {
        await runVideoScan(targetPerson);
    }
  };

  const runImageScan = async (targetPerson: Person) => {
    if (!imageRef.current) return;

    setScanLog(prev => ["Analyzing static image frame for keypoints...", ...prev]);
    
    // Small delay to ensure UI renders
    await new Promise(r => setTimeout(r, 500));

    const frameBase64 = captureFrame(imageRef.current);
    if (!frameBase64) {
        setScanLog(prev => ["Error: Could not capture image data.", ...prev]);
        setScanning(false);
        return;
    }

    try {
        const analysis = await scanCrowdForMatch(targetPerson.imageUrl, frameBase64, targetPerson.lastSeenClothing);
        handleScanResult(analysis, targetPerson.id, "Static Image");
    } catch (e) {
        console.error(e);
        setScanLog(prev => ["Analysis failed.", ...prev]);
    }

    setScanProgress(100);
    setScanning(false);
  };

  const runVideoScan = async (targetPerson: Person) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    if (isNaN(video.duration)) {
        setScanLog(prev => ["Error: Video metadata not loaded. Try playing the video first.", ...prev]);
        setScanning(false);
        return;
    }

    const duration = video.duration;
    const interval = 2; // Scan every 2 seconds
    let currentTime = 0;

    video.pause();
    video.currentTime = 0;
    
    // Loop through video
    while (currentTime < duration) {
      // Check if user stopped scan (not implemented yet) or result found
      if (!videoRef.current) break; // Component unmounted

      // Seek
      video.currentTime = currentTime;
      setCurrentScanTime(new Date(currentTime * 1000).toISOString().substr(14, 5));
      
      // Wait for seek to complete
      await new Promise<void>(resolve => {
          const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
          };
          video.addEventListener('seeked', onSeeked);
          // Fallback in case seek event doesn't fire quickly
          setTimeout(resolve, 800); 
      });

      // Capture
      const frameBase64 = captureFrame(video);
      if (frameBase64) {
        setScanLog(prev => [`Processing Frame ${new Date(currentTime * 1000).toISOString().substr(14, 5)}...`, ...prev]);

        try {
            const analysis = await scanCrowdForMatch(targetPerson.imageUrl, frameBase64, targetPerson.lastSeenClothing);
            if (analysis.found && analysis.confidence > 75) {
                handleScanResult(analysis, targetPerson.id, new Date(currentTime * 1000).toISOString().substr(14, 5));
                setScanning(false);
                return; // Stop on find
            }
        } catch (e) {
            console.error("Frame error", e);
        }
      }

      // Update progress
      setScanProgress(Math.min(Math.round((currentTime / duration) * 100), 99));
      currentTime += interval;
    }

    setScanning(false);
    setScanProgress(100);
    setScanLog(prev => ["Scan complete. Target not found in media.", ...prev]);
    setResult({
        found: false,
        confidence: 0,
        description: "Deep scan completed. No matching vector signatures found.",
        timestamp: new Date().toLocaleTimeString(),
    });
  };

  const handleScanResult = (analysis: any, personId: string, timestamp: string) => {
      if (analysis.found) {
        setResult({
            found: true,
            confidence: analysis.confidence,
            description: analysis.explanation,
            timestamp: new Date().toLocaleTimeString(),
            locationContext: timestamp,
            boundingBox: analysis.box_2d
        });
        onUpdatePersonStatus(personId, 'FOUND');
        setScanLog(prev => [`MATCH CONFIRMED: ${analysis.confidence}% Confidence`, ...prev]);
      } else {
        setResult({
            found: false,
            confidence: analysis.confidence,
            description: analysis.explanation,
            timestamp: new Date().toLocaleTimeString(),
        });
        setScanLog(prev => ["Target not identified.", ...prev]);
      }
  };

  // Render Bounding Box Style
  const getBoundingBoxStyle = () => {
    if (!result?.boundingBox) return {};
    const [ymin, xmin, ymax, xmax] = result.boundingBox;
    return {
        top: `${ymin / 10}%`,
        left: `${xmin / 10}%`,
        height: `${(ymax - ymin) / 10}%`,
        width: `${(xmax - xmin) / 10}%`,
    };
  };

  // Helper to get selected person
  const activePerson = people.find(p => p.id === selectedPersonId);

  return (
    <div className="p-6 lg:p-8 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <ScanEye className="text-neon-blue w-8 h-8" />
                    Active Surveillance
                </h1>
                <p className="text-slate-400 mt-2">Upload security footage or images for AI biometric analysis.</p>
            </div>
            
            <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 text-right shrink-0">
                <p className="text-xs text-slate-500 uppercase font-bold">Engine Status</p>
                <div className="flex items-center justify-end gap-2">
                    <div className={`w-2 h-2 rounded-full ${scanning ? 'bg-neon-red animate-ping' : 'bg-neon-green'}`}></div>
                    <p className="text-neon-blue font-mono">{scanning ? 'PROCESSING' : 'READY'}</p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            
            {/* LEFT PANEL: Controls */}
            <div className="xl:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 h-fit">
                
                {/* Target Selection */}
                <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <span className="bg-slate-800 w-5 h-5 flex items-center justify-center rounded-full text-white text-[10px]">1</span> 
                        Select Target Identity
                    </label>
                    <select 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-neon-blue"
                        value={selectedPersonId}
                        onChange={(e) => setSelectedPersonId(e.target.value)}
                    >
                        <option value="">-- Database Select --</option>
                        {people.filter(p => p.status === 'MISSING').map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    
                    {activePerson && (
                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 animate-in fade-in slide-in-from-top-2 space-y-3">
                            <div className="flex gap-3">
                                <img 
                                    src={activePerson.imageUrl} 
                                    className="w-16 h-16 rounded-md object-cover border border-neon-blue/50"
                                    alt="Target"
                                />
                                <div>
                                    <p className="text-sm font-bold text-white">{activePerson.name}</p>
                                    <p className="text-xs text-slate-400 mt-1">ID: {activePerson.id.slice(0,8)}</p>
                                    <div className="flex items-center gap-1 mt-1 text-[10px] text-neon-blue">
                                        <Crosshair className="w-3 h-3" /> Biometrics Loaded
                                    </div>
                                </div>
                            </div>
                            
                            {/* Clothing Display */}
                            <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                                    <Shirt className="w-3 h-3" /> Last Seen Wearing
                                </p>
                                <p className="text-xs text-white font-medium leading-tight">
                                    {activePerson.lastSeenClothing}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Media Upload */}
                <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                         <span className="bg-slate-800 w-5 h-5 flex items-center justify-center rounded-full text-white text-[10px]">2</span>
                        Source Footage
                    </label>
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                            border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group relative overflow-hidden
                            ${mediaUrl ? 'border-neon-blue bg-neon-blue/5' : 'border-slate-700 hover:border-neon-blue bg-slate-950'}
                        `}
                    >
                        {mediaType === 'video' ? (
                            <Video className={`w-8 h-8 mb-2 relative z-10 ${mediaUrl ? 'text-neon-blue' : 'text-slate-500 group-hover:text-neon-blue'}`} />
                        ) : mediaType === 'image' ? (
                            <ImageIcon className={`w-8 h-8 mb-2 relative z-10 ${mediaUrl ? 'text-neon-blue' : 'text-slate-500 group-hover:text-neon-blue'}`} />
                        ) : (
                            <FileUp className="w-8 h-8 mb-2 relative z-10 text-slate-500 group-hover:text-neon-blue" />
                        )}
                        
                        <p className="text-sm text-slate-300 font-medium relative z-10">
                            {mediaUrl ? (mediaType === 'video' ? 'Video Loaded' : 'Image Loaded') : 'Upload Media'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 relative z-10">MP4, JPG, PNG</p>
                        <input 
                            ref={fileInputRef}
                            type="file"
                            accept="video/*,image/*" 
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>
                </div>

                {/* Action Button */}
                <button
                    onClick={runScan}
                    disabled={!selectedPersonId || !mediaUrl || scanning}
                    className="w-full bg-neon-blue disabled:bg-slate-800 disabled:text-slate-500 hover:bg-blue-500 text-white font-bold py-4 rounded-lg transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_30px_rgba(14,165,233,0.5)] flex items-center justify-center gap-2 shrink-0"
                >
                    {scanning ? <Loader2 className="animate-spin" /> : <Play className="fill-current" />}
                    {scanning ? 'SCANNING...' : 'INITIATE SEARCH'}
                </button>

                {/* Scan Log Terminal - Fixed Height with Internal Scroll */}
                <div className="h-64 bg-black rounded-lg p-4 border border-slate-800 font-mono text-xs overflow-y-auto custom-scrollbar shadow-inner shrink-0">
                    <div className="text-slate-500 mb-2 border-b border-slate-800 pb-1 sticky top-0 bg-black">/// SYSTEM LOG ///</div>
                    {scanLog.length === 0 && <span className="text-slate-700">Waiting for command...</span>}
                    {scanLog.map((log, i) => (
                        <div key={i} className={`mb-1 font-mono ${i === 0 ? 'text-neon-blue' : 'text-slate-500'}`}>
                            &gt; {log}
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT PANEL: Visualization */}
            <div className="xl:col-span-2 bg-black rounded-2xl border border-slate-800 relative overflow-hidden flex flex-col shadow-2xl min-h-[500px]">
                
                {/* Display Container */}
                <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden group w-full">
                    {/* Grid Overlay */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-10" />
                    
                    {mediaUrl ? (
                        <div className="relative w-full h-full flex justify-center items-center p-4">
                            {mediaType === 'video' ? (
                                <video 
                                    ref={videoRef}
                                    src={mediaUrl} 
                                    className="max-w-full max-h-full shadow-2xl z-0"
                                    controls={!scanning}
                                    playsInline
                                />
                            ) : (
                                <img
                                    ref={imageRef}
                                    src={mediaUrl}
                                    className="max-w-full max-h-full object-contain z-0"
                                    alt="Scan source"
                                />
                            )}

                            {/* TARGET BOUNDING BOX OVERLAY */}
                            {!scanning && result?.found && result.boundingBox && (
                                <div 
                                    className="absolute border-2 border-neon-green bg-neon-green/20 z-20 shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-pulse"
                                    style={getBoundingBoxStyle()}
                                >
                                    {/* Corner Brackets for Tech Look */}
                                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-neon-green"></div>
                                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-neon-green"></div>
                                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-neon-green"></div>
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-neon-green"></div>
                                    
                                    {/* Label */}
                                    <div className="absolute -top-8 left-0 bg-neon-green text-black text-[10px] font-bold px-2 py-1 rounded-t flex items-center gap-1">
                                        <Target className="w-3 h-3" />
                                        {(result.confidence * 100).toFixed(0)}% MATCH
                                    </div>
                                </div>
                            )}
                            
                            {/* Scanning HUD Overlay */}
                            {scanning && (
                                <div className="absolute inset-0 z-20 pointer-events-none w-full h-full">
                                    {/* Scanning Bar */}
                                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-neon-blue/10 to-transparent animate-scan"></div>
                                    <div className="absolute top-0 left-0 w-full h-1 bg-neon-blue/50 shadow-[0_0_20px_#0ea5e9] animate-scan"></div>
                                    
                                    {/* Center Reticle */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-64 h-64 border border-neon-blue/30 rounded-full animate-pulse-slow flex items-center justify-center">
                                            <div className="w-56 h-56 border border-neon-blue/20 rounded-full"></div>
                                            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-neon-blue/30"></div>
                                            <div className="absolute top-0 left-1/2 w-[1px] h-full bg-neon-blue/30"></div>
                                        </div>
                                    </div>
                                    
                                    {/* Info Badges */}
                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 border border-neon-blue/50 text-neon-blue px-3 py-1 rounded font-mono text-sm backdrop-blur-md">
                                        {mediaType === 'video' ? `FRAME: ${currentScanTime}` : 'PROCESSING BIOMETRICS'}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center space-y-4 opacity-50">
                            <Video className="w-20 h-20 mx-auto text-slate-700" />
                            <p className="text-slate-500 font-mono uppercase tracking-widest">No Media Input</p>
                        </div>
                    )}
                </div>

                {/* Bottom Status Bar */}
                <div className="h-14 bg-slate-900 border-t border-slate-800 flex items-center px-6 gap-6 shrink-0">
                    <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1.5 font-mono">
                            <span className="text-neon-blue">ANALYSIS PROGRESS</span>
                            <span className="text-white">{scanProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-neon-blue transition-all duration-300 shadow-[0_0_10px_#0ea5e9]" 
                                style={{ width: `${scanProgress}%` }}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-slate-500 border-l border-slate-800 pl-6">
                        <div className="flex flex-col">
                            <span>MODE: {mediaType ? mediaType.toUpperCase() : 'IDLE'}</span>
                            <span>AI: GEMINI 2.5</span>
                        </div>
                    </div>
                </div>

                {/* Result Popover - Only shown if found */}
                {!scanning && result?.found && (
                     <div className="absolute bottom-20 right-6 z-30 bg-slate-900/90 backdrop-blur-md border border-green-500/50 rounded-xl p-4 w-80 shadow-2xl animate-in slide-in-from-right duration-500">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-6 h-6 text-green-500 mt-1 shrink-0" />
                            <div>
                                <h3 className="text-green-500 font-bold mb-1">TARGET ACQUIRED</h3>
                                <p className="text-xs text-slate-300 leading-relaxed">{result.description}</p>
                                <div className="mt-2 flex gap-2">
                                    <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20">
                                        Conf: {result.confidence}%
                                    </span>
                                    {result.locationContext && (
                                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                                            @{result.locationContext}
                                        </span>
                                    )}
                                </div>
                                <button onClick={() => setResult(null)} className="mt-3 text-xs text-slate-500 hover:text-white underline">
                                    Dismiss
                                </button>
                            </div>
                        </div>
                     </div>
                )}

                {/* Hidden Canvas for Frame Extraction */}
                <canvas ref={canvasRef} className="hidden" />
            </div>
        </div>
    </div>
  );
};
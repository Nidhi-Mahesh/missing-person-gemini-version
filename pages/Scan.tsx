import React, { useState, useRef, useEffect } from 'react';
import { Person, MatchResult } from '../types';
import { ScanEye, Video, Image as ImageIcon, AlertCircle, CheckCircle, Loader2, Play, Pause, Crosshair, FileUp, Target, Shirt, Camera, StopCircle, Users, Database, RefreshCw } from 'lucide-react';
import { scanCrowdForBatch } from '../services/geminiService';

interface ScanProps {
  people: Person[];
  onUpdatePersonStatus: (id: string, status: 'FOUND') => void;
}

export const Scan: React.FC<ScanProps> = ({ people, onUpdatePersonStatus }) => {
  // Get only missing people for the active search
  const missingPeople = people.filter(p => p.status === 'MISSING');
  
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'stream' | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentScanTime, setCurrentScanTime] = useState("00:00");
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [result, setResult] = useState<MatchResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopScanRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      stopWebcam();
    };
  }, []);

  // Auto-Start Effect
  useEffect(() => {
    if (mediaType && !scanning && !stopScanRef.current) {
        const timer = setTimeout(() => {
            triggerScan();
        }, 800); // Delay to allow video/image refs to mount
        return () => clearTimeout(timer);
    }
  }, [mediaType, mediaUrl]);

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (webcamRef.current) {
      webcamRef.current.srcObject = null;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopWebcam(); 
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setMediaType(file.type.startsWith('video/') ? 'video' : 'image');
    setResult(null);
    setScanLog(["Media loaded. Initializing auto-scan..."]);
    setScanProgress(0);
    setCurrentScanTime("00:00");
    stopScanRef.current = false; // Reset stop flag for new media
  };

  const enableWebcam = async () => {
    try {
        if (mediaUrl) URL.revokeObjectURL(mediaUrl);
        setMediaUrl(null);
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        
        if (webcamRef.current) {
            webcamRef.current.srcObject = stream;
        }
        
        setMediaType('stream');
        setResult(null);
        setScanLog(["Webcam initialized. Starting live surveillance..."]);
        setScanProgress(0);
        setCurrentScanTime("LIVE");
        stopScanRef.current = false; // Reset stop flag for new stream
    } catch (err) {
        console.error("Error accessing webcam:", err);
        setScanLog(prev => ["Error: Could not access webcam.", ...prev]);
    }
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

  const triggerScan = async () => {
      if (missingPeople.length === 0) {
          setScanLog(prev => ["ABORT: Database empty. Add missing persons to directory first.", ...prev]);
          return;
      }
      
      if (mediaType === 'stream' && !streamRef.current) return;
      if (mediaType !== 'stream' && !mediaUrl) return;

      setScanning(true);
      stopScanRef.current = false;
      setResult(null);

      if (mediaType === 'stream') {
           setScanLog(prev => [`AUTO-START: Live Batch Scan for ${missingPeople.length} active targets...`, ...prev]);
           await runWebcamScan();
      } else if (mediaType === 'video') {
           setScanLog(prev => [`AUTO-START: Video Batch Scan for ${missingPeople.length} active targets...`, ...prev]);
           await runVideoScan();
      } else if (mediaType === 'image') {
           setScanLog(prev => [`AUTO-START: Image Batch Scan for ${missingPeople.length} active targets...`, ...prev]);
           await runImageScan();
      }
  };

  const stopScan = () => {
      stopScanRef.current = true;
      setScanning(false);
      setScanLog(prev => ["Scan terminated by user.", ...prev]);
  };

  const restartScan = () => {
      stopScanRef.current = false;
      triggerScan();
  };

  // --- SCANNING LOGIC FOR BATCH ---

  const runImageScan = async () => {
    if (!imageRef.current) return;

    setScanLog(prev => ["Analyzing static image against database...", ...prev]);
    await new Promise(r => setTimeout(r, 500));

    const frameBase64 = captureFrame(imageRef.current);
    if (!frameBase64) {
        setScanLog(prev => ["Error: Capture failed.", ...prev]);
        setScanning(false);
        return;
    }

    try {
        const analysis = await scanCrowdForBatch(missingPeople, frameBase64);
        handleScanResult(analysis, "Static Image");
    } catch (e) {
        console.error(e);
        setScanLog(prev => ["Analysis failed.", ...prev]);
    }

    setScanProgress(100);
    setScanning(false);
  };

  const runVideoScan = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Wait for metadata if needed
    if (isNaN(video.duration)) {
        await new Promise(r => setTimeout(r, 1000));
    }

    const duration = video.duration || 100;
    const interval = 2;
    let currentTime = 0;

    video.pause();
    video.currentTime = 0;
    
    while (currentTime < duration) {
      if (stopScanRef.current) break;
      if (!videoRef.current) break;

      video.currentTime = currentTime;
      setCurrentScanTime(new Date(currentTime * 1000).toISOString().substr(14, 5));
      
      await new Promise<void>(resolve => {
          const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
          };
          video.addEventListener('seeked', onSeeked);
          // Fallback if seeked doesn't fire
          setTimeout(resolve, 800); 
      });

      const frameBase64 = captureFrame(video);
      if (frameBase64) {
        setScanLog(prev => [`Scanning Frame ${new Date(currentTime * 1000).toISOString().substr(14, 5)} against ${missingPeople.length} records...`, ...prev]);

        try {
            const analysis = await scanCrowdForBatch(missingPeople, frameBase64);
            if (analysis.found && analysis.confidence > 75) {
                handleScanResult(analysis, new Date(currentTime * 1000).toISOString().substr(14, 5));
                setScanning(false);
                return;
            }
        } catch (e) {
            console.error("Frame error", e);
        }
      }

      setScanProgress(Math.min(Math.round((currentTime / duration) * 100), 99));
      currentTime += interval;
    }

    setScanning(false);
    if (!stopScanRef.current) {
        setScanProgress(100);
        setScanLog(prev => ["Scan complete. No matches found in footage.", ...prev]);
    }
  };

  const runWebcamScan = async () => {
      if (!webcamRef.current) return;
      let scanCount = 0;

      while (true) {
          if (stopScanRef.current) break;
          if (!webcamRef.current) break;

          const frameBase64 = captureFrame(webcamRef.current);
          if (frameBase64) {
              const timeStamp = new Date().toLocaleTimeString();
              setScanLog(prev => [`Live Cycle ${scanCount}: Checking ${missingPeople.length} targets...`, ...prev]);

              try {
                  const analysis = await scanCrowdForBatch(missingPeople, frameBase64);
                  if (analysis.found && analysis.confidence > 75) {
                      handleScanResult(analysis, "LIVE FEED");
                      setScanning(false);
                      return;
                  }
              } catch (e) { console.error(e); }
          }

          scanCount++;
          setScanProgress((scanCount % 10) * 10);
          await new Promise(r => setTimeout(r, 2000));
      }
      setScanning(false);
  };

  const handleScanResult = (analysis: any, timestamp: string) => {
      if (analysis.found && analysis.personId) {
        setResult({
            found: true,
            personId: analysis.personId,
            confidence: analysis.confidence,
            description: analysis.explanation,
            timestamp: new Date().toLocaleTimeString(),
            locationContext: timestamp,
            boundingBox: analysis.box_2d
        });
        onUpdatePersonStatus(analysis.personId, 'FOUND');
        
        const matchedPerson = missingPeople.find(p => p.id === analysis.personId);
        setScanLog(prev => [`MATCH CONFIRMED: ${matchedPerson?.name || 'Unknown'} (${analysis.confidence}%)`, ...prev]);
      } else {
        setResult({
            found: false,
            confidence: 0,
            description: "No match found",
            timestamp: new Date().toLocaleTimeString(),
        });
        setScanLog(prev => ["Negative result.", ...prev]);
      }
  };

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

  // Find details of matched person if result exists
  const matchedPerson = result?.found && result.personId 
    ? people.find(p => p.id === result.personId) 
    : null;

  return (
    <div className="p-6 lg:p-8 w-full min-h-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <ScanEye className="text-neon-blue w-8 h-8" />
                    Active Surveillance
                </h1>
                <p className="text-slate-400 mt-2">Automated Multi-Vector Identification System</p>
            </div>
            
            <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 text-right shrink-0">
                <p className="text-xs text-slate-500 uppercase font-bold">Engine Status</p>
                <div className="flex items-center justify-end gap-2">
                    <div className={`w-2 h-2 rounded-full ${scanning ? 'bg-neon-red animate-ping' : 'bg-neon-green'}`}></div>
                    <p className="text-neon-blue font-mono">{scanning ? 'BATCH SCANNING ACTIVE' : 'SYSTEM READY'}</p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            
            {/* LEFT PANEL: Controls */}
            <div className="xl:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 h-fit sticky top-6">
                
                {/* Active Database Grid */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Database className="w-4 h-4 text-neon-blue" />
                            Active Warrants ({missingPeople.length})
                        </label>
                    </div>
                    
                    {missingPeople.length === 0 ? (
                        <div className="p-4 border border-dashed border-slate-700 rounded-lg text-center text-slate-500 text-xs">
                            Database Empty. Add reports first.
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                            {missingPeople.map(p => (
                                <div 
                                    key={p.id} 
                                    className={`relative group rounded-lg overflow-hidden border transition-all ${result?.personId === p.id ? 'border-neon-green shadow-[0_0_10px_#10b981] scale-105 z-10' : 'border-slate-700 opacity-70'}`}
                                >
                                    <img src={p.imageUrl} className="w-full h-20 object-cover" alt={p.name} />
                                    <div className="absolute bottom-0 left-0 w-full bg-black/70 text-[8px] text-white p-1 truncate">
                                        {p.name}
                                    </div>
                                    {result?.personId === p.id && (
                                        <div className="absolute inset-0 bg-neon-green/20 flex items-center justify-center">
                                            <Target className="text-neon-green w-6 h-6 animate-pulse" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Media Selection */}
                <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                         <span className="bg-slate-800 w-5 h-5 flex items-center justify-center rounded-full text-white text-[10px]">2</span>
                        Input Source
                    </label>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <button 
                            onClick={() => { stopWebcam(); setMediaUrl(null); setMediaType(null); }}
                            className={`text-xs py-2 rounded border transition-colors ${mediaType !== 'stream' ? 'bg-neon-blue/20 border-neon-blue text-neon-blue' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                        >
                            Upload File
                        </button>
                        <button 
                            onClick={enableWebcam}
                            className={`text-xs py-2 rounded border transition-colors ${mediaType === 'stream' ? 'bg-neon-blue/20 border-neon-blue text-neon-blue' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                        >
                            Live Camera
                        </button>
                    </div>

                    {mediaType === 'stream' ? (
                         <div className="border-2 border-neon-blue bg-neon-blue/5 rounded-xl p-6 flex flex-col items-center justify-center h-32 animate-pulse">
                            <Camera className="w-8 h-8 text-neon-blue mb-2" />
                            <p className="text-sm text-neon-blue font-bold">Webcam Active</p>
                            <p className="text-[10px] text-slate-400">Streaming live feed...</p>
                        </div>
                    ) : (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                                border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group relative overflow-hidden h-32
                                ${mediaUrl ? 'border-neon-blue bg-neon-blue/5' : 'border-slate-700 hover:border-neon-blue bg-slate-950'}
                            `}
                        >
                            {mediaUrl && mediaType === 'video' ? (
                                <Video className="w-8 h-8 mb-2 text-neon-blue" />
                            ) : mediaUrl && mediaType === 'image' ? (
                                <ImageIcon className="w-8 h-8 mb-2 text-neon-blue" />
                            ) : (
                                <FileUp className="w-8 h-8 mb-2 text-slate-500 group-hover:text-neon-blue" />
                            )}
                            
                            <p className="text-sm text-slate-300 font-medium">
                                {mediaUrl ? (mediaType === 'video' ? 'Video Ready' : 'Image Ready') : 'Drop File / Click'}
                            </p>
                            <input 
                                ref={fileInputRef}
                                type="file"
                                accept="video/*,image/*" 
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </div>
                    )}
                </div>

                {/* Control Panel (Replaces Start Button) */}
                {mediaType && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-400 uppercase">Status</span>
                            <span className={`text-sm font-bold ${scanning ? 'text-neon-blue animate-pulse' : 'text-slate-500'}`}>
                                {scanning ? 'SCANNING...' : 'STANDBY'}
                            </span>
                        </div>
                        
                        {scanning ? (
                            <button 
                                onClick={stopScan}
                                className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/50 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
                            >
                                <StopCircle className="w-4 h-4" /> STOP
                            </button>
                        ) : (
                            <button 
                                onClick={restartScan}
                                className="bg-neon-blue/20 text-neon-blue hover:bg-neon-blue hover:text-white border border-neon-blue/50 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
                            >
                                <RefreshCw className="w-4 h-4" /> RESTART
                            </button>
                        )}
                    </div>
                )}

                {/* Log */}
                <div className="h-64 bg-black rounded-lg p-4 border border-slate-800 font-mono text-xs overflow-y-auto custom-scrollbar shadow-inner shrink-0">
                    <div className="text-slate-500 mb-2 border-b border-slate-800 pb-1 sticky top-0 bg-black">/// SYSTEM LOG ///</div>
                    {scanLog.length === 0 && <span className="text-slate-700">Waiting for input...</span>}
                    {scanLog.map((log, i) => (
                        <div key={i} className={`mb-1 font-mono ${i === 0 ? 'text-neon-blue' : 'text-slate-500'}`}>
                            &gt; {log}
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT PANEL: Visualization */}
            <div className="xl:col-span-2 bg-black rounded-2xl border border-slate-800 relative overflow-hidden flex flex-col shadow-2xl min-h-[600px]">
                
                {/* Display Container */}
                <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden group w-full">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-10" />
                    
                    {mediaType === 'stream' ? (
                        <div className="relative w-full h-full flex justify-center items-center bg-black">
                             <video 
                                ref={webcamRef}
                                autoPlay
                                playsInline
                                muted
                                className="max-w-full max-h-full object-contain z-0 transform scale-x-[-1]"
                            />
                            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500 rounded-full animate-pulse z-30">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span className="text-xs font-bold text-red-500">LIVE FEED</span>
                            </div>
                        </div>
                    ) : mediaUrl ? (
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
                        </div>
                    ) : (
                        <div className="text-center space-y-4 opacity-50">
                            <Video className="w-20 h-20 mx-auto text-slate-700" />
                            <p className="text-slate-500 font-mono uppercase tracking-widest">No Signal Input</p>
                        </div>
                    )}

                    {/* TARGET BOUNDING BOX OVERLAY */}
                    {!scanning && result?.found && result.boundingBox && (
                        <div 
                            className="absolute border-2 border-neon-green bg-neon-green/20 z-20 shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-pulse"
                            style={getBoundingBoxStyle()}
                        >
                            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-neon-green"></div>
                            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-neon-green"></div>
                            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-neon-green"></div>
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-neon-green"></div>
                            
                            <div className="absolute -top-8 left-0 bg-neon-green text-black text-[10px] font-bold px-2 py-1 rounded-t flex items-center gap-1 whitespace-nowrap">
                                <Target className="w-3 h-3" />
                                MATCH: {matchedPerson?.name.toUpperCase()} ({result.confidence}%)
                            </div>
                        </div>
                    )}
                            
                    {/* Scanning HUD Overlay */}
                    {scanning && (
                        <div className="absolute inset-0 z-20 pointer-events-none w-full h-full">
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-neon-blue/10 to-transparent animate-scan"></div>
                            <div className="absolute top-0 left-0 w-full h-1 bg-neon-blue/50 shadow-[0_0_20px_#0ea5e9] animate-scan"></div>
                            
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-64 h-64 border border-neon-blue/30 rounded-full animate-pulse-slow flex items-center justify-center">
                                    <div className="w-56 h-56 border border-neon-blue/20 rounded-full"></div>
                                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-neon-blue/30"></div>
                                    <div className="absolute top-0 left-1/2 w-[1px] h-full bg-neon-blue/30"></div>
                                </div>
                            </div>
                            
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 border border-neon-blue/50 text-neon-blue px-3 py-1 rounded font-mono text-sm backdrop-blur-md">
                                {mediaType === 'stream' ? `LIVE BATCH ANALYSIS` : mediaType === 'video' ? `FRAME: ${currentScanTime}` : 'PROCESSING IMAGE'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Status Bar */}
                <div className="h-14 bg-slate-900 border-t border-slate-800 flex items-center px-6 gap-6 shrink-0">
                    <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1.5 font-mono">
                            <span className="text-neon-blue">BATCH PROCESSING</span>
                            <span className="text-white">{mediaType === 'stream' ? 'CONTINUOUS' : `${scanProgress}%`}</span>
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
                            <span>TARGETS: {missingPeople.length}</span>
                            <span>AI: GEMINI 2.5</span>
                        </div>
                    </div>
                </div>

                {/* Result Popover - Only shown if found */}
                {!scanning && result?.found && matchedPerson && (
                     <div className="absolute bottom-20 right-6 z-30 bg-slate-900/90 backdrop-blur-md border border-green-500/50 rounded-xl p-4 w-80 shadow-2xl animate-in slide-in-from-right duration-500">
                        <div className="flex items-start gap-3">
                            <div className="relative">
                                <img src={matchedPerson.imageUrl} className="w-12 h-12 rounded-full object-cover border-2 border-green-500" alt="Match" />
                                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
                                    <CheckCircle className="w-3 h-3 text-black" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-green-500 font-bold mb-0.5 text-sm">TARGET LOCATED</h3>
                                <p className="text-white font-bold text-lg leading-none mb-1">{matchedPerson.name}</p>
                                <p className="text-xs text-slate-300 leading-relaxed mb-2">{result.description}</p>
                                <div className="flex gap-2 flex-wrap">
                                    <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20">
                                        Conf: {result.confidence}%
                                    </span>
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                                        Wearing: {matchedPerson.lastSeenClothing}
                                    </span>
                                </div>
                                <button onClick={() => setResult(null)} className="mt-3 text-xs text-slate-500 hover:text-white underline w-full text-right">
                                    Acknowledge
                                </button>
                            </div>
                        </div>
                     </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
            </div>
        </div>
    </div>
  );
};
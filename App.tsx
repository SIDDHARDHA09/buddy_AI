
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IrisState, Message } from './types';
import { WAKE_WORD } from './constants';
import { GeminiLiveSession } from './services/geminiService';
import IrisOrb from './components/IrisOrb';
import MessageLog from './components/MessageLog';
import StatusIndicator from './components/StatusIndicator';
import TutorialOverlay from './components/TutorialOverlay';

const App: React.FC = () => {
  const [irisState, setIrisState] = useState<IrisState>(IrisState.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isMicAllowed, setIsMicAllowed] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const sessionRef = useRef<GeminiLiveSession | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextAudioStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Function to initialize Audio Context for playback
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  const stopAllPlayback = useCallback(() => {
    audioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    audioSourcesRef.current.clear();
    nextAudioStartTimeRef.current = 0;
  }, []);

  const handleStopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
    }
    stopAllPlayback();
    setCurrentTranscription("");
    setIrisState(IrisState.LISTENING_WAKEWORD);
    startWakeWordRecognition();
  }, [stopAllPlayback]);

  const handleWakeWordDetected = useCallback(() => {
    console.log("Wake word detected: " + WAKE_WORD);
    initAudio();
    stopAllPlayback();
    setIrisState(IrisState.ACTIVE_LISTENING);
    setCurrentTranscription("");
    
    // Immediate voice response
    const utterance = new SpeechSynthesisUtterance("Hey there!");
    utterance.rate = 1.2;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);

    // Stop wake word listening while Gemini session is active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Failed to stop recognition", e);
      }
    }

    // Connect to Gemini Live Session
    sessionRef.current = new GeminiLiveSession();
    sessionRef.current.connect({
      onAudioChunk: (buffer) => {
        if (!audioContextRef.current) return;
        setIrisState(IrisState.SPEAKING);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        
        const startTime = Math.max(audioContextRef.current.currentTime, nextAudioStartTimeRef.current);
        source.start(startTime);
        nextAudioStartTimeRef.current = startTime + buffer.duration;
        
        audioSourcesRef.current.add(source);
        source.onended = () => {
          audioSourcesRef.current.delete(source);
        };
      },
      onInterrupted: () => {
        stopAllPlayback();
      },
      onTranscription: (text, isUser) => {
        if (isUser) {
          setCurrentTranscription(prev => prev + text);
          setIrisState(IrisState.THINKING);
        }
        
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === (isUser ? 'user' : 'iris') && Date.now() - last.timestamp < 3000) {
            return [...prev.slice(0, -1), { ...last, text: last.text + " " + text }];
          }
          return [...prev, { role: isUser ? 'user' : 'iris', text, timestamp: Date.now() }];
        });
      },
      onTurnComplete: () => {
        setCurrentTranscription("");
      },
      onClose: () => {
        setIrisState(IrisState.LISTENING_WAKEWORD);
        setCurrentTranscription("");
        startWakeWordRecognition();
      },
      onError: (err) => {
        console.error("Gemini session error", err);
        setError("Connection lost. Buddy is resting.");
        setIrisState(IrisState.LISTENING_WAKEWORD);
        setCurrentTranscription("");
        startWakeWordRecognition();
      }
    });
  }, [initAudio, stopAllPlayback]);

  const startWakeWordRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser. Try Chrome.");
      return;
    }

    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        if (transcript.includes(WAKE_WORD)) {
          handleWakeWordDetected();
          break;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Recognition error", event.error);
    };

    recognition.onend = () => {
      if (irisState === IrisState.LISTENING_WAKEWORD || irisState === IrisState.IDLE) {
        try { recognition.start(); } catch(e) {}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIrisState(IrisState.LISTENING_WAKEWORD);
    } catch (e) {
      console.error("Failed to start speech recognition", e);
    }
  }, [irisState, handleWakeWordDetected]);

  const handleStart = () => {
    initAudio();
    setIsMicAllowed(true);
    setShowTutorial(true);
    startWakeWordRecognition();
  };

  const isSessionActive = irisState !== IrisState.IDLE && irisState !== IrisState.LISTENING_WAKEWORD;

  return (
    <div className="relative w-full h-screen bg-slate-950 flex flex-col items-center justify-start text-white overflow-hidden p-6 md:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0%,transparent_70%)] pointer-events-none" />
      
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}

      <header className="w-full max-w-5xl flex justify-between items-center z-10 mb-8">
        <div className="text-left">
          <h1 className="text-4xl font-black tracking-tighter text-blue-400 drop-shadow-xl">BUDDY</h1>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.4em] font-bold">AI Companion</p>
        </div>
        <StatusIndicator state={irisState} />
      </header>

      {!isMicAllowed ? (
        <div className="flex-1 flex flex-col items-center justify-center z-20 text-center animate-in fade-in zoom-in duration-700">
          <p className="mb-8 text-slate-300 max-w-sm mx-auto text-xl leading-relaxed">
            Ready to meet your new friend? 
            Click below to wake up <span className="text-blue-400 font-bold">Buddy</span>.
          </p>
          <button 
            onClick={handleStart}
            className="px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-black text-2xl transition-all transform hover:scale-110 active:scale-95 shadow-2xl shadow-blue-500/40"
          >
            Wake Up Buddy
          </button>
        </div>
      ) : (
        <div className="flex-1 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Visual section */}
          <div className="relative flex flex-col items-center justify-center p-4 lg:sticky lg:top-24">
            <IrisOrb state={irisState} />
            
            {/* Tool Section: Manual Start/Stop Controls */}
            <div className="mt-8 flex items-center space-x-3 bg-slate-900/60 p-2 rounded-2xl border border-slate-800/50 backdrop-blur-md shadow-xl z-20">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 border-r border-slate-800">System Controls</span>
              <button
                onClick={handleWakeWordDetected}
                disabled={isSessionActive}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  isSessionActive 
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' 
                  : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white shadow-lg shadow-emerald-500/10'
                }`}
              >
                <span className="text-sm">▶</span>
                <span>Start Session</span>
              </button>
              <button
                onClick={handleStopSession}
                disabled={!isSessionActive}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  !isSessionActive 
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' 
                  : 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white shadow-lg shadow-red-500/10'
                }`}
              >
                <span className="text-sm">■</span>
                <span>Stop Session</span>
              </button>
            </div>

            {/* Real-time User Speech Transcription Display */}
            <div className="mt-8 w-full h-32 flex items-center justify-center text-center px-4">
              {currentTranscription ? (
                <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                  <p className="text-2xl md:text-3xl text-blue-50 font-medium leading-tight drop-shadow-2xl italic opacity-95 animate-[text-pulse_2s_ease-in-out_infinite]">
                    <span className="text-blue-500/40 mr-2 font-serif text-4xl">“</span>
                    {currentTranscription}
                    <span className="text-blue-500/40 ml-1 font-serif text-4xl">”</span>
                  </p>
                </div>
              ) : irisState === IrisState.ACTIVE_LISTENING ? (
                <p className="text-blue-400/60 text-lg font-bold animate-pulse tracking-widest uppercase">
                  Buddy is listening...
                </p>
              ) : (
                <p className="text-slate-600 text-sm font-bold tracking-[0.2em] uppercase">
                  Say "Hey Buddy" or click Start
                </p>
              )}
            </div>
          </div>

          {/* Conversation Section - Now Extended */}
          <div className="flex flex-col h-full min-h-[500px] lg:h-[calc(100vh-200px)]">
            <div className="flex-1 flex flex-col bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-slate-800/80 shadow-2xl overflow-hidden transition-all">
              <div className="px-6 py-4 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/80">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Live Conversation</span>
                <button 
                  onClick={() => setMessages([])}
                  className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
                >
                  Clear History
                </button>
              </div>
              <MessageLog messages={messages} />
            </div>

            {error && (
              <div className="mt-4 px-6 py-3 bg-red-900/40 border border-red-500/30 text-red-200 text-xs rounded-2xl animate-pulse font-bold tracking-wide text-center">
                ⚠️ {error}
              </div>
            )}
            
            <div className="mt-4 flex justify-between items-center px-4 opacity-60">
               <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-slate-500">
                 Buddy AI System v2.0
               </p>
               <button 
                onClick={() => setShowTutorial(true)}
                className="text-[10px] tracking-[0.2em] uppercase font-bold text-blue-400 hover:text-blue-300"
               >
                 View Guide
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

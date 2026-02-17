
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

  const handleWakeWordDetected = useCallback(() => {
    console.log("Wake word detected: " + WAKE_WORD);
    initAudio();
    stopAllPlayback();
    setIrisState(IrisState.ACTIVE_LISTENING);
    setCurrentTranscription("");
    
    // Immediate voice response: "Yeah?" or "Hey!"
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
          // If all audio finished, return to thinking/listening visual state? 
          // Usually handled by turnComplete
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
        console.log("Turn complete");
        setCurrentTranscription("");
        // We stay in the Gemini session for a bit or close it? 
        // For a true "hands-free" companion, we close and restart wake-word listener.
      },
      onClose: () => {
        setIrisState(IrisState.LISTENING_WAKEWORD);
        setCurrentTranscription("");
        startWakeWordRecognition();
      },
      onError: (err) => {
        console.error("Gemini session error", err);
        setError("Something went wrong. Back to sleep.");
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
        console.log("Listening...", transcript);
        if (transcript.includes(WAKE_WORD)) {
          handleWakeWordDetected();
          break;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Recognition error", event.error);
      if (event.error === 'network') {
          setError("Network error with speech recognition.");
      }
    };

    recognition.onend = () => {
      // Restart unless the state changed to something active
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

  const handleReset = () => {
    if (sessionRef.current) sessionRef.current.stop();
    stopAllPlayback();
    setCurrentTranscription("");
    startWakeWordRecognition();
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 flex flex-col items-center justify-center text-white overflow-hidden p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0%,transparent_70%)] pointer-events-none" />
      
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}

      <div className="absolute top-8 text-center z-10">
        <h1 className="text-5xl font-extrabold tracking-tighter text-blue-400 drop-shadow-xl animate-pulse">BUDDY</h1>
        <p className="text-slate-400 text-xs mt-2 uppercase tracking-[0.4em] font-bold opacity-80">Your Personal AI Companion</p>
      </div>

      {!isMicAllowed ? (
        <div className="z-20 text-center animate-in fade-in zoom-in duration-700">
          <p className="mb-8 text-slate-300 max-w-sm mx-auto text-lg leading-relaxed">
            Ready to meet your new friend? 
            Click below to wake up <span className="text-blue-400 font-bold">Buddy</span>.
          </p>
          <button 
            onClick={handleStart}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-black text-xl transition-all transform hover:scale-110 active:scale-95 shadow-2xl shadow-blue-500/40"
          >
            Wake Up Buddy
          </button>
        </div>
      ) : (
        <>
          <div className="relative flex flex-col items-center w-full max-w-3xl scale-90 md:scale-100">
            <IrisOrb state={irisState} />
            
            {/* Real-time User Speech Transcription Display */}
            <div className="mt-12 w-full h-24 flex items-center justify-center text-center px-6">
              {currentTranscription ? (
                <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                  <p className="text-2xl md:text-3xl text-blue-50 font-medium leading-tight drop-shadow-2xl italic opacity-95 animate-[text-pulse_2s_ease-in-out_infinite]">
                    <span className="text-blue-500/40 mr-2 font-serif text-4xl">“</span>
                    {currentTranscription}
                    <span className="text-blue-500/40 ml-1 font-serif text-4xl">”</span>
                  </p>
                  <div className="mt-3 flex justify-center space-x-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-0"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-150"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-300"></div>
                  </div>
                </div>
              ) : irisState === IrisState.ACTIVE_LISTENING ? (
                <div className="flex flex-col items-center space-y-2">
                  <p className="text-blue-400/60 text-lg font-bold animate-pulse tracking-widest uppercase">
                    Buddy is Listening...
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          
          <div className="mt-4 w-full max-w-2xl z-10 flex flex-col items-center">
            <div className="flex space-x-4 items-center mb-4">
              <StatusIndicator state={irisState} />
              <button 
                onClick={() => setShowTutorial(true)}
                className="bg-slate-800/50 hover:bg-slate-800 p-2.5 rounded-full border border-slate-700 transition-all hover:scale-110"
                title="How to talk to Buddy"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                  <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.962 1.241-.567.306-1.059.585-1.119 1.124l-.003.08c-.004.13.106.24.238.24h.824c.143 0 .252-.117.263-.259.051-.733.517-1.011 1.126-1.342.666-.36 1.304-.71 1.304-1.745 0-1.342-1.054-2.109-2.333-2.109-1.277 0-2.315.69-2.427 1.812m2.44 5.305c0 .524.423.948.956.948.534 0 .957-.424.957-.948 0-.525-.423-.948-.957-.948a.96.96 0 0 0-.956.948"/>
                </svg>
              </button>
            </div>
            
            <div className="w-full h-40 mt-4 bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden flex flex-col transition-all">
              <div className="px-5 py-3 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/80">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Live Conversation Log</span>
                <button 
                  onClick={handleReset}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest"
                >
                  Restart Connection
                </button>
              </div>
              <MessageLog messages={messages} />
            </div>

            {error && (
              <div className="mt-4 px-4 py-2 bg-red-900/40 border border-red-500/30 text-red-200 text-xs rounded-full animate-pulse font-bold tracking-wide">
                ⚠️ {error}
              </div>
            )}
          </div>
        </>
      )}

      <div className="absolute bottom-8 text-slate-500 text-[10px] text-center z-10 tracking-[0.3em] font-black uppercase opacity-60">
        <p>Listening for <span className="text-blue-400 italic">"Hey Buddy"</span></p>
      </div>
    </div>
  );
};

export default App;

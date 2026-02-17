
import React from 'react';
import { IrisState } from '../types';

interface IrisOrbProps {
  state: IrisState;
}

const IrisOrb: React.FC<IrisOrbProps> = ({ state }) => {
  const getGlowClass = () => {
    switch (state) {
      case IrisState.ACTIVE_LISTENING: return 'listening-glow bg-emerald-500';
      case IrisState.THINKING: return 'thinking-glow bg-purple-500';
      case IrisState.SPEAKING: return 'orb-glow bg-blue-400 scale-110';
      case IrisState.ERROR: return 'shadow-[0_0_80px_20px_rgba(239,68,68,0.5)] bg-red-500';
      default: return 'orb-glow bg-blue-500 opacity-60';
    }
  };

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Outer Pulse Rings */}
      {(state === IrisState.ACTIVE_LISTENING || state === IrisState.SPEAKING) && (
        <>
          <div className="absolute w-full h-full rounded-full border border-blue-500/30 animate-ping" />
          <div className="absolute w-4/5 h-4/5 rounded-full border border-blue-400/20 animate-[ping_2s_infinite]" />
        </>
      )}

      {/* Main Orb */}
      <div 
        className={`w-32 h-32 rounded-full transition-all duration-700 flex items-center justify-center animate-[pulse-custom_3s_infinite] ${getGlowClass()}`}
      >
        {/* Inner Core */}
        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
          <div className={`w-4 h-4 rounded-full bg-white transition-all duration-300 ${state === IrisState.THINKING ? 'animate-bounce' : ''}`} />
        </div>
      </div>

      {/* Visualizer Lines */}
      {state === IrisState.SPEAKING && (
        <div className="absolute bottom-[-40px] flex space-x-1 items-end h-8">
          {[...Array(10)].map((_, i) => (
            <div 
              key={i} 
              className="w-1 bg-blue-400 rounded-full animate-[bounce_0.5s_infinite]"
              style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default IrisOrb;

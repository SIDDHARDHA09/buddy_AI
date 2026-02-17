
import React from 'react';
import { IrisState } from '../types';

interface StatusIndicatorProps {
  state: IrisState;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ state }) => {
  const getStatus = () => {
    switch (state) {
      case IrisState.LISTENING_WAKEWORD: 
        return { label: 'Sleeping', color: 'text-slate-500', icon: '●' };
      case IrisState.ACTIVE_LISTENING: 
        return { label: 'Hearing You', color: 'text-emerald-400', icon: '●' };
      case IrisState.THINKING: 
        return { label: 'Buddy is Thinking', color: 'text-purple-400', icon: '○' };
      case IrisState.SPEAKING: 
        return { label: 'Buddy Speaking', color: 'text-blue-400', icon: '○' };
      case IrisState.ERROR: 
        return { label: 'System Issues', color: 'text-red-500', icon: '!' };
      default: 
        return { label: 'Standby', color: 'text-slate-600', icon: '●' };
    }
  };

  const status = getStatus();

  return (
    <div className="flex items-center space-x-3 bg-slate-900/90 px-5 py-2 rounded-full border border-slate-800/80 shadow-inner">
      <span className={`text-[10px] ${status.color} animate-pulse`}>{status.icon}</span>
      <span className={`text-[9px] font-black uppercase tracking-[0.25em] ${status.color}`}>
        {status.label}
      </span>
    </div>
  );
};

export default StatusIndicator;

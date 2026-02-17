
import React, { useEffect, useRef } from 'react';
import { Message } from '../types';

interface MessageLogProps {
  messages: Message[];
}

const MessageLog: React.FC<MessageLogProps> = ({ messages }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-700 text-xs font-bold uppercase tracking-[0.3em] p-6 text-center">
        Buddy is waiting for you to say "Hey Buddy"
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth scrollbar-hide">
      {messages.map((msg, i) => (
        <div 
          key={i} 
          className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-3 duration-500`}
        >
          <div className="flex items-center space-x-2 mb-1.5 opacity-60">
            <span className={`text-[9px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-slate-500' : 'text-blue-400'}`}>
              {msg.role === 'user' ? 'You' : 'Buddy'}
            </span>
          </div>
          <div 
            className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm font-medium leading-relaxed shadow-lg ${
              msg.role === 'user' 
                ? 'bg-slate-800/80 text-white rounded-tr-none border border-slate-700/50' 
                : 'bg-blue-600/10 text-blue-50 border border-blue-500/20 rounded-tl-none'
            }`}
          >
            {msg.text}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageLog;

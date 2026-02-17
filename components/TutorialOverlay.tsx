
import React, { useState } from 'react';

interface TutorialStep {
  title: string;
  description: string;
  highlight?: string;
}

const steps: TutorialStep[] = [
  {
    title: "Hi! I'm Buddy",
    description: "I'm your friendly AI companion. I'm built to be completely hands-free so you can just chat with me like a real person.",
  },
  {
    title: "Wake Word",
    description: "To get my attention when I'm sleeping, just say 'Hey Buddy'. My orb will glow bright green when I hear you!",
    highlight: "Hey Buddy"
  },
  {
    title: "Let's Chat",
    description: "You can ask me anything—tell me a joke, ask about the world, or just vent! I'm here to listen and help out.",
  },
  {
    title: "Visual Cues",
    description: "Watch my colors: Green means I'm listening, Purple means I'm thinking, and Blue means I'm talking to you.",
  },
  {
    title: "Ready?",
    description: "Close this guide and try saying 'Hey Buddy' out loud. I can't wait to meet you!",
  }
];

interface TutorialOverlayProps {
  onClose: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 max-w-md w-full shadow-[0_0_100px_rgba(59,130,246,0.1)] mx-4 transform transition-all scale-100">
        <div className="flex justify-between items-center mb-8">
          <div className="flex space-x-1.5">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-500 ${i === currentStep ? 'w-10 bg-blue-500' : 'w-2 bg-slate-800'}`} 
              />
            ))}
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]"
          >
            Skip Guide
          </button>
        </div>

        <h2 className="text-3xl font-black text-white mb-6 animate-in slide-in-from-left-4 duration-500 tracking-tight">
          {steps[currentStep].title}
        </h2>
        
        <p className="text-slate-400 text-lg leading-relaxed mb-10 min-h-[100px] animate-in fade-in duration-700">
          {steps[currentStep].description}
          {steps[currentStep].highlight && (
            <span className="block mt-4 text-blue-400 font-mono font-bold text-2xl drop-shadow-lg animate-pulse">
              "{steps[currentStep].highlight}"
            </span>
          )}
        </p>

        <div className="flex justify-between items-center">
          <button 
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
              currentStep === 0 ? 'text-slate-800 cursor-not-allowed' : 'text-slate-400 hover:text-white'
            }`}
          >
            Back
          </button>
          <button 
            onClick={handleNext}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black transition-all transform active:scale-90 shadow-xl shadow-blue-500/30"
          >
            {currentStep === steps.length - 1 ? "Start Chatting" : "Next Step"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;

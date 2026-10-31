import React from 'react';
import { Zap } from 'lucide-react';

interface FloatingEmergencyBarProps {
  onOpenAssessment: () => void;
  onScrollToTop: () => void;
}

export const FloatingEmergencyBar: React.FC<FloatingEmergencyBarProps> = ({
  onOpenAssessment,
}) => {
  return (
    <div className="fixed bottom-6 right-20 sm:right-24 z-40 hidden sm:flex items-center">
      {/* Floating Audit Pill */}
      <button
        type="button"
        onClick={onOpenAssessment}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#121816]/95 hover:bg-[#182320] border border-[#B7FF35]/35 text-xs font-mono font-bold text-[#F2F5EF] shadow-2xl shadow-black/80 hover:border-[#B7FF35] transition-all cursor-pointer backdrop-blur-md"
        id="floating-assessment-btn"
      >
        <span className="w-2 h-2 rounded-full bg-[#B7FF35] animate-ping" />
        <Zap className="w-3.5 h-3.5 text-[#B7FF35]" />
        <span>Audit Restriction</span>
      </button>
    </div>
  );
};



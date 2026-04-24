import React from 'react';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Delete, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PinKeypadProps {
  onInput: (value: string) => void;
  onDelete: () => void;
  onClear: () => void;
  className?: string;
}

export const PinKeypad: React.FC<PinKeypadProps> = ({ onInput, onDelete, onClear, className }) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];

  return (
    <div className={cn("bg-[#0066CC] w-full p-4 pt-4 pb-12 sm:pt-8 sm:pb-10 flex flex-col items-center gap-3 sm:gap-6", className)}>
      <div className="flex items-center gap-2 bg-black/10 px-3 py-1 rounded-full border border-white/5">
        <ShieldCheck className="w-3.5 h-3.5 text-white/70" />
        <span className="text-[9px] font-black text-white/70 uppercase tracking-widest">보안 키패드 작동중</span>
      </div>

      <div className="grid grid-cols-3 w-full max-w-[240px] gap-x-4 gap-y-2 sm:gap-y-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => onInput(num.toString())}
            className="text-2xl font-black text-white hover:bg-white/10 active:scale-90 transition-all w-full aspect-square flex items-center justify-center rounded-full"
          >
            {num}
          </button>
        ))}
        
        <button
          onClick={onClear}
          className="text-[10px] font-black text-white/50 hover:text-white transition-colors flex items-center justify-center px-1"
        >
          초기화
        </button>
        
        <button
          onClick={() => onInput('0')}
          className="text-2xl font-black text-white hover:bg-white/10 active:scale-90 transition-all aspect-square flex items-center justify-center rounded-full"
        >
          0
        </button>

        <button
          onClick={onDelete}
          className="text-white hover:bg-white/10 active:scale-95 transition-all aspect-square flex items-center justify-center rounded-full group"
        >
          <Delete className="w-7 h-7 group-active:scale-90 transition-transform" />
        </button>
      </div>
    </div>
  );
};

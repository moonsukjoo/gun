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
    <div className={cn("bg-[#0066CC] w-full p-6 pt-10 pb-12 flex flex-col items-center gap-8", className)}>
      <div className="flex items-center gap-2 bg-black/10 px-4 py-1.5 rounded-full border border-white/10">
        <ShieldCheck className="w-4 h-4 text-white/80" />
        <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">보안 키패드 작동중</span>
      </div>

      <div className="grid grid-cols-3 w-full max-w-[320px] gap-x-8 gap-y-10">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => onInput(num.toString())}
            className="text-4xl font-black text-white hover:bg-white/10 active:scale-95 transition-all w-full aspect-square flex items-center justify-center rounded-full"
          >
            {num}
          </button>
        ))}
        
        <button
          onClick={onClear}
          className="text-xs font-black text-white/50 hover:text-white transition-colors flex items-center justify-center"
        >
          전체삭제
        </button>
        
        <button
          onClick={() => onInput('0')}
          className="text-4xl font-black text-white hover:bg-white/10 active:scale-95 transition-all aspect-square flex items-center justify-center rounded-full"
        >
          0
        </button>

        <button
          onClick={onDelete}
          className="text-white hover:bg-white/10 active:scale-95 transition-all aspect-square flex items-center justify-center rounded-full group"
        >
          <Delete className="w-8 h-8 group-active:scale-90 transition-transform" />
        </button>
      </div>
    </div>
  );
};

import * as React from 'react';
import { useState } from 'react';
import { Tag, X } from 'lucide-react';

interface CategoryInputProps {
    value: string[];
    onChange: (categories: string[]) => void;
}

export const CategoryInput = ({ value = [], onChange }: CategoryInputProps) => {
    const [input, setInput] = useState('');

    const addCategory = (e?: React.KeyboardEvent) => {
        if (e && e.key !== 'Enter') return;
        if (e) e.preventDefault();

        const val = input.trim();
        if (val && !value.includes(val)) {
            onChange([...value, val]);
            setInput('');
        }
    };

    const removeCategory = (cat: string) => {
        onChange(value.filter((c: string) => c !== cat));
    };

    return (
        <div className="space-y-3">
            <label className="text-sm font-semibold text-[#A3A3A3] ml-1 flex items-center gap-2">
                <Tag size={16} /> Categories / Cuisines
            </label>
            <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 focus-within:border-[#FF4D00]/50 transition-all min-h-[59px]">
                {value.map((cat: string) => (
                    <span key={cat} className="flex items-center gap-1 px-3 py-1 bg-[#FF4D00]/20 text-[#FF4D00] rounded-lg text-sm font-bold border border-[#FF4D00]/30 animate-in zoom-in-50 duration-200">
                        {cat}
                        <button type="button" onClick={() => removeCategory(cat)} className="hover:text-white">
                            <X size={14} />
                        </button>
                    </span>
                ))}
                <input
                    placeholder={value.length === 0 ? "Add categories (e.g. Pizza, Burgers + Enter)" : "Add more..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={addCategory}
                    className="bg-transparent border-none outline-none text-white text-sm flex-1 min-w-[150px] px-2"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                {['Zimbabwean', 'Fast Food', 'Pizza', 'Burgers', 'Deli', 'Healthy', 'Drinks'].map(preset => (
                    !value.includes(preset) && (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => onChange([...value, preset])}
                            className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-[#404040] hover:text-[#FF4D00] hover:bg-[#FF4D00]/5 transition-all"
                        >
                            + {preset}
                        </button>
                    )
                ))}
            </div>
        </div>
    );
};

import * as React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const SectionHeader = ({ icon, title, description }: any) => (
    <div className="flex items-start gap-6 mb-2">
        <div className="w-14 h-14 rounded-2xl bg-[#FF4D00]/10 flex items-center justify-center text-[#FF4D00] shadow-inner shadow-[#FF4D00]/5">
            {icon}
        </div>
        <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-[#A3A3A3]">{description}</p>
        </div>
    </div>
);

export const InputField = ({ label, error, ...props }: any) => (
    <div className="space-y-2">
        <label className="text-sm font-semibold text-[#A3A3A3] ml-1">{label}</label>
        <input
            className={cn(
                "input-field",
                error && "border-red-500/50 ring-2 ring-red-500/20"
            )}
            {...props}
        />
        {error && <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{error}</p>}
    </div>
);

export const SelectField = ({ label, children, ...props }: any) => (
    <div className="space-y-2">
        <label className="text-sm font-semibold text-[#A3A3A3] ml-1">{label}</label>
        <select className="input-field h-[59px]" {...props}>
            {children}
        </select>
    </div>
);

export const getStepTitle = (step: number) => {
    switch (step) {
        case 1: return 'Business Identity';
        case 2: return 'Location & Area';
        case 3: return 'Operation & Delivery';
        case 4: return 'Payments & Payout';
        case 5: return 'Initial Menu Setup';
        default: return '';
    }
};

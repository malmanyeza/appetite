import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Config aligned with UI Spec requirements
const statusConfig: Record<string, { label: string, classes: string }> = {
    'confirmed': { label: 'Confirmed', classes: 'bg-slate-500/20 text-blue-400 border-blue-500/30' },
    'preparing': { label: 'Preparing', classes: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    'ready_for_pickup': { label: 'Ready', classes: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    'picked_up': { label: 'Picked Up', classes: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
    'on_the_way': { label: 'On the Way', classes: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
    'delivered': { label: 'Delivered', classes: 'bg-green-500/20 text-green-400 border-green-500/30' },
    'cancelled': { label: 'Cancelled', classes: 'bg-red-500/20 text-red-500 border-red-500/30' },
};

export const StatusPill = ({ status, className }: { status: string, className?: string }) => {
    const config = statusConfig[status] || { label: status, classes: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };

    return (
        <span className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
            config.classes,
            className
        )}>
            {config.label}
        </span>
    );
};

import React from 'react';
import { MapPin } from 'lucide-react';

interface LandmarkAddressProps {
    address: {
        suburb: string;
        city: string;
        landmark_notes: string;
        street?: string;
    };
    showIcon?: boolean;
    className?: string;
}

export const LandmarkAddress = ({ address, showIcon = true, className = '' }: LandmarkAddressProps) => {
    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            <div className="flex items-start gap-2">
                {showIcon && <MapPin size={16} className="text-muted shrink-0 mt-0.5" />}
                <div className="flex flex-col">
                    {/* Suburb BIG */}
                    <span className="text-base font-bold text-white uppercase tracking-wide">
                        {address.suburb}
                    </span>
                    {/* Landmark BIG, usually accent color */}
                    <span className="text-sm font-semibold text-accent leading-tight">
                        {address.landmark_notes}
                    </span>
                    {/* Street SMALL */}
                    {address.street && (
                        <span className="text-xs text-muted mt-0.5">
                            {address.street}, {address.city}
                        </span>
                    )}
                    {/* Fallback if no street */}
                    {!address.street && (
                        <span className="text-xs text-muted mt-0.5">
                            {address.city}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

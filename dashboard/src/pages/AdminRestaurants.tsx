import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { restaurantService } from '../lib/services';
import {
    Plus,
    Search,
    MapPin,
    Star,
    MoreVertical,
    ExternalLink,
    ShieldCheck
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const AdminRestaurants = () => {
    const navigate = useNavigate();
    const { data: restaurants, isLoading } = useQuery({
        queryKey: ['admin-restaurants'],
        queryFn: restaurantService.getAllRestaurants
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Restaurants</h1>
                    <p className="text-muted-foreground text-sm">Manage restaurant partners and onboarding</p>
                </div>
                <button
                    onClick={() => navigate('/admin/restaurants/new/settings')}
                    className="btn-primary flex items-center gap-2 px-6"
                >
                    <Plus className="w-4 h-4" />
                    Add Restaurant
                </button>
            </div>

            <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white/5 border-b border-white/5 text-xs uppercase tracking-wider text-muted font-bold">
                            <tr>
                                <th className="px-6 py-5">Restaurant</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5">Location</th>
                                <th className="px-6 py-5">Rating</th>
                                <th className="px-6 py-5">Total Orders</th>
                                <th className="px-6 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted">Loading restaurants...</td>
                                </tr>
                            ) : restaurants?.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted">No restaurants found.</td>
                                </tr>
                            ) : restaurants?.map((rest) => (
                                <tr key={rest.id} className="hover:bg-white/[0.03] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 shrink-0">
                                                <img
                                                    src={rest.cover_image_url || 'https://images.unsplash.com/photo-1552566626-52f8b828add9'}
                                                    className="w-full h-full object-cover"
                                                    alt={rest.name}
                                                />
                                            </div>
                                            <span className="font-bold text-base text-white">{rest.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                            rest.is_open ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                        )}>
                                            {rest.is_open ? 'Open' : 'Closed'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-muted flex items-center gap-2">
                                        <MapPin size={14} /> {rest.suburb || 'Unknown'}, {rest.city}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 font-bold">
                                            <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                                            {rest.rating_avg || 'New'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-white">
                                        {/* Mock Data */}
                                        1,240
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => navigate(`/admin/restaurants/${rest.id}/menu`)}
                                                className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 text-muted hover:text-white"
                                            >
                                                <ExternalLink size={14} /> Menu
                                            </button>
                                            <button
                                                onClick={() => navigate(`/admin/restaurants/${rest.id}/settings`)}
                                                className="px-3 py-2 border border-white/5 hover:bg-white/5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 text-muted hover:text-white"
                                            >
                                                <ShieldCheck size={14} /> Settings
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

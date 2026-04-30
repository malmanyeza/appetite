import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantService } from '../lib/services';
import {
    Plus,
    Search,
    MapPin,
    Star,
    MoreVertical,
    ExternalLink,
    ShieldCheck,
    Wand2,
    Trash2,
    CheckSquare,
    Square
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const AdminRestaurants = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = React.useState(false);

    const { data: restaurants, isLoading } = useQuery({
        queryKey: ['admin-restaurants'],
        queryFn: restaurantService.getAllRestaurants
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            if (ids.length === 1) {
                await restaurantService.deleteRestaurant(ids[0]);
            } else {
                await restaurantService.deleteRestaurants(ids);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
            setSelectedIds(new Set());
            setIsDeleting(false);
        },
        onError: (error: any) => {
            alert('Failed to delete: ' + error.message);
            setIsDeleting(false);
        }
    });

    const toggleSelectAll = () => {
        if (selectedIds.size === restaurants?.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(restaurants?.map(r => r.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleDelete = (ids: string[]) => {
        const message = ids.length === 1 
            ? 'Are you sure you want to delete this restaurant? This will remove all its menu items and locations.' 
            : `Are you sure you want to delete ${ids.length} restaurants? This action cannot be undone.`;
        
        if (window.confirm(message)) {
            setIsDeleting(true);
            deleteMutation.mutate(ids);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Restaurants</h1>
                    <p className="text-muted-foreground text-sm">Manage restaurant partners and onboarding</p>
                </div>
                <div className="flex items-center gap-4">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={() => handleDelete(Array.from(selectedIds))}
                            disabled={isDeleting}
                            className="btn-primary bg-red-500 hover:bg-red-600 flex items-center gap-2 px-6 shadow-red-500/20"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Selected ({selectedIds.size})
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/admin/mass-menu')}
                        className="btn-primary bg-purple-600 hover:bg-purple-500 flex items-center gap-2 px-6 shadow-purple-500/20"
                    >
                        <Wand2 className="w-4 h-4" />
                        Mass Deploy Menu
                    </button>
                    <button
                        onClick={() => navigate('/admin/restaurants/new/settings')}
                        className="btn-primary flex items-center gap-2 px-6"
                    >
                        <Plus className="w-4 h-4" />
                        Add Restaurant
                    </button>
                </div>
            </div>

            <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white/5 border-b border-white/5 text-xs uppercase tracking-wider text-muted font-bold">
                            <tr>
                                <th className="px-6 py-5 w-10">
                                    <button 
                                        onClick={toggleSelectAll}
                                        className="text-muted hover:text-white transition-colors"
                                    >
                                        {selectedIds.size === restaurants?.length && restaurants?.length > 0 ? (
                                            <CheckSquare className="w-5 h-5 text-accent" />
                                        ) : (
                                            <Square className="w-5 h-5" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-5">Restaurant</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5 text-center">Branches</th>
                                <th className="px-6 py-5">Menu</th>
                                <th className="px-6 py-5">Total Orders</th>
                                <th className="px-6 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted">Loading restaurants...</td>
                                </tr>
                            ) : restaurants?.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted">No restaurants found.</td>
                                </tr>
                            ) : restaurants?.map((rest) => (
                                <tr 
                                    key={rest.id} 
                                    className={cn(
                                        "hover:bg-white/[0.03] transition-colors group",
                                        selectedIds.has(rest.id) && "bg-accent/5"
                                    )}
                                >
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => toggleSelect(rest.id)}
                                            className="text-muted hover:text-white transition-colors"
                                        >
                                            {selectedIds.has(rest.id) ? (
                                                <CheckSquare className="w-5 h-5 text-accent" />
                                            ) : (
                                                <Square className="w-5 h-5" />
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 shrink-0 shadow-inner">
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
                                            rest.is_open ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                                        )}>
                                            {rest.is_open ? 'Open' : 'Closed'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/5 font-bold text-white text-xs border border-white/5">
                                            {rest.locations?.[0]?.count || 0}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                            (rest.menu?.[0]?.count || 0) > 0 
                                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" 
                                                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                        )}>
                                            {(rest.menu?.[0]?.count || 0) > 0 ? `${rest.menu[0].count} Items` : 'No Menu'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-white">
                                        {(rest.orders?.[0]?.count || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                            <button
                                                onClick={() => handleDelete([rest.id])}
                                                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-bold transition-colors"
                                                title="Delete Restaurant"
                                            >
                                                <Trash2 size={14} />
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

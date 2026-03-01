import * as React from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantService } from '../lib/services';
import {
    Plus,
    Edit2,
    Trash2,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Utensils
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuthStore } from '../store/authStore';
import { ImageUploadField } from '../components/ImageUploadField';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const RestaurantMenu = () => {
    const { id: paramId } = useParams();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState<any>(null); // null, 'new', or item object
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [editImageUrl, setEditImageUrl] = useState<string>('');

    const { user, profile } = useAuthStore();
    const { data: menuItems, isLoading } = useQuery({
        queryKey: ['restaurant-menu', paramId || profile?.id],
        queryFn: async () => {
            const restaurant = paramId
                ? { id: paramId }
                : await restaurantService.getMyRestaurant(profile?.id);
            if (!restaurant) return [];
            return restaurantService.getMenu(restaurant.id);
        },
        enabled: !!paramId || !!profile?.id
    });

    const mutationOptions = {
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['restaurant-menu'] });
            setIsEditing(null);
            setIsDeleting(null);
            setEditImageUrl('');
        },
        onError: (err: any) => alert(err.message)
    };

    const addMutation = useMutation({
        mutationFn: async (item: any) => {
            const restaurant = paramId
                ? { id: paramId }
                : await restaurantService.getMyRestaurant(profile?.id);
            return restaurantService.addMenuItem({ ...item, restaurant_id: restaurant.id });
        },
        ...mutationOptions
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => restaurantService.updateMenuItem(id, data),
        ...mutationOptions
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => restaurantService.deleteMenuItem(id),
        ...mutationOptions
    });

    const toggleAvailability = useMutation({
        mutationFn: ({ id, is_available }: { id: string, is_available: boolean }) =>
            restaurantService.updateMenuAvailability(id, is_available),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurant-menu'] })
    });

    // When opening the edit modal, seed the image URL state
    const openEditModal = (item: any) => {
        setIsEditing(item);
        setEditImageUrl(item === 'new' ? '' : (item?.image_url || ''));
    };

    if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 glass animate-pulse" />)}
    </div>;

    const categories = Array.from(new Set(menuItems?.map(item => item.category) || []));

    return (
        <div className="space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Menu Management</h1>
                    <p className="text-muted">Add, edit, or remove items from your store</p>
                </div>
                <button
                    className="btn-primary flex items-center gap-2 px-6"
                    onClick={() => openEditModal('new')}
                >
                    <Plus size={20} /> Add New Item
                </button>
            </div>

            {/* Menu Item Category Lists */}
            {/* Menu Items Table */}
            {menuItems?.length === 0 && !isEditing ? (
                <div className="glass p-20 text-center space-y-4">
                    <Utensils size={48} className="mx-auto text-muted/20" />
                    <p className="text-muted">Your menu is empty. Start adding items to get orders!</p>
                </div>
            ) : (
                <div className="glass rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-xs uppercase text-muted tracking-wider border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Item</th>
                                <th className="px-6 py-4 font-semibold hidden md:table-cell">Category</th>
                                <th className="px-6 py-4 font-semibold">Price</th>
                                <th className="px-6 py-4 font-semibold text-center">Available</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {menuItems?.map(item => (
                                <tr key={item.id} className={cn(
                                    "hover:bg-white/5 transition-colors group",
                                    !item.is_available && "opacity-60"
                                )}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 shrink-0">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted/20">
                                                        <ImageIcon size={24} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-base text-white">{item.name}</p>
                                                <p className="text-xs text-muted line-clamp-1 max-w-[200px]">{item.description}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 hidden md:table-cell">
                                        <span className="bg-white/5 px-3 py-1 rounded-lg text-xs font-semibold text-muted">
                                            {item.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-accent">${item.price.toFixed(2)}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => toggleAvailability.mutate({ id: item.id, is_available: !item.is_available })}
                                            className={cn(
                                                "w-12 h-6 rounded-full relative transition-colors duration-300 focus:outline-none",
                                                item.is_available ? "bg-accent" : "bg-white/10"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded-full bg-white absolute top-1 transition-transform duration-300 shadow-sm",
                                                item.is_available ? "translate-x-7" : "translate-x-1"
                                            )} />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEditModal(item)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 text-muted hover:text-white transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Delete ${item.name}? This cannot be undone.`)) {
                                                        deleteMutation.mutate(item.id);
                                                    }
                                                }}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal for Adding/Editing */}
            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-xl glass p-8 space-y-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">{isEditing === 'new' ? 'Add Menu Item' : 'Edit Menu Item'}</h2>
                            <button onClick={() => { setIsEditing(null); setEditImageUrl(''); }} className="text-muted hover:text-white">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const data = Object.fromEntries(formData.entries());
                            const itemData = {
                                ...data,
                                price: parseFloat(data.price as string),
                                image_url: editImageUrl || null,
                                is_available: true
                            };

                            if (isEditing === 'new') {
                                addMutation.mutate(itemData);
                            } else {
                                updateMutation.mutate({ id: isEditing.id, data: itemData });
                            }
                        }} className="space-y-6">

                            {/* ── Food Photo Upload ── */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted">Food Photo</label>
                                <ImageUploadField
                                    value={editImageUrl}
                                    onUpload={(url: string) => setEditImageUrl(url)}
                                    path={`menu/${user?.id}`}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted">Item Name</label>
                                <input name="name" required defaultValue={isEditing?.name} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent/50" />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted">Category</label>
                                    <input name="category" required placeholder="Main, Drinks, Desserts" defaultValue={isEditing?.category} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent/50" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted">Price (USD)</label>
                                    <input name="price" type="number" step="0.01" required defaultValue={isEditing?.price} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent/50" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted">Description</label>
                                <textarea name="description" rows={3} defaultValue={isEditing?.description} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent/50" />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => { setIsEditing(null); setEditImageUrl(''); }} className="flex-1 px-6 py-3 rounded-xl border border-white/10 font-bold hover:bg-white/5 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 btn-primary py-3 font-bold">
                                    {isEditing === 'new' ? 'Create Item' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

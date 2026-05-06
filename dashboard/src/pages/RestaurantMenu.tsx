import * as React from 'react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantService } from '../lib/services';
import { supabase } from '../lib/supabase';
import {
    Plus,
    Edit2,
    Trash2,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Utensils,
    X,
    ChevronLeft
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuthStore } from '../store/authStore';
import { ImageUploadField } from '../components/ImageUploadField';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const RestaurantMenu = () => {
    const navigate = useNavigate();
    const { id: paramId } = useParams();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'items' | 'modifiers'>('items');
    const [isEditing, setIsEditing] = useState<any>(null); // null, 'new', or item object
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [editImageUrl, setEditImageUrl] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [addons, setAddons] = useState<{ name: string; price: number }[]>([]);
    const [branchAvailabilityItem, setBranchAvailabilityItem] = useState<any>(null); // item object if modal open
    const [branchSearch, setBranchSearch] = useState('');
    const [selectedModifierGroups, setSelectedModifierGroups] = useState<string[]>([]);
    const [selectedSuggestedCategories, setSelectedSuggestedCategories] = useState<string[]>([]);

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

    const { data: menuCategories } = useQuery({
        queryKey: ['menu-categories', paramId || profile?.id],
        queryFn: async () => {
            const restaurant = paramId
                ? { id: paramId }
                : await restaurantService.getMyRestaurant(profile?.id);
            if (!restaurant) return [];
            const { data, error } = await supabase.from('menu_categories').select('*').eq('restaurant_id', restaurant.id).order('sort_order', { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!paramId || !!profile?.id
    });

    const { data: modifierGroups } = useQuery({
        queryKey: ['modifier-groups', paramId || profile?.id],
        queryFn: async () => {
            const restaurant = paramId
                ? { id: paramId }
                : await restaurantService.getMyRestaurant(profile?.id);
            if (!restaurant) return [];
            const { data, error } = await supabase
                .from('modifier_groups')
                .select('*, modifier_options(*)')
                .eq('restaurant_id', restaurant.id)
                .order('name');
            if (error) throw error;
            return data;
        },
        enabled: !!paramId || !!profile?.id
    });

    const { data: locations } = useQuery({
        queryKey: ['restaurant-locations', paramId || profile?.id],
        queryFn: async () => {
            const restaurant = paramId
                ? { id: paramId }
                : await restaurantService.getMyRestaurant(profile?.id);
            if (!restaurant) return [];
            return restaurantService.getLocations(restaurant.id);
        },
        enabled: !!paramId || !!profile?.id
    });

    const { data: branchMapping, refetch: refetchBranchMapping } = useQuery({
        queryKey: ['branch-availability', branchAvailabilityItem?.id],
        queryFn: () => restaurantService.getItemBranchAvailability(branchAvailabilityItem.id),
        enabled: !!branchAvailabilityItem?.id
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
            const result = await restaurantService.addMenuItem({ ...item, restaurant_id: restaurant.id });
            
            // Sync modifier groups
            if (selectedModifierGroups.length > 0) {
                const mappings = selectedModifierGroups.map(groupId => ({
                    menu_item_id: result.id,
                    modifier_group_id: groupId
                }));
                await supabase.from('menu_item_modifier_groups').insert(mappings);
            }
            return result;
        },
        ...mutationOptions
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            const result = await restaurantService.updateMenuItem(id, data);
            
            // Sync modifier groups
            await supabase.from('menu_item_modifier_groups').delete().eq('menu_item_id', id);
            if (selectedModifierGroups.length > 0) {
                const mappings = selectedModifierGroups.map(groupId => ({
                    menu_item_id: id,
                    modifier_group_id: groupId
                }));
                await supabase.from('menu_item_modifier_groups').insert(mappings);
            }
            return result;
        },
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

    const toggleBranchAvailability = useMutation({
        mutationFn: ({ locationId, menuItemId, isAvailable }: { locationId: string, menuItemId: string, isAvailable: boolean }) =>
            restaurantService.updateLocationAvailability(locationId, menuItemId, isAvailable),
        onSuccess: () => refetchBranchMapping()
    });

    const openEditModal = async (item: any) => {
        setIsEditing(item);
        setEditImageUrl(item === 'new' ? '' : (item?.image_url || ''));
        setAddons(item === 'new' ? [] : (item?.add_ons || []));
        setSelectedSuggestedCategories(item === 'new' ? [] : (item?.suggested_addon_category_ids || []));
        
        if (item !== 'new') {
            const { data, error } = await supabase
                .from('menu_item_modifier_groups')
                .select('modifier_group_id')
                .eq('menu_item_id', item.id);
            if (!error) {
                setSelectedModifierGroups(data.map(d => d.modifier_group_id));
            }
        } else {
            setSelectedModifierGroups([]);
        }
    };

    if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 glass animate-pulse" />)}
    </div>;

    return (
        <div className="space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    {paramId && (
                        <button
                            onClick={() => navigate('/admin/restaurants')}
                            className="p-2 hover:bg-white/5 rounded-xl text-muted hover:text-white transition-colors border border-white/5"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold">Menu Management</h1>
                        <p className="text-muted text-sm">Add, edit, or remove items from {paramId ? 'this store' : 'your store'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-6 border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('items')}
                        className={cn(
                            "pb-4 text-sm font-bold border-b-2 transition-all",
                            activeTab === 'items' ? "border-accent text-accent" : "border-transparent text-muted hover:text-white"
                        )}
                    >
                        Menu Items
                    </button>
                    <button
                        onClick={() => setActiveTab('modifiers')}
                        className={cn(
                            "pb-4 text-sm font-bold border-b-2 transition-all",
                            activeTab === 'modifiers' ? "border-accent text-accent" : "border-transparent text-muted hover:text-white"
                        )}
                    >
                        Modifier Groups
                    </button>
                </div>

                {activeTab === 'items' && (
                    <button
                        className="btn-primary flex items-center gap-2 px-6"
                        onClick={() => openEditModal('new')}
                    >
                        <Plus size={20} /> Add New Item
                    </button>
                )}
            </div>

            {activeTab === 'items' ? (
                <>
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
                                                    {item.menu_categories?.name || item.category || 'Uncategorized'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-accent">${item.price.toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center gap-2">
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
                                                    {locations && locations.length > 1 && (
                                                        <button
                                                            onClick={() => setBranchAvailabilityItem(item)}
                                                            className="text-[10px] font-bold text-accent/60 hover:text-accent underline uppercase tracking-tighter"
                                                        >
                                                            Per Branch
                                                        </button>
                                                    )}
                                                </div>
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
                </>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold">Modifier Groups</h3>
                            <p className="text-sm text-muted">Create reusable customizations like "Spice Level" or "Extra Toppings".</p>
                        </div>
                        <button
                            onClick={() => {
                                const name = prompt('Group Name (e.g. Spice Level):');
                                if (!name) return;
                                const min = parseInt(prompt('Minimum selections (e.g. 1 for required):', '0') || '0');
                                const max = parseInt(prompt('Maximum selections (e.g. 1 for single choice):', '1') || '1');
                                
                                const rId = paramId || menuItems?.[0]?.restaurant_id;
                                if (!rId) {
                                    alert('Please add at least one menu item first to determine restaurant ID.');
                                    return;
                                }

                                supabase.from('modifier_groups').insert({
                                    restaurant_id: rId,
                                    name,
                                    min_selection: min,
                                    max_selection: max
                                }).then(() => queryClient.invalidateQueries({ queryKey: ['modifier-groups'] }));
                            }}
                            className="btn-primary px-6 py-2 flex items-center gap-2"
                        >
                            <Plus size={18} /> New Group
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {modifierGroups?.map((group: any) => (
                            <div key={group.id} className="glass p-6 space-y-4">
                                <div className="flex justify-between items-start border-b border-white/5 pb-4">
                                    <div>
                                        <h4 className="font-bold text-lg text-white">{group.name}</h4>
                                        <p className="text-xs text-muted uppercase tracking-widest mt-1">
                                            {group.min_selection} to {group.max_selection} selections
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (confirm('Delete this group?')) {
                                                supabase.from('modifier_groups').delete().eq('id', group.id)
                                                    .then(() => queryClient.invalidateQueries({ queryKey: ['modifier-groups'] }));
                                            }
                                        }}
                                        className="text-red-500 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {group.modifier_options?.map((opt: any) => (
                                        <div key={opt.id} className="flex justify-between items-center bg-white/5 px-4 py-2 rounded-lg text-sm">
                                            <span>{opt.name}</span>
                                            <div className="flex items-center gap-4">
                                                <span className="text-accent font-bold">${opt.price.toFixed(2)}</span>
                                                <button
                                                    onClick={() => {
                                                        supabase.from('modifier_options').delete().eq('id', opt.id)
                                                            .then(() => queryClient.invalidateQueries({ queryKey: ['modifier-groups'] }));
                                                    }}
                                                    className="text-muted hover:text-red-400 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            const name = prompt('Option name (e.g. Extra Cheese):');
                                            if (!name) return;
                                            const price = parseFloat(prompt('Extra price (e.g. 0.50):', '0') || '0');
                                            supabase.from('modifier_options').insert({
                                                group_id: group.id,
                                                name,
                                                price
                                            }).then(() => queryClient.invalidateQueries({ queryKey: ['modifier-groups'] }));
                                        }}
                                        className="w-full py-2 border border-dashed border-white/10 rounded-lg text-xs text-muted hover:text-white hover:border-white/20 transition-all font-bold"
                                    >
                                        + Add Option
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {(!modifierGroups || modifierGroups.length === 0) && (
                        <div className="glass p-20 text-center space-y-4">
                            <Plus size={48} className="mx-auto text-muted/20" />
                            <p className="text-muted">No modifier groups created yet.</p>
                        </div>
                    )}
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
                            const categoryName = menuCategories?.find((c: any) => c.id === data.category_id)?.name || '';
                            
                            const itemData = {
                                ...data,
                                category: categoryName,
                                price: parseFloat(data.price as string),
                                image_url: editImageUrl || null,
                                add_ons: addons,
                                is_available: true,
                                suggested_addon_category_ids: selectedSuggestedCategories
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
                                    <select 
                                        name="category_id" 
                                        required 
                                        defaultValue={isEditing?.category_id} 
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent/50 text-white"
                                    >
                                        <option value="">Select Category</option>
                                        {menuCategories?.map((cat: any) => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                    {isEditing?.category && !isEditing?.category_id && (
                                        <p className="text-[10px] text-accent/60 mt-1 italic">Legacy category: {isEditing.category} (please re-assign above)</p>
                                    )}
                                    <p className="text-[10px] text-muted mt-1 italic">💡 Manage categories in Restaurant Settings</p>
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

                            {/* ── Modifier Groups Selection ── */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold uppercase tracking-wider text-accent">Modifier Groups</label>
                                    <p className="text-[10px] text-muted italic">Groups of options (e.g. Spice Level)</p>
                                </div>
                                
                                {modifierGroups && modifierGroups.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {modifierGroups.map((group: any) => (
                                            <label 
                                                key={group.id} 
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                                    selectedModifierGroups.includes(group.id)
                                                        ? "bg-accent/10 border-accent/30 text-white"
                                                        : "bg-white/5 border-white/5 text-muted hover:bg-white/10"
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedModifierGroups.includes(group.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedModifierGroups([...selectedModifierGroups, group.id]);
                                                        } else {
                                                            setSelectedModifierGroups(selectedModifierGroups.filter(id => id !== group.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-white/20 bg-black/50 text-accent focus:ring-accent accent-accent"
                                                />
                                                <span className="text-xs font-medium">{group.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted italic">No modifier groups created. Go to the "Modifier Groups" tab to create one.</p>
                                )}
                            </div>

                            {/* ── Suggested Add-on Categories Selection ── */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold uppercase tracking-wider text-accent">Suggest Add-ons from Categories</label>
                                    <p className="text-[10px] text-muted italic">Pick categories to show as optional check-boxes</p>
                                </div>
                                
                                {menuCategories && menuCategories.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {menuCategories.map((cat: any) => (
                                            <label 
                                                key={cat.id} 
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                                    selectedSuggestedCategories.includes(cat.id)
                                                        ? "bg-purple-400/10 border-purple-400/30 text-white"
                                                        : "bg-white/5 border-white/5 text-muted hover:bg-white/10"
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSuggestedCategories.includes(cat.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedSuggestedCategories([...selectedSuggestedCategories, cat.id]);
                                                        } else {
                                                            setSelectedSuggestedCategories(selectedSuggestedCategories.filter(id => id !== cat.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-white/20 bg-black/50 text-purple-400 focus:ring-purple-400 accent-purple-400"
                                                />
                                                <span className="text-xs font-medium">{cat.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted italic">No categories found. Create categories in Restaurant Settings first.</p>
                                )}
                                <p className="text-[10px] text-muted mt-1">💡 Selected categories will appear in the mobile app as optional checkboxes for this item.</p>
                            </div>

                            {/* ── Add-ons / Extras ── */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold uppercase tracking-wider text-accent">Extras & Toppings (Legacy)</label>
                                    <button
                                        type="button"
                                        onClick={() => setAddons([...addons, { name: '', price: 0 }])}
                                        className="text-xs bg-accent/20 text-accent px-3 py-1.5 rounded-lg hover:bg-accent/30 transition-colors font-bold"
                                    >
                                        + Add Extra
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {(addons || []).map((addon, index) => (
                                        <div key={index} className="flex gap-3 items-center animate-in slide-in-from-right-2 duration-300">
                                            <input
                                                placeholder="e.g. Extra Cheese"
                                                value={addon.name}
                                                onChange={(e) => {
                                                    const newAddons = [...addons];
                                                    newAddons[index].name = e.target.value;
                                                    setAddons(newAddons);
                                                }}
                                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                            />
                                            <div className="relative w-24">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted text-xs">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={addon.price}
                                                    onChange={(e) => {
                                                        const newAddons = [...addons];
                                                        newAddons[index].price = parseFloat(e.target.value) || 0;
                                                        setAddons(newAddons);
                                                    }}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-5 pr-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent text-right"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setAddons(addons.filter((_, i) => i !== index))}
                                                className="text-red-400 p-2 hover:bg-red-400/10 rounded-lg transition-colors"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {(!addons || addons.length === 0) && (
                                        <p className="text-xs text-muted italic">No extras defined for this item.</p>
                                    )}
                                </div>
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

            {/* Branch Availability Modal */}
            {branchAvailabilityItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-lg glass p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold">Branch Availability</h2>
                                <p className="text-sm text-muted mt-1">{branchAvailabilityItem.name}</p>
                            </div>
                            <button onClick={() => setBranchAvailabilityItem(null)} className="text-muted hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="relative">
                            <Plus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted rotate-0" />
                            <input
                                type="text"
                                placeholder="Search branches..."
                                value={branchSearch}
                                onChange={(e) => setBranchSearch(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                        </div>

                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {locations?.filter((l: any) => 
                                l.location_name.toLowerCase().includes(branchSearch.toLowerCase()) ||
                                l.suburb.toLowerCase().includes(branchSearch.toLowerCase())
                            ).map((loc: any) => {
                                const isLocAvailable = (branchMapping as any[])?.find(m => m.location_id === loc.id)?.is_available ?? true;
                                return (
                                    <div key={loc.id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                        <div>
                                            <p className="font-bold text-sm text-white">{loc.location_name}</p>
                                            <p className="text-xs text-muted">{loc.suburb}, {loc.city}</p>
                                        </div>
                                        <button
                                            onClick={() => toggleBranchAvailability.mutate({
                                                locationId: loc.id,
                                                menuItemId: branchAvailabilityItem.id,
                                                isAvailable: !isLocAvailable
                                            })}
                                            className={cn(
                                                "px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider",
                                                isLocAvailable 
                                                    ? "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20" 
                                                    : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                                            )}
                                        >
                                            {isLocAvailable ? 'Available' : 'Unavailable'}
                                        </button>
                                    </div>
                                );
                            })}
                            {locations?.length === 0 && (
                                <p className="text-center text-muted text-sm py-10 italic">No branches found for this restaurant.</p>
                            )}
                        </div>

                        <button
                            onClick={() => setBranchAvailabilityItem(null)}
                            className="w-full btn-primary py-3 font-bold"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

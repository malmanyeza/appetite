import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantService } from '../lib/services';
import { supabase } from '../lib/supabase';
import { Search, ChevronLeft, Save, UploadCloud, Wand2, CheckSquare, Square } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const AdminMassMenuScanner = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [isScanning, setIsScanning] = useState(false);
    const [scannedItems, setScannedItems] = useState<any[]>([]);
    const [menuUrl, setMenuUrl] = useState('');
    
    // Selection state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());

    const { data: restaurants, isLoading: loadingRestaurants } = useQuery({
        queryKey: ['admin-restaurants'],
        queryFn: restaurantService.getAllRestaurants
    });

    const [isDeploying, setIsDeploying] = useState(false);

    const filteredRestaurants = restaurants?.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.suburb?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const toggleRestaurant = (id: string) => {
        const newSet = new Set(selectedRestaurants);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedRestaurants(newSet);
    };

    const toggleAllFiltered = () => {
        if (filteredRestaurants.length === 0) return;
        const allSelected = filteredRestaurants.every(r => selectedRestaurants.has(r.id));
        const newSet = new Set(selectedRestaurants);
        
        if (allSelected) {
            filteredRestaurants.forEach(r => newSet.delete(r.id));
        } else {
            filteredRestaurants.forEach(r => newSet.add(r.id));
        }
        setSelectedRestaurants(newSet);
    };

    const handleMenuUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Data = reader.result as string;
                const { data, error } = await supabase.functions.invoke('scan-menu-ai', {
                    body: { imageBase64: base64Data, mimeType: file.type }
                });

                if (error) throw new Error(error.message || 'Failed to scan menu.');
                if (data?.error) throw new Error(data.error);

                setScannedItems(data.items || []);
                setIsScanning(false);
            };
            reader.readAsDataURL(file);
        } catch (error: any) {
            alert('AI Scan Failed: ' + error.message);
            setIsScanning(false);
        }
    };

    const handleUrlScan = async () => {
        if (!menuUrl) return;
        setIsScanning(true);
        try {
            const { data, error } = await supabase.functions.invoke('scan-menu-ai', {
                body: { url: menuUrl }
            });
            if (error) throw new Error(error.message || 'Failed to scan website.');
            if (data?.error) throw new Error(data.error);

            setScannedItems(data.items || []);
            setIsScanning(false);
        } catch (error: any) {
            alert('AI Website Scan Failed: ' + error.message);
            setIsScanning(false);
        }
    };

    const handleDeployMassMenu = async () => {
        if (selectedRestaurants.size === 0) {
            alert('Please select at least one restaurant to deploy to.');
            return;
        }
        if (scannedItems.length === 0) {
            alert('Please scan a menu first.');
            return;
        }

        if (!window.confirm(`Deploy ${scannedItems.length} items to ${selectedRestaurants.size} branches? This cannot be undone.`)) {
            return;
        }

        setIsDeploying(true);
        try {
            const restaurantIds = Array.from(selectedRestaurants);
            
            // Loop through each selected restaurant
            for (const restId of restaurantIds) {
                // Loop through each scanned item
                for (const item of scannedItems) {
                    await restaurantService.addMenuItem({
                        restaurant_id: restId,
                        name: item.name,
                        description: item.description || '',
                        price: parseFloat(item.price) || 0,
                        category: item.category || 'Specials',
                        image_url: item.image_url || '',
                        add_ons: item.add_ons || [],
                        is_available: true
                    });
                }
            }

            alert(`✅ Mass Deployment Successful! Deployed ${scannedItems.length} items to ${selectedRestaurants.size} branches.`);
            setScannedItems([]);
            setSelectedRestaurants(new Set());
            queryClient.invalidateQueries({ queryKey: ['restaurant-menu'] }); 
        } catch (error: any) {
             alert('Failed to mass-deploy items: ' + error.message);
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <header className="flex justify-between items-center bg-surface p-6 rounded-2xl border border-white/5">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/restaurants')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                        <ChevronLeft size={20} className="text-muted" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2"><Wand2 className="text-purple-400" /> Global Mass Menu Deployer</h1>
                        <p className="text-muted text-sm mt-1">Scan a menu once and instantly push it to dozens of restaurant profiles.</p>
                    </div>
                </div>
                <button
                    onClick={handleDeployMassMenu}
                    disabled={isDeploying || selectedRestaurants.size === 0 || scannedItems.length === 0}
                    className="btn-primary bg-purple-600 hover:bg-purple-500 flex items-center gap-2 px-8 py-3 shadow-lg shadow-purple-500/20 disabled:opacity-50"
                >
                    <Save size={18} /> {isDeploying ? 'Deploying to Multiple...' : `Deploy to ${selectedRestaurants.size} Branches`}
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: AI Scanner */}
                <div className="space-y-6">
                    <div className="glass p-8 rounded-2xl">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-purple-400 mb-4">Step 1: Parse Menu</h3>
                        
                        {!scannedItems.length ? (
                            <>
                                <div className="mt-2 border-2 border-dashed border-white/20 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-white/5 hover:bg-white/10 transition-colors relative cursor-pointer">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={handleMenuUpload} 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 m-0 z-10"
                                        disabled={isScanning}
                                    />
                                    {isScanning ? (
                                        <div className="space-y-4 flex flex-col items-center text-center">
                                            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin pointer-events-none" />
                                            <p className="font-bold text-white pointer-events-none">AI is reading the menu...</p>
                                            <p className="text-xs text-muted pointer-events-none">This usually takes about 5-10 seconds.</p>
                                        </div>
                                    ) : (
                                        <div className="pointer-events-none flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
                                                <UploadCloud size={32} />
                                            </div>
                                            <h4 className="font-bold text-white mb-2">Click to Upload Menu Photo</h4>
                                            <p className="text-sm text-muted max-w-xs">Scan the menu once. We'll pick where it goes next.</p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-6 flex items-center gap-4 w-full">
                                    <div className="h-[1px] flex-1 bg-white/10" />
                                    <span className="text-xs font-bold text-muted uppercase tracking-widest">OR</span>
                                    <div className="h-[1px] flex-1 bg-white/10" />
                                </div>
                                <div className="mt-6 space-y-3">
                                    <p className="text-sm font-bold text-white pl-1">Extract directly from Website URL</p>
                                    <div className="flex gap-2">
                                        <input 
                                            type="url" 
                                            placeholder="https://restaurant.com/menu" 
                                            value={menuUrl}
                                            onChange={(e) => setMenuUrl(e.target.value)}
                                            className="input-field flex-1"
                                            disabled={isScanning}
                                        />
                                        <button 
                                            type="button"
                                            onClick={handleUrlScan} 
                                            disabled={!menuUrl || isScanning}
                                            className="btn-primary py-2 px-6"
                                        >
                                            Scan Link
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted">The AI will safely open the website and extract all food items automatically.</p>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl">
                                    <p className="text-purple-300 font-medium font-bold">✨ Extracted {scannedItems.length} items</p>
                                    <button onClick={() => setScannedItems([])} className="text-xs text-muted hover:text-white px-3 py-1 bg-white/5 rounded-lg">Discard & Re-scan</button>
                                </div>
                                <div className="max-h-[500px] overflow-y-auto custom-scrollbar space-y-3 pr-2">
                                    {scannedItems.map((item, idx) => (
                                        <div key={idx} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col">
                                            {item.image_url ? (
                                                <img 
                                                    src={item.image_url} 
                                                    alt={item.name}
                                                    className="w-full h-28 object-cover"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div className="w-full h-28 bg-white/5 flex items-center justify-center text-muted text-[10px]">No image</div>
                                            )}
                                            <div className="p-3 flex flex-col gap-1">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-bold text-sm text-white">{item.name}</h4>
                                                    <span className="font-bold text-accent text-sm">${parseFloat(item.price).toFixed(2)}</span>
                                                </div>
                                                <p className="text-[10px] font-bold text-purple-400 flex items-center gap-1 uppercase tracking-widest">{item.category}</p>
                                                {item.description && <p className="text-xs text-muted">{item.description}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Restaurant Targeting */}
                <div className="glass p-8 rounded-2xl flex flex-col h-[calc(100vh-12rem)] min-h-[600px]">
                    <h3 className="text-xl font-bold flex items-center gap-2 mb-2">Step 2: Select Targets</h3>
                    <p className="text-sm text-muted mb-6">Choose all the branches that should receive this exact menu.</p>
                    
                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                            type="text"
                            placeholder="Find specific branches (e.g. KFC)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-field pl-11 py-3"
                        />
                    </div>

                    <div className="flex justify-between items-center py-3 border-b border-white/10 mb-2 px-2">
                        <span className="text-sm font-bold text-white">{selectedRestaurants.size} branches selected</span>
                        <button 
                            onClick={toggleAllFiltered} 
                            className="text-xs font-bold text-accent hover:text-accent/80 transition-colors"
                        >
                            Select All {filteredRestaurants.length} Results
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {loadingRestaurants ? (
                            <p className="text-center text-muted py-8 text-sm">Loading restaurants...</p>
                        ) : filteredRestaurants.length === 0 ? (
                            <p className="text-center text-muted py-8 text-sm">No branches match your search.</p>
                        ) : (
                            filteredRestaurants.map(rest => (
                                <div 
                                    key={rest.id} 
                                    onClick={() => toggleRestaurant(rest.id)}
                                    className={cn(
                                        "p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-4",
                                        selectedRestaurants.has(rest.id) 
                                            ? "bg-accent/10 border-accent/30" 
                                            : "bg-white/5 border-transparent hover:bg-white/10"
                                    )}
                                >
                                    <div className={cn("text-muted transition-colors", selectedRestaurants.has(rest.id) && "text-accent")}>
                                        {selectedRestaurants.has(rest.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                                    </div>
                                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                                        <img src={rest.cover_image_url || 'https://images.unsplash.com/photo-1552566626-52f8b828add9'} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 truncate">
                                        <h4 className={cn("font-bold text-sm truncate", selectedRestaurants.has(rest.id) ? "text-white" : "text-gray-300")}>{rest.name}</h4>
                                        <p className="text-xs text-muted truncate">{rest.suburb || 'Unknown'}, {rest.city}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

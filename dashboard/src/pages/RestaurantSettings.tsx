import * as React from 'react';
import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantService, adminService } from '../lib/services';
import { supabase } from '../lib/supabase';
import {
    Store,
    Clock,
    MapPin,
    Save,
    ChevronRight,
    ChevronLeft,
    CheckCircle2,
    DollarSign,
    Utensils,
    Plus,
    Trash2,
    Mail,
    Lock,
    UserPlus,
    Phone,
    X,
    UploadCloud,
    Wand2,
    ImageIcon,
    Search,
    Eye,
    EyeOff
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { ImageUploadField } from '../components/ImageUploadField';
import { CategoryInput } from '../components/CategoryInput';
import { SectionHeader, InputField, SelectField, getStepTitle } from '../components/FormComponents';
import { MapPicker } from '../components/MapPicker';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const RestaurantSettings = () => {
    const { id: paramId } = useParams();
    const { user, profile } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const isAdminRoute = location.pathname.startsWith('/admin');
    const [step, setStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);

    // Persistent form state for onboarding
    const [registrationData, setRegistrationData] = useState<any>({});
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Credentials state for admin-created restaurant accounts
    const [credentials, setCredentials] = useState({ email: '', password: '', fullName: '', phone: '' });
    const [showPassword, setShowPassword] = useState(false);

    // New menu items state for onboarding
    const [onboardingMenu, setOnboardingMenu] = useState<any[]>([]);

    // AI Scanner state
    const [isScanning, setIsScanning] = useState(false);
    const [scannedItems, setScannedItems] = useState<any[]>([]);
    const [menuUrl, setMenuUrl] = useState('');

    // Total steps: 6 for admin (includes credentials step), 5 for restaurant self-edit
    const totalSteps = isAdminRoute ? 6 : 5;

    // ─── EXISTING RESTAURANT: TABBED EDIT VIEW ────────────────────────
    const [activeTab, setActiveTab] = useState<'store' | 'payouts' | 'locations' | 'menu-scanner'>('store');
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [selectedLocationForEdit, setSelectedLocationForEdit] = useState<any>(null);
    const [locationDetails, setLocationDetails] = useState({
        city: '',
        suburb: '',
        physical_address: ''
    });
    const [locationSearchTerm, setLocationSearchTerm] = useState('');

    const { data: restaurant, isLoading } = useQuery({
        queryKey: ['restaurant-settings', paramId || profile?.id],
        queryFn: async () => {
            if (paramId) {
                if (paramId === 'new') return null;
                const { data, error } = await supabase.from('restaurants').select('*').eq('id', paramId).single();
                if (error) throw error;
                return data;
            }
            return restaurantService.getMyRestaurant(profile?.id);
        }
    });

    const updateRestaurant = useMutation({
        mutationFn: async (updatedData: any) => {
            setIsSaving(true);
            try {
                const isCreation = paramId === 'new' || !restaurant;
                let ownerId: string;

                // If admin is creating a new restaurant, create the user account first
                if (isCreation && isAdminRoute) {
                    if (!credentials.email || !credentials.password || !credentials.fullName) {
                        throw new Error('Please fill in the restaurant owner credentials (Step 1)');
                    }
                    ownerId = await adminService.createRestaurantUser(
                        credentials.email,
                        credentials.password,
                        credentials.fullName,
                        credentials.phone
                    );
                } else {
                    ownerId = isCreation ? user?.id : restaurant?.manager_id;
                }

                if (!ownerId) throw new Error('User not authenticated');

                const targetId = isCreation ? crypto.randomUUID() : (restaurant?.id || paramId);

                const allowedColumns = [
                    'id', 'manager_id', 'name', 'description', 'business_type',
                    'physical_address', 'landmark_notes', 'owner_phone', 'owner_email',
                    'days_open', 'opening_time', 'closing_time', 'avg_prep_time',
                    'payout_method', 'payout_number', 'payout_name', 'fulfillment_type',
                    'city', 'suburb', 'is_open', 'cover_image_url', 'categories', 'lat', 'lng'
                ];

                const sanitizedData = Object.keys(updatedData)
                    .filter(key => allowedColumns.includes(key))
                    .reduce((obj, key) => {
                        obj[key] = updatedData[key];
                        return obj;
                    }, {} as any);

                const result = await restaurantService.upsertRestaurant({
                    ...restaurant,
                    ...sanitizedData,
                    id: targetId,
                    manager_id: ownerId
                });

                if (isCreation && onboardingMenu.length > 0) {
                    for (const item of onboardingMenu) {
                        await restaurantService.addMenuItem({ ...item, restaurant_id: result.id });
                    }
                }

                return result;
            } finally {
                setIsSaving(false);
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['restaurant-settings', paramId] });
            queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });

            if (paramId === 'new' || !restaurant) {
                alert('Restaurant registered successfully!');
                navigate(paramId === 'new' ? `/admin/restaurants/${data.id}/settings` : '/restaurant/overview', { replace: true });
            } else {
                alert('Restaurant profile saved successfully!');
            }
        },
        onError: (error: any) => {
            console.error('Registration/Update Error:', error);
            alert(`Error: ${error.message || 'Operation failed. Please check console for details.'}`);
        }
    });

    const { data: locations, refetch: refetchLocations } = useQuery({
        queryKey: ['restaurant-locations', restaurant?.id],
        queryFn: () => restaurantService.getLocations(restaurant?.id),
        enabled: !!restaurant?.id && activeTab === 'locations'
    });

    const upsertLocation = useMutation({
        mutationFn: (data: any) => restaurantService.upsertLocation({ 
            ...data, 
            ...locationDetails,
            restaurant_id: restaurant.id 
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['restaurant-locations'] });
            setIsLocationModalOpen(false);
            setSelectedLocationForEdit(null);
            alert('Location saved successfully!');
        },
        onError: (error: any) => alert(`Error: ${error.message}`)
    });

    const deleteLocation = useMutation({
        mutationFn: (id: string) => restaurantService.deleteLocation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['restaurant-locations'] });
            alert('Location deleted successfully!');
        }
    });

    if (isLoading) return <div className="animate-pulse space-y-8">
        <div className="h-64 glass rounded-2xl" />
        <div className="h-96 glass rounded-2xl" />
    </div>;

    const isNew = !restaurant || paramId === 'new';

    const handleNext = (currentFormData: any) => {
        const newData = { ...registrationData, ...currentFormData };
        setRegistrationData(newData);

        const errors: Record<string, string> = {};

        // Determine which step maps to which validation
        const identityStep = isAdminRoute ? 2 : 1;
        const locationStep = isAdminRoute ? 3 : 2;
        const payoutStep = isAdminRoute ? 5 : 4;

        if (step === 1 && isAdminRoute) {
            // Validate credentials step
            if (!credentials.email) errors.email = 'Email is required';
            if (!credentials.password || credentials.password.length < 6) errors.password = 'Password must be at least 6 characters';
            if (!credentials.fullName) errors.fullName = 'Full name is required';
        } else if (step === identityStep) {
            if (!newData.name) errors.name = 'Restaurant name is required';
            if (!newData.owner_phone) errors.owner_phone = 'Owner phone is required';
        } else if (step === locationStep) {
            if (!newData.suburb) errors.suburb = 'Suburb is required';
        } else if (step === payoutStep) {
            if (!newData.payout_number) errors.payout_number = 'Payout number is required';
            if (!newData.payout_name) errors.payout_name = 'Payout name is required';
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        setValidationErrors({});
        setStep(s => s + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBack = () => setStep(s => s - 1);

    const handleGetLocation = (forNewRest: boolean) => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (forNewRest) {
                    setRegistrationData((prev: any) => ({ ...prev, lat: latitude, lng: longitude }));
                } else {
                    updateRestaurant.mutate({ lat: latitude, lng: longitude });
                }
            },
            (error) => {
                alert(`Error getting location: ${error.message}`);
            }
        );
    };

    const addMenuItem = () => {
        setOnboardingMenu([...onboardingMenu, { name: '', price: 0, category: 'Main', is_available: true }]);
    };

    const removeMenuItem = (index: number) => {
        setOnboardingMenu(onboardingMenu.filter((_, i) => i !== index));
    };

    const updateOnboardingMenuItem = (index: number, field: string, value: any) => {
        const newMenu = [...onboardingMenu];
        newMenu[index] = { ...newMenu[index], [field]: value };
        setOnboardingMenu(newMenu);
    };

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        const days = formData.getAll('days_open');
        const finalData = { ...data, days_open: days };

        if (isNew && step < totalSteps) {
            handleNext(finalData);
        } else {
            const submissionData = { ...registrationData, ...finalData };

            if (!submissionData.name) {
                setValidationErrors({ name: 'Restaurant name is missing. Please go back to the Identity step.' });
                if (isNew) setStep(isAdminRoute ? 2 : 1);
                return;
            }

            if (isNew) {
                if (onboardingMenu.length < 3) {
                    alert('Please add at least 3 signature menu items to register.');
                    return;
                }
                for (let i = 0; i < onboardingMenu.length; i++) {
                    if (!onboardingMenu[i].name || !onboardingMenu[i].price) {
                        alert(`Please complete the details for Menu Item ${i + 1}`);
                        return;
                    }
                }
            }

            updateRestaurant.mutate(submissionData);
        }
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

                if (error) throw new Error(error.message || 'Failed to scan menu. Make sure the Edge Function is deployed.');
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
            if (error) throw new Error(error.message || 'Failed to scan website. Make sure Edge Function is deployed.');
            if (data?.error) throw new Error(data.error);

            setScannedItems(data.items || []);
            setIsScanning(false);
        } catch (error: any) {
            alert('AI Website Scan Failed: ' + error.message);
            setIsScanning(false);
        }
    };

    const handleSaveScannedMenu = async () => {
        setIsSaving(true);
        try {
            for (const item of scannedItems) {
                await restaurantService.addMenuItem({
                    restaurant_id: restaurant.id,
                    name: item.name,
                    description: item.description || '',
                    price: parseFloat(item.price) || 0,
                    category: item.category || 'Specials',
                    image_url: item.image_url || '',
                    add_ons: item.add_ons || [],
                    is_available: true
                });
            }
            alert(`Successfully saved ${scannedItems.length} items to your menu!`);
            setScannedItems([]);
            queryClient.invalidateQueries({ queryKey: ['restaurant-menu'] }); 
        } catch (error: any) {
             alert('Failed to save items: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // ─── EXISTING RESTAURANT: TABBED EDIT VIEW ────────────────────────

    if (!isNew) {
        return (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
                <header className="flex justify-between items-end">
                    <div className="flex items-center gap-4">
                        {isAdminRoute && !isNew && (
                            <button
                                onClick={() => navigate('/admin/restaurants')}
                                className="p-2 hover:bg-white/5 rounded-xl text-muted hover:text-white transition-colors border border-white/5"
                            >
                                <ChevronLeft size={24} />
                            </button>
                        )}
                        <div className="space-y-1">
                            <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
                            <p className="text-muted text-sm font-medium">Manage your store operations and payouts</p>
                        </div>
                    </div>
                    <button
                        form="settings-form"
                        type="submit"
                        className="btn-primary flex items-center gap-2 px-8 py-3 shadow-lg shadow-accent/20"
                        disabled={isSaving}
                    >
                        <Save size={18} /> {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </header>

                {/* Tabs */}
                <div className="flex border-b border-white/10 gap-8">
                    <button
                        onClick={() => setActiveTab('store')}
                        className={cn("pb-4 text-sm font-bold border-b-2 transition-all", activeTab === 'store' ? "border-accent text-accent" : "border-transparent text-muted hover:text-white")}
                    >
                        Store Profile
                    </button>
                    <button
                        onClick={() => setActiveTab('locations')}
                        className={cn("pb-4 text-sm font-bold border-b-2 transition-all", activeTab === 'locations' ? "border-accent text-accent" : "border-transparent text-muted hover:text-white")}
                    >
                        Locations
                    </button>
                    <button
                        onClick={() => setActiveTab('payouts')}
                        className={cn("pb-4 text-sm font-bold border-b-2 transition-all", activeTab === 'payouts' ? "border-accent text-accent" : "border-transparent text-muted hover:text-white")}
                    >
                        Payouts Info
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('menu-scanner')}
                        className={cn("pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2", activeTab === 'menu-scanner' ? "border-purple-400 text-purple-400" : "border-transparent text-muted hover:text-white")}
                    >
                        <Wand2 size={16} /> AI Scanner
                    </button>
                </div>

                <form id="settings-form" onSubmit={handleFormSubmit} className="space-y-8">

                    {activeTab === 'store' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            {/* Big Open/Closed Toggle */}
                            <div className="glass p-8 rounded-2xl flex items-center justify-between border-l-4 border-l-accent">
                                <div>
                                    <h2 className="text-xl font-bold mb-1">Store Status</h2>
                                    <p className="text-sm text-muted">Instantly open or close your store to customers.</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={cn("font-bold text-lg", restaurant?.is_open ? "text-green-400" : "text-muted")}>
                                        {restaurant?.is_open ? "OPEN" : "CLOSED"}
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="is_open"
                                            value="true"
                                            className="sr-only peer"
                                            defaultChecked={restaurant?.is_open}
                                            onChange={(e) => {
                                                if (e.target.checked && (!restaurant?.lat || !restaurant?.lng)) {
                                                    e.preventDefault();
                                                    e.target.checked = false;
                                                    alert('Cannot open restaurant. You must Set GPS Coordinates first in the Address section.');
                                                    return;
                                                }
                                                // Instant optimistic update just for visuals
                                                updateRestaurant.mutate({ is_open: e.target.checked });
                                            }}
                                        />
                                        <div className="w-16 h-8 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                                    </label>
                                </div>
                            </div>

                            {/* Profile Image - NEW SECTION for existing restaurants */}
                            <div className="glass p-8 space-y-6">
                                <h3 className="font-bold flex items-center gap-2 border-b border-white/5 pb-4"><Store size={18} className="text-accent" /> Store Appearance</h3>
                                <div className="max-w-md">
                                    <label className="text-sm font-semibold text-[#A3A3A3] ml-1 mb-4 block">Restaurant Cover Image</label>
                                    <ImageUploadField
                                        value={restaurant?.cover_image_url}
                                        onUpload={(url: string) => updateRestaurant.mutate({ cover_image_url: url })}
                                        path={`restaurants/${restaurant?.id || profile?.id}`}
                                    />
                                    <p className="text-xs text-muted mt-4 italic">💡 This image will be shown to customers when browsing and on your store page.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="glass p-8 space-y-6">
                                    <h3 className="font-bold flex items-center gap-2 border-b border-white/5 pb-4"><Clock size={18} className="text-accent" /> Operating Hours</h3>

                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-muted uppercase tracking-widest">Days Open</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                                <label key={day} className="flex-1 min-w-[3rem] text-center">
                                                    <input type="checkbox" name="days_open" value={day} defaultChecked={restaurant?.days_open?.includes(day)} className="peer hidden" />
                                                    <div className="py-2 text-xs font-bold rounded-lg bg-white/5 border border-white/10 peer-checked:bg-accent/20 peer-checked:text-accent peer-checked:border-accent/50 cursor-pointer transition-all">
                                                        {day}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <InputField label="Opening Time" name="opening_time" type="time" defaultValue={restaurant?.opening_time || '08:00'} />
                                        <InputField label="Closing Time" name="closing_time" type="time" defaultValue={restaurant?.closing_time || '20:00'} />
                                    </div>
                                </div>

                                <div className="glass p-8 space-y-6">
                                    <h3 className="font-bold flex items-center gap-2 border-b border-white/5 pb-4"><MapPin size={18} className="text-accent" /> Address & Delivery</h3>
                                    <InputField label="City" name="city" defaultValue={restaurant?.city} />
                                    <InputField label="Physical Address" name="physical_address" defaultValue={restaurant?.physical_address} />

                                    <div className="pt-4 border-t border-white/5 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold uppercase tracking-widest text-[#A3A3A3] ml-1">GPS Coordinates *</label>
                                            <button
                                                type="button"
                                                onClick={() => handleGetLocation(false)}
                                                className="text-xs font-bold text-accent bg-accent/10 px-3 py-1.5 rounded hover:bg-accent/20 transition-colors flex items-center gap-1"
                                            >
                                                <MapPin size={12} /> Use Current Location
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputField 
                                                label="Latitude" 
                                                name="lat" 
                                                type="number" 
                                                step="any" 
                                                required 
                                                value={restaurant?.lat || 0} 
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRestaurant.mutate({ lat: parseFloat(e.target.value) })}
                                                placeholder="-17.82..." 
                                            />
                                            <InputField 
                                                label="Longitude" 
                                                name="lng" 
                                                type="number" 
                                                step="any" 
                                                required 
                                                value={restaurant?.lng || 0} 
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRestaurant.mutate({ lng: parseFloat(e.target.value) })}
                                                placeholder="31.05..." 
                                            />
                                        </div>
                                        <MapPicker 
                                            lat={restaurant?.lat || -17.8248} 
                                            lng={restaurant?.lng || 31.0530} 
                                            onChange={(lat, lng) => updateRestaurant.mutate({ lat, lng })}
                                        />
                                    </div>

                                    <SelectField label="Delivery Radius (km)" name="delivery_radius_km" defaultValue={restaurant?.delivery_radius_km || 5}>
                                        <option value="3">3 km Radius</option>
                                        <option value="5">5 km Radius</option>
                                        <option value="8">8 km Radius</option>
                                        <option value="10">10 km+ Radius</option>
                                    </SelectField>
                                </div>
                            </div>

                            <div className="glass p-8 space-y-6">
                                <h3 className="font-bold flex items-center gap-2 border-b border-white/5 pb-4"><Store size={18} className="text-accent" /> Basic Info</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <InputField label="Restaurant Name" name="name" required defaultValue={restaurant?.name} />
                                    <InputField label="Contact Number" name="owner_phone" defaultValue={restaurant?.owner_phone} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'locations' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold flex items-center gap-2"><MapPin size={20} className="text-accent" /> Manage Locations</h3>
                                    <p className="text-xs text-muted">Filter and manage your restaurant branches</p>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="relative flex-1 md:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search branches..."
                                            value={locationSearchTerm}
                                            onChange={(e) => setLocationSearchTerm(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent/50 transition-all"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedLocationForEdit(null);
                                            setLocationDetails({ city: '', suburb: '', physical_address: '' });
                                            setIsLocationModalOpen(true);
                                        }}
                                        className="btn-primary flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap"
                                    >
                                        <Plus size={16} /> Add Location
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {locations?.filter((loc: any) => {
                                    if (!locationSearchTerm) return true;
                                    const search = locationSearchTerm.toLowerCase();
                                    return (
                                        loc.location_name?.toLowerCase().includes(search) ||
                                        loc.city?.toLowerCase().includes(search) ||
                                        loc.suburb?.toLowerCase().includes(search) ||
                                        loc.physical_address?.toLowerCase().includes(search)
                                    );
                                }).map((loc: any) => (
                                    <div key={loc.id} className="glass p-6 rounded-2xl flex justify-between items-center group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                                                <MapPin size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg">{loc.location_name}</h4>
                                                <p className="text-sm text-muted">
                                                    {[loc.suburb, loc.city].filter(Boolean).join(', ') || loc.physical_address || 'No location details'}
                                                </p>
                                                {loc.phone && <p className="text-xs text-accent/80 mt-1 flex items-center gap-1"><Store size={10} /> {loc.phone}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedLocationForEdit(loc);
                                                    setLocationDetails({
                                                        city: loc.city || '',
                                                        suburb: loc.suburb || '',
                                                        physical_address: loc.physical_address || ''
                                                    });
                                                    setIsLocationModalOpen(true);
                                                }}
                                                className="p-2 hover:bg-white/5 rounded-lg text-muted hover:text-white transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (window.confirm('Are you sure you want to delete this location?')) {
                                                        deleteLocation.mutate(loc.id);
                                                    }
                                                }}
                                                className="p-2 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {(!locations || locations.length === 0) && (
                                    <div className="glass p-12 rounded-2xl border-dashed border-white/10 flex flex-col items-center justify-center text-center">
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                            <MapPin size={32} className="text-muted" />
                                        </div>
                                        <h4 className="font-bold text-white mb-2">No locations added yet</h4>
                                        <p className="text-sm text-muted max-w-xs">Add your main branch and any additional locations here to start receiving orders.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'payouts' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="glass p-8 space-y-6 border-l-4 border-l-blue-500">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2"><DollarSign size={20} className="text-blue-400" /> Payout Info</h3>
                                    <p className="text-sm text-muted mt-1">Manual payouts are processed every Tuesday for the previous week.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                                    <SelectField label="Payout Method" name="payout_method" defaultValue={restaurant?.payout_method || 'ecocash'}>
                                        <option value="ecocash">EcoCash</option>
                                        <option value="innbucks">Innbucks</option>
                                        <option value="bank">Bank Transfer</option>
                                    </SelectField>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <InputField label="Account / Phone Number" name="payout_number" required defaultValue={restaurant?.payout_number} />
                                    <InputField label="Account Name" name="payout_name" required defaultValue={restaurant?.payout_name} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'menu-scanner' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="glass p-8 space-y-6">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2 text-purple-400"><Wand2 size={20} /> AI Menu Scanner</h3>
                                    <p className="text-sm text-muted mt-1">Upload a photo of your physical menu, and our AI will instantly extract all items, prices, and toppings into your database.</p>
                                </div>
                                
                                {!scannedItems.length ? (
                                    <>
                                        <div className="mt-6 border-2 border-dashed border-white/20 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-white/5 hover:bg-white/10 transition-colors relative cursor-pointer">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={handleMenuUpload} 
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 m-0 z-10"
                                                disabled={isScanning}
                                            />
                                            {isScanning ? (
                                                <div className="space-y-4 flex flex-col items-center">
                                                    <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin pointer-events-none" />
                                                    <p className="font-bold text-white pointer-events-none">AI is reading your menu...</p>
                                                    <p className="text-xs text-muted pointer-events-none">This usually takes about 5-10 seconds.</p>
                                                </div>
                                            ) : (
                                                <div className="pointer-events-none flex flex-col items-center">
                                                    <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
                                                        <UploadCloud size={32} />
                                                    </div>
                                                    <h4 className="font-bold text-white mb-2">Click to Upload Menu Photo</h4>
                                                    <p className="text-sm text-muted max-w-xs">Supports JPG, PNG formats. Make sure the text is clearly readable.</p>
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
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl">
                                            <p className="text-purple-300 font-medium">✨ AI successfully extracted {scannedItems.length} items from your menu!</p>
                                            <div className="flex gap-4">
                                                <button type="button" onClick={() => setScannedItems([])} className="text-sm text-muted hover:text-white px-4 py-2">Discard</button>
                                                <button type="button" onClick={handleSaveScannedMenu} disabled={isSaving} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2">
                                                    <Save size={16} /> {isSaving ? 'Saving...' : 'Save All to Menu'}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {scannedItems.map((item, idx) => (
                                                <div key={idx} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col gap-0">
                                                    {item.image_url ? (
                                                        <img 
                                                            src={item.image_url} 
                                                            alt={item.name}
                                                            className="w-full h-36 object-cover"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-36 bg-white/5 flex items-center justify-center text-muted text-xs">No image</div>
                                                    )}
                                                    <div className="p-4 flex flex-col gap-2">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="font-bold text-lg text-white">{item.name}</h4>
                                                            <span className="font-bold text-accent">${parseFloat(item.price).toFixed(2)}</span>
                                                        </div>
                                                        <p className="text-xs font-bold text-purple-400 uppercase tracking-widest">{item.category}</p>
                                                        {item.description && <p className="text-sm text-muted">{item.description}</p>}
                                                        {item.add_ons && item.add_ons.length > 0 && (
                                                            <div className="mt-2 pt-2 border-t border-white/10">
                                                                <p className="text-xs text-muted font-bold mb-1">ADD-ONS:</p>
                                                                {item.add_ons.map((addon: any, i: number) => (
                                                                    <div key={i} className="flex justify-between text-xs">
                                                                        <span className="text-muted">{addon.name}</span>
                                                                        <span className="text-white">+${parseFloat(addon.price).toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </form>

                {/* Location Modal */}
                {isLocationModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                        <div className="glass w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
                            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <div>
                                    <h3 className="text-2xl font-bold text-white">{selectedLocationForEdit ? 'Edit Location' : 'Add New Location'}</h3>
                                    <p className="text-sm text-muted mt-1">Set up your branch details and GPS coordinates.</p>
                                </div>
                                <button 
                                    onClick={() => setIsLocationModalOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-xl text-muted hover:text-white transition-all text-white"
                                >
                                    <Utensils size={24} />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                                <form 
                                    id="location-form" 
                                    onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
                                        const data = Object.fromEntries(formData.entries());
                                        const days = formData.getAll('days_open');
                                        
                                        upsertLocation.mutate({
                                            ...selectedLocationForEdit,
                                            ...data,
                                            days_open: days,
                                            lat: parseFloat(data.lat as string),
                                            lng: parseFloat(data.lng as string),
                                            is_open: true
                                        });
                                    }}
                                    className="space-y-6"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <InputField label="Location Name" name="location_name" required defaultValue={selectedLocationForEdit?.location_name || ''} placeholder="e.g. Avondale Branch" />
                                        <InputField label="Contact Phone" name="phone" defaultValue={selectedLocationForEdit?.phone || ''} placeholder="+263..." />
                                    </div>

                                    <div className="space-y-6 pt-4 border-t border-white/5">
                                        <h4 className="text-sm font-bold flex items-center gap-2"><Clock size={16} className="text-accent" /> Operating Hours</h4>
                                        <div className="space-y-4">
                                            <label className="text-xs font-bold text-muted uppercase tracking-widest">Days Open</label>
                                            <div className="flex flex-wrap gap-2">
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                                    <label key={day} className="flex-1 min-w-[3rem] text-center">
                                                        <input 
                                                            type="checkbox" 
                                                            name="days_open" 
                                                            value={day} 
                                                            defaultChecked={selectedLocationForEdit?.days_open?.includes(day) || !selectedLocationForEdit} 
                                                            className="peer hidden" 
                                                        />
                                                        <div className="py-2 text-xs font-bold rounded-lg bg-white/5 border border-white/10 peer-checked:bg-accent/20 peer-checked:text-accent peer-checked:border-accent/50 cursor-pointer transition-all">
                                                            {day}
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <InputField label="Opening Time" name="opening_time" type="time" defaultValue={selectedLocationForEdit?.opening_time || '08:00'} />
                                            <InputField label="Closing Time" name="closing_time" type="time" defaultValue={selectedLocationForEdit?.closing_time || '20:00'} />
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-white/5">
                                        <label className="text-xs font-bold uppercase tracking-widest text-[#A3A3A3] ml-1">GPS Location *</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputField label="Latitude" name="lat" type="number" step="any" required defaultValue={selectedLocationForEdit?.lat || ''} />
                                            <InputField label="Longitude" name="lng" type="number" step="any" required defaultValue={selectedLocationForEdit?.lng || ''} />
                                        </div>
                                        <p className="text-xs text-muted mb-2">Drag the marker on the map to set exact coordinates.</p>
                                        <div className="h-64 rounded-2xl overflow-hidden border border-white/10">
                                            <MapPicker 
                                                lat={selectedLocationForEdit?.lat || -17.8248} 
                                                lng={selectedLocationForEdit?.lng || 31.0530} 
                                                onChange={(lat, lng) => {
                                                    const latInput = document.getElementsByName('lat')[0] as HTMLInputElement;
                                                    const lngInput = document.getElementsByName('lng')[0] as HTMLInputElement;
                                                    if (latInput) latInput.value = lat.toString();
                                                    if (lngInput) lngInput.value = lng.toString();
                                                }}
                                                onPlaceSelected={(details) => {
                                                    setLocationDetails({
                                                        city: details.city,
                                                        suburb: details.suburb,
                                                        physical_address: details.physical_address
                                                    });
                                                    const latInput = document.getElementsByName('lat')[0] as HTMLInputElement;
                                                    const lngInput = document.getElementsByName('lng')[0] as HTMLInputElement;
                                                    if (latInput) latInput.value = details.lat.toString();
                                                    if (lngInput) lngInput.value = details.lng.toString();
                                                }}
                                            />
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className="p-8 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsLocationModalOpen(false)}
                                    className="px-6 py-2.5 rounded-xl border border-white/10 text-muted hover:text-white hover:bg-white/5 transition-all text-sm font-bold"
                                >
                                    Cancel
                                </button>
                                <button 
                                    form="location-form"
                                    type="submit"
                                    className="btn-primary px-8 py-2.5 shadow-lg shadow-accent/20"
                                    disabled={upsertLocation.isPending}
                                >
                                    {upsertLocation.isPending ? 'Saving...' : 'Save Location'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }


    // Step labels based on admin vs restaurant onboarding
    const stepLabels = isAdminRoute
        ? ['Account', 'Identity', 'Location', 'Operation', 'Payout', 'Menu']
        : ['Identity', 'Location', 'Operation', 'Payout', 'Menu'];

    // ─── NEW RESTAURANT: STEPPED ONBOARDING ───────────────────────────
    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <header className="flex justify-between items-end">
                <div className="space-y-1">
                    <h1 className="text-4xl font-bold tracking-tight text-white">{isAdminRoute ? 'Register New Restaurant' : 'Partner Onboarding'}</h1>
                    <p className="text-[#A3A3A3] text-lg font-medium">
                        Step {step} of {totalSteps}: {stepLabels[step - 1]}
                    </p>
                </div>
            </header>

            {/* Progress bar */}
            <div className="space-y-6">
                <div className="flex justify-between relative">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 -translate-y-1/2 z-0" />
                    <div
                        className="absolute top-1/2 left-0 h-0.5 bg-[#FF4D00] -translate-y-1/2 z-0 transition-all duration-700 ease-out"
                        style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
                    />
                    {stepLabels.map((label, idx) => {
                        const i = idx + 1;
                        return (
                            <div key={i} className="relative z-10 flex flex-col items-center gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center font-bold transition-all duration-500",
                                    step === i ? "bg-[#FF4D00] text-white scale-110 shadow-lg shadow-[#FF4D00]/30" :
                                        step > i ? "bg-white/10 text-[#FF4D00]" : "bg-[#1A1A1A] text-[#404040]"
                                )}>
                                    {step > i ? <CheckCircle2 size={18} /> : i}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-widest transition-colors duration-500",
                                    step >= i ? "text-white" : "text-[#404040]"
                                )}>
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <form id="settings-form" onSubmit={handleFormSubmit} className="space-y-8">
                {/* Step 1: Account Credentials (Admin only) */}
                {step === 1 && isAdminRoute && (
                    <div className="glass p-10 space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                        <SectionHeader icon={<UserPlus size={24} />} title="Restaurant Owner Account" description="Create login credentials for the restaurant owner. They will use these to sign into the dashboard." />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-[#A3A3A3] ml-1">Owner Full Name *</label>
                                <div className="relative">
                                    <UserPlus size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                                    <input
                                        type="text"
                                        required
                                        value={credentials.fullName}
                                        onChange={(e) => setCredentials({ ...credentials, fullName: e.target.value })}
                                        className="input-field py-3 pl-11"
                                        placeholder="John Doe"
                                    />
                                </div>
                                {validationErrors.fullName && <p className="text-xs text-red-400 ml-1">{validationErrors.fullName}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-[#A3A3A3] ml-1">Owner Phone</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                                    <input
                                        type="tel"
                                        value={credentials.phone}
                                        onChange={(e) => setCredentials({ ...credentials, phone: e.target.value })}
                                        className="input-field py-3 pl-11"
                                        placeholder="+263..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-[#A3A3A3] ml-1">Login Email *</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                                    <input
                                        type="email"
                                        required
                                        value={credentials.email}
                                        onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                                        className="input-field py-3 pl-11"
                                        placeholder="owner@restaurant.com"
                                    />
                                </div>
                                {validationErrors.email && <p className="text-xs text-red-400 ml-1">{validationErrors.email}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-[#A3A3A3] ml-1">Login Password *</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={credentials.password}
                                        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                        className="input-field py-3 pl-11 pr-11"
                                        placeholder="Min 6 characters"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {validationErrors.password && <p className="text-xs text-red-400 ml-1">{validationErrors.password}</p>}
                            </div>
                        </div>

                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                            <p className="text-xs text-blue-400">💡 The restaurant owner will use these credentials to sign into the Partner Dashboard and manage their store, menu, and orders.</p>
                        </div>
                    </div>
                )}

                {/* Step 1 (restaurant) / Step 2 (admin): Identity */}
                {step === (isAdminRoute ? 2 : 1) && (
                    <div className="glass p-10 space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                        <SectionHeader icon={<Store size={24} />} title="Business Identity" description="Basic details about your restaurant and ownership." />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <InputField
                                    label="Restaurant Name"
                                    name="name"
                                    required
                                    defaultValue={registrationData.name}
                                    placeholder="e.g. Mama's Kitchen"
                                    error={validationErrors.name}
                                />
                                <SelectField
                                    label="Business Type"
                                    name="business_type"
                                    defaultValue={registrationData.business_type || 'restaurant'}
                                >
                                    <option value="restaurant">Restaurant</option>
                                    <option value="fast_food">Fast Food</option>
                                    <option value="cafe">Cafe</option>
                                    <option value="groceries">Groceries</option>
                                </SelectField>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-semibold text-[#A3A3A3] ml-1">Restaurant Cover Image</label>
                                <ImageUploadField
                                    value={registrationData.cover_image_url}
                                    onUpload={(url: string) => setRegistrationData({ ...registrationData, cover_image_url: url })}
                                    path={`restaurants/${user?.id}`}
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <InputField
                                label="Short Description"
                                name="description"
                                defaultValue={registrationData.description}
                                placeholder="e.g. Traditional Zimbabwean meals and fresh juices"
                            />

                            <CategoryInput
                                value={registrationData.categories || []}
                                onChange={(cats: string[]) => setRegistrationData({ ...registrationData, categories: cats })}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                            <InputField
                                label="Owner Full Name"
                                name="owner_name"
                                required
                                defaultValue={registrationData.owner_name || profile?.full_name}
                            />
                            <InputField
                                label="Owner Phone"
                                name="owner_phone"
                                required
                                defaultValue={registrationData.owner_phone || profile?.phone}
                                placeholder="+263..."
                                error={validationErrors.owner_phone}
                            />
                        </div>
                    </div>
                )}

                {step === (isAdminRoute ? 3 : 2) && (
                    <div className="glass p-10 space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                        <SectionHeader icon={<MapPin size={24} />} title="Location & Area" description="Where can customers find you and how far do you deliver?" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <InputField
                                label="City"
                                name="city"
                                required
                                defaultValue={registrationData.city || 'Harare'}
                            />
                            <InputField
                                label="Suburb"
                                name="suburb"
                                required
                                defaultValue={registrationData.suburb}
                                error={validationErrors.suburb}
                            />
                        </div>

                        <InputField
                            label="Physical Address"
                            name="physical_address"
                            placeholder="Shop number, Street name"
                            defaultValue={registrationData.physical_address}
                        />
                        <InputField
                            label="Landmark Notes"
                            name="landmark_notes"
                            placeholder="Near which major building or intersection?"
                            defaultValue={registrationData.landmark_notes}
                        />

                        <div className="pt-4 border-t border-white/5 space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold uppercase tracking-widest text-[#A3A3A3] ml-1">GPS Coordinates *</label>
                                <button
                                    type="button"
                                    onClick={() => handleGetLocation(true)}
                                    className="text-xs font-bold text-accent bg-accent/10 px-4 py-2 rounded-lg hover:bg-accent/20 transition-colors flex items-center gap-2"
                                >
                                    <MapPin size={16} /> Auto-Detect via GPS
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Latitude" name="lat" type="number" step="any" required value={registrationData.lat || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegistrationData({ ...registrationData, lat: e.target.value })} placeholder="-17.82..." />
                                <InputField label="Longitude" name="lng" type="number" step="any" required value={registrationData.lng || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegistrationData({ ...registrationData, lng: e.target.value })} placeholder="31.05..." />
                            </div>
                            <MapPicker 
                                lat={registrationData.lat} 
                                lng={registrationData.lng} 
                                onChange={(lat, lng) => setRegistrationData({ ...registrationData, lat, lng })}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                            <SelectField
                                label="Delivery Radius (km)"
                                name="delivery_radius_km"
                                defaultValue={registrationData.delivery_radius_km || 5}
                            >
                                <option value="3">3 km Radius</option>
                                <option value="5">5 km Radius</option>
                                <option value="8">8 km Radius</option>
                                <option value="10">10 km+ Radius</option>
                            </SelectField>
                        </div>
                    </div>
                )}

                {step === (isAdminRoute ? 4 : 3) && (
                    <div className="glass p-10 space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                        <SectionHeader icon={<Clock size={24} />} title="Operating Hours" description="When is your kitchen open for business?" />

                        <div className="space-y-4">
                            <label className="text-sm font-semibold text-[#A3A3A3] ml-1">Days Open</label>
                            <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                    <label key={day} className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-[#FF4D00]/10 hover:border-[#FF4D00]/30 transition-all group overflow-hidden relative">
                                        <input
                                            type="checkbox"
                                            name="days_open"
                                            value={day}
                                            defaultChecked={registrationData.days_open?.includes(day)}
                                            className="peer hidden"
                                        />
                                        <div className="absolute inset-0 bg-[#FF4D00] opacity-0 peer-checked:opacity-10 transition-opacity" />
                                        <div className="w-4 h-4 rounded border-2 border-white/20 flex items-center justify-center peer-checked:border-[#FF4D00] peer-checked:bg-[#FF4D00] transition-all">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full opacity-0 peer-checked:opacity-100" />
                                        </div>
                                        <span className="text-xs font-bold peer-checked:text-[#FF4D00] transition-colors">{day}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-8">
                            <InputField
                                label="Opening Time"
                                name="opening_time"
                                type="time"
                                defaultValue={registrationData.opening_time || '08:00'}
                            />
                            <InputField
                                label="Closing Time"
                                name="closing_time"
                                type="time"
                                defaultValue={registrationData.closing_time || '20:00'}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-8">
                            <SelectField
                                label="Store Status"
                                name="is_open"
                                defaultValue={registrationData.is_open || 'true'}
                            >
                                <option value="true">Open for Business</option>
                                <option value="false">Closed / On Break</option>
                            </SelectField>

                            <SelectField
                                label="Fulfillment Settings"
                                name="fulfillment_type"
                                defaultValue={registrationData.fulfillment_type || 'appetite_delivery'}
                            >
                                <option value="appetite_delivery">Appetite delivers (recommended)</option>
                                <option value="restaurant_delivery">Restaurant delivers (own drivers)</option>
                                <option value="pickup_only">Pickup only</option>
                            </SelectField>

                            <SelectField
                                label="Average Prep Time"
                                name="avg_prep_time"
                                defaultValue={registrationData.avg_prep_time || '15-30 mins'}
                            >
                                <option value="10-20 mins">10-20 mins</option>
                                <option value="15-30 mins">15-30 mins</option>
                                <option value="30-45 mins">30-45 mins</option>
                                <option value="45-60 mins">45-60 mins</option>
                            </SelectField>
                        </div>
                    </div>
                )}

                {step === (isAdminRoute ? 5 : 4) && (
                    <div className="glass p-10 space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                        <SectionHeader icon={<DollarSign size={24} />} title="Payments & Payouts" description="How and where should we send your earnings?" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <SelectField
                                label="Payout Method"
                                name="payout_method"
                                defaultValue={registrationData.payout_method || 'ecocash'}
                            >
                                <option value="ecocash">EcoCash</option>
                                <option value="innbucks">Innbucks</option>
                                <option value="one_money">One Money</option>
                                <option value="bank">Bank Transfer</option>
                            </SelectField>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-8">
                            <InputField
                                label="Payout Number / Account"
                                name="payout_number"
                                required
                                placeholder="e.g. 077..."
                                defaultValue={registrationData.payout_number}
                                error={validationErrors.payout_number}
                            />
                            <InputField
                                label="Payout Name"
                                name="payout_name"
                                required
                                placeholder="Name on account"
                                defaultValue={registrationData.payout_name}
                                error={validationErrors.payout_name}
                            />
                        </div>
                    </div>
                )}

                {step === (isAdminRoute ? 6 : 5) && (
                    <div className="glass p-10 space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                        <SectionHeader icon={<Utensils size={24} />} title="Initial Menu Setup" description="Add at least 3 signature items to launch your store." />

                        <div className="space-y-4">
                            {onboardingMenu.map((item, index) => (
                                <div key={index} className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6 relative transition-all group hover:bg-[#FF4D00]/5 hover:border-[#FF4D00]/20">
                                    <button
                                        type="button"
                                        onClick={() => removeMenuItem(index)}
                                        className="absolute top-4 right-4 text-[#A3A3A3] hover:text-red-500 transition-colors z-10"
                                    >
                                        <Trash2 size={20} />
                                    </button>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="md:col-span-1">
                                            <label className="text-xs font-bold uppercase tracking-widest text-[#A3A3A3] ml-1 mb-2 block">Food Picture</label>
                                            <ImageUploadField
                                                value={item.image_url}
                                                onUpload={(url: string) => updateOnboardingMenuItem(index, 'image_url', url)}
                                                path={`menu/${user?.id}`}
                                                compact
                                            />
                                        </div>

                                        <div className="md:col-span-2 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold uppercase tracking-widest text-[#A3A3A3] ml-1">Item Name</label>
                                                    <input
                                                        placeholder="e.g. Beef Burger"
                                                        value={item.name}
                                                        onChange={(e) => updateOnboardingMenuItem(index, 'name', e.target.value)}
                                                        className="input-field py-3"
                                                    />
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="space-y-2 flex-1">
                                                        <label className="text-xs font-bold uppercase tracking-widest text-[#A3A3A3] ml-1">Price (USD)</label>
                                                        <input
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={item.price}
                                                            onChange={(e) => updateOnboardingMenuItem(index, 'price', parseFloat(e.target.value))}
                                                            className="input-field py-3"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-widest text-[#A3A3A3] ml-1">Category</label>
                                                <select
                                                    value={item.category}
                                                    onChange={(e) => updateOnboardingMenuItem(index, 'category', e.target.value)}
                                                    className="input-field py-3 text-sm"
                                                >
                                                    <option value="Main">Main</option>
                                                    <option value="Drinks">Drinks</option>
                                                    <option value="Sides">Sides</option>
                                                    <option value="Desserts">Desserts</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={addMenuItem}
                                className="w-full py-10 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center gap-3 text-[#A3A3A3] hover:text-white hover:bg-white/5 hover:border-white/20 transition-all font-bold group"
                            >
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#FF4D00] group-hover:text-white transition-all">
                                    <Plus size={24} />
                                </div>
                                <span>Add Signature Item</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center pt-8">
                    {step > 1 ? (
                        <button type="button" onClick={handleBack} className="px-10 py-4 rounded-xl border border-white/10 font-bold hover:bg-white/5 flex items-center gap-2 transition-all">
                            <ChevronLeft size={20} /> Back
                        </button>
                    ) : (
                        <div />
                    )}

                    <button
                        type="submit"
                        className="btn-primary min-w-[240px] px-10 py-4 font-bold rounded-xl flex items-center justify-center gap-2 shadow-2xl shadow-[#FF4D00]/20"
                        disabled={isSaving}
                    >
                        {step < totalSteps ? (
                            <>Continue to {stepLabels[step]} <ChevronRight size={20} /></>
                        ) : (
                            <>{isSaving ? 'Processing Account...' : 'Submit Registration'} <CheckCircle2 size={20} /></>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

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
    Phone
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { ImageUploadField } from '../components/ImageUploadField';
import { CategoryInput } from '../components/CategoryInput';
import { SectionHeader, InputField, SelectField, getStepTitle } from '../components/FormComponents';

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

    // New menu items state for onboarding
    const [onboardingMenu, setOnboardingMenu] = useState<any[]>([]);

    // Total steps: 6 for admin (includes credentials step), 5 for restaurant self-edit
    const totalSteps = isAdminRoute ? 6 : 5;

    // ─── EXISTING RESTAURANT: TABBED EDIT VIEW ────────────────────────
    const [activeTab, setActiveTab] = useState<'store' | 'payouts'>('store');

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
                    setRegistrationData(prev => ({ ...prev, lat: latitude, lng: longitude }));
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

    // ─── EXISTING RESTAURANT: TABBED EDIT VIEW ────────────────────────

    if (!isNew) {
        return (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
                <header className="flex justify-between items-end">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
                        <p className="text-muted text-sm font-medium">Manage your store operations and payouts</p>
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
                        onClick={() => setActiveTab('payouts')}
                        className={cn("pb-4 text-sm font-bold border-b-2 transition-all", activeTab === 'payouts' ? "border-accent text-accent" : "border-transparent text-muted hover:text-white")}
                    >
                        Payouts Info
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
                                            <InputField label="Latitude" name="lat" type="number" step="any" required defaultValue={restaurant?.lat} placeholder="-17.82..." />
                                            <InputField label="Longitude" name="lng" type="number" step="any" required defaultValue={restaurant?.lng} placeholder="31.05..." />
                                        </div>
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
                </form>
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
                                        type="password"
                                        required
                                        value={credentials.password}
                                        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                        className="input-field py-3 pl-11"
                                        placeholder="Min 6 characters"
                                    />
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
                                <InputField label="Latitude" name="lat" type="number" step="any" required value={registrationData.lat || ''} onChange={(e) => setRegistrationData({ ...registrationData, lat: e.target.value })} placeholder="-17.82..." />
                                <InputField label="Longitude" name="lng" type="number" step="any" required value={registrationData.lng || ''} onChange={(e) => setRegistrationData({ ...registrationData, lng: e.target.value })} placeholder="31.05..." />
                            </div>
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

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../lib/services';
import { supabase } from '../lib/supabase';
import {
    Bike,
    Search,
    Filter,
    ShieldCheck,
    Star,
    MapPin,
    ChevronRight,
    X,
    TrendingUp,
    Clock,
    Navigation,
    CheckCircle2,
    XCircle,
    AlertTriangle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const AdminDrivers = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDriver, setSelectedDriver] = useState<any>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('admin-drivers-status')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'driver_profiles',
            }, (payload) => {
                queryClient.invalidateQueries({ queryKey: ['admin-drivers-list'] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const updateStatusMutation = useMutation({
        mutationFn: async ({ userId, status }: { userId: string, status: string }) => {
            await adminService.updateDriverStatus(userId, status);
            return status;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-drivers-list'] });
            setSelectedDriver(null);
        }
    });

    const { data: drivers, isLoading } = useQuery({
        queryKey: ['admin-drivers-list'],
        queryFn: adminService.getAllDrivers
    });

    const filteredDrivers = drivers?.filter(driver =>
        driver.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.phone?.includes(searchTerm)
    );

    return (
        <div className="relative min-h-[80vh] pb-20">
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">Fleet Management</h1>
                        <p className="text-muted text-sm mt-1">Monitor and manage all delivery partners</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search drivers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-sm w-full md:w-64 text-white"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-colors text-white">
                            <Filter className="w-4 h-4" />
                            Filter
                        </button>
                    </div>
                </div>

                <div className="glass rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white/5 border-b border-white/5 text-xs uppercase tracking-wider text-muted font-bold">
                                <tr>
                                    <th className="px-6 py-5">Driver</th>
                                    <th className="px-6 py-5">Status</th>
                                    <th className="px-6 py-5">Vehicle</th>
                                    <th className="px-6 py-5">Rating</th>
                                    <th className="px-6 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted">Loading fleet data...</td>
                                    </tr>
                                ) : filteredDrivers?.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted">No drivers found.</td>
                                    </tr>
                                ) : filteredDrivers?.map((driver) => {
                                    const isOnline = driver.driver_profiles?.[0]?.is_online;
                                    return (
                                        <tr
                                            key={driver.id}
                                            onClick={() => setSelectedDriver(driver)}
                                            className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                                            <UserIcon className="text-muted" size={18} />
                                                        </div>
                                                        <div className={cn(
                                                            "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#121212]",
                                                            isOnline ? "bg-green-500" : "bg-white/20"
                                                        )} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-white text-base">{driver.full_name}</h3>
                                                        <p className="text-xs text-muted">{driver.phone || 'No phone'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-2 items-start">
                                                    {driver.driver_profiles?.[0]?.status === 'pending' ? (
                                                        <span className="px-3 py-1 bg-orange-500/10 text-orange-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-orange-500/20">Pending Approval</span>
                                                    ) : driver.driver_profiles?.[0]?.status === 'rejected' ? (
                                                        <span className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-[10px] font-bold uppercase tracking-wider border border-red-500/20">Rejected</span>
                                                    ) : (
                                                        <span className={cn(
                                                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                            isOnline ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-white/5 text-muted border-white/10"
                                                        )}>
                                                            {isOnline ? 'Active' : 'Offline'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-muted">
                                                <div className="flex items-center gap-2">
                                                    <Bike size={14} />
                                                    {driver.driver_profiles?.[0]?.vehicle_type || 'Motorcycle'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 font-bold">
                                                    <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                                                    4.8 {/* Mock Data */}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white/5 group-hover:bg-accent group-hover:text-white transition-colors text-muted">
                                                    <ChevronRight size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Driver Detail Drawer */}
            {selectedDriver && (
                <>
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-in fade-in"
                        onClick={() => setSelectedDriver(null)}
                    />

                    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#121212] border-l border-white/10 shadow-2xl z-50 transform transition-transform animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h2 className="text-xl font-black">Driver Profile</h2>
                            <button
                                onClick={() => setSelectedDriver(null)}
                                className="w-10 h-10 rounded-full glass flex items-center justify-center text-muted hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">

                            {/* Header Panel */}
                            <div className="flex items-center gap-6">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                                        <UserIcon className="text-muted" size={32} />
                                    </div>
                                    <div className={cn(
                                        "absolute -bottom-2 -right-2 w-6 h-6 rounded-full border-4 border-[#121212]",
                                        selectedDriver.driver_profiles?.[0]?.is_online ? "bg-green-500" : "bg-white/20"
                                    )} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-2xl text-white">{selectedDriver.full_name}</h3>
                                    <p className="text-sm text-muted mb-2">{selectedDriver.phone || 'No phone'}</p>
                                    <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg w-fit">
                                        <Star size={12} className="text-orange-400 fill-orange-400" />
                                        <span className="text-xs font-bold text-white">4.8 Rating</span>
                                    </div>
                                </div>
                            </div>

                            {/* Live Tracking Map Mockup */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-[#FF4D00] flex items-center gap-2">
                                    <Navigation size={14} /> Live Location
                                </h3>
                                <div className="h-48 rounded-xl border border-white/5 relative overflow-hidden bg-[#1A1A1A] flex items-center justify-center">
                                    {/* Mock Map Background */}
                                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #FF4D00 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                                    {selectedDriver.driver_profiles?.[0]?.is_online ? (
                                        <div className="relative z-10 text-center space-y-3">
                                            <div className="w-12 h-12 bg-[#FF4D00] rounded-full mx-auto flex items-center justify-center animate-pulse shadow-lg shadow-[#FF4D00]/50">
                                                <Bike size={24} className="text-white" />
                                            </div>
                                            <p className="text-sm font-bold bg-black/50 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">Near Sam Levy's Village</p>
                                        </div>
                                    ) : (
                                        <div className="relative z-10 text-center space-y-2">
                                            <Navigation size={32} className="mx-auto text-muted/30" />
                                            <p className="text-sm font-medium text-muted">Location unavailable (Offline)</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Onboarding Documents & Info */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
                                    <ShieldCheck size={14} /> Onboarding Details
                                </h3>

                                <div className="space-y-4">
                                    {/* Personal Info Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">City / Area</p>
                                            <p className="text-sm font-bold text-white">
                                                {selectedDriver.driver_profiles?.[0]?.city || 'N/A'}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">Emergency Contact</p>
                                            <p className="text-sm font-bold text-white">{selectedDriver.driver_profiles?.[0]?.emergency_contact || 'None Provided'}</p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">Vehicle Plate</p>
                                            <p className="text-sm font-bold text-white max-w-[120px] truncate">{selectedDriver.driver_profiles?.[0]?.plate_number || 'N/A'}</p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">EcoCash Payout</p>
                                            <p className="text-sm font-bold text-white max-w-[120px] truncate" title={`${selectedDriver.driver_profiles?.[0]?.ecocash_number || 'None'} - ${selectedDriver.driver_profiles?.[0]?.account_name || ''}`}>
                                                {selectedDriver.driver_profiles?.[0]?.ecocash_number || 'None'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Documents */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="flex-1 space-y-2">
                                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider text-center">Driver Selfie</p>
                                            <div className="h-40 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-center overflow-hidden relative group">
                                                {selectedDriver.driver_profiles?.[0]?.selfie_url ? (
                                                    <img src={selectedDriver.driver_profiles[0].selfie_url} alt="Selfie" className="w-full h-full object-cover" />
                                                ) : (
                                                    <p className="text-xs text-muted">No Photo</p>
                                                )}
                                                {selectedDriver.driver_profiles?.[0]?.selfie_url && (
                                                    <a href={selectedDriver.driver_profiles[0].selfie_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs uppercase tracking-wider backdrop-blur-sm">View Full</a>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider text-center">National ID</p>
                                            <div className="h-40 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-center overflow-hidden relative group">
                                                {selectedDriver.driver_profiles?.[0]?.id_photo_url ? (
                                                    <img src={selectedDriver.driver_profiles[0].id_photo_url} alt="National ID" className="w-full h-full object-cover" />
                                                ) : (
                                                    <p className="text-xs text-muted">No Document</p>
                                                )}
                                                {selectedDriver.driver_profiles?.[0]?.id_photo_url && (
                                                    <a href={selectedDriver.driver_profiles[0].id_photo_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs uppercase tracking-wider backdrop-blur-sm">View Full</a>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider text-center">Reg. Book</p>
                                            <div className="h-40 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-center overflow-hidden relative group">
                                                {selectedDriver.driver_profiles?.[0]?.registration_book_url ? (
                                                    <img src={selectedDriver.driver_profiles[0].registration_book_url} alt="Reg Book" className="w-full h-full object-cover" />
                                                ) : (
                                                    <p className="text-xs text-muted">No Document</p>
                                                )}
                                                {selectedDriver.driver_profiles?.[0]?.registration_book_url && (
                                                    <a href={selectedDriver.driver_profiles[0].registration_book_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs uppercase tracking-wider backdrop-blur-sm">View Full</a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Performance Metrics */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
                                    <TrendingUp size={14} /> Today's Performance
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                        <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">Deliveries</p>
                                        <p className="text-2xl font-black text-white">0</p>
                                    </div>
                                    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                        <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">Est. Earnings</p>
                                        <p className="text-2xl font-black text-green-400">$0.00</p>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-6 border-t border-white/5 space-y-3">
                                {selectedDriver.driver_profiles?.[0]?.status === 'pending' && (
                                    <div className="grid grid-cols-2 gap-3 pb-3">
                                        <button
                                            onClick={() => updateStatusMutation.mutate({ userId: selectedDriver.id, status: 'approved' })}
                                            disabled={updateStatusMutation.isPending}
                                            className="w-full py-3 bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20 font-bold rounded-xl transition-colors flex justify-center items-center gap-2"
                                        >
                                            <CheckCircle2 size={18} /> Approve
                                        </button>
                                        <button
                                            onClick={() => updateStatusMutation.mutate({ userId: selectedDriver.id, status: 'rejected' })}
                                            disabled={updateStatusMutation.isPending}
                                            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold rounded-xl transition-colors flex justify-center items-center gap-2"
                                        >
                                            <XCircle size={18} /> Reject
                                        </button>
                                    </div>
                                )}
                                <button className="w-full py-4 glass text-[#FF4D00] hover:text-white font-bold rounded-xl hover:bg-[#FF4D00] transition-colors shadow-lg border border-[#FF4D00]/20 flex justify-center items-center gap-2">
                                    <MapPin size={18} /> Focus on Dispatch Map
                                </button>
                                <button className="w-full py-4 border border-white/5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2">
                                    <ShieldCheck size={18} /> Manage Documents
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const UserIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

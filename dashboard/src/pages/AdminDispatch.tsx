import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersService, adminService } from '../lib/services';
import { supabase } from '../lib/supabase';
import { Map, MapPin, Bike, Navigation, Clock, User, ChevronRight, Phone } from 'lucide-react';
import { StatusPill } from '../components/StatusPill';
import { GoogleMapBox } from '../components/GoogleMapBox';

export const AdminDispatch = () => {
    const { data: orders, isLoading: isOrdersLoading } = useQuery({
        queryKey: ['admin-orders'],
        queryFn: ordersService.getAdminOrders,
        refetchInterval: 5000 // Heartbeat every 5s
    });

    const { data: drivers } = useQuery({
        queryKey: ['admin-drivers'],
        queryFn: adminService.getAllDrivers,
        refetchInterval: 5000 // Heartbeat every 5s
    });

    // Helper for "Last Seen"
    const getTimeAgo = (timestamp: string | null) => {
        if (!timestamp) return 'Never';
        const seconds = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    // 1. Pending Orders (Needs Assignment)
    const readyOrders = orders?.filter(order => !order.driver_id && (order.status === 'confirmed' || order.status === 'ready_for_pickup') && order.fulfillment_type !== 'pickup') || [];
    
    // 2. Active Orders (Trackable)
    const activeOrders = orders?.filter(order => order.driver_id && order.status !== 'completed' && order.status !== 'cancelled') || [];

    const onlineDrivers = drivers?.filter(driver => {
        const dp = driver.driver_profiles?.[0];
        if (!dp?.is_online) return false;
        // Also consider "stale" if no update in 2 hours
        const lastUpdate = dp.last_location_update ? new Date(dp.last_location_update).getTime() : 0;
        const isFresh = (new Date().getTime() - lastUpdate) < 120 * 60 * 1000;
        return isFresh;
    }) || [];

    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const queryClient = useQueryClient();
    const mapRef = useRef<any>(null); // New: Link to GoogleMapBox

    // 3. Dynamic GPS Dispatch Query
    const { data: closestDrivers, isLoading: isDriversLoading } = useQuery({
        queryKey: ['closest-drivers', selectedOrder?.restaurants?.lat, selectedOrder?.restaurants?.lng],
        queryFn: async () => {
            if (!selectedOrder?.restaurants?.lat || !selectedOrder?.restaurants?.lng) return [];

            const { data, error } = await supabase.rpc('get_closest_drivers', {
                r_lat: selectedOrder.restaurants.lat,
                r_lng: selectedOrder.restaurants.lng,
                max_distance_km: 15,
                exclude_driver_id: null
            });

            if (error) throw error;
            return data;
        },
        enabled: !!selectedOrder?.restaurants?.lat,
        refetchInterval: 5000 // Live scanning while dispatching
    });

    const assignMutation = { isPending: false }; // Mock to prevent errors if still referenced

    // Prepare map markers
    const mapCenter = selectedOrder?.restaurants?.lat 
        ? { lat: selectedOrder.restaurants.lat, lng: selectedOrder.restaurants.lng } 
        : { lat: -17.8252, lng: 31.0335 };

    const markers: any[] = [];
    
    // Add selected restaurant
    if (selectedOrder?.restaurants) {
        markers.push({
            id: 'restaurant-' + selectedOrder.id,
            lat: selectedOrder.restaurants.lat,
            lng: selectedOrder.restaurants.lng,
            type: 'restaurant' as const,
            title: selectedOrder.restaurants.name,
            details: `Order Reference: #${selectedOrder.id.slice(0, 8).toUpperCase()}`
        });
    }

    // Add ALL drivers from the fleet for global monitoring
    drivers?.forEach(d => {
        const dp = d.driver_profiles?.[0];
        const isOnline = onlineDrivers.some(od => od.id === d.id);
        const lastSeenStr = getTimeAgo(dp?.last_location_update);
        
        if (d.lat && d.lng) {
            markers.push({
                id: 'fleet-driver-' + d.id,
                lat: d.lat,
                lng: d.lng,
                type: 'driver' as const,
                title: d.full_name,
                isOnline,
                lastSeen: lastSeenStr,
                details: isOnline ? 'Online & Available' : `Last Seen: ${lastSeenStr}`,
                phone: d.phone
            });
        }
    });

    return (
        <div className="flex flex-col h-[85vh] -m-8">
            <div className="p-6 border-b border-white/5 bg-background/50 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-accent">Fleet Monitoring & Coordination</h1>
                    <p className="text-muted text-sm mt-1">Monitor real-time driver locations and order progress</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-sm font-bold text-green-500">{onlineDrivers.length}</p>
                        <p className="text-xs text-muted font-mono">Online</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-[#FF4D00]">{activeOrders.length}</p>
                        <p className="text-xs text-muted font-mono">Active</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Queues */}
                <div className="w-[400px] border-r border-white/5 flex flex-col bg-surface/30">
                    {/* Pending Section */}
                    <div className="flex-1 flex flex-col border-b border-white/5 overflow-hidden">
                        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                            <h3 className="font-bold text-xs uppercase tracking-wider text-muted flex justify-between items-center">
                                Needs Assignment
                                <span className="bg-accent text-white px-2 py-0.5 rounded-full text-[10px]">{readyOrders.length}</span>
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {isOrdersLoading ? (
                                <div className="text-center py-10 text-muted">Loading orders...</div>
                            ) : readyOrders.length === 0 ? (
                                <div className="text-center py-10 text-muted text-xs">No pending assignments.</div>
                            ) : readyOrders.map((order) => (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedOrder?.id === order.id
                                        ? 'bg-accent/10 border-accent/40 shadow-[0_4px_24px_rgba(255,77,0,0.1)]'
                                        : 'bg-white/5 border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-white text-sm">{order.restaurants?.name}</h4>
                                        <StatusPill status={order.status} />
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-muted">
                                        <MapPin size={12} />
                                        <span className="truncate">{order.delivery_address?.suburb}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Fleet Status Section */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
                        <div className="p-3 border-b border-white/5 bg-white/[0.02]">
                            <h3 className="font-bold text-xs uppercase tracking-wider text-muted flex justify-between items-center">
                                All Fleet Status
                                <span className="bg-white/10 text-white px-2 py-0.5 rounded-full text-[10px]">{drivers?.length || 0}</span>
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {drivers?.sort((a: any, b: any) => {
                                const aOnline = onlineDrivers.some(od => od.id === a.id);
                                const bOnline = onlineDrivers.some(od => od.id === b.id);
                                if (aOnline && !bOnline) return -1;
                                if (!aOnline && bOnline) return 1;
                                return 0;
                            }).map(driver => {
                                const isOnline = onlineDrivers.some(od => od.id === driver.id);
                                const lastSeen = getTimeAgo(driver.driver_profiles?.[0]?.last_location_update);
                                return (
                                    <div 
                                        key={driver.id} 
                                        className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-colors cursor-pointer"
                                        onClick={() => {
                                            if (driver.lat && driver.lng && mapRef.current) {
                                                mapRef.current.panTo({ lat: driver.lat, lng: driver.lng });
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`} />
                                            <div>
                                                <p className="text-xs font-bold text-white leading-none">{driver.full_name}</p>
                                                <p className="text-[10px] text-muted mt-1">Seen: {lastSeen}</p>
                                            </div>
                                        </div>
                                        {isOnline && (
                                            <div className="p-1.5 rounded-md bg-green-500/10 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Navigation size={12} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Interactive Google Map */}
                <div className="flex-1 relative bg-surface">
                    <GoogleMapBox 
                        ref={mapRef}
                        center={mapCenter}
                        markers={markers}
                        autoFit={true}
                    />

                    {/* Dispatch Console Overlay */}
                    {selectedOrder && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[550px] glass rounded-2xl border border-white/20 shadow-2xl z-[1000] overflow-hidden flex flex-col">
                            <div className="p-4 bg-[#FF4D00]/10 border-b border-white/10 flex justify-between items-center">
                                <h3 className="font-bold text-accent">Assign Rider: Order #{selectedOrder.id.slice(0, 8).toUpperCase()}</h3>
                                <button onClick={() => setSelectedOrder(null)} className="text-white hover:text-accent font-bold">×</button>
                            </div>
                            <div className="p-4 max-h-[350px] overflow-y-auto space-y-3 bg-[#0F0F0F]/80 backdrop-blur-xl">
                                {isDriversLoading ? (
                                    <div className="p-8 text-center text-muted animate-pulse">Scanning available GPS coordinates...</div>
                                ) : closestDrivers && closestDrivers.length > 0 ? (
                                    closestDrivers.map((driver: any) => (
                                        <div key={driver.driver_id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                                                    <Bike size={20} className="text-accent" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white text-sm">{driver.full_name}</p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-[11px] text-[#10B981] font-mono font-bold leading-none">{Number(driver.distance_km).toFixed(2)} km radius</span>
                                                        {driver.phone && (
                                                            <div className="flex items-center gap-1 text-[11px] text-muted font-bold bg-white/5 px-2 py-0.5 rounded">
                                                                <Phone size={10} /> {driver.phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted">No drivers detected within a 15km radius.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

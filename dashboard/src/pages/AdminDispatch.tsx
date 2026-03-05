import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersService, adminService } from '../lib/services';
import { supabase } from '../lib/supabase';
import { Map, MapPin, Bike, Navigation, Clock, User, ChevronRight } from 'lucide-react';
import { StatusPill } from '../components/StatusPill';

export const AdminDispatch = () => {
    const { data: orders, isLoading: isOrdersLoading } = useQuery({
        queryKey: ['admin-orders'],
        queryFn: ordersService.getAdminOrders
    });

    const { data: drivers } = useQuery({
        queryKey: ['admin-drivers'],
        queryFn: adminService.getAllDrivers
    });

    // Only show orders that need dispatching: confirmed or ready, but strictly no driver assigned
    const readyOrders = orders?.filter(order => !order.driver_id && (order.status === 'confirmed' || order.status === 'ready')) || [];
    const onlineDrivers = drivers?.filter(driver => driver.driver_profiles?.[0]?.is_online) || [];

    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const queryClient = useQueryClient();

    // 1. Dynamic GPS Dispatch Query based on active selection constraints
    const { data: closestDrivers, isLoading: isDriversLoading } = useQuery({
        queryKey: ['closest-drivers', selectedOrder?.restaurants?.lat, selectedOrder?.restaurants?.lng],
        queryFn: async () => {
            if (!selectedOrder?.restaurants?.lat || !selectedOrder?.restaurants?.lng) return [];

            const { data, error } = await supabase.rpc('get_closest_drivers', {
                r_lat: selectedOrder.restaurants.lat,
                r_lng: selectedOrder.restaurants.lng,
                max_distance_km: 15,
                exclude_driver_id: selectedOrder.customer_id
            });

            if (error) {
                console.error("Failed to map Haversine distance calculations:", error);
                throw error;
            }
            return data;
        },
        enabled: !!selectedOrder?.restaurants?.lat
    });

    const assignMutation = useMutation({
        mutationFn: async ({ orderId, driverId }: { orderId: string, driverId: string }) => {
            await adminService.assignDriver(orderId, driverId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
            setSelectedOrder(null);
        }
    });

    return (
        <div className="flex flex-col h-[85vh] -m-8">
            {/* Top Bar inside the page */}
            <div className="p-6 border-b border-white/5 bg-background/50 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Manual Dispatch</h1>
                    <p className="text-muted text-sm mt-1">Assign available drivers to pending orders</p>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Pending Orders */}
                <div className="w-[400px] border-r border-white/5 flex flex-col bg-surface/30">
                    <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted flex justify-between items-center">
                            Needs Assignment
                            <span className="bg-accent text-white px-2 py-0.5 rounded-full text-xs">{readyOrders.length}</span>
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {isOrdersLoading ? (
                            <div className="text-center py-10 text-muted">Loading pending orders...</div>
                        ) : readyOrders.length === 0 ? (
                            <div className="text-center py-20 text-muted space-y-3">
                                <Clock size={32} className="mx-auto opacity-20" />
                                <p>No orders pending dispatch.</p>
                            </div>
                        ) : readyOrders.map((order) => (
                            <div
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedOrder?.id === order.id
                                    ? 'bg-accent/10 border-accent/30 shadow-[0_0_15px_rgba(255,77,0,0.1)]'
                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-mono text-xs font-bold text-muted">#{order.id.slice(0, 8).toUpperCase()}</p>
                                        <h4 className="font-bold text-white mt-1">{order.restaurants?.name}</h4>
                                    </div>
                                    <StatusPill status={order.status} />
                                </div>

                                <div className="space-y-2 mt-4 pt-3 border-t border-white/5">
                                    <div className="flex items-start gap-2 text-xs text-muted">
                                        <User size={14} className="mt-0.5" />
                                        <span>{order.profiles?.full_name}</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-xs text-muted">
                                        <MapPin size={14} className="mt-0.5" />
                                        <span className="truncate">{order.delivery_address?.suburb}, {order.delivery_address?.street}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Map & Dispatch Console */}
                <div className="flex-1 relative bg-[#1A1A1A] flex flex-col">
                    {/* Mock Map Background */}
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

                    <div className="absolute top-4 right-4 z-10 glass px-4 py-2 rounded-xl border border-white/10 shadow-2xl flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-bold">{onlineDrivers.length} Online Drivers</span>
                    </div>

                    {selectedOrder ? (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[600px] glass rounded-2xl border border-white/10 shadow-2xl z-20 overflow-hidden flex flex-col animate-in slide-in-from-bottom-8">
                            <div className="p-4 bg-accent/20 border-b border-accent/20 flex justify-between items-center text-accent">
                                <h3 className="font-bold">Dispatching Order #{selectedOrder.id.slice(0, 8).toUpperCase()}</h3>
                                <div className="flex items-center gap-1 text-sm font-bold"><MapPin size={16} /> {selectedOrder.delivery_address?.suburb}</div>
                            </div>
                            <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
                                {isDriversLoading ? (
                                    <div className="p-8 text-center text-muted animate-pulse">Scanning mapped coordinates...</div>
                                ) : closestDrivers && closestDrivers.length > 0 ? (
                                    closestDrivers.map((driver: any) => (
                                        <div key={driver.driver_id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 group cursor-pointer">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center relative">
                                                    <Bike size={18} className="text-muted" />
                                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#1a1a1a]" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white text-sm">{driver.full_name}</p>
                                                    <p className="text-xs text-[#10B981] mt-0.5 font-mono">{driver.distance_km ? `${Number(driver.distance_km).toFixed(2)} km radius` : 'Live Tracking'}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => assignMutation.mutate({ orderId: selectedOrder.id, driverId: driver.driver_id })}
                                                disabled={assignMutation.isPending}
                                                className="px-4 py-2 bg-[#FF4D00] text-white text-xs font-bold rounded-lg hover:bg-[#FF4D00]/80 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1 shadow-lg shadow-[#FF4D00]/20 disabled:opacity-50"
                                            >
                                                {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                                                {!assignMutation.isPending && <ChevronRight size={14} />}
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted">No drivers within 15km radar ping.</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                            <div className="text-center space-y-4 bg-black/40 p-8 rounded-2xl backdrop-blur-md border border-white/5">
                                <Navigation size={48} className="mx-auto text-muted/50" />
                                <h2 className="text-xl font-bold text-white">Interactive Dispatch Map</h2>
                                <p className="text-muted text-sm max-w-sm">Select an order from the queue on the left to assign a driver from the map.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

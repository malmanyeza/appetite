import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { ordersService, restaurantService } from '../lib/services';
import { useAuthStore } from '../store/authStore';
import {
    Clock,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Timer,
    Package,
    MapPin,
    Phone,
    AlertTriangle
} from 'lucide-react';
import { StatusPill } from '../components/StatusPill';
import { LandmarkAddress } from '../components/LandmarkAddress';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const RestaurantOrders = () => {
    const { profile, refreshSession } = useAuthStore();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<'pending' | 'preparing' | 'ready' | 'history'>('pending');

    const { data: restaurant, isLoading: isRestLoading, error: restError, refetch: refetchRest } = useQuery({
        queryKey: ['my-restaurant'],
        queryFn: () => restaurantService.getMyRestaurant(profile?.id)
    });

    const { data: allOrders, isLoading } = useQuery({
        queryKey: ['restaurant-orders', restaurant?.id],
        queryFn: () => ordersService.getRestaurantOrders(restaurant?.id),
        enabled: !!restaurant?.id
    });

    const orders = React.useMemo(() => {
        if (!allOrders) return [];
        switch (filter) {
            case 'pending': return allOrders.filter(o => o.status === 'confirmed');
            case 'preparing': return allOrders.filter(o => o.status === 'preparing');
            case 'ready': return allOrders.filter(o => o.status === 'ready_for_pickup');
            case 'history': return allOrders.filter(o => ['delivered', 'cancelled'].includes(o.status));
            default: return allOrders;
        }
    }, [allOrders, filter]);

    const updateStatusMutation = useMutation({
        mutationFn: ({ orderId, status }: { orderId: string, status: string }) =>
            ordersService.updateOrderStatus(orderId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['restaurant-orders'] });
        }
    });

    if (isRestLoading) {
        return (
            <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-32 glass w-full" />)}
            </div>
        );
    }

    if (restError || !restaurant) {
        const errorMessage = (restError as any)?.message || "No linked restaurant found";
        return (
            <div className="glass p-12 text-center">
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Setup Required</h2>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 max-w-md mx-auto">
                    <p className="text-xs font-mono text-red-400 break-words line-clamp-2">
                        Error: {errorMessage}
                    </p>
                </div>
                <p className="text-muted mb-8 text-sm">
                    {restError ? "It looks like the database migration wasn't applied or there's a connection issue." :
                        `Your account (${profile?.id?.slice(0, 8)}) is not yet linked to a restaurant.`}
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <button
                        onClick={() => { refreshSession(); refetchRest(); }}
                        className="btn-primary px-6 py-2 flex items-center justify-center gap-2"
                    >
                        <Timer size={16} /> Refresh Permissions
                    </button>
                    <button
                        onClick={() => navigate('/restaurant/settings')}
                        className="btn-secondary px-6 py-2"
                    >
                        Go to Settings
                    </button>
                </div>
                {!restaurant && !restError && (
                    <p className="text-[10px] text-muted mt-6 uppercase tracking-widest">
                        Tip: Link your user ID in the Appetite Ops Console
                    </p>
                )}
            </div>
        );
    }

    // Helper to extract and sort arrays newest first
    const sortNewestFirst = (arr: any[]) => arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const incomingOrders = sortNewestFirst(allOrders?.filter(o => o.status === 'confirmed') || []);
    const preparingOrders = sortNewestFirst(allOrders?.filter(o => o.status === 'preparing') || []);
    const readyOrders = sortNewestFirst(allOrders?.filter(o => o.status === 'ready_for_pickup') || []);
    const historyOrders = sortNewestFirst(allOrders?.filter(o => ['delivered', 'cancelled'].includes(o.status)) || []);

    const [viewMode, setViewMode] = useState<'board' | 'table'>('board');

    // Simple auto-refresh for "min ago" timers
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    const OrderCard = ({ order }: { order: any }) => {
        const needsAttention = order.status === 'confirmed' && (new Date().getTime() - new Date(order.created_at).getTime() > 120000);
        const minutesAgo = Math.floor((new Date().getTime() - new Date(order.created_at).getTime()) / 60000);
        const isUnpaidOnline = order.payment?.method === 'paynow' && order.payment?.status === 'pending';

        return (
            <div className={cn(
                "glass p-5 rounded-2xl flex flex-col gap-4 relative overflow-hidden transition-all",
                needsAttention && "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            )}>
                {needsAttention && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                )}

                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-lg md:text-xl font-bold">#{order.id.slice(0, 8)}</span>
                            {needsAttention && <AlertTriangle size={14} className="text-red-400" />}
                             <div className="flex flex-col gap-2">
                                 {/* First Row: Status Badges */}
                                 <div className="flex flex-wrap items-center gap-2">
                                    {(order.fulfillment_type === 'pickup' || String(order.fulfillment_type || '').toLowerCase().trim() === 'pickup') && (
                                        <span className="bg-purple-600 text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase shadow-lg shadow-purple-500/20 border border-purple-400/30 animate-pulse">
                                            PRE-ORDER / PICKUP
                                        </span>
                                    )}
                                    {order.payment?.method === 'paynow' && order.payment?.status === 'paid' && (
                                        <span className="bg-green-500/20 text-green-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">PAID ONLINE</span>
                                    )}
                                    {order.payment?.method === 'cod' && (
                                        <span className="bg-orange-500/20 text-orange-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">COD</span>
                                    )}
                                 </div>

                                 {/* Second Row: Collection PIN (Unified) */}
                                 {order.delivery_pin && (order.fulfillment_type === 'pickup' || String(order.fulfillment_type || '').toLowerCase().trim() === 'pickup') && (
                                    <div className="bg-purple-600/20 border border-purple-500/30 p-2.5 rounded-xl flex items-center justify-between group-hover:bg-purple-600/30 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest leading-none">Collection PIN</span>
                                            <span className="text-[9px] text-purple-400/60 font-medium mt-1">Check with Customer</span>
                                        </div>
                                        <span className="text-2xl font-black font-mono text-purple-300 tracking-[0.1em]">{order.delivery_pin}</span>
                                    </div>
                                 )}
                             </div>
                         </div>
                         <p className={cn("text-xs font-bold uppercase tracking-wider", needsAttention ? "text-red-400" : "text-muted")}>
                            Ordered: {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            <span className="ml-2 py-0.5 px-1.5 rounded bg-white/5 text-accent">
                                {new Date(order.created_at).toDateString() === new Date().toDateString() ? 'TODAY' : new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                        </p>
                        {order.delivered_at && (
                            <p className="text-xs font-bold text-green-400 uppercase tracking-wider mt-0.5">
                                Delivered: {new Date(order.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                <span className="ml-1 opacity-70">
                                    ({new Date(order.delivered_at).toDateString() === new Date().toDateString() ? 'Today' : new Date(order.delivered_at).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                                </span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="bg-surface/50 rounded-xl p-3">
                    <p className="text-xs font-bold text-muted uppercase mb-2">Items</p>
                    <div className="space-y-1">
                        {order.order_items.slice(0, 2).map((item: any) => (
                            <div key={item.id} className="flex flex-col gap-0.5 pb-2 border-b border-white/5 last:border-0 last:pb-0">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-white">{item.qty}x {item.name_snapshot}</span>
                                </div>
                                {item.selected_add_ons?.length > 0 && (
                                    <p className="text-[10px] text-accent font-bold uppercase tracking-tight">
                                        + {item.selected_add_ons.map((a: any) => a.name).join(', ')}
                                    </p>
                                )}
                            </div>
                        ))}
                        {order.order_items.length > 2 && (
                            <p className="text-xs text-muted mt-2 italic">+{order.order_items.length - 2} more items</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <MapPin size={14} className="shrink-0 text-accent" />
                        <span className="font-semibold text-white uppercase text-xs tracking-wider">{order.delivery_address_snapshot.suburb}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-1">
                        {order.profiles?.phone && (
                            <a 
                                href={`tel:${order.profiles.phone}`}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-colors text-[11px] font-bold"
                            >
                                <Phone size={12} />
                                CALL CUSTOMER
                            </a>
                        )}
                        {order.driver?.phone && (
                            <a 
                                href={`tel:${order.driver.phone}`}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors text-[11px] font-bold"
                            >
                                <Phone size={12} />
                                CALL DRIVER
                            </a>
                        )}
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-white/5">
                    {order.status === 'confirmed' && (
                        <div className="flex gap-2">
                            {isUnpaidOnline ? (
                                <div className="flex-1 bg-red-500/10 border border-red-500/20 py-3 text-sm flex items-center justify-center gap-2 rounded-xl">
                                    <AlertTriangle size={16} className="text-red-400" />
                                    <span className="text-red-400 font-bold">Awaiting Payment</span>
                                </div>
                            ) : (
                                <button
                                    onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'preparing' })}
                                    className="flex-1 btn-primary py-3 text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                                >
                                    <Timer size={16} /> Accept & Prepare
                                </button>
                            )}
                        </div>
                    )}
                    {order.status === 'preparing' && (
                        <button
                            onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'ready_for_pickup' })}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                        >
                            <Package size={16} /> Mark as Ready
                        </button>
                    )}
                    {order.status === 'ready_for_pickup' && (
                        <div className={cn(
                            "text-center py-3 rounded-xl border flex flex-col gap-1",
                            order.fulfillment_type === 'pickup' 
                                ? "bg-purple-500/20 border-purple-500/50 border-2 shadow-[0_0_15px_rgba(168,85,247,0.15)]" 
                                : "bg-purple-500/10 border-purple-500/20"
                        )}>
                            <p className={cn(
                                "text-[11px] font-black uppercase tracking-wider",
                                order.fulfillment_type === 'pickup' ? "text-purple-300" : "text-purple-400"
                            )}>
                                {order.fulfillment_type === 'pickup' ? "Awaiting Customer Collection" : "Driver dispatch started..."}
                            </p>
                            {order.fulfillment_type === 'pickup' && (
                                <p className="text-[10px] text-purple-400/70 font-bold">
                                    Customer has been notified to collect
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 px-2 sm:px-0">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">Orders</h1>
                <div className="flex bg-surface rounded-xl p-1 border border-white/5 w-full sm:w-auto">
                    <button
                        onClick={() => setViewMode('board')}
                        className={cn("flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all", viewMode === 'board' ? 'bg-accent text-white' : 'text-muted hover:text-white')}
                    >
                        Kitchen Board
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={cn("flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all", viewMode === 'table' ? 'bg-accent text-white' : 'text-muted hover:text-white')}
                    >
                        Compact Table
                    </button>
                </div>
            </div>

            {/* Content area */}
            {viewMode === 'board' ? (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
                    {/* Incoming Column */}
                    <div className="flex flex-col bg-surface/30 rounded-3xl border border-white/5 overflow-hidden">
                        <div className="p-4 border-b border-white/5 bg-surface/50 flex items-center justify-between">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Incoming
                            </h2>
                            <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs font-bold">{incomingOrders.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {incomingOrders.map(order => <OrderCard key={order.id} order={order} />)}
                            {incomingOrders.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-muted p-6 text-center">
                                    <Clock size={32} className="mb-4 opacity-20" />
                                    <p className="text-sm font-medium">Waiting for new orders...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preparing Column */}
                    <div className="flex flex-col bg-surface/30 rounded-3xl border border-white/5 overflow-hidden">
                        <div className="p-4 border-b border-white/5 bg-surface/50 flex items-center justify-between">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-orange-500" /> Preparing
                            </h2>
                            <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs font-bold">{preparingOrders.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {preparingOrders.map(order => <OrderCard key={order.id} order={order} />)}
                        </div>
                    </div>

                    {/* Ready Column */}
                    <div className="flex flex-col bg-surface/30 rounded-3xl border border-white/5 overflow-hidden">
                        <div className="p-4 border-b border-white/5 bg-surface/50 flex items-center justify-between">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500" /> Ready for Pickup
                            </h2>
                            <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs font-bold">{readyOrders.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {readyOrders.map(order => <OrderCard key={order.id} order={order} />)}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 glass rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-12 text-center text-muted">Compact table view coming soon. Select 'Kitchen Board' to view live orders.</div>
                </div>
            )}
        </div>
    );
};

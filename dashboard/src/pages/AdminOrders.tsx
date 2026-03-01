import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersService, adminService } from '../lib/services';
import {
    Search,
    Filter,
    ChevronRight,
    X,
    User,
    Store,
    Clock,
    Truck,
    ChevronDown,
    Activity,
    MapPin
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { StatusPill } from '../components/StatusPill';
import { LandmarkAddress } from '../components/LandmarkAddress';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const AdminOrders = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);

    const { data: orders, isLoading } = useQuery({
        queryKey: ['admin-orders'],
        queryFn: ordersService.getAdminOrders
    });

    const { data: drivers } = useQuery({
        queryKey: ['admin-drivers'],
        queryFn: adminService.getAllDrivers
    });

    const filteredOrders = orders?.filter(order => {
        const matchesSearch =
            order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.restaurants?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="relative min-h-[80vh] pb-20">
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">Global Orders</h1>
                        <p className="text-muted text-sm mt-1">Manage and dispatch all platform orders</p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <div className="relative">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="text"
                                placeholder="Search ID, customer, store..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-sm w-full md:w-72"
                            />
                        </div>
                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="appearance-none pl-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer text-white"
                            >
                                <option value="all">All Statuses</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="preparing">Preparing</option>
                                <option value="ready">Ready for Pickup</option>
                                <option value="on_the_way">On The Way</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                        </div>
                    </div>
                </div>

                <div className="glass rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white/5 border-b border-white/5 text-xs uppercase tracking-wider text-muted font-bold">
                                <tr>
                                    <th className="px-6 py-5">Order ID</th>
                                    <th className="px-6 py-5">Time</th>
                                    <th className="px-6 py-5">Customer</th>
                                    <th className="px-6 py-5">Restaurant</th>
                                    <th className="px-6 py-5">Status</th>
                                    <th className="px-6 py-5">Amount</th>
                                    <th className="px-6 py-5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-muted">Loading global orders...</td>
                                    </tr>
                                ) : filteredOrders?.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-muted">No orders found matching criteria.</td>
                                    </tr>
                                ) : filteredOrders?.map((order) => (
                                    <tr
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4 font-mono text-xs text-white">#{order.id.slice(0, 8).toUpperCase()}</td>
                                        <td className="px-6 py-4 text-muted">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="px-6 py-4 font-medium">{order.profiles?.full_name || 'Guest User'}</td>
                                        <td className="px-6 py-4 text-muted">{order.restaurants?.name || 'Unknown Store'}</td>
                                        <td className="px-6 py-4">
                                            <StatusPill status={order.status} />
                                        </td>
                                        <td className="px-6 py-4 font-bold text-green-400">${order.pricing?.total?.toFixed(2) || '0.00'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white/5 group-hover:bg-accent group-hover:text-white transition-colors text-muted">
                                                <ChevronRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Order Detail Drawer */}
            {selectedOrder && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-in fade-in"
                        onClick={() => setSelectedOrder(null)}
                    />

                    {/* Drawer Panel */}
                    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#121212] border-l border-white/10 shadow-2xl z-50 transform transition-transform animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <div>
                                <h2 className="text-xl font-black font-mono">#{selectedOrder.id.slice(0, 8).toUpperCase()}</h2>
                                <p className="text-xs text-muted">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="w-10 h-10 rounded-full glass flex items-center justify-center text-muted hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">

                            {/* Status Section */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted">Current Status</h3>
                                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                    <StatusPill status={selectedOrder.status} />
                                </div>
                            </div>

                            {/* Dispatch / Driver Section */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-[#FF4D00] flex items-center gap-2">
                                    <Truck size={14} /> Dispatch & Driver
                                </h3>
                                <div className="p-5 rounded-xl border border-[#FF4D00]/20 bg-[#FF4D00]/5 space-y-4">
                                    {selectedOrder.driver_id ? (
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-[#FF4D00]/20 flex items-center justify-center text-[#FF4D00]">
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">Driver Assigned</p>
                                                <p className="text-xs text-muted">Tracking in progress...</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm font-medium text-white">No driver assigned yet.</p>
                                            <div className="relative">
                                                <select className="appearance-none w-full pl-4 pr-10 py-3 bg-white/10 border border-white/10 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/50 cursor-pointer text-white">
                                                    <option value="">Select a driver to assign...</option>
                                                    {drivers?.map((d: any) => (
                                                        <option key={d.id} value={d.id}>{d.full_name} (Online)</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                                            </div>
                                            <button className="w-full py-3 bg-[#FF4D00] text-white font-bold rounded-xl hover:bg-[#FF4D00]/90 transition-colors text-sm shadow-lg shadow-[#FF4D00]/20">
                                                Manually Assign Driver
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Customer & Delivery Section */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
                                    <MapPin size={14} /> Customer & Destination
                                </h3>
                                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02] space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-white">{selectedOrder.profiles?.full_name || 'Guest'}</p>
                                            <p className="text-xs text-muted">{selectedOrder.profiles?.phone || 'No phone provided'}</p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/5">
                                        {selectedOrder.delivery_address && (
                                            <LandmarkAddress
                                                address={selectedOrder.delivery_address}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Restaurant Section */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
                                    <Store size={14} /> Pickup Location
                                </h3>
                                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
                                    <p className="font-bold text-sm text-white">{selectedOrder.restaurants?.name || 'Unknown'}</p>
                                    <p className="text-xs text-muted mt-1">{selectedOrder.restaurants?.physical_address || 'Address not listed'}</p>
                                </div>
                            </div>

                            {/* Financials Section */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted">Order Total</h3>
                                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-muted">Total Amount</span>
                                        <span className="text-2xl font-black text-green-400">${selectedOrder.pricing?.total?.toFixed(2) || '0.00'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

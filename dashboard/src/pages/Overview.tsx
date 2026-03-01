import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { restaurantService, adminService, ordersService } from '../lib/services';
import { AlertCircle, Clock, TrendingUp, Users, Store, Activity, ArrowRight, DollarSign } from 'lucide-react';
import { StatusPill } from '../components/StatusPill';
import { Link } from 'react-router-dom';

export const Overview = () => {
    const { currentRole, profile } = useAuthStore();

    const { data: restaurant } = useQuery({
        queryKey: ['my-restaurant'],
        queryFn: () => restaurantService.getMyRestaurant(profile?.id),
        enabled: currentRole === 'restaurant'
    });

    const { data: stats, isLoading: isStatsLoading } = useQuery<any>({
        queryKey: ['dashboard-analytics', currentRole, restaurant?.id],
        queryFn: () => currentRole === 'restaurant'
            ? restaurantService.getAnalytics(restaurant!.id)
            : adminService.getGlobalAnalytics(),
        enabled: currentRole === 'admin' || (currentRole === 'restaurant' && !!restaurant?.id)
    });

    const { data: recentOrders, isLoading: isOrdersLoading } = useQuery({
        queryKey: ['recent-orders', currentRole, restaurant?.id],
        queryFn: async () => {
            const allOrders = currentRole === 'restaurant'
                ? await ordersService.getRestaurantOrders(restaurant!.id)
                : await ordersService.getAdminOrders();
            // Just return top 5 for the overview
            return allOrders?.slice(0, 5) || [];
        },
        enabled: currentRole === 'admin' || (currentRole === 'restaurant' && !!restaurant?.id)
    });

    if (isStatsLoading || isOrdersLoading) return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-32 glass animate-pulse" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 h-96 glass animate-pulse" />
                <div className="h-96 glass animate-pulse" />
            </div>
        </div>
    );

    const isAdmin = currentRole === 'admin';

    const displayStats = isAdmin ? [
        { label: "Total Orders Today", value: stats?.todayOrders || '0', icon: <Activity size={20} />, color: "text-blue-400" },
        { label: "Revenue (USD)", value: `$${stats?.revenue?.toFixed(2) || '0.00'}`, icon: <DollarSign size={20} />, color: "text-green-400" },
        { label: "Online Restaurants", value: stats?.onlineRestaurants?.toString() || '0', icon: <Store size={20} />, color: "text-purple-400" },
        { label: "Active Drivers", value: stats?.activeDrivers?.toString() || '0', icon: <Users size={20} />, color: "text-orange-400" },
    ] : [
        { label: "Today's Orders", value: stats?.todayOrders || '0', icon: <Activity size={20} />, color: "text-accent" },
        { label: "Revenue (USD)", value: `$${stats?.revenue?.toFixed(2) || '0.00'}`, icon: <DollarSign size={20} />, color: "text-green-400" },
        { label: "Avg Prep Time", value: stats?.avgPrepTime || '0m', icon: <Clock size={20} />, color: "text-purple-400" },
        { label: "Customer Rating", value: stats?.rating || '0.0', icon: <TrendingUp size={20} />, color: "text-yellow-400" },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div>
                <h1 className="text-3xl font-bold">Good morning, {profile?.full_name?.split(' ')[0] || 'User'}</h1>
                <p className="text-muted text-sm mt-1">Here is what's happening today.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {displayStats.map((stat, idx) => (
                    <div key={idx} className="glass p-6 rounded-2xl space-y-4 hover:bg-white/[0.03] transition-colors border-t-4 border-t-transparent hover:border-t-accent">
                        <div className="flex justify-between items-start">
                            <p className="text-sm text-muted font-bold uppercase tracking-wider">{stat.label}</p>
                            <div className={`p-2 rounded-xl bg-white/5 ${stat.color}`}>
                                {stat.icon}
                            </div>
                        </div>
                        <p className="text-4xl font-black">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Live Orders Panel */}
                <div className="lg:col-span-2 glass p-8 rounded-2xl flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Activity size={20} className="text-accent" /> Live Orders Activity
                        </h3>
                        <Link to={`/${currentRole}/orders`} className="text-xs font-bold text-accent hover:text-white flex items-center gap-1 transition-colors">
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>

                    {recentOrders && recentOrders.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-xs uppercase text-muted border-b border-white/5">
                                    <tr>
                                        <th className="pb-3 font-semibold">Order ID</th>
                                        {isAdmin && <th className="pb-3 font-semibold">Restaurant</th>}
                                        <th className="pb-3 font-semibold">Customer</th>
                                        <th className="pb-3 font-semibold">Status</th>
                                        <th className="pb-3 font-semibold text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {recentOrders.map((order: any) => (
                                        <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="py-4 text-sm font-medium text-white">#{order.id.slice(0, 5).toUpperCase()}</td>
                                            {isAdmin && <td className="py-4 text-sm text-muted">{order.restaurants?.name || 'Unknown'}</td>}
                                            <td className="py-4 text-sm text-muted">{order.profiles?.full_name || 'Guest'}</td>
                                            <td className="py-4">
                                                <StatusPill status={order.status} />
                                            </td>
                                            <td className="py-4 text-sm font-bold text-accent text-right">
                                                ${order.pricing?.total?.toFixed(2) || '0.00'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted text-sm space-y-2 py-10">
                            <Clock size={32} className="opacity-20" />
                            <p>No recent orders found.</p>
                        </div>
                    )}
                </div>

                {/* Alerts Panel */}
                <div className="glass p-8 rounded-2xl flex flex-col">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <AlertCircle size={20} className="text-red-400" /> System Alerts
                    </h3>

                    <div className="space-y-4 flex-1">
                        {isAdmin ? (
                            <>
                                {stats?.alerts && stats.alerts.length > 0 ? (
                                    stats.alerts.map((alert: any, idx: number) => (
                                        <div key={idx} className={`p-4 rounded-xl bg-${alert.color}-500/10 border border-${alert.color}-500/20 text-${alert.color}-500 space-y-1`}>
                                            <p className="font-bold text-sm">{alert.title}</p>
                                            <p className={`text-xs text-${alert.color}-400`}>{alert.message}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-muted space-y-1">
                                        <p className="font-bold text-sm text-white">All Systems Normal</p>
                                        <p className="text-xs">No active alerts to report.</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {stats?.alerts && stats.alerts.length > 0 ? (
                                    stats.alerts.map((alert: any, idx: number) => (
                                        <div key={idx} className={`p-4 rounded-xl bg-accent/10 border border-accent/20 text-accent space-y-1`}>
                                            <p className="font-bold text-sm">{alert.title}</p>
                                            <p className={`text-xs text-accent/80`}>{alert.message}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-muted space-y-1">
                                        <p className="font-bold text-sm text-white">All Caught Up</p>
                                        <p className="text-xs">No pending actions required.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

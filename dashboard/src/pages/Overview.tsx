import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { restaurantService, adminService, ordersService } from '../lib/services';
import { AlertCircle, Clock, TrendingUp, Users, Store, Activity, ArrowRight, DollarSign } from 'lucide-react';
import { StatusPill } from '../components/StatusPill';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

type TimeFrame = 'minute' | 'hour' | 'day' | 'week' | 'month';

export const Overview = () => {
    const { currentRole, profile } = useAuthStore();
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('day');

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

    const { data: recentOrders, isLoading: isOrdersLoading, refetch: refetchOrders } = useQuery({
        queryKey: ['recent-orders', currentRole, restaurant?.id],
        queryFn: async () => {
            const allOrders = currentRole === 'restaurant'
                ? await ordersService.getRestaurantOrders(restaurant!.id)
                : await ordersService.getAdminOrders();
            return allOrders?.slice(0, 5) || [];
        },
        enabled: currentRole === 'admin' || (currentRole === 'restaurant' && !!restaurant?.id)
    });

    const { data: adminNotices, refetch: refetchNotices } = useQuery({
        queryKey: ['admin-notices'],
        queryFn: () => adminService.getAdminNotifications(),
        enabled: currentRole === 'admin'
    });

    useEffect(() => {
        if (currentRole !== 'admin') return;

        const sub = supabase.channel('admin-notices')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, () => {
                refetchNotices();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [currentRole, refetchNotices]);


    const chartData = useMemo(() => {
        if (!stats?.allOrders) return [];

        const orders = stats.allOrders as any[];
        const now = new Date();
        const rawData: Record<string, number> = {};

        orders.forEach(order => {
            if (order.status === 'pending') return;
            const date = new Date(order.created_at);
            const revenue = order.pricing?.appetite_margin || 0;
            let key = '';

            if (timeFrame === 'minute') {
                if (now.getTime() - date.getTime() <= 3600000) {
                    key = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                }
            } else if (timeFrame === 'hour') {
                if (now.getTime() - date.getTime() <= 86400000) {
                    key = `${date.getHours()}:00`;
                }
            } else if (timeFrame === 'day') {
                if (now.getTime() - date.getTime() <= 2592000000) {
                    key = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                }
            } else if (timeFrame === 'week') {
                if (now.getTime() - date.getTime() <= 7776000000) { // 90 days
                    const startOfWeek = new Date(date);
                    startOfWeek.setDate(date.getDate() - date.getDay());
                    key = startOfWeek.toLocaleDateString([], { month: 'short', day: 'numeric' });
                }
            } else if (timeFrame === 'month') {
                key = date.toLocaleDateString([], { month: 'short', year: '2-digit' });
            }

            if (key) {
                rawData[key] = (rawData[key] || 0) + revenue;
            }
        });

        // Ensure chronological sorting
        const sortedEntries = Object.entries(rawData).sort((a, b) => {
            const orderA = orders.find(o => {
                const d = new Date(o.created_at);
                if (timeFrame === 'minute') return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}` === a[0];
                if (timeFrame === 'hour') return `${d.getHours()}:00` === a[0];
                if (timeFrame === 'day') return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) === a[0];
                if (timeFrame === 'week') {
                    const s = new Date(d); s.setDate(d.getDate() - d.getDay());
                    return s.toLocaleDateString([], { month: 'short', day: 'numeric' }) === a[0];
                }
                if (timeFrame === 'month') return d.toLocaleDateString([], { month: 'short', year: '2-digit' }) === a[0];
                return false;
            });
            const orderB = orders.find(o => {
                const d = new Date(o.created_at);
                if (timeFrame === 'minute') return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}` === b[0];
                if (timeFrame === 'hour') return `${d.getHours()}:00` === b[0];
                if (timeFrame === 'day') return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) === b[0];
                if (timeFrame === 'week') {
                    const s = new Date(d); s.setDate(d.getDate() - d.getDay());
                    return s.toLocaleDateString([], { month: 'short', day: 'numeric' }) === b[0];
                }
                if (timeFrame === 'month') return d.toLocaleDateString([], { month: 'short', year: '2-digit' }) === b[0];
                return false;
            });
            return new Date(orderA?.created_at).getTime() - new Date(orderB?.created_at).getTime();
        });

        return sortedEntries.map(([name, value]) => ({ name, value }));
    }, [stats?.allOrders, timeFrame]);

    const timeframeRevenue = useMemo(() => {
        if (!stats?.allOrders) return 0;
        const now = new Date();
        return (stats.allOrders as any[]).reduce((sum, order) => {
            if (order.status === 'pending') return sum;
            
            const date = new Date(order.created_at);
            const revenue = order.pricing?.appetite_margin || 0;
            let include = false;

            if (timeFrame === 'minute') {
                include = date.getFullYear() === now.getFullYear() &&
                          date.getMonth() === now.getMonth() &&
                          date.getDate() === now.getDate() &&
                          date.getHours() === now.getHours() &&
                          date.getMinutes() === now.getMinutes();
            } else if (timeFrame === 'hour') {
                include = date.getFullYear() === now.getFullYear() &&
                          date.getMonth() === now.getMonth() &&
                          date.getDate() === now.getDate() &&
                          date.getHours() === now.getHours();
            } else if (timeFrame === 'day') {
                include = date.toDateString() === now.toDateString();
            } else if (timeFrame === 'week') {
                const startOfWeek = new Date(now);
                startOfWeek.setHours(0, 0, 0, 0);
                startOfWeek.setDate(now.getDate() - now.getDay()); // Start on Sunday
                include = date >= startOfWeek;
            } else if (timeFrame === 'month') {
                include = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            }

            return include ? sum + revenue : sum;
        }, 0);
    }, [stats?.allOrders, timeFrame]);

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
        { label: "Today's Orders", value: stats?.todayOrders || '0', icon: <Activity size={20} />, color: "text-blue-400" },
        { label: `Rev (${timeFrame})`, value: `$${timeframeRevenue.toFixed(2)}`, icon: <DollarSign size={20} />, color: "text-green-400" },
        { label: "Online Restaurants", value: stats?.onlineRestaurants?.toString() || '0', icon: <Store size={20} />, color: "text-purple-400" },
        { label: "Active Drivers", value: stats?.activeDrivers?.toString() || '0', icon: <Users size={20} />, color: "text-orange-400" },
    ] : [
        { label: "Today's Orders", value: stats?.todayOrders || '0', icon: <Activity size={20} />, color: "text-accent" },
        { label: "Revenue (Today)", value: `$${stats?.todayRevenue?.toFixed(2) || '0.00'}`, icon: <DollarSign size={20} />, color: "text-green-400" },
        { label: "Avg Prep Time", value: stats?.avgPrepTime || '0m', icon: <Clock size={20} />, color: "text-purple-400" },
        { label: "Customer Rating", value: stats?.rating || '0.0', icon: <TrendingUp size={20} />, color: "text-yellow-400" },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold">Good morning, {profile?.full_name?.split(' ')[0] || 'User'}</h1>
                    <p className="text-muted text-sm mt-1">Here is what's happening today.</p>
                </div>
                {isAdmin && (
                    <div className="flex bg-white/5 p-1 rounded-xl gap-1">
                        {(['minute', 'hour', 'day', 'week', 'month'] as TimeFrame[]).map(tf => (
                            <button
                                key={tf}
                                onClick={() => setTimeFrame(tf)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${timeFrame === tf ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-muted hover:text-white hover:bg-white/5'}`}
                            >
                                {tf.toUpperCase()}
                            </button>
                        ))}
                    </div>
                )}
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
                {/* Revenue Chart Section */}
                <div className="lg:col-span-2 glass p-8 rounded-2xl flex flex-col h-[400px]">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-green-400" /> Platform Revenue ({timeFrame})
                    </h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#FB6502" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#FB6502" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: 'rgba(255,255,255,0.5)' }}
                                />
                                <YAxis
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `$${val}`}
                                    tick={{ fill: 'rgba(255,255,255,0.5)' }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ color: '#FB6502', fontWeight: 'bold' }}
                                    labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
                                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#FB6502"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Alerts Panel */}
                <div className="glass p-8 rounded-2xl flex flex-col h-[400px]">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <AlertCircle size={20} className="text-red-400" /> System Alerts
                    </h3>

                    <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                        {/* Combine stats.alerts with adminNotices */}
                        {((stats?.alerts || []).length > 0 || (adminNotices || []).length >0 ) ? (
                            <>
                                {stats?.alerts?.map((alert: any, idx: number) => (
                                    <div key={`stat-${idx}`} className={`p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 space-y-1`}>
                                        <p className="font-bold text-sm">{alert.title}</p>
                                        <p className="text-xs opacity-80">{alert.message}</p>
                                    </div>
                                ))}
                                {adminNotices?.map((notice: any) => (
                                    <div key={notice.id} className={`p-4 rounded-xl ${notice.read ? 'bg-white/5 opacity-60' : 'bg-accent/10 border border-accent/20'} text-white space-y-1`}>
                                        <div className="flex justify-between items-start">
                                            <p className="font-bold text-sm">{notice.title}</p>
                                            {!notice.read && <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
                                        </div>
                                        <p className="text-xs text-muted leading-relaxed">{notice.message}</p>
                                        <p className="text-[10px] opacity-40">
                                            {new Date(notice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-muted space-y-1">
                                <p className="font-bold text-sm text-white">All Systems Normal</p>
                                <p className="text-xs">No active alerts to report.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Live Orders moved below the chart */}
            <div className="glass p-8 rounded-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Activity size={20} className="text-accent" /> Recent Platform Activity
                    </h3>
                    <Link to={`/${currentRole}/orders`} className="text-xs font-bold text-accent hover:text-white flex items-center gap-1 transition-colors">
                        View Full History <ArrowRight size={14} />
                    </Link>
                </div>

                {recentOrders && recentOrders.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="text-xs uppercase text-muted border-b border-white/5">
                                <tr>
                                    <th className="pb-3 font-semibold">Order ID</th>
                                    {isAdmin && <th className="pb-3 font-semibold">Restaurant</th>}
                                    <th className="pb-3 font-semibold">Ordered</th>
                                    <th className="pb-3 font-semibold">Delivered</th>
                                    <th className="pb-3 font-semibold">Status</th>
                                    <th className="pb-3 font-semibold text-right">Commission</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {recentOrders.map((order: any) => (
                                    <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="py-4 text-sm font-medium text-white">#{order.id.slice(0, 5).toUpperCase()}</td>
                                        {isAdmin && <td className="py-4 text-sm text-muted">{order.restaurants?.name || 'Unknown'}</td>}
                                        <td className="py-4 text-sm text-muted">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium">
                                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                 <span className="text-[10px] uppercase font-bold text-accent/80">
                                                    {new Date(order.created_at).toDateString() === new Date().toDateString() ? 'Today' : new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                                 {order.fulfillment_type && String(order.fulfillment_type).toLowerCase().trim() === 'pickup' && (
                                                    <span className="mt-1 bg-purple-600 text-[9px] text-white px-1.5 py-0.5 rounded font-black uppercase w-fit animate-pulse">PRE-ORDER</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 text-sm text-muted">
                                            {order.delivered_at ? (
                                                <div className="flex flex-col">
                                                    <span className="text-white font-medium">
                                                        {new Date(order.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="text-[10px] uppercase font-bold text-green-400">
                                                        {new Date(order.delivered_at).toDateString() === new Date().toDateString() ? 'Today' : new Date(order.delivered_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                            ) : '---'}
                                        </td>
                                        <td className="py-4">
                                            <StatusPill status={order.status} />
                                        </td>
                                        <td className="py-4 text-sm font-bold text-green-400 text-right">
                                            ${order.pricing?.appetite_margin?.toFixed(2) || '0.00'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-muted text-sm space-y-2 py-10">
                        <Clock size={32} className="opacity-20" />
                        <p>No activity yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

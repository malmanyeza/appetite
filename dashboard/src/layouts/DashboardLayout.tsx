import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { restaurantService } from '../lib/services';
import {
    LayoutDashboard,
    Utensils,
    Bike,
    Settings,
    LogOut,
    ChevronRight,
    Search,
    Bell,
    User,
    Navigation
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const SidebarLink = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
    <Link
        to={to}
        className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
            active ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:bg-white/5 hover:text-white"
        )}
    >
        <Icon size={20} className={cn(active ? "" : "group-hover:scale-110 transition-transform")} />
        <span className="font-medium">{label}</span>
        {active && <ChevronRight size={16} className="ml-auto" />}
    </Link>
);

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
    const { currentRole, profile, signOut, roles, switchRole } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();

    const [notifications, setNotifications] = useState<{ id: string, message: string }[]>([]);

    const addNotification = (message: string) => {
        const id = Math.random().toString();
        setNotifications(prev => [...prev, { id, message }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 6000);
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const { data: restaurant } = useQuery({
        queryKey: ['my-restaurant'],
        queryFn: () => restaurantService.getMyRestaurant(profile?.id),
        enabled: !!profile?.id && currentRole === 'restaurant'
    });

    useEffect(() => {
        if (!profile?.id) return;

        let filterString = undefined;
        if (currentRole === 'restaurant' && restaurant?.id) {
            filterString = `restaurant_id=eq.${restaurant.id}`;
        } else if (currentRole === 'restaurant' && !restaurant?.id) {
            return; // Wait for restaurant ID to load
        }

        const channel = supabase.channel('global-orders')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: filterString
                },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: ['restaurant-orders'] });
                    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
                    queryClient.invalidateQueries({ queryKey: ['recent-orders'] });

                    if (payload.eventType === 'INSERT') {
                        const newOrder = payload.new as any;
                        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                        audio.play().catch(e => console.warn('Audio play failed:', e));

                        const shortId = newOrder?.id ? newOrder.id.slice(0, 5).toUpperCase() : 'NEW';
                        addNotification(`New order #${shortId} has arrived!`);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, currentRole, restaurant?.id, queryClient]);

    const navItems = currentRole === 'restaurant' ? [
        { to: '/restaurant/overview', icon: LayoutDashboard, label: 'Overview' },
        { to: '/restaurant/orders', icon: Bell, label: 'Orders' },
        { to: '/restaurant/menu', icon: Utensils, label: 'Menu' },
        { to: '/restaurant/settings', icon: Settings, label: 'Settings' },
    ] : [
        { to: '/admin/overview', icon: LayoutDashboard, label: 'Ops Console' },
        { to: '/admin/orders', icon: Bell, label: 'Global Orders' },
        { to: '/admin/restaurants', icon: Utensils, label: 'Restaurants' },
        { to: '/admin/drivers', icon: Bike, label: 'Drivers' },
        { to: '/admin/dispatch', icon: Navigation, label: 'Dispatch Control' },
        { to: '/admin/config', icon: Settings, label: 'App Config' },
    ];

    return (
        <div className="min-h-screen bg-background text-white flex flex-col">
            {/* Top Bar (Fixed) */}
            <header className="h-16 border-b border-white/5 px-6 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-md z-30">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-bold text-xl italic">A</div>
                        <h1 className="text-xl font-bold tracking-tight hidden sm:block">Appetite</h1>
                    </div>
                    <div className="h-6 w-[1px] bg-white/10 mx-2 hidden sm:block" />
                    <div className="flex items-center gap-2">
                        {currentRole === 'admin' ? (
                            <span className="bg-white/5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-white/5">Ops Console</span>
                        ) : (
                            <span className="bg-accent/10 px-3 py-1 rounded-full text-[10px] font-bold text-accent border border-accent/20 flex items-center gap-1.5 uppercase tracking-wider">
                                Restaurant Portal
                                {restaurant && <span className="opacity-70 text-white truncate max-w-[120px]">• {restaurant.name}</span>}
                            </span>
                        )}
                    </div>
                </div>

                {/* Global Search (Admin Only) */}
                {currentRole === 'admin' && (
                    <div className="hidden lg:flex flex-1 max-w-md mx-8 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search orders, restaurants, customers..."
                            className="w-full bg-surface border border-white/5 rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:border-accent/50 transition-colors"
                        />
                    </div>
                )}

                <div className="flex items-center gap-3">
                    {/* Notifications */}
                    <button className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface transition-colors">
                        <Bell size={18} className="text-muted-foreground" />
                        <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-accent border-2 border-background" />
                    </button>

                    <div className="h-6 w-[1px] bg-white/10 mx-1" />

                    {/* Profile Menu */}
                    <div className="flex items-center gap-3 group relative cursor-pointer">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-semibold leading-tight">{profile?.full_name || 'User'}</p>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center overflow-hidden border border-white/10">
                            <User size={18} className="text-muted-foreground" />
                        </div>

                        {/* Dropdown menu */}
                        <div className="absolute top-full right-0 mt-2 w-48 py-2 bg-surface border border-white/5 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-xl">
                            <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 flex items-center gap-2 transition-colors">
                                <LogOut size={16} /> Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Side Navigation */}
                <aside className="w-64 border-r border-white/5 flex flex-col p-4 bg-background overflow-y-auto">
                    <nav className="flex-1 space-y-1">
                        {navItems.map((item) => (
                            <SidebarLink
                                key={item.to}
                                {...item}
                                active={location.pathname === item.to}
                            />
                        ))}
                    </nav>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto bg-background/50">
                    <div className="p-8 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>

            {/* Global Toasts */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
                {notifications.map(n => (
                    <div key={n.id} className="bg-accent text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
                        <Bell size={24} className="animate-bounce" />
                        <div>
                            <p className="font-bold text-sm">Incoming Alert</p>
                            <p className="text-sm opacity-90">{n.message}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

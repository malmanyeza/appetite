import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { DashboardLayout } from './layouts/DashboardLayout';

// Pages
import { Overview } from './pages/Overview';
import { LoginPage } from './pages/LoginPage';
import { RestaurantOrders } from './pages/RestaurantOrders';
import { RestaurantMenu } from './pages/RestaurantMenu';
import { RestaurantSettings } from './pages/RestaurantSettings';
import { AdminOrders } from './pages/AdminOrders';
import { AdminRestaurants } from './pages/AdminRestaurants';
import { AdminDrivers } from './pages/AdminDrivers';
import { AdminDispatch } from './pages/AdminDispatch';
import { AdminConfig } from './pages/AdminConfig';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
    const { user, currentRole, loading, initialized, refreshSession } = useAuthStore();
    const location = useLocation();

    useEffect(() => {
        if (!initialized) refreshSession();
    }, [initialized, refreshSession]);

    if (loading) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

    if (allowedRoles) {
        if (!currentRole || !allowedRoles.includes(currentRole)) {
            if (!currentRole) {
                return <Navigate to="/login" replace />;
            }
            return <Navigate to={currentRole === 'restaurant' ? '/restaurant/overview' : '/admin/overview'} replace />;
        }
    }

    return <>{children}</>;
};

const queryClient = new QueryClient();

const RoleRedirect = () => {
    const { user, currentRole } = useAuthStore();
    if (!user) return <Navigate to="/login" replace />;
    const target = currentRole === 'admin' ? '/admin/overview' : '/restaurant/overview';
    return <Navigate to={target} replace />;
};

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />

                    <Route path="/restaurant/*" element={
                        <ProtectedRoute allowedRoles={['restaurant', 'admin']}>
                            <DashboardLayout>
                                <Routes>
                                    <Route path="overview" element={<Overview />} />
                                    <Route path="orders" element={<RestaurantOrders />} />
                                    <Route path="menu" element={<RestaurantMenu />} />
                                    <Route path="settings" element={<RestaurantSettings />} />
                                    <Route path="*" element={<Navigate to="overview" replace />} />
                                </Routes>
                            </DashboardLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/admin/*" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <DashboardLayout>
                                <Routes>
                                    <Route index element={<Overview />} />
                                    <Route path="orders" element={<AdminOrders />} />
                                    <Route path="restaurants" element={<AdminRestaurants />} />
                                    <Route path="restaurants/:id/menu" element={<RestaurantMenu />} />
                                    <Route path="restaurants/:id/settings" element={<RestaurantSettings />} />
                                    <Route path="drivers" element={<AdminDrivers />} />
                                    <Route path="dispatch" element={<AdminDispatch />} />
                                    <Route path="config" element={<AdminConfig />} />
                                    <Route path="*" element={<Navigate to="" replace />} />
                                </Routes>
                            </DashboardLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/" element={<RoleRedirect />} />
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;

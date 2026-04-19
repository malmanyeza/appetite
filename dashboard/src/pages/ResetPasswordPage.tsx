import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Lock, CheckCircle2, ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const ResetPasswordPage = () => {
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
    const [success, setSuccess] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const { updatePassword } = useAuthStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [initializing, setInitializing] = React.useState(true);

    React.useEffect(() => {
        const handleSession = async () => {
            const code = searchParams.get('code') || new URLSearchParams(window.location.search).get('code');
            if (code) {
                try {
                    await supabase.auth.exchangeCodeForSession(code);
                } catch (err) {
                    console.error('Session exchange error:', err);
                }
            }
            setInitializing(false);
        };
        handleSession();
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            await updatePassword(password);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            setError(err.message || 'An error occurred during password update.');
        } finally {
            setLoading(false);
        }
    };

    if (initializing) {
        return (
            <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-6 text-center">
                <div className="w-full max-w-md glass p-10 space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl mx-auto flex items-center justify-center border border-white/10">
                        <Loader2 className="text-[#FF4D00] animate-spin" size={40} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Initializing...</h1>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-6 text-center">
                <div className="w-full max-w-md glass p-10 space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-emerald-500 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                        <CheckCircle2 color="white" size={40} />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Password Updated!</h1>
                    <p className="text-[#A3A3A3]">
                        Your password has been changed successfully. 
                        Redirecting you to the login page...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-6">
            <div className="w-full max-w-md glass p-10 space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-[#FF4D00] rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-[#FF4D00]/20">
                        <ShieldCheck color="white" size={40} />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-white">Reset Password</h1>
                    <p className="text-[#A3A3A3] text-sm">Secure your account with a new password.</p>
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                        {error}
                    </div>
                )}

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[#A3A3A3] ml-1">New Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A3A3A3]" size={18} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/50 focus:border-[#FF4D00] transition-all text-white"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[#A3A3A3] ml-1">Confirm New Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A3A3A3]" size={18} />
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/50 focus:border-[#FF4D00] transition-all text-white"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-white transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary w-full py-4 text-lg font-bold" disabled={loading}>
                        {loading ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

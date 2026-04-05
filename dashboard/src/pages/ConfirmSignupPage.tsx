import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle2, XCircle, Loader2, Sparkles, LogIn } from 'lucide-react';

export const ConfirmSignupPage = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = React.useState('');
    const navigate = useNavigate();

    React.useEffect(() => {
        const handleConfirm = async () => {
            const code = searchParams.get('code');
            
            if (!code) {
                setStatus('error');
                setError('No verification code found in URL. Please use the original link from your email.');
                return;
            }

            try {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                if (exchangeError) throw exchangeError;
                
                setStatus('success');
            } catch (err: any) {
                console.error('Confirmation error:', err);
                setStatus('error');
                setError(err.message || 'Failed to verify your account. The link may have expired.');
            }
        };

        handleConfirm();
    }, [searchParams]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-6 text-center">
                <div className="w-full max-w-md glass p-10 space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl mx-auto flex items-center justify-center border border-white/10">
                        <Loader2 className="text-[#FF4D00] animate-spin" size={40} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Verifying Account...</h1>
                    <p className="text-[#A3A3A3]">Please wait while we confirm your email address.</p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-6 text-center">
                <div className="w-full max-w-md glass p-10 space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-red-500/10 rounded-3xl mx-auto flex items-center justify-center border border-red-500/20 shadow-2xl shadow-red-500/10">
                        <XCircle className="text-red-500" size={40} />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Verification Failed</h1>
                    <p className="text-red-400 text-sm bg-red-400/5 p-4 rounded-xl border border-red-400/10">
                        {error}
                    </p>
                    <button 
                        onClick={() => navigate('/login')}
                        className="btn-primary w-full py-4 flex items-center justify-center gap-2"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-6 text-center">
            <div className="w-full max-w-md glass p-10 space-y-8 animate-in fade-in zoom-in duration-500 relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF4D00]/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#FF4D00]/5 rounded-full blur-3xl" />

                <div className="relative z-10 space-y-6">
                    <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-2xl shadow-emerald-500/20 rotate-6 hover:rotate-0 transition-transform duration-500">
                        <CheckCircle2 color="white" size={48} />
                    </div>
                    
                    <div className="space-y-2">
                        <h1 className="text-4xl font-black tracking-tight text-white italic">WELCOME!</h1>
                        <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs">Email Verified Successfully</p>
                    </div>

                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10 text-left space-y-3">
                        <div className="flex items-center gap-3">
                            <Sparkles className="text-yellow-400" size={18} />
                            <p className="text-white font-medium text-sm">Your account is now ready.</p>
                        </div>
                        <p className="text-[#A3A3A3] text-sm leading-relaxed">
                            Thank you for verifying your email. You can now access all the features of the Appetite platform.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-4">
                        <p className="text-white font-medium bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                            Verification complete! You can now close this window and return to the Appetite app to continue.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

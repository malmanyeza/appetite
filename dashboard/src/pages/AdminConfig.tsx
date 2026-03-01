import * as React from 'react';
import { Settings, DollarSign, Map, Shield, Bell, Save } from 'lucide-react';

export const AdminConfig = () => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">System Configuration</h1>
                    <p className="text-[#A3A3A3] text-sm">Global application settings and fee structures</p>
                </div>
                <button className="btn-primary flex items-center gap-2 px-6">
                    <Save size={18} /> Deploy Changes
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Delivery Fees */}
                <div className="glass p-8 space-y-6">
                    <h3 className="font-bold flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FF4D00]/10 rounded-xl flex items-center justify-center text-[#FF4D00]">
                            <DollarSign size={20} />
                        </div>
                        Financials & Fees
                    </h3>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#A3A3A3] ml-1">Base Delivery Fee ($)</label>
                            <input type="number" defaultValue={2.50} step="0.5" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/50" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#A3A3A3] ml-1">Per KM Fee ($)</label>
                            <input type="number" defaultValue={0.50} step="0.1" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/50" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#A3A3A3] ml-1">Service Commission (%)</label>
                            <input type="number" defaultValue={15} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/50" />
                        </div>
                    </div>
                </div>

                {/* Operations */}
                <div className="glass p-8 space-y-6">
                    <h3 className="font-bold flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                            <Map size={20} />
                        </div>
                        Operational Radius
                    </h3>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#A3A3A3] ml-1">Max Delivery Distance (KM)</label>
                            <input type="number" defaultValue={15} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/50" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#A3A3A3] ml-1">Driver Search Radius (KM)</label>
                            <input type="number" defaultValue={5} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/50" />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                            <div>
                                <p className="text-sm font-medium">Auto-dispatch Orders</p>
                                <p className="text-[10px] text-[#A3A3A3]">Assign nearest biker automatically</p>
                            </div>
                            <button className="w-12 h-6 bg-[#FF4D00] rounded-full relative">
                                <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Security */}
                <div className="glass p-8 space-y-6">
                    <h3 className="font-bold flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                            <Shield size={20} />
                        </div>
                        Safety & Security
                    </h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                            <div>
                                <p className="text-sm font-medium">Biker Verification Required</p>
                                <p className="text-[10px] text-[#A3A3A3]">Manual approval for new drivers</p>
                            </div>
                            <button className="w-12 h-6 bg-[#FF4D00] rounded-full relative">
                                <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                            <div>
                                <p className="text-sm font-medium">PIN Delivery Verification</p>
                                <p className="text-[10px] text-[#A3A3A3]">Force 4-digit code on delivery</p>
                            </div>
                            <button className="w-12 h-6 bg-[#FF4D00] rounded-full relative">
                                <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className="glass p-8 space-y-6">
                    <h3 className="font-bold flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
                            <Bell size={20} />
                        </div>
                        Global Notifications
                    </h3>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#A3A3A3] ml-1">Biker Announcement Message</label>
                            <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/50" rows={3} placeholder="Broadcast to all drivers..." />
                        </div>
                        <button className="w-full py-3 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-xl text-xs font-bold transition-all">
                            Send Broadcast
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

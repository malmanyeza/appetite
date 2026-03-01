import * as React from 'react';
import { useState } from 'react';
import { Upload, X, Plus } from 'lucide-react';
import { restaurantService } from '../lib/services';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ImageUploadFieldProps {
    value?: string;
    onUpload: (url: string) => void;
    path: string;
    compact?: boolean;
}

export const ImageUploadField = ({ value, onUpload, path, compact }: ImageUploadFieldProps) => {
    const [uploading, setUploading] = useState(false);
    const [localPreview, setLocalPreview] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setErrorMsg(null);
            const file = e.target.files?.[0];
            if (!file) return;

            // Show instant local preview
            const objectUrl = URL.createObjectURL(file);
            setLocalPreview(objectUrl);
            setUploading(true);

            const url = await restaurantService.uploadImage(file, path);
            onUpload(url);

            // Note: we purposely do not revoke objectUrl here so it stays visible 
            // until the main component re-renders with the true value.
        } catch (error: any) {
            console.error('Upload error:', error);
            setErrorMsg(error?.message || 'Unknown error occurred.');
            setLocalPreview(null); // Revert preview on failure
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = () => {
        setLocalPreview(null);
        setErrorMsg(null);
        onUpload('');
    };

    const displayUrl = localPreview || value;

    return (
        <div className="space-y-2">
            <div className={cn(
                "relative group rounded-2xl border-2 border-dashed border-white/10 overflow-hidden bg-white/5 hover:border-[#FF4D00]/50 transition-all",
                compact ? "aspect-square w-full" : "aspect-video w-full"
            )}>
                {displayUrl ? (
                    <>
                        {uploading && (
                            <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            </div>
                        )}
                        <img src={displayUrl} alt="Preview" className="w-full h-full object-cover" />

                        {!uploading && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 z-20">
                                <label className="cursor-pointer p-3 bg-[#FF4D00] rounded-full text-white hover:scale-110 transition-transform">
                                    <Upload size={20} />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
                                </label>
                                <button
                                    type="button"
                                    onClick={handleRemove}
                                    className="p-3 bg-red-500 rounded-full text-white hover:scale-110 transition-transform"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center gap-2 group-hover:text-[#FF4D00] transition-colors">
                        <div className={cn(
                            "rounded-full bg-white/5 flex items-center justify-center transition-all group-hover:bg-[#FF4D00]/10",
                            compact ? "w-10 h-10" : "w-16 h-16"
                        )}>
                            {uploading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current" /> : <Plus size={compact ? 20 : 32} />}
                        </div>
                        {!compact && <span className="text-sm font-bold">Click to upload image</span>}
                        <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
                    </label>
                )}
            </div>
            {errorMsg && (
                <div className="text-red-500 text-xs font-bold bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                    ⚠️ Error: {errorMsg}
                </div>
            )}
        </div>
    );
};

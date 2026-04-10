"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { login as loginApi } from '@/services/api';
import { useRouter } from 'next/navigation';

export default function RootPage() {
    const { user, login: setAuth, loading } = useAuth();
    const router = useRouter();
    
    // Default email is set to standard test user to maintain easy testing,
    // though the UI visually matches the reference placeholder
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            router.push('/dashboard');
        }
    }, [user, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const data = await loginApi(email, password);
            setAuth(data.user, data.token);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    if (loading || user) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#3b7bed] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex bg-[#3b7bed] font-sans selection:bg-indigo-300/30 overflow-hidden relative">
            {/* Left Column: White Canvas with Illustration */}
            <div className="hidden lg:flex w-1/2 bg-white relative flex-col items-center justify-center p-12">
                {/* Top Left Accent Abstract Shape */}
                <div className="absolute top-0 left-0">
                    <svg width="250" height="250" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0H150V50C150 77.6142 127.614 100 100 100H50C22.3858 100 0 77.6142 0 50V0Z" fill="#3b7bed"/>
                    </svg>
                </div>
                
                {/* Bottom Right Accent Quarter Circle */}
                <div className="absolute bottom-0 right-0">
                    <div className="w-32 h-32 bg-[#3b7bed] rounded-tl-full"></div>
                </div>

                {/* Main Isometric Illustration */}
                <div className="relative z-10 w-full max-w-lg mb-8">
                    <img 
                        src="/assets/isometric_workspace.png" 
                        alt="Workspace Illustration" 
                        className="w-full h-auto object-contain drop-shadow-sm mix-blend-multiply pointer-events-none"
                    />
                </div>
            </div>

            {/* Right Column: Blue Canvas with Forms */}
            <div className="w-full lg:w-1/2 relative flex items-center justify-center p-6 sm:p-12 overflow-hidden">
                {/* Background Ring Decorations */}
                <svg className="absolute w-[600px] h-[600px] text-white/10 right-[-150px] bottom-[-200px] pointer-events-none" viewBox="0 0 200 200" fill="none">
                    <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.5" />
                    <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.5" />
                    <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="0.5" />
                </svg>

                <svg className="absolute w-[400px] h-[400px] text-white/5 left-[-100px] top-[100px] pointer-events-none" viewBox="0 0 200 200" fill="none">
                    <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.5" />
                    <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.5" />
                </svg>

                {/* Login Card Container */}
                <div className="w-full max-w-[440px] bg-white rounded-[24px] shadow-2xl z-10 overflow-hidden relative">
                    <div className="p-10 sm:p-12 pb-6">
                        
                        {/* Logo */}
                        <div className="mb-8">
                            <img 
                                src="/bluenote-logo.png" 
                                alt="Bluenote" 
                                className="h-20 object-contain -ml-2"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    e.currentTarget.parentElement!.innerHTML = '<span class="text-2xl font-bold tracking-tight text-[#3b7bed]">Bluenote</span>';
                                }}
                            />
                        </div>

                        {/* Heading & Subtitle */}
                        <div className="mb-8">
                            <h1 className="text-[32px] font-bold text-slate-800 leading-tight mb-2 tracking-tight">
                                Hello!
                            </h1>
                            <p className="text-[15px] font-medium text-slate-500">
                                Sign Up to Get Started
                            </p>
                        </div>

                        {/* Login Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-red-50 text-red-500 text-sm font-medium px-4 py-3 rounded-[16px]">
                                    {error}
                                </div>
                            )}

                            {/* Username / Email Field */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-[18px] w-[18px] text-slate-400 group-focus-within:text-[#3b7bed] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                    </svg>
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-[44px] pr-4 py-[14px] border border-slate-200 rounded-[20px] text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3b7bed] focus:ring-1 focus:ring-[#3b7bed] transition-all bg-white"
                                    placeholder="Username"
                                />
                            </div>

                            {/* Password Field */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-[18px] w-[18px] text-slate-400 group-focus-within:text-[#3b7bed] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-[44px] pr-4 py-[14px] border border-slate-200 rounded-[20px] text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3b7bed] focus:ring-1 focus:ring-[#3b7bed] transition-all bg-white"
                                    placeholder="Password"
                                />
                            </div>

                            {/* Action Button */}
                            <div className="pt-2 pb-1">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-[#3b7bed] hover:bg-[#3269cf] text-white font-semibold text-[15px] py-[15px] rounded-[24px] shadow-lg shadow-[#3b7bed]/30 transition-all active:scale-[0.98] disabled:opacity-75 disabled:active:scale-100 flex items-center justify-center"
                                >
                                    {isLoading ? (
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        "Login"
                                    )}
                                </button>
                            </div>

                            {/* Forgot Password */}
                            <div className="pt-1">
                                <a href="#" className="text-[13px] font-medium text-slate-500 hover:text-[#3b7bed] transition-colors">
                                    Forgot Password
                                </a>
                            </div>
                        </form>

                    </div>
                    
                    {/* Test Credentials Helper Area (Subtle overlay beneath main form) */}
                    <div className="bg-slate-50 border-t border-slate-100 px-10 py-5">
                        <div className="flex justify-between items-center opacity-70 hover:opacity-100 transition-opacity">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Test Account</span>
                            <div className="text-right">
                                <span className="text-[13px] text-slate-500 font-medium block">test@bbik.com</span>
                                <span className="text-[11px] text-slate-400 font-mono">password123</span>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => { setEmail('test@bbik.com'); setPassword('password123'); }}
                                className="text-[11px] bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-1.5 rounded-full font-medium transition-colors"
                            >
                                Auto-Fill
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

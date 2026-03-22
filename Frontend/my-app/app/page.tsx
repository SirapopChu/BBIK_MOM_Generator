"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { login as loginApi } from '@/services/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RootPage() {
    const { user, login: setAuth, loading } = useAuth();
    const router = useRouter();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // If already authenticated, bypass login and go to dashboard
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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-white font-medium">Initialising session...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex selection:bg-indigo-500/30">
            {/* Left Column: Branding / Cinematic Background */}
            <div className="hidden lg:flex lg:w-3/5 xl:w-[65%] relative overflow-hidden bg-slate-950">
                <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-[20s] hover:scale-105"
                    style={{ backgroundImage: "url('/assets/login_bg.png')" }}
                />
                
                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/20" />

                {/* Content Overlay */}
                <div className="relative z-10 p-16 flex flex-col justify-between h-full max-w-2xl">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                            </div>
                            <span className="text-2xl font-bold text-white tracking-tight uppercase">BBIK MOM Generator</span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h2 className="text-5xl font-bold text-white leading-[1.15]">
                            Professional Meeting Intelligence <span className="text-indigo-500">Starts Here.</span>
                        </h2>
                        <p className="text-slate-300 text-lg max-w-md leading-relaxed">
                            Automate transcription, analysis, and document generation for all meeting minutes 
                            with our enterprise AI processing pipeline.
                        </p>
                        
                        <div className="pt-8 flex items-center gap-12 border-t border-slate-800">
                            <div>
                                <p className="text-white font-bold text-2xl">Large-v3</p>
                                <p className="text-slate-500 text-sm uppercase tracking-wider mt-1">Transcription Engine</p>
                            </div>
                            <div>
                                <p className="text-white font-bold text-2xl">Claude 3.5</p>
                                <p className="text-slate-500 text-sm uppercase tracking-wider mt-1">Analytical Core</p>
                            </div>
                            <div>
                                <p className="text-white font-bold text-2xl">AES-256</p>
                                <p className="text-slate-500 text-sm uppercase tracking-wider mt-1">Data Isolation</p>
                            </div>
                        </div>
                    </div>

                    <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">
                        Bluebik Technology © 2026 - iTPM Unit
                    </p>
                </div>
            </div>

            {/* Right Column: Login Form */}
            <div className="w-full lg:w-2/5 xl:w-[35%] bg-slate-900 border-l border-slate-800 flex flex-col items-center justify-center p-8 md:p-12">
                <div className="w-full max-w-sm space-y-10">
                    <div className="space-y-3">
                        <div className="lg:hidden flex items-center justify-center mb-10">
                            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Login Portal</h1>
                        <p className="text-slate-400">Please authenticate to access the dashboard</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Company Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded-xl px-4 py-4 text-white placeholder:text-slate-600 transition-all outline-none"
                                placeholder="name@bbik.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-sm font-semibold text-slate-300">Password</label>
                                <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium decoration-indigo-500/30 hover:underline">Forgot?</a>
                            </div>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded-xl px-4 py-4 text-white placeholder:text-slate-600 transition-all outline-none"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-3 group mt-4"
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <>
                                    Log In to Dashboard
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform">
                                        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="bg-indigo-500/5 border border-indigo-500/10 p-5 rounded-2xl space-y-2">
                        <p className="text-white text-xs font-bold uppercase tracking-wider">Test Credentials</p>
                        <div className="flex flex-col gap-1">
                            <p className="text-slate-400 text-sm">
                                Email: <span className="text-indigo-300 font-mono">test@bbik.com</span>
                            </p>
                            <p className="text-slate-400 text-sm">
                                Password: <span className="text-indigo-300 font-mono">password123</span>
                            </p>
                        </div>
                    </div>

                    <div className="pt-6 text-center border-t border-slate-800">
                        <p className="text-slate-500 text-sm">
                            New user?{' '}
                            <Link href="/register" className="text-white font-bold hover:text-indigo-400 transition-colors">
                                Create account
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

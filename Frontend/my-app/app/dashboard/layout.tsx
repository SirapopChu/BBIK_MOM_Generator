"use client";

import React from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';

export default function DashboardRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <LanguageProvider>
            {children}
        </LanguageProvider>
    );
}

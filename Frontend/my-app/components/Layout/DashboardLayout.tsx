"use client";

import React, { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
    children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className={styles.layout}>
            {/* Mobile Overlay */}
            {sidebarOpen && <div className={styles.mobileOverlay} onClick={() => setSidebarOpen(false)} />}

            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className={styles.mainContent}>
                <Header onMenuClick={() => setSidebarOpen(true)} />
                <main className={styles.contentScroll}>
                    {children}
                </main>
                <footer className={styles.footer}>
                    © 2024 Bluebik Group Public Company Limited - DX Business Unit (iTPM)
                </footer>
            </div>
        </div>
    );
};

export default DashboardLayout;

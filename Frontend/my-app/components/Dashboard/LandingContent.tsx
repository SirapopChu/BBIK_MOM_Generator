"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import styles from './LandingContent.module.css';

const LandingContent = () => {
    const router = useRouter();
    return (
        <div className={styles.container}>
            <h1 className={styles.welcomeText}>Welcome back, Tipakorn!</h1>

            <div className={styles.topCards}>
                <div className={`${styles.actionCard} ${styles.primaryCard}`} onClick={() => router.push('/dashboard/new-meeting')} style={{cursor: 'pointer'}}>
                    <div className={styles.cardIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                    </div>
                    <h2 className={styles.cardTitle}>New Meeting</h2>
                    <p className={styles.cardDesc}>Start a live recording or AI transcription.</p>
                </div>

                <div className={`${styles.actionCard} ${styles.secondaryCard}`}>
                    <div className={styles.cardIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </div>
                    <h2 className={styles.cardTitle}>Review Queue</h2>
                    <p className={styles.cardDesc}>Check 12 summaries waiting for approval.</p>
                </div>
            </div>

            <div className={styles.mainGrid}>
                {/* Left Column */}
                <div className={styles.recentMeetings}>
                    <div className={styles.panelCard}>
                        <div className={styles.panelHeader}>
                            <div>
                                <h3 className={styles.panelTitle}>Recent Meetings</h3>
                                <p className={styles.panelSubtitle}>History of your processed meeting intelligence</p>
                            </div>
                            <button className={styles.viewAllBtn}>View All</button>
                        </div>

                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Meeting Title</th>
                                        <th>Date & Time</th>
                                        <th>Duration</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No recent meetings found.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className={styles.statsContainer}>
                    <div className={styles.statCardsRow}>
                        <div className={styles.statCard}>
                            <div>
                                <div className={styles.statLabel}>MEETINGS SAVED TODAY</div>
                                <div className={styles.statValueContainer}>
                                    <span className={styles.statValue}>14</span>
                                    <span className={`${styles.statBadge} ${styles.statBadgePositive}`}>+24%</span>
                                </div>
                            </div>
                            <div className={styles.statIcon}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </div>
                        </div>

                        <div className={styles.statCard}>
                            <div>
                                <div className={styles.statLabel}>AVG. PROCESSING TIME</div>
                                <div className={styles.statValueContainer}>
                                    <span className={styles.statValue}>1.8m</span>
                                    <span className={`${styles.statBadge} ${styles.statBadgePositive}`}>-12%</span>
                                </div>
                            </div>
                            <div className={styles.statIcon}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            </div>
                        </div>
                    </div>

                    <div className={styles.panelCard}>
                        <div className={styles.panelHeader}>
                            <div>
                                <h3 className={styles.panelTitle}>Active Tasks</h3>
                                <p className={styles.panelSubtitle}>Real-time AI processing</p>
                            </div>
                            <span className={styles.statusDot} style={{ backgroundColor: '#6366f1' }}></span>
                        </div>

                        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                            No active tasks running at the moment.
                        </div>

                        <div className={styles.activeTasksFooter}>
                            <button className={styles.openTasksBtn}>
                                Open Tasks Manager
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    </div>

                    <div className={styles.insightsCard}>
                        <div className={styles.insightsDecoration}>
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                        </div>
                        <h3 className={styles.insightsTitle}>Insights Tip</h3>
                        <p className={styles.insightsText}>
                            AI detected that your meetings have become 15% more concise since last month. Keep it up!
                        </p>
                        <a href="#" className={styles.readLink}>
                            Read Analysis
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingContent;

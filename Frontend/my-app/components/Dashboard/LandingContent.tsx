"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './LandingContent.module.css';

const API_BASE = 'http://localhost:3001/api';

interface Task {
    id: string;
    title: string;
    status: 'processing' | 'completed' | 'failed' | 'queued';
    progress: number;
    timestamp: string;
}

const LandingContent = () => {
    const router = useRouter();
    const [tasks, setTasks] = useState<Task[]>([]);

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const res = await fetch(`${API_BASE}/tasks`);
                const data = await res.json();
                setTasks(data.tasks);
            } catch (err) {
                console.error('[LandingFetch]', err);
            }
        };

        fetchTasks();
        const interval = setInterval(fetchTasks, 5000);
        return () => clearInterval(interval);
    }, []);

    const activeTasks = tasks.filter(t => t.status === 'processing' || t.status === 'queued');
    const recentTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed').slice(0, 5);

    return (
        <div className={styles.container}>
            <h1 className={styles.welcomeText}>Welcome back, Tipakorn!</h1>

            <div className={styles.topCards}>
                <div className={`${styles.actionCard} ${styles.primaryCard}`} onClick={() => router.push('/dashboard/new-meeting')} style={{ cursor: 'pointer' }}>
                    <div className={styles.cardIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                    </div>
                    <h2 className={styles.cardTitle}>New Meeting</h2>
                    <p className={styles.cardDesc}>Start a live recording or AI transcription.</p>
                </div>

                <div className={`${styles.actionCard} ${styles.secondaryCard}`} onClick={() => router.push('/dashboard/processing-queue')} style={{ cursor: 'pointer' }}>
                    <div className={styles.cardIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </div>
                    <h2 className={styles.cardTitle}>Review Queue</h2>
                    <p className={styles.cardDesc}>Check summaries waiting for approval.</p>
                </div>
            </div>

            <div className={styles.mainGrid}>
                {/* Left Column: Recent Meetings */}
                <div className={styles.recentMeetings}>
                    <div className={styles.panelCard}>
                        <div className={styles.panelHeader}>
                            <div>
                                <h3 className={styles.panelTitle}>Recent Meetings</h3>
                                <p className={styles.panelSubtitle}>History of your processed meeting intelligence</p>
                            </div>
                            <button className={styles.viewAllBtn} onClick={() => router.push('/dashboard/processing-queue')}>View All</button>
                        </div>

                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Meeting Title</th>
                                        <th>Date & Time</th>
                                        <th>Status</th>
                                        <th>ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTasks.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No recent meetings found.</td>
                                        </tr>
                                    ) : (
                                        recentTasks.map(task => (
                                            <tr key={task.id} style={{ cursor: 'pointer' }} onClick={() => router.push('/dashboard/processing-queue')}>
                                                <td style={{ fontWeight: 600 }}>{task.title}</td>
                                                <td>{new Date(task.timestamp).toLocaleString()}</td>
                                                <td>
                                                    <span style={{ 
                                                        color: task.status === 'completed' ? '#10b981' : '#f43f5e',
                                                        fontSize: '0.75rem', 
                                                        fontWeight: 700 
                                                    }}>
                                                        {task.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>{task.id}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Stats & Active Tasks */}
                <div className={styles.statsContainer}>
                    <div className={styles.statCardsRow}>
                        <div className={styles.statCard}>
                            <div>
                                <div className={styles.statLabel}>MEETINGS PROCESSED</div>
                                <div className={styles.statValueContainer}>
                                    <span className={styles.statValue}>{recentTasks.length}</span>
                                </div>
                            </div>
                            <div className={styles.statIcon}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </div>
                        </div>

                        <div className={styles.statCard}>
                            <div>
                                <div className={styles.statLabel}>ACTIVE TASKS</div>
                                <div className={styles.statValueContainer}>
                                    <span className={styles.statValue}>{activeTasks.length}</span>
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
                            {activeTasks.length > 0 && <span className={styles.statusDot} style={{ backgroundColor: '#6366f1' }}></span>}
                        </div>

                        {activeTasks.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                                No active tasks running at the moment.
                            </div>
                        ) : (
                            <div className={styles.activeTasksList} style={{ padding: '1rem' }}>
                                {activeTasks.map(task => (
                                    <div key={task.id} style={{ marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{task.title}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 700 }}>{task.progress}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ width: `${task.progress}%`, height: '100%', background: '#6366f1', transition: 'width 0.3s' }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={styles.activeTasksFooter}>
                            <button className={styles.openTasksBtn} onClick={() => router.push('/dashboard/processing-queue')}>
                                Open Tasks Manager
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    </div>

                    <div className={styles.insightsCard}>
                        <div className={styles.insightsDecoration}>
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                        </div>

                        <a href="/dashboard/processing-queue" className={styles.readLink}>
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

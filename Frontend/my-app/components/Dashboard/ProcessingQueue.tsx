"use client";

import React, { useState, useEffect } from 'react';
import styles from './ProcessingQueue.module.css';
import { useI18n } from '@/contexts/LanguageContext';
import Cookies from 'js-cookie';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const PROCESSING_STEPS = [
    { id: 'upload', label: 'Upload', description: 'Receiving media stream' },
    { id: 'transcribe', label: 'Transcribe', description: 'Speech-to-Text conversion' },
    { id: 'analyze', label: 'Analyze', description: 'AI Meeting Intelligence' },
    { id: 'format', label: 'Format', description: 'Bilingual DOCX generation' },
    { id: 'export', label: 'Export', description: 'Ready for download' },
];

interface Task {
    id: string;
    title: string;
    type: string;
    status: 'processing' | 'completed' | 'failed' | 'queued' | 'cancelled';
    currentStep: string;
    progress: number;
    timestamp: string;
    completedAt: string | null;
}

interface LogEntry {
    time: string;
    msg: string;
}

const ProcessingQueue = () => {
    const { dict } = useI18n();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const getHeaders = (): Record<string, string> => {
        const token = Cookies.get('auth_token');
        const headers: Record<string, string> = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    };

    const fetchTasks = async () => {
        try {
            const res = await fetch(`${API_BASE}/tasks`, { headers: getHeaders() });
            const data = await res.json();
            setTasks(data.tasks || []);
            
            // If nothing is selected, select the first one if tasks exist
            if (!selectedTaskId && data.tasks && data.tasks.length > 0) {
                setSelectedTaskId(data.tasks[0].id);
            }
        } catch (err) {
            console.error('[FetchTasks]', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async (taskId: string) => {
        try {
            const res = await fetch(`${API_BASE}/tasks/${taskId}/logs`, { headers: getHeaders() });
            const data = await res.json();
            setLogs(data.logs || []);
        } catch (err) {
            console.error('[FetchLogs]', err);
        }
    };

    const handleCancelTask = async (taskId: string) => {
        if (!confirm(dict.queue.cancelConfirm)) return;
        try {
            await fetch(`${API_BASE}/tasks/${taskId}/cancel`, { method: 'POST', headers: getHeaders() });
            fetchTasks();
        } catch (err) {
            console.error('[CancelTask]', err);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm(dict.queue.deleteConfirm)) return;
        try {
            await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE', headers: getHeaders() });
            if (selectedTaskId === taskId) setSelectedTaskId(null);
            fetchTasks();
        } catch (err) {
            console.error('[DeleteTask]', err);
        }
    };

    const handleClearHistory = async () => {
        if (!confirm(dict.queue.clearConfirm)) return;
        try {
            await fetch(`${API_BASE}/tasks`, { method: 'DELETE', headers: getHeaders() });
            fetchTasks();
        } catch (err) {
            console.error('[ClearHistory]', err);
        }
    };

    const handleDownload = async (task: Task) => {
        try {
            const res = await fetch(`${API_BASE}/tasks/${task.id}/download`, { headers: getHeaders() });
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${task.title.replace(/\s+/g, '_')}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            alert(dict.queue.downloadFailed);
        }
    };

    // Initial load and polling for tasks
    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 3000);
        return () => clearInterval(interval);
    }, [selectedTaskId]);

    // Polling for selected task logs
    useEffect(() => {
        if (!selectedTaskId) return;
        fetchLogs(selectedTaskId);
        const logInterval = setInterval(() => fetchLogs(selectedTaskId), 2000);
        return () => clearInterval(logInterval);
    }, [selectedTaskId]);

    const activeTask = tasks.find(t => t.id === selectedTaskId) || (tasks.length > 0 ? tasks[0] : null);
    const historyTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');
    const runningTasks = tasks.filter(t => t.status === 'processing' || t.status === 'queued');

    if (loading && tasks.length === 0) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>{dict.common.loading}...</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.welcomeText}>{dict.queue.title}</h1>
                    <p className={styles.subtitle}>{dict.queue.subtitle}</p>
                </div>
                {historyTasks.length > 0 && (
                    <button className={styles.clearHistoryBtn} onClick={handleClearHistory}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        {dict.queue.clearHistory}
                    </button>
                )}
            </div>

            <div className={styles.mainGrid}>
                {/* Left: Active Queue & Pipeline */}
                <div className={styles.leftColumn} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Active Task Detail */}
                    {activeTask ? (
                        <div className={styles.panelCard}>
                            <div className={styles.panelHeader}>
                                <h3 className={styles.panelTitle}>{dict.queue.pipelineStatus}</h3>
                                <div className={styles.taskIdBadge}>{activeTask.id}</div>
                            </div>
                            
                            <div className={styles.pipelineWrapper}>
                                {PROCESSING_STEPS.map((step, idx) => {
                                    const stepOrder = PROCESSING_STEPS.findIndex(s => s.id === activeTask.currentStep);
                                    const isCompleted = activeTask.status === 'completed' || stepOrder > idx;
                                    const isActive = step.id === activeTask.currentStep && activeTask.status !== 'completed';
                                    
                                    return (
                                        <div key={step.id} className={styles.pipelineStep}>
                                            <div className={`${styles.stepIndicator} ${isCompleted ? styles.stepCompleted : ''} ${isActive ? styles.stepActive : ''}`}>
                                                {isCompleted ? (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                ) : (idx + 1)}
                                            </div>
                                            <div className={styles.stepContent}>
                                                <div className={styles.stepLabel}>{step.label}</div>
                                                <div className={styles.stepDesc}>{step.description}</div>
                                            </div>
                                            {idx < PROCESSING_STEPS.length - 1 && <div className={styles.stepConnector}></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className={styles.panelCard} style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                            {dict.dashboard.noTasks}
                        </div>
                    )}

                    {/* Active Queue List */}
                    <div className={styles.panelCard}>
                        <div className={styles.panelHeader}>
                            <h3 className={styles.panelTitle}>{dict.queue.activeQueue}</h3>
                            <span className={styles.queueCount}>{runningTasks.length} {dict.queue.running}</span>
                        </div>

                        <div className={styles.queueList}>
                            {runningTasks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    {dict.queue.noActive}
                                </div>
                            ) : (
                                runningTasks.map(task => (
                                    <div 
                                        key={task.id} 
                                        className={`${styles.queueItem} ${selectedTaskId === task.id ? styles.queueItemActive : ''}`}
                                        onClick={() => setSelectedTaskId(task.id)}
                                    >
                                        <div className={styles.queueItemMain}>
                                            <div className={styles.taskTitle}>{task.title}</div>
                                            <div className={styles.taskMeta}>
                                                <span className={`${styles.taskStatusIndicator} ${task.status === 'failed' ? styles.statusFailed : ''}`}></span>
                                                {task.status.toUpperCase()} • {new Date(task.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className={styles.queueItemRow}>
                                            <div className={styles.progressRingWrapper}>
                                                <div className={styles.progressValue}>{task.progress}%</div>
                                                <svg className={styles.progressRing} width="40" height="40">
                                                    <circle className={styles.progressRingBg} cx="20" cy="20" r="16" />
                                                    <circle 
                                                        className={styles.progressRingFill} 
                                                        cx="20" cy="20" r="16" 
                                                        style={{ strokeDashoffset: 100 - (task.progress || 0) }}
                                                    />
                                                </svg>
                                            </div>
                                            <button 
                                                className={styles.cancelBtn} 
                                                onClick={(e) => { e.stopPropagation(); handleCancelTask(task.id); }}
                                                title={dict.queue.cancelBtn}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Live Logs & History */}
                <div className={styles.rightColumn}>
                    {/* Live Logs */}
                    <div className={styles.logsCard}>
                        <div className={styles.panelHeader}>
                            <div>
                                <h3 className={styles.panelTitle} style={{ color: 'white' }}>{dict.queue.logsTitle}</h3>
                                <p className={styles.panelSubtitle}>{selectedTaskId || dict.queue.statusFeed}</p>
                            </div>
                            {activeTask?.status === 'processing' && <div className={styles.pulseDot}></div>}
                        </div>

                        <div className={styles.logTerminal}>
                            {logs.length === 0 && selectedTaskId ? (
                                <div style={{ color: '#475569' }}>{dict.common.loading}...</div>
                            ) : logs.length === 0 ? (
                                <div style={{ color: '#475569' }}>{dict.queue.noActive}</div>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className={styles.logLine}>
                                        <span className={styles.logTime}>[{log.time}]</span>
                                        <span className={styles.logMsg}>{log.msg}</span>
                                    </div>
                                ))
                            )}
                            <div className={styles.logLineCursor}>_</div>
                        </div>
                    </div>

                    {/* History */}
                    <div className={styles.panelCard} style={{ marginTop: '1.5rem' }}>
                        <div className={styles.panelHeader}>
                            <h3 className={styles.panelTitle}>{dict.queue.taskHistory}</h3>
                        </div>

                        <div className={styles.historyList}>
                            {historyTasks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>{dict.queue.noHistory}</div>
                            ) : (
                                historyTasks.map(item => (
                                    <div 
                                        key={item.id} 
                                        className={`${styles.historyItem} ${selectedTaskId === item.id ? styles.historyItemActive : ''}`}
                                        onClick={() => setSelectedTaskId(item.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className={styles.historyInfo}>
                                            <div className={styles.historyTitle}>{item.title}</div>
                                            <div className={styles.historyMeta}>
                                                {new Date(item.timestamp).toLocaleDateString()}
                                                <span style={{ 
                                                    color: item.status === 'completed' ? '#10b981' : item.status === 'cancelled' ? '#94a3b8' : '#f43f5e', 
                                                    marginLeft: '0.5rem' 
                                                }}>
                                                    • {item.status.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={styles.historyActions}>
                                            {item.status === 'completed' && (
                                                <button className={styles.downloadIconBtn} onClick={(e) => { e.stopPropagation(); handleDownload(item); }}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                </button>
                                            )}
                                            <button className={styles.deleteIconBtn} onClick={(e) => { e.stopPropagation(); handleDeleteTask(item.id); }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProcessingQueue;

"use client";

import React, { useState, useEffect } from 'react';
import styles from './ProcessingView.module.css';
import { useI18n } from '@/contexts/LanguageContext';

import * as api from '../../services/api';

interface ProcessingViewProps {
    taskId: string;
    onClose?: () => void;
    localProgressMsg?: string;
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ taskId, onClose, localProgressMsg }) => {
    const { dict } = useI18n();
    const [task, setTask] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Poll for task status
    useEffect(() => {
        if (!taskId) return;

        const fetchStatus = async () => {
            try {
                const fetchedTask = await api.getTask(taskId);
                if (fetchedTask) {
                    setTask(fetchedTask);
                    if (fetchedTask.status === 'completed' || fetchedTask.status === 'failed') {
                        clearInterval(interval);
                    }
                }
            } catch (err) {
                console.error('Polling error', err);
            }
        };

        const fetchLogs = async () => {
            try {
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                const Cookies = (await import('js-cookie')).default;
                const res = await fetch(`${API_BASE}/api/tasks/${taskId}/logs`, {
                    headers: { 'Authorization': `Bearer ${Cookies.get('auth_token')}` }
                });
                const data = await res.json();
                if (data.logs) setLogs(data.logs);
            } catch (err) {}
        };

        const interval = setInterval(() => {
            fetchStatus();
            fetchLogs();
        }, 1500);

        fetchStatus();
        fetchLogs();
        return () => clearInterval(interval);
    }, [taskId]);

    const handleDownload = async () => {
        if (!taskId) return;
        try {
            const filename = task?.title ? `${task.title.replace(/\s+/g, '_')}.docx` : 'meeting_minutes.docx';
            await api.downloadTaskResult(taskId, filename);
        } catch (err) {
            console.error('Download error:', err);
            alert(dict.common.loading); // Falling back or using a general error if available
        }
    };

    const handleCancel = async () => {
        if (!taskId) return;
        if (!confirm(dict.processing.cancelBtn + '?')) return;
        try {
            await api.cancelTask(taskId);
            onClose?.();
        } catch (err) {
            console.error('Cancel error', err);
            onClose?.();
        }
    };

    const displayPct = task?.progress ?? 0;
    const currentStepLabel = task?.status === 'failed' ? dict.processing.failed 
                           : task?.status === 'completed' ? dict.processing.complete
                           : task?.status === 'cancelled' ? dict.processing.cancelled
                           : task ? `${dict.processing.step}: ${task.currentStep || dict.processing.initializing}` 
                           : localProgressMsg ? localProgressMsg
                           : dict.processing.initializing;

    const progressDeg = (displayPct / 100) * 360;

    return (
        <div className={styles.processingOverlay}>
            <div className={styles.outerCircle}></div>
            <div className={styles.innerCircleSmall}></div>

            <h1 className={styles.title}>{currentStepLabel}</h1>

            <div className={styles.progressContainer}>
                <div
                    className={styles.circularProgress}
                    style={{ 
                        '--progress': `${progressDeg}deg`,
                        borderColor: task?.status === 'failed' ? '#ef4444' : task?.status === 'cancelled' ? '#94a3b8' : '#6366f1'
                    } as React.CSSProperties}
                >
                    <div className={styles.circularProgressInner}>
                        <span className={styles.percentage} style={{ color: task?.status === 'failed' ? '#ef4444' : task?.status === 'cancelled' ? '#94a3b8' : '' }}>
                            {displayPct}%
                        </span>
                        <span className={styles.completeText}>
                            {task?.status === 'failed' ? dict.processing.statusFailed 
                             : task?.status === 'cancelled' ? dict.processing.statusCancelled 
                             : dict.processing.statusComplete}
                        </span>
                    </div>
                </div>
            </div>

            <div className={styles.terminalContainer}>
                <div className={styles.terminalHeader}>
                    <span>{dict.processing.logsTitle}</span>
                    <span className={styles.terminalDot} style={{ backgroundColor: task?.status === 'processing' ? '#22c55e' : '#64748b' }}></span>
                </div>
                <div className={styles.terminalLogs} id="logContainer">
                    {logs.map((log, i) => (
                        <div key={i} className={styles.logLine}>
                            <span className={styles.logTime}>[{log.time}]</span> {log.msg}
                        </div>
                    ))}
                    {task?.status === 'processing' && <div className={styles.logLine}><span className={styles.logBlink}>_</span></div>}
                </div>
            </div>

            <div className={styles.actionRow} style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                {task?.status === 'processing' && (
                    <button className={styles.stopBtn} onClick={handleCancel}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                        {dict.processing.cancelBtn}
                    </button>
                )}

                {task?.status === 'completed' && (
                    <button className={styles.downloadBtn} onClick={handleDownload} title={dict.processing.downloadBtn}>
                         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                )}
                
                {(task?.status === 'completed' || task?.status === 'failed' || task?.status === 'cancelled') && (
                    <button className={styles.stopBtn} onClick={onClose} style={{ color: '#64748b', borderColor: '#e2e8f0' }}>
                        {dict.processing.closeBtn}
                    </button>
                )}
            </div>

            {task?.error && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '1rem' }}>
                    {dict.common.error}: {task.error}
                </p>
            )}
        </div>
    );
};

export default ProcessingView;

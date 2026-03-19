"use client";

import React, { useState, useEffect } from 'react';
import styles from './ProcessingView.module.css';

interface ProcessingViewProps {
    taskId: string;
    onClose?: () => void;
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ taskId, onClose }) => {
    const [task, setTask] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Poll for task status
    useEffect(() => {
        if (!taskId) return;

        const fetchStatus = async () => {
            try {
                const res = await fetch(`http://localhost:3001/api/tasks/${taskId}`);
                const data = await res.json();
                if (data.task) {
                    setTask(data.task);
                    if (data.task.status === 'completed' || data.task.status === 'failed') {
                        clearInterval(interval);
                    }
                }
            } catch (err) {
                console.error('Polling error', err);
            }
        };

        const fetchLogs = async () => {
            try {
                const res = await fetch(`http://localhost:3001/api/tasks/${taskId}/logs`);
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
            const res = await fetch(`http://localhost:3001/api/tasks/${taskId}/download`);
            if (!res.ok) throw new Error('Download failed');
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            const filename = task?.title ? `${task.title.replace(/\s+/g, '_')}.docx` : 'meeting_minutes.docx';
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Download error:', err);
            alert('ไม่สามารถดาวน์โหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง');
        }
    };

    const handleCancel = async () => {
        if (!taskId) return;
        if (!confirm('Are you sure you want to stop this process?')) return;
        try {
            await fetch(`http://localhost:3001/api/tasks/${taskId}/cancel`, { method: 'POST' });
            onClose?.();
        } catch (err) {
            console.error('Cancel error', err);
            onClose?.();
        }
    };

    const displayPct = task?.progress ?? 0;
    const currentStepLabel = task?.status === 'failed' ? 'Error occurred' 
                           : task?.status === 'completed' ? 'Processing Complete!'
                           : task?.status === 'cancelled' ? 'Task Cancelled'
                           : task ? `Step: ${task.currentStep || 'Initializing'}` 
                           : 'Initializing...';

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
                        <span className={styles.completeText}>{task?.status === 'failed' ? 'FAILED' : task?.status === 'cancelled' ? 'CANCELLED' : 'COMPLETE'}</span>
                    </div>
                </div>
            </div>

            <div className={styles.terminalContainer}>
                <div className={styles.terminalHeader}>
                    <span>Real-time Pipeline Logs</span>
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
                        Cancel Process
                    </button>
                )}

                {task?.status === 'completed' && (
                    <button className={styles.downloadBtn} onClick={handleDownload}>
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Download DOCX
                    </button>
                )}
                
                {(task?.status === 'completed' || task?.status === 'failed' || task?.status === 'cancelled') && (
                    <button className={styles.stopBtn} onClick={onClose} style={{ color: '#64748b', borderColor: '#e2e8f0' }}>
                        Close
                    </button>
                )}
            </div>

            {task?.error && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '1rem' }}>
                    Error: {task.error}
                </p>
            )}
        </div>
    );
};

export default ProcessingView;

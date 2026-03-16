"use client";

import React, { useState, useEffect } from 'react';
import styles from './ProcessingView.module.css';

interface ProcessingViewProps {
    onClose?: () => void;
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ onClose }) => {
    const [progress, setProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [messageIndex, setMessageIndex] = useState(0);

    const messages = [
        "Uploading file...",
        "Wait a sec ...",
        "Wait a sec ...",
        "Wait a sec ...",
        "Analyzing audio content...",
        "Identifying key speakers...",
        "Transcribing meeting dialogue...",
        "Capturing action items...",
        "Synthesizing meeting summary...",
        "Polishing final results...",
        "Wait a sec ...",
        "Wait a sec ...",
        "Wait a sec ...",
        "Wait a sec ..."
    ];

    useEffect(() => {
        const duration = 55000; // 55 seconds
        const interval = 50; // Update every 50ms for smoother animation
        const steps = duration / interval;
        const increment = 100 / steps;

        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(timer);
                    setIsComplete(true);
                    return 100;
                }
                return prev + increment;
            });
        }, interval);

        // Cycle through messages based on progress
        const messageInterval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % messages.length);
        }, 5000); // Change message every 5 seconds

        return () => {
            clearInterval(timer);
            clearInterval(messageInterval);
        };
    }, []);

    const handleStop = () => {
        if (confirm("Are you sure you want to stop processing?")) {
            onClose?.();
        }
    };

    // Helper to format percentage from 0-100 to conic-gradient degrees (0-360)
    const progressDegrees = (progress / 100) * 360;

    if (isComplete) {
        return (
            <div className={styles.processingOverlay}>
                <div className={styles.resultCard}>
                    <div className={styles.iconSuccess}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <h2 className={styles.resultTitle}>Processing Complete</h2>
                    <p className={styles.resultDesc}>Your meeting summary and transcript are ready.</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', marginBottom: '2rem' }}>
                        {/* PDF File */}
                        <div className={styles.fileCard}>
                            <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '0.5rem', borderRadius: '8px' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className={styles.fileName}>20260313_TEST_weekly_working_11_tactiq.pdf</div>
                                <a 
                                    href="/20260313_TEST_weekly_working_11_tactiq.pdf"
                                    download="20260313_TEST_weekly_working_11_tactiq.pdf"
                                    style={{ fontSize: '0.75rem', color: '#6366f1', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    DOWNLOAD PDF
                                </a>
                            </div>
                        </div>

                        {/* DOCX File */}
                        <div className={styles.fileCard}>
                            <div style={{ backgroundColor: '#e0f2fe', color: '#0ea5e9', padding: '0.5rem', borderRadius: '8px' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18h.01"></path><path d="M10 12h4"></path><path d="M10 16h4"></path></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className={styles.fileName}>20260313_TEST_weekly_working.docx</div>
                                <a 
                                    href="/20260313_TEST_weekly_working.docx"
                                    download="20260313_TEST_weekly_working.docx"
                                    style={{ fontSize: '0.75rem', color: '#0ea5e9', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    DOWNLOAD DOCX
                                </a>
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        className={styles.downloadBtn}
                        onClick={onClose}
                    >
                        Done & Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.processingOverlay}>
            <div className={styles.outerCircle}></div>
            <div className={styles.innerCircleSmall}></div>
            
            <h1 className={styles.title} key={messageIndex}>{messages[messageIndex]}</h1>
            
            <div className={styles.progressContainer}>
                <div 
                    className={styles.circularProgress} 
                    style={{ '--progress': `${progressDegrees}deg` } as React.CSSProperties}
                >
                    <div className={styles.circularProgressInner}>
                        <span className={styles.percentage}>{Math.floor(progress)}%</span>
                        <span className={styles.completeText}>COMPLETE</span>
                    </div>
                </div>
            </div>

            <button className={styles.stopBtn} onClick={handleStop}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                Stop Processing
            </button>
        </div>
    );
};

export default ProcessingView;

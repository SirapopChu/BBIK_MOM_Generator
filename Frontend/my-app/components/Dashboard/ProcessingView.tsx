"use client";

import React, { useState, useEffect } from 'react';
import styles from './ProcessingView.module.css';

interface ProcessingViewProps {
    onClose?: () => void;
}

const STEPS = [
    { label: 'Reading transcript...', pct: 5 },
    { label: 'Sending to Claude AI...', pct: 15 },
    { label: 'Analyzing speakers & agenda...', pct: 35 },
    { label: 'Drafting meeting minutes...', pct: 55 },
    { label: 'Formatting bilingual content...', pct: 70 },
    { label: 'Building DOCX document...', pct: 85 },
    { label: 'Finalizing output...', pct: 95 },
];

const ProcessingView: React.FC<ProcessingViewProps> = ({ onClose }) => {
    const [stepIndex, setStepIndex] = useState(0);
    const [displayPct, setDisplayPct] = useState(0);

    // Cycle through steps to give visual feedback while the actual fetch runs
    useEffect(() => {
        if (stepIndex >= STEPS.length - 1) return;

        const delay = stepIndex === 0 ? 600 : stepIndex < 3 ? 4000 : 6000;
        const t = setTimeout(() => setStepIndex(i => i + 1), delay);
        return () => clearTimeout(t);
    }, [stepIndex]);

    // Smoothly animate the percentage toward target
    useEffect(() => {
        const target = STEPS[stepIndex]?.pct ?? 95;
        if (displayPct >= target) return;

        const t = setInterval(() => {
            setDisplayPct(prev => {
                const next = prev + 1;
                if (next >= target) { clearInterval(t); return target; }
                return next;
            });
        }, 30);
        return () => clearInterval(t);
    }, [stepIndex, displayPct]);

    const progressDeg = (displayPct / 100) * 360;

    return (
        <div className={styles.processingOverlay}>
            <div className={styles.outerCircle}></div>
            <div className={styles.innerCircleSmall}></div>

            <h1 className={styles.title} key={stepIndex}>{STEPS[stepIndex]?.label}</h1>

            <div className={styles.progressContainer}>
                <div
                    className={styles.circularProgress}
                    style={{ '--progress': `${progressDeg}deg` } as React.CSSProperties}
                >
                    <div className={styles.circularProgressInner}>
                        <span className={styles.percentage}>{displayPct}%</span>
                        <span className={styles.completeText}>COMPLETE</span>
                    </div>
                </div>
            </div>

            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '1rem' }}>
                Claude is analyzing your transcript — this may take up to a minute.
            </p>

            <button className={styles.stopBtn} onClick={() => {
                if (confirm('Are you sure you want to cancel?')) onClose?.();
            }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                Cancel
            </button>
        </div>
    );
};

export default ProcessingView;

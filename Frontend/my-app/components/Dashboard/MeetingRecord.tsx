"use client";

import React, { useState, useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';
import styles from './MeetingRecord.module.css';

const MeetingRecord = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [timer, setTimer] = useState(0);

    const waveContainerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const recordPluginRef = useRef<any>(null);

    useEffect(() => {
        if (!isRecording) return;
        // The container might not be immediately available if it's conditional,
        // but since wait for it:
        if (isRecording) {
            // Need a slight timeout to ensure ref is mounted
            setTimeout(() => {
                if (!waveContainerRef.current) return;
                
                const wavesurfer = WaveSurfer.create({
                    container: waveContainerRef.current,
                    waveColor: '#6366f1',
                    progressColor: '#818cf8',
                    height: 90,
                    barWidth: 3,
                    barGap: 3,
                    barRadius: 2,
                    interact: false,
                    cursorWidth: 0,
                });

                const record = wavesurfer.registerPlugin(
                    RecordPlugin.create({
                        renderRecordedAudio: false,
                        scrollingWaveform: true,
                        scrollingWaveformWindow: 10, // seconds
                    })
                );

                wavesurferRef.current = wavesurfer;
                recordPluginRef.current = record;

                record.startRecording().catch((err: any) => {
                    console.error('Error starting mic:', err);
                    if (err.message && err.message.includes('system')) {
                        alert("Microphone access is blocked by macOS. Please go to Mac System Settings -> Privacy & Security -> Microphone, and grant access to your browser.");
                    } else {
                        alert(`Microphone error: ${err.message || 'Permission denied'}. Please ensure permissions are granted.`);
                    }
                    setIsRecording(false);
                });
            }, 50);
        }

        return () => {
            if (recordPluginRef.current) {
                if (recordPluginRef.current.isRecording()) {
                    recordPluginRef.current.stopRecording();
                }
                recordPluginRef.current.stopMic();
            }
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
            }
        };
    }, [isRecording]);

    // Format timer to HH:MM:SS
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRecording) {
            interval = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        } else if (!isRecording && timer !== 0) {
            // Optional: reset or keep timer
        }
        return () => clearInterval(interval);
    }, [isRecording, timer]);

    const handleRecordToggle = () => {
        if (!isRecording) {
            setIsRecording(true);
        }
    };

    const handleStopRecording = () => {
        setIsRecording(false);
    };

    const RecordingView = () => (
        <div className={styles.recordingMode}>
            {/* Top Header for Recording */}
            <div className={styles.recordingTopBar}>
                <div className={styles.recordingTopLeft}>
                    <div className={styles.liveBadge}>
                        <span className={styles.liveDot}></span> LIVE RECORDING
                    </div>
                    <div className={styles.topDivider}></div>
                    <div className={styles.topTitle}>Market Expansion Strategy — Q3</div>
                </div>

            </div>

            <div className={styles.recordingMainContent}>
                <div className={styles.recordingMainGrid}>
                    {/* LEFT COLUMN */}
                    <div className={styles.recordingMainLeft}>
                        <div className={styles.timerCardPro}>
                            <div className={styles.timerProText}>{formatTime(timer || 882)}</div>
                            <div className={styles.timerProLabel}>ELAPSED TIME</div>

                            <div className={styles.waveBox} style={{ width: '100%', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} ref={waveContainerRef}>
                            </div>

                            <div className={styles.timerStats}>
                                <div className={styles.statGroup}>
                                    <div className={styles.statVal}>128</div>
                                    <div className={styles.statlbl}>AVG. BPM</div>
                                </div>
                                <div className={styles.statDivider}></div>
                                <div className={styles.statGroup}>
                                    <div className={styles.statVal}>4.2k</div>
                                    <div className={styles.statlbl}>WORDS</div>
                                </div>
                                <div className={styles.statDivider}></div>
                                <div className={styles.statGroup}>
                                    <div className={styles.statVal}>Low</div>
                                    <div className={styles.statlbl}>LATENCY</div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.liveTranscriptionPro}>
                            <div className={styles.transcriptionProHeader}>
                                <div className={styles.transcriptionProTitle}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                    LIVE AI TRANSCRIPTION
                                </div>
                                <div className={styles.confidenceBadgePro}>98.2% Confidence</div>
                            </div>

                            {/* Transcripts */}
                            <div className={styles.transcriptMsgPro}>
                                <div className={styles.speakerHeaderPro}>
                                    <div className={styles.speakerNamePro}>
                                        <div className={styles.speakerAvatarPro} style={{ backgroundImage: 'url("https://ui-avatars.com/api/?name=Sarah+Chen&background=bae6fd&color=0369a1")' }}></div>
                                        Dr. Sarah Chen
                                    </div>
                                    <div className={styles.timestampPro}>12:04</div>
                                </div>
                                <div className={styles.msgBubble}>
                                    Welcome everyone to the Q3 Strategy Session. Today we are focusing on the market expansion into Southeast Asia.
                                </div>
                            </div>

                            <div className={styles.transcriptMsgPro}>
                                <div className={styles.speakerHeaderPro}>
                                    <div className={styles.speakerNamePro}>
                                        <div className={styles.speakerAvatarPro} style={{ backgroundImage: 'url("https://ui-avatars.com/api/?name=Marcus+Miller&background=fed7aa&color=c2410c")' }}></div>
                                        Marcus Miller
                                    </div>
                                    <div className={styles.timestampPro}>12:15</div>
                                </div>
                                <div className={styles.msgBubble}>
                                    I have the PPTX ready with the demographic data. Should I present the Thai market analysis first?
                                </div>
                            </div>

                            <div className={styles.transcriptMsgPro}>
                                <div className={styles.speakerHeaderPro}>
                                    <div className={styles.speakerNamePro}>
                                        <div className={styles.speakerAvatarPro} style={{ backgroundImage: 'url("https://ui-avatars.com/api/?name=Sarah+Chen&background=bae6fd&color=0369a1")' }}></div>
                                        Dr. Sarah Chen
                                    </div>
                                    <div className={styles.timestampPro}>12:28</div>
                                </div>
                                <div className={styles.msgBubble}>
                                    Yes, please. Make sure to highlight the localized consumer trends we identified last week. <span className={styles.cursorBlink}></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className={styles.recordingMainRight}>
                        <div className={styles.healthPanelPro}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                AUDIO HEALTH
                            </div>

                            <div className={styles.healthLevel}>
                                <div className={styles.healthTitle}>
                                    <span>INPUT GAIN</span>
                                    <span>72%</span>
                                </div>
                                <div className={styles.healthBar}>
                                    {Array.from({ length: 20 }).map((_, i) => (
                                        <div key={i} className={`${styles.healthSegment} ${i < 14 ? styles.segmentGreen : i < 16 ? styles.segmentYellow : ''}`}></div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.healthLevel}>
                                <div className={styles.healthTitle}>
                                    <span>NOISE FLOOR</span>
                                    <span>14%</span>
                                </div>
                                <div className={styles.healthBar}>
                                    {Array.from({ length: 20 }).map((_, i) => (
                                        <div key={i} className={`${styles.healthSegment} ${i < 3 ? styles.segmentGreen : ''}`}></div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.healthInfoBox}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                <div>
                                    <div className={styles.healthInfoTitle}>Signal is Optimal</div>
                                    <div className={styles.healthInfoDesc}>Audio levels are within professional ranges. Speech clarity is high.</div>
                                </div>
                            </div>
                        </div>


                    </div>
                </div>
            </div>

            <div className={styles.recordingFooterPro}>
                <div className={styles.footerDevice}>
                    <div className={styles.deviceIconPro}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
                    </div>
                    <div className={styles.footerDeviceT}>
                        <div className={styles.footerDeviceL}>INPUT DEVICE</div>
                        <div className={styles.footerDeviceV}>MacBook Pro Mic (Internal)</div>
                    </div>
                </div>

                <div className={styles.footerControls}>
                    <button className={styles.btnPausePro}>
                        <div className={styles.pauseBars}></div>
                    </button>
                    <button className={styles.btnStopPro} onClick={handleStopRecording}>
                        <div className={styles.stopSquare}></div>
                    </button>
                    <span className={styles.stopLabelPro}>STOP</span>
                </div>

                <button className={styles.btnAiProcessingPro}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    Start AI Processing
                </button>
            </div>
        </div>
    );

    // If recording, render the full-screen view
    if (isRecording) {
        return <RecordingView />;
    }

    return (
        <div className={styles.container}>
            {/* Stepper */}
            <div className={styles.stepperContainer}>
                <div className={styles.step}>
                    <div className={`${styles.stepCircle} ${styles.activeStepCircle}`} style={{ backgroundColor: 'white', color: '#6366f1' }}>1</div>
                    <div className={styles.stepLabel}>SETUP</div>
                </div>
                <div className={styles.stepLine}></div>
                <div className={styles.step}>
                    <div className={`${styles.stepCircle} ${styles.activeStepCircle}`}>2</div>
                    <div className={`${styles.stepLabel} ${styles.activeStepLabel}`}>RECORD</div>
                </div>
                <div className={styles.stepLine}></div>
                <div className={styles.step}>
                    <div className={styles.stepCircle}>3</div>
                    <div className={styles.stepLabel}>PROCESS</div>
                </div>
                <div className={styles.stepLine}></div>
                <div className={styles.step}>
                    <div className={styles.stepCircle}>4</div>
                    <div className={styles.stepLabel}>REVIEW</div>
                </div>
                <div className={styles.stepLine}></div>
                <div className={styles.step}>
                    <div className={styles.stepCircle}>5</div>
                    <div className={styles.stepLabel}>EXPORT</div>
                </div>
            </div>

            <div className={styles.breadcrumbs}>
                PROJECTS &gt; DX-2024-06 &gt; DATA INGESTION
            </div>
            <h1 className={styles.title}>Meeting Media Capture</h1>

            <div className={styles.gridContainer}>
                {/* Left Column: Live Audio Recorder */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h2 className={styles.cardTitle}>Live Audio Recorder</h2>
                            <p className={styles.cardDesc}>Directly capture browser audio input</p>
                        </div>
                        <div className={styles.badge}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#64748b' }}></div>
                            Ready to Record
                        </div>
                    </div>

                    <div className={styles.recordingArea}>
                        <div className={styles.instructionText}>
                            <span className={styles.instructionDots}>•••</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                            Click below to start session
                            <span className={styles.instructionDots}>•••</span>
                        </div>

                        <div className={styles.timer}>00:00:00</div>
                        <div className={styles.timerLabel}>ELAPSED TIME</div>

                        <button className={styles.micButton} onClick={handleRecordToggle}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                        </button>
                    </div>

                    <div className={styles.recordInfo} style={{ justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        Recommended for quiet environments using high-quality external microphones.
                    </div>

                    <div className={styles.configSection}>
                        <h3 className={styles.configTitle}>SESSION CONFIGURATION</h3>

                        <div className={styles.configGrid}>
                            <div className={styles.configItem}>
                                <label>Primary Meeting Language</label>
                                <div className={styles.toggleGroup}>
                                    <button className={`${styles.toggleBtn} ${styles.toggleBtnActive}`}>Thai [TH]</button>
                                    <button className={styles.toggleBtn}>English [EN]</button>
                                </div>
                                <p className={styles.configItemDesc}>This helps AI models optimize speech-to-text accuracy.</p>
                            </div>
                            <div className={styles.configItem}>
                                <label>Noise Suppression</label>
                                <div className={styles.toggleGroup}>
                                    <button className={`${styles.toggleBtn} ${styles.toggleBtnActive}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                                        Enhanced Clarity Enabled
                                    </button>
                                </div>
                                <p className={styles.configItemDesc}>Filters background office noise during live recording.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Upload Audio File */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h2 className={styles.cardTitle}>Upload Audio File</h2>
                            <p className={styles.cardDesc}>If the meeting has already concluded</p>
                        </div>
                    </div>

                    <div style={{ height: '250px', marginTop: '2rem' }}>
                        <div className={styles.uploadArea}>
                            <div className={styles.uploadIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            </div>
                            <p className={styles.uploadText}>Click or drag to upload</p>
                            <p className={styles.uploadSubtext}>MP3, WAV, M4A up to 500MB</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MeetingRecord;

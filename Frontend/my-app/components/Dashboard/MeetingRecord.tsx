"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';
import styles from './MeetingRecord.module.css';
import ProcessingView from './ProcessingView';

const MeetingRecord = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [timer, setTimer] = useState(0);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [uploadedAudioFiles, setUploadedAudioFiles] = useState<{name: string, size: string}[]>([]);
    const [uploadedTranscribeFiles, setUploadedTranscribeFiles] = useState<{name: string, size: string}[]>([]);
    const audioFileInputRef = useRef<HTMLInputElement>(null);
    const transcribeFileInputRef = useRef<HTMLInputElement>(null);

    const waveContainerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const recordPluginRef = useRef<any>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Format timer to HH:MM:SS
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Unified cleanup function
    const cleanupWaveSurfer = useCallback(() => {
        if (recordPluginRef.current) {
            try {
                if (recordPluginRef.current.isRecording() || recordPluginRef.current.isPaused()) {
                    recordPluginRef.current.stopRecording();
                }
            } catch (err) {
                console.warn('Error stopping recording during cleanup:', err);
            }
            recordPluginRef.current = null;
        }

        if (wavesurferRef.current) {
            try {
                wavesurferRef.current.destroy();
            } catch (err) {
                console.warn('Error destroying WaveSurfer:', err);
            }
            wavesurferRef.current = null;
        }
    }, []);

    // Enumerate audio devices
    const enumerateDevices = useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.warn('Media devices not supported');
            return;
        }

        try {
            // Check if we have permission already by checking labels
            const preDevices = await navigator.mediaDevices.enumerateDevices();
            const hasLabels = preDevices.some(d => d.label);

            if (!hasLabels) {
                // Trigger permission prompt to get device labels
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    // Stop the stream immediately,เราแค่ต้องการให้ label มันโผล่
                    stream.getTracks().forEach(track => track.stop());
                } catch (e) {
                    console.log('Permission denied or dismissed');
                }
            }

            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = allDevices.filter(device => device.kind === 'audioinput');
            setDevices(audioInputs);
            
            if (audioInputs.length > 0 && !selectedDeviceId) {
                // Try to find a default device or just pick the first
                const defaultDevice = audioInputs.find(d => d.deviceId === 'default') || audioInputs[0];
                setSelectedDeviceId(defaultDevice.deviceId);
            }
        } catch (err) {
            console.error('Error enumerating devices:', err);
        }
    }, [selectedDeviceId]);

    useEffect(() => {
        enumerateDevices();
    }, [enumerateDevices]);

    // Initialize WaveSurfer after the recording UI is rendered
    const initWaveSurfer = useCallback(() => {
        if (!waveContainerRef.current) return;

        // Destroy any existing instance first
        cleanupWaveSurfer();

        try {
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
                    scrollingWaveformWindow: 10,
                })
            );

            wavesurferRef.current = wavesurfer;
            recordPluginRef.current = record;

            record.startRecording({ deviceId: selectedDeviceId }).catch((err: any) => {
                console.error('Error starting mic:', err);
                if (err.message && err.message.includes('system')) {
                    alert("Microphone access is blocked by macOS. Please go to System Settings → Privacy & Security → Microphone, and grant access to your browser.");
                } else {
                    alert(`Microphone error: ${err.message || 'Permission denied'}. Please ensure microphone permissions are granted.`);
                }
                setIsRecording(false);
                cleanupWaveSurfer(); // Clean up if start fails
            });
        } catch (err) {
            console.error('Failed to create WaveSurfer:', err);
            setIsRecording(false);
            cleanupWaveSurfer();
        }
    }, [cleanupWaveSurfer, selectedDeviceId]);

    // When isRecording becomes true, wait for DOM then init wavesurfer
    useEffect(() => {
        if (isRecording && !isPaused) {
            const timeout = setTimeout(() => {
                initWaveSurfer();
            }, 100); // wait for recording UI to be painted
            return () => clearTimeout(timeout);
        }
    }, [isRecording, initWaveSurfer]);

    // Timer logic - pause-aware
    useEffect(() => {
        if (isRecording && !isPaused) {
            timerIntervalRef.current = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        } else {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [isRecording, isPaused]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupWaveSurfer();
        };
    }, [cleanupWaveSurfer]);

    const handleRecordToggle = () => {
        setIsRecording(true);
        setIsPaused(false);
        setTimer(0);
    };

    const handlePauseResume = () => {
        if (!recordPluginRef.current) return;
        if (isPaused) {
            recordPluginRef.current.resumeRecording();
            setIsPaused(false);
        } else {
            recordPluginRef.current.pauseRecording();
            setIsPaused(true);
        }
    };

    const handleStopRecording = () => {
        cleanupWaveSurfer();
        setIsRecording(false);
        setIsPaused(false);
    };

    const handleAudioUploadClick = () => {
        audioFileInputRef.current?.click();
    };

    const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const newFiles = Array.from(files).map(file => ({
                name: file.name,
                size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
            }));
            setUploadedAudioFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeAudioFile = (index: number) => {
        setUploadedAudioFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleTranscribeUploadClick = () => {
        transcribeFileInputRef.current?.click();
    };

    const handleTranscribeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const newFiles = Array.from(files).map(file => ({
                name: file.name,
                size: (file.size / 1024).toFixed(2) + ' KB'
            }));
            setUploadedTranscribeFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeTranscribeFile = (index: number) => {
        setUploadedTranscribeFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <>
            {isProcessing && <ProcessingView onClose={() => setIsProcessing(false)} />}
            
            {/* ==== RECORDING MODE ==== */}
            {isRecording && (
                <div className={styles.recordingMode}>
                    {/* Top Header */}
                    <div className={styles.recordingTopBar}>
                        <div className={styles.recordingTopLeft}>
                            <div className={styles.liveBadge}>
                                <span className={styles.liveDot}></span>
                                {isPaused ? 'PAUSED' : 'LIVE RECORDING'}
                            </div>
                            <div className={styles.topDivider}></div>
                            <div className={styles.topTitle}>Recording Active</div>
                        </div>
                    </div>

                    <div className={styles.recordingMainContent} style={{ paddingBottom: '100px' }}>
                        <div className={styles.recordingMainGrid}>
                            {/* LEFT COLUMN */}
                            <div className={styles.recordingMainLeft}>
                                <div className={styles.timerCardPro}>
                                    <div className={styles.timerProText}>{formatTime(timer)}</div>
                                    <div className={styles.timerProLabel}>ELAPSED TIME</div>

                                    {/* WaveSurfer mounts here */}
                                    <div
                                        ref={waveContainerRef}
                                        className={styles.waveBox}
                                        style={{ width: '100%', height: '100px' }}
                                    />
                                </div>

                                <div className={styles.liveTranscriptionPro}>
                                    <div className={styles.transcriptionProHeader}>
                                        <div className={styles.transcriptionProTitle}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                            LIVE AI TRANSCRIPTION
                                        </div>
                                    </div>
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                        {isPaused
                                            ? 'Recording paused.'
                                            : <>Listening for speech... <span className={styles.cursorBlink}>_</span></>
                                        }
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

                    {/* Fixed Footer Controls */}
                    <div className={styles.recordingFooterPro}>
                        <div className={styles.footerDevice}>
                            <div className={styles.deviceIconPro}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
                            </div>
                            <div className={styles.footerDeviceT}>
                                <div className={styles.footerDeviceL}>INPUT DEVICE</div>
                                <select 
                                    className={styles.deviceSelect}
                                    value={selectedDeviceId}
                                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                                    disabled={isRecording}
                                >
                                    {devices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={styles.footerControls}>
                            <button className={styles.btnPausePro} onClick={handlePauseResume} title={isPaused ? 'Resume' : 'Pause'}>
                                {isPaused ? (
                                    // Play / Resume icon
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#818cf8" stroke="none"><polygon points="5,3 19,12 5,21" /></svg>
                                ) : (
                                    <div className={styles.pauseBars}></div>
                                )}
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
            )}

            {/* ==== SETUP MODE (shown when not recording) ==== */}
            {!isRecording && (
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

                        {/* Merged Upload Section */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h2 className={styles.cardTitle}>External Media & Transcripts</h2>
                                    <p className={styles.cardDesc}>Upload files for existing meetings</p>
                                </div>
                            </div>

                            {/* Audio Upload Section */}
                            <div style={{ marginTop: '1.5rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>AUDIO FILE (.MP3, .WAV, .M4A)</div>
                                <div className={styles.uploadArea} onClick={handleAudioUploadClick} style={{ cursor: 'pointer', height: '160px', padding: '1rem' }}>
                                    <input 
                                        type="file" 
                                        ref={audioFileInputRef} 
                                        hidden 
                                        multiple 
                                        accept=".mp3,.wav,.m4a" 
                                        onChange={handleAudioFileChange}
                                    />
                                    <div className={styles.uploadIcon} style={{ width: '36px', height: '36px', marginBottom: '0.5rem' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    </div>
                                    <p className={styles.uploadText}>Click or drag audio</p>
                                </div>

                                {uploadedAudioFiles.length > 0 && (
                                    <div className={styles.uploadedFilesList}>
                                        {uploadedAudioFiles.map((file, index) => (
                                            <div key={index} className={styles.uploadedFileItem}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                                                    <div>
                                                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{file.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{file.size}</div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => removeAudioFile(index)}
                                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Transcribe Upload Section */}
                            <div style={{ marginTop: '2rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>TRANSCRIPT FILE (.TXT, .MD)</div>
                                <div className={styles.uploadArea} onClick={handleTranscribeUploadClick} style={{ cursor: 'pointer', height: '160px', padding: '1rem' }}>
                                    <input 
                                        type="file" 
                                        ref={transcribeFileInputRef} 
                                        hidden 
                                        multiple 
                                        accept=".txt,.md" 
                                        onChange={handleTranscribeFileChange}
                                    />
                                    <div className={styles.uploadIcon} style={{ width: '36px', height: '36px', marginBottom: '0.5rem' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="12" y2="12"></line><line x1="15" y1="15" x2="12" y2="12"></line></svg>
                                    </div>
                                    <p className={styles.uploadText}>Click or drag transcript</p>
                                </div>

                                {uploadedTranscribeFiles.length > 0 && (
                                    <div className={styles.uploadedFilesList}>
                                        {uploadedTranscribeFiles.map((file, index) => (
                                            <div key={index} className={styles.uploadedFileItem}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                    <div>
                                                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{file.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{file.size}</div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => removeTranscribeFile(index)}
                                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Continue Button inside Card */}
                            <div className={styles.proceedActions} style={{ marginTop: '2.5rem', marginBottom: '0.5rem' }}>
                                <button 
                                    className={styles.proceedBtn} 
                                    style={{ width: '100%', justifyContent: 'center', padding: '0.875rem 2rem' }}
                                    onClick={() => setIsProcessing(true)}
                                >
                                    Continue to Process
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MeetingRecord;

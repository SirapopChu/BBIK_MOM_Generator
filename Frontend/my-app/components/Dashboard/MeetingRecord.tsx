import React, { useState, useRef, useEffect } from 'react';
import styles from './MeetingRecord.module.css';
import ProcessingView from './ProcessingView';

// Production Service & Hooks
import * as api from '../../services/api';
import { useAudioRecorder, formatTime } from '../../hooks/useAudioRecorder';
import { useCompressedUpload } from '../../hooks/useCompressedUpload';
import { useTranscription } from '../../hooks/useTranscription';

import { useI18n } from '../../contexts/LanguageContext';

/**
 * MeetingRecord Component (Refactored)
 * 
 * - Orchestrates recording, processing, and exporting.
 * - Delegates low-level media & processing to custom hooks.
 * - Uses the api facade for backend communication.
 */
const MeetingRecord = () => {
    const { dict } = useI18n();
    // ── Local State ──────────────────────────────────────────────────────────
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeTaskId,  setActiveTaskId]  = useState<string | null>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [recordingName, setRecordingName] = useState(`Meeting_${new Date().toISOString().slice(0, 10)}_${new Date().getHours()}${new Date().getMinutes()}`);
    const [systemAudioMode, setSystemAudioMode] = useState(false);
    
    // File uploads (outside recording flow)
    const [uploadedAudioFiles,      setUploadedAudioFiles]      = useState<File[]>([]);
    const [uploadedTranscribeFiles, setUploadedTranscribeFiles] = useState<File[]>([]);
    
    const audioFileInputRef      = useRef<HTMLInputElement>(null);
    const transcribeFileInputRef = useRef<HTMLInputElement>(null);

    // ── Production Hooks ─────────────────────────────────────────────────────
    const recorder = useAudioRecorder();
    const { compressAudioFile, compressionProgress } = useCompressedUpload();
    const transcript = useTranscription();

    // Side-effect: Open save modal when recording completes & auto-download
    useEffect(() => {
        if (recorder.recordedBlob) {
            setShowSaveModal(true);

            // Auto-download after 3 seconds
            const timeoutId = setTimeout(() => {
                if (!recorder.recordedBlob) return;
                const url = URL.createObjectURL(recorder.recordedBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${recordingName}.mp3`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 3000);

            return () => clearTimeout(timeoutId);
        }
    }, [recorder.recordedBlob, recordingName]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleRecordToggle = () => recorder.startRecording(systemAudioMode);
    const handlePauseResume  = () => recorder.pauseResume();
    const handleStopRecording = () => recorder.stopRecording();

    const handleCloseSaveModal = () => {
        setShowSaveModal(false);
        recorder.resetRecording();
        transcript.reset();
    };

    const handleDownloadMP3 = () => {
        if (!recorder.recordedBlob) return;
        const url = URL.createObjectURL(recorder.recordedBlob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `${recordingName}.mp3`;
        a.click();
        URL.revokeObjectURL(url);
        handleCloseSaveModal();
    };

    /** Unified audio pipeline trigger (Recordings + Uploads) */
    const runProcessingPipeline = async (blob: Blob, name: string) => {
        setShowSaveModal(false);
        setIsProcessing(true);
        setActiveTaskId(null);

        try {
            // Compress if over 22MB (OpenAI limit is 25MB)
            let targetBlob = blob;
            if (blob.size > 22 * 1024 * 1024) {
                targetBlob = await compressAudioFile(blob, name);
            }

            const metadata = localStorage.getItem('meeting_metadata');
            const appModel = localStorage.getItem('app_llm_model');
            const appLang  = localStorage.getItem('app_language');

            const result = await api.processAudio(
                targetBlob, 
                `${name}.mp3`, 
                appLang || 'th', 
                metadata,
                appModel || null
            );
            
            if (result.taskId) setActiveTaskId(result.taskId);
        } catch (err: any) {
            alert(`Pipeline failed: ${err.message}`);
            setIsProcessing(false);
        } finally {
            // No explicit cleanup here; the hook handles it
        }
    };

    const handleProcessRecordedAudio = () => {
        if (recorder.recordedBlob) {
            runProcessingPipeline(recorder.recordedBlob, recordingName);
        }
    };

    const handleTranscribeUploadedAudio = (file: File) => {
        runProcessingPipeline(file, file.name.split('.')[0]);
    };

    // ── Simple Transcribe (Preview only) ────────────────────────────────────
    const handleTranscribe = async () => {
        if (recorder.recordedBlob) {
            await transcript.transcribe(recorder.recordedBlob, recordingName);
        }
    };

    const handleDownloadTranscript = () => {
        if (!transcript.transcriptResult) return;
        const blob = new Blob([transcript.transcriptResult.text], { type: 'text/plain;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${recordingName}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Document Export from File ────────────────────────────────────────────
    const handleGenerateDocx = async () => {
        if (uploadedTranscribeFiles.length === 0) return;
        const file = uploadedTranscribeFiles[0];
        setIsProcessing(true);

        try {
            const text     = await file.text();
            const metadata = localStorage.getItem('meeting_metadata');
            const docBlob  = await api.exportDocx(text, file.name, metadata);
            
            const url = URL.createObjectURL(docBlob);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = `${file.name.split('.')[0]}_minutes.docx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            alert(`Export failed: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Simple Transcribe (Preview only) ────────────────────────────────────
    const handleAudioUploadClick      = (e: React.MouseEvent) => {
        audioFileInputRef.current?.click();
    };
    const handleTranscribeUploadClick = (e: React.MouseEvent) => {
        transcribeFileInputRef.current?.click();
    };

    const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            setUploadedAudioFiles(prev => [...prev, ...filesArray]);
        }
        e.target.value = '';
    };

    const handleTranscribeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            setUploadedTranscribeFiles(prev => [...prev, ...filesArray]);
        }
        e.target.value = ''; 
    };

    const removeAudioFile      = (index: number) => setUploadedAudioFiles(prev => prev.filter((_, i) => i !== index));
    const removeTranscribeFile = (index: number) => setUploadedTranscribeFiles(prev => prev.filter((_, i) => i !== index));

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add(styles.uploadAreaActive); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.remove(styles.uploadAreaActive); };

    const handleAudioDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.remove(styles.uploadAreaActive);
        if (e.dataTransfer.files) {
            const files = Array.from(e.dataTransfer.files).filter(f => /\.(mp3|wav|m4a)$/i.test(f.name));
            setUploadedAudioFiles(prev => [...prev, ...files]);
        }
    };

    const handleTranscribeDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.remove(styles.uploadAreaActive);
        if (e.dataTransfer.files) {
            const files = Array.from(e.dataTransfer.files).filter(f => /\.(txt|md|docx)$/i.test(f.name));
            setUploadedTranscribeFiles(prev => [...prev, ...files]);
        }
    };

    return (
        <>
            {isProcessing && (
                <ProcessingView
                    taskId={activeTaskId || ''}
                    localProgressMsg={compressionProgress || ''}
                    onClose={() => {
                        setIsProcessing(false);
                        setActiveTaskId(null);
                    }}
                />
            )}

            {/* ==== RECORDING MODE ==== */}
            {recorder.isRecording && (
                <div className={styles.recordingMode}>
                    <div className={styles.recordingTopBar}>
                        <div className={styles.recordingTopLeft}>
                            <div className={styles.liveBadge}>
                                <span className={styles.liveDot}></span>
                                {recorder.isPaused ? dict.record.statusPaused : dict.record.statusLive}
                            </div>
                            {recorder.isSystemAudioActive && !recorder.isPaused && (
                                <>
                                    <div className={styles.topDivider}></div>
                                    <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, fontSize: '0.875rem' }}>
                                        <span className={styles.liveDot} style={{ backgroundColor: '#ef4444' }}></span>
                                        Recording System Audio...
                                    </div>
                                </>
                            )}
                            <div className={styles.topDivider}></div>
                            <div className={styles.topTitle}>{dict.record.activeTitle}</div>
                        </div>
                    </div>

                    <div className={styles.recordingMainContent} style={{ paddingBottom: '100px' }}>
                        <div className={styles.recordingMainGrid}>
                            <div className={styles.recordingMainLeft}>
                                <div className={styles.timerCardPro}>
                                    <div className={styles.timerProText}>{formatTime(recorder.timer)}</div>
                                    <div className={styles.timerProLabel}>{dict.record.elapsedTime}</div>

                                    <div
                                        ref={recorder.waveContainerRef}
                                        className={styles.waveBox}
                                        style={{ width: '100%', height: '100px' }}
                                    />
                                </div>

                                <div className={styles.liveTranscriptionPro}>
                                    <div className={styles.transcriptionProHeader}>
                                        <div className={styles.transcriptionProTitle}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                            {dict.record.aiTranscription}
                                        </div>
                                    </div>
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                        {recorder.isPaused
                                            ? dict.record.statusPaused
                                            : <>{dict.record.listening} <span className={styles.cursorBlink}>_</span></>
                                        }
                                    </div>
                                </div>
                            </div>

                            <div className={styles.recordingMainRight}>
                                <div className={styles.healthPanelPro}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        {dict.record.audioHealth}
                                    </div>

                                    <div className={styles.healthLevel}>
                                        <div className={styles.healthTitle}>
                                            <span>{dict.record.inputGain}</span>
                                            <span>{Math.round(Math.min(100, (recorder.volume / 128) * 100))}%</span>
                                        </div>
                                        <div className={styles.healthBar}>
                                            {Array.from({ length: 20 }).map((_, i) => {
                                                const level = (recorder.volume / 128) * 20;
                                                const isActive = i < level;
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`${styles.healthSegment} ${isActive ? (i < 14 ? styles.segmentGreen : i < 16 ? styles.segmentYellow : styles.segmentRed) : ''}`}
                                                    ></div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className={styles.healthLevel}>
                                        <div className={styles.healthTitle}>
                                            <span>{dict.record.noiseFloor}</span>
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
                                            <div className={styles.healthInfoTitle}>{dict.record.signalOptimal}</div>
                                            <div className={styles.healthInfoDesc}>{dict.record.signalDesc}</div>
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
                                <div className={styles.footerDeviceL}>{dict.record.inputDevice}</div>
                                <select
                                    className={styles.deviceSelect}
                                    value={recorder.selectedDeviceId}
                                    onChange={(e) => recorder.setSelectedDeviceId(e.target.value)}
                                    title="You can change the microphone during the recording."
                                >
                                    {recorder.devices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={styles.footerControls}>
                            <button
                                style={{
                                    background: recorder.isMicMuted ? '#fee2e2' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '12px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: recorder.isMicMuted ? '#ef4444' : '#64748b'
                                }}
                                onClick={recorder.toggleMicMute}
                                title={recorder.isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
                            >
                                {recorder.isMicMuted ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                )}
                            </button>
                            <button className={styles.btnPausePro} onClick={handlePauseResume} title={recorder.isPaused ? dict.record.resume : dict.record.pause}>
                                {recorder.isPaused ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#818cf8" stroke="none"><polygon points="5,3 19,12 5,21" /></svg>
                                ) : (
                                    <div className={styles.pauseBars}></div>
                                )}
                            </button>
                            <button className={styles.btnStopPro} onClick={handleStopRecording}>
                                <div className={styles.stopSquare}></div>
                            </button>
                            <span className={styles.stopLabelPro}>{dict.record.stop}</span>
                        </div>

                        <button className={styles.btnAiProcessingPro} onClick={handleStopRecording}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                            {dict.record.processBtn}
                        </button>
                    </div>
                </div>
            )}

            {/* ==== SETUP MODE ==== */}
            {!recorder.isRecording && (
                <div className={styles.container}>
                    <div className={styles.stepperContainer}>
                        <div className={styles.step}>
                            <div className={`${styles.stepCircle} ${styles.activeStepCircle}`} style={{ backgroundColor: 'white', color: '#6366f1' }}>1</div>
                            <div className={styles.stepLabel}>{dict.setup.stepSetup}</div>
                        </div>
                        <div className={styles.stepLine}></div>
                        <div className={styles.step}>
                            <div className={`${styles.stepCircle} ${styles.activeStepCircle}`}>2</div>
                            <div className={`${styles.stepLabel} ${styles.activeStepLabel}`}>{dict.record.start.toUpperCase()}</div>
                        </div>
                        <div className={styles.stepLine}></div>
                        <div className={styles.step}>
                            <div className={styles.stepCircle}>3</div>
                            <div className={styles.stepLabel}>{dict.record.processBtn.split(' ')[0].toUpperCase()}</div>
                        </div>
                        <div className={styles.stepLine}></div>
                        <div className={styles.step}>
                            <div className={styles.stepCircle}>4</div>
                            <div className={styles.stepLabel}>{dict.common.reviewEdit.split(' ')[0].toUpperCase()}</div>
                        </div>
                        <div className={styles.stepLine}></div>
                        <div className={styles.step}>
                            <div className={styles.stepCircle}>5</div>
                            <div className={styles.stepLabel}>{dict.common.exportMinutes.split(' ')[0].toUpperCase()}</div>
                        </div>
                    </div>

                    <div className={styles.breadcrumbs}>
                        PROJECTS &gt; MOM GENERATOR &gt; ACTIVE SESSION
                    </div>
                    <h1 className={styles.title}>{dict.record.title}</h1>

                    <div className={styles.gridContainer}>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h2 className={styles.cardTitle}>{dict.record.title}</h2>
                                    <p className={styles.cardDesc}>Directly capture browser audio input</p>
                                </div>
                                <div className={styles.badge}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#64748b' }}></div>
                                    Ready
                                </div>
                            </div>

                            <div className={styles.recordingArea}>
                                <div className={styles.instructionText}>
                                    <span className={styles.instructionDots}>•••</span>
                                    Select mode and click below to start session
                                    <span className={styles.instructionDots}>•••</span>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px', marginTop: '10px' }}>
                                    <button 
                                        onClick={() => setSystemAudioMode(false)}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '6px',
                                            border: !systemAudioMode ? '2px solid #6366f1' : '1px solid #cbd5e1',
                                            background: !systemAudioMode ? '#eef2ff' : 'white',
                                            color: !systemAudioMode ? '#4338ca' : '#64748b',
                                            fontWeight: !systemAudioMode ? 600 : 400,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Record Mic Only
                                    </button>
                                    <button 
                                        onClick={() => setSystemAudioMode(true)}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '6px',
                                            border: systemAudioMode ? '2px solid #6366f1' : '1px solid #cbd5e1',
                                            background: systemAudioMode ? '#eef2ff' : 'white',
                                            color: systemAudioMode ? '#4338ca' : '#64748b',
                                            fontWeight: systemAudioMode ? 600 : 400,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Record Mic + System Audio
                                    </button>
                                </div>

                                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>MICROPHONE INPUT</div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button 
                                            onClick={recorder.toggleMicMute}
                                            style={{
                                                padding: '8px',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                background: recorder.isMicMuted ? '#fee2e2' : '#f8fafc',
                                                color: recorder.isMicMuted ? '#ef4444' : '#64748b',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s'
                                            }}
                                            title={recorder.isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
                                        >
                                            {recorder.isMicMuted ? (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                            ) : (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                            )}
                                        </button>
                                        <select
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                background: '#f8fafc',
                                                color: '#334155',
                                                fontSize: '14px',
                                                outline: 'none',
                                                width: '240px',
                                                cursor: 'pointer'
                                            }}
                                            value={recorder.selectedDeviceId}
                                            onChange={(e) => recorder.setSelectedDeviceId(e.target.value)}
                                        >
                                            {recorder.devices.map(device => (
                                                <option key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className={styles.timer}>00:00:00</div>
                                <div className={styles.timerLabel}>{dict.record.elapsedTime}</div>

                                <button className={styles.micButton} onClick={handleRecordToggle}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
                                </button>
                            </div>

                            <div style={{ marginTop: '1.5rem' }}>
                                <div className={styles.configTitle}>AUDIO FILE (.MP3, .WAV, .M4A)</div>
                                <input 
                                    type="file" 
                                    ref={audioFileInputRef} 
                                    style={{ display: 'none' }} 
                                    multiple 
                                    accept=".mp3,.wav,.m4a" 
                                    onChange={handleAudioFileChange} 
                                />
                                <div
                                    className={styles.uploadArea}
                                    onClick={handleAudioUploadClick}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleAudioDrop}
                                >
                                    {uploadedAudioFiles.length === 0 ? (
                                        <>
                                            <div className={styles.uploadIcon}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                            </div>
                                            <div className={styles.uploadText}>Drop audio or click to browse</div>
                                            <div className={styles.uploadSubtext}>Supports MP3, WAV, M4A up to 25MB</div>
                                        </>
                                    ) : (
                                        <div className={styles.uploadAreaFiles}>
                                            {uploadedAudioFiles.map((file, idx) => (
                                                <div key={idx} className={styles.uploadedFileRow} onClick={(e) => e.stopPropagation()}>
                                                    <div className={styles.uploadedFileInfo}>
                                                        <span className={styles.uploadedFileName}>{file.name}</span>
                                                        <span className={styles.uploadedFileSize}>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                    </div>
                                                    <div className={styles.uploadedFileActions}>
                                                        <button 
                                                            className={styles.transcribeFileBtn} 
                                                            onClick={(e) => { e.stopPropagation(); handleTranscribeUploadedAudio(file); }}
                                                            title="Process"
                                                        >
                                                            {dict.record.processBtn.split(' ')[0]}
                                                        </button>
                                                        <button 
                                                            className={styles.removeFileBtn} 
                                                            onClick={(e) => { e.stopPropagation(); removeAudioFile(idx); }}
                                                            title="Remove"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className={styles.uploadSubtext} style={{ marginTop: '0.5rem' }}>Click gaps to add more files</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ marginTop: '2rem' }}>
                                <div className={styles.configTitle}>TRANSCRIPT FILE (.TXT, .MD, .DOCX)</div>
                                <input 
                                    type="file" 
                                    ref={transcribeFileInputRef} 
                                    style={{ display: 'none' }} 
                                    multiple 
                                    accept=".txt,.md,.docx" 
                                    onChange={handleTranscribeFileChange} 
                                />
                                <div
                                    className={styles.uploadArea}
                                    onClick={handleTranscribeUploadClick}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleTranscribeDrop}
                                >
                                    {uploadedTranscribeFiles.length === 0 ? (
                                        <>
                                            <div className={styles.uploadIcon}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                            </div>
                                            <div className={styles.uploadText}>Drop transcript or click to browse</div>
                                        </>
                                    ) : (
                                        <div className={styles.uploadAreaFiles}>
                                            {uploadedTranscribeFiles.map((file, idx) => (
                                                <div key={idx} className={styles.uploadedFileRow} onClick={(e) => e.stopPropagation()}>
                                                    <div className={styles.uploadedFileInfo}>
                                                        <span className={styles.uploadedFileName}>{file.name}</span>
                                                    </div>
                                                    <div className={styles.uploadedFileActions}>
                                                        <button 
                                                            className={styles.removeFileBtn} 
                                                            onClick={(e) => { e.stopPropagation(); removeTranscribeFile(idx); }}
                                                            title="Remove"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className={styles.uploadSubtext} style={{ marginTop: '0.5rem' }}>Click gaps to add more files</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.proceedActions}>
                                <button
                                    className={styles.proceedBtn}
                                    onClick={handleGenerateDocx}
                                    disabled={uploadedTranscribeFiles.length === 0}
                                    style={{ width: '100%', marginTop: '20px' }}
                                >
                                    {dict.common.exportMinutes}
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ==== SAVE MODAL ==== */}
            {showSaveModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.6)', padding: '16px', backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>{dict.record.saveTitle || 'Save Recording'}</h2>
                            <button onClick={handleCloseSaveModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '24px', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '8px', transition: 'background 0.2s' }}>×</button>
                        </div>

                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#eff6ff', padding: '16px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                                <div style={{ color: '#3b82f6', display: 'flex', padding: '10px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {formatTime(recorder.timer)} {dict.record.duration || 'Recorded Audio'}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                                        File Size: {recorder.recordedBlob ? (recorder.recordedBlob.size / (1024 * 1024)).toFixed(2) : 0} MB
                                    </div>
                                </div>
                                {transcript.transcriptResult && (
                                    <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.02em' }}>Transcribed</div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '14px', fontWeight: 700, color: '#334155', letterSpacing: '0.01em' }}>{dict.record.fileName || 'File Name'}</label>
                                <input
                                    type="text"
                                    style={{ padding: '14px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', color: '#0f172a', outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.2s', fontWeight: 500 }}
                                    value={recordingName}
                                    onChange={(e) => setRecordingName(e.target.value)}
                                    placeholder="Enter file name..."
                                />
                            </div>

                            {/* Status Messages */}
                            {compressionProgress && <div style={{ color: '#2563eb', fontSize: '13px', fontWeight: 600, backgroundColor: '#dbeafe', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #3b82f6', letterSpacing: '0.01em' }}>{compressionProgress}</div>}
                            {transcript.transcriptError && <div style={{ color: '#dc2626', fontSize: '13px', fontWeight: 600, backgroundColor: '#fee2e2', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #ef4444', letterSpacing: '0.01em' }}>{transcript.transcriptError}</div>}
                            
                            {/* Transcript Preview */}
                            {transcript.transcriptResult && (
                                <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                    <div style={{ backgroundColor: '#f8fafc', padding: '14px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Transcript Preview</span>
                                        <button onClick={handleDownloadTranscript} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', color: '#475569', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>Download .txt</button>
                                    </div>
                                    <div style={{ padding: '16px', fontSize: '14px', color: '#334155', maxHeight: '180px', overflowY: 'auto', lineHeight: '1.6', backgroundColor: '#ffffff', whiteSpace: 'pre-wrap' }}>
                                        {transcript.transcriptResult.text}
                                    </div>
                                </div>
                            )}

                            {/* Actions / Buttons */}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button style={{ flex: 1, padding: '14px', background: 'white', border: '2px solid #e2e8f0', borderRadius: '10px', color: '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onClick={handleCloseSaveModal}>
                                    {dict.record.discard || 'Discard'}
                                </button>
                                
                                {!transcript.transcriptResult && !transcript.isTranscribing && (
                                    <button style={{ flex: 1, padding: '14px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '10px', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onClick={handleTranscribe}>
                                        {dict.record.previewTranscript || 'Preview'}
                                    </button>
                                )}

                                <button style={{ flex: 1.5, padding: '14px', background: '#4f46e5', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1, transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }} onClick={handleProcessRecordedAudio} disabled={isProcessing}>
                                    {isProcessing ? dict.common.loading || 'Loading...' : dict.record.processGen || 'Generate MOM'}
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

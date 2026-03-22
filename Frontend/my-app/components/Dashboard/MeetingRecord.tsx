import React, { useState, useRef, useEffect } from 'react';
import styles from './MeetingRecord.module.css';
import ProcessingView from './ProcessingView';

// Production Service & Hooks
import * as api from '../../services/api';
import { useAudioRecorder, formatTime } from '../../hooks/useAudioRecorder';
import { useCompressedUpload } from '../../hooks/useCompressedUpload';
import { useTranscription } from '../../hooks/useTranscription';

/**
 * MeetingRecord Component (Refactored)
 * 
 * - Orchestrates recording, processing, and exporting.
 * - Delegates low-level media & processing to custom hooks.
 * - Uses the api facade for backend communication.
 */
const MeetingRecord = () => {
    // ── Local State ──────────────────────────────────────────────────────────
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeTaskId,  setActiveTaskId]  = useState<string | null>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [recordingName, setRecordingName] = useState(`Meeting_${new Date().toISOString().slice(0, 10)}_${new Date().getHours()}${new Date().getMinutes()}`);
    
    // File uploads (outside recording flow)
    const [uploadedAudioFiles,      setUploadedAudioFiles]      = useState<File[]>([]);
    const [uploadedTranscribeFiles, setUploadedTranscribeFiles] = useState<File[]>([]);
    
    const audioFileInputRef      = useRef<HTMLInputElement>(null);
    const transcribeFileInputRef = useRef<HTMLInputElement>(null);

    // ── Production Hooks ─────────────────────────────────────────────────────
    const recorder = useAudioRecorder();
    const { compressAudioFile, compressionProgress } = useCompressedUpload();
    const transcript = useTranscription();

    // Side-effect: Open save modal when recording completes
    useEffect(() => {
        if (recorder.recordedBlob) setShowSaveModal(true);
    }, [recorder.recordedBlob]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleRecordToggle = () => recorder.startRecording();
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
            const result   = await api.processAudio(targetBlob, `${name}.mp3`, 'th', metadata);
            
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

    // ── UI Helpers ───────────────────────────────────────────────────────────
    const handleAudioUploadClick      = () => audioFileInputRef.current?.click();
    const handleTranscribeUploadClick = () => transcribeFileInputRef.current?.click();

    const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setUploadedAudioFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    };

    const handleTranscribeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setUploadedTranscribeFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        e.target.value = ''; 
    };

    const removeAudioFile      = (index: number) => setUploadedAudioFiles(prev => prev.filter((_, i) => i !== index));
    const removeTranscribeFile = (index: number) => setUploadedTranscribeFiles(prev => prev.filter((_, i) => i !== index));

    const clearTranscribeFiles = (e: React.MouseEvent) => {
        e.stopPropagation();
        setUploadedTranscribeFiles([]);
    };

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
                                {recorder.isPaused ? 'PAUSED' : 'LIVE RECORDING'}
                            </div>
                            <div className={styles.topDivider}></div>
                            <div className={styles.topTitle}>Recording Active</div>
                        </div>
                    </div>

                    <div className={styles.recordingMainContent} style={{ paddingBottom: '100px' }}>
                        <div className={styles.recordingMainGrid}>
                            <div className={styles.recordingMainLeft}>
                                <div className={styles.timerCardPro}>
                                    <div className={styles.timerProText}>{formatTime(recorder.timer)}</div>
                                    <div className={styles.timerProLabel}>ELAPSED TIME</div>

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
                                            LIVE AI TRANSCRIPTION
                                        </div>
                                    </div>
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                        {recorder.isPaused
                                            ? 'Recording paused.'
                                            : <>Listening for speech... <span className={styles.cursorBlink}>_</span></>
                                        }
                                    </div>
                                </div>
                            </div>

                            <div className={styles.recordingMainRight}>
                                <div className={styles.healthPanelPro}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        AUDIO HEALTH
                                    </div>

                                    <div className={styles.healthLevel}>
                                        <div className={styles.healthTitle}>
                                            <span>INPUT GAIN</span>
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
                                <select
                                    className={styles.deviceSelect}
                                    value={recorder.selectedDeviceId}
                                    onChange={(e) => recorder.setSelectedDeviceId(e.target.value)}
                                    disabled={recorder.isRecording}
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
                            <button className={styles.btnPausePro} onClick={handlePauseResume} title={recorder.isPaused ? 'Resume' : 'Pause'}>
                                {recorder.isPaused ? (
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

                        <button className={styles.btnAiProcessingPro} onClick={handleStopRecording}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                            Finish & Process
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
                        PROJECTS &gt; MOM GENERATOR &gt; ACTIVE SESSION
                    </div>
                    <h1 className={styles.title}>Meeting Media Capture</h1>

                    <div className={styles.gridContainer}>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h2 className={styles.cardTitle}>Live Audio Recorder</h2>
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
                                    Click below to start session
                                    <span className={styles.instructionDots}>•••</span>
                                </div>

                                <div className={styles.timer}>00:00:00</div>
                                <div className={styles.timerLabel}>ELAPSED TIME</div>

                                <button className={styles.micButton} onClick={handleRecordToggle}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
                                </button>
                            </div>
                        </div>

                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h2 className={styles.cardTitle}>External Media & Transcripts</h2>
                                    <p className={styles.cardDesc}>Upload existing files</p>
                                </div>
                            </div>

                            <div style={{ marginTop: '1.5rem' }}>
                                <div className={styles.configTitle}>AUDIO FILE (.MP3, .WAV, .M4A)</div>
                                <div
                                    className={styles.uploadArea}
                                    onClick={handleAudioUploadClick}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleAudioDrop}
                                >
                                    <input type="file" ref={audioFileInputRef} hidden multiple accept=".mp3,.wav,.m4a" onChange={handleAudioFileChange} />
                                    <div className={styles.uploadIcon}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    </div>
                                    <div className={styles.uploadAreaFiles}>
                                        {uploadedAudioFiles.length > 0 ? (
                                            uploadedAudioFiles.map((file, idx) => (
                                                <div key={idx} className={styles.uploadedFileRow}>
                                                    <span className={styles.uploadedFileName}>{file.name}</span>
                                                    <div className={styles.uploadedFileActions}>
                                                        <button className={styles.transcribeFileBtn} onClick={(e) => { e.stopPropagation(); handleTranscribeUploadedAudio(file); }}>
                                                            Process
                                                        </button>
                                                        <button className={styles.removeFileBtn} onClick={(e) => { e.stopPropagation(); removeAudioFile(idx); }}>×</button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : 'Click or drag audio'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '2rem' }}>
                                <div className={styles.configTitle}>TRANSCRIPT FILE (.TXT, .MD, .DOCX)</div>
                                <div
                                    className={styles.uploadArea}
                                    onClick={handleTranscribeUploadClick}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleTranscribeDrop}
                                >
                                    <input type="file" ref={transcribeFileInputRef} hidden multiple accept=".txt,.md,.docx" onChange={handleTranscribeFileChange} />
                                    <div className={styles.uploadIcon}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                    </div>
                                    <p className={styles.uploadText}>
                                        {uploadedTranscribeFiles.length > 0 ? uploadedTranscribeFiles.map(f => f.name).join(', ') : 'Click or drag transcript'}
                                    </p>
                                </div>
                            </div>

                            <div className={styles.proceedActions}>
                                <button
                                    className={styles.proceedBtn}
                                    onClick={handleGenerateDocx}
                                    disabled={uploadedTranscribeFiles.length === 0}
                                    style={{ width: '100%', marginTop: '20px' }}
                                >
                                    Generate Minutes from Transcript
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ==== SAVE MODAL ==== */}
            {showSaveModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.saveModal}>
                        <div className={styles.saveModalHeader}>
                            <h2 className={styles.saveModalTitle}>Recording Complete</h2>
                            <button className={styles.closeModalBtn} onClick={handleCloseSaveModal}>×</button>
                        </div>

                        <div className={styles.saveModalContent}>
                            <div className={styles.savePreview}>
                                <div className={styles.previewIcon}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                                </div>
                                <div className={styles.previewDetails}>
                                    <div className={styles.previewName}>{formatTime(recorder.timer)} Duration</div>
                                    <div className={styles.previewSize}>{(recorder.recordedBlob!.size / (1024 * 1024)).toFixed(2)} MB</div>
                                    {transcript.transcriptResult && (
                                        <div className={styles.transcriptBadge}>Transcribed</div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>File Name</label>
                                <input
                                    type="text"
                                    className={styles.fileNameInput}
                                    value={recordingName}
                                    onChange={(e) => setRecordingName(e.target.value)}
                                />
                            </div>

                            {transcript.transcriptResult && (
                                <div className={styles.transcriptPanel}>
                                    <div className={styles.transcriptPanelHeader}>
                                        <span>Transcript Preview</span>
                                        <button onClick={handleDownloadTranscript}>Download .txt</button>
                                    </div>
                                    <div className={styles.transcriptText}>
                                        {transcript.transcriptResult.text}
                                    </div>
                                </div>
                            )}

                            {compressionProgress && <div className={styles.compressionStatus}>{compressionProgress}</div>}
                            {transcript.transcriptError && <div className={styles.transcriptError}>{transcript.transcriptError}</div>}

                            <div className={styles.saveActions}>
                                <button className={styles.btnSecondary} onClick={handleCloseSaveModal}>Discard</button>
                                
                                {!transcript.transcriptResult && !transcript.isTranscribing && (
                                    <button className={styles.btnSecondary} onClick={handleTranscribe}>
                                        Preview Transcript
                                    </button>
                                )}

                                <button className={styles.btnWhisper} onClick={handleProcessRecordedAudio} disabled={isProcessing}>
                                    {isProcessing ? 'Processing...' : 'Process & Generate Document'}
                                </button>
                                
                                <button className={styles.btnPrimary} onClick={handleDownloadMP3}>Save MP3</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MeetingRecord;

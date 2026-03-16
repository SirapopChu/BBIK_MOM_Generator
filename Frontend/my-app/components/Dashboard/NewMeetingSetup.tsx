"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './NewMeetingSetup.module.css';

const NewMeetingSetup = () => {
    const router = useRouter();
    const [participants, setParticipants] = useState<{id: number; name: string}[]>([]);
    const [newParticipant, setNewParticipant] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<{name: string, size: string}[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleAddParticipant = () => {
        if (newParticipant.trim()) {
            setParticipants([...participants, { id: Date.now(), name: newParticipant.trim() }]);
            setNewParticipant('');
        }
    };

    const removeParticipant = (id: number) => {
        setParticipants(participants.filter(p => p.id !== id));
    };

    const handleFileUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const newFiles = Array.from(files).map(file => ({
                name: file.name,
                size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
            }));
            setAttachedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className={styles.container}>
            {/* Stepper */}
            <div className={styles.stepperContainer}>
                <div className={styles.step}>
                    <div className={`${styles.stepCircle} ${styles.activeStepCircle}`}>1</div>
                    <div className={`${styles.stepLabel} ${styles.activeStepLabel}`}>SETUP</div>
                </div>
                <div className={styles.stepLine}></div>
                <div className={styles.step}>
                    <div className={styles.stepCircle}>2</div>
                    <div className={styles.stepLabel}>RECORD</div>
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

            <div className={styles.header}>
                <h1 className={styles.title}>Prepare Your Meeting</h1>
                <p className={styles.subtitle}>Provide the context required for the AI to generate accurate minutes and action items.</p>
            </div>

            <div className={styles.formContainer}>
                {/* Meeting Metadata */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </div>
                        <div>
                            <h2 className={styles.sectionTitle}>Meeting Metadata</h2>
                            <p className={styles.sectionDesc}>Essential Identifying Information for the meeting minutes record.</p>
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Meeting Title<span className={styles.required}>*</span></label>
                        <input type="text" placeholder="Enter meeting title" className={styles.input} />
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>Department / Business Unit</label>
                            <input type="text" placeholder="e.g. DX Business Unit" className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Minutes Template</label>
                            <input type="text" placeholder="e.g. Standard Corporate Minutes" className={styles.input} />
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>Date<span className={styles.required}>*</span></label>
                            <input type="date" className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Start Time<span className={styles.required}>*</span></label>
                            <input type="time" className={styles.input} />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Agenda</label>
                        <textarea className={styles.textarea} rows={4}></textarea>
                    </div>
                </div>

                {/* Participants */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <div>
                            <h2 className={styles.sectionTitle}>Participants</h2>
                            <p className={styles.sectionDesc}>Tag all attendees. This improves speaker identification accuracy during transcription.</p>
                        </div>
                    </div>

                    <div className={styles.participantInputGroup}>
                        <input 
                            type="text" 
                            placeholder="Add email address or name..." 
                            className={styles.input}
                            value={newParticipant}
                            onChange={(e) => setNewParticipant(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                        />
                        <button className={styles.addBtn} onClick={handleAddParticipant}>Add</button>
                    </div>

                    <div className={styles.chipContainer}>
                        {participants.map(p => (
                            <div key={p.id} className={styles.chip}>
                                {p.name}
                                <span className={styles.chipRemove} onClick={() => removeParticipant(p.id)}>×</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Transcription Engine */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>
                        </div>
                        <div>
                            <h2 className={styles.sectionTitle}>Transcription Engine</h2>
                            <p className={styles.sectionDesc}>Configure how the AI should handle the audio input.</p>
                        </div>
                    </div>

                    <div className={styles.radioGroup}>
                        <label className={styles.radioCard}>
                            <div className={styles.radioHeader}>
                                <span className={styles.radioTitle}>Thai Only</span>
                                <input type="radio" name="language" value="th" />
                            </div>
                            <span className={styles.radioDesc}>Optimized for local language nuances</span>
                        </label>
                        <label className={styles.radioCard}>
                            <div className={styles.radioHeader}>
                                <span className={styles.radioTitle}>English Only</span>
                                <input type="radio" name="language" value="en" />
                            </div>
                            <span className={styles.radioDesc}>Best for international stakeholders</span>
                        </label>
                        <label className={`${styles.radioCard} ${styles.radioCardSelected}`}>
                            <div className={styles.radioHeader}>
                                <span className={styles.radioTitle}>Bilingual (TH/EN)</span>
                                <input type="radio" name="language" value="th-en" defaultChecked />
                            </div>
                            <span className={styles.radioDesc}>Smart detection for code-switching</span>
                        </label>
                    </div>

                    <div className={styles.sliderContainer}>
                        <div className={styles.sliderHeader}>
                            <span className={styles.sliderLabel}>Technical Jargon Sensitivity ⓘ</span>
                            <span className={styles.sliderValue}>High (Level 8)</span>
                        </div>
                        <input type="range" min="1" max="10" defaultValue="8" className={styles.slider} />
                        <div className={styles.sliderMarks}>
                            <span>CONVERSATIONAL</span>
                            <span>ENTERPRISE STANDARD</span>
                            <span>DEEP TECHNICAL</span>
                        </div>
                    </div>

                    <label className={styles.checkboxLabel}>
                        <input type="checkbox" defaultChecked className={styles.checkbox} />
                        Enable Multi-Speaker Diarization (Recommended)
                    </label>
                </div>

                {/* Contextual Materials */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div>
                            <h2 className={styles.sectionTitle}>Contextual Materials</h2>
                            <p className={styles.sectionDesc}>Upload PPTX slides to provide the AI with technical keywords and meeting structure.</p>
                        </div>
                    </div>

                    <div className={styles.uploadArea} onClick={handleFileUploadClick} style={{ cursor: 'pointer' }}>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            hidden 
                            multiple 
                            accept=".pptx" 
                            onChange={handleFileChange}
                        />
                        <div className={styles.uploadIcon}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="12" y2="12"></line><line x1="15" y1="15" x2="12" y2="12"></line></svg>
                        </div>
                        <p className={styles.uploadText}><strong>Click to upload or drag & drop</strong></p>
                        <p className={styles.uploadSubtext}>PPTX files only (max 50MB per file)</p>
                    </div>

                    <div className={styles.attachedFilesList}>
                        <p className={styles.attachedTitle}>ATTACHED CONTEXT FILES</p>
                        {attachedFiles.length === 0 ? (
                            <div className={styles.attachedFileItem} style={{ fontStyle: 'italic', color: '#64748b', background: 'transparent', border: '1px dashed #cbd5e1' }}>
                                <div className={styles.fileInfo}>
                                    <div>
                                        <div className={styles.fileName}>No files attached yet.</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            attachedFiles.map((file, index) => (
                                <div key={index} className={styles.attachedFileItem}>
                                    <div className={styles.fileInfo}>
                                        <div className={styles.fileIcon}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                        </div>
                                        <div>
                                            <div className={styles.fileName}>{file.name}</div>
                                            <div className={styles.fileSize}>{file.size}</div>
                                        </div>
                                    </div>
                                    <button className={styles.removeFileBtn} onClick={() => removeFile(index)}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className={styles.actions}>
                    <button className={styles.proceedBtn} onClick={() => router.push('/dashboard/record')}>
                        Proceed to Recording
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewMeetingSetup;

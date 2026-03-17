"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './NewMeetingSetup.module.css';

const NewMeetingSetup = () => {
    const router = useRouter();
    const [participants, setParticipants] = useState<{ id: number; name: string }[]>([]);
    const [newParticipant, setNewParticipant] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<{ name: string, size: string }[]>([]);
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

"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './NewMeetingSetup.module.css';
import { useI18n } from '@/contexts/LanguageContext';

const NewMeetingSetup = () => {
    const { dict } = useI18n();
    const router = useRouter();
    
    // Form state
    const [title, setTitle] = useState('');
    const [bu, setBu] = useState('');
    const [template, setTemplate] = useState('Standard Corporate Minutes');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    const [agenda, setAgenda] = useState('');
    
    const [participants, setParticipants] = useState<{ id: number; name: string }[]>([]);
    const [newParticipant, setNewParticipant] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<{ name: string, size: string }[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Load from localStorage if exists
    useEffect(() => {
        const saved = localStorage.getItem('meeting_metadata');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                setTitle(data.title || '');
                setBu(data.bu || '');
                setTemplate(data.template || 'Standard Corporate Minutes');
                setDate(data.date || new Date().toISOString().split('T')[0]);
                setStartTime(data.startTime || '');
                setAgenda(data.agenda || '');
                if (data.participants) setParticipants(data.participants.map((p: string, i: number) => ({ id: i, name: p })));
            } catch (e) {
                console.error('Failed to load metadata', e);
            }
        }
    }, []);

    const handleAddParticipant = () => {
        if (newParticipant.trim()) {
            setParticipants([...participants, { id: Date.now(), name: newParticipant.trim() }]);
            setNewParticipant('');
        }
    };

    const removeParticipant = (id: number) => {
        setParticipants(participants.filter(p => p.id !== id));
    };

    const handleProceed = () => {
        if (!title.trim() || !date || !startTime) {
            alert(dict.setup.errorEmpty);
            return;
        }

        const metadata = {
            title,
            bu,
            template,
            date,
            startTime,
            agenda,
            participants: participants.map(p => p.name)
        };

        localStorage.setItem('meeting_metadata', JSON.stringify(metadata));
        router.push('/dashboard/record');
    };

    return (
        <div className={styles.container}>
            {/* Stepper */}
            <div className={styles.stepperContainer}>
                <div className={styles.step}>
                    <div className={`${styles.stepCircle} ${styles.activeStepCircle}`}>1</div>
                    <div className={`${styles.stepLabel} ${styles.activeStepLabel}`}>{dict.setup.stepSetup}</div>
                </div>
                <div className={styles.stepLine}></div>
                <div className={styles.step}>
                    <div className={styles.stepCircle}>2</div>
                    <div className={styles.stepLabel}>{dict.setup.stepRecord}</div>
                </div>
                <div className={styles.stepLine}></div>
                <div className={styles.step}>
                    <div className={styles.stepCircle}>3</div>
                    <div className={styles.stepLabel}>{dict.setup.stepProcess}</div>
                </div>
                <div className={styles.stepLine}></div>
                <div className={styles.step}>
                    <div className={styles.stepCircle}>4</div>
                    <div className={styles.stepLabel}>{dict.setup.stepReview}</div>
                </div>
                <div className={styles.stepLine}></div>
                <div className={styles.step}>
                    <div className={styles.stepCircle}>5</div>
                    <div className={styles.stepLabel}>{dict.setup.stepExport}</div>
                </div>
            </div>

            <div className={styles.header}>
                <h1 className={styles.title}>{dict.setup.title}</h1>
                <p className={styles.subtitle}>{dict.setup.subtitle}</p>
            </div>

            <div className={styles.formContainer}>
                {/* Meeting Metadata */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </div>
                        <div>
                            <h2 className={styles.sectionTitle}>{dict.setup.metadataTitle}</h2>
                            <p className={styles.sectionDesc}>{dict.setup.metadataDesc}</p>
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>{dict.setup.fieldTitle}<span className={styles.required}>*</span></label>
                        <input 
                            type="text" 
                            placeholder={dict.setup.fieldTitle} 
                            className={styles.input} 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>{dict.setup.fieldBU}</label>
                            <input 
                                type="text" 
                                placeholder="e.g. DX Business Unit" 
                                className={styles.input} 
                                value={bu}
                                onChange={(e) => setBu(e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>{dict.setup.fieldTemplate}</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Standard Corporate Minutes" 
                                className={styles.input} 
                                value={template}
                                onChange={(e) => setTemplate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>{dict.setup.fieldDate}<span className={styles.required}>*</span></label>
                            <input 
                                type="date" 
                                className={styles.input} 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>{dict.setup.fieldTime}<span className={styles.required}>*</span></label>
                            <input 
                                type="time" 
                                className={styles.input} 
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>{dict.setup.fieldAgenda}</label>
                        <textarea 
                            className={styles.textarea} 
                            rows={4}
                            value={agenda}
                            onChange={(e) => setAgenda(e.target.value)}
                        ></textarea>
                    </div>
                </div>

                {/* Participants */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionIcon}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <div>
                            <h2 className={styles.sectionTitle}>{dict.setup.participantsTitle}</h2>
                            <p className={styles.sectionDesc}>{dict.setup.participantsDesc}</p>
                        </div>
                    </div>

                    <div className={styles.participantInputGroup}>
                        <input
                            type="text"
                            placeholder={dict.setup.participantPlaceholder}
                            className={styles.input}
                            value={newParticipant}
                            onChange={(e) => setNewParticipant(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                        />
                        <button className={styles.addBtn} onClick={handleAddParticipant}>{dict.setup.addBtn}</button>
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
                    <button className={styles.proceedBtn} onClick={handleProceed}>
                        {dict.setup.proceedBtn}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewMeetingSetup;

"use client";

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import styles from './Settings.module.css';

export default function SettingsPage() {
    const [model, setModel] = useState('claude-3-5-sonnet-20241022');
    const [language, setLanguage] = useState('bilingual');
    const [pmoName, setPmoName] = useState('PMO Analyst');
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Load initial settings from localStorage
    useEffect(() => {
        const savedModel = localStorage.getItem('app_llm_model');
        const savedLang  = localStorage.getItem('app_language');
        const savedPMO   = localStorage.getItem('app_pmo_name');

        if (savedModel) setModel(savedModel);
        if (savedLang)  setLanguage(savedLang);
        if (savedPMO)   setPmoName(savedPMO);
    }, []);

    const handleSave = () => {
        localStorage.setItem('app_llm_model', model);
        localStorage.setItem('app_language',  language);
        localStorage.setItem('app_pmo_name',  pmoName);
        
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    };

    return (
        <DashboardLayout>
            <div className={styles.container}>
                <h1 className={styles.title}>System Configuration</h1>
                <p className={styles.subtitle}>Fine-tune the AI generation and document output parameters.</p>

                <div className={styles.grid}>
                    {/* LLM Section */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.iconWrapper}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                            </div>
                            <h2 className={styles.cardTitle}>Artificial Intelligence</h2>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Intelligence Model</label>
                            <select 
                                className={styles.select}
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                            >
                                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Balanced)</option>
                                <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Most Capable)</option>
                                <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fastest)</option>
                            </select>
                            <p className={styles.helperText}>
                                Better models give more accurate insight but may take longer to process.
                            </p>
                        </div>
                    </div>

                    {/* Output Section */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.iconWrapper}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                            </div>
                            <h2 className={styles.cardTitle}>Document Output</h2>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Primary Language</label>
                            <select 
                                className={styles.select}
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                            >
                                <option value="bilingual">Bilingual (Thai / English)</option>
                                <option value="thai">Thai Only</option>
                                <option value="english">English Only</option>
                            </select>
                            <p className={styles.helperText}>
                                Controls the language used for generated summaries and action items.
                            </p>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Signatory / Saved By</label>
                            <input 
                                type="text" 
                                className={styles.input}
                                value={pmoName}
                                onChange={(e) => setPmoName(e.target.value)}
                                placeholder="e.g. Senior PMO Analyst"
                            />
                            <p className={styles.helperText}>
                                This name will appear at the bottom of generated DOCX files.
                            </p>
                        </div>
                    </div>
                </div>

                <div className={styles.actions}>
                    {saveSuccess && (
                        <div className={styles.successMsg}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Settings saved successfully
                        </div>
                    )}
                    <button className={styles.saveBtn} onClick={handleSave}>
                        Save Configuration
                    </button>
                </div>
            </div>
        </DashboardLayout>
    );
}

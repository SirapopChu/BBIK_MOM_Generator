import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en } from '../dicts/en';
import { th } from '../dicts/th';

type Language = 'en' | 'th';
type Dictionary = typeof en;

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    dict: Dictionary;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>('en');

    useEffect(() => {
        const savedLang = localStorage.getItem('ui_language') as Language;
        if (savedLang && (savedLang === 'en' || savedLang === 'th')) {
            setLanguageState(savedLang);
        } else {
            // Default to Thai for BBIK context if not set
            setLanguageState('th');
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('ui_language', lang);
    };

    const dict = language === 'en' ? en : th;

    return (
        <LanguageContext.Provider value={{ language, setLanguage, dict }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useI18n = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useI18n must be used within a LanguageProvider');
    }
    return context;
};

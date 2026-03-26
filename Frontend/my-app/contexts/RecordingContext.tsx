"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface RecordingContextType {
    isRecording: boolean;
    setIsRecording: (val: boolean) => void;
    meetingMetadata: any;
    setMeetingMetadata: (val: any) => void;
    timer: number;
    setTimer: (val: number | ((prev: number) => number)) => void;
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

export const RecordingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [meetingMetadata, setMeetingMetadata] = useState<any>(null);
    const [timer, setTimer] = useState(0);

    // Sync isRecording with localStorage so we can "resume" or at least know status after page refresh
    useEffect(() => {
        const savedStatus = localStorage.getItem('isRecordingSessionActive');
        if (savedStatus === 'true') {
            // Keep in mind the actual media stream will stop on refresh, 
            // but we can at least show a "Recording interrupted" or "Resume" UI.
            // For now, let's keep it simple sync.
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('isRecordingSessionActive', isRecording.toString());
    }, [isRecording]);

    return (
        <RecordingContext.Provider value={{ 
            isRecording, setIsRecording, 
            meetingMetadata, setMeetingMetadata,
            timer, setTimer
        }}>
            {children}
        </RecordingContext.Provider>
    );
};

export const useRecording = () => {
    const context = useContext(RecordingContext);
    if (!context) throw new Error("useRecording must be used within a RecordingProvider");
    return context;
};

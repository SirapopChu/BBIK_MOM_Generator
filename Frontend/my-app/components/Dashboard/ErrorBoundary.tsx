'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Global Error Boundary
 * 
 * Catches runtime errors in the component tree to prevent 
 * the entire dashboard from crashing. Especially important 
 * when dealing with media APIs (WaveSurfer, MediaRecorder).
 */
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          borderRadius: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          margin: '2rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
            Something went wrong.
          </h2>
          <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            The recording interface encountered a critical error. This often happens if 
            microphone permissions are denied or the audio device is disconnected.
          </p>
          <pre style={{
            padding: '1rem',
            backgroundColor: '#fff',
            borderRadius: '6px',
            fontSize: '0.75rem',
            overflowX: 'auto'
          }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Login.module.css';

const LoginForm = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Hardcoded check
    if (username === 'admin' && password === 'admin123') {
      router.push('/dashboard');
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className={styles.container}>
      {/* Left Side */}
      <div className={styles.leftPanel}>
        <div className={styles.illustrationWrapper}>
          <img src="/login-illustration.png" alt="Login Illustration" className={styles.illustration} />
        </div>
      </div>

      {/* Right Side */}
      <div className={styles.rightPanel}>
        {/* Background Decorations */}
        <div className={styles.decorationCircle1}></div>
        <div className={styles.decorationCircle2}></div>

        <div className={styles.loginCard}>
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <img src="/bbik-logo-vertical.png" alt="Bluebik Logo" style={{ height: '70px', width: 'auto' }} />
          </div>
          <h1 className={styles.title}>Hello!</h1>
          <p className={styles.subtitle}>Sign Up to Get Started</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            {error && (
              <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center', marginTop: '-10px', marginBottom: '5px' }}>
                {error}
              </div>
            )}

            <div className={styles.inputGroup}>
              <span className={styles.inputIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </span>
              <input
                type="text"
                placeholder="Username"
                className={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <span className={styles.inputIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <input
                type="password"
                placeholder="Password"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={styles.submitBtn}>Login</button>
            <div className={styles.forgotWrapper}>
              <a href="#" className={styles.forgotLink}>Forgot Password</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;

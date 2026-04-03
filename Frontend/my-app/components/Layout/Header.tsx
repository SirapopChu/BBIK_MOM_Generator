import React from 'react';
import styles from './Header.module.css';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    const { user } = useAuth();
    return (
        <header className={styles.header}>
            <div className={styles.leftSection}>
                <button className={styles.hamburgerBtn} onClick={onMenuClick}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
                <div className={styles.searchContainer}>
                    <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search meetings, transcripts, or keywords..."
                        className={styles.searchInput}
                    />
                </div>
            </div>




            <div className={styles.userInfo}>
                <div className={styles.userDetails}>
                    <span className={styles.userName}>{user?.email}</span>
                    <span className={styles.userRole}>{user?.name}</span>
                </div>
                <div className={styles.avatar}>T</div>
            </div>
        </header>
    );
};

export default Header;

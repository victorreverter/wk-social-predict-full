import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { usePredictorCompletion } from '../../hooks/usePredictorCompletion';
import { ThemeToggle } from '../shared/ThemeToggle';
import type { ViewTab } from '../../types';
import './Header.css';

interface SectionStat { label: string; done: number; total: number }

export const Header: React.FC = () => {

    const { state, setActiveTab, setHelpModalOpen } = useApp();
    const { profile, user, signOut, openAuthModal, isLocked, isTestModeEnabled } = useAuth();
    const { activeTab, groupMatches, knockoutMatches, awards, tournamentXI } = state;
    const { isComplete } = usePredictorCompletion();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const { overallPct, sections } = useMemo(() => {
        const gm = Object.values(groupMatches).filter(m => m.score || m.result).length;
        const gmTotal = Object.keys(groupMatches).length;
        const km = Object.values(knockoutMatches).filter(m => m.score || m.result).length;
        const kmTotal = Object.keys(knockoutMatches).length;
        const aw = Object.values(awards).filter(v => v.trim()).length;
        const awTotal = Object.keys(awards).length;
        const xi = Object.values(tournamentXI).filter(v => v.trim()).length;
        const xiTotal = Object.keys(tournamentXI).length;

        const sections: SectionStat[] = [
            { label: 'Groups', done: gm, total: gmTotal },
            { label: 'Bracket', done: km, total: kmTotal },
            { label: 'Awards', done: aw, total: awTotal },
            { label: 'XI', done: xi, total: xiTotal },
        ];

        const totalDone = gm + km + aw + xi;
        const totalAll = gmTotal + kmTotal + awTotal + xiTotal;
        const overallPct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

        return { overallPct, sections };
    }, [groupMatches, knockoutMatches, awards, tournamentXI]);

    const handleTabClick = (tab: ViewTab) => {
        setActiveTab(tab);
        setDrawerOpen(false);
    };

    const handleHelpClick = () => {
        setHelpModalOpen(true);
        setDrawerOpen(false);
    };

    return (
        <>
            <header className="app-header glass-panel">
                <div className="header-logo">
                    <img
                        src={`${import.meta.env.BASE_URL}${state.theme === 'light' ? '2026_FIFA_World_Cup_Dark_Logo.png' : '2026_FIFA_World_Cup_Light_Logo.png'}`}
                        alt="WC 2026 Logo"
                        className="wc-logo"
                    />
                    <span className="subtitle">Predictor</span>
                </div>

                <div className="header-controls desktop-header-controls">
                    <div className="tab-switcher">
                        {isTestModeEnabled && (
                            <button
                                className={`tab-btn test-tab ${activeTab === 'EREDIVISIE_TEST' ? 'active' : ''}`}
                                onClick={() => setActiveTab('EREDIVISIE_TEST')}
                            >
                                🧪 Test
                            </button>
                        )}
                        <button
                            className={`tab-btn ${activeTab === 'GROUP' ? 'active' : ''}`}
                            onClick={() => setActiveTab('GROUP')}
                        >
                            Groups
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'BRACKET' ? 'active' : ''}`}
                            onClick={() => setActiveTab('BRACKET')}
                        >
                            Bracket
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'AWARDS' ? 'active' : ''}`}
                            onClick={() => setActiveTab('AWARDS')}
                        >
                            Awards
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'TOURNAMENT_XI' ? 'active' : ''}`}
                            onClick={() => setActiveTab('TOURNAMENT_XI')}
                        >
                            XI
                        </button>
                        <button
                            className={`tab-btn summary-btn ${!isComplete ? 'tab-btn-dimmed' : ''} ${activeTab === 'SUMMARY' ? 'active' : ''}`}
                            onClick={() => setActiveTab('SUMMARY')}
                            title={isComplete ? 'View your prediction summary' : 'Complete all predictions to unlock'}
                        >
                            Summary
                        </button>
                        <button
                            className={`tab-btn leaderboard-tab ${activeTab === 'LEADERBOARD' ? 'active' : ''}`}
                            onClick={() => setActiveTab('LEADERBOARD')}
                        >
                            🏅 Leaderboard
                        </button>
                        {profile?.is_master && (
                            <button
                                className={`tab-btn admin-tab ${activeTab === 'ADMIN' ? 'active' : ''}`}
                                onClick={() => setActiveTab('ADMIN')}
                            >
                                ⚙️ Admin
                            </button>
                        )}
                    </div>

                    {user && (
                        <div className="progress-chip" title={sections.map(s => `${s.label}: ${s.done}/${s.total}`).join(' • ')}>
                            <div className="progress-ring">
                                <svg viewBox="0 0 36 36">
                                    <path
                                        className="progress-ring-bg"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path
                                        className="progress-ring-fill"
                                        strokeDasharray={`${overallPct}, 100`}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <span className="progress-pct">{overallPct}%</span>
                            </div>
                            <div className="progress-bars">
                                {sections.map(s => (
                                    <div key={s.label} className="progress-bar-row">
                                        <span className="progress-bar-label">{s.label}</span>
                                        <div className="progress-bar-track">
                                            <div
                                                className="progress-bar-fill"
                                                style={{ width: `${s.total > 0 ? Math.round((s.done / s.total) * 100) : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        className="help-icon-btn"
                        onClick={() => setHelpModalOpen(true)}
                        title="How to use"
                    >
                        ?
                    </button>
                    <ThemeToggle />

                    {isLocked && (
                        <span className="lock-badge" title="Predictions are locked">
                            🔒 Locked
                        </span>
                    )}
                    {user ? (
                        <div className="user-menu">
                            <div className="user-avatar" title={profile?.display_name ?? profile?.username ?? 'User'}>
                                {profile?.avatar_url
                                    ? <img src={profile.avatar_url} alt="avatar" />
                                    : <span>{(profile?.display_name ?? profile?.username ?? 'U').charAt(0).toUpperCase()}</span>}
                            </div>
                            <button className="signout-btn" onClick={signOut} title="Sign out">
                                ↩
                            </button>
                        </div>
                    ) : (
                        <button className="login-btn" onClick={openAuthModal}>
                            Sign In
                        </button>
                    )}
                </div>

                <button
                    className="mobile-menu-btn"
                    onClick={() => setDrawerOpen(true)}
                    aria-label="Open menu"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
            </header>

            <div
                className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`}
                onClick={() => setDrawerOpen(false)}
                aria-hidden="true"
            />

            <aside className={`mobile-drawer glass-panel ${drawerOpen ? 'open' : ''}`}>
                <div className="mobile-drawer-header">
                    <span className="mobile-drawer-title">Menu</span>
                    <button
                        className="mobile-drawer-close"
                        onClick={() => setDrawerOpen(false)}
                        aria-label="Close menu"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <nav className="mobile-drawer-nav">
                    {isTestModeEnabled && (
                        <button
                            className={`mobile-drawer-nav-item ${activeTab === 'EREDIVISIE_TEST' ? 'active' : ''}`}
                            onClick={() => handleTabClick('EREDIVISIE_TEST')}
                        >
                            <span className="mobile-drawer-nav-icon">🧪</span>
                            <span className="mobile-drawer-nav-label">Test</span>
                        </button>
                    )}
                    <button
                        className={`mobile-drawer-nav-item ${activeTab === 'GROUP' ? 'active' : ''}`}
                        onClick={() => handleTabClick('GROUP')}
                    >
                        <span className="mobile-drawer-nav-icon">⚽</span>
                        <span className="mobile-drawer-nav-label">Groups</span>
                    </button>
                    <button
                        className={`mobile-drawer-nav-item ${activeTab === 'BRACKET' ? 'active' : ''}`}
                        onClick={() => handleTabClick('BRACKET')}
                    >
                        <span className="mobile-drawer-nav-icon">⚔</span>
                        <span className="mobile-drawer-nav-label">Bracket</span>
                    </button>
                    <button
                        className={`mobile-drawer-nav-item ${activeTab === 'AWARDS' ? 'active' : ''}`}
                        onClick={() => handleTabClick('AWARDS')}
                    >
                        <span className="mobile-drawer-nav-icon">🏅</span>
                        <span className="mobile-drawer-nav-label">Awards</span>
                    </button>
                    <button
                        className={`mobile-drawer-nav-item ${activeTab === 'TOURNAMENT_XI' ? 'active' : ''}`}
                        onClick={() => handleTabClick('TOURNAMENT_XI')}
                    >
                        <span className="mobile-drawer-nav-icon">⭐</span>
                        <span className="mobile-drawer-nav-label">XI</span>
                    </button>
                    <button
                        className={`mobile-drawer-nav-item ${!isComplete ? 'dimmed' : ''} ${activeTab === 'SUMMARY' ? 'active' : ''}`}
                        onClick={() => handleTabClick('SUMMARY')}
                        title={isComplete ? 'View your prediction summary' : 'Complete all predictions to unlock'}
                    >
                        <span className="mobile-drawer-nav-icon">📝</span>
                        <span className="mobile-drawer-nav-label">Summary</span>
                    </button>
                    <button
                        className={`mobile-drawer-nav-item ${activeTab === 'LEADERBOARD' ? 'active' : ''}`}
                        onClick={() => handleTabClick('LEADERBOARD')}
                    >
                        <span className="mobile-drawer-nav-icon">🏆</span>
                        <span className="mobile-drawer-nav-label">Leaderboard</span>
                    </button>
                    {profile?.is_master && (
                        <button
                            className={`mobile-drawer-nav-item ${activeTab === 'ADMIN' ? 'active' : ''}`}
                            onClick={() => handleTabClick('ADMIN')}
                        >
                            <span className="mobile-drawer-nav-icon">⚙</span>
                            <span className="mobile-drawer-nav-label">Admin</span>
                        </button>
                    )}
                </nav>

                <div className="mobile-drawer-divider" />

                {user && (
                    <div className="progress-chip mobile-drawer-progress-chip">
                        <div className="progress-ring">
                            <svg viewBox="0 0 36 36">
                                <path
                                    className="progress-ring-bg"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                    className="progress-ring-fill"
                                    strokeDasharray={`${overallPct}, 100`}
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                            </svg>
                            <span className="progress-pct">{overallPct}%</span>
                        </div>
                        <div className="progress-bars">
                            {sections.map(s => (
                                <div key={s.label} className="progress-bar-row">
                                    <span className="progress-bar-label">{s.label}</span>
                                    <div className="progress-bar-track">
                                        <div
                                            className="progress-bar-fill"
                                            style={{ width: `${s.total > 0 ? Math.round((s.done / s.total) * 100) : 0}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mobile-drawer-divider" />

                <div className="mobile-drawer-actions">
                    <button
                        className="mobile-drawer-action-btn"
                        onClick={handleHelpClick}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>Help &amp; Guide</span>
                    </button>

                    <div className="mobile-drawer-theme-row">
                        <ThemeToggle />
                        <span>Toggle Theme</span>
                    </div>
                </div>

                <div className="mobile-drawer-divider" />

                <div className="mobile-drawer-footer">
                    {isLocked && (
                        <span className="lock-badge" title="Predictions are locked">
                            🔒 Locked
                        </span>
                    )}
                    {user ? (
                        <div className="mobile-drawer-user">
                            <div className="user-avatar" title={profile?.display_name ?? profile?.username ?? 'User'}>
                                {profile?.avatar_url
                                    ? <img src={profile.avatar_url} alt="avatar" />
                                    : <span>{(profile?.display_name ?? profile?.username ?? 'U').charAt(0).toUpperCase()}</span>}
                            </div>
                            <span className="mobile-drawer-username">
                                {profile?.display_name ?? profile?.username ?? 'User'}
                            </span>
                            <button className="signout-btn" onClick={signOut} title="Sign out">
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <button className="login-btn" onClick={openAuthModal}>
                            Sign In
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
};

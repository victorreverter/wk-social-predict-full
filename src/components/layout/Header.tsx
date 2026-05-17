import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { usePredictorCompletion } from '../../hooks/usePredictorCompletion';
import { ThemeToggle } from '../shared/ThemeToggle';
import './Header.css';

interface SectionStat { label: string; done: number; total: number }

export const Header: React.FC = () => {

    const { state, setActiveTab, setHelpModalOpen } = useApp();
    const { profile, user, signOut, openAuthModal, isLocked, isTestModeEnabled } = useAuth();
    const { activeTab, groupMatches, knockoutMatches, awards, tournamentXI } = state;
    const { isComplete } = usePredictorCompletion();

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

    return (
        <header className="app-header glass-panel">
            <div className="header-logo">
                <img
                    src={`${import.meta.env.BASE_URL}${state.theme === 'light' ? '2026_FIFA_World_Cup_Dark_Logo.png' : '2026_FIFA_World_Cup_Light_Logo.png'}`}
                    alt="WC 2026 Logo"
                    className="wc-logo"
                />
                <span className="subtitle">Predictor</span>
            </div>

            <div className="header-controls">
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
        </header>
    );
};

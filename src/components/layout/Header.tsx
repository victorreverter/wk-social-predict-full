import { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { usePredictorCompletion } from '../../hooks/usePredictorCompletion';
import { useSaveAllPredictions } from '../../hooks/useSaveAllPredictions';
import { ThemeToggle } from '../shared/ThemeToggle';
import './Header.css';


export const Header: React.FC = () => {

    const { state, setMode, setActiveTab, resetPredictions, autoFillGroups, setThirdsModalDismissed, setHelpModalOpen } = useApp();
    const { profile, signOut, openAuthModal, isLocked, isEaseModeEnabled } = useAuth();
    const { mode, activeTab, groupMatches } = state;
    const { isComplete } = usePredictorCompletion();
    const { saveAll, saveStatus, saveMsg } = useSaveAllPredictions();


    // Effect to force HARD mode if Ease Mode is disabled globally
    useEffect(() => {
        if (!isEaseModeEnabled && mode === 'EASY') {
            setMode('HARD');
        }
    }, [isEaseModeEnabled, mode, setMode]);

    const totalGroupMatches = Object.keys(groupMatches).length;
    const completedGroupMatches = Object.values(groupMatches).filter(m => m.status === 'FINISHED').length;
    const isGroupsFinished = totalGroupMatches === 72 && completedGroupMatches === 72;

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
                        Tournament XI
                    </button>
                    {isComplete && (
                        <button
                            className={`tab-btn summary-btn ${activeTab === 'SUMMARY' ? 'active' : ''}`}
                            onClick={() => setActiveTab('SUMMARY')}
                        >
                            Summary
                        </button>
                    )}
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

                {isEaseModeEnabled && (
                    <div className="mode-switcher">
                        <button
                            className={`mode-btn ${mode === 'EASY' ? 'active' : ''}`}
                            onClick={() => setMode('EASY')}
                        >
                            Easy Mode
                        </button>
                        <button
                            className={`mode-btn ${mode === 'HARD' ? 'active' : ''}`}
                            onClick={() => setMode('HARD')}
                        >
                            Hard Mode
                        </button>
                    </div>
                )}

                {profile && (
                    <div className="global-save-wrapper">
                        {saveMsg && (
                            <span className={`global-save-msg ${saveStatus}`}>{saveMsg}</span>
                        )}
                        <button 
                            className="save-btn" 
                            onClick={saveAll}
                            disabled={saveStatus === 'saving'}
                            title="Save all predictions (Groups and Bracket required)"
                        >
                            {saveStatus === 'saving' ? '⏳ Saving...' : '💾 Save Predictions'}
                        </button>
                    </div>
                )}

                <button className="reset-btn" onClick={resetPredictions}>
                    Reset
                </button>

                {isGroupsFinished && (
                    <button
                        className="select-thirds-btn"
                        onClick={() => setThirdsModalDismissed(false)}
                    >
                        Select 3rds
                    </button>
                )}
                <button className="auto-fill-btn" onClick={autoFillGroups}>
                    Auto-Fill Groups
                </button>
                <button
                    className="help-icon-btn"
                    onClick={() => setHelpModalOpen(true)}
                    title="How to use"
                >
                    ?
                </button>
                <ThemeToggle />

                {/* ── Auth area ── */}
                {isLocked && (
                    <span className="lock-badge" title="Predictions are locked">
                        🔒 Locked
                    </span>
                )}
                {profile ? (
                    <div className="user-menu">
                        <div className="user-avatar" title={profile.display_name ?? profile.username}>
                            {profile.avatar_url
                                ? <img src={profile.avatar_url} alt="avatar" />
                                : <span>{(profile.display_name ?? profile.username).charAt(0).toUpperCase()}</span>}
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

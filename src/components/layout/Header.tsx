import { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { usePredictorCompletion } from '../../hooks/usePredictorCompletion';
import { useSaveAllPredictions } from '../../hooks/useSaveAllPredictions';
import { useToast } from '../shared/Toast';
import { ThemeToggle } from '../shared/ThemeToggle';
import './Header.css';


export const Header: React.FC = () => {

    const { state, setMode, setActiveTab, resetPredictions, autoFillGroups, setThirdsModalDismissed, setHelpModalOpen } = useApp();
    const { profile, user, signOut, openAuthModal, isLocked, isEaseModeEnabled, isTestModeEnabled } = useAuth();
    const { mode, activeTab, groupMatches } = state;
    const { isComplete } = usePredictorCompletion();
    const { saveAll, saveStatus, saveMsg } = useSaveAllPredictions();
    const { addToast } = useToast();

    const handleReset = async () => {
        try {
            await resetPredictions();
            addToast('Predictions cleared.', 'success');
        } catch (error: any) {
            console.error('Reset failed:', error);
            addToast(error?.message || 'Reset failed.', 'error');
        }
    };


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

                {user ? (
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
                ) : null}

                {!isLocked && (
                    <button className="reset-btn" onClick={handleReset}>
                        Reset
                    </button>
                )}

                {isGroupsFinished && !isLocked && (
                    <button
                        className="select-thirds-btn"
                        onClick={() => setThirdsModalDismissed(false)}
                    >
                        Select 3rds
                    </button>
                )}
                {!isLocked && (
                    <div className="auto-fill-tooltip-wrapper">
                        <button
                            className="auto-fill-btn"
                            onClick={autoFillGroups}
                            aria-describedby="autofill-tooltip"
                        >
                            Auto-Fill Groups
                        </button>
                        <span
                            className="auto-fill-tooltip"
                            id="autofill-tooltip"
                            role="tooltip"
                        >
                            Fills all groups with <strong>completely random</strong> scores — no football logic or knowledge involved!
                        </span>
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

                {/* ── Auth area ── */}
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

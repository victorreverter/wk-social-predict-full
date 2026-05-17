import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../shared/ThemeToggle';
import './Header.css';


export const Header: React.FC = () => {

    const { state, setActiveTab, setHelpModalOpen } = useApp();
    const { profile, user, signOut, openAuthModal, isLocked, isTestModeEnabled } = useAuth();
    const { activeTab } = state;

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
                    <button
                        className={`tab-btn summary-btn ${activeTab === 'SUMMARY' ? 'active' : ''}`}
                        onClick={() => setActiveTab('SUMMARY')}
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

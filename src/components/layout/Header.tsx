import { useApp } from '../../context/AppContext';
import './Header.css';

export const Header: React.FC = () => {
    const { state, setMode, setActiveTab, resetPredictions, autoFillGroups, setThirdsModalDismissed } = useApp();
    const { mode, activeTab, groupMatches } = state;

    const totalGroupMatches = Object.keys(groupMatches).length;
    const completedGroupMatches = Object.values(groupMatches).filter(m => m.status === 'FINISHED').length;
    const isGroupsFinished = totalGroupMatches === 72 && completedGroupMatches === 72;

    return (
        <header className="app-header glass-panel">
            <div className="header-logo">
                <img src={`${import.meta.env.BASE_URL}2026_FIFA_World_Cup_Light_Logo.png`} alt="WC 2026 Logo" className="wc-logo" />
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
                </div>

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
            </div>
        </header>
    );
};

import { useApp } from '../../context/AppContext';
import './Header.css';

export const Header: React.FC = () => {
    const { state, setMode, setActiveTab, resetPredictions, autoFillGroups } = useApp();
    const { mode, activeTab } = state;

    return (
        <header className="app-header glass-panel">
            <div className="header-logo">
                <h1 className="text-gradient">WC 2026</h1>
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
                <button className="reset-btn" style={{ background: 'var(--color-tertiary)' }} onClick={autoFillGroups}>
                    Auto-Fill Groups
                </button>
            </div>
        </header>
    );
};

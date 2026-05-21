import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { usePredictorCompletion } from '../../hooks/usePredictorCompletion';
import type { ViewTab } from '../../types';
import './MobileBottomNav.css';

interface NavItem {
    tab: ViewTab;
    label: string;
    icon: string;
}

const NAV_ITEMS: NavItem[] = [
    { tab: 'GAMES', label: 'Games', icon: '📅' },
    { tab: 'GROUP', label: 'Groups', icon: '⚽' },
    { tab: 'BRACKET', label: 'Bracket', icon: '⚔' },
    { tab: 'AWARDS', label: 'Awards', icon: '🏅' },
    { tab: 'TOURNAMENT_XI', label: 'XI', icon: '⭐' },
    { tab: 'SUMMARY', label: 'Summary', icon: '📝' },
    { tab: 'LEADERBOARD', label: 'Rank', icon: '🏆' },
];

export const MobileBottomNav: React.FC = () => {
    const { state, setActiveTab } = useApp();
    const { profile } = useAuth();
    const { isComplete } = usePredictorCompletion();
    const { activeTab } = state;

    return (
        <nav className="mobile-bottom-nav glass-panel">
            {NAV_ITEMS.map((item) => {
                const isSummary = item.tab === 'SUMMARY';
                const isSummaryDimmed = isSummary && !isComplete;
                const isActive = activeTab === item.tab;

                return (
                    <button
                        key={item.tab}
                        className={[
                            'bottom-nav-item',
                            isActive ? 'active' : '',
                            isSummaryDimmed ? 'dimmed' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => setActiveTab(item.tab)}
                        title={isSummaryDimmed ? 'Complete all predictions to unlock' : item.label}
                    >
                        <span className="bottom-nav-icon">{item.icon}</span>
                        <span className="bottom-nav-label">{item.label}</span>
                    </button>
                );
            })}
            {profile?.is_master && (
                <button
                    className={`bottom-nav-item ${activeTab === 'ADMIN' ? 'active' : ''} admin-item`}
                    onClick={() => setActiveTab('ADMIN')}
                    title="Admin"
                >
                    <span className="bottom-nav-icon">⚙</span>
                    <span className="bottom-nav-label">Admin</span>
                </button>
            )}
        </nav>
    );
};

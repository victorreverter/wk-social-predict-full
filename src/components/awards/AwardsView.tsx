import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { AwardsState } from '../../types';
import './AwardsView.css';

const AWARD_CATEGORIES: { key: keyof AwardsState; label: string; icon: string; shortPlaceholder: string }[] = [
    { key: 'goldenBall', label: 'Golden Ball (MVP)', icon: '🏆', shortPlaceholder: 'Predict MVP' },
    { key: 'silverBall', label: 'Silver Ball', icon: '🥈', shortPlaceholder: 'Predict Silver Ball' },
    { key: 'bronzeBall', label: 'Bronze Ball', icon: '🥉', shortPlaceholder: 'Predict Bronze Ball' },
    { key: 'goldenBoot', label: 'Golden Boot (Top Scorer)', icon: '⚽', shortPlaceholder: 'Predict Top Scorer' },
    { key: 'silverBoot', label: 'Silver Boot', icon: '👟', shortPlaceholder: 'Predict Silver Boot' },
    { key: 'bronzeBoot', label: 'Bronze Boot', icon: '👞', shortPlaceholder: 'Predict Bronze Boot' },
    { key: 'goldenGlove', label: 'Golden Glove (Best GK)', icon: '🧤', shortPlaceholder: 'Predict Best GK' },
    { key: 'fifaYoungPlayer', label: 'Young Player Award', icon: '⭐', shortPlaceholder: 'Predict Young Player' },
    { key: 'mostYellowCards', label: 'Most Yellow Cards (Player)', icon: '🟨', shortPlaceholder: 'Predict Player' },
    { key: 'mostRedCards', label: 'Most Red Cards (Player)', icon: '🟥', shortPlaceholder: 'Predict Player' },
    { key: 'fifaFairPlay', label: 'Fair Play Award (Team)', icon: '🤝', shortPlaceholder: 'Predict Fair Play Team' },
];

export const AwardsView: React.FC = () => {
    const { state, updateAward } = useApp();
    const { isLocked } = useAuth();
    const { awards } = state;

    return (
        <div className="awards-view fade-in">
            <header className="awards-header glass-panel">
                <h2 className="text-gradient">Tournament Awards Forecast</h2>
                <p>Predict who will take home the individual and team accolades at the World Cup.</p>
            </header>

            <div className="awards-grid">
                {AWARD_CATEGORIES.map(({ key, label, icon, shortPlaceholder }) => (
                    <div key={key} className="award-card glass-panel">
                        <div className="award-icon">{icon}</div>
                        <div className="award-info">
                            <label htmlFor={`award-${key}`} className="award-label">
                                {label}
                            </label>
                            <input
                                id={`award-${key}`}
                                type="text"
                                className="award-input"
                                placeholder={shortPlaceholder}
                                value={awards[key] || ''}
                                onChange={(e) => updateAward(key, e.target.value)}
                                disabled={isLocked}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

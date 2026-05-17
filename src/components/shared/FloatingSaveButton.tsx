import { useAuth } from '../../context/AuthContext';
import { useSaveAllPredictions } from '../../hooks/useSaveAllPredictions';
import './FloatingSaveButton.css';

export const FloatingSaveButton: React.FC = () => {
    const { user } = useAuth();
    const { saveAll, saveStatus, saveMsg } = useSaveAllPredictions();

    if (!user) return null;

    return (
        <div className="fab-container">
            {saveMsg && (
                <span className={`fab-msg ${saveStatus}`}>{saveMsg}</span>
            )}
            <button
                className={`fab-btn ${saveStatus}`}
                onClick={saveAll}
                disabled={saveStatus === 'saving'}
                title="Save all predictions"
            >
                {saveStatus === 'saving' ? '⏳' : '💾'}
            </button>
        </div>
    );
};

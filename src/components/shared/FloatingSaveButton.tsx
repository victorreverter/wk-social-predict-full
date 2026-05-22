import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useSaveAllPredictions } from '../../hooks/useSaveAllPredictions';
import type { AppState } from '../../types';
import './FloatingSaveButton.css';

type MatchSnap = { s: string | null; r: string | null };
type Snap = {
    gm: Record<string, MatchSnap>;
    km: Record<string, MatchSnap>;
    aw: Record<string, string>;
    xi: Record<string, string>;
    gp: Record<string, string>;
};

function toSnap(state: AppState): Snap {
    const gm: Record<string, MatchSnap> = {};
    for (const [id, m] of Object.entries(state.groupMatches)) {
        gm[id] = { s: m.score ? JSON.stringify(m.score) : null, r: m.result ?? null };
    }
    const km: Record<string, MatchSnap> = {};
    for (const [id, m] of Object.entries(state.knockoutMatches)) {
        km[id] = { s: m.score ? JSON.stringify(m.score) : null, r: m.result ?? null };
    }
    const gp: Record<string, string> = {};
    for (const [group, order] of Object.entries(state.customGroupPositions)) {
        gp[group] = JSON.stringify(order);
    }
    return { gm, km, aw: { ...state.awards }, xi: { ...state.tournamentXI }, gp };
}

export const FloatingSaveButton: React.FC = () => {
    const { user } = useAuth();
    const { state } = useApp();
    const { saveAll, saveStatus, saveMsg } = useSaveAllPredictions();

    const [lastSnap, setLastSnap] = useState<Snap | null>(null);
    const [justSaved, setJustSaved] = useState(false);

    const stateRef = useRef(state);
    stateRef.current = state;

    const didInitSnapRef = useRef(false);

    useEffect(() => {
        if (didInitSnapRef.current) return;
        didInitSnapRef.current = true;
        const t = setTimeout(() => {
            setLastSnap(toSnap(stateRef.current));
        }, 800);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (saveStatus === 'saved') {
            setLastSnap(toSnap(state));
            setJustSaved(true);
            const t = setTimeout(() => setJustSaved(false), 2000);
            return () => clearTimeout(t);
        }
    }, [saveStatus, state]);

    useEffect(() => {
        const onReset = () => {
            setLastSnap(toSnap(stateRef.current));
            didInitSnapRef.current = true;
        };
        window.addEventListener('predictions-reset', onReset);
        return () => window.removeEventListener('predictions-reset', onReset);
    }, []);

    const hasUnsavedChanges = useMemo(() => {
        if (!lastSnap) return false;
        return JSON.stringify(lastSnap) !== JSON.stringify(toSnap(state));
    }, [state, lastSnap]);

    if (!user) return null;

    return (
        <div className="fab-container">
            {saveMsg && (
                <span className={`fab-msg ${saveStatus}`}>{saveMsg}</span>
            )}
            <button
                className={[
                    'fab-btn',
                    saveStatus,
                    hasUnsavedChanges ? 'dirty' : '',
                    justSaved ? 'just-saved' : '',
                ].filter(Boolean).join(' ')}
                onClick={saveAll}
                disabled={saveStatus === 'saving'}
                title={hasUnsavedChanges ? 'You have unsaved changes' : 'All predictions saved'}
            >
                {saveStatus === 'saving' ? '⏳' : justSaved ? '✓' : '💾'}
            </button>
            <span className="fab-hover-label">Save Predictions</span>
        </div>
    );
};

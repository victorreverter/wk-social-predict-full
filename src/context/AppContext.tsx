import React, { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppState, PredictionMode, ViewTab, MatchScore, ResultType, Match, MatchStatus, Theme } from '../types';
import { generateInitialGroupMatches } from '../utils/data-init';
import { generateInitialKnockoutMatches, updateKnockoutBracket } from '../utils/bracket-logic';

interface AppContextType {
    state: AppState;
    setMode: (mode: PredictionMode) => void;
    setTheme: (theme: Theme) => void;
    setActiveTab: (tab: ViewTab) => void;
    updateGroupMatchScore: (matchId: string, score: MatchScore) => void;
    updateGroupMatchEasyResult: (matchId: string, result: ResultType) => void;
    updateKnockoutMatchScore: (matchId: string, score: MatchScore) => void;
    updateKnockoutMatchEasyResult: (matchId: string, result: ResultType) => void;
    setSelectedThirds: (teamIds: string[]) => void;
    setThirdsModalDismissed: (dismissed: boolean) => void;
    resetPredictions: () => void;
    autoFillGroups: () => void;
}

const getFreshState = (): AppState => {
    // Try to restore user theme preference; if none, default to 'dark'
    let initialTheme: Theme = 'dark';
    try {
        const stored = localStorage.getItem('wk-theme');
        if (stored === 'light' || stored === 'dark') {
            initialTheme = stored;
        }
    } catch (e) {
        console.warn('Could not read from localStorage', e);
    }

    return {
        mode: 'EASY',
        theme: initialTheme,
        activeTab: 'GROUP',
        groupMatches: generateInitialGroupMatches(),
        knockoutMatches: generateInitialKnockoutMatches(),
        selectedThirds: [],
        isThirdsModalDismissed: false,
    };
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Lazily initialize state so getFreshState() isn't called on every render/clone pass
    const [state, setState] = React.useState<AppState>(() => getFreshState());

    const setMode = (mode: PredictionMode) => {
        setState(prev => ({ ...prev, mode }));
    };

    const setTheme = (theme: Theme) => {
        setState(prev => ({ ...prev, theme }));
    };

    // Apply theme changes to document and persist preference whenever it changes
    useEffect(() => {
        const root = document.documentElement;
        const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

        if (state.theme === 'light') {
            root.classList.add('light');
            if (favicon) favicon.href = import.meta.env.BASE_URL + 'Favicon_Light.jpg';
        } else {
            root.classList.remove('light');
            if (favicon) favicon.href = import.meta.env.BASE_URL + 'Favicon_Dark.jpg';
        }

        try {
            localStorage.setItem('wk-theme', state.theme);
        } catch (e) {
            console.warn('Could not save to localStorage', e);
        }
    }, [state.theme]);

    const setActiveTab = (activeTab: ViewTab) => {
        setState(prev => ({ ...prev, activeTab }));
    };

    const updateGroupMatchScore = (matchId: string, score: MatchScore) => {
        setState(prev => {
            const match = prev.groupMatches[matchId];
            if (!match) return prev;

            const newGroupMatches = {
                ...prev.groupMatches,
                [matchId]: {
                    ...match,
                    score,
                    status: ((score.homeGoals !== null && score.awayGoals !== null) ? 'FINISHED' : 'NOT_PLAYED') as MatchStatus
                }
            };

            const newKnockoutMatches = updateKnockoutBracket(prev.knockoutMatches, newGroupMatches, []);

            return {
                ...prev,
                groupMatches: newGroupMatches,
                knockoutMatches: newKnockoutMatches,
                selectedThirds: []
            };
        });
    };

    const updateGroupMatchEasyResult = (matchId: string, result: ResultType) => {
        setState(prev => {
            const match = prev.groupMatches[matchId];
            if (!match) return prev;

            const newGroupMatches = {
                ...prev.groupMatches,
                [matchId]: {
                    ...match,
                    result,
                    status: 'FINISHED' as MatchStatus
                }
            };

            const newKnockoutMatches = updateKnockoutBracket(prev.knockoutMatches, newGroupMatches, []);

            return {
                ...prev,
                groupMatches: newGroupMatches,
                knockoutMatches: newKnockoutMatches,
                selectedThirds: []
            };
        });
    };

    const updateKnockoutMatchScore = (matchId: string, score: MatchScore) => {
        setState(prev => {
            const match = prev.knockoutMatches[matchId];
            if (!match) return prev;

            const updatedMatch: Match = {
                ...match,
                score,
                status: ((score.homeGoals !== null && score.awayGoals !== null) ? 'FINISHED' : 'NOT_PLAYED') as MatchStatus
            };

            const newKnockoutMatches = updateKnockoutBracket(
                { ...prev.knockoutMatches, [matchId]: updatedMatch },
                prev.groupMatches,
                prev.selectedThirds
            );

            return { ...prev, knockoutMatches: newKnockoutMatches };
        });
    };

    const updateKnockoutMatchEasyResult = (matchId: string, result: ResultType) => {
        setState(prev => {
            const match = prev.knockoutMatches[matchId];
            if (!match) return prev;

            const updatedMatch: Match = {
                ...match,
                result,
                status: 'FINISHED' as MatchStatus
            };

            const newKnockoutMatches = updateKnockoutBracket(
                { ...prev.knockoutMatches, [matchId]: updatedMatch },
                prev.groupMatches,
                prev.selectedThirds
            );

            return { ...prev, knockoutMatches: newKnockoutMatches };
        });
    };

    const resetPredictions = () => {
        setState(getFreshState());
    };

    const setSelectedThirds = (teamIds: string[]) => {
        setState(prev => {
            const newKnockoutMatches = updateKnockoutBracket(prev.knockoutMatches, prev.groupMatches, teamIds);
            return {
                ...prev,
                selectedThirds: teamIds,
                knockoutMatches: newKnockoutMatches,
            };
        });
    };

    const setThirdsModalDismissed = (dismissed: boolean) => {
        setState(prev => ({ ...prev, isThirdsModalDismissed: dismissed }));
    };

    const autoFillGroups = () => {
        setState(prev => {
            const tempGroups = { ...prev.groupMatches };
            Object.keys(tempGroups).forEach(matchId => {
                const homeG = Math.floor(Math.random() * 4);
                const awayG = Math.floor(Math.random() * 4);
                tempGroups[matchId] = {
                    ...tempGroups[matchId],
                    score: { ...tempGroups[matchId].score, homeGoals: homeG, awayGoals: awayG },
                    result: homeG > awayG ? 'HOME_WIN' : (awayG > homeG ? 'AWAY_WIN' : 'DRAW'),
                    status: 'FINISHED' as MatchStatus
                };
            });
            const newKnockoutMatches = updateKnockoutBracket(prev.knockoutMatches, tempGroups, []);
            return {
                ...prev,
                groupMatches: tempGroups,
                knockoutMatches: newKnockoutMatches,
                selectedThirds: []
            };
        });
    };

    const contextValue = React.useMemo(() => ({
        state,
        setMode,
        setTheme,
        setActiveTab,
        updateGroupMatchScore,
        updateGroupMatchEasyResult,
        updateKnockoutMatchScore,
        updateKnockoutMatchEasyResult,
        setSelectedThirds,
        setThirdsModalDismissed,
        resetPredictions,
        autoFillGroups
    }), [state]); // Only re-create context object if state actually changes

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};

import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { AppState, PredictionMode, ViewTab, MatchScore, ResultType, Match, MatchStatus } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateInitialGroupMatches } from '../utils/data-init';
import { generateInitialKnockoutMatches, updateKnockoutBracket } from '../utils/bracket-logic';

interface AppContextType {
    state: AppState;
    setMode: (mode: PredictionMode) => void;
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

const getFreshState = (): AppState => ({
    mode: 'EASY',
    activeTab: 'GROUP',
    groupMatches: generateInitialGroupMatches(),
    knockoutMatches: generateInitialKnockoutMatches(),
    selectedThirds: [],
    isThirdsModalDismissed: false,
});

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Lazily initialize state so getFreshState() isn't called on every render/clone pass
    const [state, setState] = React.useState<AppState>(() => getFreshState());

    const setMode = (mode: PredictionMode) => {
        setState(prev => ({ ...prev, mode }));
    };

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

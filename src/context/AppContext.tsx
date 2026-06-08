import React, { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppState, PredictionMode, ViewTab, MatchScore, ResultType, Match, MatchStatus, Theme, AwardsState, OfficialMatch, CustomGroupPositions } from '../types';
import { generateInitialGroupMatches, getDefaultGroupPositions } from '../utils/data-init';
import { generateInitialKnockoutMatches, updateKnockoutBracket, seedBracketFromPositions, propagateKnockoutWinners } from '../utils/bracket-logic';
import { deriveOfficialKnockoutBracket } from '../utils/official-bracket';
import { supabase } from '../lib/supabase';

interface AppContextType {
    state: AppState;
    setMode: (mode: PredictionMode) => void;
    setTheme: (theme: Theme) => void;
    setActiveTab: (tab: ViewTab) => void;
    updateGroupMatchScore: (matchId: string, score: MatchScore) => void;
    updateGroupMatchEasyResult: (matchId: string, result: ResultType) => void;
    updateKnockoutMatchScore: (matchId: string, score: MatchScore) => void;
    updateKnockoutMatchEasyResult: (matchId: string, result: ResultType) => void;
    updateAward: (category: keyof AwardsState, value: string) => void;
    updateTournamentXI: (positionId: string, playerName: string) => void;
    setSelectedThirds: (teamIds: string[]) => void;
    setThirdsModalDismissed: (dismissed: boolean) => void;
    setHelpModalOpen: (isOpen: boolean) => void;
    resetUserPredictions: () => Promise<void>;
    resetTournament: () => Promise<void>;
    autoFillGroups: () => void;
    loadFullState: (newState: Partial<AppState>) => void;
    loadOfficialMatches: (matches: Record<string, OfficialMatch>) => void;
    updateGroupPosition: (group: string, order: string[]) => void;
    setGroupPositions: (positions: CustomGroupPositions) => void;
    autoFillGroupPositions: () => void;
}

const getFreshState = (): AppState => {
    // Try to restore user theme preference; if none, default to 'dark'
    let initialTheme: Theme = 'dark';
    let initialThirdsDismissed = false;
    try {
        const stored = localStorage.getItem('wk-theme');
        if (stored === 'light' || stored === 'dark') {
            initialTheme = stored;
        }
        initialThirdsDismissed = localStorage.getItem('wk_thirds_modal_dismissed') === 'true';
    } catch (e) {
        /* localStorage unavailable */
    }

    return {
        mode: 'EASY',
        theme: initialTheme,
        activeTab: 'GAMES',
        groupMatches: generateInitialGroupMatches(),
        knockoutMatches: generateInitialKnockoutMatches(),
        selectedThirds: [],
        isThirdsModalDismissed: initialThirdsDismissed,
        isHelpModalOpen: false,
        awards: {
            goldenBall: '',
            silverBall: '',
            bronzeBall: '',
            goldenBoot: '',
            silverBoot: '',
            bronzeBoot: '',
            goldenGlove: '',
            fifaYoungPlayer: '',
            mostYellowCards: '',
            mostRedCards: '',
            fifaFairPlay: ''
        },
        tournamentXI: {
            GK: '',
            FP1: '', FP2: '', FP3: '', FP4: '',
            FP5: '', FP6: '', FP7: '', FP8: '',
            FP9: '', FP10: ''
        },
        officialMatches: {},
        officialKnockoutMatches: generateInitialKnockoutMatches(),
        customGroupPositions: getDefaultGroupPositions()
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
            /* localStorage unavailable */
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

            const freshKo = generateInitialKnockoutMatches();
            const newKnockoutMatches = updateKnockoutBracket(freshKo, newGroupMatches, []);

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

            const freshKo = generateInitialKnockoutMatches();
            const newKnockoutMatches = updateKnockoutBracket(freshKo, newGroupMatches, []);

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

            const newKnockoutMatches = propagateKnockoutWinners(
                { ...prev.knockoutMatches, [matchId]: updatedMatch }
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

            const newKnockoutMatches = propagateKnockoutWinners(
                { ...prev.knockoutMatches, [matchId]: updatedMatch }
            );

            return { ...prev, knockoutMatches: newKnockoutMatches };
        });
    };

    const updateAward = (category: keyof AwardsState, value: string) => {
        setState(prev => ({
            ...prev,
            awards: {
                ...prev.awards,
                [category]: value
            }
        }));
    };

    const updateTournamentXI = (positionId: string, playerName: string) => {
        setState(prev => ({
            ...prev,
            tournamentXI: {
                ...prev.tournamentXI,
                [positionId]: playerName
            }
        }));
    };

    const resetUserPredictions = async () => {
        const { data, error } = await supabase.rpc('reset_user_predictions');

        if (error) throw error;
        if (!(data as any)?.success) throw new Error((data as any)?.message || 'Unknown error');

        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
            try {
                await supabase.from('user_predictions_knockout_structure').delete().eq('user_id', authData.user.id);
            } catch (_) { /* table may not exist yet */ }
        }

        setState(getFreshState());
        const { data: { user } } = await supabase.auth.getUser();
        window.dispatchEvent(new Event('leaderboard-refresh'));
        window.dispatchEvent(new CustomEvent('predictions-reset', { detail: { userId: user?.id } }));
    };

    const resetTournament = async () => {
        const { data, error } = await supabase.rpc('reset_tournament');

        if (error) throw error;
        if (!(data as any)?.success) throw new Error((data as any)?.message || 'Unknown error');

        window.dispatchEvent(new Event('leaderboard-refresh'));
    };

    const setSelectedThirds = (teamIds: string[]) => {
        setState(prev => {
            const freshKo = generateInitialKnockoutMatches();
            const newKnockoutMatches = seedBracketFromPositions(freshKo, prev.customGroupPositions, teamIds);
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

    const setHelpModalOpen = (isOpen: boolean) => {
        setState(prev => ({ ...prev, isHelpModalOpen: isOpen }));
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
            Object.keys(newKnockoutMatches).forEach(matchId => {
                const m = newKnockoutMatches[matchId];
                if (m.status !== 'FINISHED' && m.homeTeamId !== 'TBD' && m.awayTeamId !== 'TBD') {
                    const homeG = Math.floor(Math.random() * 4);
                    const awayG = Math.floor(Math.random() * 4);
                    newKnockoutMatches[matchId] = {
                        ...m,
                        score: { homeGoals: homeG, awayGoals: awayG, homePenalties: homeG === awayG ? Math.floor(Math.random() * 4) + 1 : null, awayPenalties: homeG === awayG ? Math.floor(Math.random() * 4) + 1 : null },
                        result: homeG > awayG ? 'HOME_WIN' : (awayG > homeG ? 'AWAY_WIN' : 'DRAW'),
                        status: 'FINISHED' as MatchStatus
                    };
                }
            });
            const finalBracket = updateKnockoutBracket(newKnockoutMatches, tempGroups, []);
            return {
                ...prev,
                groupMatches: tempGroups,
                knockoutMatches: finalBracket,
                selectedThirds: []
            };
        });
    };

    const updateGroupPosition = (group: string, order: string[]) => {
        setState(prev => {
            const existing = prev.customGroupPositions[group];
            if (!existing) return prev;
            const valid = existing.filter(id => order.includes(id));
            if (valid.length !== existing.length) return prev;
            const newPositions = {
                ...prev.customGroupPositions,
                [group]: order
            };
            const freshKo = generateInitialKnockoutMatches();
            const newKnockoutMatches = seedBracketFromPositions(freshKo, newPositions, prev.selectedThirds);
            return {
                ...prev,
                customGroupPositions: newPositions,
                knockoutMatches: newKnockoutMatches,
            };
        });
    };

    const setGroupPositions = (positions: CustomGroupPositions) => {
        setState(prev => {
            const freshKo = generateInitialKnockoutMatches();
            const newKnockoutMatches = seedBracketFromPositions(
                freshKo,
                positions,
                []
            );
            return {
                ...prev,
                customGroupPositions: positions,
                knockoutMatches: newKnockoutMatches,
                selectedThirds: [],
            };
        });
    };

    const autoFillGroupPositions = () => {
        setState(prev => {
            const newPositions: CustomGroupPositions = {};
            for (const group of Object.keys(prev.customGroupPositions)) {
                const teamIds = [...prev.customGroupPositions[group]];
                for (let i = teamIds.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [teamIds[i], teamIds[j]] = [teamIds[j], teamIds[i]];
                }
                newPositions[group] = teamIds;
            }
            const freshKo = generateInitialKnockoutMatches();
            const newKnockoutMatches = seedBracketFromPositions(
                freshKo,
                newPositions,
                []
            );
            return {
                ...prev,
                customGroupPositions: newPositions,
                knockoutMatches: newKnockoutMatches,
                selectedThirds: [],
            };
        });
    };

    const loadFullState = (newState: Partial<AppState>) => {
        setState(prev => {
            const nextState = { ...prev, ...newState };

            const hasExplicitBracket = nextState.knockoutMatches
                && Object.values(nextState.knockoutMatches).some(
                    (m: Match) => m.homeTeamId !== 'TBD' || m.awayTeamId !== 'TBD'
                );

            if (!hasExplicitBracket) {
                const hasGroupMatchData = nextState.groupMatches
                    && Object.values(nextState.groupMatches).some(
                        (m: Match) => m.status === 'FINISHED' || m.result
                    );

                if (hasGroupMatchData && nextState.groupMatches) {
                    nextState.knockoutMatches = updateKnockoutBracket(
                        nextState.knockoutMatches,
                        nextState.groupMatches,
                        nextState.selectedThirds,
                        true
                    );
                } else if (newState.customGroupPositions) {
                    const allPositionsSet = Object.values(newState.customGroupPositions as Record<string, string[]>)
                        .every(arr => arr && arr.length === 4);
                    if (allPositionsSet) {
                        nextState.knockoutMatches = seedBracketFromPositions(
                            nextState.knockoutMatches,
                            newState.customGroupPositions as Record<string, string[]>,
                            nextState.selectedThirds || []
                        );
                    }
                }
            }

            return nextState;
        });
    };

    const loadOfficialMatches = (officialMatches: Record<string, OfficialMatch>) => {
        setState(prev => ({
            ...prev,
            officialMatches,
            officialKnockoutMatches: deriveOfficialKnockoutBracket(officialMatches),
        }));
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
        updateAward,
        updateTournamentXI,
        setSelectedThirds,
        setThirdsModalDismissed,
        setHelpModalOpen,
        resetUserPredictions,
        resetTournament,
        autoFillGroups,
        loadFullState,
        loadOfficialMatches,
        updateGroupPosition,
        setGroupPositions,
        autoFillGroupPositions
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

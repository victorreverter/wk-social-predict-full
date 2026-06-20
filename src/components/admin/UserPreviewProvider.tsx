import React, { useMemo } from 'react';
import type { ReactNode } from 'react';
import { AppContext } from '../../context/AppContext';
import type { AppContextType } from '../../context/AppContext';
import type { AppState, Match, MatchScore, ResultType, OfficialMatch, CustomGroupPositions } from '../../types';
import type { UserPredictionData } from '../../utils/fetchUserPredictions';

interface Props {
    data: UserPredictionData;
    officialMatches: Record<string, OfficialMatch>;
    officialKnockoutMatches: Record<string, Match>;
    children: ReactNode;
}

const noop = () => {};
const noopAsync = async () => {};
const noopStr = (_s: string) => {};
const noopStrStr = (_a: string, _b: string) => {};
const noopStrScore = (_a: string, _b: MatchScore) => {};
const noopStrResult = (_a: string, _b: ResultType) => {};
const noopStrArr = (_a: string[]) => {};
const noopBool = (_b: boolean) => {};
const noopStrArr2 = (_a: string, _b: string[]) => {};
const noopPositions = (_p: CustomGroupPositions) => {};
const noopOfficial = (_m: Record<string, OfficialMatch>) => {};
const noopPartialState = (_s: Partial<AppState>) => {};

export const UserPreviewProvider: React.FC<Props> = ({ data, officialMatches, officialKnockoutMatches, children }) => {
    const previewState: AppState = useMemo(() => ({
        mode: 'HARD',
        theme: 'dark',
        activeTab: 'GAMES',
        groupMatches: data.groupMatches,
        knockoutMatches: data.knockoutMatches,
        selectedThirds: data.selectedThirds,
        isThirdsModalDismissed: true,
        isHelpModalOpen: false,
        awards: data.awards,
        tournamentXI: data.tournamentXI,
        officialMatches,
        officialKnockoutMatches,
        customGroupPositions: data.customGroupPositions,
        koGamePredictions: data.koGamePredictions,
    }), [data, officialMatches, officialKnockoutMatches]);

    const contextValue: AppContextType = useMemo(() => ({
        state: previewState,
        setMode: noopStr,
        setTheme: noopStr,
        setActiveTab: noopStr,
        updateGroupMatchScore: noopStrScore,
        updateGroupMatchEasyResult: noopStrResult,
        updateKnockoutMatchScore: noopStrScore,
        updateKnockoutMatchEasyResult: noopStrResult,
        updateAward: noopStrStr,
        updateTournamentXI: noopStrStr,
        setSelectedThirds: noopStrArr,
        setThirdsModalDismissed: noopBool,
        setHelpModalOpen: noopBool,
        resetUserPredictions: noopAsync,
        resetTournament: noopAsync,
        autoFillGroups: noop,
        loadFullState: noopPartialState,
        loadOfficialMatches: noopOfficial,
        updateGroupPosition: noopStrArr2,
        setGroupPositions: noopPositions,
        autoFillGroupPositions: noop,
        updateKOGamePrediction: noopStrScore,
    }), [previewState]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

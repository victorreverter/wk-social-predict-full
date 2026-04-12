import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export const usePredictorCompletion = () => {
    const { state } = useApp();
    const { knockoutMatches, awards } = state;

    return useMemo(() => {
        // 1. Check if the Final match is finished.
        // In our structure, the final is match ID 'm104'.
        const isFinalFinished = knockoutMatches['m104']?.status === 'FINISHED';

        // 2. Check if all awards are filled out (non-empty strings).
        const areAwardsFilled = Object.values(awards).every((value) => value.trim() !== '');

        return {
            isComplete: isFinalFinished,
            isFinalFinished,
            areAwardsFilled,
        };
    }, [knockoutMatches, awards]);
};

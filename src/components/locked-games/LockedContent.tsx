import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getDailySchedules, getMonthForDateKey } from '../../utils/schedule';
import { LockedMatchCard } from './LockedMatchCard';
import type { Match, MatchScore } from '../../types';

interface LockedContentProps {
    gm: Record<string, Match>;
    koPreds: Record<string, MatchScore>;
}

export const LockedContent: React.FC<LockedContentProps> = ({ gm, koPreds }) => {
    const { state: liveState } = useApp();
    const { isMatchLocked: lockFn } = useAuth();
    const { officialKnockoutMatches: liveOfficialKo } = liveState;

    const mergedKnockout = useMemo(() => {
        const result: Record<string, Match> = {};
        for (const [id, officialMatch] of Object.entries(liveOfficialKo)) {
            if (officialMatch.homeTeamId !== 'TBD' && officialMatch.awayTeamId !== 'TBD') {
                const userScore: MatchScore | undefined = koPreds[id];
                result[id] = {
                    ...officialMatch,
                    score: userScore || { homeGoals: null, awayGoals: null, homePenalties: null, awayPenalties: null },
                    status: userScore && userScore.homeGoals !== null && userScore.awayGoals !== null ? 'FINISHED' : 'NOT_PLAYED',
                };
            }
        }
        return result;
    }, [liveOfficialKo, koPreds]);

    const allSchedules = useMemo(
        () => getDailySchedules(gm, mergedKnockout),
        [gm, mergedKnockout]
    );

    const lockedSchedules = useMemo(() => {
        return allSchedules
            .map(day => ({
                ...day,
                matches: day.matches.filter(m => lockFn(m)),
            }))
            .filter(day => day.matches.length > 0);
    }, [allSchedules, lockFn]);

    const totalLocked = useMemo(
        () => lockedSchedules.reduce((sum, day) => sum + day.matches.length, 0),
        [lockedSchedules]
    );

    const [selectedIdx, setSelectedIdx] = useState(0);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const pillRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

    const selectedDay = lockedSchedules[selectedIdx];

    useEffect(() => {
        if (selectedIdx >= lockedSchedules.length && lockedSchedules.length > 0) {
            setSelectedIdx(lockedSchedules.length - 1);
        }
    }, [lockedSchedules.length, selectedIdx]);

    useEffect(() => {
        const pill = pillRefs.current.get(selectedIdx);
        if (pill && scrollerRef.current) {
            pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [selectedIdx]);

    const monthLabel = selectedDay ? getMonthForDateKey(selectedDay.dateKey) : '';

    if (lockedSchedules.length === 0) {
        return (
            <div className="locked-empty glass-panel">
                <span className="locked-empty-icon">⏳</span>
                <p className="locked-empty-title">No locked matches yet</p>
                <p className="locked-empty-subtitle">Matches will appear here progressively as they lock throughout the tournament.</p>
            </div>
        );
    }

    return (
        <>
            <div className="locked-stats glass-panel">
                <span className="locked-stats-text">{totalLocked} match{totalLocked !== 1 ? 'es' : ''} locked</span>
            </div>

            <div className="locked-scroller-wrapper glass-panel">
                <button
                    className="locked-scroller-arrow"
                    onClick={() => { if (selectedIdx > 0) setSelectedIdx(selectedIdx - 1); }}
                    disabled={selectedIdx === 0}
                    aria-label="Previous day"
                >
                    ◀
                </button>

                <div className="locked-scroller" ref={scrollerRef}>
                    {lockedSchedules.map((day, idx) => (
                        <button
                            key={day.dateKey}
                            ref={(el) => { if (el) pillRefs.current.set(idx, el); }}
                            className={[
                                'locked-date-pill',
                                selectedIdx === idx ? 'active' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => setSelectedIdx(idx)}
                        >
                            <span className="locked-date-pill-label">{day.shortLabel}</span>
                            <span className="locked-date-pill-count">{day.matches.length}</span>
                        </button>
                    ))}
                </div>

                <button
                    className="locked-scroller-arrow"
                    onClick={() => { if (selectedIdx < lockedSchedules.length - 1) setSelectedIdx(selectedIdx + 1); }}
                    disabled={selectedIdx >= lockedSchedules.length - 1}
                    aria-label="Next day"
                >
                    ▶
                </button>
            </div>

            {selectedDay && (
                <div className="locked-day-section">
                    <div className="locked-day-label">
                        <span className="locked-day-month">{monthLabel}</span>
                        <span className="locked-day-separator">•</span>
                        <span className="locked-day-count">{selectedDay.matches.length} match{selectedDay.matches.length !== 1 ? 'es' : ''}</span>
                    </div>

                    <div className="locked-matches-list">
                        {selectedDay.matches.map(match => (
                            <LockedMatchCard key={match.id} match={match} />
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

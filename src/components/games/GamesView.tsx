import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { getDailySchedules, findTodayIndex, getMonthForDateKey } from '../../utils/schedule';
import { DailyMatchCard } from './DailyMatchCard';
import type { Match, MatchScore } from '../../types';
import './GamesView.css';

export const GamesView: React.FC = () => {
  const { state } = useApp();
  const { groupMatches, officialKnockoutMatches, koGamePredictions } = state;

  const mergedKnockout = useMemo(() => {
    const result: Record<string, Match> = {};
    for (const [id, officialMatch] of Object.entries(officialKnockoutMatches)) {
      if (officialMatch.homeTeamId !== 'TBD' && officialMatch.awayTeamId !== 'TBD') {
        const userScore: MatchScore | undefined = koGamePredictions[id];
        result[id] = {
          ...officialMatch,
          score: userScore || { homeGoals: null, awayGoals: null, homePenalties: null, awayPenalties: null },
          status: userScore && userScore.homeGoals !== null && userScore.awayGoals !== null ? 'FINISHED' : 'NOT_PLAYED',
        };
      }
    }
    return result;
  }, [officialKnockoutMatches, koGamePredictions]);

  const schedules = useMemo(
    () => getDailySchedules(groupMatches, mergedKnockout),
    [groupMatches, mergedKnockout]
  );

  const todayIdx = useMemo(() => findTodayIndex(schedules), [schedules]);
  const [selectedIdx, setSelectedIdx] = useState(todayIdx);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const todayPillRef = useRef<HTMLButtonElement | null>(null);

  const selectedDay = schedules[selectedIdx];

  useEffect(() => {
    setSelectedIdx(todayIdx);
  }, [todayIdx]);

  useEffect(() => {
    const pill = pillRefs.current.get(selectedIdx);
    if (pill && scrollerRef.current) {
      pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedIdx]);

  const goToToday = useCallback(() => {
    setSelectedIdx(todayIdx);
  }, [todayIdx]);

  const handlePrev = () => {
    if (selectedIdx > 0) setSelectedIdx(selectedIdx - 1);
  };

  const handleNext = () => {
    if (selectedIdx < schedules.length - 1) setSelectedIdx(selectedIdx + 1);
  };

  const monthLabel = selectedDay ? getMonthForDateKey(selectedDay.dateKey) : '';

  if (schedules.length === 0) {
    return (
      <div className="games-view">
        <div className="games-empty glass-panel">
          <p>No matches scheduled yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="games-view">
      <p className="games-subtitle">Predict match scores day by day — browse the full tournament calendar below.</p>
      <div className="games-scroller-wrapper glass-panel">
        <button
          className="games-today-btn"
          onClick={goToToday}
          title="Go to Today"
          aria-label="Go to Today"
        >
          <span className="today-btn-icon">📅</span>
          <span className="today-btn-label">Today</span>
        </button>

        <button
          className="games-scroller-arrow"
          onClick={handlePrev}
          disabled={selectedIdx === 0}
          aria-label="Previous day"
        >
          ◀
        </button>

        <div className="games-scroller" ref={scrollerRef}>
          {schedules.map((day, idx) => (
            <button
              key={day.dateKey}
              ref={(el) => {
                if (el) pillRefs.current.set(idx, el);
                if (idx === todayIdx && el) todayPillRef.current = el;
              }}
              className={[
                'games-date-pill',
                selectedIdx === idx ? 'active' : '',
                idx === todayIdx ? 'today' : '',
                !day.hasGames ? 'empty' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedIdx(idx)}
            >
              <span className="games-date-pill-label">{day.shortLabel}</span>
              {day.hasGames && <span className="games-date-pill-dot" />}
            </button>
          ))}
        </div>

        <button
          className="games-scroller-arrow"
          onClick={handleNext}
          disabled={selectedIdx === schedules.length - 1}
          aria-label="Next day"
        >
          ▶
        </button>
      </div>

      {selectedDay && (
        <div className="games-day-section">
          <div className="games-day-label">
            <span className="games-day-month">{monthLabel}</span>
            {selectedDay.hasGames && (
              <>
                <span className="games-day-separator">•</span>
                <span className="games-day-count">{selectedDay.matches.length} match{selectedDay.matches.length !== 1 ? 'es' : ''}</span>
              </>
            )}
          </div>

          {selectedDay.hasGames ? (
            <div className="games-matches-list">
              {selectedDay.matches.map(match => (
                <DailyMatchCard key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <div className="games-empty-day glass-panel">
              <span className="empty-day-icon">📅</span>
              <p className="empty-day-title">{selectedDay.fullLabel}</p>
              <p className="empty-day-subtitle">No games today</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

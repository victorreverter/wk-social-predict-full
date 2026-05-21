import React from 'react';
import { useApp } from '../../context/AppContext';
import { useMatchLock } from '../../hooks/useMatchLock';
import { initialTeams } from '../../utils/data-init';
import { isMatchKnockout } from '../../utils/schedule';
import type { Match, Team } from '../../types';
import './DailyMatchCard.css';

interface Props {
  match: Match;
}

const TBD_TEAM: Team = { id: 'TBD', name: 'TBD', code: 'TBD', group: '' };

const stageLabel = (stage: string): string => {
  const map: Record<string, string> = {
    GROUP: 'Group Stage',
    R32: 'Round of 32',
    R16: 'Round of 16',
    QF: 'Quarter-Final',
    SF: 'Semi-Final',
    '3RD': '3rd Place',
    F: 'Final',
  };
  return map[stage] || stage;
};

export const DailyMatchCard: React.FC<Props> = ({ match }) => {
  const { state, updateGroupMatchScore, updateKnockoutMatchScore } = useApp();
  const { isLocked: isMatchTimeLocked, formatted: lockCountdown, urgency } = useMatchLock(match);
  const { officialMatches } = state;

  const isKO = isMatchKnockout(match);

  const homeTeam = initialTeams.find(t => t.id === match.homeTeamId)
    || (match.homeTeamId === 'TBD' ? TBD_TEAM : { ...TBD_TEAM, id: match.homeTeamId });
  const awayTeam = initialTeams.find(t => t.id === match.awayTeamId)
    || (match.awayTeamId === 'TBD' ? TBD_TEAM : { ...TBD_TEAM, id: match.awayTeamId });

  const isTiedKO = isKO
    && match.score.homeGoals !== null
    && match.score.awayGoals !== null
    && match.score.homeGoals === match.score.awayGoals;

  const handleScoreChange = (type: 'home' | 'away', val: string) => {
    const num = val === '' ? null : parseInt(val, 10);
    if (num !== null && (isNaN(num) || num < 0)) return;

    const newScore = { ...match.score };
    if (type === 'home') newScore.homeGoals = num;
    else newScore.awayGoals = num;

    if (isKO) {
      updateKnockoutMatchScore(match.id, newScore);
    } else {
      updateGroupMatchScore(match.id, newScore);
    }
  };

  const handlePenChange = (type: 'home-pen' | 'away-pen', val: string) => {
    const num = val === '' ? null : parseInt(val, 10);
    if (num !== null && (isNaN(num) || num < 0)) return;

    const newScore = { ...match.score };
    if (type === 'home-pen') newScore.homePenalties = num;
    else newScore.awayPenalties = num;

    updateKnockoutMatchScore(match.id, newScore);
  };

  const official = officialMatches[match.id];

  const renderOfficialResult = () => {
    if (!official) {
      return (
        <div className="daily-official-result pending">
          <span className="result-label">Official:</span>
          <span className="result-score">Pending</span>
        </div>
      );
    }

    if (official.status !== 'FINISHED' || official.home_goals === null || official.away_goals === null) {
      return (
        <div className="daily-official-result pending">
          <span className="result-label">Official:</span>
          <span className="result-score">Pending</span>
        </div>
      );
    }

    const isExact =
      match.score.homeGoals === official.home_goals &&
      match.score.awayGoals === official.away_goals;

    const userOutcome =
      match.score.homeGoals !== null && match.score.awayGoals !== null
        ? (match.score.homeGoals > match.score.awayGoals ? 'home' : match.score.homeGoals < match.score.awayGoals ? 'away' : 'draw')
        : null;

    const offOutcome =
      official.home_goals > official.away_goals ? 'home' : official.home_goals < official.away_goals ? 'away' : 'draw';

    const isCorrectOutcome = userOutcome !== null && userOutcome === offOutcome;

    let statusClass = 'wrong';
    if (isExact) statusClass = 'exact';
    else if (isCorrectOutcome) statusClass = 'correct';

    let scoreText = `${official.home_goals} - ${official.away_goals}`;
    if (official.went_to_pens && official.home_penalties !== null && official.away_penalties !== null) {
      scoreText += ` (${official.home_penalties} - ${official.away_penalties} pens)`;
    }

    return (
      <div className={`daily-official-result ${statusClass}`}>
        <span className="result-label">Official:</span>
        <span className="result-score">{scoreText}</span>
      </div>
    );
  };

  const matchLabel = isKO ? match.id.replace('m', 'M').toUpperCase() : match.id.toUpperCase();
  const venueLabel = match.venue && match.venue !== 'TBD' ? match.venue : null;

  return (
    <div className={`daily-match-card glass-panel ${match.status === 'FINISHED' ? 'finished' : ''}`}>
      <div className="daily-match-card-header">
        <div className="daily-match-card-top-row">
          <span className="daily-match-card-id">{matchLabel}</span>
          <span className="daily-match-card-stage">{stageLabel(match.stage)}</span>
          {match.group && <span className="daily-match-card-group">Group {match.group}</span>}
        </div>
        <div className="daily-match-card-meta">
          <span className="daily-match-card-date">
            {match.date && !match.date.includes('TBD')
              ? <span className="user-time">{new Date(match.date).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })} your time</span>
              : <span className="user-time">TBD</span>
            }
            {match.localTime && match.localTime !== 'TBD'
              ? <span className="venue-time"> • {match.localTime} match time</span>
              : ''}
          </span>
          {venueLabel && <span className="daily-match-card-venue">{venueLabel}</span>}
        </div>
        {lockCountdown && (
          <span className={`daily-lock-countdown ${urgency}`}>
            {lockCountdown}
          </span>
        )}
      </div>

      <div className="daily-match-teams">
        <div className="daily-team home">
          <span className="daily-team-name">{homeTeam.name}</span>
          <span className="daily-team-name-abbr">{homeTeam.code}</span>
          {homeTeam.code !== 'TBD' && (
            <img src={`${import.meta.env.BASE_URL}flags/${homeTeam.code}.svg`} className="team-flag" alt="" />
          )}
          <div className="daily-score-group">
            {isTiedKO && (
              <input
                type="number"
                min="0"
                className="daily-pen-input"
                placeholder="P"
                title="Penalties"
                value={match.score.homePenalties === null ? '' : match.score.homePenalties}
                onChange={(e) => handlePenChange('home-pen', e.target.value)}
                disabled={isMatchTimeLocked}
              />
            )}
            <input
              type="number"
              min="0"
              className="daily-score-input"
              value={match.score.homeGoals === null ? '' : match.score.homeGoals}
              onChange={(e) => handleScoreChange('home', e.target.value)}
              placeholder="-"
              disabled={isMatchTimeLocked}
            />
          </div>
        </div>

        <div className="daily-match-divider">VS</div>

        <div className="daily-team away">
          <div className="daily-score-group">
            <input
              type="number"
              min="0"
              className="daily-score-input"
              value={match.score.awayGoals === null ? '' : match.score.awayGoals}
              onChange={(e) => handleScoreChange('away', e.target.value)}
              placeholder="-"
              disabled={isMatchTimeLocked}
            />
            {isTiedKO && (
              <input
                type="number"
                min="0"
                className="daily-pen-input"
                placeholder="P"
                title="Penalties"
                value={match.score.awayPenalties === null ? '' : match.score.awayPenalties}
                onChange={(e) => handlePenChange('away-pen', e.target.value)}
                disabled={isMatchTimeLocked}
              />
            )}
          </div>
          {awayTeam.code !== 'TBD' && (
            <img src={`${import.meta.env.BASE_URL}flags/${awayTeam.code}.svg`} className="team-flag" alt="" />
          )}
          <span className="daily-team-name">{awayTeam.name}</span>
          <span className="daily-team-name-abbr">{awayTeam.code}</span>
        </div>
      </div>

      {renderOfficialResult()}
    </div>
  );
};

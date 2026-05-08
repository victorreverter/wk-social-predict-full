import React from 'react';
import { useApp } from '../../context/AppContext';
import { useMatchLock } from '../../hooks/useMatchLock';
import { EREDIVISIE_TEAMS } from '../../utils/data-init';
import type { Match, ResultType } from '../../types';
import './EredivisieTestView.css';

interface Props {
  match: Match;
}

const EredivisieMatchCard: React.FC<Props> = ({ match }) => {
  const { state, updateEredivisieMatchScore, updateEredivisieMatchEasyResult } = useApp();
  const { isLocked: isMatchTimeLocked, formatted: lockCountdown } = useMatchLock(match);
  const { mode } = state;

  const homeTeam = EREDIVISIE_TEAMS.find(t => t.id === match.homeTeamId);
  const awayTeam = EREDIVISIE_TEAMS.find(t => t.id === match.awayTeamId);

  const handleEasyResult = (result: ResultType) => {
    updateEredivisieMatchEasyResult(match.id, result);
  };

  const handleHardScoreChange = (type: 'home' | 'away', val: string) => {
    const num = val === '' ? null : parseInt(val, 10);
    if (num !== null && (isNaN(num) || num < 0)) return;

    if (type === 'home') {
      updateEredivisieMatchScore(match.id, { ...match.score, homeGoals: num });
    } else {
      updateEredivisieMatchScore(match.id, { ...match.score, awayGoals: num });
    }
  };

  const matchDate = new Date(match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const matchTime = new Date(match.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`eredivisie-match-card glass-panel ${match.status === 'FINISHED' ? 'finished' : ''}`}>
      <div className="eredivisie-match-header">
        <span className="eredivisie-match-id">{match.id.toUpperCase()}</span>
        <div className="eredivisie-match-datetime">
          <span className="eredivisie-match-date">{matchDate}</span>
          <span className="eredivisie-match-time">{matchTime} your time</span>
        </div>
        {lockCountdown && (
          <span className={`lock-countdown ${isMatchTimeLocked ? 'locked' : 'warning'}`}>
            {lockCountdown}
          </span>
        )}
      </div>

      <div className="eredivisie-teams">
        <div className="eredivisie-team home">
          <span className="eredivisie-team-name">{homeTeam?.name ?? 'TBD'}</span>
          {homeTeam?.flagUrl && <img src={homeTeam.flagUrl} className="eredivisie-team-logo" alt="" />}
          {mode === 'HARD' && (
            <input
              type="number" min="0" className="score-input"
              value={match.score.homeGoals === null ? '' : match.score.homeGoals}
              onChange={(e) => handleHardScoreChange('home', e.target.value)}
              placeholder="-" disabled={isMatchTimeLocked}
            />
          )}
        </div>

        <div className="eredivisie-divider">VS</div>

        <div className="eredivisie-team away">
          {mode === 'HARD' && (
            <input
              type="number" min="0" className="score-input"
              value={match.score.awayGoals === null ? '' : match.score.awayGoals}
              onChange={(e) => handleHardScoreChange('away', e.target.value)}
              placeholder="-" disabled={isMatchTimeLocked}
            />
          )}
          {awayTeam?.flagUrl && <img src={awayTeam.flagUrl} className="eredivisie-team-logo" alt="" />}
          <span className="eredivisie-team-name">{awayTeam?.name ?? 'TBD'}</span>
        </div>
      </div>

      {mode === 'EASY' && (
        <div className="eredivisie-easy-controls">
          <button
            className={`btn-easy win-btn ${match.result === 'HOME_WIN' ? 'active' : ''}`}
            onClick={() => handleEasyResult('HOME_WIN')}
            disabled={isMatchTimeLocked}
          >W</button>
          <button
            className={`btn-easy draw-btn ${match.result === 'DRAW' ? 'active' : ''}`}
            onClick={() => handleEasyResult('DRAW')}
            disabled={isMatchTimeLocked}
          >D</button>
          <button
            className={`btn-easy win-btn ${match.result === 'AWAY_WIN' ? 'active' : ''}`}
            onClick={() => handleEasyResult('AWAY_WIN')}
            disabled={isMatchTimeLocked}
          >W</button>
        </div>
      )}
    </div>
  );
};

export const EredivisieTestView: React.FC = () => {
  const { state } = useApp();
  const { eredivisieMatches, mode } = state;

  const md33Matches = Object.values(eredivisieMatches).filter(m => m.stage === 'EREDIVISIE_33')
    .sort((a, b) => a.id.localeCompare(b.id));
  const md34Matches = Object.values(eredivisieMatches).filter(m => m.stage === 'EREDIVISIE_34')
    .sort((a, b) => a.id.localeCompare(b.id));

  const totalCompleted = Object.values(eredivisieMatches).filter(m => m.status === 'FINISHED').length;

  return (
    <div className="eredivisie-test-view fade-in">
      <header className="eredivisie-header glass-panel">
        <h2 className="text-gradient">🧪 Eredivisie Test Mode</h2>
        <p>Predict the last 2 matchdays of the 25-26 Eredivisie season. This is a live test — your predictions lock 1 hour before kickoff.</p>
        <div className="eredivisie-stats">
          <span className="stat-badge">{totalCompleted}/18 completed</span>
          <span className={`stat-badge ${mode === 'EASY' ? 'mode-easy' : 'mode-hard'}`}>
            {mode === 'EASY' ? 'Easy' : 'Hard'} Mode
          </span>
        </div>
      </header>

      <div className="eredivisie-matchday-section">
        <div className="eredivisie-section-header">
          <span className="section-title">📅 Matchday 33</span>
          <span className="section-subtitle">Sunday, May 10 · 4:45 PM CEST</span>
        </div>
        <div className="eredivisie-match-grid">
          {md33Matches.map(m => <EredivisieMatchCard key={m.id} match={m} />)}
        </div>
      </div>

      <div className="eredivisie-matchday-section">
        <div className="eredivisie-section-header">
          <span className="section-title">📅 Matchday 34</span>
          <span className="section-subtitle">Sunday, May 17 · 2:30 PM CEST</span>
        </div>
        <div className="eredivisie-match-grid">
          {md34Matches.map(m => <EredivisieMatchCard key={m.id} match={m} />)}
        </div>
      </div>
    </div>
  );
};

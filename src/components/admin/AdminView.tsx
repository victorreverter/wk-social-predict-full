import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { initialTeams, groups, generateInitialGroupMatches } from '../../utils/data-init';
import {
    R32_FIXTURES, R16_FIXTURES, QF_FIXTURES, SF_FIXTURES,
    THIRD_PLACE_FIXTURE, FINAL_FIXTURE
} from '../../utils/bracket-logic';
import { scoreAwards } from '../../lib/scoreAwards';
import { scoreXI } from '../../lib/scoreXI';
import { useAuth } from '../../context/AuthContext';
import { updateKnockoutBracket, determineQualifiedTeams } from '../../utils/bracket-logic';
import type { Match } from '../../types';

import './AdminView.css';

// ── Types ──────────────────────────────────────────────────
interface OfficialMatch {
    match_id: string;
    home_goals: number | null;
    away_goals: number | null;
    home_penalties: number | null;
    away_penalties: number | null;
    went_to_pens: boolean;
    status: 'NOT_PLAYED' | 'FINISHED';
}

interface OfficialAward {
    category: string;
    value: string;
}

// ── Utilities ─────────────────────────────────────────────
const teamName = (id: string) => initialTeams.find(t => t.id === id)?.name ?? id;
const allGroupMatches = generateInitialGroupMatches();

const matchesByGroup: Record<string, { id: string; homeId: string; awayId: string }[]> = {};
Object.entries(allGroupMatches).forEach(([id, m]) => {
    const g = m.group ?? '?';
    if (!matchesByGroup[g]) matchesByGroup[g] = [];
    matchesByGroup[g].push({ id, homeId: m.homeTeamId, awayId: m.awayTeamId });
});

const KO_ROUNDS = [
    { label: 'Round of 32',    key: 'R32', matches: R32_FIXTURES.map(f => ({ id: `m${f.matchNum}`, label: `Match ${f.matchNum}`, homeSlot: f.homeSlot,        awaySlot: f.awaySlot        })) },
    { label: 'Round of 16',    key: 'R16', matches: R16_FIXTURES.map(f => ({ id: `m${f.matchNum}`, label: `Match ${f.matchNum}`, homeSlot: `W.${f.homeFrom}`,  awaySlot: `W.${f.awayFrom}` })) },
    { label: 'Quarter-Finals', key: 'QF',  matches: QF_FIXTURES.map(f  => ({ id: `m${f.matchNum}`, label: `Match ${f.matchNum}`, homeSlot: `W.${f.homeFrom}`,  awaySlot: `W.${f.awayFrom}` })) },
    { label: 'Semi-Finals',    key: 'SF',  matches: SF_FIXTURES.map(f  => ({ id: `m${f.matchNum}`, label: `Match ${f.matchNum}`, homeSlot: `W.${f.homeFrom}`,  awaySlot: `W.${f.awayFrom}` })) },
    { label: '3rd Place',      key: '3RD', matches: [{ id: `m${THIRD_PLACE_FIXTURE.matchNum}`, label: `Match ${THIRD_PLACE_FIXTURE.matchNum}`, homeSlot: `L.${THIRD_PLACE_FIXTURE.homeFrom}`, awaySlot: `L.${THIRD_PLACE_FIXTURE.awayFrom}` }] },
    { label: 'Final',          key: 'F',   matches: [{ id: `m${FINAL_FIXTURE.matchNum}`,       label: `Match ${FINAL_FIXTURE.matchNum}`,       homeSlot: `W.${FINAL_FIXTURE.homeFrom}`,       awaySlot: `W.${FINAL_FIXTURE.awayFrom}`       }] },
];

const AWARD_CATEGORIES = [
    { key: 'goldenBall',     label: 'Golden Ball (MVP)',          icon: '🏆' },
    { key: 'silverBall',     label: 'Silver Ball',                icon: '🥈' },
    { key: 'bronzeBall',     label: 'Bronze Ball',                icon: '🥉' },
    { key: 'goldenBoot',     label: 'Golden Boot (Top Scorer)',   icon: '⚽' },
    { key: 'silverBoot',     label: 'Silver Boot',                icon: '👟' },
    { key: 'bronzeBoot',     label: 'Bronze Boot',                icon: '👞' },
    { key: 'goldenGlove',    label: 'Golden Glove (Best GK)',     icon: '🧤' },
    { key: 'fifaYoungPlayer',label: 'Young Player Award',         icon: '⭐' },
    { key: 'mostYellowCards',label: 'Most Yellow Cards (Player)', icon: '🟨' },
    { key: 'mostRedCards',   label: 'Most Red Cards (Player)',    icon: '🟥' },
    { key: 'fifaFairPlay',   label: 'Fair Play Award (Team)',     icon: '🤝' },
];

const EMPTY_ROW = (matchId: string): OfficialMatch => ({
    match_id: matchId, home_goals: null, away_goals: null,
    home_penalties: null, away_penalties: null, went_to_pens: false, status: 'NOT_PLAYED',
});

// ── Reusable Match Row ────────────────────────────────────
const MatchRow: React.FC<{
    id: string;
    label: string;
    homeLabel: string;
    awayLabel: string;
    row: OfficialMatch;
    hasPens: boolean;
    saving: string | null;
    isSavedData: boolean;
    onChange: (field: keyof OfficialMatch, value: string | boolean | number | null) => void;
    onSave: () => void;
}> = ({ id, label, homeLabel, awayLabel, row, hasPens, saving, isSavedData, onChange, onSave }) => {
    const isTie = row.home_goals !== null && row.away_goals !== null && row.home_goals === row.away_goals;

    return (
        <div className={`admin-match-card glass-panel ${isSavedData ? 'admin-match-card--saved' : ''}`}>
            <span className="admin-match-id">{label}</span>
            <div className="admin-match-body">
                <div className="admin-match-teams">
                    <span className="admin-team">{homeLabel}</span>
                    <div className="admin-score-inputs">
                        <input type="number" min="0" max="20" className="score-input"
                            value={row.home_goals ?? ''} placeholder="—"
                            onChange={e => onChange('home_goals', e.target.value === '' ? null : parseInt(e.target.value))} />
                        <span className="score-sep">:</span>
                        <input type="number" min="0" max="20" className="score-input"
                            value={row.away_goals ?? ''} placeholder="—"
                            onChange={e => onChange('away_goals', e.target.value === '' ? null : parseInt(e.target.value))} />
                    </div>
                    <span className="admin-team">{awayLabel}</span>
                </div>

                {hasPens && isTie && (
                    <div className="admin-pens-row">
                        <label className="admin-pens-toggle">
                            <input type="checkbox" checked={row.went_to_pens ?? false}
                                onChange={e => onChange('went_to_pens', e.target.checked)} />
                            <span>Went to penalties</span>
                        </label>
                        {row.went_to_pens && (
                            <div className="admin-pens-inputs">
                                <span className="pens-label">Pens:</span>
                                <input type="number" min="0" max="30" className="score-input score-input--small"
                                    value={row.home_penalties ?? ''} placeholder="—"
                                    onChange={e => onChange('home_penalties', e.target.value === '' ? null : parseInt(e.target.value))} />
                                <span className="score-sep">:</span>
                                <input type="number" min="0" max="30" className="score-input score-input--small"
                                    value={row.away_penalties ?? ''} placeholder="—"
                                    onChange={e => onChange('away_penalties', e.target.value === '' ? null : parseInt(e.target.value))} />
                            </div>
                        )}
                    </div>
                )}
            </div>
            <button 
                className={`admin-save-btn ${isSavedData ? 'admin-save-btn--saved' : ''}`} 
                onClick={onSave} 
                disabled={saving === id}
            >
                {saving === id ? '…' : isSavedData ? '✓ Saved' : 'Save'}
            </button>
        </div>
    );
};

// XI slots: GK + 10 position-agnostic field players
const XI_SLOTS: { key: string; label: string; isGK: boolean }[] = [
    { key: 'GK',  label: 'Goalkeeper',     isGK: true  },
    { key: 'FP1', label: 'Field Player 1', isGK: false },
    { key: 'FP2', label: 'Field Player 2', isGK: false },
    { key: 'FP3', label: 'Field Player 3', isGK: false },
    { key: 'FP4', label: 'Field Player 4', isGK: false },
    { key: 'FP5', label: 'Field Player 5', isGK: false },
    { key: 'FP6', label: 'Field Player 6', isGK: false },
    { key: 'FP7', label: 'Field Player 7', isGK: false },
    { key: 'FP8', label: 'Field Player 8', isGK: false },
    { key: 'FP9', label: 'Field Player 9', isGK: false },
    { key: 'FP10',label: 'Field Player 10',isGK: false },
];

// ── Main Component ────────────────────────────────────────
export const AdminView: React.FC = () => {
    const { isLocked, updateLockDate, isEaseModeEnabled, updateEaseMode } = useAuth();
    
    const [section, setSection]           = useState<'group' | 'knockout' | 'awards' | 'xi'>('group');
    const [activeGroup, setActiveGroup]   = useState<string>(groups[0]);
    const [activeKoRound, setActiveKoRound] = useState<string>('R32');
    const [officialMatches, setOfficialMatches] = useState<Record<string, OfficialMatch>>({});
    const [officialAwards, setOfficialAwards]   = useState<Record<string, string>>({});
    const [officialXI, setOfficialXI]     = useState<Record<string, string>>({});
    const [resolvedKo, setResolvedKo]     = useState<Record<string, Match>>({});
    const [xiScoring, setXiScoring]       = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const [savedQueue, setSavedQueue] = useState<Record<string, boolean>>({});
    const [toast, setToast]   = useState<string | null>(null);
    const [confirmReset, setConfirmReset] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const flashSaved = (id: string) => {
        setSavedQueue(p => ({ ...p, [id]: true }));
        setTimeout(() => setSavedQueue(p => ({ ...p, [id]: false })), 2000);
    };

    const loadData = useCallback(async () => {
        const { data: mData } = await supabase.from('official_matches').select('*');
        if (mData) {
            const map: Record<string, OfficialMatch> = {};
            mData.forEach((r: OfficialMatch) => { map[r.match_id] = r; });
            setOfficialMatches(map);
        }
        const { data: aData } = await supabase.from('official_awards').select('*');
        if (aData) {
            const map: Record<string, string> = {};
            (aData as OfficialAward[]).forEach(r => { map[r.category] = r.value; });
            setOfficialAwards(map);
        }
        const { data: xData } = await supabase.from('official_tournament_xi').select('position, player_name');
        if (xData) {
            const map: Record<string, string> = {};
            (xData as { position: string; player_name: string }[]).forEach(r => { map[r.position] = r.player_name; });
            setOfficialXI(map);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Dynamically resolve Knockout Bracket based on Official Matches
    useEffect(() => {
        const fullGroupMatches = generateInitialGroupMatches();
        Object.keys(fullGroupMatches).forEach(id => {
            const om = officialMatches[id];
            if (om) {
                fullGroupMatches[id].score.homeGoals = om.home_goals;
                fullGroupMatches[id].score.awayGoals = om.away_goals;
                fullGroupMatches[id].score.homePenalties = om.home_penalties;
                fullGroupMatches[id].score.awayPenalties = om.away_penalties;
                fullGroupMatches[id].status = (om.home_goals !== null && om.away_goals !== null) ? 'FINISHED' : 'NOT_PLAYED';
            }
        });

        // Get thirds
        const { best8Thirds } = determineQualifiedTeams(fullGroupMatches);
        const thirdsIds = best8Thirds.map(t => t.teamId);

        // First pass: resolve the empty knockout bracket up to R32 (allow incomplete data to preview live)
        let ko = updateKnockoutBracket({}, fullGroupMatches, thirdsIds, true);

        // Interleave official KNOCKOUT results so winners progress automatically
        Object.keys(ko).forEach(id => {
            const om = officialMatches[id];
            if (om) {
                ko[id].score.homeGoals = om.home_goals;
                ko[id].score.awayGoals = om.away_goals;
                ko[id].score.homePenalties = om.home_penalties;
                ko[id].score.awayPenalties = om.away_penalties;
                ko[id].status = (om.home_goals !== null && om.away_goals !== null) ? 'FINISHED' : 'NOT_PLAYED';
            }
        });

        // Second pass: force bracket recalculation so the R16 -> Finals pull from official matches
        ko = updateKnockoutBracket(ko, fullGroupMatches, thirdsIds, true);
        setResolvedKo(ko);
    }, [officialMatches]);

    const saveMatch = async (matchId: string) => {
        const row = officialMatches[matchId];
        if (!row) return;
        setSaving(matchId);
        const { error } = await supabase.from('official_matches').upsert({
            match_id: matchId, home_goals: row.home_goals, away_goals: row.away_goals,
            home_penalties: row.home_penalties ?? null, away_penalties: row.away_penalties ?? null,
            went_to_pens: row.went_to_pens ?? false,
            status: (row.home_goals !== null && row.away_goals !== null) ? 'FINISHED' : 'NOT_PLAYED',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'match_id' });
        setSaving(null);
        if (!error) flashSaved(matchId);
        showToast(error ? `❌ ${error.message}` : `✅ ${matchId.toUpperCase()} saved!`);
    };

    const saveAward = async (category: string) => {
        setSaving(category);
        const { error } = await supabase.from('official_awards').upsert(
            { category, value: officialAwards[category] ?? '', updated_at: new Date().toISOString() },
            { onConflict: 'category' }
        );
        
        if (!error) {
            await scoreAwards();
            flashSaved(category);
        }

        setSaving(null);
        showToast(error ? `❌ ${error.message}` : `✅ Award saved & users scored!`);
    };


    // ── Save all XI + auto-score ──────────────────────────
    const saveAllXI = async () => {
        setSaving('xi_all');
        const rows = XI_SLOTS
            .filter(s => officialXI[s.key]?.trim())
            .map(s => ({ position: s.key, player_name: officialXI[s.key].trim(), updated_at: new Date().toISOString() }));

        const { error } = await supabase.from('official_tournament_xi').upsert(rows, { onConflict: 'position' });
        if (error) { setSaving(null); showToast(`❌ ${error.message}`); return; }

        setXiScoring('⏳ Calculating scores…');
        const { usersScored, error: scoreErr } = await scoreXI();
        setXiScoring(null);
        setSaving(null);
        flashSaved('xi_all');
        showToast(scoreErr
            ? `❌ Saved but scoring failed: ${scoreErr}`
            : `✅ XI saved & ${usersScored} user${usersScored !== 1 ? 's' : ''} scored!`);
    };

    const resetAllResults = async () => {
        setSaving('reset');
        const { error } = await supabase.from('official_matches').delete().neq('match_id', '__never__');
        if (!error) setOfficialMatches({});
        setSaving(null);
        setConfirmReset(false);
        showToast(error ? `❌ ${error.message}` : `🗑️ All match results cleared!`);
    };

    const toggleLock = async () => {
        setSaving('lock');
        // If it's already locked, push lock to 2050. If open, set lock to past date (2000).
        const newDateStr = isLocked ? '2050-01-01T00:00:00Z' : '2000-01-01T00:00:00Z';
        const { error } = await updateLockDate(newDateStr);
        setSaving(null);
        showToast(error ? `❌ ${error}` : `✅ Predictions ${isLocked ? 'Unlocked' : 'Locked'}`);
    };

    const setMatchField = (matchId: string, field: keyof OfficialMatch, value: string | boolean | number | null) => {
        setOfficialMatches(prev => ({
            ...prev,
            [matchId]: { ...(prev[matchId] ?? EMPTY_ROW(matchId)), [field]: value },
        }));
    };

    const activeKoMatches = KO_ROUNDS.find(r => r.key === activeKoRound)?.matches ?? [];

    return (
        <div className="admin-view fade-in">
            {toast && <div className="admin-toast">{toast}</div>}

            <header className="admin-header glass-panel">
                <h2 className="text-gradient">⚙️ Master Admin</h2>
                <p>Enter official match results and award winners. Only you can see and edit this.</p>
                <div className="admin-section-tabs">
                    <button className={`admin-sec-btn ${section === 'group'    ? 'active' : ''}`} onClick={() => setSection('group')}>⚽ Group Stage</button>
                    <button className={`admin-sec-btn ${section === 'knockout' ? 'active' : ''}`} onClick={() => setSection('knockout')}>🏆 Knockout Rounds</button>
                    <button className={`admin-sec-btn ${section === 'awards'   ? 'active' : ''}`} onClick={() => setSection('awards')}>🎖️ Awards</button>
                    <button className={`admin-sec-btn ${section === 'xi'       ? 'active' : ''}`} onClick={() => setSection('xi')}>👕 Tournament XI</button>
                    <div className="admin-reset-area">
                        <button 
                            className={`admin-lock-btn ${isLocked ? 'locked' : 'unlocked'}`}
                            onClick={toggleLock}
                            disabled={saving === 'lock'}
                            title={isLocked ? "Unlock predictions (test mode)" : "Lock predictions immediately"}
                        >
                            {saving === 'lock' ? '…' : isLocked ? '🔓 Un-Lock' : '🔒 Lock Users!'}
                        </button>

                        <button 
                            className={`admin-lock-btn ${isEaseModeEnabled ? 'unlocked' : 'locked'}`}
                            style={{ marginLeft: '0.5rem' }}
                            onClick={() => updateEaseMode(!isEaseModeEnabled)}
                            title={isEaseModeEnabled ? "Deactivate Ease Mode globally" : "Activate Ease Mode globally"}
                        >
                            {isEaseModeEnabled ? '⚡ Ease ON' : '🎯 Ease OFF'}
                        </button>
                        
                        {!confirmReset ? (
                            <button className="admin-reset-btn" onClick={() => setConfirmReset(true)} disabled={saving === 'reset'}>
                                🗑️ Reset All Results
                            </button>
                        ) : (
                            <div className="admin-reset-confirm">
                                <span>Are you sure? This deletes all match results.</span>
                                <button className="admin-reset-confirm-yes" onClick={resetAllResults} disabled={saving === 'reset'}>
                                    {saving === 'reset' ? '…' : '✓ Yes, reset'}
                                </button>
                                <button className="admin-reset-confirm-no" onClick={() => setConfirmReset(false)}>
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── GROUP STAGE ─────────────────────────────────── */}
            {section === 'group' && (
                <div className="admin-matches">
                    <div className="admin-group-tabs">
                        {groups.map(g => (
                            <button key={g} className={`admin-group-btn ${activeGroup === g ? 'active' : ''}`} onClick={() => setActiveGroup(g)}>
                                Group {g}
                            </button>
                        ))}
                    </div>
                    <div className="admin-match-list">
                        {(matchesByGroup[activeGroup] ?? []).map(({ id, homeId, awayId }) => {
                            const row = officialMatches[id] ?? EMPTY_ROW(id);
                            return (
                                <MatchRow key={id} id={id} label={id.toUpperCase()}
                                    homeLabel={teamName(homeId)} awayLabel={teamName(awayId)}
                                    row={row} hasPens={false} saving={saving} isSavedData={!!savedQueue[id]}
                                    onChange={(f, v) => setMatchField(id, f, v)}
                                    onSave={() => saveMatch(id)} />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── KNOCKOUT ROUNDS ──────────────────────────────── */}
            {section === 'knockout' && (
                <div className="admin-matches">
                    <div className="admin-group-tabs">
                        {KO_ROUNDS.map(r => (
                            <button key={r.key} className={`admin-group-btn ${activeKoRound === r.key ? 'active' : ''}`} onClick={() => setActiveKoRound(r.key)}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <p className="admin-ko-hint">
                        Slot labels show bracket position (e.g. <strong>W.73</strong> = winner of Match 73, <strong>RU_A</strong> = runner-up Group A). Enter the actual score once the match is played. A penalty section appears automatically when scores are tied.
                    </p>
                    <div className="admin-match-list">
                        {activeKoMatches.map(({ id, label, homeSlot, awaySlot }) => {
                            const row = officialMatches[id] ?? EMPTY_ROW(id);
                            
                            // Dynamic Bracket Auto-fills
                            const koInfo = resolvedKo[id];
                            const resolvedHome = koInfo?.homeTeamId && koInfo.homeTeamId !== 'TBD' ? teamName(koInfo.homeTeamId) : homeSlot;
                            const resolvedAway = koInfo?.awayTeamId && koInfo.awayTeamId !== 'TBD' ? teamName(koInfo.awayTeamId) : awaySlot;

                            return (
                                <MatchRow key={id} id={id} label={label}
                                    homeLabel={resolvedHome} awayLabel={resolvedAway}
                                    row={row} hasPens saving={saving} isSavedData={!!savedQueue[id]}
                                    onChange={(f, v) => setMatchField(id, f, v)}
                                    onSave={() => saveMatch(id)} />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── AWARDS ──────────────────────────────────────── */}
            {section === 'awards' && (
                <div className="admin-awards-list">
                    {AWARD_CATEGORIES.map(({ key, label, icon }) => (
                        <div key={key} className="admin-award-card glass-panel">
                            <span className="admin-award-icon">{icon}</span>
                            <span className="admin-award-label">{label}</span>
                            <input type="text" className="admin-award-input" placeholder="Official winner…"
                                value={officialAwards[key] ?? ''}
                                onChange={e => setOfficialAwards(prev => ({ ...prev, [key]: e.target.value }))} />
                            <button 
                                className={`admin-save-btn ${savedQueue[key] ? 'admin-save-btn--saved' : ''}`} 
                                onClick={() => saveAward(key)} 
                                disabled={saving === key}
                            >
                                {saving === key ? '…' : savedQueue[key] ? '✓ Saved' : 'Save'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ── TOURNAMENT XI ────────────────────────────────── */}
            {section === 'xi' && (
                <div className="admin-xi">
                    <div className="admin-xi-header">
                        <div>
                            <h3>Official Tournament XI</h3>
                            <p className="admin-ko-hint">
                                Enter 1 Goalkeeper + 10 field players. Name matching is <strong>accent-insensitive</strong> — "Mbappé" matches "Mbappe". Click <strong>Save All &amp; Score</strong> to persist and instantly recalculate all user points.
                            </p>
                        </div>
                        <div className="admin-xi-actions">
                            {xiScoring && <span className="xi-scoring-status">{xiScoring}</span>}
                            <button
                                className={`admin-save-btn admin-save-btn--large ${savedQueue['xi_all'] ? 'admin-save-btn--saved' : ''}`}
                                onClick={saveAllXI}
                                disabled={saving === 'xi_all'}
                            >
                                {saving === 'xi_all' ? '…' : savedQueue['xi_all'] ? '✓ Saved & Scored!' : '💾 Save All & Score'}
                            </button>
                        </div>
                    </div>

                    <div className="admin-xi-list">
                        {XI_SLOTS.map(({ key, label, isGK }) => (
                            <div key={key} className={`admin-xi-row glass-panel ${isGK ? 'admin-xi-row--gk' : ''}`}>
                                <span className={`admin-xi-badge ${isGK ? 'badge-gk' : 'badge-fp'}`}>
                                    {isGK ? '🧤' : '👕'}
                                </span>
                                <span className="admin-xi-label">{label}</span>
                                <input
                                    type="text"
                                    className="admin-award-input admin-xi-input"
                                    placeholder={isGK ? 'Goalkeeper name…' : 'Player name…'}
                                    value={officialXI[key] ?? ''}
                                    onChange={e => setOfficialXI(prev => ({ ...prev, [key]: e.target.value }))}
                                />
                                <span className={`admin-xi-pts ${isGK ? 'pts-gk' : 'pts-fp'}`}>
                                    {isGK ? '5 pts' : '3 pts'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


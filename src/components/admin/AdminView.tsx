import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { initialTeams, groups, generateInitialGroupMatches, GROUP_MATCH_SCHEDULE_DATA, EREDIVISIE_TEAMS, generateEredivisieMatches } from '../../utils/data-init';
import {
    R32_FIXTURES, R16_FIXTURES, QF_FIXTURES, SF_FIXTURES,
    THIRD_PLACE_FIXTURE, FINAL_FIXTURE
} from '../../utils/bracket-logic';
import { scoreAwards } from '../../lib/scoreAwards';
import { scoreXI } from '../../lib/scoreXI';
import { scoreMatches } from '../../lib/scoreMatches';
import { scoreKnockout } from '../../lib/scoreKnockout';
import { scoreEredivisie } from '../../lib/scoreEredivisie';
import { fetchTournamentResults } from '../../lib/footballDataApi';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import type { LockCategory } from '../../context/AuthContext';
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
    date?: string | null;
    locked_at?: string | null;
}

interface OfficialAward {
    category: string;
    value: string;
}

// ── Utilities ─────────────────────────────────────────────
const teamName = (id: string) => initialTeams.find(t => t.id === id)?.name ?? id;
const allGroupMatches = generateInitialGroupMatches();
const allEredivisieMatches = generateEredivisieMatches();

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
    const { isLocked, updateLockDate, isEaseModeEnabled, updateEaseMode, categoryLocks, setCategoryLock, clearCategoryLock, isTestModeEnabled, toggleTestMode } = useAuth();
    const { resetPredictions } = useApp();
    
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
    const [eredivisieOfficial, setEredivisieOfficial] = useState<Record<string, { home_goals: number | null; away_goals: number | null }>>({});
    const [apiLoading, setApiLoading] = useState(false);
    const [apiStatus, setApiStatus] = useState<string | null>(null);
    const [apiLastCheck, setApiLastCheck] = useState<string | null>(null);
    const [autoFetchEnabled, setAutoFetchEnabled] = useState(false);
    const [nextFetchIn, setNextFetchIn] = useState<number | null>(null);

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
        const { data: eData } = await supabase.from('official_eredivisie').select('*');
        if (eData) {
            const map: Record<string, { home_goals: number | null; away_goals: number | null }> = {};
            (eData as any[]).forEach(r => { map[r.match_id] = { home_goals: r.home_goals, away_goals: r.away_goals }; });
            setEredivisieOfficial(map);
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
        
        if (!error) {
            await scoreMatches();
            await scoreKnockout();
            flashSaved(matchId);
        }

        setSaving(null);
        showToast(error ? `❌ ${error.message}` : `✅ ${matchId.toUpperCase()} saved & users scored!`);
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

        try {
            await resetPredictions();
            setOfficialMatches({});
            setOfficialAwards({});
            setOfficialXI({});
            setConfirmReset(false);
            showToast('🗑️ Tournament reset complete! All predictions and scores cleared.');
        } catch (err: any) {
            showToast(`❌ Reset failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setSaving(null);
        }
    };

    const toggleLock = async () => {
        setSaving('lock');
        const newDateStr = isLocked ? '2050-01-01T00:00:00Z' : '2000-01-01T00:00:00Z';
        const { error } = await updateLockDate(newDateStr);
        setSaving(null);
        showToast(error ? `❌ ${error}` : `✅ Predictions ${isLocked ? 'Unlocked' : 'Locked'}`);
    };

    const handleToggleCategoryLock = async (cat: LockCategory) => {
        setSaving(`cat_${cat}`);
        const result = categoryLocks[cat] ? await clearCategoryLock(cat) : await setCategoryLock(cat);
        setSaving(null);
        showToast(result.error ? `❌ ${result.error}` : `✅ ${cat.replace(/_/g, ' ')} ${categoryLocks[cat] ? 'unlocked' : 'locked'}`);
    };

    const setMatchField = (matchId: string, field: keyof OfficialMatch, value: string | boolean | number | null) => {
        setOfficialMatches(prev => ({
            ...prev,
            [matchId]: { ...(prev[matchId] ?? EMPTY_ROW(matchId)), [field]: value },
        }));
    };

    const eredivisieTeamName = (id: string) => EREDIVISIE_TEAMS.find(t => t.id === id)?.name ?? id;

    const setEredivisieResult = (matchId: string, type: 'home' | 'away', val: string) => {
        const num = val === '' ? null : parseInt(val, 10);
        if (val !== '' && (isNaN(num!) || num! < 0)) return;
        setEredivisieOfficial(prev => {
            const existing = prev[matchId] ?? { home_goals: null, away_goals: null };
            return {
                ...prev,
                [matchId]: {
                    ...existing,
                    [type === 'home' ? 'home_goals' : 'away_goals']: num,
                }
            };
        });
    };

    const saveEredivisieResult = async (matchId: string) => {
        const row = eredivisieOfficial[matchId];
        if (!row) return;
        setSaving(`eredivisie_${matchId}`);
        const { error } = await supabase.from('official_eredivisie').upsert({
            match_id: matchId,
            home_goals: row.home_goals,
            away_goals: row.away_goals,
            status: (row.home_goals !== null && row.away_goals !== null) ? 'FINISHED' : 'NOT_PLAYED',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'match_id' });

        if (!error) {
            if (row.home_goals === null && row.away_goals === null) {
                await supabase.from('user_predictions_eredivisie')
                    .update({ pts_earned: 0 })
                    .eq('match_id', matchId);
            }
            await scoreEredivisie();
            flashSaved(`eredivisie_${matchId}`);
            window.dispatchEvent(new Event('leaderboard-refresh'));
        }

        setSaving(null);
        showToast(error ? `❌ ${error.message}` : `✅ ${matchId.toUpperCase()} saved & users scored!`);
    };

    const fetchApiResults = async () => {
        setApiLoading(true);
        setApiStatus('Fetching…');
        try {
            const result = await fetchTournamentResults(
                '2026-06-11',
                new Date().toISOString().substring(0, 10)
            );
            setApiLastCheck(new Date().toLocaleTimeString());

            if (result.success && result.updated > 0) {
                await loadData();
                await scoreMatches();
                await scoreKnockout();
                window.dispatchEvent(new Event('leaderboard-refresh'));

                let statusMsg = `Updated ${result.updated} match(es)`;
                if (result.groupMatches) statusMsg += ` (${result.groupMatches} group)`;
                if (result.knockoutMatches) statusMsg += ` (${result.knockoutMatches} KO)`;

                if (result.skippedKnockouts && result.skippedKnockouts.length > 0) {
                    const skNames = result.skippedKnockouts
                        .map(s => `${s.home} vs ${s.away}`)
                        .join(', ');
                    statusMsg += ` — Auto-mapping required for: ${skNames}`;
                    showToast(`⚠️ Some knockout matches could not be auto-mapped. Check bracket manually.`);
                } else {
                    showToast(`✅ ${result.updated} matches updated & scored!`);
                }

                setApiStatus(statusMsg);
            } else if (result.success && result.updated === 0) {
                setApiStatus('No new finished matches');
            } else {
                setApiStatus(result.message);
            }
        } catch {
            setApiStatus('API call failed');
        }
        setApiLoading(false);
    };

    // ── Auto-Fetch Poller (July 10 00:00 → July 20 23:59 UTC) ──
    const AUTO_FETCH_MS = 10 * 60 * 1000;
    const FETCH_WINDOW_START = new Date('2026-07-10T00:00:00Z').getTime();
    const FETCH_WINDOW_END = new Date('2026-07-20T23:59:59Z').getTime();

    const fetchRef = React.useRef(fetchApiResults);
    useEffect(() => { fetchRef.current = fetchApiResults; });

    useEffect(() => {
        if (!autoFetchEnabled) {
            setNextFetchIn(null);
            return;
        }
        const now = Date.now();
        if (now < FETCH_WINDOW_START || now > FETCH_WINDOW_END) {
            setNextFetchIn(null);
            return;
        }
        setNextFetchIn(AUTO_FETCH_MS / 1000);

        const countdown = setInterval(() => {
            setNextFetchIn(prev => prev !== null && prev > 0 ? prev - 1 : null);
        }, 1000);

        const poller = setInterval(async () => {
            if (document.visibilityState !== 'visible') return;
            await fetchRef.current();
            setNextFetchIn(AUTO_FETCH_MS / 1000);
        }, AUTO_FETCH_MS);

        return () => {
            clearInterval(countdown);
            clearInterval(poller);
        };
    }, [autoFetchEnabled]);

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

                        <div className="admin-category-locks">
                            <span className="admin-category-locks-label">Locks:</span>
                            {(['GROUP_STAGE', 'BRACKET', 'AWARDS', 'TOURNAMENT_XI'] as LockCategory[]).map(cat => {
                                const isCatLocked = categoryLocks[cat];
                                const catSaving = saving === `cat_${cat}`;
                                return (
                                    <button
                                        key={cat}
                                        className={`admin-cat-lock-btn ${isCatLocked ? 'locked' : 'unlocked'}`}
                                        onClick={() => handleToggleCategoryLock(cat)}
                                        disabled={catSaving}
                                        title={isCatLocked ? `Unlock ${cat.replace(/_/g, ' ').toLowerCase()}` : `Lock ${cat.replace(/_/g, ' ').toLowerCase()}`}
                                    >
                                        {catSaving ? '…' : isCatLocked ? '🔒' : '🔓'} {cat === 'GROUP_STAGE' ? 'Group' : cat === 'BRACKET' ? 'Bracket' : cat === 'AWARDS' ? 'Awards' : 'XI'}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="admin-api-area">
                            <button
                                className="admin-api-btn"
                                onClick={fetchApiResults}
                                disabled={apiLoading}
                                title="Fetch World Cup results from football-data.org API"
                            >
                                {apiLoading ? '⏳' : '🔄'} Fetch Live Results
                            </button>
                            {apiStatus && <span className="admin-api-status">{apiStatus}</span>}
                            {apiLastCheck && <span className="admin-api-time">Last check: {apiLastCheck}</span>}
                        </div>

                        <div className="admin-auto-fetch">
                            <label className="auto-fetch-toggle">
                                <input
                                    type="checkbox"
                                    checked={autoFetchEnabled}
                                    onChange={e => setAutoFetchEnabled(e.target.checked)}
                                />
                                <span className="toggle-slider" />
                                <span className="auto-fetch-label">
                                    {autoFetchEnabled ? '🟢 Auto-fetch active' : '⚪ Auto-fetch off'}
                                </span>
                            </label>
                            {autoFetchEnabled && nextFetchIn !== null && (
                                <span className="auto-fetch-countdown">
                                    Next fetch: {Math.floor(nextFetchIn / 60)}m {nextFetchIn % 60}s
                                </span>
                            )}
                        </div>

                        {!confirmReset ? (
                            <button className="admin-reset-btn" onClick={() => setConfirmReset(true)} disabled={saving === 'reset'}>
                                🗑️ Reset Tournament
                            </button>
                        ) : (
                            <div className="admin-reset-confirm">
                                <span>Are you sure? This deletes ALL predictions, results, and resets ALL scores.</span>
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

            {/* ── EREDIVISIE TEST MODE ADMIN ── */}
            <div className="admin-eredivisie-section glass-panel">
                <div className="admin-eredivisie-header">
                    <h3>🧪 Eredivisie Test Mode</h3>
                    <button
                        className={`admin-eredivisie-toggle ${isTestModeEnabled ? 'enabled' : 'disabled'}`}
                        onClick={async () => {
                            setSaving('test_toggle');
                            const { error } = await toggleTestMode();
                            setSaving(null);
                            showToast(error ? `❌ ${error}` : `✅ Test mode ${isTestModeEnabled ? 'disabled' : 'enabled'}`);
                        }}
                        disabled={saving === 'test_toggle'}
                    >
                        {saving === 'test_toggle' ? '…' : isTestModeEnabled ? '🟢 Enabled' : '⚫ Disabled'}
                    </button>
                </div>

                <p className="admin-ko-hint">
                    Enter official Eredivisie results for matchdays 33-34. Once saved, user predictions are automatically scored (5 pts exact score, 2 pts correct winner).
                </p>

                <div className="admin-eredivisie-results">
                    <div className="admin-eredivisie-md">
                        <h4>📅 Matchday 33 — May 10, 2026</h4>
                        {['e01', 'e02', 'e03', 'e04', 'e05', 'e06', 'e07', 'e08', 'e09'].map(matchId => {
                            const match = allEredivisieMatches[matchId];
                            if (!match) return null;
                            const om = eredivisieOfficial[matchId];
                            return (
                                <div key={matchId} className="admin-eredivisie-row">
                                    <span className="admin-eredivisie-match-id">{matchId.toUpperCase()}</span>
                                    <span className="admin-eredivisie-teams">
                                        {eredivisieTeamName(match.homeTeamId)} vs {eredivisieTeamName(match.awayTeamId)}
                                    </span>
                                    <div className="admin-score-inputs">
                                        <input type="number" min="0" max="20" className="score-input"
                                            value={om?.home_goals ?? ''} placeholder="—"
                                            onChange={e => setEredivisieResult(matchId, 'home', e.target.value)} />
                                        <span className="score-sep">:</span>
                                        <input type="number" min="0" max="20" className="score-input"
                                            value={om?.away_goals ?? ''} placeholder="—"
                                            onChange={e => setEredivisieResult(matchId, 'away', e.target.value)} />
                                    </div>
                                    <button
                                        className={`admin-save-btn ${savedQueue[`eredivisie_${matchId}`] ? 'admin-save-btn--saved' : ''}`}
                                        onClick={() => saveEredivisieResult(matchId)}
                                        disabled={saving === `eredivisie_${matchId}`}
                                    >
                                        {saving === `eredivisie_${matchId}` ? '…' : savedQueue[`eredivisie_${matchId}`] ? '✓ Saved' : 'Save'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="admin-eredivisie-md">
                        <h4>📅 Matchday 34 — May 17, 2026</h4>
                        {['e10', 'e11', 'e12', 'e13', 'e14', 'e15', 'e16', 'e17', 'e18'].map(matchId => {
                            const match = allEredivisieMatches[matchId];
                            if (!match) return null;
                            const om = eredivisieOfficial[matchId];
                            return (
                                <div key={matchId} className="admin-eredivisie-row">
                                    <span className="admin-eredivisie-match-id">{matchId.toUpperCase()}</span>
                                    <span className="admin-eredivisie-teams">
                                        {eredivisieTeamName(match.homeTeamId)} vs {eredivisieTeamName(match.awayTeamId)}
                                    </span>
                                    <div className="admin-score-inputs">
                                        <input type="number" min="0" max="20" className="score-input"
                                            value={om?.home_goals ?? ''} placeholder="—"
                                            onChange={e => setEredivisieResult(matchId, 'home', e.target.value)} />
                                        <span className="score-sep">:</span>
                                        <input type="number" min="0" max="20" className="score-input"
                                            value={om?.away_goals ?? ''} placeholder="—"
                                            onChange={e => setEredivisieResult(matchId, 'away', e.target.value)} />
                                    </div>
                                    <button
                                        className={`admin-save-btn ${savedQueue[`eredivisie_${matchId}`] ? 'admin-save-btn--saved' : ''}`}
                                        onClick={() => saveEredivisieResult(matchId)}
                                        disabled={saving === `eredivisie_${matchId}`}
                                    >
                                        {saving === `eredivisie_${matchId}` ? '…' : savedQueue[`eredivisie_${matchId}`] ? '✓ Saved' : 'Save'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── DANGER ZONE: Manual Match Lock Override ── */}
            <div className="danger-zone-wrapper">
                <div className="danger-zone-header">
                    <div className="danger-zone-icon">🚨</div>
                    <div className="danger-zone-title">
                        <h3>Manual Match Lock Override</h3>
                        <span className="danger-zone-badge">DANGER ZONE</span>
                    </div>
                </div>

                <div className="danger-zone-description">
                    <span className="danger-rule-badge">SUPREME RULE</span>
                    Once a match enters the <strong>1-hour window</strong> before kickoff, the time-based lock <strong>cannot</strong> be manually overridden.
                </div>

                <div className="danger-match-grid">
                    {Object.keys(allGroupMatches).sort((a, b) => {
                        const aNum = parseInt(a.replace('m', ''));
                        const bNum = parseInt(b.replace('m', ''));
                        const aDate = GROUP_MATCH_SCHEDULE_DATA[aNum]?.date ?? '9999';
                        const bDate = GROUP_MATCH_SCHEDULE_DATA[bNum]?.date ?? '9999';
                        return aDate.localeCompare(bDate);
                    }).map(matchId => {
                        const match = allGroupMatches[matchId];
                        const om = officialMatches[matchId];
                        const isLocked = om?.locked_at != null;
                        const matchDate = om?.date 
                            ? new Date(om.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                            : 'TBD';
                        const matchTime = om?.date
                            ? new Date(om.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                            : '';
                        const homeTeam = initialTeams.find(t => t.id === match.homeTeamId);
                        const awayTeam = initialTeams.find(t => t.id === match.awayTeamId);
                        const isSaving = saving === `danger_lock_${matchId}` || saving === `danger_unlock_${matchId}`;

                        return (
                            <div
                                key={matchId}
                                className={`danger-match-card ${isLocked ? 'locked' : 'unlocked'}`}
                            >
                                <div className="danger-match-top">
                                    <span className="danger-match-id">{matchId.toUpperCase()}</span>
                                    <span className={`danger-match-status ${isLocked ? 'locked' : 'unlocked'}`}>
                                        {isLocked ? '🔒 Locked' : '🔓 Unlocked'}
                                    </span>
                                </div>

                                <div className="danger-match-teams">
                                    <div className="danger-match-team">
                                        <img
                                            src={`${import.meta.env.BASE_URL}flags/${homeTeam?.code ?? 'TBD'}.svg`}
                                            className="danger-team-flag"
                                            alt=""
                                        />
                                        <span className="danger-team-name">{homeTeam?.name ?? 'TBD'}</span>
                                    </div>
                                    <span className="danger-match-vs">vs</span>
                                    <div className="danger-match-team">
                                        <span className="danger-team-name">{awayTeam?.name ?? 'TBD'}</span>
                                        <img
                                            src={`${import.meta.env.BASE_URL}flags/${awayTeam?.code ?? 'TBD'}.svg`}
                                            className="danger-team-flag"
                                            alt=""
                                        />
                                    </div>
                                </div>

                                <div className="danger-match-meta">
                                    <span className="danger-match-date">{matchDate}</span>
                                    {matchTime && <span className="danger-match-time">{matchTime}</span>}
                                </div>

                                <div className="danger-match-actions">
                                    {isLocked ? (
                                        <button
                                            className="danger-action-btn unlock"
                                            onClick={async () => {
                                                setSaving(`danger_unlock_${matchId}`);
                                                const { data, error } = await supabase.rpc('set_match_lock', { _match_id: matchId, lock_state: false });
                                                if (error) showToast(`❌ ${error.message}`);
                                                else if (data?.[0]) showToast(data[0].success ? `✅ ${data[0].message}` : `❌ ${data[0].message}`);
                                                setSaving(null);
                                                loadData();
                                            }}
                                            disabled={!!isSaving}
                                            title="Remove manual lock"
                                        >
                                            {saving === `danger_unlock_${matchId}` ? '…' : 'Unlock'}
                                        </button>
                                    ) : (
                                        <button
                                            className="danger-action-btn lock"
                                            onClick={async () => {
                                                setSaving(`danger_lock_${matchId}`);
                                                const { data, error } = await supabase.rpc('set_match_lock', { _match_id: matchId, lock_state: true });
                                                if (error) showToast(`❌ ${error.message}`);
                                                else if (data?.[0]) showToast(data[0].success ? `✅ ${data[0].message}` : `❌ ${data[0].message}`);
                                                setSaving(null);
                                                loadData();
                                            }}
                                            disabled={!!isSaving}
                                            title="Lock match immediately"
                                        >
                                            {saving === `danger_lock_${matchId}` ? '…' : 'Lock Now'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Knockout Stage ── */}
                <div className="danger-match-section">
                    <div className="danger-section-header">🏆 Knockout Stage</div>
                    <div className="danger-match-grid">
                        {KO_ROUNDS.flatMap(round =>
                            round.matches.map(m => ({
                                matchId: m.id,
                                label: m.label,
                                date: officialMatches[m.id]?.date ?? null,
                                homeSlot: m.homeSlot,
                                awaySlot: m.awaySlot,
                                homeTeamId: resolvedKo[m.id]?.homeTeamId,
                                awayTeamId: resolvedKo[m.id]?.awayTeamId,
                            }))
                        ).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).map(k => {
                            const om = officialMatches[k.matchId];
                            const isLocked = om?.locked_at != null;
                            const matchDate = k.date
                                ? new Date(k.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                : 'TBD';
                            const matchTime = k.date
                                ? new Date(k.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                : '';
                            const isSaving = saving === `danger_lock_${k.matchId}` || saving === `danger_unlock_${k.matchId}`;

                            const resolvedHome = k.homeTeamId && k.homeTeamId !== 'TBD'
                                ? (initialTeams.find(t => t.id === k.homeTeamId)?.name ?? teamName(k.homeTeamId))
                                : k.homeSlot;
                            const resolvedAway = k.awayTeamId && k.awayTeamId !== 'TBD'
                                ? (initialTeams.find(t => t.id === k.awayTeamId)?.name ?? teamName(k.awayTeamId))
                                : k.awaySlot;

                            const homeCode = k.homeTeamId && k.homeTeamId !== 'TBD'
                                ? initialTeams.find(t => t.id === k.homeTeamId)?.code : null;
                            const awayCode = k.awayTeamId && k.awayTeamId !== 'TBD'
                                ? initialTeams.find(t => t.id === k.awayTeamId)?.code : null;

                            return (
                                <div
                                    key={k.matchId}
                                    className={`danger-match-card ${isLocked ? 'locked' : 'unlocked'}`}
                                >
                                    <div className="danger-match-top">
                                        <span className="danger-match-id">{k.matchId.toUpperCase()}</span>
                                        <span className={`danger-match-status ${isLocked ? 'locked' : 'unlocked'}`}>
                                            {isLocked ? '🔒 Locked' : '🔓 Unlocked'}
                                        </span>
                                    </div>

                                    <div className="danger-match-teams">
                                        <div className="danger-match-team">
                                            {homeCode && (
                                                <img src={`${import.meta.env.BASE_URL}flags/${homeCode}.svg`} className="danger-team-flag" alt="" />
                                            )}
                                            <span className="danger-team-name">{resolvedHome}</span>
                                        </div>
                                        <span className="danger-match-vs">vs</span>
                                        <div className="danger-match-team">
                                            <span className="danger-team-name">{resolvedAway}</span>
                                            {awayCode && (
                                                <img src={`${import.meta.env.BASE_URL}flags/${awayCode}.svg`} className="danger-team-flag" alt="" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="danger-match-meta">
                                        <span className="danger-match-date">{matchDate}</span>
                                        {matchTime && <span className="danger-match-time">{matchTime}</span>}
                                    </div>

                                    <div className="danger-match-actions">
                                        {isLocked ? (
                                            <button
                                                className="danger-action-btn unlock"
                                                onClick={async () => {
                                                    setSaving(`danger_unlock_${k.matchId}`);
                                                    const { data, error } = await supabase.rpc('set_match_lock', { _match_id: k.matchId, lock_state: false });
                                                    if (error) showToast(`❌ ${error.message}`);
                                                    else if (data?.[0]) showToast(data[0].success ? `✅ ${data[0].message}` : `❌ ${data[0].message}`);
                                                    setSaving(null);
                                                    loadData();
                                                }}
                                                disabled={!!isSaving}
                                                title="Remove manual lock"
                                            >
                                                {saving === `danger_unlock_${k.matchId}` ? '…' : 'Unlock'}
                                            </button>
                                        ) : (
                                            <button
                                                className="danger-action-btn lock"
                                                onClick={async () => {
                                                    setSaving(`danger_lock_${k.matchId}`);
                                                    const { data, error } = await supabase.rpc('set_match_lock', { _match_id: k.matchId, lock_state: true });
                                                    if (error) showToast(`❌ ${error.message}`);
                                                    else if (data?.[0]) showToast(data[0].success ? `✅ ${data[0].message}` : `❌ ${data[0].message}`);
                                                    setSaving(null);
                                                    loadData();
                                                }}
                                                disabled={!!isSaving}
                                                title="Lock match immediately"
                                            >
                                                {saving === `danger_lock_${k.matchId}` ? '…' : 'Lock Now'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <p className="danger-zone-footer">
                    All manual actions are logged to the <code>audit_log</code> table for security compliance.
                </p>
            </div>
        </div>
    );
};


import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { initialTeams, groups, generateInitialGroupMatches } from '../../utils/data-init';
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

// Group match entries grouped by group letter
const matchesByGroup: Record<string, { id: string; homeId: string; awayId: string }[]> = {};
Object.entries(allGroupMatches).forEach(([id, m]) => {
    const g = m.group ?? '?';
    if (!matchesByGroup[g]) matchesByGroup[g] = [];
    matchesByGroup[g].push({ id, homeId: m.homeTeamId, awayId: m.awayTeamId });
});

const AWARD_CATEGORIES = [
    { key: 'goldenBall',     label: 'Golden Ball (MVP)',         icon: '🏆' },
    { key: 'silverBall',     label: 'Silver Ball',               icon: '🥈' },
    { key: 'bronzeBall',     label: 'Bronze Ball',               icon: '🥉' },
    { key: 'goldenBoot',     label: 'Golden Boot (Top Scorer)',  icon: '⚽' },
    { key: 'silverBoot',     label: 'Silver Boot',               icon: '👟' },
    { key: 'bronzeBoot',     label: 'Bronze Boot',               icon: '👞' },
    { key: 'goldenGlove',    label: 'Golden Glove (Best GK)',    icon: '🧤' },
    { key: 'fifaYoungPlayer',label: 'Young Player Award',        icon: '⭐' },
    { key: 'mostYellowCards',label: 'Most Yellow Cards (Player)',icon: '🟨' },
    { key: 'mostRedCards',   label: 'Most Red Cards (Player)',   icon: '🟥' },
    { key: 'fifaFairPlay',   label: 'Fair Play Award (Team)',    icon: '🤝' },
];

// ── Component ─────────────────────────────────────────────
export const AdminView: React.FC = () => {
    const [section, setSection]           = useState<'matches' | 'awards'>('matches');
    const [activeGroup, setActiveGroup]   = useState<string>(groups[0]);
    const [officialMatches, setOfficialMatches] = useState<Record<string, OfficialMatch>>({});
    const [officialAwards, setOfficialAwards]   = useState<Record<string, string>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [toast, setToast]   = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    // ── Load existing official data on mount ───────────────
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
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Save a single match result ─────────────────────────
    const saveMatch = async (matchId: string) => {
        const row = officialMatches[matchId];
        if (!row) return;
        setSaving(matchId);

        const { error } = await supabase.from('official_matches').upsert({
            match_id:       matchId,
            home_goals:     row.home_goals,
            away_goals:     row.away_goals,
            home_penalties: row.home_penalties ?? null,
            away_penalties: row.away_penalties ?? null,
            went_to_pens:   row.went_to_pens ?? false,
            status:         (row.home_goals !== null && row.away_goals !== null) ? 'FINISHED' : 'NOT_PLAYED',
            updated_at:     new Date().toISOString(),
        }, { onConflict: 'match_id' });

        setSaving(null);
        showToast(error ? `❌ Error: ${error.message}` : `✅ Match ${matchId} saved!`);
    };

    // ── Save a single award ────────────────────────────────
    const saveAward = async (category: string) => {
        setSaving(category);
        const { error } = await supabase.from('official_awards').upsert({
            category,
            value:      officialAwards[category] ?? '',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'category' });

        setSaving(null);
        showToast(error ? `❌ Error: ${error.message}` : `✅ Award saved!`);
    };

    // ── Local state helpers ────────────────────────────────
    const setMatchField = (matchId: string, field: keyof OfficialMatch, value: string | boolean | number | null) => {
        setOfficialMatches(prev => ({
            ...prev,
            [matchId]: { ...(prev[matchId] ?? { match_id: matchId, home_goals: null, away_goals: null, home_penalties: null, away_penalties: null, went_to_pens: false, status: 'NOT_PLAYED' }), [field]: value },
        }));
    };

    // ── Render ─────────────────────────────────────────────
    return (
        <div className="admin-view fade-in">
            {toast && <div className="admin-toast">{toast}</div>}

            <header className="admin-header glass-panel">
                <h2 className="text-gradient">⚙️ Master Admin</h2>
                <p>Enter official match results and award winners here. Only you can see and edit this.</p>
                <div className="admin-section-tabs">
                    <button className={`admin-sec-btn ${section === 'matches' ? 'active' : ''}`} onClick={() => setSection('matches')}>
                        ⚽ Match Results
                    </button>
                    <button className={`admin-sec-btn ${section === 'awards' ? 'active' : ''}`} onClick={() => setSection('awards')}>
                        🏆 Awards
                    </button>
                </div>
            </header>

            {section === 'matches' && (
                <div className="admin-matches">
                    {/* Group selector */}
                    <div className="admin-group-tabs">
                        {groups.map(g => (
                            <button
                                key={g}
                                className={`admin-group-btn ${activeGroup === g ? 'active' : ''}`}
                                onClick={() => setActiveGroup(g)}
                            >
                                Group {g}
                            </button>
                        ))}
                    </div>

                    {/* Match rows for active group */}
                    <div className="admin-match-list">
                        {(matchesByGroup[activeGroup] ?? []).map(({ id, homeId, awayId }) => {
                            const row = officialMatches[id] ?? { match_id: id, home_goals: null, away_goals: null, went_to_pens: false };
                            return (
                                <div key={id} className="admin-match-card glass-panel">
                                    <span className="admin-match-id">{id.toUpperCase()}</span>
                                    <div className="admin-match-teams">
                                        <span className="admin-team">{teamName(homeId)}</span>
                                        <div className="admin-score-inputs">
                                            <input
                                                type="number" min="0" max="20"
                                                className="score-input"
                                                value={row.home_goals ?? ''}
                                                placeholder="—"
                                                onChange={e => setMatchField(id, 'home_goals', e.target.value === '' ? null : parseInt(e.target.value))}
                                            />
                                            <span className="score-sep">:</span>
                                            <input
                                                type="number" min="0" max="20"
                                                className="score-input"
                                                value={row.away_goals ?? ''}
                                                placeholder="—"
                                                onChange={e => setMatchField(id, 'away_goals', e.target.value === '' ? null : parseInt(e.target.value))}
                                            />
                                        </div>
                                        <span className="admin-team">{teamName(awayId)}</span>
                                    </div>
                                    <button
                                        className="admin-save-btn"
                                        onClick={() => saveMatch(id)}
                                        disabled={saving === id}
                                    >
                                        {saving === id ? '…' : 'Save'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {section === 'awards' && (
                <div className="admin-awards-list">
                    {AWARD_CATEGORIES.map(({ key, label, icon }) => (
                        <div key={key} className="admin-award-card glass-panel">
                            <span className="admin-award-icon">{icon}</span>
                            <span className="admin-award-label">{label}</span>
                            <input
                                type="text"
                                className="admin-award-input"
                                placeholder="Official winner…"
                                value={officialAwards[key] ?? ''}
                                onChange={e => setOfficialAwards(prev => ({ ...prev, [key]: e.target.value }))}
                            />
                            <button
                                className="admin-save-btn"
                                onClick={() => saveAward(key)}
                                disabled={saving === key}
                            >
                                {saving === key ? '…' : 'Save'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

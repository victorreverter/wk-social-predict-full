import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { EredivisieScoringPopup, isEredivisieScoringDismissed } from '../eredivisie/EredivisieScoringPopup';
import { UserPredictionsModal } from './UserPredictionsModal';
import './LeaderboardView.css';

interface ProfileData {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    matches_pts: number;
    ko_pts: number;
    awa_pts: number;
    xi_pts: number;
    total: number;
}

interface EredivisieProfileData {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    total: number;
    matches_filled: number;
}

type LeaderboardMode = 'worldcup' | 'eredivisie';

export const LeaderboardView: React.FC = () => {
    const { profile, isTestModeEnabled } = useAuth();

    const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('worldcup');
    const [leaderboard, setLeaderboard] = useState<ProfileData[]>([]);
    const [eredivisieLeaderboard, setEredivisieLeaderboard] = useState<EredivisieProfileData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(0);
    const [showScoringPopup, setShowScoringPopup] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<{ id: string; username: string; avatar: string | null } | null>(null);
    const PAGE_SIZE = 15;
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const loadingRef = useRef(false);

    const isWorldCup = leaderboardMode === 'worldcup';

    const fetchWorldCupLeaderboard = useCallback(async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setError('');
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    id, username, display_name, avatar_url,
                    user_predictions_matches (pts_earned),
                    user_predictions_knockout (pts_earned),
                    user_predictions_awards (pts_earned),
                    user_predictions_xi (pts_earned)
                `);

            if (error) throw error;

            const processed: ProfileData[] = (data || []).map((user: any) => {
                const matches_pts = (user.user_predictions_matches || []).reduce(
                    (acc: number, curr: any) => acc + (curr.pts_earned || 0), 0
                );
                const ko_pts = (user.user_predictions_knockout || []).reduce(
                    (acc: number, curr: any) => acc + (curr.pts_earned || 0), 0
                );
                const awa_pts = (user.user_predictions_awards || []).reduce(
                    (acc: number, curr: any) => acc + (curr.pts_earned || 0), 0
                );
                const xi_pts = (user.user_predictions_xi || []).reduce(
                    (acc: number, curr: any) => acc + (curr.pts_earned || 0), 0
                );

                return {
                    id: user.id,
                    username: user.username,
                    display_name: user.display_name,
                    avatar_url: user.avatar_url,
                    matches_pts,
                    ko_pts,
                    awa_pts,
                    xi_pts,
                    total: matches_pts + ko_pts + awa_pts + xi_pts,
                };
            });

            processed.sort((a, b) => b.total - a.total);
            setLeaderboard(processed);
        } catch (err: any) {
            setError(err.message || 'Failed to load leaderboard data.');
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, []);

    const fetchEredivisieLeaderboard = useCallback(async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setError('');
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    id, username, display_name, avatar_url,
                    user_predictions_eredivisie (pts_earned)
                `);

            if (error) throw error;

            const processed: EredivisieProfileData[] = (data || []).map((user: any) => {
                const predictions = user.user_predictions_eredivisie || [];
                const total = predictions.reduce(
                    (acc: number, curr: any) => acc + (curr.pts_earned || 0), 0
                );
                const matches_filled = predictions.length;

                return {
                    id: user.id,
                    username: user.username,
                    display_name: user.display_name,
                    avatar_url: user.avatar_url,
                    total,
                    matches_filled,
                };
            });

            processed.sort((a, b) => b.total - a.total);
            setEredivisieLeaderboard(processed);
        } catch (err: any) {
            setError(err.message || 'Failed to load leaderboard data.');
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, []);

    useEffect(() => {
        setPage(0);
        setLoading(true);
        if (isWorldCup) {
            fetchWorldCupLeaderboard();
        } else {
            fetchEredivisieLeaderboard();
        }
    }, [leaderboardMode, fetchWorldCupLeaderboard, fetchEredivisieLeaderboard, isWorldCup]);

    useEffect(() => {
        const handleRefresh = () => {
            fetchWorldCupLeaderboard();
            fetchEredivisieLeaderboard();
        };
        window.addEventListener('leaderboard-refresh', handleRefresh);

        const wcTables: string[] = [
            'user_predictions_matches',
            'user_predictions_knockout',
            'user_predictions_awards',
            'user_predictions_xi',
        ];

        let ch = supabase.channel('leaderboard-updates');

        wcTables.forEach(table => {
            ch = ch
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, fetchWorldCupLeaderboard)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, fetchWorldCupLeaderboard)
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, fetchWorldCupLeaderboard);
        });

        ch = ch
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_predictions_eredivisie' }, fetchEredivisieLeaderboard)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_predictions_eredivisie' }, fetchEredivisieLeaderboard)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'user_predictions_eredivisie' }, fetchEredivisieLeaderboard)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
                fetchWorldCupLeaderboard();
                fetchEredivisieLeaderboard();
            })
            .subscribe();

        channelRef.current = ch;

        return () => {
            window.removeEventListener('leaderboard-refresh', handleRefresh);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [fetchWorldCupLeaderboard, fetchEredivisieLeaderboard]);

    const activeData = isWorldCup ? leaderboard : eredivisieLeaderboard;
    const totalColSpan = isWorldCup ? 7 : 4;

    if (loading) {
        return (
            <div className="leaderboard-container fade-in">
                <div className="leaderboard-loader">
                    <span className="spinner">⏳</span>
                    <p>Loading the global rankings...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="leaderboard-container fade-in">
                <div className="leaderboard-error glass-panel">
                    <h3>❌ Error Loading Leaderboard</h3>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="leaderboard-container fade-in">
            <header className="leaderboard-header glass-panel">
                <h2 className="text-gradient">
                    {isWorldCup ? '🏅 Global Leaderboard' : '🧪 Eredivisie Test'}
                </h2>
                <p>
                    {isWorldCup
                        ? 'The ultimate ranking across the entire prediction tournament.'
                        : 'Eredivisie prediction rankings.'}
                </p>
            </header>

            {isTestModeEnabled && (
                <div className="leaderboard-mode-tabs">
                    <button
                        className={`mode-tab ${isWorldCup ? 'active' : ''}`}
                        onClick={() => setLeaderboardMode('worldcup')}
                    >
                        🏆 World Cup
                    </button>
                    <button
                        className={`mode-tab ${!isWorldCup ? 'active' : ''}`}
                        onClick={() => {
                            setLeaderboardMode('eredivisie');
                            if (!isEredivisieScoringDismissed()) {
                                setShowScoringPopup(true);
                            }
                        }}
                    >
                        🧪 Eredivisie
                    </button>
                </div>
            )}

            {!isWorldCup && (
                <div className="eredivisie-help-link">
                    <button
                        className="info-btn"
                        onClick={() => setShowScoringPopup(true)}
                    >
                        ⓘ How points work
                    </button>
                </div>
            )}

            <div className="leaderboard-table-wrap glass-panel">
                <table className="leaderboard-table">
                    <thead>
                        <tr>
                            <th className="th-rank">Rank</th>
                            <th className="th-user">Predictor</th>
                            {isWorldCup ? (
                                <>
                                    <th className="th-score" title="Points from exact scores &amp; results">Groups &amp; Matches</th>
                                    <th className="th-score" title="Points from Knockout progressions">Bracket</th>
                                    <th className="th-score" title="Points from Awards">Awards</th>
                                    <th className="th-score" title="Points from Tournament XI">Tourn. XI</th>
                                    <th className="th-total">Total Pts</th>
                                </>
                            ) : (
                                <>
                                    <th className="th-score" title="Points from Eredivisie predictions">Test Pts</th>
                                    <th className="th-score" title="Number of matches predicted">Matches Filled</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {(activeData as any[])
                            .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                            .map((user, index) => {
                                const sorted = activeData as any[];
                                let rank = index + 1;
                                if (index > 0 && sorted[index - 1].total === user.total) {
                                    const firstTiedIndex = sorted.findIndex((u: any) => u.total === user.total);
                                    rank = firstTiedIndex + 1;
                                }

                                const isTop3 = rank <= 3;
                                const isCurrentUser = user.id === profile?.id;
                                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

                                return (
                                    <tr
                                        key={user.id}
                                        className={`lb-clickable ${isWorldCup ? 'lb-hover' : ''} ${isTop3 ? `top-rank-${rank}` : ''} ${isCurrentUser ? 'current-user' : ''}`}
                                        onClick={() => {
                                            if (isWorldCup) {
                                                setSelectedUserId({ id: user.id, username: user.username, avatar: user.avatar_url });
                                            }
                                        }}
                                    >
                                        <td className="td-rank">
                                            {medal ? (
                                                <span className="medal-icon">{medal}</span>
                                            ) : (
                                                <span className="rank-num">{rank}</span>
                                            )}
                                        </td>
                                        <td className="td-user">
                                            <div className="lb-user-info">
                                                {user.avatar_url && (
                                                    <img
                                                        src={user.avatar_url}
                                                        alt="Avatar"
                                                        className="lb-avatar"
                                                    />
                                                )}
                                                <div className="lb-names">
                                                    <span className="lb-display-name">
                                                        {user.username.charAt(0).toUpperCase() + user.username.slice(1)}
                                                        {isCurrentUser && <span className="you-suffix"> (you)</span>}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        {isWorldCup ? (
                                            <>
                                                <td className="td-score">{(user as ProfileData).matches_pts}</td>
                                                <td className="td-score">{(user as ProfileData).ko_pts}</td>
                                                <td className="td-score">{(user as ProfileData).awa_pts}</td>
                                                <td className="td-score">{(user as ProfileData).xi_pts}</td>
                                                <td className="td-total">{user.total}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="td-total">{user.total}</td>
                                                <td className="td-score">{(user as EredivisieProfileData).matches_filled}</td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        {activeData.length === 0 && (
                            <tr>
                                <td colSpan={totalColSpan} className="td-empty">No predictors found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {activeData.length > PAGE_SIZE && (
                    <div className="leaderboard-pagination">
                        <span className="pagination-info">
                            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, activeData.length)} of {activeData.length}
                        </span>
                        <div className="pagination-buttons">
                            <button
                                className="pagination-btn"
                                disabled={page === 0}
                                onClick={() => setPage(p => p - 1)}
                            >
                                ← Prev
                            </button>
                            <button
                                className="pagination-btn"
                                disabled={(page + 1) * PAGE_SIZE >= activeData.length}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showScoringPopup && (
                <EredivisieScoringPopup onClose={() => setShowScoringPopup(false)} />
            )}

            {selectedUserId && (
                <UserPredictionsModal
                    userId={selectedUserId.id}
                    username={selectedUserId.username}
                    avatarUrl={selectedUserId.avatar}
                    onClose={() => setSelectedUserId(null)}
                />
            )}
        </div>
    );
};

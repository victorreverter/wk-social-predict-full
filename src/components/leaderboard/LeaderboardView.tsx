import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
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
    pos_pts: number;
    total: number;
}

export const LeaderboardView: React.FC = () => {
    const { profile } = useAuth();

    const [leaderboard, setLeaderboard] = useState<ProfileData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(0);
    const [selectedUserId, setSelectedUserId] = useState<{ id: string; username: string; avatar: string | null } | null>(null);
    const [hintDismissed, setHintDismissed] = useState(false);
    const PAGE_SIZE = 15;
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const loadingRef = useRef(false);

    const fetchWorldCupLeaderboard = useCallback(async (force = false) => {
        if (!force && loadingRef.current) return;
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
                    user_group_positions (pts_earned),
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
                const pos_pts = (user.user_group_positions || []).reduce(
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
                    pos_pts,
                    total: matches_pts + ko_pts + awa_pts + pos_pts + xi_pts,
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

    useEffect(() => {
        setPage(0);
        setLoading(true);
        fetchWorldCupLeaderboard();
    }, [fetchWorldCupLeaderboard]);

    useEffect(() => {
        const handleRefresh = () => {
            fetchWorldCupLeaderboard(true);
        };
        window.addEventListener('leaderboard-refresh', handleRefresh);

        const wcTables: string[] = [
            'user_predictions_matches',
            'user_predictions_knockout',
            'user_predictions_awards',
            'user_group_positions',
            'user_predictions_xi',
        ];

        let ch = supabase.channel('leaderboard-updates');

        wcTables.forEach(table => {
            const doWcRefresh = () => fetchWorldCupLeaderboard();
            ch = ch
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, doWcRefresh)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, doWcRefresh)
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, doWcRefresh);
        });

        ch = ch
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
                fetchWorldCupLeaderboard();
            })
            .subscribe();

        channelRef.current = ch;

        return () => {
            window.removeEventListener('leaderboard-refresh', handleRefresh);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [fetchWorldCupLeaderboard]);

    const totalColSpan = 8;

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
                    🏅 Global Leaderboard
                </h2>
                <p>
                    The ultimate ranking across the entire prediction tournament.
                </p>
            </header>

            {!hintDismissed && (
                <div className="lb-click-hint">
                    <span>👇 Click on any row to view the full prediction summary</span>
                    <button
                        className="lb-click-hint-dismiss"
                        onClick={() => setHintDismissed(true)}
                        aria-label="Dismiss hint"
                    >
                        ×
                    </button>
                </div>
            )}

            <div className="leaderboard-table-wrap glass-panel">
                <table className="leaderboard-table">
                    <thead>
                        <tr>
                            <th className="th-rank">Rank</th>
                            <th className="th-user">Predictor</th>
                            <th className="th-score" title="Points from exact scores &amp; results">Groups</th>
                            <th className="th-score" title="Points from Bracket progressions">Knockout</th>
                            <th className="th-score" title="Points from Awards">Awards</th>
                            <th className="th-score" title="Points from Group Positions">Pos</th>
                            <th className="th-total">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboard
                            .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                            .map((user, index) => {
                                const sorted = leaderboard;
                                const globalIndex = page * PAGE_SIZE + index;
                                let rank = globalIndex + 1;
                                if (globalIndex > 0 && sorted[globalIndex - 1].total === user.total) {
                                    const firstTiedIndex = sorted.findIndex((u: any) => u.total === user.total);
                                    rank = firstTiedIndex + 1;
                                }

                                const isTop3 = rank <= 3;
                                const isCurrentUser = user.id === profile?.id;
                                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

                                return (
                                    <tr
                                        key={user.id}
                                        className={`lb-clickable lb-hover ${isTop3 ? `top-rank-${rank}` : ''} ${isCurrentUser ? 'current-user' : ''}`}
                                        onClick={() => {
                                            setSelectedUserId({ id: user.id, username: user.username, avatar: user.avatar_url });
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
                                                <span className="lb-eye-icon" title="Click to view predictions">🔍</span>
                                            </div>
                                        </td>
                                        <td className="td-score">{user.matches_pts}</td>
                                        <td className="td-score">{user.ko_pts}</td>
                                        <td className="td-score">{user.awa_pts}</td>
                                        <td className="td-score">{user.pos_pts}</td>
                                        <td className="td-total">{user.total}</td>
                                    </tr>
                                );
                            })}
                        {leaderboard.length === 0 && (
                            <tr>
                                <td colSpan={totalColSpan} className="td-empty">No predictors found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {leaderboard.length > PAGE_SIZE && (
                    <div className="leaderboard-pagination">
                        <span className="pagination-info">
                            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, leaderboard.length)} of {leaderboard.length}
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
                                disabled={(page + 1) * PAGE_SIZE >= leaderboard.length}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>

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

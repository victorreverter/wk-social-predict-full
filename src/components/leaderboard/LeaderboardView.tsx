import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
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

export const LeaderboardView: React.FC = () => {
    const [leaderboard, setLeaderboard] = useState<ProfileData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            setError('');
            try {
                // Fetch profiles with all their points arrays using Supabase PostgREST nested select
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

                // Aggregate points
                const processed: ProfileData[] = (data || []).map((user: any) => {
                    const matches_pts = (user.user_predictions_matches || []).reduce((acc: number, curr: any) => acc + (curr.pts_earned || 0), 0);
                    const ko_pts = (user.user_predictions_knockout || []).reduce((acc: number, curr: any) => acc + (curr.pts_earned || 0), 0);
                    const awa_pts = (user.user_predictions_awards || []).reduce((acc: number, curr: any) => acc + (curr.pts_earned || 0), 0);
                    const xi_pts = (user.user_predictions_xi || []).reduce((acc: number, curr: any) => acc + (curr.pts_earned || 0), 0);
                    
                    return {
                        id: user.id,
                        username: user.username,
                        display_name: user.display_name,
                        avatar_url: user.avatar_url,
                        matches_pts,
                        ko_pts,
                        awa_pts,
                        xi_pts,
                        total: matches_pts + ko_pts + awa_pts + xi_pts
                    };
                });

                // Sort by total descending
                processed.sort((a, b) => b.total - a.total);
                
                // Allow ties to have the same rank mathematically
                setLeaderboard(processed);
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to load leaderboard data.');
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

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
                <h2 className="text-gradient">🏅 Global Leaderboard</h2>
                <p>The ultimate ranking across the entire prediction tournament.</p>
            </header>

            <div className="leaderboard-table-wrap glass-panel">
                <table className="leaderboard-table">
                    <thead>
                        <tr>
                            <th className="th-rank">Rank</th>
                            <th className="th-user">Predictor</th>
                            <th className="th-score" title="Points from exact scores & results">Groups & Matches</th>
                            <th className="th-score" title="Points from Knockout progressions">Bracket</th>
                            <th className="th-score" title="Points from Awards">Awards</th>
                            <th className="th-score" title="Points from Tournament XI">Tourn. XI</th>
                            <th className="th-total">Total Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboard.map((user, index) => {
                            // Logic to share rank numbers for tied players
                            let rank = index + 1;
                            if (index > 0 && leaderboard[index - 1].total === user.total) {
                                // Find very first index that has this same score
                                const firstTiedIndex = leaderboard.findIndex(u => u.total === user.total);
                                rank = firstTiedIndex + 1;
                            }

                            const isTop3 = rank <= 3;
                            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

                            return (
                                <tr key={user.id} className={isTop3 ? `top-rank-${rank}` : ''}>
                                    <td className="td-rank">
                                        {medal ? <span className="medal-icon">{medal}</span> : <span className="rank-num">{rank}</span>}
                                    </td>
                                    <td className="td-user">
                                        <div className="lb-user-info">
                                            {user.avatar_url && (
                                                <img src={user.avatar_url} alt="Avatar" className="lb-avatar" />
                                            )}
                                            <div className="lb-names">
                                                <span className="lb-display-name">
                                                    {user.username.charAt(0).toUpperCase() + user.username.slice(1)}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="td-score">{user.matches_pts}</td>
                                    <td className="td-score">{user.ko_pts}</td>
                                    <td className="td-score">{user.awa_pts}</td>
                                    <td className="td-score">{user.xi_pts}</td>
                                    <td className="td-total">{user.total}</td>
                                </tr>
                            );
                        })}
                        {leaderboard.length === 0 && (
                            <tr>
                                <td colSpan={7} className="td-empty">No predictors found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

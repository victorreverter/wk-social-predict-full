import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { fetchUserPredictions, type UserPredictionData } from '../../utils/fetchUserPredictions';
import { UserPreviewProvider } from '../admin/UserPreviewProvider';
import { LockedContent } from './LockedContent';
import './LockedGamesView.css';

export const LockedGamesView: React.FC = () => {
    const { state } = useApp();
    const { groupMatches, officialKnockoutMatches, koGamePredictions, officialMatches } = state;

    const [, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(interval);
    }, []);

    const [userSearch, setUserSearch] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<{ id: string; username: string; display_name: string | null }[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserName, setSelectedUserName] = useState<string>('');
    const [previewData, setPreviewData] = useState<UserPredictionData | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState('');

    const handleUserSearch = useCallback(async (query: string) => {
        setUserSearch(query);
        if (query.trim().length < 2) {
            setUserSearchResults([]);
            return;
        }
        const { data } = await supabase
            .from('profiles')
            .select('id, username, display_name')
            .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
            .limit(20);
        if (data) {
            setUserSearchResults(data);
        }
    }, []);

    const handleSelectUser = useCallback(async (userId: string, userName: string) => {
        setSelectedUserId(userId);
        setSelectedUserName(userName);
        setUserSearch('');
        setUserSearchResults([]);
        setPreviewLoading(true);
        setPreviewError('');
        setPreviewData(null);
        try {
            const data = await fetchUserPredictions(userId);
            setPreviewData(data);
        } catch (err: any) {
            setPreviewError(err?.message || 'Failed to load user predictions');
        }
        setPreviewLoading(false);
    }, []);

    const handleClearUser = useCallback(() => {
        setSelectedUserId(null);
        setSelectedUserName('');
        setPreviewData(null);
        setUserSearch('');
        setUserSearchResults([]);
    }, []);

    return (
        <div className="locked-games-view">
            <header className="locked-games-header glass-panel">
                <h2 className="text-gradient">🔒 Locked Games</h2>
                <p>Matches appear here once they lock (1 hour before kickoff). Your predictions are frozen and official results will be shown as they come in.</p>

                <div className="locked-user-search">
                    <input
                        type="text"
                        className="locked-search-input"
                        placeholder="Look up another player's locked games..."
                        value={userSearch}
                        onChange={(e) => handleUserSearch(e.target.value)}
                        autoComplete="off"
                    />
                    {userSearchResults.length > 0 && !selectedUserId && (
                        <div className="locked-search-results">
                            {userSearchResults.map(u => (
                                <button
                                    key={u.id}
                                    className="locked-search-result-item"
                                    onClick={() => handleSelectUser(u.id, u.display_name || u.username)}
                                >
                                    <span className="locked-search-result-name">{u.display_name || u.username}</span>
                                    <span className="locked-search-result-username">@{u.username}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            {selectedUserId && (
                <div className="locked-viewing-banner glass-panel">
                    <span className="locked-viewing-label">Viewing:</span>
                    <span className="locked-viewing-name">{selectedUserName}</span>
                    <button className="locked-clear-btn" onClick={handleClearUser}>
                        ✕ Back to my games
                    </button>
                </div>
            )}

            {previewLoading && (
                <div className="locked-loading glass-panel">
                    <p>Loading predictions...</p>
                </div>
            )}

            {previewError && (
                <div className="locked-error glass-panel">
                    <p>Error: {previewError}</p>
                </div>
            )}

            {selectedUserId && previewData && !previewLoading && (
                <UserPreviewProvider
                    data={previewData}
                    officialMatches={officialMatches}
                    officialKnockoutMatches={officialKnockoutMatches}
                >
                    <LockedContent gm={previewData.groupMatches} koPreds={previewData.koGamePredictions} />
                </UserPreviewProvider>
            )}

            {!selectedUserId && (
                <LockedContent gm={groupMatches} koPreds={koGamePredictions} />
            )}
        </div>
    );
};

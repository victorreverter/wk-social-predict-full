import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Profile {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_master: boolean;
    total_points: number;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    isLocked: boolean; // predictions locked after June 11 2026
    isEaseModeEnabled: boolean; // Global setting to allow/disallow Easy Mode
    signIn: (username: string, password: string) => Promise<string | null>;
    signUp: (username: string, password: string) => Promise<string | null>;
    signOut: () => Promise<void>;
    checkUsername: (username: string) => Promise<boolean>;
    openAuthModal: () => void;
    closeAuthModal: () => void;
    isAuthModalOpen: boolean;
    updateLockDate: (dateStr: string) => Promise<{ error: string | null }>;
    updateEaseMode: (enabled: boolean) => Promise<{ error: string | null }>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Prediction lock: June 11 2026 18:00 UTC (opening game kick-off).
// We fetch from DB config table but fall back to this hard-coded value.
const FALLBACK_LOCK_DATE = new Date('2026-06-11T18:00:00Z');

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession]         = useState<Session | null>(null);
    const [profile, setProfile]         = useState<Profile | null>(null);
    const [loading, setLoading]         = useState(true);
    const [isLocked, setIsLocked]       = useState(false);
    const [isEaseModeEnabled, setIsEaseModeEnabled] = useState(true); // Default to true
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    // ── Fetch profile row for the authenticated user ──────────
    const fetchProfile = async (userId: string) => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (data) setProfile(data as Profile);
    };

    // ── Check global config from DB ──────────────────────────
    const fetchGlobalConfig = async () => {
        const { data } = await supabase
            .from('config')
            .select('key, value');

        if (data) {
            const lockRow = data.find(r => r.key === 'predictions_locked_at');
            const easeRow = data.find(r => r.key === 'is_ease_mode_enabled');

            if (lockRow) {
                const lockDate = new Date(lockRow.value);
                setIsLocked(new Date() >= lockDate);
            } else {
                setIsLocked(new Date() >= FALLBACK_LOCK_DATE);
            }

            if (easeRow) {
                setIsEaseModeEnabled(easeRow.value === 'true');
            }
        } else {
            setIsLocked(new Date() >= FALLBACK_LOCK_DATE);
        }
    };

    // ── Update the lock date in DB (Master only) ─────────────
    const updateLockDate = async (dateStr: string): Promise<{ error: string | null }> => {
        const { error } = await supabase
            .from('config')
            .upsert({ key: 'predictions_locked_at', value: dateStr }, { onConflict: 'key' });
        
        if (!error) {
            const lockDate = new Date(dateStr);
            setIsLocked(new Date() >= lockDate);
        }
        return { error: error?.message || null };
    };

    // ── Session bootstrap & realtime listener ─────────────────
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) fetchProfile(session.user.id);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) fetchProfile(session.user.id);
            else setProfile(null);
        });

        fetchGlobalConfig();
        return () => subscription.unsubscribe();
    }, []);

    // ── Auth actions ──────────────────────────────────────────
    // We use a fake internal email so users only need username + password.
    const toFakeEmail = (username: string) => `${username.trim().toLowerCase()}@wkpredictor.app`;

    const signIn = async (username: string, password: string): Promise<string | null> => {
        const { error } = await supabase.auth.signInWithPassword({ email: toFakeEmail(username), password });
        return error ? error.message : null;
    };

    const signUp = async (username: string, password: string): Promise<string | null> => {
        const { error } = await supabase.auth.signUp({
            email: toFakeEmail(username),
            password,
            options: { data: { username } }
        });
        return error ? error.message : null;
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
    };

    const checkUsername = async (username: string): Promise<boolean> => {
        const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username.trim().toLowerCase())
            .maybeSingle();
        return !data; // true = available
    };

    const updateEaseMode = async (enabled: boolean): Promise<{ error: string | null }> => {
        const { error } = await supabase
            .from('config')
            .upsert({ key: 'is_ease_mode_enabled', value: String(enabled) }, { onConflict: 'key' });
        
        if (!error) {
            setIsEaseModeEnabled(enabled);
        }
        return { error: error?.message || null };
    };

    const openAuthModal  = () => setIsAuthModalOpen(true);
    const closeAuthModal = () => setIsAuthModalOpen(false);

    return (
        <AuthContext.Provider value={{
            session,
            user: session?.user ?? null,
            profile,
            loading,
            isLocked,
            isEaseModeEnabled,
            signIn,
            signUp,
            signOut,
            checkUsername,
            openAuthModal,
            closeAuthModal,
            isAuthModalOpen,
            updateLockDate,
            updateEaseMode,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

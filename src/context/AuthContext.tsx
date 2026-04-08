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
    signIn: (username: string, password: string) => Promise<string | null>;
    signUp: (username: string, password: string) => Promise<string | null>;
    signOut: () => Promise<void>;
    openAuthModal: () => void;
    closeAuthModal: () => void;
    isAuthModalOpen: boolean;
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

    // ── Check prediction lock from DB config ─────────────────
    const checkLock = async () => {
        const { data } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'predictions_locked_at')
            .single();

        const lockDate = data?.value ? new Date(data.value) : FALLBACK_LOCK_DATE;
        setIsLocked(new Date() >= lockDate);
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

        checkLock();
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

    const openAuthModal  = () => setIsAuthModalOpen(true);
    const closeAuthModal = () => setIsAuthModalOpen(false);

    return (
        <AuthContext.Provider value={{
            session,
            user: session?.user ?? null,
            profile,
            loading,
            isLocked,
            signIn,
            signUp,
            signOut,
            openAuthModal,
            closeAuthModal,
            isAuthModalOpen,
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

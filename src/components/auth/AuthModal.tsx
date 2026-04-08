import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import './AuthModal.css';

type AuthView = 'LOGIN' | 'REGISTER';
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export const AuthModal: React.FC = () => {
    const { signIn, signUp, checkUsername, closeAuthModal } = useAuth();

    const [view, setView]         = useState<AuthView>('LOGIN');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState<string | null>(null);
    const [loading, setLoading]   = useState(false);
    const [success, setSuccess]   = useState<string | null>(null);
    const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Debounced username availability check (register only) ──
    useEffect(() => {
        if (view !== 'REGISTER') { setUsernameStatus('idle'); return; }

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (username.trim().length < 3) { setUsernameStatus('idle'); return; }
        if (!/^[a-z0-9_]+$/i.test(username.trim())) { setUsernameStatus('invalid'); return; }

        setUsernameStatus('checking');
        debounceRef.current = setTimeout(async () => {
            const available = await checkUsername(username.trim());
            setUsernameStatus(available ? 'available' : 'taken');
        }, 500);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [username, view, checkUsername]);

    const reset = () => { setError(null); setSuccess(null); setLoading(false); setUsernameStatus('idle'); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();

        if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
        if (password.length < 6)        { setError('Password must be at least 6 characters.'); return; }
        if (!/^[a-z0-9_]+$/i.test(username.trim())) {
            setError('Username can only contain letters, numbers, and underscores.');
            return;
        }
        if (view === 'REGISTER' && usernameStatus === 'taken') {
            setError('That username is already taken. Please choose another.');
            return;
        }

        setLoading(true);

        if (view === 'LOGIN') {
            const err = await signIn(username.trim(), password);
            if (err) { setError(friendlyError(err)); setLoading(false); }
            else closeAuthModal();
        } else {
            const err = await signUp(username.trim(), password);
            if (err) { setError(friendlyError(err)); setLoading(false); }
            else { setSuccess('Account created! You can now sign in.'); setLoading(false); }
        }
    };

    const friendlyError = (msg: string): string => {
        if (msg.includes('Invalid login credentials')) return 'Incorrect username or password.';
        if (msg.includes('User already registered'))   return 'This username is already taken.';
        if (msg.includes('Password should be'))        return 'Password must be at least 6 characters.';
        return msg;
    };

    const usernameIndicator = () => {
        if (view !== 'REGISTER' || username.trim().length < 3) return null;
        switch (usernameStatus) {
            case 'checking':  return <span className="username-hint checking">⏳ Checking…</span>;
            case 'available': return <span className="username-hint available">✅ Available!</span>;
            case 'taken':     return <span className="username-hint taken">❌ Not available</span>;
            case 'invalid':   return <span className="username-hint taken">⚠️ Letters, numbers & _ only</span>;
            default:          return null;
        }
    };

    return (
        <div className="auth-overlay" onClick={closeAuthModal}>
            <div className="auth-modal glass-panel" onClick={e => e.stopPropagation()}>
                <button className="auth-close" onClick={closeAuthModal}>✕</button>

                <div className="auth-logo">⚽</div>
                <h2 className="auth-title text-gradient">
                    {view === 'LOGIN' ? 'Welcome Back' : 'Join the Predictor'}
                </h2>
                <p className="auth-subtitle">
                    {view === 'LOGIN'
                        ? 'Sign in with your username and password.'
                        : 'Create a free account — no email needed.'}
                </p>

                {success ? (
                    <div className="auth-success">
                        {success}
                        <button
                            className="auth-submit-btn"
                            style={{ marginTop: '1rem' }}
                            onClick={() => { setView('LOGIN'); reset(); }}
                        >
                            Go to Sign In
                        </button>
                    </div>
                ) : (
                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <div className="auth-field-header">
                                <label>Username</label>
                                {usernameIndicator()}
                            </div>
                            <input
                                type="text"
                                placeholder="your_username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                autoFocus
                                className={
                                    view === 'REGISTER' && usernameStatus === 'taken' ? 'input-error' :
                                    view === 'REGISTER' && usernameStatus === 'available' ? 'input-ok' : ''
                                }
                            />
                        </div>

                        <div className="auth-field">
                            <label>Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                autoComplete={view === 'LOGIN' ? 'current-password' : 'new-password'}
                            />
                        </div>

                        {error && <div className="auth-error">{error}</div>}

                        <button
                            type="submit"
                            className="auth-submit-btn"
                            disabled={loading || (view === 'REGISTER' && usernameStatus === 'taken')}
                        >
                            {loading ? 'Please wait…' : view === 'LOGIN' ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>
                )}

                {!success && (
                    <div className="auth-switch">
                        {view === 'LOGIN' ? (
                            <>No account?{' '}
                                <button onClick={() => { setView('REGISTER'); reset(); setUsername(''); setPassword(''); }}>Sign up free</button>
                            </>
                        ) : (
                            <>Already have an account?{' '}
                                <button onClick={() => { setView('LOGIN'); reset(); setUsername(''); setPassword(''); }}>Sign in</button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

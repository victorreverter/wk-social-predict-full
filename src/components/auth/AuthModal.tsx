import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './AuthModal.css';

type AuthView = 'LOGIN' | 'REGISTER';

export const AuthModal: React.FC = () => {
    const { signIn, signUp, closeAuthModal } = useAuth();

    const [view, setView]         = useState<AuthView>('LOGIN');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState<string | null>(null);
    const [loading, setLoading]   = useState(false);
    const [success, setSuccess]   = useState<string | null>(null);

    const reset = () => { setError(null); setSuccess(null); setLoading(false); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();

        if (username.trim().length < 3) {
            setError('Username must be at least 3 characters.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        // Usernames must be alphanumeric + underscores only
        if (!/^[a-z0-9_]+$/i.test(username.trim())) {
            setError('Username can only contain letters, numbers, and underscores.');
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
            else {
                setSuccess('Account created! You can now sign in.');
                setLoading(false);
            }
        }
    };

    // Map Supabase error messages to user-friendly versions
    const friendlyError = (msg: string): string => {
        if (msg.includes('Invalid login credentials')) return 'Incorrect username or password.';
        if (msg.includes('User already registered'))   return 'This username is already taken.';
        if (msg.includes('Password should be'))        return 'Password must be at least 6 characters.';
        return msg;
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
                            <label>Username</label>
                            <input
                                type="text"
                                placeholder="your_username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                autoFocus
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

                        <button type="submit" className="auth-submit-btn" disabled={loading}>
                            {loading ? 'Please wait…' : view === 'LOGIN' ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>
                )}

                {!success && (
                    <div className="auth-switch">
                        {view === 'LOGIN' ? (
                            <>No account?{' '}
                                <button onClick={() => { setView('REGISTER'); reset(); }}>Sign up free</button>
                            </>
                        ) : (
                            <>Already have an account?{' '}
                                <button onClick={() => { setView('LOGIN'); reset(); }}>Sign in</button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './AuthModal.css';

type AuthView = 'LOGIN' | 'REGISTER';

export const AuthModal: React.FC = () => {
    const { signIn, signUp, closeAuthModal } = useAuth();

    const [view, setView]         = useState<AuthView>('LOGIN');
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError]       = useState<string | null>(null);
    const [loading, setLoading]   = useState(false);
    const [success, setSuccess]   = useState<string | null>(null);

    const reset = () => {
        setError(null);
        setSuccess(null);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();
        setLoading(true);

        if (view === 'LOGIN') {
            const err = await signIn(email, password);
            if (err) { setError(err); setLoading(false); }
            else closeAuthModal();
        } else {
            if (username.trim().length < 3) {
                setError('Username must be at least 3 characters.');
                setLoading(false);
                return;
            }
            const err = await signUp(email, password, username.trim());
            if (err) { setError(err); setLoading(false); }
            else {
                setSuccess('Account created! Check your email to confirm your address.');
                setLoading(false);
            }
        }
    };

    return (
        <div className="auth-overlay" onClick={closeAuthModal}>
            <div className="auth-modal glass-panel" onClick={e => e.stopPropagation()}>
                <button className="auth-close" onClick={closeAuthModal}>✕</button>

                {/* Logo */}
                <div className="auth-logo">⚽</div>
                <h2 className="auth-title text-gradient">
                    {view === 'LOGIN' ? 'Welcome Back' : 'Join the Predictor'}
                </h2>
                <p className="auth-subtitle">
                    {view === 'LOGIN'
                        ? 'Sign in to save your predictions and compete.'
                        : 'Create a free account to make your predictions.'}
                </p>

                {success ? (
                    <div className="auth-success">{success}</div>
                ) : (
                    <form className="auth-form" onSubmit={handleSubmit}>
                        {view === 'REGISTER' && (
                            <div className="auth-field">
                                <label>Username</label>
                                <input
                                    type="text"
                                    placeholder="Your unique display name"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                    autoComplete="username"
                                />
                            </div>
                        )}

                        <div className="auth-field">
                            <label>Email</label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoComplete="email"
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
            </div>
        </div>
    );
};

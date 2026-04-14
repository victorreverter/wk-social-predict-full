import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import './AuthModal.css';

type AuthView = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'UPDATE_PASSWORD';
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export const AuthModal: React.FC = () => {
    const { signIn, signUp, signOut, checkUsername, closeAuthModal, sendPasswordResetEmail, recoveryMode, updatePassword, clearRecoveryMode } = useAuth();

    const [view, setView]         = useState<AuthView>('LOGIN');
    const [email, setEmail]       = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError]       = useState<string | null>(null);
    const [loading, setLoading]   = useState(false);
    const [success, setSuccess]   = useState<string | null>(null);
    const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Initial check for recovery mode mapping
    useEffect(() => {
        if (recoveryMode) {
            setView('UPDATE_PASSWORD');
        }
    }, [recoveryMode]);

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

    const reset = () => { setError(null); setSuccess(null); setLoading(false); setUsernameStatus('idle'); setConfirmPassword(''); setShowPassword(false); setShowConfirmPassword(false); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();

        const cleanEmail = email.trim();
        if (view !== 'UPDATE_PASSWORD' && !cleanEmail.includes('@')) { 
            setError('Please enter a valid email address.'); 
            return; 
        }

        if (view === 'FORGOT_PASSWORD') {
            setLoading(true);
            const err = await sendPasswordResetEmail(cleanEmail);
            if (err) { setError(friendlyError(err)); setLoading(false); }
            else { setSuccess('Confirmation link sent! Check your email inbox to reset your password.'); setLoading(false); }
            return;
        }

        if (view === 'UPDATE_PASSWORD') {
            if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
            if (password !== confirmPassword) { setError('Passwords do not match. Please try again.'); return; }
            setLoading(true);
            const err = await updatePassword(password);
            setLoading(false);
            if (err) { setError(friendlyError(err)); }
            else { 
                // Sign out after reset for maximum security — user must re-login with new credentials
                await signOut();
                clearRecoveryMode();
                setSuccess('Password updated successfully! Please sign in with your new password.');
            }
            return;
        }

        if (view === 'REGISTER') {
            if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
            if (!/^[a-z0-9_]+$/i.test(username.trim())) {
                setError('Username can only contain letters, numbers, and underscores.');
                return;
            }
            if (usernameStatus === 'taken') {
                setError('That username is already taken. Please choose another.');
                return;
            }
        }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

        setLoading(true);

        if (view === 'LOGIN') {
            const err = await signIn(cleanEmail, password);
            if (err) { setError(friendlyError(err)); setLoading(false); }
            else closeAuthModal();
        } else if (view === 'REGISTER') {
            const err = await signUp(cleanEmail, username.trim(), password);
            if (err) { setError(friendlyError(err)); setLoading(false); }
            else { setSuccess('Account created! Check your email internally or you can now sign in.'); setLoading(false); }
        }
    };

    const friendlyError = (msg: string): string => {
        if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
        if (msg.includes('User already registered'))   return 'An account with this email already exists.';
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
                    {view === 'LOGIN' ? 'Welcome Back' : view === 'FORGOT_PASSWORD' ? 'Reset Password' : view === 'UPDATE_PASSWORD' ? 'Save New Password' : 'Join the Predictor'}
                </h2>
                <p className="auth-subtitle">
                    {view === 'LOGIN'
                        ? 'Sign in to save your predictions.'
                        : view === 'FORGOT_PASSWORD'
                        ? 'Enter your email to receive a secure recovery link.'
                        : view === 'UPDATE_PASSWORD'
                        ? 'Choose a strong new password for your account.'
                        : 'Create a free account to compete on the leaderboard.'}
                </p>

                {success ? (
                    <div className="auth-success">
                        <p>{success}</p>
                        <button
                            className="auth-submit-btn"
                            style={{ marginTop: '1rem' }}
                            onClick={() => { setView('LOGIN'); reset(); }}
                        >
                            Sign In Now
                        </button>
                    </div>
                ) : (
                    <form className="auth-form" onSubmit={handleSubmit}>
                        {view !== 'UPDATE_PASSWORD' && (
                            <div className="auth-field">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    autoFocus
                                />
                            </div>
                        )}

                        {view === 'REGISTER' && (
                            <div className="auth-field">
                                <div className="auth-field-header">
                                    <label>Choose a Username</label>
                                    {usernameIndicator()}
                                </div>
                                <input
                                    type="text"
                                    placeholder="your_cool_name"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                    autoComplete="username"
                                    className={
                                        view === 'REGISTER' && usernameStatus === 'taken' ? 'input-error' :
                                        view === 'REGISTER' && usernameStatus === 'available' ? 'input-ok' : ''
                                    }
                                />
                            </div>
                        )}

                        {view !== 'FORGOT_PASSWORD' && (
                            <div className="auth-field">
                                <label>{view === 'UPDATE_PASSWORD' ? 'New Password' : 'Password'}</label>
                                <div className="password-wrapper">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        autoComplete={view === 'LOGIN' ? 'current-password' : 'new-password'}
                                    />
                                    <button
                                        type="button"
                                        className="eye-toggle"
                                        onClick={() => setShowPassword(p => !p)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                                                <line x1="1" y1="1" x2="23" y2="23"/>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                <circle cx="12" cy="12" r="3"/>
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {view === 'UPDATE_PASSWORD' && (
                            <div className="auth-field">
                                <div className="auth-field-header">
                                    <label>Confirm New Password</label>
                                    {confirmPassword.length > 0 && (
                                        password === confirmPassword
                                            ? <span className="username-hint available">✅ Passwords match</span>
                                            : <span className="username-hint taken">❌ Passwords don't match</span>
                                    )}
                                </div>
                                <div className="password-wrapper">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                        className={confirmPassword.length > 0 ? (password === confirmPassword ? 'input-ok' : 'input-error') : ''}
                                    />
                                    <button
                                        type="button"
                                        className="eye-toggle"
                                        onClick={() => setShowConfirmPassword(p => !p)}
                                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showConfirmPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                                                <line x1="1" y1="1" x2="23" y2="23"/>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                <circle cx="12" cy="12" r="3"/>
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && <div className="auth-error">{error}</div>}

                        <button
                            type="submit"
                            className="auth-submit-btn"
                            disabled={loading || (view === 'REGISTER' && usernameStatus === 'taken') || (view === 'UPDATE_PASSWORD' && password !== confirmPassword)}
                        >
                            {loading ? 'Please wait…' : view === 'LOGIN' ? 'Sign In' : view === 'FORGOT_PASSWORD' ? 'Send Recovery Link' : view === 'UPDATE_PASSWORD' ? 'Save New Password' : 'Create Account'}
                        </button>
                    </form>
                )}

                {(!success && view !== 'UPDATE_PASSWORD') && (
                    <div className="auth-switch">
                        {view === 'LOGIN' && (
                            <>
                                <button className="forgot-pw-link" onClick={() => { setView('FORGOT_PASSWORD'); reset(); setEmail(''); setPassword(''); }}>Forgot your password?</button>
                                <div className="auth-divider"></div>
                                <div style={{marginTop:'0.5rem'}}>
                                    No account? <button onClick={() => { setView('REGISTER'); reset(); setEmail(''); setUsername(''); setPassword(''); }}>Sign up free</button>
                                </div>
                            </>
                        )}
                        {view === 'REGISTER' && (
                            <>Already have an account?{' '}
                                <button onClick={() => { setView('LOGIN'); reset(); setEmail(''); setUsername(''); setPassword(''); }}>Sign in</button>
                            </>
                        )}
                        {view === 'FORGOT_PASSWORD' && (
                            <><button onClick={() => { setView('LOGIN'); reset(); setEmail(''); setPassword(''); }}>Back to Sign In</button></>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

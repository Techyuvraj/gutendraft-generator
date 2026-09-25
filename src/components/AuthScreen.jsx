import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const MODES = {
    signin: { title: 'Sign in', submit: 'Sign in' },
    signup: { title: 'Create account', submit: 'Create account' },
    forgot: { title: 'Reset password', submit: 'Send reset link' },
    recovery: { title: 'Choose a new password', submit: 'Update password' },
};

/**
 * Full-page gate shown until a user is signed in. Also handles the
 * "set a new password" step when they arrive from a reset email.
 */
const AuthScreen = ({ recovery = false, onRecovered }) => {
    const [mode, setMode] = useState(recovery ? 'recovery' : 'signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const switchMode = (next) => {
        setMode(next);
        setError('');
        setNotice('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        setNotice('');

        try {
            if (mode === 'signin') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else if (mode === 'signup') {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: window.location.origin },
                });
                if (error) throw error;
                // With email confirmation on, there is a user but no session yet.
                if (!data.session) {
                    setNotice('Check your inbox and click the confirmation link, then sign in.');
                    setMode('signin');
                }
            } else if (mode === 'forgot') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin,
                });
                if (error) throw error;
                setNotice('If that email has an account, a reset link is on its way.');
            } else if (mode === 'recovery') {
                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
                onRecovered?.();
            }
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    if (!isSupabaseConfigured) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <img src="/gutendraft.png" alt="GutenDraft" className="auth-logo" />
                    <h1 className="auth-title">Sign-in is not set up yet</h1>
                    <p className="auth-text">
                        Add <code className="mono">VITE_SUPABASE_URL</code> and{' '}
                        <code className="mono">VITE_SUPABASE_ANON_KEY</code> to your environment
                        (a local <code className="mono">.env</code>, or the Vercel project settings),
                        then restart or redeploy.
                    </p>
                </div>
            </div>
        );
    }

    const needsEmail = mode !== 'recovery';
    const needsPassword = mode !== 'forgot';

    return (
        <div className="auth-page">
            <form className="auth-card" onSubmit={handleSubmit}>
                <img src="/gutendraft.png" alt="GutenDraft" className="auth-logo" />
                <h1 className="auth-title">{MODES[mode].title}</h1>

                {needsEmail && (
                    <label className="auth-field">
                        <span>Email</span>
                        <input
                            type="email"
                            className="api-key-input auth-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                    </label>
                )}

                {needsPassword && (
                    <label className="auth-field">
                        <span>{mode === 'recovery' ? 'New password' : 'Password'}</span>
                        <input
                            type="password"
                            className="api-key-input auth-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                            minLength={mode === 'signin' ? undefined : 8}
                            required
                        />
                    </label>
                )}

                {error && <p className="api-key-error">{error}</p>}
                {notice && <p className="auth-notice">{notice}</p>}

                <button type="submit" className="btn-primary auth-submit" disabled={busy}>
                    {busy ? 'Please wait…' : MODES[mode].submit}
                </button>

                {mode === 'signin' && (
                    <div className="auth-links">
                        <button type="button" className="api-key-link" onClick={() => switchMode('signup')}>
                            Create an account
                        </button>
                        <button type="button" className="api-key-link danger" onClick={() => switchMode('forgot')}>
                            Forgot password?
                        </button>
                    </div>
                )}
                {(mode === 'signup' || mode === 'forgot') && (
                    <div className="auth-links">
                        <button type="button" className="api-key-link" onClick={() => switchMode('signin')}>
                            Back to sign in
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default AuthScreen;

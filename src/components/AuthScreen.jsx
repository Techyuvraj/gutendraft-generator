import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const MODES = {
    signin: { title: 'Sign in', submit: 'Sign in' },
    signup: { title: 'Create account', submit: 'Create account' },
    forgot: { title: 'Reset password', submit: 'Send reset link' },
    recovery: { title: 'Choose a new password', submit: 'Update password' },
};

/*
 * A failed OAuth round trip comes back as ?error_description=... (or in the
 * hash). Read it once so the user sees why, then tidy the address bar.
 */
const readOAuthError = () => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const message = params.get('error_description') || hash.get('error_description');
    if (message) window.history.replaceState(null, '', window.location.pathname);
    return message ? message.replace(/\+/g, ' ') : '';
};

const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
);

/**
 * Full-page gate shown until a user is signed in. Also handles the
 * "set a new password" step when they arrive from a reset email.
 */
const AuthScreen = ({ recovery = false, onRecovered }) => {
    const [mode, setMode] = useState(recovery ? 'recovery' : 'signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(readOAuthError);
    const [notice, setNotice] = useState('');

    /* Google handles both cases: a first-time Google user gets an account
       created, a returning one is signed in. The page then leaves for
       Google and comes back to this origin with the session. */
    const handleGoogle = async () => {
        setBusy(true);
        setError('');
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
        });
        if (error) {
            setError(error.message || 'Could not start Google sign-in.');
            setBusy(false);
        }
    };

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
    const offersGoogle = mode === 'signin' || mode === 'signup';

    return (
        <div className="auth-page">
            <form className="auth-card" onSubmit={handleSubmit}>
                <img src="/gutendraft.png" alt="GutenDraft" className="auth-logo" />
                <h1 className="auth-title">{MODES[mode].title}</h1>

                {offersGoogle && (
                    <>
                        <button
                            type="button"
                            className="auth-google"
                            onClick={handleGoogle}
                            disabled={busy}
                        >
                            <GoogleIcon />
                            <span>{mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}</span>
                        </button>
                        <div className="auth-divider" role="separator">
                            <span>or use email</span>
                        </div>
                    </>
                )}

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

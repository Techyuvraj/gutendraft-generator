import React, { useState } from 'react';
import {
    PROVIDERS,
    PROVIDER_IDS,
    getProviderConfig,
    getStoredKey,
    storeKey,
    clearStoredKey,
    setProvider as persistProvider,
    hasApiKey,
    isUsingEnvKey,
    maskKey,
    looksLikeApiKey,
} from '../services/apiKey';

const ApiKeySettings = ({ provider, onProviderChange, onKeyChange }) => {
    const config = getProviderConfig(provider);

    const [savedKey, setSavedKey] = useState(() => getStoredKey(provider));
    const [draft, setDraft] = useState('');
    const [isEditing, setIsEditing] = useState(() => !getStoredKey(provider));
    const [reveal, setReveal] = useState(false);
    const [error, setError] = useState('');

    const usingEnvKey = !savedKey && isUsingEnvKey(provider);

    /* Each provider keeps its own key, so switching tabs reloads that
       provider's state rather than carrying the other one's draft across. */
    const handleProviderSwitch = (nextId) => {
        if (nextId === provider) return;

        persistProvider(nextId);
        setSavedKey(getStoredKey(nextId));
        setIsEditing(!getStoredKey(nextId));
        setDraft('');
        setReveal(false);
        setError('');

        onProviderChange?.(nextId);
        onKeyChange?.(hasApiKey(nextId));
    };

    const handleSave = () => {
        const key = draft.trim();

        if (!key) {
            setError('Paste your key first.');
            return;
        }
        if (!looksLikeApiKey(provider, key)) {
            setError(`That does not look like a ${config.label} key — ${config.keyHint}`);
            return;
        }
        if (!storeKey(provider, key)) {
            setError('Could not save. Your browser is blocking site storage.');
            return;
        }

        setSavedKey(key);
        setDraft('');
        setReveal(false);
        setIsEditing(false);
        setError('');
        onKeyChange?.(true);
    };

    const handleRemove = () => {
        clearStoredKey(provider);
        setSavedKey('');
        setDraft('');
        setIsEditing(true);
        setError('');
        onKeyChange?.(hasApiKey(provider));
    };

    const handleCancel = () => {
        setDraft('');
        setError('');
        setReveal(false);
        setIsEditing(false);
    };

    const providerTabs = (
        <div className="provider-tabs" role="tablist" aria-label="AI provider">
            {PROVIDER_IDS.map(id => (
                <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={id === provider}
                    className={`provider-tab ${id === provider ? 'active' : ''}`}
                    onClick={() => handleProviderSwitch(id)}
                >
                    {PROVIDERS[id].label}
                    {hasApiKey(id) && <span className="provider-tab-dot" aria-label="key saved" />}
                </button>
            ))}
        </div>
    );

    const modelLine = <p className="provider-model mono">{config.model}</p>;

    if (!isEditing && (savedKey || usingEnvKey)) {
        return (
            <>
                {providerTabs}
                <div className="api-key-status">
                    <span className="api-key-dot" aria-hidden="true"></span>
                    <span
                        className="api-key-value mono"
                        title={savedKey ? 'Stored in this browser' : 'Loaded from .env (dev only)'}
                    >
                        {savedKey ? maskKey(savedKey) : 'from .env (dev)'}
                    </span>
                    <div className="api-key-actions">
                        <button type="button" className="api-key-link" onClick={() => setIsEditing(true)}>
                            {savedKey ? 'Change' : 'Override'}
                        </button>
                        {savedKey && (
                            <button type="button" className="api-key-link danger" onClick={handleRemove}>
                                Remove
                            </button>
                        )}
                    </div>
                </div>
                {modelLine}
            </>
        );
    }

    return (
        <>
            {providerTabs}
            <form
                className="api-key-form"
                onSubmit={(e) => { e.preventDefault(); handleSave(); }}
            >
                <div className="api-key-input-row">
                    <input
                        type={reveal ? 'text' : 'password'}
                        className="url-input api-key-input"
                        placeholder={config.placeholder}
                        value={draft}
                        autoComplete="off"
                        spellCheck="false"
                        onChange={(e) => { setDraft(e.target.value); setError(''); }}
                    />
                    <button
                        type="button"
                        className="api-key-reveal"
                        onClick={() => setReveal(v => !v)}
                        title={reveal ? 'Hide key' : 'Show key'}
                        aria-label={reveal ? 'Hide key' : 'Show key'}
                    >
                        {reveal ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        )}
                    </button>
                </div>

                {error && <p className="api-key-error">{error}</p>}

                <div className="api-key-buttons">
                    <button type="submit" className="btn-primary api-key-save">
                        Save Key
                    </button>
                    {(savedKey || usingEnvKey) && (
                        <button type="button" className="api-key-link" onClick={handleCancel}>
                            Cancel
                        </button>
                    )}
                </div>

                <p className="api-key-note">
                    Stored in this browser only and sent straight to {config.label} — it never reaches a GutenDraft server.{' '}
                    <a href={config.consoleUrl} target="_blank" rel="noopener noreferrer">
                        Get a key from {config.consoleLabel}
                    </a>
                </p>
            </form>
            {modelLine}
        </>
    );
};

export default ApiKeySettings;

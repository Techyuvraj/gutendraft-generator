import React, { useEffect, useId, useState } from 'react';
import { getProviderConfig, setSelectedModel } from '../services/apiKey';
import { listModels } from '../services/models';

/**
 * Model switcher for the active provider. The input doubles as a search box
 * over the provider's live list (a <datalist>) and accepts any model id typed
 * by hand, for models the list trims out or that are brand new.
 */
const ModelPicker = ({ provider, keyVersion, onModelChange }) => {
    const config = getProviderConfig(provider);
    const listId = useId();

    const [draft, setDraft] = useState(config.model);
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    // Provider switch or key change: show that provider's model, refetch.
    useEffect(() => {
        setDraft(getProviderConfig(provider).model);
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setLoadError('');
            try {
                const ids = await listModels(provider, { refresh: keyVersion > 0 });
                if (!cancelled) setModels(ids);
            } catch (err) {
                if (!cancelled) {
                    setModels([]);
                    setLoadError(err?.status === 401 || err?.status === 400
                        ? 'Could not list models with this key.'
                        : 'Could not load the model list.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();

        return () => { cancelled = true; };
    }, [provider, keyVersion]);

    const commit = (value) => {
        const next = value.trim() || config.defaultModel;
        setDraft(next);
        if (next === config.model) return;
        setSelectedModel(provider, next);
        onModelChange?.(next);
    };

    const refresh = async () => {
        setLoading(true);
        setLoadError('');
        try {
            setModels(await listModels(provider, { refresh: true }));
        } catch {
            setLoadError('Could not load the model list.');
        } finally {
            setLoading(false);
        }
    };

    const isDefault = config.model === config.defaultModel;

    return (
        <div className="model-picker">
            <div className="model-picker-head">
                <label htmlFor={`${listId}-input`}>Model</label>
                <button
                    type="button"
                    className="api-key-link"
                    onClick={refresh}
                    disabled={loading}
                    title="Reload the list from the provider"
                >
                    {loading ? 'Loading…' : 'Refresh list'}
                </button>
            </div>

            <input
                id={`${listId}-input`}
                className="api-key-input model-picker-input mono"
                list={listId}
                value={draft}
                placeholder={config.defaultModel}
                spellCheck="false"
                autoComplete="off"
                onChange={(e) => {
                    setDraft(e.target.value);
                    // Picking from the list is a complete choice; apply it
                    // at once. Typing waits for Enter or leaving the field.
                    if (models.includes(e.target.value)) commit(e.target.value);
                }}
                onBlur={(e) => commit(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commit(e.currentTarget.value);
                    }
                    if (e.key === 'Escape') setDraft(config.model);
                }}
            />
            <datalist id={listId}>
                {models.map((id) => <option key={id} value={id} />)}
            </datalist>

            <p className="api-key-note">
                {loadError
                    ? `${loadError} You can still type a model id.`
                    : models.length
                        ? `${models.length} models available. Choose one that accepts images.`
                        : loading ? 'Fetching available models…' : 'Type a model id.'}
                {!isDefault && (
                    <>
                        {' '}
                        <button type="button" className="api-key-link" onClick={() => commit(config.defaultModel)}>
                            Reset to {config.defaultModel}
                        </button>
                    </>
                )}
            </p>
        </div>
    );
};

export default ModelPicker;

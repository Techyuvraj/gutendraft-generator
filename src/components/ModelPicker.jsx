import React, { useEffect, useId, useState } from 'react';
import { getProviderConfig, setSelectedModel } from '../services/apiKey';
import { listModels } from '../services/models';

/**
 * Model switcher for the active provider: a plain dropdown of the models the
 * user's key can use, fetched live from the provider.
 */
const ModelPicker = ({ provider, keyVersion, onModelChange }) => {
    const config = getProviderConfig(provider);
    const selectId = useId();

    const [selected, setSelected] = useState(config.model);
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    const load = React.useCallback(async (refresh) => {
        setLoading(true);
        setLoadError('');
        try {
            setModels(await listModels(provider, { refresh }));
        } catch (err) {
            setModels([]);
            setLoadError(err?.status === 401 || err?.status === 400
                ? 'Could not list models with this key.'
                : 'Could not load the model list.');
        } finally {
            setLoading(false);
        }
    }, [provider]);

    // Provider switch or key change: show that provider's model, refetch.
    useEffect(() => {
        setSelected(getProviderConfig(provider).model);
        load(keyVersion > 0);
    }, [provider, keyVersion, load]);

    const choose = (next) => {
        setSelected(next);
        setSelectedModel(provider, next);
        onModelChange?.(next);
    };

    /* The current and default models are always offered, even when the live
       list is unavailable or omits them, so the dropdown never shows a value
       it cannot select and there is always a way back to the default. */
    const options = [...new Set([selected, config.defaultModel, ...models])]
        .sort((a, b) => a.localeCompare(b));

    return (
        <div className="model-picker">
            <div className="model-picker-head">
                <label htmlFor={selectId}>Model</label>
                <button
                    type="button"
                    className="api-key-link"
                    onClick={() => load(true)}
                    disabled={loading}
                    title="Reload the list from the provider"
                >
                    {loading ? 'Loading…' : 'Refresh list'}
                </button>
            </div>

            <select
                id={selectId}
                className="model-picker-select mono"
                value={selected}
                onChange={(e) => choose(e.target.value)}
                disabled={loading && !models.length}
            >
                {options.map((id) => (
                    <option key={id} value={id}>
                        {id === config.defaultModel ? `${id} (default)` : id}
                    </option>
                ))}
            </select>

            <p className="api-key-note">
                {loadError
                    ? `${loadError} Showing the default model only.`
                    : loading && !models.length
                        ? 'Fetching available models…'
                        : `${models.length} models available. Choose one that accepts images.`}
            </p>
        </div>
    );
};

export default ModelPicker;

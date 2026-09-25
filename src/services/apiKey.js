/**
 * Provider registry. Gemini is reached through its OpenAI-compatible endpoint,
 * so both providers share one SDK and one request shape — only the base URL,
 * the model and the key differ.
 */
export const PROVIDERS = {
    gemini: {
        id: 'gemini',
        label: 'Gemini',
        model: 'gemini-3.8-flash',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        placeholder: 'AIza... or AQ....',
        // Two formats: the classic "AIza..." key, and the newer "AQ." key that
        // Google AI Studio now issues (which also contains dots).
        keyPattern: /^(AIza[A-Za-z0-9_-]{30,}|AQ\.[A-Za-z0-9._-]{20,})$/,
        keyHint: 'Gemini keys start with "AIza" or "AQ.".',
        consoleUrl: 'https://aistudio.google.com/apikey',
        consoleLabel: 'Google AI Studio',
        // Its CORS preflight rejects the SDK's X-Stainless-* headers (see ai.js).
        stripSdkHeaders: true,
    },
    openai: {
        id: 'openai',
        label: 'OpenAI',
        model: 'gpt-4o',
        baseURL: undefined, // SDK default
        placeholder: 'sk-...',
        keyPattern: /^sk-(?!or-)[A-Za-z0-9_-]{20,}$/,
        keyHint: 'OpenAI keys start with "sk-" (an OpenRouter "sk-or-" key will not work here).',
        consoleUrl: 'https://platform.openai.com/api-keys',
        consoleLabel: 'OpenAI dashboard',
    },
    openrouter: {
        id: 'openrouter',
        label: 'OpenRouter',
        model: 'openai/gpt-4o',
        baseURL: 'https://openrouter.ai/api/v1',
        placeholder: 'sk-or-v1-...',
        keyPattern: /^sk-or-[A-Za-z0-9_-]{20,}$/,
        keyHint: 'OpenRouter keys start with "sk-or-".',
        consoleUrl: 'https://openrouter.ai/keys',
        consoleLabel: 'OpenRouter',
        // OpenRouter attributes traffic to an app via these. Both are ordinary
        // custom headers, so the browser allows them (unlike a real Referer).
        // The referer is filled in at request time with the page's true origin.
        defaultHeaders: {
            'X-Title': 'GutenDraft',
        },
    },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);
export const DEFAULT_PROVIDER = 'gemini';

export const getProviderConfig = (providerId) => PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];

const keyStorageName = (providerId) => `gutendraft.${providerId}_api_key`;
const PROVIDER_STORAGE_KEY = 'gutendraft.provider';

/* localStorage throws in private-browsing / blocked-cookie modes, so every
   access is guarded and the app stays usable without it. */

const readStorage = (name) => {
    try {
        return localStorage.getItem(name) || '';
    } catch {
        return '';
    }
};

const writeStorage = (name, value) => {
    try {
        localStorage.setItem(name, value);
        return true;
    } catch {
        return false;
    }
};

export const getProvider = () => {
    const stored = readStorage(PROVIDER_STORAGE_KEY);
    return PROVIDERS[stored] ? stored : DEFAULT_PROVIDER;
};

export const setProvider = (providerId) => {
    if (!PROVIDERS[providerId]) return false;
    return writeStorage(PROVIDER_STORAGE_KEY, providerId);
};

export const getStoredKey = (providerId) => readStorage(keyStorageName(providerId));

export const storeKey = (providerId, key) => writeStorage(keyStorageName(providerId), key.trim());

export const clearStoredKey = (providerId) => {
    try {
        localStorage.removeItem(keyStorageName(providerId));
    } catch {
        /* nothing to clear */
    }
};

/**
 * The key the API layer should actually use for a provider.
 *
 * VITE_* variables are inlined into the production bundle at build time, so a
 * key in .env would be readable by anyone who loads the deployed app. The
 * reads below sit inside an `import.meta.env.DEV` branch specifically so the
 * bundler strips them from a build — a build always requires a user-supplied
 * key. Written out per provider rather than looked up dynamically, because
 * Vite only substitutes statically-referenced env expressions.
 */
export const resolveApiKey = (providerId) => {
    const stored = getStoredKey(providerId);
    if (stored) return stored;

    if (import.meta.env.DEV) {
        if (providerId === 'openai') return import.meta.env.VITE_OPENAI_API_KEY || '';
        if (providerId === 'gemini') return import.meta.env.VITE_GEMINI_API_KEY || '';
        if (providerId === 'openrouter') return import.meta.env.VITE_OPENROUTER_API_KEY || '';
    }

    return '';
};

export const hasApiKey = (providerId) => Boolean(resolveApiKey(providerId));

/** True when the key came from .env rather than from the user. Dev only. */
export const isUsingEnvKey = (providerId) => !getStoredKey(providerId) && hasApiKey(providerId);

/** Never render a key in full — only enough to tell two keys apart. */
export const maskKey = (key) => {
    if (!key) return '';
    return key.length > 12 ? `${key.slice(0, 6)}${'\u2022'.repeat(6)}${key.slice(-4)}` : '\u2022'.repeat(10);
};

/** Cheap shape check so an obvious paste error is caught before a round trip. */
export const looksLikeApiKey = (providerId, key) => getProviderConfig(providerId).keyPattern.test(key.trim());

/**
 * Keys from other services that are easy to paste here by mistake. Naming the
 * service beats a generic "invalid key", because the provider's own rejection
 * often never reaches us - OpenAI returns its 401 without CORS headers, so the
 * browser blocks the body and the SDK reports only a connection failure.
 */
const FOREIGN_KEY_PREFIXES = [
    { prefix: 'sk-or-', service: 'OpenRouter', ownedBy: 'openrouter' },
    { prefix: 'sk-ant-', service: 'Anthropic' },
    { prefix: 'gsk_', service: 'Groq' },
    // Matched against the provider id, not the display label, so a valid
    // Gemini key is never reported as foreign to the Gemini field.
    { prefix: 'AIza', service: 'Google Gemini', ownedBy: 'gemini' },
    { prefix: 'AQ.', service: 'Google Gemini', ownedBy: 'gemini' },
];

/** Returns the service a key appears to belong to, when it is not this one. */
export const detectForeignKey = (providerId, key) => {
    const match = FOREIGN_KEY_PREFIXES.find(f => key.trim().startsWith(f.prefix));
    if (!match || match.ownedBy === providerId) return null;
    return match.service;
};

/** "a Groq key" / "an OpenAI key" — the names here are all initial-sound regular. */
export const article = (word) => (/^[AEIOU]/i.test(word) ? 'an' : 'a');

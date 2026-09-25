import { getClient } from './ai';

/*
 * The live model list for a provider, fetched with the user's own key so it
 * shows exactly what that key can use. Each provider's list is trimmed to
 * chat models that can plausibly read a design image — embeddings, speech,
 * image generation and the like would only fail here.
 */

const GEMINI_EXCLUDE = /embedding|embed|tts|imagen|image-generation|aqa|live|native-audio|robotics|computer-use|veo|lyria/i;
const OPENAI_INCLUDE = /^(gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|chatgpt-4o|o1|o3|o4)/i;
const OPENAI_EXCLUDE = /audio|realtime|transcribe|tts|search|embedding|image|dall-e|whisper|moderation|codex|instruct/i;

const FILTERS = {
    gemini: (m) => m.id.includes('gemini') && !GEMINI_EXCLUDE.test(m.id),
    openai: (m) => OPENAI_INCLUDE.test(m.id) && !OPENAI_EXCLUDE.test(m.id),
    // OpenRouter says outright which models take images.
    openrouter: (m) => {
        const inputs = m.architecture?.input_modalities;
        return Array.isArray(inputs) ? inputs.includes('image') : true;
    },
};

const cache = new Map();

export const listModels = async (providerId, { refresh = false } = {}) => {
    if (!refresh && cache.has(providerId)) return cache.get(providerId);

    const client = getClient(providerId);
    const all = [];
    for await (const model of client.models.list()) {
        // Gemini's OpenAI-compatible list prefixes ids with "models/", but
        // chat completions expect the bare id.
        all.push({ ...model, id: String(model.id).replace(/^models\//, '') });
    }

    const keep = FILTERS[providerId] || (() => true);
    const ids = [...new Set(all.filter(keep).map((m) => m.id))].sort((a, b) => a.localeCompare(b));

    cache.set(providerId, ids);
    return ids;
};

/** Drop a cached list, e.g. after the key changes and may see other models. */
export const forgetModels = (providerId) => cache.delete(providerId);

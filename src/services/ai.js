import OpenAI from 'openai';
import { resolveApiKey, getProvider, getProviderConfig } from './apiKey';

export class MissingApiKeyError extends Error {
    constructor(providerLabel) {
        super(`Add your ${providerLabel} API key in the sidebar to generate blocks.`);
        this.name = 'MissingApiKeyError';
    }
}

/**
 * One client shape for both providers: Gemini exposes an OpenAI-compatible
 * endpoint, so only the base URL and the key change.
 *
 * Built per call rather than once at module load, so switching provider or
 * saving a key takes effect immediately instead of after a reload.
 */
const getClient = (providerId) => {
    const provider = getProviderConfig(providerId);
    const apiKey = resolveApiKey(provider.id);
    if (!apiKey) throw new MissingApiKeyError(provider.label);

    return new OpenAI({
        apiKey,
        baseURL: provider.baseURL,
        dangerouslyAllowBrowser: true // The key is the user's own and never leaves their browser except to the provider.
    });
};

/** Turn an SDK error into something worth showing a user. */
const describeError = (error, provider) => {
    if (error instanceof MissingApiKeyError) return error;

    const name = provider.label;

    /* Gemini reports a bad key as 400 INVALID_ARGUMENT rather than 401, and
       wraps the body in a JSON array the SDK may not unwrap into .message —
       so search the structured error too, not just the message string. */
    const haystack = [
        error?.message,
        error?.error?.message,
        typeof error?.error === 'string' ? error.error : '',
    ].filter(Boolean).join(' ');

    const badKey = error?.status === 401 ||
        (error?.status === 400 && /api[ _-]?key/i.test(haystack));

    if (badKey) {
        return new Error(`${name} rejected that API key. Check it in the sidebar, or create a new one.`);
    }
    if (error?.status === 429) {
        return new Error(`${name} rate limit or quota reached for this key. Check your billing, then try again.`);
    }
    if (error?.status === 403) {
        return new Error(`This key is not allowed to use ${provider.model}. Check its permissions in your ${name} account.`);
    }
    if (error?.status === 404) {
        return new Error(`${name} does not recognise the model ${provider.model}. It may have been retired.`);
    }
    return error;
};

export const generateGutenbergBlocks = async (input, framework = 'gutenberg', inputType = 'image', context = '', providerId = getProvider()) => {
    const provider = getProviderConfig(providerId);
    let systemPrompt = '';

    if (framework === 'spectra') {
        systemPrompt = `You are an expert using Spectra (Ultimate Addons for Gutenberg) blocks.
          Your task is to analyze the provided website image and generate the exact Gutenberg Block markup using Spectra blocks where appropriate.
          
          Rules:
          1. Use Spectra blocks (wp:uagb/container, wp:uagb/info-box, wp:uagb/buttons, wp:uagb/advanced-heading) for complex layouts and styling.
          2. Use wp:uagb/container for layout sections (Flexbox/Grid).
          3. Fallback to core blocks (wp:paragraph, wp:image) if a Spectra equivalent is overkill.
          4. Return ONLY the raw HTML content with Gutenberg comments.
          5. Ensure the markup is valid.`;
    } else if (framework === 'nexter') {
        systemPrompt = `You are an expert using Nexter Blocks (The Plus Addons for Gutenberg).
          Your task is to analyze the provided design and generate the exact Gutenberg Block markup using Nexter Blocks (TPGB) where appropriate.
          
          Rules:
          1. Use The Plus Addons blocks (wp:tpgb/container, wp:tpgb/advanced-typography, wp:tpgb/plus-image, wp:tpgb/button).
          2. Use 'wp:tpgb/container' for all main layout sections (Rows/Columns/Flex).
          3. Use 'wp:tpgb/advanced-typography' for headings and styled text.
          4. Fallback to core blocks if a specific Nexter block doesn't exist for the purpose.
          5. Return ONLY the raw HTML content with Gutenberg comments.`;
    } else if (framework === 'astra') {
        systemPrompt = `You are an expert WordPress developer specializing in the Astra Theme.
          Your task is to analyze the provided website image and generate the exact Gutenberg Block markup optimized for Astra.
          
          Rules:
          1. Use core WordPress blocks (wp:group, wp:columns, wp:heading).
          2. Apply Astra-specific utility classes if known (e.g., 'ast-container', 'ast-global-color-*').
          3. Structure layouts using Groups with 'alignfull' or 'alignwide' where appropriate for Astra's layout settings.
          4. Return ONLY the raw HTML content with Gutenberg comments.`;
    } else {
        // Default Gutenberg Core
        systemPrompt = `You are an expert WordPress Gutenberg developer. 
          Your task is to analyze the provided website image and generate the exact Gutenberg Block markup to replicate it.
          
          Rules:
          1. Use ONLY core WordPress blocks (wp:group, wp:columns, wp:image, wp:heading, wp:paragraph, wp:buttons).
          2. Use semantic HTML5 tags where possible (section, header, footer) via tagName attributes.
          3. Structure complex layouts using Groups and Columns.
          4. Apply inline styles for specific colors/spacing if standard classes don't fit, but prefer standard alignment.
          5. Return ONLY the raw HTML content with Gutenberg comments. Do not include markdown code fences or explanations.
          6. Ensure the markup is valid and can be pasted directly into the Code Editor in WordPress.`;
    }

    const userContent = inputType === 'url' ? [
        {
            type: "text",
            text: `I have a design at this URL: ${input}. ${context ? `\n\nUser Description/Context: ${context}` : ''}\n\nSince you cannot view external links directly, please generate a modern, high-quality Gutenberg layout based on the user's description (if provided) or infer it from the URL structure. If a description is present, PRIORITIZE it accurately.`
        }
    ] : [
        { type: "text", text: `Convert this design into ${framework === 'spectra' ? 'Spectra' : 'Gutenberg'} blocks.` },
        {
            type: "image_url",
            image_url: {
                "url": input,
                "detail": "high"
            },
        },
    ];

    const client = getClient(provider.id);

    try {
        const response = await client.chat.completions.create({
            model: provider.model,
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userContent,
                },
            ],
            temperature: 0.1,
            max_tokens: 4000,
        });

        let content = response.choices[0].message.content;

        // Clean up markdown if present
        content = content.replace(/```html/g, '').replace(/```/g, '').trim();

        return content;
    } catch (error) {
        console.error("Generation error:", error);
        throw describeError(error, provider);
    }
};

export const refineGutenbergBlocks = async (currentCode, userInstruction, providerId = getProvider()) => {
    const provider = getProviderConfig(providerId);
    const client = getClient(provider.id);

    try {
        const response = await client.chat.completions.create({
            model: provider.model,
            messages: [
                {
                    role: "system",
                    content: `You are an expert WordPress Gutenberg developer. 
          Your task is to MODIFY the provided Gutenberg Block markup based on the user's request.
          
          Rules:
          1. Return ONLY the raw HTML content with Gutenberg comments. 
          2. Do not include markdown code fences or explanations.
          3. Maintain the existing structure unless asked to change it.
          4. Ensure valid block syntax (e.g. <!-- wp:group -->).`
                },
                {
                    role: "user",
                    content: `CURRENT CODE:\n\n${currentCode}\n\nINSTRUCTION: ${userInstruction}`
                },
            ],
            temperature: 0.1,
            max_tokens: 4000,
        });

        let content = response.choices[0].message.content;
        content = content.replace(/```html/g, '').replace(/```/g, '').trim();

        return content;
    } catch (error) {
        console.error("Refinement error:", error);
        throw describeError(error, provider);
    }
};

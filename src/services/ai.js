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

    const headers = provider.defaultHeaders
        ? { ...provider.defaultHeaders, 'HTTP-Referer': window.location.origin }
        : undefined;

    return new OpenAI({
        apiKey,
        baseURL: provider.baseURL,
        defaultHeaders: headers,
        fetch: provider.stripSdkHeaders ? fetchWithoutSdkHeaders : undefined,
        dangerouslyAllowBrowser: true // The key is the user's own and never leaves their browser except to the provider.
    });
};

/*
 * The SDK adds X-Stainless-* telemetry headers to every request. Gemini's
 * CORS preflight allows only authorization and content-type, and answers 403
 * to anything more, so from a browser every Gemini call failed before it was
 * sent. Dropping the headers on the way out makes it a request Gemini accepts.
 */
const fetchWithoutSdkHeaders = (url, init = {}) => {
    const headers = new Headers(init.headers);
    [...headers.keys()]
        .filter((name) => name.toLowerCase().startsWith('x-stainless-'))
        .forEach((name) => headers.delete(name));
    return fetch(url, { ...init, headers });
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

    /* Gemini's 400 for a bad key reaches the browser with no readable body
       ("400 status code (no body)"), so there is nothing to match on. A bare
       400 from Gemini is almost always the key, so treat it as one. */
    const bareGemini400 = provider.id === 'gemini' && error?.status === 400 && !error?.error;

    const badKey = error?.status === 401 || bareGemini400 ||
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
    /* No status at all means the fetch itself failed. The common cause is a
       rejected key: OpenAI serves its 401 without an Access-Control-Allow-Origin
       header, so the browser discards the body and the SDK sees only a network
       error. Say that, rather than "Connection error." */
    if (!error?.status) {
        return new Error(
            `Could not reach ${name}. The most likely cause is a rejected API key — ` +
            `${name} returns that rejection without CORS headers, so the browser hides ` +
            `the real message. Check the key in the sidebar, then any ad blocker or VPN.`
        );
    }
    if (error?.status === 404) {
        return new Error(`${name} does not recognise the model ${provider.model}. It may have been retired.`);
    }
    return error;
};

/**
 * Shared by every prompt that emits core blocks. Without it the model
 * rebuilds a background photo as a separate wp:image sitting beside a
 * wp:group, which loses the text-over-image layout.
 */
const COVER_BLOCK_RULE = `BACKGROUND IMAGES — MANDATORY:
          Whenever a section has a photo, illustration or image BEHIND its content (hero banners, CTA strips, full-width image sections with text on top), build that section as ONE wp:cover block rendered as a <section> element.
          - Always set "tagName":"section" so the wrapper is <section class="wp-block-cover ...">, not <div>.
          - Always give it BOTH a background image AND a background colour:
            * colour: "customOverlayColor" = the section's ACTUAL background colour as seen in the image, as an exact hex. Sample the dominant colour of the section (e.g. a near-black section is #111111-#1e1e1e, not a grey or slate). Never default to grey, slate or #1e293b — match the design.
            * dimRatio: how much of the section that colour fills. If the image is only a subtle texture, pattern or faint graphic on a solid colour (the common case), use 80-90 so the section reads as that colour. Use 30-60 only when a clear photo is visible through a tint.
            * image: "url" with a placeholder whose colour IS the sampled hex (without the #), e.g. https://placehold.co/1600x800/111111/111111, plus the matching <img class="wp-block-cover__image-background"> element. A plain grey placeholder would show through the overlay and change the colour.
            * isDark: true for dark sections (adds no class). For light sections set "isDark":false AND add the class "is-light" to the <section> wrapper, as WordPress does.
          - Put the heading, text and buttons INSIDE the cover's inner container.
          - Never rebuild a background image as a separate wp:image next to or above a wp:group, and never use a wp:group with a background image for it.
          - Use wp:group (tagName "section") only for sections whose background is a plain colour or gradient with no image.
          Valid markup to follow exactly (the colour below is only an example — replace it, the dimRatio, minHeight and content with what the design shows):
          <!-- wp:cover {"url":"https://placehold.co/1600x800/151515/151515","dimRatio":90,"customOverlayColor":"#151515","isDark":true,"minHeight":500,"tagName":"section","align":"full","layout":{"type":"constrained"}} -->
          <section class="wp-block-cover alignfull" style="min-height:500px"><span aria-hidden="true" class="wp-block-cover__background has-background-dim-90 has-background-dim" style="background-color:#151515"></span><img class="wp-block-cover__image-background" alt="" src="https://placehold.co/1600x800/151515/151515" data-object-fit="cover"/><div class="wp-block-cover__inner-container"><!-- wp:heading {"textAlign":"center"} -->
          <h2 class="wp-block-heading has-text-align-center">Heading</h2>
          <!-- /wp:heading --></div></section>
          <!-- /wp:cover -->`;

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
          1. Use core WordPress blocks (wp:group, wp:cover, wp:columns, wp:heading).
          2. Apply Astra-specific utility classes if known (e.g., 'ast-container', 'ast-global-color-*').
          3. Structure layouts using Groups with 'alignfull' or 'alignwide' where appropriate for Astra's layout settings.
          4. Return ONLY the raw HTML content with Gutenberg comments.

          ${COVER_BLOCK_RULE}`;
    } else {
        // Default Gutenberg Core
        systemPrompt = `You are an expert WordPress Gutenberg developer. 
          Your task is to analyze the provided website image and generate the exact Gutenberg Block markup to replicate it.
          
          Rules:
          1. Use ONLY core WordPress blocks (wp:group, wp:cover, wp:columns, wp:image, wp:heading, wp:paragraph, wp:buttons).
          2. Use semantic HTML5 tags where possible (section, header, footer) via tagName attributes.
          3. Structure complex layouts using Groups and Columns.
          4. Apply inline styles for specific colors/spacing if standard classes don't fit, but prefer standard alignment.
          5. Return ONLY the raw HTML content with Gutenberg comments. Do not include markdown code fences or explanations.
          6. Ensure the markup is valid and can be pasted directly into the Code Editor in WordPress.

          ${COVER_BLOCK_RULE}`;
    }

    const userContent = inputType === 'url' ? [
        {
            type: "text",
            text: `I have a design at this URL: ${input}. ${context ? `\n\nUser Description/Context: ${context}` : ''}\n\nSince you cannot view external links directly, please generate a modern, high-quality Gutenberg layout based on the user's description (if provided) or infer it from the URL structure. If a description is present, PRIORITIZE it accurately.`
        }
    ] : [
        {
            type: "text",
            text: `Convert this design into ${framework === 'spectra' ? 'Spectra' : 'Gutenberg'} blocks.` +
                (context ? `\n\nSPECIFIC REQUIREMENTS FROM THE USER — follow these exactly; where they conflict with the image or the default rules, the requirements win:\n${context}` : '')
        },
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
          4. Ensure valid block syntax (e.g. <!-- wp:group -->).
          5. Keep existing wp:cover blocks as covers, and when the user asks for a background image, use a wp:cover with "tagName":"section", a background image url and a customOverlayColor — not a wp:group or a separate wp:image.`
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

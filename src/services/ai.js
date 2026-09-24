import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // Required for client-side usage (demo only)
});

export const generateGutenbergBlocks = async (input, framework = 'gutenberg', inputType = 'image', context = '') => {
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

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
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
        console.error("OpenAI API Error:", error);
        throw error;
    }
};

export const refineGutenbergBlocks = async (currentCode, userInstruction) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
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
        console.error("OpenAI Refinement Error:", error);
        throw error;
    }
};

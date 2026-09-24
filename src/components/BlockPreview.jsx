import React, { useMemo } from 'react';
import { PREVIEW_STYLESHEETS, PREVIEW_CSS } from '../styles/gutenbergPreview';
import { applyLayoutClasses } from '../utils/blockLayout';

const BlockPreview = ({ code }) => {
  const htmlContent = useMemo(() => {
    if (!code) return '';

    // Apply the layout classes WordPress would generate server-side, then
    // strip the comments they came from.
    let html = applyLayoutClasses(code)
      .replace(/<!--\s*wp:[\s\S]*?-->/g, '')
      .replace(/<!--\s*\/wp:[\s\S]*?-->/g, '');

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = doc.querySelectorAll('img');

    images.forEach((img, index) => {
      const existingSrc = img.getAttribute('src');
      const isAbsoluteUrl = existingSrc && (existingSrc.startsWith('http') || existingSrc.startsWith('data:'));
      // "placehold" rather than "placeholder": it catches placehold.co as
      // well as placeholder.com, and the templates use the former.
      const isPlaceholder = existingSrc && (existingSrc.includes('placehold') || existingSrc.includes('demo') || existingSrc.includes('image-url'));

      // A cover's background image is positioned by the block stylesheet
      // (absolute, inset 0, object-fit: cover). Inline height and radius are
      // author-level styles that beat it, dropping the image back into the
      // flow and on top of the cover's own content. Leave those alone.
      const positionedByBlockCss =
        img.classList.contains('wp-block-cover__image-background') ||
        Boolean(img.closest('.wp-block-cover'));

      if (!existingSrc || !isAbsoluteUrl || isPlaceholder) {
        let width = img.getAttribute('width') || 600;
        let height = img.getAttribute('height') || 400;

        if (positionedByBlockCss) {
          // A cover background sits behind real content under a dim overlay.
          // A labelled placeholder would compete with the heading, so use a
          // flat swatch and let the cover's own text carry the preview.
          img.setAttribute('src', `https://placehold.co/${width}x${height}/64748b/64748b`);
        } else {
          const text = `Image ${index + 1}`;
          img.setAttribute('src', `https://placehold.co/${width}x${height}/2563eb/FFF?text=${text}`);
        }
      }

      if (!positionedByBlockCss) {
        img.style.display = 'block';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.backgroundColor = '#e2e8f0';
      }
    });

    return doc.body.innerHTML;
  }, [code]);

  const containerRef = React.useRef(null);
  const shadowRootRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    // Initialize shadow root once
    if (!shadowRootRef.current) {
      shadowRootRef.current = containerRef.current.attachShadow({ mode: 'open' });
    }

    // Construct the Shadow DOM content
    // We inject the external sheets and our custom styles INSIDE the shadow root
    // This strictly isolates them from the rest of the app
    shadowRootRef.current.innerHTML = `
      ${PREVIEW_STYLESHEETS.map(href => `<link rel="stylesheet" href="${href}" />`).join('')}
      <style>${PREVIEW_CSS}
        /* Astra Theme Simulation & Reset */
        :host {
          display: block;
          height: 100%;
          overflow-y: auto;
          background-color: #fff;
        }

        .block-preview-viewport {
          /* Astra Default Font Stack */
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
          color: #3a3a3a; /* Astra default text color */
          line-height: 1.6;
          font-size: 16px;
          background-color: #fff;
        }

        .block-preview-viewport * {
          box-sizing: border-box;
        }

        /* Astra Headings */
        .block-preview-viewport h1, 
        .block-preview-viewport h2, 
        .block-preview-viewport h3, 
        .block-preview-viewport h4, 
        .block-preview-viewport h5, 
        .block-preview-viewport h6 {
          font-weight: 600;
          /* inherit, not a fixed colour: a heading inside a cover or a
             coloured group must take that context's text colour, which a
             literal #3a3a3a here would override and render unreadable. */
          color: inherit;
          margin-bottom: 0.6em;
          line-height: 1.2;
        }
        
        .block-preview-viewport h1 { font-size: 2.5rem; }
        .block-preview-viewport h2 { font-size: 2rem; }
        .block-preview-viewport h3 { font-size: 1.75rem; }
        .block-preview-viewport h4 { font-size: 1.5rem; }

        .block-preview-viewport p {
          margin-bottom: 1.5em;
        }

        .block-preview-viewport a {
          color: #0274be; /* Astra Link Color */
          text-decoration: none;
        }
        
        .block-preview-viewport a:hover {
          color: #3a3a3a;
        }

        /* Container Width (Astra standard content width) */
        .block-preview-viewport > div {
          padding: 3rem 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Fix map or generated content sizing if needed */
        .wp-block-image img {
          height: auto;
          max-width: 100%;
        }

        /* Ensure columns behave responsibly */
        @media (max-width: 780px) {
           .wp-block-columns {
             flex-direction: column !important;
           }
           
           .wp-block-column {
             flex-basis: 100% !important;
             margin-left: 0 !important;
             margin-right: 0 !important;
           }
        }
      </style>
      <div class="block-preview-viewport">
         <div class="gutenberg-content">${htmlContent}</div>
      </div>
    `;
  }, [htmlContent]);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%', background: 'white' }}
      title="Live Preview"
    />
  );
};

export default BlockPreview;

import React, { useState, useRef, useEffect } from 'react';

/**
 * Copy-to-clipboard button with its own "Copied!" tooltip.
 *
 * Each instance owns its state, so the Block Markup and Block JSON panels
 * each confirm independently instead of sharing one flag.
 */
const CopyButton = ({ value, title = 'Copy' }) => {
    const [state, setState] = useState('idle'); // 'idle' | 'copied' | 'failed'
    const timer = useRef(null);

    // Clearing on unmount avoids setting state after the tab is switched away.
    useEffect(() => () => clearTimeout(timer.current), []);

    const flash = (next) => {
        clearTimeout(timer.current);
        setState(next);
        timer.current = setTimeout(() => setState('idle'), 1800);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            flash('copied');
        } catch {
            // Clipboard can be blocked by permissions or a non-secure origin.
            flash('failed');
        }
    };

    return (
        <div className="copy-wrap">
            <button
                type="button"
                className="btn-icon copy-btn"
                onClick={handleCopy}
                title={title}
                aria-label={title}
            >
                {state === 'copied' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                )}
            </button>

            <span
                className={`copy-tooltip${state !== 'idle' ? ' show' : ''}${state === 'failed' ? ' failed' : ''}`}
                role="status"
                aria-live="polite"
            >
                {state === 'failed' ? 'Press Ctrl+C' : 'Copied!'}
            </span>
        </div>
    );
};

export default CopyButton;

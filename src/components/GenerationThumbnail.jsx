import React, { useEffect, useRef, useState } from 'react';
import BlockPreview from './BlockPreview';

// The layout is rendered at a desktop width, then scaled down to fit the
// card, so the thumbnail shows the page as it was built rather than a
// squeezed mobile layout.
const RENDER_WIDTH = 1200;
const THUMB_HEIGHT = 120;

/**
 * Miniature of a saved generation's markup. It renders only once it scrolls
 * into view, so a long history does not build dozens of previews up front.
 */
const GenerationThumbnail = ({ code }) => {
    const frameRef = useRef(null);
    const [visible, setVisible] = useState(false);
    const [scale, setScale] = useState(0.25);

    useEffect(() => {
        const el = frameRef.current;
        if (!el) return undefined;

        const resize = new ResizeObserver(([entry]) => {
            const width = entry.contentRect.width;
            if (width) setScale(width / RENDER_WIDTH);
        });
        resize.observe(el);

        const seen = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setVisible(true);
                seen.disconnect();
            }
        }, { rootMargin: '200px' });
        seen.observe(el);

        return () => {
            resize.disconnect();
            seen.disconnect();
        };
    }, []);

    return (
        <div className="history-thumb" ref={frameRef} style={{ height: THUMB_HEIGHT }}>
            {visible && code ? (
                <div
                    className="history-thumb-canvas"
                    style={{
                        width: RENDER_WIDTH,
                        height: THUMB_HEIGHT / scale,
                        transform: `scale(${scale})`,
                    }}
                >
                    <BlockPreview code={code} thumbnail />
                </div>
            ) : (
                <div className="history-thumb-empty" />
            )}
        </div>
    );
};

export default GenerationThumbnail;

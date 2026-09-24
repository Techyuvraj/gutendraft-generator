/**
 * Reproduces the layout classes WordPress adds when it renders a block.
 *
 * A block comment carries its layout as an attribute:
 *
 *   <!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
 *   <div class="wp-block-buttons">
 *
 * On a real site the server turns that attribute into `is-layout-flex` and
 * `is-content-justification-center` on the wrapper. Rendering the markup
 * directly in a browser skips that step, so flex and grid containers fall
 * back to block layout and the preview looks wrong. This puts the classes
 * back before the comments are stripped.
 */

/**
 * The layout class core applies to a block that declares no layout of its own.
 *
 * `cover` is deliberately absent. Its wrapper holds two structural children —
 * the background span and the background image — which are absolutely
 * positioned by the block stylesheet. Putting a layout class on the cover
 * would constrain and margin-stack those, so core instead puts it on
 * `.wp-block-cover__inner-container`.
 */
const DEFAULT_LAYOUT_CLASS = {
    group: 'is-layout-constrained',
    columns: 'is-layout-flex',
    column: 'is-layout-flow',
    buttons: 'is-layout-flex',
    'social-links': 'is-layout-flex',
};

const LAYOUT_TYPE_CLASS = {
    flex: 'is-layout-flex',
    grid: 'is-layout-grid',
    constrained: 'is-layout-constrained',
    default: 'is-layout-flow',
    flow: 'is-layout-flow',
};

const JUSTIFICATION_CLASS = {
    left: 'is-content-justification-left',
    center: 'is-content-justification-center',
    right: 'is-content-justification-right',
    'space-between': 'is-content-justification-space-between',
};

/** Matches an opening block comment and the element that follows it. */
const BLOCK_OPENING = /<!--\s*wp:([a-z0-9/-]+)\s*(\{[\s\S]*?\})?\s*-->(\s*)<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

const classesFor = (blockName, attrs) => {
    const out = [];
    const layout = attrs && typeof attrs.layout === 'object' ? attrs.layout : null;
    const shortName = blockName.replace(/^core\//, '');

    // Never on the cover wrapper, even when it declares a layout: the class
    // belongs on its inner container (see DEFAULT_LAYOUT_CLASS).
    if (shortName === 'cover') return out;

    if (layout) {
        const typeClass = LAYOUT_TYPE_CLASS[layout.type] || 'is-layout-flow';
        out.push(typeClass);

        if (layout.justifyContent && JUSTIFICATION_CLASS[layout.justifyContent]) {
            out.push(JUSTIFICATION_CLASS[layout.justifyContent]);
        }
        if (layout.orientation === 'vertical') out.push('is-vertical');
        if (layout.flexWrap === 'nowrap') out.push('is-nowrap');
    } else if (DEFAULT_LAYOUT_CLASS[shortName]) {
        out.push(DEFAULT_LAYOUT_CLASS[shortName]);
    }

    return out;
};

/**
 * Adds WordPress's generated layout classes to block wrappers.
 * Returns the markup unchanged if it contains no block comments.
 */
export const applyLayoutClasses = (markup) => {
    if (!markup || !markup.includes('<!-- wp:')) return markup || '';

    return markup.replace(
        BLOCK_OPENING,
        (match, blockName, rawAttrs, gap, tagName, tagAttrs) => {
            let attrs = null;
            if (rawAttrs) {
                try {
                    attrs = JSON.parse(rawAttrs);
                } catch {
                    // A malformed attribute block is not worth failing over;
                    // the element simply keeps the classes it already has.
                    return match;
                }
            }

            const added = classesFor(blockName, attrs);
            if (added.length === 0) return match;

            const existing = tagAttrs.match(/\sclass\s*=\s*"([^"]*)"/i);

            if (existing) {
                const merged = [
                    ...new Set([...existing[1].split(/\s+/).filter(Boolean), ...added]),
                ].join(' ');
                const nextAttrs = tagAttrs.replace(existing[0], ` class="${merged}"`);
                return `<!-- wp:${blockName}${rawAttrs ? ' ' + rawAttrs : ''} -->${gap}<${tagName}${nextAttrs}>`;
            }

            return `<!-- wp:${blockName}${rawAttrs ? ' ' + rawAttrs : ''} -->${gap}<${tagName}${tagAttrs} class="${added.join(' ')}">`;
        }
    );
};

/**
 * Stylesheets and generated CSS that make the preview render like a real
 * WordPress front end.
 *
 * WordPress serves block appearance from @wordpress/block-library, but the
 * layout, alignment, colour and font-size classes are emitted server-side
 * from theme.json and ship in no package. Everything below the stylesheet
 * list reproduces that generated output, which is why covers, columns and
 * aligned groups previously rendered wrong.
 */

const BLOCK_LIBRARY_VERSION = '11.1.0';

const cdn = (file) =>
    `https://cdn.jsdelivr.net/npm/@wordpress/block-library@${BLOCK_LIBRARY_VERSION}/build-style/${file}`;

/**
 * Front-end sheets, in WordPress's own load order. `editor.css` is
 * deliberately absent: it styles the editor chrome, not published output.
 */
export const PREVIEW_STYLESHEETS = [
    cdn('common.css'),
    cdn('style.css'),
    cdn('theme.css'),
];

/* Core's default palette, font sizes, spacing scale and gradients. */
const COLORS = {
    'black': '#000000',
    'cyan-bluish-gray': '#abb8c3',
    'white': '#ffffff',
    'pale-pink': '#f78da7',
    'vivid-red': '#cf2e2e',
    'luminous-vivid-orange': '#ff6900',
    'luminous-vivid-amber': '#fcb900',
    'light-green-cyan': '#7bdcb5',
    'vivid-green-cyan': '#00d084',
    'pale-cyan-blue': '#8ed1fc',
    'vivid-cyan-blue': '#0693e3',
    'vivid-purple': '#9b51e0',
};

const FONT_SIZES = {
    'small': '13px',
    'medium': '20px',
    'large': '36px',
    'x-large': '42px',
};

const SPACING = {
    '20': '0.44rem',
    '30': '0.67rem',
    '40': '1rem',
    '50': '1.5rem',
    '60': '2.25rem',
    '70': '3.38rem',
    '80': '5.06rem',
};

const GRADIENTS = {
    'vivid-cyan-blue-to-vivid-purple':
        'linear-gradient(135deg,rgba(6,147,227,1) 0%,rgb(155,81,224) 100%)',
    'light-green-cyan-to-vivid-green-cyan':
        'linear-gradient(135deg,rgb(122,220,180) 0%,rgb(0,208,130) 100%)',
    'luminous-vivid-amber-to-luminous-vivid-orange':
        'linear-gradient(135deg,rgba(252,185,0,1) 0%,rgba(255,105,0,1) 100%)',
    'luminous-vivid-orange-to-vivid-red':
        'linear-gradient(135deg,rgba(255,105,0,1) 0%,rgb(207,46,46) 100%)',
    'very-light-gray-to-cyan-bluish-gray':
        'linear-gradient(135deg,rgb(238,238,238) 0%,rgb(169,184,195) 100%)',
    'cool-to-warm-spectrum':
        'linear-gradient(135deg,rgb(74,234,220) 0%,rgb(151,120,209) 20%,rgb(207,42,186) 40%,rgb(238,44,130) 60%,rgb(251,105,98) 80%,rgb(254,248,76) 100%)',
    'blush-light-purple':
        'linear-gradient(135deg,rgb(255,206,236) 0%,rgb(152,150,240) 100%)',
    'blush-bordeaux':
        'linear-gradient(135deg,rgb(254,205,165) 0%,rgb(254,45,45) 50%,rgb(107,0,62) 100%)',
    'purple-crush':
        'linear-gradient(135deg,rgb(52,226,228) 0%,rgb(71,30,204) 50%,rgb(255,104,187) 100%)',
    'midnight':
        'linear-gradient(135deg,rgb(2,3,129) 0%,rgb(40,116,252) 100%)',
};

const entries = (obj) => Object.entries(obj);

/** The `--wp--preset--*` custom properties WordPress exposes to blocks. */
const presetVariables = [
    ...entries(COLORS).map(([n, v]) => `    --wp--preset--color--${n}: ${v};`),
    ...entries(FONT_SIZES).map(([n, v]) => `    --wp--preset--font-size--${n}: ${v};`),
    ...entries(SPACING).map(([n, v]) => `    --wp--preset--spacing--${n}: ${v};`),
    ...entries(GRADIENTS).map(([n, v]) => `    --wp--preset--gradient--${n}: ${v};`),
].join('\n');

/**
 * Utility classes. WordPress marks these !important so an explicit author
 * choice always beats a block's own styling; matching that keeps the preview
 * faithful rather than merely close.
 */
const presetClasses = [
    ...entries(COLORS).flatMap(([n]) => [
        `.has-${n}-color { color: var(--wp--preset--color--${n}) !important; }`,
        `.has-${n}-background-color { background-color: var(--wp--preset--color--${n}) !important; }`,
        `.has-${n}-border-color { border-color: var(--wp--preset--color--${n}) !important; }`,
    ]),
    ...entries(FONT_SIZES).map(
        ([n]) => `.has-${n}-font-size { font-size: var(--wp--preset--font-size--${n}) !important; }`
    ),
    ...entries(GRADIENTS).map(
        ([n]) => `.has-${n}-gradient-background { background: var(--wp--preset--gradient--${n}) !important; }`
    ),
].join('\n');

/**
 * Layout, alignment and preset CSS.
 *
 * `--preview-gutter` is the viewport's own horizontal padding; `.alignfull`
 * cancels it to break out edge to edge, the way a full-width block escapes a
 * theme's content container.
 */
export const PREVIEW_CSS = `
.block-preview-viewport {
    --preview-gutter: 2rem;
    --wp--style--global--content-size: 840px;
    --wp--style--global--wide-size: 1200px;
    --wp--style--block-gap: 24px;
${presetVariables}
}

/* ---- Layout types ---- */

.block-preview-viewport .is-layout-flow > *,
.block-preview-viewport .is-layout-constrained > * {
    margin-block-start: var(--wp--style--block-gap);
    margin-block-end: 0;
}

.block-preview-viewport .is-layout-flow > :first-child,
.block-preview-viewport .is-layout-constrained > :first-child {
    margin-block-start: 0;
}

.block-preview-viewport .is-layout-flow > :last-child,
.block-preview-viewport .is-layout-constrained > :last-child {
    margin-block-end: 0;
}

.block-preview-viewport .is-layout-constrained
    > :not(.alignleft):not(.alignright):not(.alignfull) {
    max-width: var(--wp--style--global--content-size);
    margin-left: auto;
    margin-right: auto;
}

.block-preview-viewport .is-layout-constrained > .alignwide {
    max-width: var(--wp--style--global--wide-size);
}

.block-preview-viewport .is-layout-flex {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--wp--style--block-gap);
}

.block-preview-viewport .is-layout-flex > * {
    margin: 0;
}

.block-preview-viewport .is-layout-flex.is-vertical {
    flex-direction: column;
    align-items: flex-start;
}

.block-preview-viewport .is-layout-flex.is-nowrap {
    flex-wrap: nowrap;
}

.block-preview-viewport .is-layout-grid {
    display: grid;
    gap: var(--wp--style--block-gap);
}

.block-preview-viewport .is-layout-grid > * {
    margin: 0;
}

.block-preview-viewport .is-content-justification-center {
    justify-content: center;
}

.block-preview-viewport .is-content-justification-right {
    justify-content: flex-end;
}

.block-preview-viewport .is-content-justification-space-between {
    justify-content: space-between;
}

/* ---- Alignment ---- */

.block-preview-viewport .alignfull {
    max-width: none !important;
    width: auto;
    margin-left: calc(-1 * var(--preview-gutter));
    margin-right: calc(-1 * var(--preview-gutter));
}

.block-preview-viewport .alignwide {
    max-width: var(--wp--style--global--wide-size);
}

.block-preview-viewport .aligncenter {
    margin-left: auto;
    margin-right: auto;
}

.block-preview-viewport .alignleft {
    float: left;
    margin-right: var(--wp--style--block-gap);
    margin-bottom: var(--wp--style--block-gap);
}

.block-preview-viewport .alignright {
    float: right;
    margin-left: var(--wp--style--block-gap);
    margin-bottom: var(--wp--style--block-gap);
}

.block-preview-viewport .has-text-align-center { text-align: center; }
.block-preview-viewport .has-text-align-left { text-align: left; }
.block-preview-viewport .has-text-align-right { text-align: right; }

/* ---- Cover internals ----
   The background span and image are absolutely positioned by the block
   stylesheet. Guard them against any layout rule that would constrain their
   width or stack them with block-gap margins. */

.block-preview-viewport .wp-block-cover > .wp-block-cover__background,
.block-preview-viewport .wp-block-cover > .wp-block-cover__image-background,
.block-preview-viewport .wp-block-cover > video.wp-block-cover__video-background {
    margin: 0 !important;
    max-width: none !important;
}

/* Core gives the inner container flow spacing; without a layout class of its
   own it would otherwise render with no gaps between blocks. */
.block-preview-viewport .wp-block-cover__inner-container > * {
    margin-block-start: var(--wp--style--block-gap);
    margin-block-end: 0;
}

.block-preview-viewport .wp-block-cover__inner-container > :first-child {
    margin-block-start: 0;
}

/* A group or column carrying its own background needs padding, which core
   supplies through theme.json rather than through the block stylesheet. */
.block-preview-viewport .wp-block-group.has-background,
.block-preview-viewport .wp-block-column.has-background {
    padding: var(--wp--preset--spacing--50);
}

/* ---- Preset utility classes ---- */

${presetClasses}
`;
